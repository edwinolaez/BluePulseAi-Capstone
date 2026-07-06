"use client";

import { SyncIcon } from "../Layout/icons";

const MOCK_PIPELINE = {
  sentinelIngestPct: 98,
  iotStatus: "Sync",
};

export function PipelineStatusWidget() {
  return (
    <div className="rounded-xl border border-gray-200/60 dark:border-gray-700/40 bg-surface p-3.5">
      <div className="flex items-center justify-between mb-3.5">
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          Pipeline Ingest
        </p>
        <span className="flex items-center gap-1.5 text-xs font-medium text-green-500">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
          Active
        </span>
      </div>

      <div className="mb-3">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-gray-700 dark:text-gray-200 font-medium">Sentinel-2 Ingest</span>
          <span className="text-gray-500 dark:text-gray-400">{MOCK_PIPELINE.sentinelIngestPct}%</span>
        </div>
        <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 rounded-full transition-all"
            style={{ width: `${MOCK_PIPELINE.sentinelIngestPct}%` }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-700 dark:text-gray-200 font-medium">IoT Jasper-A1</span>
        <span className="flex items-center gap-1 text-cyan-500 font-medium">
          <SyncIcon className="w-3 h-3" />
          {MOCK_PIPELINE.iotStatus}
        </span>
      </div>
    </div>
  );
}
