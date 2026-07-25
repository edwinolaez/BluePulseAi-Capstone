// MapViewPage is the main interactive map screen.
// It renders the Leaflet map with all three environmental layers on top,
// plus layer toggle switches, zoom buttons, a time slider,
// and a Live Readings panel on the right that shows real-time sensor data.

"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { TemporalSlider } from "../Controls/TemporalSlider";
import { SectorPanel } from "../Controls/SectorPanel";
import { ChartLineIcon } from "../Layout/icons";
import { WaterQualityWidget } from "../Widgets/WaterQualityWidget";
import { PipelineStatusWidget } from "../Widgets/PipelineStatusWidget";
import { ModelPerformanceWidget } from "../Widgets/ModelPerformanceWidget";
import { FieldPhotosWidget } from "../Widgets/FieldPhotosWidget";
import type { FlyToTarget } from "../Map/JasperMap";
import { fetchTimeline } from "../../../lib/api";
import type { TimelineScan } from "../../../lib/api";
import { interpolateScans } from "../../../lib/interpolation";
import type { InterpolatedState } from "../../../lib/interpolation";

// Both map components are loaded dynamically with ssr:false — Leaflet and deck.gl
// both use browser/WebGL APIs that don't exist on the server.
const JasperMap = dynamic(() => import("../Map/JasperMap"), { ssr: false });

const ThreeDView = dynamic(
  () => import("../Map/ThreeDView").then((m) => ({ default: m.ThreeDView })),
  { ssr: false }
);

interface Props {
  flyTo?:          FlyToTarget | null;
  is3D:            boolean;
  showErosion:     boolean;
  showContaminant: boolean;
  showBurnScar:    boolean;
}

export function MapViewPage({ flyTo, is3D, showErosion, showContaminant, showBurnScar }: Props) {
  const [sectorId, setSectorId]               = useState<string | null>(null);
  const [dateFrom, setDateFrom]               = useState("2024-06-01");
  const [dateTo, setDateTo]                   = useState("2024-07-24");
  const [centerDate, setCenterDate]           = useState("2024-06-24");
  const [zoomIn, setZoomIn]   = useState<(() => void) | null>(null);
  const [zoomOut, setZoomOut] = useState<(() => void) | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  // Timeline scans fetched from Feven's backend for the selected sector
  const [timelineScans, setTimelineScans] = useState<TimelineScan[]>([]);
  // Interpolated values for the current slider position — passed to SectorPanel
  const [interpolated, setInterpolated]   = useState<InterpolatedState | null>(null);
  // Prevents stale fetches from overwriting a newer sector's data
  const fetchIdRef = useRef(0);

  // Fetch timeline scans whenever the user selects a different sector
  useEffect(() => {
    if (!sectorId) { setTimelineScans([]); setInterpolated(null); return; }
    const id = ++fetchIdRef.current;
    fetchTimeline(sectorId)
      .then(data => { if (id === fetchIdRef.current) setTimelineScans(data.scans); })
      .catch(() => { if (id === fetchIdRef.current) setTimelineScans([]); });
  }, [sectorId]);

  // Re-interpolate whenever the slider moves or new scans arrive
  useEffect(() => {
    const ms = new Date(centerDate).getTime();
    setInterpolated(interpolateScans(timelineScans, ms));
  }, [centerDate, timelineScans]);

  const handleMapInit = useCallback((zi: () => void, zo: () => void) => {
    setZoomIn(() => zi);
    setZoomOut(() => zo);
  }, []);

  return (
    <div className="flex-1 flex min-h-0 relative">

      {/* ── Map area — takes up all available space ── */}
      <div className="relative flex-1 overflow-hidden">
        <div className="absolute inset-0">
          {/* Toggle between 2D Leaflet and 3D deck.gl view */}
          {is3D ? (
            <ThreeDView
              centerDate={centerDate}
              activeSectorId={sectorId}
              onSectorClick={setSectorId}
              showErosion={showErosion}
              showContaminant={showContaminant}
              showBurnScar={showBurnScar}
            />
          ) : (
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
          )}
        </div>

        {/* Bottom bar: [mobile: live data button] + [desktop: zoom buttons] */}
        <div className="absolute bottom-4 left-4 right-4 z-[1001] flex items-end gap-3">

          {/* Live Data button — mobile only.
              On desktop the Live Readings sidebar is always visible so this is hidden. */}
          <button
            onClick={() => setPanelOpen(true)}
            className="md:hidden flex items-center gap-1.5 px-3 py-2 rounded-full bg-sait-red text-white text-xs font-semibold shadow-lg active:scale-95 transition-transform shrink-0"
          >
            <ChartLineIcon className="w-3.5 h-3.5" />
            Live
          </button>

          <div className="flex-1" />

          {/* Zoom buttons — desktop only, 2D mode only (3D uses deck.gl orbit controls). */}
          <div className={["hidden md:flex flex-col gap-2 shrink-0", is3D ? "invisible" : ""].join(" ")}>
            <button
              onClick={() => zoomIn?.()}
              title="Zoom in"
              className="w-9 h-9 flex items-center justify-center rounded-full bg-white dark:bg-gray-800 text-gray-800 dark:text-white shadow-lg hover:scale-105 hover:bg-sait-sky/10 dark:hover:bg-gray-700 transition-transform border border-gray-200/60 dark:border-gray-600"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="8" y1="2" x2="8" y2="14" />
                <line x1="2" y1="8" x2="14" y2="8" />
              </svg>
            </button>
            <button
              onClick={() => zoomOut?.()}
              title="Zoom out"
              className="w-9 h-9 flex items-center justify-center rounded-full bg-white dark:bg-gray-800 text-gray-800 dark:text-white shadow-lg hover:scale-105 hover:bg-sait-sky/10 dark:hover:bg-gray-700 transition-transform border border-gray-200/60 dark:border-gray-600"
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
            <ChartLineIcon className="w-4 h-4 text-sait-sky" />
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

        {/* Time History slider — controls the date range shown on the map and in SectorPanel */}
        <TemporalSlider
          onDateRangeChange={(from, to, center) => {
            setDateFrom(from);
            setDateTo(to);
            setCenterDate(center);
          }}
        />

        {/* Shows data for the sector the user clicked on the map.
            interpolated carries blended values from the timeline slider — null
            when no sector is selected or the backend has no scan data yet. */}
        <SectorPanel
          sectorId={sectorId}
          dateFrom={dateFrom}
          dateTo={dateTo}
          interpolated={interpolated}
        />

        {/* Desktop-only section label */}
        <div className="hidden md:flex items-center gap-2 px-0.5 mt-1">
          <ChartLineIcon className="w-4 h-4 text-sait-sky" />
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
