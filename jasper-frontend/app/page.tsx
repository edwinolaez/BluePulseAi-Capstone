// This is the main entry point of the app — the root page that controls
// everything the user sees after logging in.
// It handles: which tab is active, whether the sidebar is open,
// authentication state, and rendering the correct page component.

"use client";

import { useCallback, useState } from "react";
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

  // The superadmin confirmation modal — only shows after a superadmin logs in
  const [showSuperConfirm, setShowSuperConfirm] = useState(false);

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
          <div className="w-10 h-10 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
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

        {/* Sidebar — shows sector navigation and quick links.
            On mobile, it slides in as a drawer when the hamburger icon is tapped. */}
        <Sidebar
          activeTab={activeTab}
          onNavigate={handleTabChange}
          onFocusSector={focusSector}
          onOpenLogs={openLogs}
          onOpenSupport={() => setSupportOpen(true)}
          mobileOpen={sidebarOpen}
          onCloseMobile={() => setSidebarOpen(false)}
        />

        {/* Only one of these pages renders at a time depending on the active tab */}
        {activeTab === "map"       && <MapViewPage flyTo={flyTo} />}
        {activeTab === "dashboard" && <DashboardPage />}
        {activeTab === "ai"        && <AiOverviewPage />}
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
    </div>
  );
}
