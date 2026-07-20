// MapViewPage is the main interactive map screen.
// It renders the Leaflet map with all three environmental layers on top,
// plus layer toggle switches, zoom buttons, a time slider,
// and a Live Readings panel on the right that shows real-time sensor data.

"use client";

import { useState, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import { TemporalSlider } from "../Controls/TemporalSlider";
import { SectorPanel } from "../Controls/SectorPanel";
import { ToggleSwitch } from "../Controls/ToggleSwitch";
import { ChartLineIcon } from "../Layout/icons";
import { WaterQualityWidget } from "../Widgets/WaterQualityWidget";
import { PipelineStatusWidget } from "../Widgets/PipelineStatusWidget";
import { ModelPerformanceWidget } from "../Widgets/ModelPerformanceWidget";
import { FieldPhotosWidget } from "../Widgets/FieldPhotosWidget";
import type { FlyToTarget, SensorInfo } from "../Map/JasperMap";

// The map is loaded dynamically with ssr:false because Leaflet uses browser APIs
// that don't exist on the server — this tells Next.js to only load it in the browser.
const JasperMap = dynamic(() => import("../Map/JasperMap"), {
  ssr: false,
});

interface Props {
  flyTo?: FlyToTarget | null;
  mapFullscreen?: boolean;
  onSetFullscreen?: (v: boolean) => void;
}

export function MapViewPage({ flyTo, mapFullscreen = false, onSetFullscreen }: Props) {
  // Tracks which specific sensor was clicked — populates the Selected Area panel
  const [sensorInfo, setSensorInfo] = useState<SensorInfo | null>(null);

  // Date range controlled by the temporal slider at the bottom of the map
  const [dateFrom, setDateFrom]               = useState("2024-06-01");
  const [dateTo, setDateTo]                   = useState("2024-07-24");

  // These booleans control which layers are visible on the map
  const [showBurnScar, setShowBurnScar]       = useState(true);
  const [showErosion, setShowErosion]         = useState(true);
  const [showContaminant, setShowContaminant] = useState(true);

  // These hold the zoom and resize functions passed up from the map component
  const [zoomIn, setZoomIn]               = useState<(() => void) | null>(null);
  const [zoomOut, setZoomOut]             = useState<(() => void) | null>(null);
  const [invalidateSize, setInvalidateSize] = useState<(() => void) | null>(null);

  // Controls whether the Live Readings drawer is open on mobile
  const [panelOpen, setPanelOpen] = useState(false);

  // Called by JasperMap once it's ready — captures zoom + resize controls
  const handleMapInit = useCallback((zi: () => void, zo: () => void, inv: () => void) => {
    setZoomIn(() => zi);
    setZoomOut(() => zo);
    setInvalidateSize(() => inv);
  }, []);

  // After the CSS panel transition finishes, tell Leaflet to re-measure its
  // container so it fills the newly revealed space without leaving a blank gap.
  useEffect(() => {
    if (!invalidateSize) return;
    const timer = setTimeout(() => invalidateSize(), 320);
    return () => clearTimeout(timer);
  }, [mapFullscreen, invalidateSize]);

  return (
    <div className="flex-1 flex min-h-0 relative">

      {/* ── Map area — takes up all available space ── */}
      <div className="relative flex-1 overflow-hidden">
        <div className="absolute inset-0">
          {/* The Leaflet map — passes layer visibility and date range as props */}
          <JasperMap
            onSensorSelect={(info) => setSensorInfo(info)}
            showBurnScar={showBurnScar}
            showErosion={showErosion}
            showContaminant={showContaminant}
            onMapInit={handleMapInit}
            flyTo={flyTo}
            onMapClick={onSetFullscreen ? () => onSetFullscreen(!mapFullscreen) : undefined}
            onMarkerClick={onSetFullscreen ? () => onSetFullscreen(false) : undefined}
          />
        </div>

        {/* Fullscreen toggle button — always visible, collapses or restores both side panels */}
        {onSetFullscreen && (
          <button
            onClick={() => onSetFullscreen(!mapFullscreen)}
            title={mapFullscreen ? "Show panels" : "Expand map"}
            className="absolute top-4 right-16 z-[1001] w-8 h-8 flex items-center justify-center rounded-full bg-white/90 dark:bg-gray-800/90 text-gray-700 dark:text-gray-100 shadow-lg border border-gray-200/60 dark:border-gray-600 hover:bg-white dark:hover:bg-gray-700 transition-colors backdrop-blur-sm"
          >
            {mapFullscreen ? (
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 4.5V1h3.5M8.5 1H12v3.5M12 8.5V12H8.5M4.5 12H1V8.5" />
              </svg>
            ) : (
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4.5 1H1v3.5M12 4.5V1H8.5M8.5 12H12V8.5M1 8.5V12h3.5" />
              </svg>
            )}
          </button>
        )}

        {/* Bottom bar: mobile Live button + zoom buttons */}
        <div className="absolute bottom-4 left-4 right-4 z-[1001] flex items-end justify-between gap-3">

          {/* Live button — mobile only to open the side panel */}
          <button
            onClick={() => setPanelOpen(true)}
            className="md:hidden flex items-center gap-1.5 px-3 py-2 rounded-full bg-cyan-500 text-white text-xs font-semibold shadow-lg active:scale-95 transition-transform shrink-0"
          >
            <ChartLineIcon className="w-3.5 h-3.5" />
            Live
          </button>

          {/* Zoom buttons */}
          <div className="flex flex-col gap-2 shrink-0 ml-auto">
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
        "bg-surface border-l border-gray-200/60 dark:border-gray-700/40 flex flex-col gap-3 overflow-y-auto transition-all duration-300",
        // desktop — collapses to zero width when map is fullscreen
        "md:static md:shrink-0 md:translate-x-0",
        mapFullscreen ? "md:w-0 md:p-0 md:overflow-hidden md:opacity-0 md:border-0" : "md:w-72 md:p-4",
        // mobile — fixed full-height drawer that slides in from the right
        "fixed right-0 top-0 bottom-0 w-72 p-4 z-[1200]",
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

        {/* Shows sensor-specific ML data when a badge is clicked, placeholder otherwise */}
        <SectorPanel sensorInfo={sensorInfo} />

        {/* Map layer toggles — moved here from the map so everything is in one place */}
        <div className="rounded-xl border border-gray-200/60 dark:border-gray-700/40 bg-surface p-3">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-3">Map Layers</p>
          <div className="space-y-2">
            <ToggleSwitch label="Soil Erosion Risk"      dotColor="#a855f7" checked={showErosion}     onChange={setShowErosion} />
            <ToggleSwitch label="River Water Quality"    dotColor="#0ea5e9" checked={showContaminant} onChange={setShowContaminant} />
            <ToggleSwitch label="Forest Regrowth Status" dotColor="#2563eb" checked={showBurnScar}    onChange={setShowBurnScar} />
          </div>
        </div>

        {/* Time History slider — moved here from the bottom of the map */}
        <TemporalSlider
          onDateRangeChange={(from, to) => {
            setDateFrom(from);
            setDateTo(to);
          }}
        />

        {/* Live Readings section label */}
        <div className="flex items-center gap-2 px-0.5 mt-1">
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
