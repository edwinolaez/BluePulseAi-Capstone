// AiOverviewPage shows the results from all three of Richard's ML models
// in one place — burn scar detection, erosion simulation, and contaminant tracking.
// It fetches all three at the same time when the page loads.
// If the live API isn't available yet, it falls back to estimated (mock) values
// so the page always has something meaningful to display.

"use client";

import { useEffect, useState } from "react";
import { fetchChangeDetection, fetchErosionSimulation, fetchContaminantSimulation, ModelOutput } from "../../../lib/api";

// Config for each of the three ML models — defines what to show in the card
const MODELS = [
  {
    key: "burn",
    icon: "🌲",
    title: "Forest Burn Scar Detection",
    subtitle: "Random Forest — change detection on satellite imagery",
    sector: "ATH-001-A",
    accentColor: "text-rose-500",
    accentBg: "bg-rose-500/10",
    borderActive: "border-rose-500",
  },
  {
    key: "erosion",
    icon: "⛰️",
    title: "Erosion Risk Simulation",
    subtitle: "RUSLE-based — slope angle + rainfall inputs",
    sector: "ATH-001-H",
    accentColor: "text-purple-500",
    accentBg: "bg-purple-500/10",
    borderActive: "border-purple-500",
  },
  {
    key: "contaminant",
    icon: "💧",
    title: "Contaminant Plume Tracker",
    subtitle: "Flow model — hydrocarbon plume direction + velocity",
    sector: "ATH-001-W",
    accentColor: "text-cyan-500",
    accentBg: "bg-cyan-500/10",
    borderActive: "border-cyan-500",
  },
] as const;

// Colour styles for the risk level badge on each card
const RISK_BADGE: Record<string, string> = {
  High:   "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400",
  Medium: "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400",
  Low:    "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400",
};

// Horizontal bar that visually represents the risk score (0–100%).
// Turns red above 70%, amber between 40–69%, green below 40%.
function ScoreBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 70 ? "bg-red-500" : pct >= 40 ? "bg-amber-500" : "bg-green-500";
  return (
    <div className="mt-2">
      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
        <span>Risk Score</span>
        <span className="font-semibold text-gray-800 dark:text-gray-100">{pct}%</span>
      </div>
      <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
        {/* The bar width animates from 0 to the actual percentage */}
        <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function AiOverviewPage() {
  // Stores the live results from all three API calls.
  // Null means the call either hasn't finished yet or failed.
  const [results, setResults] = useState<Record<string, ModelOutput | null>>({
    burn: null, erosion: null, contaminant: null,
  });
  const [loading, setLoading] = useState(true);

  // On first load, fire all three API calls at the same time using Promise.allSettled.
  // allSettled (vs Promise.all) means one failure doesn't block the others —
  // we still show the results that did succeed.
  useEffect(() => {
    Promise.allSettled([
      fetchChangeDetection("ATH-001-A"),
      fetchErosionSimulation("ATH-001-H", 42, 95),
      fetchContaminantSimulation("ATH-001-W", 180, 2.1, 0.72),
    ]).then(([burn, erosion, contaminant]) => {
      setResults({
        burn:        burn.status        === "fulfilled" ? burn.value        : null,
        erosion:     erosion.status     === "fulfilled" ? erosion.value     : null,
        contaminant: contaminant.status === "fulfilled" ? contaminant.value : null,
      });
      setLoading(false);
    });
  }, []);

  // Fallback values used when the live API call fails or is still pending.
  // This keeps the page useful even when Richard's API isn't deployed yet.
  const mockFallback: Record<string, Partial<ModelOutput>> = {
    burn:        { risk_label: "High",   risk_score: 0.82, confidence: 0.946, model_version: "v1.3.0" },
    erosion:     { risk_label: "High",   risk_score: 0.74, confidence: 0.871, model_version: "v1.1.2" },
    contaminant: { risk_label: "Medium", risk_score: 0.55, confidence: 0.803, model_version: "v1.0.9" },
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-background">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">
          AI Model Overview
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Live outputs from Richard&apos;s ML models — burn scar detection, erosion simulation, and contaminant tracking.
        </p>
      </div>

      {/* Three model cards — one per AI model.
          A coloured border appears on a card when its data is live (not estimated). */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {MODELS.map((model) => {
          // Use live data if available, otherwise use the mock fallback
          const data = results[model.key] ?? mockFallback[model.key];
          const isLive = !!results[model.key];
          const risk = data?.risk_label ?? "—";
          const score = data?.risk_score ?? 0;
          const confidence = data?.confidence ?? 0;
          const version = data?.model_version ?? "—";

          return (
            <div
              key={model.key}
              // Active border only shows when the data is live from the API
              className={`rounded-xl border bg-surface p-5 ${isLive ? model.borderActive : "border-gray-200/60 dark:border-gray-700/40"}`}
            >
              {/* Card header: model icon + Live/Estimated badge + version number */}
              <div className="flex items-start justify-between mb-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl ${model.accentBg}`}>
                  {model.icon}
                </div>
                <div className="flex flex-col items-end gap-1">
                  {isLive
                    ? <span className="flex items-center gap-1 text-[10px] font-semibold text-green-500"><span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />Live</span>
                    : <span className="text-[10px] font-semibold text-amber-500">Estimated</span>
                  }
                  <span className="text-[10px] text-gray-400">{version}</span>
                </div>
              </div>

              <h2 className="text-sm font-bold text-gray-800 dark:text-gray-100 mb-0.5">{model.title}</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">{model.subtitle}</p>

              {/* Risk badge + confidence percentage */}
              <div className="flex items-center gap-2 mb-3">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${RISK_BADGE[risk] ?? "bg-gray-100 dark:bg-gray-800 text-gray-500"}`}>
                  {risk} Risk
                </span>
                <span className="text-xs text-gray-400">{Math.round(confidence * 100)}% confidence</span>
              </div>

              {/* Animated progress bar showing the raw risk score */}
              <ScoreBar value={score} />
            </div>
          );
        })}
      </div>

      {/* Summary table — shows all three models side by side for easy comparison */}
      <div className="rounded-xl border border-gray-200/60 dark:border-gray-700/40 bg-surface overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200/60 dark:border-gray-700/40">
          <h2 className="text-sm font-bold text-gray-800 dark:text-gray-100">Model Output Summary</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Sector-level risk assessment from all three simulations</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200/60 dark:border-gray-700/40 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                <th className="text-left px-5 py-3">Model</th>
                <th className="text-left px-5 py-3">Sector</th>
                <th className="text-left px-5 py-3">Risk Level</th>
                <th className="text-left px-5 py-3">Score</th>
                <th className="text-left px-5 py-3">Confidence</th>
                <th className="text-left px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {MODELS.map((model, i) => {
                const data = results[model.key] ?? mockFallback[model.key];
                const isLive = !!results[model.key];
                return (
                  // Alternating row background for readability
                  <tr key={model.key} className={`border-b border-gray-100 dark:border-gray-800/60 ${i % 2 === 0 ? "" : "bg-surface-alt/40"}`}>
                    <td className="px-5 py-3 font-medium text-gray-800 dark:text-gray-100">
                      <span className="mr-2">{model.icon}</span>{model.title.split(" ").slice(0, 2).join(" ")}
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-gray-500 dark:text-gray-400">{model.sector}</td>
                    <td className="px-5 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${RISK_BADGE[data?.risk_label ?? ""] ?? "bg-gray-100 text-gray-500"}`}>
                        {data?.risk_label ?? "—"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-700 dark:text-gray-300">{data?.risk_score != null ? (data.risk_score * 100).toFixed(0) + "%" : "—"}</td>
                    <td className="px-5 py-3 text-gray-700 dark:text-gray-300">{data?.confidence != null ? (data.confidence * 100).toFixed(0) + "%" : "—"}</td>
                    <td className="px-5 py-3">
                      {/* Green = data is coming live from Richard's API; amber = using estimated values */}
                      {isLive
                        ? <span className="text-xs font-semibold text-green-500">Live</span>
                        : <span className="text-xs font-semibold text-amber-500">Estimated</span>
                      }
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Shown while the three API calls are still in-flight */}
      {loading && (
        <p className="text-xs text-gray-400 mt-4 text-center">Fetching live model data…</p>
      )}
    </div>
  );
}
