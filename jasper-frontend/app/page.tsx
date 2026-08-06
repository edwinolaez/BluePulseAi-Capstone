/**
 * page.tsx — Root page component for Project Jasper.
 *
 * This is the single-page application shell that sits at the "/" route.
 * It owns all top-level state: which tab is active, sidebar open/closed,
 * which map layers are shown, and whether the 3D view is enabled.
 *
 * Rendering logic:
 *   1. Shows a spinner while AuthContext checks localStorage for a saved session.
 *   2. Shows LoginPage (+ optional SuperadminConfirmModal) when no user is logged in.
 *   3. Shows the full dashboard (TopNav + Sidebar + active page + Footer) once logged in.
 *
 * Only one page component renders at a time — the active one is chosen by the
 * `activeTab` state variable controlled by TopNav clicks.
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { KeyboardShortcutsHelp } from "./components/UI/KeyboardShortcutsHelp";
import { useAuth } from "./contexts/AuthContext";
import { TopNav, AppTab } from "./components/Layout/TopNav";
import { Sidebar } from "./components/Layout/Sidebar";
import { Footer } from "./components/Layout/Footer";
import { LiveGisLogsPanel } from "./components/Layout/LiveGisLogsPanel";
import { SupportRequestModal } from "./components/Layout/SupportRequestModal";
import { LoginPage } from "./components/Auth/LoginPage";
import { SuperadminConfirmModal } from "./components/Auth/SuperadminConfirmModal";
import { MapViewPage } from "./components/Pages/MapViewPage";
import { DashboardPage } from "./components/Pages/DashboardPage";
import { ReportsPage } from "./components/Pages/ReportsPage";
import { ArchivesPage } from "./components/Pages/ArchivesPage";
import { AdminPage } from "./components/Pages/AdminPage";
import { AiOverviewPage } from "./components/Pages/AiOverviewPage";
import type { FlyToTarget } from "./components/Map/JasperMap";
import { fetchTimeline } from "../lib/api";
import type { SimulationResults, FieldPhoto, TimelineScan } from "../lib/api";
import { interpolateScans } from "../lib/interpolation";
import type { InterpolatedState } from "../lib/interpolation";

/**
 * Home — the root page component mounted at "/".
 *
 * Manages all top-level UI state for the dashboard shell (active tab,
 * sidebar, layer toggles, fly-to target) and delegates rendering to
 * the appropriate page component based on which tab is selected.
 */
export default function Home() {
  // useAuth gives us the currently logged-in user and the logout function.
  // If currentUser is null, we show the login page instead of the dashboard.
  const { currentUser, pendingSuperadmin, isLoading, logout } = useAuth();

  // Tracks which top-level tab is currently visible (Map, Dashboard, AI, etc.)
  const [activeTab, setActiveTab]     = useState<AppTab>("map");
  // Controls whether the GIS diagnostic logs panel is open
  const [logsOpen, setLogsOpen]       = useState(false);
  // Shows a red dot on the bell icon when there are unread alerts
  const [hasUnread, setHasUnread]     = useState(true);
  // Controls whether the Support Request modal is open
  const [supportOpen, setSupportOpen] = useState(false);
  // Controls whether the mobile sidebar drawer is open
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // When a user clicks a sector in the sidebar, flyTo tells the map to pan there
  const [flyTo, setFlyTo]             = useState<FlyToTarget | null>(null);
  const [is3D, setIs3D]               = useState(false);
  const [showErosion, setShowErosion]         = useState(true);
  const [showContaminant, setShowContaminant] = useState(true);
  const [showBurnScar, setShowBurnScar]       = useState(true);
  const [showElevation, setShowElevation]     = useState(true);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [simulationResults, setSimulationResults] = useState<SimulationResults | null>(null);
  const [fieldPhotos, setFieldPhotos]             = useState<FieldPhoto[]>([]);

  // Digital twin slider state — lifted so Map tab and AI Overview tab stay in sync
  const [slopeDeg,           setSlopeDeg]           = useState(22);
  const [rainfallMm,         setRainfallMm]         = useState(82);
  const [contaminationLevel, setContaminationLevel] = useState(0.72);

  // Sector / timeline state — lifted here so Sidebar and MapViewPage share it
  const [sectorId, setSectorId]         = useState<string | null>(null);
  const [dateFrom, setDateFrom]         = useState("2024-06-01");
  const [dateTo, setDateTo]             = useState("2024-07-24");
  const [centerDate, setCenterDate]     = useState("2024-06-24");
  const [timelineScans, setTimelineScans] = useState<TimelineScan[]>([]);
  const [interpolated, setInterpolated]   = useState<InterpolatedState | null>(null);
  const fetchIdRef = useRef(0);

  useEffect(() => {
    if (!sectorId) { setTimelineScans([]); setInterpolated(null); return; }
    const id = ++fetchIdRef.current;
    fetchTimeline(sectorId)
      .then(data => { if (id === fetchIdRef.current) setTimelineScans(data.scans); })
      .catch(() => { if (id === fetchIdRef.current) setTimelineScans([]); });
  }, [sectorId]);

  useEffect(() => {
    setInterpolated(interpolateScans(timelineScans, new Date(centerDate).getTime()));
  }, [centerDate, timelineScans]);

  // The superadmin confirmation modal — only shows after a superadmin logs in
  const [showSuperConfirm, setShowSuperConfirm] = useState(false);

  // Stable ref so the keydown handler always sees the current activeTab
  // without needing to re-register the listener on every tab change.
  const activeTabRef = useRef(activeTab);
  useEffect(() => { activeTabRef.current = activeTab; }, [activeTab]);

  // Global keyboard shortcuts — skipped when focus is inside any text input.
  useEffect(() => {
    if (!currentUser) return;
    const onKey = (e: KeyboardEvent) => {
      const tgt = e.target as HTMLElement;
      if (
        // Block shortcuts when the user is typing into a text field, select, or rich text editor.
        // IMPORTANT: `type !== "range"` is intentional — we do NOT block shortcuts after the user
        // interacts with a slider (<input type="range">).  Without this exclusion, moving a digital
        // twin slider shifts browser focus to that input element, and the next keypress fires the
        // INPUT guard instead of a shortcut.  The range exclusion was added Aug 5 2026 after
        // users reported that shortcuts stopped working after touching any slider.
        (tgt.tagName === "INPUT" && (tgt as HTMLInputElement).type !== "range") ||
        tgt.tagName === "TEXTAREA" ||
        tgt.tagName === "SELECT" ||
        tgt.isContentEditable
      ) return;

      const onMap = activeTabRef.current === "map";
      switch (e.key) {
        case "?":                    setShortcutsOpen(v => !v);              break;
        case "Escape":               setShortcutsOpen(false); setSidebarOpen(false); break;
        case "m": case "M":  setActiveTab("map");       setSidebarOpen(false); break;
        case "d": case "D":  setActiveTab("dashboard"); setSidebarOpen(false); break;
        case "a": case "A":  setActiveTab("ai");        setSidebarOpen(false); break;
        case "r": case "R":  setActiveTab("reports");   setSidebarOpen(false); break;
        case "s": case "S":         setSidebarOpen(v => !v);                break;
        case "3":      if (onMap)   setIs3D(v => !v);                       break;
        case "e": case "E": if (onMap) setShowErosion(v => !v);             break;
        case "f": case "F": if (onMap) setShowBurnScar(v => !v);            break;
        case "w": case "W": if (onMap) setShowContaminant(v => !v);         break;
        case "l": case "L": if (onMap) setShowElevation(v => !v);           break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [currentUser]);

  // Opens the logs panel and clears the unread indicator at the same time
  const openLogs = useCallback(() => {
    setLogsOpen(true);
    setHasUnread(false);
  }, []);

  // Called from the sidebar when the user clicks on a specific sector.
  // Switches to the map tab and tells the map to fly to those coordinates.
  const focusSector = useCallback((lat: number, lng: number, zoom: number) => {
    setActiveTab("map");
    setSidebarOpen(false);
    setFlyTo({ lat, lng, zoom, nonce: Date.now() });
  }, []);

  // Switches the active tab and closes the mobile sidebar at the same time
  const handleTabChange = useCallback((tab: AppTab) => {
    setActiveTab(tab);
    setSidebarOpen(false);
  }, []);

  // ── Loading state — shown while the auth check runs on first load ─────────
  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gray-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-sait-sky/30 border-t-sait-sky rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Loading…</p>
        </div>
      </div>
    );
  }

  // ── Not logged in — show the login screen ────────────────────────────────
  // The superadmin confirm modal sits on top of the login page as a second step
  if (!currentUser) {
    return (
      <>
        <LoginPage
          onLoginSuccess={() => {}}
          onSuperadminPending={() => setShowSuperConfirm(true)}
        />
        {(pendingSuperadmin || showSuperConfirm) && (
          <SuperadminConfirmModal onConfirmed={() => setShowSuperConfirm(false)} />
        )}
      </>
    );
  }

  // ── Logged in — show the full dashboard ──────────────────────────────────
  // The layout is a full-screen column: TopNav on top, content in the middle, Footer at the bottom.
  // Only one page component renders at a time based on activeTab.
  return (
    <div className="h-screen w-screen flex flex-col bg-background overflow-hidden">

      {/* Top navigation bar — shows tabs, notification bell, settings, and user avatar */}
      <TopNav
        activeTab={activeTab}
        onTabChange={handleTabChange}
        onOpenLogs={openLogs}
        hasUnread={hasUnread}
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
        onOpenSupport={() => setSupportOpen(true)}
        currentUser={currentUser}
        onLogout={logout}
      />

      {/* Main content area — sidebar on the left, active page on the right */}
      <div className="flex flex-1 min-h-0 relative overflow-hidden">

        {/* Sidebar — map-only; hidden on all other tabs */}
        {activeTab === "map" && <Sidebar
          activeTab={activeTab}
          onNavigate={handleTabChange}
          onFocusSector={focusSector}
          onOpenLogs={openLogs}
          onOpenSupport={() => setSupportOpen(true)}
          mobileOpen={sidebarOpen}
          onCloseMobile={() => setSidebarOpen(false)}
          is3D={is3D}
          onToggle3D={setIs3D}
          showErosion={showErosion}
          onToggleErosion={setShowErosion}
          showContaminant={showContaminant}
          onToggleContaminant={setShowContaminant}
          showBurnScar={showBurnScar}
          onToggleBurnScar={setShowBurnScar}
          showElevation={showElevation}
          onToggleElevation={setShowElevation}
          sectorId={sectorId}
          dateFrom={dateFrom}
          dateTo={dateTo}
          interpolated={interpolated}
          onDateRangeChange={(from, to, center) => { setDateFrom(from); setDateTo(to); setCenterDate(center); }}
          photos={fieldPhotos}
        />}

        {/* Only one of these pages renders at a time depending on the active tab */}
        {activeTab === "map"       && <MapViewPage flyTo={flyTo} is3D={is3D} showErosion={showErosion} showContaminant={showContaminant} showBurnScar={showBurnScar} showElevation={showElevation} simulationResults={simulationResults} sectorId={sectorId} onSectorClick={setSectorId} dateFrom={dateFrom} dateTo={dateTo} centerDate={centerDate} slopeDeg={slopeDeg} onSlopeDegChange={setSlopeDeg} rainfallMm={rainfallMm} onRainfallMmChange={setRainfallMm} contaminationLevel={contaminationLevel} onContaminationLevelChange={setContaminationLevel} />}
        {activeTab === "dashboard" && <DashboardPage photos={fieldPhotos} onPhotosChange={setFieldPhotos} simulationResults={simulationResults} />}
        {activeTab === "ai"        && <AiOverviewPage onResultsUpdate={setSimulationResults} onNavigateToMap={() => handleTabChange("map")} slopeDeg={slopeDeg} rainfallMm={rainfallMm} contaminationLevel={contaminationLevel} />}
        {activeTab === "reports"   && <ReportsPage />}
        {activeTab === "archives"  && <ArchivesPage />}
        {/* Admin page only renders for superadmin — extra safety check here */}
        {activeTab === "admin"     && currentUser.role === "superadmin" && <AdminPage />}
      </div>

      {/* Footer — shows user info and system status */}
      <Footer currentUser={currentUser} />

      {/* Overlay panels — these slide in from the side when triggered */}
      <LiveGisLogsPanel    open={logsOpen}   onClose={() => setLogsOpen(false)} />
      <SupportRequestModal open={supportOpen} onClose={() => setSupportOpen(false)} />

      {/* Keyboard shortcuts help — press ? to open */}
      {shortcutsOpen && <KeyboardShortcutsHelp onClose={() => setShortcutsOpen(false)} />}
    </div>
  );
}
