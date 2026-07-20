"use client";

// PipelineStatusWidget shows the health of the data pipeline that brings
// satellite and IoT sensor readings into the Jasper dashboard.
// It subscribes to Rahil's getPipelineStatus Convex function for live stats.
// If Convex isn't configured yet, it falls back to animated mock data.

import { useEffect, useState, useContext, useCallback } from "react";
import { useQuery } from "convex/react";
import { anyApi } from "convex/server";
import { SyncIcon } from "../Layout/icons";
import { ConvexAvailableContext } from "../Providers/ConvexClientProvider";

// Inner component that calls useQuery — only mounted when ConvexProvider is active
function LivePipelineData({
  onData,
}: {
  onData: (ingestPct: number) => void;
}) {
  // Subscribes to Rahil's getPipelineStatus function.
  // Returns the current satellite ingest percentage and IoT sync status.
  const data = useQuery(anyApi.pipeline.getPipelineStatus, {});

  useEffect(() => {
    if (data) {
      onData(data.ingestPct as number);
    }
  }, [data, onData]);

  return null;
}

export function PipelineStatusWidget() {
  const isConvexReady = useContext(ConvexAvailableContext);

  const [ingestPct, setIngestPct] = useState(98);
  const [syncing, setSyncing]     = useState(false);

  // Always animate the sync pulse so the widget feels live.
  // Only update the percentage number when Convex isn't connected.
  useEffect(() => {
    const id = setInterval(() => {
      if (!isConvexReady) {
        setIngestPct((p) => Math.min(100, Math.max(94, p + (Math.random() > 0.5 ? 1 : -1))));
      }
      setSyncing(true);
      setTimeout(() => setSyncing(false), 800);
    }, 4000);
    return () => clearInterval(id);
  }, [isConvexReady]);

  const handleLiveData = useCallback((pct: number) => {
    setIngestPct(pct);
    setSyncing(true);
    setTimeout(() => setSyncing(false), 800);
  }, []);

  return (
    <div className="rounded-xl border border-gray-200/60 dark:border-gray-700/40 bg-surface p-3.5">
      {isConvexReady && <LivePipelineData onData={handleLiveData} />}

      <div className="flex items-center justify-between mb-3.5">
        <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
          Data Connection
        </p>
        <span className="flex items-center gap-1.5 text-xs font-medium text-green-500">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          Active
        </span>
      </div>

      {/* Progress bar showing how much of the satellite data has been ingested */}
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

      {/* IoT sync row — spins the icon briefly each time new data arrives */}
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
