"use client";

import { useState } from "react";
import {
  ArrowUpRightIcon,
  ChartLineIcon,
  DownloadIcon,
  FolderIcon,
  HelpCircleIcon,
  HistoryIcon,
  InfoCircleIcon,
  LayersIcon,
  MapPinIcon,
} from "./icons";
import { AppTab } from "./TopNav";

const PAGE_NAV: { id: AppTab; icon: typeof MapPinIcon; label: string }[] = [
  { id: "dashboard", icon: ChartLineIcon, label: "Dashboard" },
  { id: "map",       icon: MapPinIcon,    label: "Map View" },
  { id: "ai",        icon: LayersIcon,    label: "AI Overview" },
  { id: "reports",   icon: DownloadIcon,  label: "Reports" },
  { id: "archives",  icon: FolderIcon,    label: "Archives" },
];

const LEGEND_ITEMS = [
  { color: "#a855f7", label: "Erosion Outlines" },
  { color: "#0ea5e9", label: "Water Chemistry" },
  { color: "#2563eb", label: "Vegetation Index" },
];

const SECTORS = [
  { id: "SEC-B4", name: "Sector B-4 Upper Stream",  subtitle: "Live water sensor station",          status: "STABLE",   statusColor: "bg-green-600 text-white", lat: 52.875, lng: -118.080, zoom: 15 },
  { id: "SEC-E1", name: "Slope Sector SEC-E1",       subtitle: "High soil erosion risk area",         status: "HIGH",     statusColor: "bg-red-600 text-white",   lat: 52.858, lng: -118.092, zoom: 15 },
  { id: "SEC-W2", name: "Athabasca Run SEC-W2",      subtitle: "River flow warning — active",         status: "CRITICAL", statusColor: "bg-red-600 text-white",    lat: 52.875, lng: -118.060, zoom: 15 },
  { id: "SEC-V9", name: "Forest Segment SEC-V9",     subtitle: "Forest regrowth monitoring zone",     status: "ELEVATED", statusColor: "bg-amber-600 text-white", lat: 52.882, lng: -118.065, zoom: 15 },
];

type ExpandedPanel = "legend" | "sectors" | null;

interface Props {
  activeTab: AppTab;
  onNavigate: (tab: AppTab) => void;
  onFocusSector: (lat: number, lng: number, zoom: number) => void;
  onOpenLogs: () => void;
  onOpenSupport: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export function Sidebar({ activeTab, onNavigate, onFocusSector, onOpenLogs, onOpenSupport, mobileOpen, onCloseMobile }: Props) {
  const [expandedPanel, setExpandedPanel] = useState<ExpandedPanel>(null);

  // Tool buttons — these are map utilities, not page navigation.
  // Page navigation is handled exclusively by the top nav tabs.
  const toolItems = [
    {
      icon: MapPinIcon, label: "Live Sensors",
      isActive: expandedPanel === "sectors",
      onClick: () => {
        // Switches to the map tab and opens the sector selector panel
        onNavigate("map");
        setExpandedPanel((p) => (p === "sectors" ? null : "sectors"));
      },
    },
    {
      icon: InfoCircleIcon, label: "Legend Panel",
      isActive: expandedPanel === "legend",
      onClick: () => setExpandedPanel((p) => (p === "legend" ? null : "legend")),
    },
  ];

  return (
    <>
      {/* Mobile backdrop — clicking outside closes the drawer */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-[1050] bg-black/50 md:hidden"
          onClick={onCloseMobile}
        />
      )}
      <aside className={`
        fixed inset-y-0 left-0 z-[1100] w-64 shrink-0 flex flex-col
        bg-surface border-r border-gray-200/60 dark:border-gray-800/60
        px-4 py-5 overflow-y-auto
        transition-transform duration-300
        ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
        md:relative md:translate-x-0 md:z-auto
      `}>
      <div className="flex items-center gap-2 px-2 mb-0.5">
        <MapPinIcon className="w-5 h-5 text-cyan-500" />
        <h2 className="text-base font-bold text-cyan-500">Jasper Watch</h2>
      </div>
      <p className="px-2 mb-4 text-[10px] font-semibold tracking-widest text-gray-500 dark:text-gray-500 uppercase">
        JASPER VALLEY AREA
      </p>

      {/* Page navigation — only visible on mobile/small screens (md+ uses TopNav tabs) */}
      <div className="md:hidden mb-4">
        <p className="px-2 mb-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">Pages</p>
        <nav className="flex flex-col gap-1">
          {PAGE_NAV.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-left transition-colors ${
                activeTab === id
                  ? "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-l-2 border-cyan-500"
                  : "text-gray-600 dark:text-gray-300 hover:bg-surface-alt border-l-2 border-transparent"
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </button>
          ))}
        </nav>
      </div>

      {/* Map tools — only two items, no duplicate page links */}
      <nav className="flex flex-col gap-1">
        {toolItems.map(({ icon: Icon, label, isActive, onClick }) => (
          <button
            key={label}
            onClick={onClick}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-left transition-colors ${
              isActive
                ? "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-l-2 border-cyan-500"
                : "text-gray-600 dark:text-gray-300 hover:bg-surface-alt border-l-2 border-transparent"
            }`}
          >
            <Icon className="w-4 h-4 shrink-0" />
            {label}
          </button>
        ))}
      </nav>

      {expandedPanel === "legend" && (
        <div className="mt-2 mx-1 p-3 rounded-lg bg-surface-alt space-y-2">
          {LEGEND_ITEMS.map(({ color, label }) => (
            <div key={label} className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
              {label}
            </div>
          ))}
        </div>
      )}

      {expandedPanel === "sectors" && (
        <div className="mt-2 mx-1 flex flex-col gap-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 px-1">
            Monitoring Areas
          </p>
          {SECTORS.map((sector) => (
            <div key={sector.id} className="p-3 rounded-lg bg-surface-alt">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-gray-700 text-gray-200">
                  {sector.id}
                </span>
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${sector.statusColor}`}>
                  {sector.status}
                </span>
              </div>
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 leading-tight">{sector.name}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{sector.subtitle}</p>
              <button
                onClick={() => onFocusSector(sector.lat, sector.lng, sector.zoom)}
                className="flex items-center gap-1 text-xs font-semibold text-blue-500 hover:text-blue-400 transition-colors"
              >
                <ArrowUpRightIcon className="w-3.5 h-3.5" />
                Focus Map
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-auto flex flex-col gap-3 pt-4">
        <button className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors">
          <DownloadIcon className="w-4 h-4" />
          Download Map Data
        </button>
        <button
          onClick={onOpenSupport}
          className="flex items-center gap-2 px-2 py-1 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
        >
          <HelpCircleIcon className="w-3.5 h-3.5" />
          Support Request
        </button>
        <button
          onClick={onOpenLogs}
          className="flex items-center gap-2 px-2 py-1 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
        >
          <HistoryIcon className="w-3.5 h-3.5" />
          Diagnostic Logs
        </button>
      </div>
    </aside>
    </>
  );
}
