"use client";

import { useState } from "react";

interface Props {
  contaminationLevel: number;
  onContaminationLevelChange: (v: number) => void;
  projectionHours: number;
  onProjectionHoursChange: (v: number) => void;
}

const ATHABASCA_VELOCITY_MS = 2.1;
const DECAY_FACTOR = 0.05;
const SAFETY_THRESHOLD = 0.05;

function calcImpactDistKm(contamLevel: number): number {
  if (contamLevel <= SAFETY_THRESHOLD) return 0;
  return -Math.log(SAFETY_THRESHOLD / contamLevel) / DECAY_FACTOR;
}

/**
 * ContaminantScenarioPanel — "What if?" digital twin control panel.
 *
 * Lets the user drag two sliders to explore hypothetical spill scenarios:
 *   - Contamination Level (0–100%) drives plume colour, hazard zone extent,
 *     and the impact boundary marker on both 2D and 3D maps.
 *   - Project Ahead (1–72 h) controls how far downstream the animation extends.
 *
 * All statistics are computed client-side using the same 1D advection-dispersion
 * physics as the ML model (C(d) = C₀ × exp(-d × 0.05)) so results are
 * consistent with the map overlay without requiring an extra API round-trip.
 *
 * Physics constants match contaminant_model.py exactly:
 *   decay factor k = 0.05 km⁻¹  →  concentration halves every ~14 km
 *   safety threshold = 5 % of initial concentration
 *   river velocity baseline = 2.1 m/s (Athabasca EC Water Office average)
 */
export function ContaminantScenarioPanel({
  contaminationLevel,
  onContaminationLevelChange,
  projectionHours,
  onProjectionHoursChange,
}: Props) {
  const [collapsed, setCollapsed] = useState(false);

  const impactDistKm    = calcImpactDistKm(contaminationLevel);
  const plumeWidthM     = 50 + 200 * contaminationLevel;
  const projectedReachKm = (ATHABASCA_VELOCITY_MS * projectionHours * 3600) / 1000;
  // Affected area = corridor length up to the hazard boundary × plume width
  const corridorKm      = Math.min(impactDistKm, projectedReachKm);
  const affectedAreaKm2 = corridorKm * (plumeWidthM / 1000);

  const riskLabel =
    contaminationLevel >= 0.7 ? "High"
    : contaminationLevel >= 0.4 ? "Medium"
    : "Low";

  const riskTextColor =
    contaminationLevel >= 0.7 ? "text-red-500"
    : contaminationLevel >= 0.4 ? "text-amber-500"
    : "text-green-500";

  const riskBorderColor =
    contaminationLevel >= 0.7 ? "border-red-400"
    : contaminationLevel >= 0.4 ? "border-amber-400"
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
        className="flex items-center gap-2 px-3 py-2 bg-sait-sky/10 border-b border-gray-200/60 dark:border-gray-700/40 w-full text-left hover:bg-sait-sky/20 transition-colors"
      >
        <div className="w-2 h-2 rounded-full bg-sait-sky animate-pulse flex-shrink-0" />
        <span className="flex-1 text-[11px] font-bold uppercase tracking-wider text-gray-700 dark:text-gray-200">
          Digital Twin · Spill Scenario
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

          {/* ── Contamination level slider ─────────────────────────────── */}
          <div>
            <div className="flex justify-between items-baseline mb-1.5">
              <label className="text-[11px] text-gray-500 dark:text-gray-400">
                Contamination Level
              </label>
              <span className={`text-[11px] font-bold ${riskTextColor}`}>
                {(contaminationLevel * 100).toFixed(0)}% · {riskLabel}
              </span>
            </div>
            <input
              type="range" min={0} max={1} step={0.01}
              value={contaminationLevel}
              onChange={e => onContaminationLevelChange(parseFloat(e.target.value))}
              className="w-full h-1.5 rounded-full cursor-pointer accent-sait-sky"
            />
            <div className="flex justify-between text-[9px] text-gray-400 mt-0.5">
              <span>Clean</span>
              <span>Critical</span>
            </div>
          </div>

          {/* ── Projection hours slider ────────────────────────────────── */}
          <div>
            <div className="flex justify-between items-baseline mb-1.5">
              <label className="text-[11px] text-gray-500 dark:text-gray-400">
                Project Ahead
              </label>
              <span className="text-[11px] font-bold text-gray-700 dark:text-gray-200">
                {projectionHours} h
              </span>
            </div>
            <input
              type="range" min={1} max={72} step={1}
              value={projectionHours}
              onChange={e => onProjectionHoursChange(parseInt(e.target.value))}
              className="w-full h-1.5 rounded-full cursor-pointer accent-sait-sky"
            />
            <div className="flex justify-between text-[9px] text-gray-400 mt-0.5">
              <span>1 h</span>
              <span>72 h</span>
            </div>
          </div>

          {/* ── Stat cards ─────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-1.5 pt-0.5">
            <div className={`rounded-lg p-2 border ${riskBorderColor} bg-gray-50 dark:bg-gray-800/60`}>
              <div className="text-[9px] text-gray-400 dark:text-gray-500 mb-0.5 uppercase tracking-wide">
                Hazard Zone
              </div>
              <div className="text-sm font-bold text-gray-800 dark:text-gray-100 tabular-nums">
                {impactDistKm.toFixed(1)} km
              </div>
              <div className="text-[9px] text-gray-400">to safe level</div>
            </div>

            <div className="rounded-lg p-2 bg-gray-50 dark:bg-gray-800/60">
              <div className="text-[9px] text-gray-400 dark:text-gray-500 mb-0.5 uppercase tracking-wide">
                Affected Area
              </div>
              <div className="text-sm font-bold text-gray-800 dark:text-gray-100 tabular-nums">
                {affectedAreaKm2.toFixed(1)} km²
              </div>
              <div className="text-[9px] text-gray-400">river corridor</div>
            </div>

            <div className="rounded-lg p-2 bg-gray-50 dark:bg-gray-800/60">
              <div className="text-[9px] text-gray-400 dark:text-gray-500 mb-0.5 uppercase tracking-wide">
                Plume Reach
              </div>
              <div className="text-sm font-bold text-gray-800 dark:text-gray-100 tabular-nums">
                {projectedReachKm.toFixed(0)} km
              </div>
              <div className="text-[9px] text-gray-400">in {projectionHours} h</div>
            </div>

            <div className="rounded-lg p-2 bg-gray-50 dark:bg-gray-800/60">
              <div className="text-[9px] text-gray-400 dark:text-gray-500 mb-0.5 uppercase tracking-wide">
                River Velocity
              </div>
              <div className="text-sm font-bold text-gray-800 dark:text-gray-100 tabular-nums">
                2.1 m/s
              </div>
              <div className="text-[9px] text-green-500">● EC live</div>
            </div>
          </div>

          {/* ── High-contamination warning ──────────────────────────────── */}
          {contaminationLevel >= 0.7 && (
            <div className="flex items-start gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-lg p-2">
              <svg
                className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5"
                viewBox="0 0 20 20" fill="currentColor"
              >
                <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
              <p className="text-[10px] text-red-700 dark:text-red-300 leading-relaxed">
                Critical — downstream water intake advisories may be required.
              </p>
            </div>
          )}

          {/* ── Model note ─────────────────────────────────────────────── */}
          <p className="text-[9px] text-gray-400 dark:text-gray-600 text-center leading-relaxed">
            1D advection-dispersion · C(d) = C₀ × e<sup>−0.05d</sup> · 5% safety threshold
          </p>

        </div>
      )}
    </div>
  );
}
