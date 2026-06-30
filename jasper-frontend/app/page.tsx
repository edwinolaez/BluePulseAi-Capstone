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
import type { FlyToTarget } from "./components/Map/JasperMap";

export default function Home() {
  const { currentUser, pendingSuperadmin, isLoading, logout } = useAuth();

  const [activeTab, setActiveTab]     = useState<AppTab>("map");
  const [logsOpen, setLogsOpen]       = useState(false);
  const [hasUnread, setHasUnread]     = useState(true);
  const [supportOpen, setSupportOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [flyTo, setFlyTo]             = useState<FlyToTarget | null>(null);

  // Whether to show the superadmin confirm modal
  const [showSuperConfirm, setShowSuperConfirm] = useState(false);

  const openLogs = useCallback(() => {
    setLogsOpen(true);
    setHasUnread(false);
  }, []);

  const focusSector = useCallback((lat: number, lng: number, zoom: number) => {
    setActiveTab("map");
    setSidebarOpen(false);
    setFlyTo({ lat, lng, zoom, nonce: Date.now() });
  }, []);

  const handleTabChange = useCallback((tab: AppTab) => {
    setActiveTab(tab);
    setSidebarOpen(false);
  }, []);

  // ── Loading splash ────────────────────────────────────────────────────────
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

  // ── Login gate ────────────────────────────────────────────────────────────
  if (!currentUser) {
    return (
      <>
        <LoginPage
          onLoginSuccess={() => {}}                 // regular login completes immediately
          onSuperadminPending={() => setShowSuperConfirm(true)}
        />
        {/* Superadmin confirmation sits on top of the login page */}
        {(pendingSuperadmin || showSuperConfirm) && (
          <SuperadminConfirmModal onConfirmed={() => setShowSuperConfirm(false)} />
        )}
      </>
    );
  }

  // ── Authenticated dashboard ────────────────────────────────────────────────
  return (
    <div className="h-screen w-screen flex flex-col bg-background overflow-hidden">
      <TopNav
        activeTab={activeTab}
        onTabChange={handleTabChange}
        onOpenLogs={openLogs}
        hasUnread={hasUnread}
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
        currentUser={currentUser}
        onLogout={logout}
      />

      <div className="flex flex-1 min-h-0 relative">
        <Sidebar
          activeTab={activeTab}
          onNavigate={handleTabChange}
          onFocusSector={focusSector}
          onOpenLogs={openLogs}
          onOpenSupport={() => setSupportOpen(true)}
          mobileOpen={sidebarOpen}
          onCloseMobile={() => setSidebarOpen(false)}
        />

        {activeTab === "map"       && <MapViewPage flyTo={flyTo} />}
        {activeTab === "dashboard" && <DashboardPage />}
        {activeTab === "reports"   && <ReportsPage />}
        {activeTab === "archives"  && <ArchivesPage />}
        {activeTab === "admin"     && currentUser.role === "superadmin" && <AdminPage />}
      </div>

      <Footer currentUser={currentUser} />

      <LiveGisLogsPanel    open={logsOpen}   onClose={() => setLogsOpen(false)} />
      <SupportRequestModal open={supportOpen} onClose={() => setSupportOpen(false)} />
    </div>
  );
}
