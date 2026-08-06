/**
 * PlaceSensorModal.tsx — confirmation dialog shown after a user drops a sensor on the map.
 *
 * Triggered from MapViewPage.tsx after the user clicks the map in placement mode.
 * The terrain (elevation + slope) has already been fetched via lookupTerrain() before
 * this modal opens, so it appears with real values pre-populated.
 *
 * The modal lets the user:
 *   1. Name the sensor
 *   2. Choose the sensor type (Erosion / Forest / Water / Flood)
 *   3. Adjust the coverage radius (100–2000 m) with a live slider
 *
 * As the slider moves, all four physics simulations re-compute in real time
 * (no debounce needed — these are pure synchronous functions from sensorPhysics.ts).
 * The results are shown in the "Simulation results" grid before the user confirms.
 *
 * On confirm, the sensor data + snapshot simulation results are passed to
 * MapViewPage.tsx > handleModalConfirm which:
 *   a) Adds the sensor to local React state (immediate pin appears on map)
 *   b) Persists to Convex in the background (so it survives a page refresh)
 *
 * Why physics functions are imported, not inlined:
 *   Moving the formulas to sensorPhysics.ts allows them to be unit-tested in isolation
 *   without mounting this component.  The modal simply calls the functions and displays
 *   the results — it does not own the physics logic.
 */
"use client";

import { useState } from "react";
import type { PlacedSensor } from "../../../lib/terrainLookup";
import {
  catchmentFrom,
  computeErosion,
  computeForestRecovery,
  computeFloodFlow,
  computeContaminant,
} from "../../../lib/sensorPhysics";

const SENSOR_TYPE_OPTIONS: { value: PlacedSensor["sensorType"]; label: string; color: string }[] = [
  { value: "erosion", label: "Soil Erosion",    color: "#f59e0b" },
  { value: "forest",  label: "Forest Regrowth", color: "#22c55e" },
  { value: "water",   label: "Water Quality",   color: "#00A3E0" },
  { value: "flood",   label: "Flood Monitor",   color: "#3b82f6" },
];

/**
 * DEFAULT_RADIUS — suggested coverage radius per sensor type in metres.
 *
 * These defaults are pre-filled when the user switches sensor type so the slider
 * starts at a physically meaningful value:
 *   erosion: 500 m — typical field-instrument monitoring radius for RUSLE plots
 *   forest:  800 m — forest inventory plots are typically 0.5–1 ha (radius ~400–560 m)
 *   water:   400 m — WSC stream gauges monitor a short reach upstream/downstream
 *   flood:   700 m — flood inundation mapping commonly uses 500–1000 m buffers
 */
const DEFAULT_RADIUS: Record<PlacedSensor["sensorType"], number> = {
  erosion: 500,
  forest:  800,
  water:   400,
  flood:   700,
};

// ── Sub-components ─────────────────────────────────────────────────────────────

function SimRow({
  label, value, subValue, badge, badgeColor,
}: {
  label: string; value: string; subValue?: string; badge?: string; badgeColor?: string;
}) {
  return (
    <div className="bg-gray-50 dark:bg-gray-800/60 rounded-lg px-3 py-2 text-sm">
      <div className="flex items-center justify-between">
        <span className="text-gray-500 dark:text-gray-400">{label}</span>
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-gray-900 dark:text-white">{value}</span>
          {badge && (
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 rounded"
              style={{ background: `${badgeColor}22`, color: badgeColor, border: `1px solid ${badgeColor}44` }}
            >
              {badge}
            </span>
          )}
        </div>
      </div>
      {subValue && (
        <div className="text-[11px] text-gray-400 dark:text-gray-500 text-right mt-0.5">{subValue}</div>
      )}
    </div>
  );
}

// ── Main modal ─────────────────────────────────────────────────────────────────

interface PendingSensor {
  lat: number; lon: number; elevationM: number; slopeDeg: number;
}

interface Props {
  pending:            PendingSensor;
  yearsSinceFire:     number;
  precipMmYr:         number;
  rainfallMm:         number;
  contaminationLevel: number;
  onConfirm: (sensor: Omit<PlacedSensor, "localId" | "convexId">) => void;
  onCancel:  () => void;
}

export function PlaceSensorModal({
  pending, yearsSinceFire, precipMmYr, rainfallMm, contaminationLevel,
  onConfirm, onCancel,
}: Props) {
  const [name,       setName]       = useState("");
  const [sensorType, setSensorType] = useState<PlacedSensor["sensorType"]>("erosion");
  const [radiusM,    setRadiusM]    = useState(DEFAULT_RADIUS["erosion"]);

  const handleTypeChange = (type: PlacedSensor["sensorType"]) => {
    setSensorType(type);
    setRadiusM(DEFAULT_RADIUS[type]); // reset radius to the canonical default for this type
  };

  // ── Live simulation — re-computes every time radius or sliders change ────────
  // All four functions are pure and synchronous so they run inline on every render.
  // No debounce or useEffect is needed — React re-renders are fast enough for a slider.
  const { areaM2, areaHa }  = catchmentFrom(radiusM);
  const erosion              = computeErosion(pending.slopeDeg, rainfallMm, areaHa);
  const recovery             = computeForestRecovery(yearsSinceFire, precipMmYr);
  const floodQ               = computeFloodFlow(rainfallMm, areaM2);
  // contam evaluates Gaussian decay from the Miette River source to this sensor's location
  const contam               = computeContaminant(pending.lat, pending.lon, contaminationLevel, radiusM);

  const badgeColor = (label: string) =>
    label === "High" ? "#ef4444" : label === "Medium" ? "#f59e0b" : "#22c55e";

  const handleConfirm = () => {
    if (!name.trim()) return;
    onConfirm({
      name:       name.trim(),
      lat:        pending.lat,
      lon:        pending.lon,
      sensorType,
      elevationM: pending.elevationM,
      slopeDeg:   pending.slopeDeg,
      radiusM:    radiusM,
      simulationResults: {
        catchmentAreaHa:     parseFloat(areaHa.toFixed(2)),
        erosionRateTPerHaYr: erosion.rate,
        erosionRiskLabel:    erosion.label,
        erosionTotalLoadTYr: erosion.totalLoad,
        forestRecoveryPct:   recovery,
        floodFlowM3s:        floodQ,
        contaminantConcNorm: contam.centerConc,
        contaminantEdgeConc: contam.edgeConc,
      },
    });
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-[400px] max-h-[92vh] overflow-y-auto">
        <div className="p-6">

          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-bold text-gray-900 dark:text-white">Place Sensor Pin</h2>
            <button
              onClick={onCancel}
              className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-xl leading-none"
            >×</button>
          </div>

          {/* Location + terrain */}
          <div className="bg-gray-50 dark:bg-gray-800/60 rounded-xl px-3 py-2.5 mb-4 text-xs">
            <div className="text-gray-400 dark:text-gray-500 mb-0.5">Drop location</div>
            <div className="font-mono text-gray-700 dark:text-gray-300">
              {pending.lat.toFixed(5)}°N,&nbsp;{Math.abs(pending.lon).toFixed(5)}°W
            </div>
            <div className="flex gap-4 mt-1.5 text-gray-600 dark:text-gray-400">
              <span>Elevation:&nbsp;<strong>{pending.elevationM}&nbsp;m</strong></span>
              <span>Slope:&nbsp;<strong>{pending.slopeDeg}°</strong></span>
            </div>
          </div>

          {/* Name input */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Sensor name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. North Ridge Monitor"
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Sensor type */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Sensor type
            </label>
            <div className="grid grid-cols-2 gap-2">
              {SENSOR_TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleTypeChange(opt.value)}
                  style={sensorType === opt.value ? { borderColor: opt.color, color: opt.color } : {}}
                  className={[
                    "flex items-center gap-2 px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all text-left",
                    sensorType === opt.value
                      ? "border-current"
                      : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600",
                  ].join(" ")}
                >
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: opt.color }} />
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Coverage radius slider */}
          <div className="mb-5">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Coverage radius
              </label>
              <div className="text-right">
                <span className="text-sm font-bold text-blue-600 dark:text-blue-400">{radiusM} m</span>
                <span className="text-[10px] text-gray-400 dark:text-gray-500 ml-1.5">
                  ({areaHa.toFixed(1)} ha catchment)
                </span>
              </div>
            </div>
            <input
              type="range"
              min={100}
              max={2000}
              step={50}
              value={radiusM}
              onChange={(e) => setRadiusM(Number(e.target.value))}
              className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <div className="flex justify-between text-[10px] text-gray-400 mt-1">
              <span>100 m</span>
              <span>2,000 m</span>
            </div>
          </div>

          {/* Simulation results */}
          <div className="mb-5">
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Simulation results
              <span className="ml-1.5 text-[10px] font-normal text-gray-400">updates with radius</span>
            </div>
            <div className="space-y-1.5">
              <SimRow
                label="Catchment area"
                value={`${areaHa.toFixed(2)} ha`}
                subValue={`(π × ${radiusM}² m)`}
              />
              <SimRow
                label="Soil erosion rate"
                value={`${erosion.rate.toFixed(2)} t/ha/yr`}
                badge={erosion.label}
                badgeColor={badgeColor(erosion.label)}
                subValue={`Total load: ${erosion.totalLoad.toFixed(2)} t/yr from catchment`}
              />
              <SimRow
                label="Forest recovery"
                value={`${recovery.toFixed(1)}%`}
                subValue={`Monitoring ${areaHa.toFixed(1)} ha of canopy`}
              />
              <SimRow
                label="Flood flow (Q)"
                value={`${floodQ.toFixed(3)} m³/s`}
                subValue={`Q = C·i·A  (A = ${areaM2.toFixed(0)} m²)`}
              />
              <SimRow
                label="Contamination"
                value={`${(contam.centerConc * 100).toFixed(0)}% at centre`}
                subValue={`${(contam.edgeConc * 100).toFixed(0)}% at ${radiusM} m edge`}
              />
            </div>
          </div>

          {/* Disclaimer */}
          <div className="mb-5 rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 p-3">
            <div className="flex items-start gap-2">
              <span className="text-red-500 text-base leading-none mt-0.5 flex-shrink-0">⚠</span>
              <div>
                <div className="text-[11px] font-bold text-red-700 dark:text-red-400 mb-1">
                  Not real sensor data — for planning discussion only
                </div>
                <div className="text-[10px] text-red-600 dark:text-red-500 leading-relaxed">
                  These results are <strong>model predictions</strong>, not verified field measurements.
                  They have not been reviewed by a researcher or environmental scientist and
                  <strong> must not be used to drive environmental or policy decisions</strong>.
                </div>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2.5">
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={!name.trim()}
              className="flex-1 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Save for exploration
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
