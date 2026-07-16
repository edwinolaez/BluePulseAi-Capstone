// MapViewPage is the main interactive map screen.
// It renders the Leaflet map with all three environmental layers on top,
// plus layer toggle switches, zoom buttons, a time slider,
// and a Live Readings panel on the right that shows real-time sensor data.

"use client";

import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { TemporalSlider } from "../Controls/TemporalSlider";
import { SectorPanel } from "../Controls/SectorPanel";
import { ToggleSwitch } from "../Controls/ToggleSwitch";
import { ChartLineIcon } from "../Layout/icons";
import { WaterQualityWidget } from "../Widgets/WaterQualityWidget";
import { PipelineStatusWidget } from "../Widgets/PipelineStatusWidget";
import { ModelPerformanceWidget } from "../Widgets/ModelPerformanceWidget";
import { FieldPhotosWidget } from "../Widgets/FieldPhotosWidget";
import type { FlyToTarget } from "../Map/JasperMap";

// The map is loaded dynamically with ssr:false because Leaflet uses browser APIs
// that don't exist on the server — this tells Next.js to only load it in the browser.
const JasperMap = dynamic(() => import("../Map/JasperMap"), {
  ssr: false,
});

interface Props {
  flyTo?: FlyToTarget | null;
}

export function MapViewPage({ flyTo }: Props) {
  // Tracks which sector the user clicked on the map (used to update the sector panel)
  const [sectorId, setSectorId]               = useState<string | null>(null);

  // Date range controlled by the temporal slider at the bottom of the map
  const [dateFrom, setDateFrom]               = useState("2024-06-01");
  const [dateTo, setDateTo]                   = useState("2024-07-24");

  // These booleans control which layers are visible on the map
  const [showBurnScar, setShowBurnScar]       = useState(true);
  const [showErosion, setShowErosion]         = useState(true);
  const [showContaminant, setShowContaminant] = useState(true);

  // These hold the zoom functions passed up from the map component
  // so the custom zoom buttons outside the map can control it
  const [zoomIn, setZoomIn]   = useState<(() => void) | null>(null);
  const [zoomOut, setZoomOut] = useState<(() => void) | null>(null);

  // Controls whether the Live Readings drawer is open on mobile
  const [panelOpen, setPanelOpen] = useState(false);

  // Called by JasperMap once it's ready — passes up its zoom functions
  const handleMapInit = useCallback((zi: () => void, zo: () => void) => {
    setZoomIn(() => zi);
    setZoomOut(() => zo);
  }, []);

  return (
    <div className="flex-1 flex min-h-0 relative">

      {/* ── Map area — takes up all available space ── */}
      <div className="relative flex-1 overflow-hidden">
        <div className="absolute inset-0">
          {/* The Leaflet map — passes layer visibility and date range as props */}
          <JasperMap
            onSectorClick={setSectorId}
            activeSectorId={sectorId}
            dateFrom={dateFrom}
            dateTo={dateTo}
            showBurnScar={showBurnScar}
            showErosion={showErosion}
            showContaminant={showContaminant}
            onMapInit={handleMapInit}
            flyTo={flyTo}
          />
        </div>

        {/* Layer toggle panel — sits in the top-right corner of the map.
            Each toggle shows/hides one of the three environmental overlays. */}
        <div className="absolute top-4 right-4 z-[1001]">
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-3 md:p-4 min-w-[180px] md:min-w-[230px] shadow-xl">
            <div className="space-y-2 md:space-y-3">
              <ToggleSwitch label="Soil Erosion Risk"      dotColor="#a855f7" checked={showErosion}     onChange={setShowErosion} />
              <ToggleSwitch label="River Water Quality"    dotColor="#0ea5e9" checked={showContaminant} onChange={setShowContaminant} />
              <ToggleSwitch label="Forest Regrowth Status" dotColor="#2563eb" checked={showBurnScar}    onChange={setShowBurnScar} />
            </div>
          </div>
        </div>

        {/* Bottom bar: [mobile: live data button] + slider + [desktop: zoom buttons] */}
        <div className="absolute bottom-4 left-4 right-4 z-[1001] flex items-end gap-3">

          {/* Live Data button — mobile only, sits to the left of the slider.
              On desktop the Live Readings sidebar is always visible so this is hidden. */}
          <button
            onClick={() => setPanelOpen(true)}
            className="md:hidden flex items-center gap-1.5 px-3 py-2 rounded-full bg-cyan-500 text-white text-xs font-semibold shadow-lg active:scale-95 transition-transform shrink-0"
          >
            <ChartLineIcon className="w-3.5 h-3.5" />
            Live
          </button>

          <div className="flex-1 min-w-0">
            <TemporalSlider
              onDateRangeChange={(from, to) => {
                setDateFrom(from);
                setDateTo(to);
              }}
            />
          </div>

          {/* Zoom buttons — desktop only. On mobile, use pinch-to-zoom instead. */}
          <div className="hidden md:flex flex-col gap-2 shrink-0">
            <button
              onClick={() => zoomIn?.()}
              title="Zoom in"
              className="w-9 h-9 flex items-center justify-center rounded-full bg-white dark:bg-gray-800 text-gray-800 dark:text-white shadow-lg hover:scale-105 hover:bg-cyan-50 dark:hover:bg-gray-700 transition-transform border border-gray-200/60 dark:border-gray-600"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="8" y1="2" x2="8" y2="14" />
                <line x1="2" y1="8" x2="14" y2="8" />
              </svg>
            </button>
            <button
              onClick={() => zoomOut?.()}
              title="Zoom out"
              className="w-9 h-9 flex items-center justify-center rounded-full bg-white dark:bg-gray-800 text-gray-800 dark:text-white shadow-lg hover:scale-105 hover:bg-cyan-50 dark:hover:bg-gray-700 transition-transform border border-gray-200/60 dark:border-gray-600"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="2" y1="8" x2="14" y2="8" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Dark backdrop behind the drawer — tapping it closes the panel on mobile */}
      {panelOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/40 z-[1100]"
          onClick={() => setPanelOpen(false)}
        />
      )}

      {/* ── Live Readings panel ──────────────────────────────────────────────
          On desktop: always-visible sidebar on the right.
          On mobile: hidden off-screen to the right, slides in when panelOpen is true. */}
      <aside className={[
        "bg-surface border-l border-gray-200/60 dark:border-gray-700/40 flex flex-col gap-3 p-4 overflow-y-auto transition-transform duration-300",
        // desktop — stays in place as a normal sidebar column
        "md:static md:w-72 md:shrink-0 md:translate-x-0",
        // mobile — fixed full-height drawer that slides in from the right
        "fixed right-0 top-0 bottom-0 w-72 z-[1200]",
        panelOpen ? "translate-x-0" : "translate-x-full md:translate-x-0",
      ].join(" ")}>

        {/* Mobile-only header row with a close button */}
        <div className="flex items-center justify-between md:hidden">
          <div className="flex items-center gap-2">
            <ChartLineIcon className="w-4 h-4 text-cyan-500" />
            <span className="text-xs font-bold uppercase tracking-widest text-gray-700 dark:text-gray-200">
              Live Readings
            </span>
          </div>
          <button
            onClick={() => setPanelOpen(false)}
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-surface-alt text-gray-500 text-sm"
          >
            ✕
          </button>
        </div>

        {/* Shows data for the sector the user clicked on the map */}
        <SectorPanel sectorId={sectorId} dateFrom={dateFrom} dateTo={dateTo} />

        {/* Desktop-only section label */}
        <div className="hidden md:flex items-center gap-2 px-0.5 mt-1">
          <ChartLineIcon className="w-4 h-4 text-cyan-500" />
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-700 dark:text-gray-200">
            Live Readings
          </h2>
        </div>

        {/* Real-time sensor widgets — each one connects to a different data source */}
        <WaterQualityWidget />
        <PipelineStatusWidget />
        <ModelPerformanceWidget />
        <FieldPhotosWidget />
      </aside>

    </div>
  );
}
