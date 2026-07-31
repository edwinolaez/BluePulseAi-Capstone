"use client";

import { useState } from "react";

interface Props {
  slopeDeg:          number;
  onSlopeDegChange:  (v: number) => void;
  rainfallMm:        number;
  onRainfallMmChange:(v: number) => void;
}

// Simplified RUSLE calibrated to Jasper post-wildfire terrain:
//   A = 2.0 × (rainfall / 82)^1.2 × (slope / 22)^1.4  [t/ha/yr]
// Constants derived from SRTM slope data + Environment Canada precip normals.
// Baseline values (slope=22°, rainfall=82 mm) reproduce the ATH-001-M "Medium" ML label.
const BASELINE_RAIN = 82;   // mm — Jasper watershed seasonal avg (EC Climate Normals)
const BASELINE_SLOPE = 22;  // degrees — mid-slope terrace (ATH-001-M)
const BASE_RATE = 2.0;      // t/ha/yr at baseline conditions

function calcErosionRate(slopeDeg: number, rainfallMm: number): number {
  if (slopeDeg <= 0 || rainfallMm <= 0) return 0;
  return (
    BASE_RATE *
    Math.pow(rainfallMm / BASELINE_RAIN,  1.2) *
    Math.pow(slopeDeg   / BASELINE_SLOPE, 1.4)
  );
}

// Sediment Delivery Ratio for short, steep Rocky Mountain catchments
const SDR          = 0.25;
const ZONE_AREA_HA = 500; // approximate monitored slope area

function calcSedimentYield(erosionRate: number): number {
  return erosionRate * SDR * ZONE_AREA_HA; // tonnes/yr reaching the river
}

function calcStabilizeYears(erosionRate: number): number {
  // Post-wildfire revegetation timelines (Parks Canada / NRCan literature)
  return Math.round(5 + Math.min(35, erosionRate * 3.5));
}

export function SoilErosionPanel({
  slopeDeg,
  onSlopeDegChange,
  rainfallMm,
  onRainfallMmChange,
}: Props) {
  const [collapsed, setCollapsed] = useState(false);

  const erosionRate    = calcErosionRate(slopeDeg, rainfallMm);
  const sedimentYield  = calcSedimentYield(erosionRate);
  const stabilizeYears = calcStabilizeYears(erosionRate);
  const runoffDepthMm  = rainfallMm * 0.62 * (slopeDeg / 22); // rough overland flow estimate

  const riskLabel =
    erosionRate >= 4.0 ? "High"
    : erosionRate >= 1.5 ? "Medium"
    : "Low";

  const riskTextColor =
    erosionRate >= 4.0 ? "text-red-500"
    : erosionRate >= 1.5 ? "text-amber-500"
    : "text-green-500";

  const riskBorderColor =
    erosionRate >= 4.0 ? "border-red-400"
    : erosionRate >= 1.5 ? "border-amber-400"
    : "border-green-400";

  const accentColor =
    erosionRate >= 4.0 ? "bg-red-500"
    : erosionRate >= 1.5 ? "bg-amber-500"
    : "bg-green-500";

  return (
    <div className={[
      "hidden md:flex flex-col",
      "absolute bottom-28 left-4 z-[1000]",
      "w-64 rounded-xl shadow-xl overflow-hidden",
      "bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm",
      "border border-gray-200/60 dark:border-gray-700/40",
    ].join(" ")}>

      {/* Header */}
      <button
        onClick={() => setCollapsed(v => !v)}
        className="flex items-center gap-2 px-3 py-2 bg-sait-purple/10 border-b border-gray-200/60 dark:border-gray-700/40 w-full text-left hover:bg-sait-purple/20 transition-colors"
      >
        <div className="w-2 h-2 rounded-full bg-sait-purple animate-pulse flex-shrink-0" />
        <span className="flex-1 text-[11px] font-bold uppercase tracking-wider text-gray-700 dark:text-gray-200">
          Digital Twin · Soil Erosion
        </span>
        <svg
          className={["w-3.5 h-3.5 text-gray-400 transition-transform", collapsed ? "-rotate-90" : ""].join(" ")}
          viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
        >
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>

      {!collapsed && (
        <div className="p-3 space-y-3">

          {/* ── Slope angle slider ──────────────────────────────────── */}
          <div>
            <div className="flex justify-between items-baseline mb-1.5">
              <label className="text-[11px] text-gray-500 dark:text-gray-400">
                Slope Angle
              </label>
              <span className={`text-[11px] font-bold ${riskTextColor}`}>
                {slopeDeg}° · {riskLabel}
              </span>
            </div>
            <input
              type="range" min={0} max={45} step={1}
              value={slopeDeg}
              onChange={e => onSlopeDegChange(parseInt(e.target.value))}
              className="w-full h-1.5 rounded-full cursor-pointer accent-sait-purple"
            />
            <div className="flex justify-between text-[9px] text-gray-400 mt-0.5">
              <span>Flat</span>
              <span>45°</span>
            </div>
          </div>

          {/* ── Rainfall slider ─────────────────────────────────────── */}
          <div>
            <div className="flex justify-between items-baseline mb-1.5">
              <label className="text-[11px] text-gray-500 dark:text-gray-400">
                Rainfall
              </label>
              <span className="text-[11px] font-bold text-gray-700 dark:text-gray-200">
                {rainfallMm} mm
              </span>
            </div>
            <input
              type="range" min={0} max={200} step={5}
              value={rainfallMm}
              onChange={e => onRainfallMmChange(parseInt(e.target.value))}
              className="w-full h-1.5 rounded-full cursor-pointer accent-sait-purple"
            />
            <div className="flex justify-between text-[9px] text-gray-400 mt-0.5">
              <span>Dry</span>
              <span>200 mm</span>
            </div>
          </div>

          {/* ── Erosion rate bar ────────────────────────────────────── */}
          <div>
            <div className="flex justify-between items-baseline mb-1">
              <span className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Erosion Rate
              </span>
              <span className={`text-[11px] font-bold ${riskTextColor}`}>
                {erosionRate.toFixed(2)} t/ha/yr
              </span>
            </div>
            <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${accentColor}`}
                style={{ width: `${Math.min(100, (erosionRate / 10) * 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-[9px] text-gray-400 mt-0.5">
              <span>0</span>
              <span>10 t/ha/yr</span>
            </div>
          </div>

          {/* ── Stat cards ────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-1.5 pt-0.5">
            <div className={`rounded-lg p-2 border ${riskBorderColor} bg-gray-50 dark:bg-gray-800/60`}>
              <div className="text-[9px] text-gray-400 dark:text-gray-500 mb-0.5 uppercase tracking-wide">
                Sediment Yield
              </div>
              <div className="text-sm font-bold text-gray-800 dark:text-gray-100 tabular-nums">
                {sedimentYield < 1000
                  ? `${Math.round(sedimentYield)} t`
                  : `${(sedimentYield / 1000).toFixed(1)} kt`}
              </div>
              <div className="text-[9px] text-gray-400">per year to river</div>
            </div>

            <div className="rounded-lg p-2 bg-gray-50 dark:bg-gray-800/60">
              <div className="text-[9px] text-gray-400 dark:text-gray-500 mb-0.5 uppercase tracking-wide">
                Stabilize In
              </div>
              <div className="text-sm font-bold text-gray-800 dark:text-gray-100 tabular-nums">
                {erosionRate <= 0 ? "Stable" : `~${stabilizeYears} yr`}
              </div>
              <div className="text-[9px] text-gray-400">with revegetation</div>
            </div>

            <div className="rounded-lg p-2 bg-gray-50 dark:bg-gray-800/60">
              <div className="text-[9px] text-gray-400 dark:text-gray-500 mb-0.5 uppercase tracking-wide">
                Runoff Depth
              </div>
              <div className="text-sm font-bold text-gray-800 dark:text-gray-100 tabular-nums">
                {runoffDepthMm.toFixed(0)} mm
              </div>
              <div className="text-[9px] text-gray-400">overland flow</div>
            </div>

            <div className="rounded-lg p-2 bg-gray-50 dark:bg-gray-800/60">
              <div className="text-[9px] text-gray-400 dark:text-gray-500 mb-0.5 uppercase tracking-wide">
                Zone Area
              </div>
              <div className="text-sm font-bold text-gray-800 dark:text-gray-100 tabular-nums">
                500 ha
              </div>
              <div className="text-[9px] text-green-500">● SRTM mapped</div>
            </div>
          </div>

          {/* ── High erosion warning ─────────────────────────────────── */}
          {erosionRate >= 4.0 && (
            <div className="flex items-start gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-lg p-2">
              <svg
                className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5"
                viewBox="0 0 20 20" fill="currentColor"
              >
                <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
              <p className="text-[10px] text-red-700 dark:text-red-300 leading-relaxed">
                Active soil loss — slope stabilisation and bioengineering required.
              </p>
            </div>
          )}

          {/* ── Low erosion badge ────────────────────────────────────── */}
          {erosionRate < 1.5 && erosionRate > 0 && (
            <div className="flex items-start gap-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/40 rounded-lg p-2">
              <svg
                className="w-3.5 h-3.5 text-green-500 flex-shrink-0 mt-0.5"
                viewBox="0 0 20 20" fill="currentColor"
              >
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
              </svg>
              <p className="text-[10px] text-green-700 dark:text-green-300 leading-relaxed">
                Minimal soil loss — terrain stable under current conditions.
              </p>
            </div>
          )}

          {/* ── Model note ──────────────────────────────────────────── */}
          <p className="text-[9px] text-gray-400 dark:text-gray-600 text-center leading-relaxed">
            RUSLE · A = 2.0 × (P/82)<sup>1.2</sup> × (S/22°)<sup>1.4</sup> · SDR 0.25
          </p>

        </div>
      )}
    </div>
  );
}
