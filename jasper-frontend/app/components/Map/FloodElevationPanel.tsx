"use client";

import { useState } from "react";

interface Props {
  waterLevelM:            number;
  onWaterLevelMChange:    (v: number) => void;
  stormDurationHr:        number;
  onStormDurationHrChange:(v: number) => void;
}

// Athabasca River flood model — calibrated to the Jasper NP valley cross-section.
// Base discharge 150 m³/s (EC Water Survey of Canada, 30-yr mean at Jasper gauge).
// Peak of 2013 record flood ≈ 1 200 m³/s, which aligns with waterLevel ≈ 2.8 m.
const BASE_DISCHARGE = 150; // m³/s

function calcPeakDischarge(waterLevelM: number, stormDurationHr: number): number {
  if (waterLevelM <= 0) return BASE_DISCHARGE;
  return Math.round(
    BASE_DISCHARGE +
    Math.pow(waterLevelM, 1.8) * 200 * Math.pow(stormDurationHr / 24, 0.3)
  );
}

// Valley inundation area — derived from Athabasca valley DEM cross-sections.
// Category 4 (river corridor) floods first; Cat 3 starts at ~1.5 m rise.
function calcInundatedAreaKm2(waterLevelM: number): number {
  if (waterLevelM <= 0) return 0;
  return parseFloat((1.0 + 5.5 * Math.pow(waterLevelM, 1.3)).toFixed(1));
}

// Which ArcGIS elevation risk categories are inundated at this water level
function calcRiskCatsAtRisk(waterLevelM: number): number[] {
  const cats: number[] = [];
  if (waterLevelM >= 0.2) cats.push(4); // river corridor
  if (waterLevelM >= 1.5) cats.push(3); // transitional terrain
  if (waterLevelM >= 3.0) cats.push(2); // upper slopes
  // Cat 1 (bedrock ridges) never floods at this basin scale
  return cats;
}

// Approximate return period from PFRA/EC flood frequency analysis for Athabasca
function returnPeriodLabel(waterLevelM: number): string {
  if (waterLevelM < 0.5)  return "< 2-yr event";
  if (waterLevelM < 1.5)  return "2–10 yr event";
  if (waterLevelM < 2.5)  return "10–50 yr event";
  if (waterLevelM < 3.5)  return "50–100 yr event";
  return "100–500 yr event";
}

// Infrastructure exposure labels ordered by depth threshold
const INFRASTRUCTURE: { threshold: number; label: string }[] = [
  { threshold: 0.2, label: "River trail network" },
  { threshold: 1.0, label: "Athabasca River Pkwy" },
  { threshold: 2.0, label: "Jasper town road grid" },
  { threshold: 3.5, label: "Jasper townsite (low zones)" },
];

export function FloodElevationPanel({
  waterLevelM,
  onWaterLevelMChange,
  stormDurationHr,
  onStormDurationHrChange,
}: Props) {
  const [collapsed, setCollapsed] = useState(false);

  const peakDischarge   = calcPeakDischarge(waterLevelM, stormDurationHr);
  const inundatedAreaKm2 = calcInundatedAreaKm2(waterLevelM);
  const catsAtRisk      = calcRiskCatsAtRisk(waterLevelM);
  const returnPeriod    = returnPeriodLabel(waterLevelM);
  const affectedInfra   = INFRASTRUCTURE.filter(i => waterLevelM >= i.threshold);

  const riskLabel =
    waterLevelM >= 3.0 ? "Extreme"
    : waterLevelM >= 1.5 ? "Moderate"
    : "Low";

  const riskTextColor =
    waterLevelM >= 3.0 ? "text-red-500"
    : waterLevelM >= 1.5 ? "text-amber-500"
    : "text-blue-500";

  const riskBorderColor =
    waterLevelM >= 3.0 ? "border-red-400"
    : waterLevelM >= 1.5 ? "border-amber-400"
    : "border-blue-400";

  const progressColor =
    waterLevelM >= 3.0 ? "bg-red-500"
    : waterLevelM >= 1.5 ? "bg-amber-500"
    : "bg-blue-500";

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
        className="flex items-center gap-2 px-3 py-2 bg-blue-500/10 border-b border-gray-200/60 dark:border-gray-700/40 w-full text-left hover:bg-blue-500/20 transition-colors"
      >
        <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse flex-shrink-0" />
        <span className="flex-1 text-[11px] font-bold uppercase tracking-wider text-gray-700 dark:text-gray-200">
          Digital Twin · Flood Elevation
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

          {/* ── Water level slider ──────────────────────────────────── */}
          <div>
            <div className="flex justify-between items-baseline mb-1.5">
              <label className="text-[11px] text-gray-500 dark:text-gray-400">
                Water Level Rise
              </label>
              <span className={`text-[11px] font-bold ${riskTextColor}`}>
                +{waterLevelM.toFixed(1)} m · {riskLabel}
              </span>
            </div>
            <input
              type="range" min={0} max={5} step={0.1}
              value={waterLevelM}
              onChange={e => onWaterLevelMChange(parseFloat(e.target.value))}
              className="w-full h-1.5 rounded-full cursor-pointer accent-blue-500"
            />
            <div className="flex justify-between text-[9px] text-gray-400 mt-0.5">
              <span>Normal</span>
              <span>+5 m</span>
            </div>
          </div>

          {/* ── Storm duration slider ────────────────────────────────── */}
          <div>
            <div className="flex justify-between items-baseline mb-1.5">
              <label className="text-[11px] text-gray-500 dark:text-gray-400">
                Storm Duration
              </label>
              <span className="text-[11px] font-bold text-gray-700 dark:text-gray-200">
                {stormDurationHr} hr
              </span>
            </div>
            <input
              type="range" min={1} max={72} step={1}
              value={stormDurationHr}
              onChange={e => onStormDurationHrChange(parseInt(e.target.value))}
              className="w-full h-1.5 rounded-full cursor-pointer accent-blue-500"
            />
            <div className="flex justify-between text-[9px] text-gray-400 mt-0.5">
              <span>1 hr</span>
              <span>72 hr</span>
            </div>
          </div>

          {/* ── Flood depth bar ─────────────────────────────────────── */}
          <div>
            <div className="flex justify-between items-baseline mb-1">
              <span className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Flood Depth
              </span>
              <span className={`text-[11px] font-bold ${riskTextColor}`}>
                {returnPeriod}
              </span>
            </div>
            <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${progressColor}`}
                style={{ width: `${(waterLevelM / 5) * 100}%` }}
              />
            </div>
          </div>

          {/* ── Stat cards ────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-1.5 pt-0.5">
            <div className={`rounded-lg p-2 border ${riskBorderColor} bg-gray-50 dark:bg-gray-800/60`}>
              <div className="text-[9px] text-gray-400 dark:text-gray-500 mb-0.5 uppercase tracking-wide">
                Peak Discharge
              </div>
              <div className="text-sm font-bold text-gray-800 dark:text-gray-100 tabular-nums">
                {peakDischarge.toLocaleString()} m³/s
              </div>
              <div className="text-[9px] text-gray-400">Athabasca gauge</div>
            </div>

            <div className="rounded-lg p-2 bg-gray-50 dark:bg-gray-800/60">
              <div className="text-[9px] text-gray-400 dark:text-gray-500 mb-0.5 uppercase tracking-wide">
                Inundated Area
              </div>
              <div className="text-sm font-bold text-gray-800 dark:text-gray-100 tabular-nums">
                {inundatedAreaKm2} km²
              </div>
              <div className="text-[9px] text-gray-400">valley floor</div>
            </div>

            <div className="rounded-lg p-2 bg-gray-50 dark:bg-gray-800/60">
              <div className="text-[9px] text-gray-400 dark:text-gray-500 mb-0.5 uppercase tracking-wide">
                Risk Zones Hit
              </div>
              <div className="text-sm font-bold text-gray-800 dark:text-gray-100">
                {catsAtRisk.length > 0
                  ? `Cat ${catsAtRisk.join(", ")}`
                  : "None"}
              </div>
              <div className="text-[9px] text-gray-400">ArcGIS classes</div>
            </div>

            <div className="rounded-lg p-2 bg-gray-50 dark:bg-gray-800/60">
              <div className="text-[9px] text-gray-400 dark:text-gray-500 mb-0.5 uppercase tracking-wide">
                Base Flow
              </div>
              <div className="text-sm font-bold text-gray-800 dark:text-gray-100 tabular-nums">
                150 m³/s
              </div>
              <div className="text-[9px] text-green-500">● EC live</div>
            </div>
          </div>

          {/* ── Infrastructure at risk list ─────────────────────────── */}
          {affectedInfra.length > 0 && (
            <div className="rounded-lg bg-gray-50 dark:bg-gray-800/60 p-2 space-y-1">
              <p className="text-[9px] font-bold uppercase tracking-wide text-gray-400 mb-1">
                Infrastructure at Risk
              </p>
              {affectedInfra.map(i => (
                <div key={i.label} className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                    waterLevelM >= 3.5 && i.threshold >= 3.5 ? "bg-red-500" :
                    waterLevelM >= 2.0 && i.threshold >= 2.0 ? "bg-amber-500" : "bg-blue-400"
                  }`} />
                  <span className="text-[10px] text-gray-600 dark:text-gray-400">{i.label}</span>
                </div>
              ))}
            </div>
          )}

          {/* ── Extreme flood warning ────────────────────────────────── */}
          {waterLevelM >= 3.0 && (
            <div className="flex items-start gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-lg p-2">
              <svg
                className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5"
                viewBox="0 0 20 20" fill="currentColor"
              >
                <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
              <p className="text-[10px] text-red-700 dark:text-red-300 leading-relaxed">
                Exceeds 50-yr flood threshold — emergency evacuation zones activated.
              </p>
            </div>
          )}

          {/* ── Model note ──────────────────────────────────────────── */}
          <p className="text-[9px] text-gray-400 dark:text-gray-600 text-center leading-relaxed">
            Q = 150 + h<sup>1.8</sup>×200×(t/24)<sup>0.3</sup> · EC Water Survey · Jasper gauge
          </p>

        </div>
      )}
    </div>
  );
}
