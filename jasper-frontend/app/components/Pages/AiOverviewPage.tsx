"use client";

import { useEffect, useRef, useState } from "react";
import { fetchChangeDetection, fetchErosionSimulation, fetchContaminantSimulation } from "../../../lib/api";
import type { ModelOutput, SimulationResults } from "../../../lib/api";
import { ResearcherChatPanel } from "../Widgets/ResearcherChatPanel";

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
    provenance: {
      source: "Canadian Wildfire Registry + Sentinel-2 Imagery",
      qualityFlag: "Good",
      lastRefreshLabel: "Sentinel-2 overpass",
    },
    inputs: [
      { label: "Spectral Bands",     value: "Sentinel-2 B4, B8A, B12" },
      { label: "NDVI Change Delta",  value: "−0.34 (pre vs post-fire)" },
      { label: "Burn Area Estimate", value: "~8.4 km² detected" },
      { label: "Last Satellite Pass",value: "July 18 2026, 10:22 UTC" },
    ],
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
    provenance: {
      source: "USGS SRTM DEM + Environment Canada Precip",
      qualityFlag: "Good",
      lastRefreshLabel: "Terrain + rainfall sync",
    },
    inputs: [
      { label: "Slope Angle",    value: "__slope__" },
      { label: "Rainfall",       value: "__rainfall__" },
      { label: "RUSLE K-factor", value: "0.32 (silty loam)" },
      { label: "DEM Resolution", value: "30 m SRTM v3" },
    ],
  },
  {
    key: "contaminant",
    icon: "💧",
    title: "Contaminant Plume Tracker",
    subtitle: "Flow model — hydrocarbon plume direction + velocity",
    sector: "ATH-001-W",
    accentColor: "text-sait-sky",
    accentBg: "bg-sait-sky/10",
    borderActive: "border-sait-sky",
    provenance: {
      source: "WSC Station 07AA001 — Miette River at Jasper",
      qualityFlag: "Good",
      lastRefreshLabel: "WSC live sensor sync",
    },
    inputs: [
      { label: "Flow Direction",       value: "180° (south)" },
      { label: "Water Velocity",       value: "2.1 m/s" },
      { label: "Contamination Level",  value: "__contamLevel__" },
      { label: "Hydrocarbon Baseline", value: "18.4 NTU turbidity" },
    ],
  },
] as const;

const RISK_BADGE: Record<string, string> = {
  High:   "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400",
  Medium: "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400",
  Low:    "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400",
};

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
        <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

interface Props {
  onResultsUpdate:       (results: SimulationResults) => void;
  onNavigateToMap:       () => void;
  /** Live values from the map digital twin sliders */
  slopeDeg:              number;
  rainfallMm:            number;
  contaminationLevel:    number;
}

export function AiOverviewPage({ onResultsUpdate, onNavigateToMap, slopeDeg, rainfallMm, contaminationLevel }: Props) {
  const [results, setResults] = useState<Record<string, ModelOutput | null>>({
    burn: null, erosion: null, contaminant: null,
  });
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedInputs, setExpandedInputs] = useState<Record<string, boolean>>({});

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasMounted  = useRef(false);
  const fetchIdRef  = useRef(0);

  function runFetch(slope: number, rainfall: number, contamLevel: number) {
    const id = ++fetchIdRef.current;
    Promise.allSettled([
      fetchChangeDetection("ATH-001-A"),
      fetchErosionSimulation("ATH-001-H", slope, rainfall),
      fetchContaminantSimulation("ATH-001-W", 180, 2.1, contamLevel),
    ]).then(([burn, erosion, contaminant]) => {
      if (id !== fetchIdRef.current) return;
      const burnVal        = burn.status        === "fulfilled" ? burn.value        : null;
      const erosionVal     = erosion.status     === "fulfilled" ? erosion.value     : null;
      const contaminantVal = contaminant.status === "fulfilled" ? contaminant.value : null;
      setResults({ burn: burnVal, erosion: erosionVal, contaminant: contaminantVal });
      onResultsUpdate({ burn: burnVal, erosion: erosionVal, contaminant: contaminantVal });
      setLoading(false);
      setRefreshing(false);
    });
  }

  // Initial fetch on mount with current slider values
  useEffect(() => {
    runFetch(slopeDeg, rainfallMm, contaminationLevel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-fetch (debounced 800 ms) whenever a slider changes after mount
  useEffect(() => {
    if (!hasMounted.current) { hasMounted.current = true; return; }
    setRefreshing(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runFetch(slopeDeg, rainfallMm, contaminationLevel), 800);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slopeDeg, rainfallMm, contaminationLevel]);

  // Resolve live input values for erosion + contaminant cards
  function resolveInputs(modelKey: string, staticInputs: readonly { readonly label: string; readonly value: string }[]) {
    return staticInputs.map((inp) => {
      if (modelKey === "erosion") {
        if (inp.value === "__slope__")    return { label: inp.label, value: `${slopeDeg}°` };
        if (inp.value === "__rainfall__") return { label: inp.label, value: `${rainfallMm} mm / day` };
      }
      if (modelKey === "contaminant" && inp.value === "__contamLevel__") {
        return { label: inp.label, value: `${contaminationLevel.toFixed(2)} (normalised 0–1)` };
      }
      return { label: inp.label, value: inp.value };
    });
  }

  const mockFallback: Record<string, Partial<ModelOutput>> = {
    burn:        { risk_label: "High",   risk_score: 0.82, confidence: 0.946, model_version: "v1.3.0", timestamp: new Date().toISOString() },
    erosion:     { risk_label: "High",   risk_score: 0.74, confidence: 0.871, model_version: "v1.1.2", timestamp: new Date().toISOString() },
    contaminant: { risk_label: "Medium", risk_score: 0.55, confidence: 0.803, model_version: "v1.0.9", timestamp: new Date().toISOString() },
  };

  function toggleInputs(key: string) {
    setExpandedInputs((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-background">

      {/* ── AI Disclaimer Banner ─────────────────────────────────────────────── */}
      <div className="mb-5 flex gap-3 p-4 rounded-xl border border-amber-300 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-900/10">
        <svg className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
        <div>
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">AI-Assisted Analysis — Not a Confirmed Report</p>
          <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5 leading-relaxed">
            All outputs on this page are generated by machine learning models and represent probabilistic estimates only.
            Results have not been reviewed or validated by a qualified environmental scientist.
            Do not use these outputs as the sole basis for regulatory decisions, public reporting, or field operations
            without independent expert validation.
          </p>
        </div>
      </div>

      {/* Page header */}
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">
            AI Model Overview
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Live outputs from Richard&apos;s ML models — burn scar detection, erosion simulation, and contaminant tracking.
          </p>
        </div>
        {/* Sync indicator — shows current slider values driving the models */}
        <div className="shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-sait-sky/10 border border-sait-sky/30 text-[11px] text-sait-sky font-medium whitespace-nowrap">
          {refreshing
            ? <span className="w-2 h-2 rounded-full bg-sait-sky animate-pulse" />
            : <span className="w-2 h-2 rounded-full bg-green-500" />
          }
          {refreshing ? "Updating…" : "Synced from map sliders"}
        </div>
      </div>

      {/* ── Three model cards ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {MODELS.map((model) => {
          const data       = results[model.key] ?? mockFallback[model.key];
          const isLive     = !!results[model.key];
          const risk       = data?.risk_label ?? "—";
          const score      = data?.risk_score ?? 0;
          const confidence = data?.confidence ?? 0;
          const version    = data?.model_version ?? "—";
          const timestamp  = data?.timestamp ? new Date(data.timestamp).toLocaleString("en-CA", { hour12: false }) : "—";
          const showInputs = !!expandedInputs[model.key];
          const liveInputs = resolveInputs(model.key, model.inputs);

          return (
            <div
              key={model.key}
              className={`rounded-xl border bg-surface p-5 flex flex-col gap-3 transition-opacity duration-300 ${refreshing && model.key !== "burn" ? "opacity-70" : ""} ${isLive ? model.borderActive : "border-gray-200/60 dark:border-gray-700/40"}`}
            >
              {/* Top row: icon + live status + version */}
              <div className="flex items-start justify-between">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl shrink-0 ${model.accentBg}`}>
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

              {/* Title + subtitle */}
              <div>
                <h2 className="text-sm font-bold text-gray-800 dark:text-gray-100 mb-0.5">{model.title}</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">{model.subtitle}</p>
                {/* Show live slider params for the two wired models */}
                {model.key === "erosion" && (
                  <p className="text-[10px] text-purple-400 mt-0.5">Slope {slopeDeg}° · Rainfall {rainfallMm} mm/day</p>
                )}
                {model.key === "contaminant" && (
                  <p className="text-[10px] text-sait-sky mt-0.5">Contamination level {contaminationLevel.toFixed(2)}</p>
                )}
              </div>

              {/* AI-generated pending review tag */}
              <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-900/15 border border-amber-200 dark:border-amber-700/40">
                <svg className="w-3.5 h-3.5 text-amber-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                </svg>
                <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-400">AI-generated · Pending expert review</span>
              </div>

              {/* AI Prediction output — risk + confidence */}
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest text-purple-500 dark:text-purple-400 mb-1.5">AI Prediction</p>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${RISK_BADGE[risk] ?? "bg-gray-100 dark:bg-gray-800 text-gray-500"}`}>
                    {risk} Risk
                  </span>
                  <span className="text-xs text-gray-400">{Math.round(confidence * 100)}% confidence</span>
                </div>
              </div>

              <ScoreBar value={score} />

              {/* Contributing inputs — collapsible, shows live slider values */}
              <div>
                <button
                  onClick={() => toggleInputs(model.key)}
                  className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors w-full text-left"
                >
                  <svg className={`w-3 h-3 transition-transform ${showInputs ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                  <span>Observed sensor inputs</span>
                  <span className="ml-1 px-1 py-0.5 rounded text-[8px] font-bold uppercase bg-sait-sky/10 text-sait-sky border border-sait-sky/20">Real data</span>
                </button>
                {showInputs && (
                  <div className="mt-2 rounded-lg bg-gray-50 dark:bg-gray-800/50 p-2.5 space-y-1.5">
                    {liveInputs.map((inp) => (
                      <div key={inp.label} className="flex justify-between gap-2">
                        <span className="text-[10px] text-gray-500 dark:text-gray-400">{inp.label}</span>
                        <span className="text-[10px] font-medium text-gray-700 dark:text-gray-300 text-right">{inp.value}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Data provenance footer */}
              <div className="pt-2 border-t border-gray-100 dark:border-gray-800 space-y-1">
                <div className="flex justify-between gap-1">
                  <span className="text-[10px] text-gray-400">Source</span>
                  <span className="text-[10px] text-gray-500 dark:text-gray-400 text-right leading-tight max-w-[60%]">{model.provenance.source}</span>
                </div>
                <div className="flex justify-between gap-1">
                  <span className="text-[10px] text-gray-400">Last refresh</span>
                  <span className="text-[10px] text-gray-500 dark:text-gray-400">{timestamp}</span>
                </div>
                <div className="flex justify-between gap-1">
                  <span className="text-[10px] text-gray-400">Quality flag</span>
                  <span className="text-[10px] font-semibold text-green-600 dark:text-green-400 flex items-center gap-1">
                    <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    {model.provenance.qualityFlag}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── View on Map CTA ──────────────────────────────────────────────────── */}
      {!loading && (
        <div className="mb-6 flex items-center justify-between gap-4 p-4 rounded-xl border border-sait-sky/40 bg-sait-sky/5 dark:bg-sait-sky/10">
          <div>
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">Simulations complete</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Erosion heatmap and contaminant plume are ready to view on the 3D map.
            </p>
          </div>
          <button
            onClick={onNavigateToMap}
            className="shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg bg-sait-sky text-white text-sm font-semibold hover:bg-sait-sky/80 transition-colors shadow"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 6l6 6-6 6" />
            </svg>
            View on Map
          </button>
        </div>
      )}

      {/* ── Model Output Summary table ───────────────────────────────────────── */}
      <div className="rounded-xl border border-gray-200/60 dark:border-gray-700/40 bg-surface overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200/60 dark:border-gray-700/40">
          <h2 className="text-sm font-bold text-gray-800 dark:text-gray-100">Model Output Summary</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Sector-level risk assessment — all values are probabilistic estimates pending expert validation</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200/60 dark:border-gray-700/40 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                <th className="text-left px-5 py-3">Model</th>
                <th className="text-left px-5 py-3">Sector</th>
                <th className="text-left px-5 py-3">
                  <span className="flex items-center gap-1">
                    Predicted Risk
                    <span className="px-1 py-0.5 rounded text-[8px] font-bold normal-case bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-700/40">AI</span>
                  </span>
                </th>
                <th className="text-left px-5 py-3">
                  <span className="flex items-center gap-1">
                    Score
                    <span className="px-1 py-0.5 rounded text-[8px] font-bold normal-case bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-700/40">AI</span>
                  </span>
                </th>
                <th className="text-left px-5 py-3">Confidence</th>
                <th className="text-left px-5 py-3">Review Status</th>
              </tr>
            </thead>
            <tbody>
              {MODELS.map((model, i) => {
                const data   = results[model.key] ?? mockFallback[model.key];
                const isLive = !!results[model.key];
                return (
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
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                        </svg>
                        Pending review
                        {isLive && <span className="text-green-500 ml-1">· Live</span>}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-800/60 bg-gray-50/50 dark:bg-gray-800/20">
          <p className="text-[10px] text-gray-400 dark:text-gray-500 italic">
            All AI outputs require review by a qualified environmental scientist before being used in official reporting, public disclosure, or field decisions.
          </p>
        </div>
      </div>

      {loading && (
        <p className="text-xs text-gray-400 mt-4 text-center">Fetching live model data…</p>
      )}

      {/* ── Researcher Chatbot ───────────────────────────────────────────────── */}
      <div className="mt-6">
        <ResearcherChatPanel />
      </div>
    </div>
  );
}
