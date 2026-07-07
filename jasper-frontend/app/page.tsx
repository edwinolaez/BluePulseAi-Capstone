"use client";

import { useCallback, useState } from "react";
import { TopNav, AppTab } from "./components/Layout/TopNav";
import { Sidebar } from "./components/Layout/Sidebar";
import { Footer } from "./components/Layout/Footer";
import { LiveGisLogsPanel } from "./components/Layout/LiveGisLogsPanel";
import { MapViewPage } from "./components/Pages/MapViewPage";
import { DashboardPage } from "./components/Pages/DashboardPage";
import { ReportsPage } from "./components/Pages/ReportsPage";
import { ArchivesPage } from "./components/Pages/ArchivesPage";
import type { FlyToTarget } from "./components/Map/JasperMap";

export default function Home() {
  const [activeTab, setActiveTab] = useState<AppTab>("map");
  const [logsOpen, setLogsOpen]   = useState(false);
  const [hasUnread, setHasUnread] = useState(true);
  const [flyTo, setFlyTo]         = useState<FlyToTarget | null>(null);

  const openLogs = useCallback(() => {
    setLogsOpen(true);
    setHasUnread(false);
  }, []);

  const focusSector = useCallback((lat: number, lng: number, zoom: number) => {
    setActiveTab("map");
    setFlyTo({ lat, lng, zoom, nonce: Date.now() });
  }, []);

  return (
    <div className="h-screen w-screen flex flex-col bg-background">
      <TopNav activeTab={activeTab} onTabChange={setActiveTab} onOpenLogs={openLogs} hasUnread={hasUnread} />
      <div className="flex flex-1 min-h-0">
        <Sidebar activeTab={activeTab} onNavigate={setActiveTab} onFocusSector={focusSector} onOpenLogs={openLogs} />
        {activeTab === "map" && <MapViewPage flyTo={flyTo} />}
        {activeTab === "dashboard" && <DashboardPage />}
        {activeTab === "reports" && <ReportsPage />}
        {activeTab === "archives" && <ArchivesPage />}
      </div>
      <Footer />
      <LiveGisLogsPanel open={logsOpen} onClose={() => setLogsOpen(false)} />
    </div>
  );
}
