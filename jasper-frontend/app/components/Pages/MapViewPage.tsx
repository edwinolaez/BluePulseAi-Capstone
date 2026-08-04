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
 * Sensor placement:
 *   - "Add Sensor" button (top-right, 2D mode only, disabled at 3 sensors)
 *   - Click map → terrain fetch → PlaceSensorModal → pin saved to local state + Convex
 *   - Placed sensors auto-sync to 3D view as columns + dots
 */

"use client";

import { useState, useCallback, useEffect, useContext, useRef } from "react";
import dynamic from "next/dynamic";
import { useMutation } from "convex/react";
import { anyApi } from "convex/server";
import type { FlyToTarget } from "../Map/JasperMap";
import type { SimulationResults } from "../../../lib/api";
import type { PlacedSensor } from "../../../lib/terrainLookup";
import { lookupTerrain } from "../../../lib/terrainLookup";
import { PlaceSensorModal } from "../Map/PlaceSensorModal";
import { ContaminantScenarioPanel } from "../Map/ContaminantScenarioPanel";
import { ForestGrowthPanel } from "../Map/ForestGrowthPanel";
import { SoilErosionPanel } from "../Map/SoilErosionPanel";
import { FloodElevationPanel } from "../Map/FloodElevationPanel";
import { ConvexAvailableContext, ConvexErrorBoundary } from "../Providers/ConvexClientProvider";

// Both map components are loaded dynamically with ssr:false — Leaflet and deck.gl
// both use browser/WebGL APIs that don't exist on the server.
const JasperMap = dynamic(() => import("../Map/JasperMap"), { ssr: false });

const ThreeDView = dynamic(
  () => import("../Map/ThreeDView").then((m) => ({ default: m.ThreeDView })),
  { ssr: false }
);

// ── Convex persistence inner component ───────────────────────────────────────
// Only rendered when ConvexProvider is in the tree.
// Exposes mutation functions to the parent via mutable refs so no state lifting
// is needed — the parent calls the ref functions directly from event handlers.

interface ConvexRefs {
  addRef:    React.MutableRefObject<((data: Omit<PlacedSensor, "localId" | "convexId">) => Promise<string>) | null>;
  removeRef: React.MutableRefObject<((id: string) => Promise<void>) | null>;
}

function SensorConvexActions({ addRef, removeRef }: ConvexRefs) {
  const add    = useMutation(anyApi.userSimulations.addSimulation);
  const remove = useMutation(anyApi.userSimulations.removeSimulation);

  // Set refs on every render so the parent always holds the latest closure
  addRef.current    = (data) => add(data) as Promise<string>;
  removeRef.current = (id)   => remove({ id }) as Promise<void>;

  return null;
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  flyTo?:             FlyToTarget | null;
  is3D:               boolean;
  showErosion:        boolean;
  showContaminant:    boolean;
  showBurnScar:       boolean;
  showElevation:      boolean;
  simulationResults?: SimulationResults | null;
  sectorId:           string | null;
  onSectorClick:      (id: string | null) => void;
  dateFrom:           string;
  dateTo:             string;
  centerDate:         string;
  slopeDeg:               number;
  onSlopeDegChange:       (v: number) => void;
  rainfallMm:             number;
  onRainfallMmChange:     (v: number) => void;
  contaminationLevel:     number;
  onContaminationLevelChange: (v: number) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function MapViewPage({
  flyTo, is3D, showErosion, showContaminant, showBurnScar, showElevation,
  simulationResults, sectorId, onSectorClick, dateFrom, dateTo, centerDate,
  slopeDeg, onSlopeDegChange, rainfallMm, onRainfallMmChange,
  contaminationLevel, onContaminationLevelChange,
}: Props) {
  const [zoomIn,  setZoomIn]  = useState<(() => void) | null>(null);
  const [zoomOut, setZoomOut] = useState<(() => void) | null>(null);

  const [projectionHours,    setProjectionHours]    = useState(24);
  const [yearsSinceFire,     setYearsSinceFire]     = useState(2);
  const [precipMmYr,         setPrecipMmYr]         = useState(450);
  const [waterLevelM,        setWaterLevelM]        = useState(1.5);
  const [stormDurationHr,    setStormDurationHr]    = useState(24);

  // ── Sensor placement state ───────────────────────────────────────────────
  const [placedSensors,  setPlacedSensors]  = useState<PlacedSensor[]>([]);
  const [placementMode,  setPlacementMode]  = useState(false);
  const [loadingTerrain, setLoadingTerrain] = useState(false);
  const [pendingModal,   setPendingModal]   = useState<{
    lat: number; lon: number; elevationM: number; slopeDeg: number;
  } | null>(null);

  // Convex mutation refs — populated by SensorConvexActions when Convex is ready
  const convexAddRef    = useRef<((data: Omit<PlacedSensor, "localId" | "convexId">) => Promise<string>) | null>(null);
  const convexRemoveRef = useRef<((id: string) => Promise<void>) | null>(null);

  const isConvexReady = useContext(ConvexAvailableContext);

  const handleMapInit = useCallback((zi: () => void, zo: () => void) => {
    setZoomIn(() => zi);
    setZoomOut(() => zo);
  }, []);

  // Keyboard zoom — + zooms in, - zooms out (2D only)
  useEffect(() => {
    if (is3D) return;
    const onKey = (e: KeyboardEvent) => {
      const tgt = e.target as HTMLElement;
      if (tgt.tagName === "INPUT" || tgt.tagName === "TEXTAREA" ||
          tgt.tagName === "SELECT" || tgt.isContentEditable) return;
      if (e.key === "=" || e.key === "+") zoomIn?.();
      if (e.key === "-")                  zoomOut?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [is3D, zoomIn, zoomOut]);

  // ── Sensor placement handlers ────────────────────────────────────────────

  const handleAddSensorClick = () => {
    setPlacementMode(true);
  };

  // Called by JasperMap when user clicks the map in placement mode
  const handlePlaceSensor = useCallback(async (lat: number, lon: number) => {
    setPlacementMode(false);
    setLoadingTerrain(true);
    try {
      const terrain = await lookupTerrain(lat, lon);
      setPendingModal({ lat, lon, ...terrain });
    } catch {
      // Terrain fetch failed completely — use elevation 0 and slope 0 as safe fallback
      setPendingModal({ lat, lon, elevationM: 0, slopeDeg: 0 });
    } finally {
      setLoadingTerrain(false);
    }
  }, []);

  const handleModalConfirm = useCallback(
    async (sensorData: Omit<PlacedSensor, "localId" | "convexId">) => {
      const localId   = crypto.randomUUID();
      const newSensor: PlacedSensor = { ...sensorData, localId };
      setPlacedSensors((prev) => [...prev, newSensor]);
      setPendingModal(null);

      // Persist to Convex in background — update localId→convexId mapping on success
      if (convexAddRef.current) {
        try {
          const convexId = await convexAddRef.current(sensorData);
          setPlacedSensors((prev) =>
            prev.map((s) => s.localId === localId ? { ...s, convexId } : s)
          );
        } catch {
          // Convex unavailable — sensor stays in local state only
        }
      }
    },
    []
  );

  const handleRemoveSensor = useCallback(async (localId: string) => {
    const sensor = placedSensors.find((s) => s.localId === localId);
    setPlacedSensors((prev) => prev.filter((s) => s.localId !== localId));
    if (sensor?.convexId && convexRemoveRef.current) {
      try { await convexRemoveRef.current(sensor.convexId); } catch { /* ignore */ }
    }
  }, [placedSensors]);

  const handleModalCancel = useCallback(() => {
    setPendingModal(null);
  }, []);

  const MAX_SENSORS = 3;

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
            slopeDeg={slopeDeg}
            rainfallMm={rainfallMm}
            waterLevelM={waterLevelM}
            yearsSinceFire={yearsSinceFire}
            precipMmYr={precipMmYr}
            placedSensors={placedSensors}
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
            placementMode={placementMode}
            onPlaceSensor={handlePlaceSensor}
            placedSensors={placedSensors}
            onRemoveSensor={handleRemoveSensor}
          />
        )}

        {/* Digital twin panels */}
        {showContaminant && (
          <ContaminantScenarioPanel
            contaminationLevel={contaminationLevel}
            onContaminationLevelChange={onContaminationLevelChange}
            projectionHours={projectionHours}
            onProjectionHoursChange={setProjectionHours}
          />
        )}
        {showBurnScar && (
          <ForestGrowthPanel
            yearsSinceFire={yearsSinceFire}
            onYearsSinceFireChange={setYearsSinceFire}
            precipMmYr={precipMmYr}
            onPrecipMmYrChange={setPrecipMmYr}
          />
        )}
        {showErosion && (
          <SoilErosionPanel
            slopeDeg={slopeDeg}
            onSlopeDegChange={onSlopeDegChange}
            rainfallMm={rainfallMm}
            onRainfallMmChange={onRainfallMmChange}
          />
        )}
        {showElevation && (
          <FloodElevationPanel
            waterLevelM={waterLevelM}
            onWaterLevelMChange={setWaterLevelM}
            stormDurationHr={stormDurationHr}
            onStormDurationHrChange={setStormDurationHr}
          />
        )}
      </div>

      {/* Keyboard shortcut hint — bottom-left */}
      <div className="absolute bottom-4 left-4 z-[1001] hidden md:block pointer-events-none">
        <div className="bg-black/40 backdrop-blur-sm text-white/60 text-[10px] px-2 py-1 rounded-full font-mono">
          Press <span className="text-white/90 font-semibold">?</span> for shortcuts
        </div>
      </div>

      {/* Add Sensor button — top-right, 2D mode only */}
      {!is3D && (
        <div className="absolute top-4 right-4 z-[1001] hidden md:flex flex-col items-end gap-2">
          <button
            onClick={handleAddSensorClick}
            disabled={placedSensors.length >= MAX_SENSORS || placementMode || loadingTerrain}
            title={
              placedSensors.length >= MAX_SENSORS
                ? "Max 3 sensors — remove one to add another"
                : placementMode
                ? "Click the map to drop a pin"
                : "Add a custom sensor pin"
            }
            className={[
              "flex items-center gap-2 px-3 py-2 rounded-full text-sm font-semibold shadow-lg border transition-all",
              placementMode
                ? "bg-blue-600 text-white border-blue-500 animate-pulse cursor-crosshair"
                : "bg-white dark:bg-gray-800 text-gray-800 dark:text-white border-gray-200/60 dark:border-gray-600 hover:bg-blue-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed",
            ].join(" ")}
          >
            {loadingTerrain ? (
              <>
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round"/>
                </svg>
                Fetching terrain…
              </>
            ) : placementMode ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                  <circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>
                </svg>
                Click map to drop pin
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
                  <circle cx="12" cy="9" r="2.5"/>
                  <line x1="12" y1="5" x2="12" y2="3" strokeWidth={2}/>
                </svg>
                Add Sensor
                {placedSensors.length > 0 && (
                  <span className="ml-0.5 text-[10px] bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-full px-1.5 py-0.5 font-bold">
                    {placedSensors.length}/{MAX_SENSORS}
                  </span>
                )}
              </>
            )}
          </button>

          {placementMode && (
            <button
              onClick={() => setPlacementMode(false)}
              className="text-[11px] text-white/80 hover:text-white bg-black/40 backdrop-blur-sm px-2 py-1 rounded-full transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      )}

      {/* Zoom buttons — bottom-right, 2D only */}
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

      {/* Sensor placement modal */}
      {pendingModal && (
        <PlaceSensorModal
          pending={pendingModal}
          yearsSinceFire={yearsSinceFire}
          precipMmYr={precipMmYr}
          rainfallMm={rainfallMm}
          contaminationLevel={contaminationLevel}
          onConfirm={handleModalConfirm}
          onCancel={handleModalCancel}
        />
      )}

      {/* Convex persistence — only mounts when ConvexProvider is in the tree */}
      {isConvexReady && (
        <ConvexErrorBoundary>
          <SensorConvexActions addRef={convexAddRef} removeRef={convexRemoveRef} />
        </ConvexErrorBoundary>
      )}
    </div>
  );
}
