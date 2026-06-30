"use client";

import { useEffect, useState } from "react";
import { SyncIcon } from "../Layout/icons";

export function PipelineStatusWidget() {
  const [ingestPct, setIngestPct] = useState(98);
  const [syncing, setSyncing]     = useState(false);

  useEffect(() => {
    const id = setInterval(() => {
      setIngestPct((p) => Math.min(100, Math.max(94, p + (Math.random() > 0.5 ? 1 : -1))));
      setSyncing(true);
      setTimeout(() => setSyncing(false), 800);
    }, 4000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="rounded-xl border border-gray-200/60 dark:border-gray-700/40 bg-surface p-3.5">
      <div className="flex items-center justify-between mb-3.5">
        <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
          Data Connection
        </p>
        <span className="flex items-center gap-1.5 text-xs font-medium text-green-500">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          Active
        </span>
      </div>

      <div className="mb-3">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-gray-700 dark:text-gray-200 font-medium">Satellite Updates</span>
          <span className="text-gray-600 dark:text-gray-400 tabular-nums">{ingestPct}%</span>
        </div>
        <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 rounded-full transition-all duration-700"
            style={{ width: `${ingestPct}%` }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-700 dark:text-gray-200 font-medium">IoT Jasper-A1</span>
        <span className={`flex items-center gap-1 font-medium transition-colors ${syncing ? "text-amber-400" : "text-cyan-500"}`}>
          <SyncIcon className={`w-3 h-3 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Syncing..." : "Sync"}
        </span>
      </div>
    </div>
  );
}
