/**
 * MapViewPage.tsx — Main interactive map view page.
 *
 * Hosts either the 2D Leaflet map (JasperMap) or the 3D deck.gl view (ThreeDView)
 * depending on the is3D prop.  Both map components are loaded with dynamic() /
 * ssr:false because Leaflet and WebGL require browser APIs not available on the server.
 *
 * Layout:
 *   - Left: the Jasper Watch sidebar (rendered by page.tsx) with all collapsible panels
 *   - Right/main: the full-screen map with digital twin overlays and zoom buttons
 *
 * Sector selection, date range, and interpolation state are owned by page.tsx so the
 * Sidebar and this component can share them without prop-drilling through extra layers.
 */

"use client";

import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import type { FlyToTarget } from "../Map/JasperMap";
import type { SimulationResults } from "../../../lib/api";
import { ContaminantScenarioPanel } from "../Map/ContaminantScenarioPanel";
import { ForestGrowthPanel } from "../Map/ForestGrowthPanel";
import { SoilErosionPanel } from "../Map/SoilErosionPanel";
import { FloodElevationPanel } from "../Map/FloodElevationPanel";

// Both map components are loaded dynamically with ssr:false — Leaflet and deck.gl
// both use browser/WebGL APIs that don't exist on the server.
const JasperMap = dynamic(() => import("../Map/JasperMap"), { ssr: false });

const ThreeDView = dynamic(
  () => import("../Map/ThreeDView").then((m) => ({ default: m.ThreeDView })),
  { ssr: false }
);

interface Props {
  flyTo?:             FlyToTarget | null;
  is3D:               boolean;
  showErosion:        boolean;
  showContaminant:    boolean;
  showBurnScar:       boolean;
  showElevation:      boolean;
  simulationResults?: SimulationResults | null;
  /** Lifted to page.tsx so the Sidebar's Sector Details panel can read it */
  sectorId:           string | null;
  onSectorClick:      (id: string | null) => void;
  dateFrom:           string;
  dateTo:             string;
  centerDate:         string;
  /** Lifted to page.tsx so AI Overview stays in sync with map sliders */
  slopeDeg:               number;
  onSlopeDegChange:       (v: number) => void;
  rainfallMm:             number;
  onRainfallMmChange:     (v: number) => void;
  contaminationLevel:     number;
  onContaminationLevelChange: (v: number) => void;
}

export function MapViewPage({ flyTo, is3D, showErosion, showContaminant, showBurnScar, showElevation, simulationResults, sectorId, onSectorClick, dateFrom, dateTo, centerDate, slopeDeg, onSlopeDegChange, rainfallMm, onRainfallMmChange, contaminationLevel, onContaminationLevelChange }: Props) {
  const [zoomIn,  setZoomIn]  = useState<(() => void) | null>(null);
  const [zoomOut, setZoomOut] = useState<(() => void) | null>(null);

  // contaminationLevel, slopeDeg, rainfallMm are lifted to page.tsx — received as props
  const [projectionHours,    setProjectionHours]    = useState(24);

  // Forest growth digital twin state — drives BurnScarLayer marker colour
  const [yearsSinceFire, setYearsSinceFire] = useState(2);
  const [precipMmYr,     setPrecipMmYr]     = useState(450);

  // Flood elevation digital twin state
  const [waterLevelM,     setWaterLevelM]     = useState(1.5);
  const [stormDurationHr, setStormDurationHr] = useState(24);

  const handleMapInit = useCallback((zi: () => void, zo: () => void) => {
    setZoomIn(() => zi);
    setZoomOut(() => zo);
  }, []);

  return (
    <div className="relative flex-1 overflow-hidden">
      <div className="absolute inset-0">
        {/* Toggle between 2D Leaflet and 3D deck.gl view */}
        {is3D ? (
          <ThreeDView
            centerDate={centerDate}
            activeSectorId={sectorId}
            onSectorClick={onSectorClick}
            showErosion={showErosion}
            showContaminant={showContaminant}
            showBurnScar={showBurnScar}
            showElevation={showElevation}
            simulationResults={simulationResults ?? null}
            contaminationLevel={contaminationLevel}
            projectionHours={projectionHours}
          />
        ) : (
          <JasperMap
            onSectorClick={onSectorClick}
            activeSectorId={sectorId}
            dateFrom={dateFrom}
            dateTo={dateTo}
            showBurnScar={showBurnScar}
            showErosion={showErosion}
            showContaminant={showContaminant}
            showElevation={showElevation}
            onMapInit={handleMapInit}
            flyTo={flyTo}
            contaminationLevel={contaminationLevel}
            projectionHours={projectionHours}
            yearsSinceFire={yearsSinceFire}
            precipMmYr={precipMmYr}
            slopeDeg={slopeDeg}
            rainfallMm={rainfallMm}
            waterLevelM={waterLevelM}
          />
        )}

        {/* Digital twin scenario panel — visible when contaminant layer is on */}
        {showContaminant && (
          <ContaminantScenarioPanel
            contaminationLevel={contaminationLevel}
            onContaminationLevelChange={onContaminationLevelChange}
            projectionHours={projectionHours}
            onProjectionHoursChange={setProjectionHours}
          />
        )}

        {/* Forest growth digital twin panel — visible when burn scar layer is on */}
        {showBurnScar && (
          <ForestGrowthPanel
            yearsSinceFire={yearsSinceFire}
            onYearsSinceFireChange={setYearsSinceFire}
            precipMmYr={precipMmYr}
            onPrecipMmYrChange={setPrecipMmYr}
          />
        )}

        {/* Soil erosion digital twin panel — visible when erosion layer is on */}
        {showErosion && (
          <SoilErosionPanel
            slopeDeg={slopeDeg}
            onSlopeDegChange={onSlopeDegChange}
            rainfallMm={rainfallMm}
            onRainfallMmChange={onRainfallMmChange}
          />
        )}

        {/* Flood elevation digital twin panel — visible when elevation layer is on */}
        {showElevation && (
          <FloodElevationPanel
            waterLevelM={waterLevelM}
            onWaterLevelMChange={setWaterLevelM}
            stormDurationHr={stormDurationHr}
            onStormDurationHrChange={setStormDurationHr}
          />
        )}
      </div>

      {/* Zoom buttons — desktop only, 2D mode only (3D uses deck.gl orbit controls) */}
      <div className={["absolute bottom-4 right-4 z-[1001] hidden md:flex flex-col gap-2", is3D ? "invisible" : ""].join(" ")}>
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
  );
}
