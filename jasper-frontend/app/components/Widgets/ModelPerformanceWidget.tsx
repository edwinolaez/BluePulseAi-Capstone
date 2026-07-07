"use client";

import { SettingsIcon } from "../Layout/icons";

const MOCK_MODEL = {
  f1Score: 0.884,
  trainingLoss: 0.0032,
  lastUpdate: "2m ago",
};

export function ModelPerformanceWidget() {
  return (
    <div className="rounded-xl border border-gray-200/60 dark:border-gray-700/40 bg-surface p-3.5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          Erosion Model
        </p>
        <SettingsIcon className="w-4 h-4 text-gray-400" />
      </div>

      <p className="text-2xl font-mono font-bold text-cyan-500 leading-none mb-0.5">
        {MOCK_MODEL.f1Score.toFixed(3)}
      </p>
      <p className="text-[11px] text-gray-400 mb-3">F1 Score</p>

      <div className="space-y-1 text-xs text-gray-500 dark:text-gray-400">
        <p>Training Loss: <span className="text-gray-700 dark:text-gray-200 font-medium">{MOCK_MODEL.trainingLoss}</span></p>
        <p>Last Update: <span className="text-gray-700 dark:text-gray-200 font-medium">{MOCK_MODEL.lastUpdate}</span></p>
      </div>
    </div>
  );
}
