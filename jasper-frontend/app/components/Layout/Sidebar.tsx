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
import { ToggleSwitch } from "../Controls/ToggleSwitch";

const PAGE_NAV: { id: AppTab; icon: typeof MapPinIcon; label: string }[] = [
  { id: "dashboard", icon: ChartLineIcon, label: "Dashboard" },
  { id: "map",       icon: MapPinIcon,    label: "Map View" },
  { id: "ai",        icon: LayersIcon,    label: "AI Overview" },
  { id: "reports",   icon: DownloadIcon,  label: "Reports" },
  { id: "archives",  icon: FolderIcon,    label: "Archives" },
];

const RISK_COLORS = [
  { color: "#ef4444", label: "High" },
  { color: "#f59e0b", label: "Med" },
  { color: "#22c55e", label: "Low" },
];

const LAYER_LEGEND = [
  { color: "#6D2077", label: "Soil Erosion"    },
  { color: "#00A3E0", label: "Water Quality"   },
  { color: "#005EB8", label: "Forest Regrowth" },
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
  is3D: boolean;
  onToggle3D: (v: boolean) => void;
  showErosion: boolean;
  onToggleErosion: (v: boolean) => void;
  showContaminant: boolean;
  onToggleContaminant: (v: boolean) => void;
  showBurnScar: boolean;
  onToggleBurnScar: (v: boolean) => void;
}

export function Sidebar({ activeTab, onNavigate, onFocusSector, onOpenLogs, onOpenSupport, mobileOpen, onCloseMobile, is3D, onToggle3D, showErosion, onToggleErosion, showContaminant, onToggleContaminant, showBurnScar, onToggleBurnScar }: Props) {
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
        <MapPinIcon className="w-5 h-5 text-sait-sky" />
        <h2 className="text-base font-bold text-sait-sky">Jasper Watch</h2>
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
                  ? "bg-sait-red/10 text-sait-red border-l-2 border-sait-red"
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
                ? "bg-sait-red/10 text-sait-red border-l-2 border-sait-red"
                : "text-gray-600 dark:text-gray-300 hover:bg-surface-alt border-l-2 border-transparent"
            }`}
          >
            <Icon className="w-4 h-4 shrink-0" />
            {label}
          </button>
        ))}
      </nav>

      {/* 2D / 3D toggle + layer switches — only shown on the Map tab */}
      {activeTab === "map" && (
        <div className="mt-3 space-y-3">
          {/* View mode pill */}
          <div className="flex items-center gap-1 p-0.5 rounded-lg bg-gray-100 dark:bg-gray-800">
            <button
              onClick={() => onToggle3D(false)}
              className={[
                "flex-1 text-xs font-semibold py-1.5 rounded-md transition-all",
                !is3D
                  ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300",
              ].join(" ")}
            >
              2D Map
            </button>
            <button
              onClick={() => onToggle3D(true)}
              className={[
                "flex-1 text-xs font-semibold py-1.5 rounded-md transition-all",
                is3D
                  ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300",
              ].join(" ")}
            >
              3D Risk
            </button>
          </div>
          {/* Layer toggles */}
          <div className="px-1 space-y-2">
            <ToggleSwitch
              label="Soil Erosion Risk"
              dotColor="#6D2077"
              iconPath="m8 3 4 8 5-5 5 15H2L8 3z"
              checked={showErosion}
              onChange={onToggleErosion}
            />
            <ToggleSwitch
              label="River Water Quality"
              dotColor="#00A3E0"
              iconPath="M9 20l-5.447-2.724A1 1 0 0 1 3 16.382V5.618a1 1 0 0 1 1.447-.894L9 7m0 13l6-3m-6-13l6 3m0 13l5.447 2.724A1 1 0 0 0 21 18.382V7.618a1 1 0 0 0-1.447-.894L15 9m0 11V9m0 0L9 7"
              checked={showContaminant}
              onChange={onToggleContaminant}
            />
            <ToggleSwitch
              label="Forest Regrowth Status"
              dotColor="#005EB8"
              iconPath="M8.5 14.5A2.5 2.5 0 0 0 11 17a2.5 2.5 0 0 0 2.5-2.5c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2 1Z"
              checked={showBurnScar}
              onChange={onToggleBurnScar}
            />
          </div>
        </div>
      )}

      {expandedPanel === "legend" && (
        <div className="mt-2 mx-1 p-3 rounded-lg bg-surface-alt space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">
            Sensors &amp; Risk
          </p>
          {/* Each row: sensor colour circle + name + High/Med/Low risk squares */}
          {LAYER_LEGEND.map(({ color, label }) => (
            <div key={label} className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0 border border-white/60 dark:border-gray-700"
                style={{ background: color }}
              />
              <span className="text-xs text-gray-600 dark:text-gray-300 flex-1 leading-none">{label}</span>
              <div className="flex items-center gap-1">
                {RISK_COLORS.map(({ color: rc, label: rl }) => (
                  <span
                    key={rl}
                    title={rl === "High" ? "High Risk" : rl === "Med" ? "Medium Risk" : "Low Risk"}
                    className="w-2 h-2 rounded-sm shrink-0"
                    style={{ background: rc }}
                  />
                ))}
              </div>
            </div>
          ))}
          <div className="pt-2 border-t border-gray-200/60 dark:border-gray-700/40 space-y-0.5">
            <p className="text-[10px] text-gray-400 dark:text-gray-500">Column height = risk score</p>
            <p className="text-[10px] text-gray-400 dark:text-gray-500">Terrain = real Rocky Mtn elevation</p>
          </div>
          {/* Data provenance per layer */}
          <div className="pt-2 border-t border-gray-200/60 dark:border-gray-700/40 space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Data Provenance</p>
            {[
              { color: "#6D2077", layer: "Soil Erosion",    source: "USGS SRTM + Env. Canada", quality: "Good", refresh: "Jul 18, 2026" },
              { color: "#00A3E0", layer: "Water Quality",   source: "WSC Station 07AA001",      quality: "Good", refresh: "Jul 20, 2026" },
              { color: "#005EB8", layer: "Forest Regrowth", source: "Sentinel-2 B4/B8A/B12",    quality: "Good", refresh: "Jul 18, 2026" },
            ].map(({ color, layer, source, quality, refresh }) => (
              <div key={layer} className="rounded-md bg-gray-50 dark:bg-gray-800/50 p-2 space-y-0.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                  <span className="text-[10px] font-semibold text-gray-600 dark:text-gray-300">{layer}</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-gray-400">Source</span>
                  <span className="text-gray-500 dark:text-gray-400 text-right">{source}</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-gray-400">Refreshed</span>
                  <span className="text-gray-500 dark:text-gray-400">{refresh}</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-gray-400">Quality</span>
                  <span className="text-green-600 dark:text-green-400 font-semibold">✓ {quality}</span>
                </div>
              </div>
            ))}
          </div>
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
                className="flex items-center gap-1 text-xs font-semibold text-sait-sky hover:text-sait-blue transition-colors"
              >
                <ArrowUpRightIcon className="w-3.5 h-3.5" />
                Focus Map
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-auto flex flex-col gap-3 pt-4">
        <button
          onClick={() => {
            const rows = [
              ["Sector", "Lat", "Lon", "Water Cloudiness (NTU)", "pH", "Ash Levels (ppm)", "Ground Stability (%)"],
              ["ATH-001-A", "52.87", "-118.08", "4.2", "7.12", "18.4", "94.2"],
              ["ATH-001-H", "52.91", "-118.14", "5.8", "6.98", "22.1", "87.5"],
              ["ATH-001-W", "52.83", "-118.02", "3.1", "7.34", "11.9", "96.8"],
            ];
            const csv = rows.map((r) => r.join(",")).join("\n");
            const blob = new Blob([csv], { type: "text/csv" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "jasper-map-data.csv";
            a.click();
            URL.revokeObjectURL(url);
          }}
          className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-sait-red hover:bg-sait-red-deep text-white text-sm font-semibold transition-colors"
        >
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
