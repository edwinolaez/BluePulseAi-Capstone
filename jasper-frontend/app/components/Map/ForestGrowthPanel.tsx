"use client";

import { useState } from "react";

interface Props {
  yearsSinceFire: number;
  onYearsSinceFireChange: (v: number) => void;
  precipMmYr: number;
  onPrecipMmYrChange: (v: number) => void;
}

const JASPER_PRECIP_BASELINE = 450; // mm/yr — Jasper townsite 30-yr climate normal
const GROWTH_RATE_BASE = 0.12;      // yr⁻¹ logistic growth rate (boreal lodgepole pine)
const INITIAL_RECOVERY = 0.02;      // fractional biomass immediately post-fire
const MAX_CANOPY_PCT = 85;          // % max canopy for Jasper spruce/pine stands

function calcRecovery(yearsSinceFire: number, precipMmYr: number): number {
  if (yearsSinceFire <= 0) return INITIAL_RECOVERY;
  const rEff = GROWTH_RATE_BASE * Math.sqrt(precipMmYr / JASPER_PRECIP_BASELINE);
  return 1 / (1 + ((1 - INITIAL_RECOVERY) / INITIAL_RECOVERY) * Math.exp(-rEff * yearsSinceFire));
}

function calcYearsToFull(yearsSinceFire: number, precipMmYr: number): number {
  const rEff = GROWTH_RATE_BASE * Math.sqrt(precipMmYr / JASPER_PRECIP_BASELINE);
  if (rEff <= 0) return 999;
  // Solve logistic for R = 0.95: t₉₅ = −ln((0.05/0.95)×(R₀/(1−R₀))) / r_eff
  const inner = (0.05 / 0.95) * (INITIAL_RECOVERY / (1 - INITIAL_RECOVERY));
  const t95 = -Math.log(inner) / rEff;
  return Math.max(0, Math.round(t95 - yearsSinceFire));
}

export function ForestGrowthPanel({
  yearsSinceFire,
  onYearsSinceFireChange,
  precipMmYr,
  onPrecipMmYrChange,
}: Props) {
  const [collapsed, setCollapsed] = useState(false);

  const recovery      = calcRecovery(yearsSinceFire, precipMmYr);
  const ndvi          = 0.10 + 0.70 * recovery;
  const canopyCover   = MAX_CANOPY_PCT * recovery;
  const carbonFlux    = 3.2 * recovery;             // tCO₂/ha/yr net uptake
  const yearsToFull   = calcYearsToFull(yearsSinceFire, precipMmYr);

  const statusLabel =
    recovery < 0.10 ? "Early Pioneer"
    : recovery < 0.30 ? "Shrub · Herb"
    : recovery < 0.60 ? "Sapling Stage"
    : "Canopy Closure";

  const statusTextColor =
    recovery < 0.10 ? "text-red-500"
    : recovery < 0.30 ? "text-amber-500"
    : recovery < 0.60 ? "text-lime-500"
    : "text-green-500";

  const statusBorderColor =
    recovery < 0.10 ? "border-red-400"
    : recovery < 0.30 ? "border-amber-400"
    : recovery < 0.60 ? "border-lime-400"
    : "border-green-400";

  return (
    <div className={[
      "hidden md:flex flex-col",
      "absolute bottom-28 left-4 z-[1000]",
      "w-64 rounded-xl shadow-xl overflow-hidden",
      "bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm",
      "border border-gray-200/60 dark:border-gray-700/40",
    ].join(" ")}>

      {/* Header — always visible, click to collapse */}
      <button
        onClick={() => setCollapsed(v => !v)}
        className="flex items-center gap-2 px-3 py-2 bg-green-600/10 border-b border-gray-200/60 dark:border-gray-700/40 w-full text-left hover:bg-green-600/20 transition-colors"
      >
        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse flex-shrink-0" />
        <span className="flex-1 text-[11px] font-bold uppercase tracking-wider text-gray-700 dark:text-gray-200">
          Digital Twin · Forest Growth
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

          {/* ── Years since fire slider ──────────────────────────────── */}
          <div>
            <div className="flex justify-between items-baseline mb-1.5">
              <label className="text-[11px] text-gray-500 dark:text-gray-400">
                Years Since Fire
              </label>
              <span className={`text-[11px] font-bold ${statusTextColor}`}>
                {yearsSinceFire} yr · {statusLabel}
              </span>
            </div>
            <input
              type="range" min={0} max={30} step={1}
              value={yearsSinceFire}
              onChange={e => onYearsSinceFireChange(parseInt(e.target.value))}
              className="w-full h-1.5 rounded-full cursor-pointer accent-green-500"
            />
            <div className="flex justify-between text-[9px] text-gray-400 mt-0.5">
              <span>Fire year</span>
              <span>30 yr</span>
            </div>
          </div>

          {/* ── Annual precipitation slider ──────────────────────────── */}
          <div>
            <div className="flex justify-between items-baseline mb-1.5">
              <label className="text-[11px] text-gray-500 dark:text-gray-400">
                Annual Precipitation
              </label>
              <span className="text-[11px] font-bold text-gray-700 dark:text-gray-200">
                {precipMmYr} mm/yr
              </span>
            </div>
            <input
              type="range" min={200} max={800} step={10}
              value={precipMmYr}
              onChange={e => onPrecipMmYrChange(parseInt(e.target.value))}
              className="w-full h-1.5 rounded-full cursor-pointer accent-green-500"
            />
            <div className="flex justify-between text-[9px] text-gray-400 mt-0.5">
              <span>200 mm</span>
              <span>800 mm</span>
            </div>
          </div>

          {/* ── Recovery progress bar ─────────────────────────────────── */}
          <div>
            <div className="flex justify-between items-baseline mb-1">
              <span className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Ecosystem Recovery
              </span>
              <span className={`text-[11px] font-bold ${statusTextColor}`}>
                {(recovery * 100).toFixed(1)}%
              </span>
            </div>
            <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className={[
                  "h-full rounded-full transition-all duration-300",
                  recovery < 0.10 ? "bg-red-500"
                  : recovery < 0.30 ? "bg-amber-500"
                  : recovery < 0.60 ? "bg-lime-500"
                  : "bg-green-500",
                ].join(" ")}
                style={{ width: `${recovery * 100}%` }}
              />
            </div>
          </div>

          {/* ── Stat cards ───────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-1.5 pt-0.5">
            <div className={`rounded-lg p-2 border ${statusBorderColor} bg-gray-50 dark:bg-gray-800/60`}>
              <div className="text-[9px] text-gray-400 dark:text-gray-500 mb-0.5 uppercase tracking-wide">
                NDVI Estimate
              </div>
              <div className="text-sm font-bold text-gray-800 dark:text-gray-100 tabular-nums">
                {ndvi.toFixed(2)}
              </div>
              <div className="text-[9px] text-gray-400">vegetation index</div>
            </div>

            <div className="rounded-lg p-2 bg-gray-50 dark:bg-gray-800/60">
              <div className="text-[9px] text-gray-400 dark:text-gray-500 mb-0.5 uppercase tracking-wide">
                Canopy Cover
              </div>
              <div className="text-sm font-bold text-gray-800 dark:text-gray-100 tabular-nums">
                {canopyCover.toFixed(1)}%
              </div>
              <div className="text-[9px] text-gray-400">of pre-fire</div>
            </div>

            <div className="rounded-lg p-2 bg-gray-50 dark:bg-gray-800/60">
              <div className="text-[9px] text-gray-400 dark:text-gray-500 mb-0.5 uppercase tracking-wide">
                Carbon Uptake
              </div>
              <div className="text-sm font-bold text-gray-800 dark:text-gray-100 tabular-nums">
                {carbonFlux.toFixed(2)}
              </div>
              <div className="text-[9px] text-gray-400">tCO₂/ha/yr</div>
            </div>

            <div className="rounded-lg p-2 bg-gray-50 dark:bg-gray-800/60">
              <div className="text-[9px] text-gray-400 dark:text-gray-500 mb-0.5 uppercase tracking-wide">
                Full Recovery
              </div>
              <div className="text-sm font-bold text-gray-800 dark:text-gray-100 tabular-nums">
                {yearsToFull > 0 ? `~${yearsToFull} yr` : "Achieved"}
              </div>
              <div className="text-[9px] text-gray-400">to 95% canopy</div>
            </div>
          </div>

          {/* ── Early pioneer warning ────────────────────────────────── */}
          {recovery < 0.10 && (
            <div className="flex items-start gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-lg p-2">
              <svg
                className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5"
                viewBox="0 0 20 20" fill="currentColor"
              >
                <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
              <p className="text-[10px] text-red-700 dark:text-red-300 leading-relaxed">
                Active erosion risk — bare soil with minimal root cohesion post-fire.
              </p>
            </div>
          )}

          {/* ── Canopy closure success ───────────────────────────────── */}
          {recovery >= 0.60 && (
            <div className="flex items-start gap-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/40 rounded-lg p-2">
              <svg
                className="w-3.5 h-3.5 text-green-500 flex-shrink-0 mt-0.5"
                viewBox="0 0 20 20" fill="currentColor"
              >
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
              </svg>
              <p className="text-[10px] text-green-700 dark:text-green-300 leading-relaxed">
                Canopy closure reached — watershed hydrology and slope stability restoring.
              </p>
            </div>
          )}

          {/* ── Model note ───────────────────────────────────────────── */}
          <p className="text-[9px] text-gray-400 dark:text-gray-600 text-center leading-relaxed">
            Logistic regrowth · R(t) = 1/(1 + 49×e<sup>−0.12t</sup>) · precip-scaled
          </p>

        </div>
      )}
    </div>
  );
}
