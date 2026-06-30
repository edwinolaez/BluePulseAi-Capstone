"use client";

import { useEffect, useState } from "react";
import { SettingsIcon } from "../Layout/icons";

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

export function ModelPerformanceWidget() {
  const [f1Score, setF1Score]         = useState(0.884);
  const [trainingLoss, setTrainingLoss] = useState(0.0032);
  const [secondsAgo, setSecondsAgo]   = useState(0);

  useEffect(() => {
    const ticker = setInterval(() => setSecondsAgo((s) => s + 1), 1000);
    const updater = setInterval(() => {
      setF1Score((f) => Math.round(clamp(f + (Math.random() - 0.5) * 0.008, 0.84, 0.96) * 1000) / 1000);
      setTrainingLoss((l) => Math.round(clamp(l + (Math.random() - 0.5) * 0.0004, 0.001, 0.008) * 10000) / 10000);
      setSecondsAgo(0);
    }, 6000);
    return () => { clearInterval(ticker); clearInterval(updater); };
  }, []);

  function formatAge(s: number) {
    if (s < 60)  return `${s}s ago`;
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    return `${Math.floor(s / 3600)}h ago`;
  }

  return (
    <div className="rounded-xl border border-gray-200/60 dark:border-gray-700/40 bg-surface p-3.5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
          Prediction Accuracy
        </p>
        <SettingsIcon className="w-4 h-4 text-gray-400" />
      </div>

      <p className="text-2xl font-bold text-cyan-500 leading-none mb-0.5 tabular-nums transition-all duration-500">
        {f1Score.toFixed(3)}
      </p>
      <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-3">Accuracy Score</p>

      <div className="space-y-1 text-xs text-gray-500 dark:text-gray-400">
        <p>
          Training Loss:{" "}
          <span className="text-gray-700 dark:text-gray-200 font-medium tabular-nums transition-all duration-500">
            {trainingLoss.toFixed(4)}
          </span>
        </p>
        <p>
          Last Update:{" "}
          <span className="text-gray-700 dark:text-gray-200 font-medium">{formatAge(secondsAgo)}</span>
        </p>
      </div>
    </div>
  );
}
