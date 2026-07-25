"use client";

// PipelineStatusWidget shows the health of the data pipeline that brings
// satellite and IoT sensor readings into the Jasper dashboard.
// It subscribes to Rahil's getPipelineStatus Convex function for live stats.
// If Convex isn't configured yet, it falls back to animated mock data.

import { useEffect, useState, useContext, useCallback } from "react";
import { useQuery } from "convex/react";
import { anyApi } from "convex/server";
import { SyncIcon } from "../Layout/icons";
import { ConvexAvailableContext, ConvexErrorBoundary } from "../Providers/ConvexClientProvider";

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

  // Mock animation — bounces the percentage between 94–100% when Convex isn't set up
  useEffect(() => {
    if (isConvexReady) return;
    const id = setInterval(() => {
      setIngestPct((p) => Math.min(100, Math.max(94, p + (Math.random() > 0.5 ? 1 : -1))));
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
      {isConvexReady && (
        <ConvexErrorBoundary>
          <LivePipelineData onData={handleLiveData} />
        </ConvexErrorBoundary>
      )}

      <div className="flex items-center justify-between mb-3.5">
        <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
          Data Connection
        </p>
        {isConvexReady
          ? <span className="flex items-center gap-1.5 text-xs font-medium text-green-500"><span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />Live</span>
          : <span className="flex items-center gap-1.5 text-xs font-medium text-amber-500"><span className="w-1.5 h-1.5 rounded-full bg-amber-500" />Simulated</span>
        }
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
      <div className="flex items-center justify-between text-xs mb-2">
        <span className="text-gray-700 dark:text-gray-200 font-medium">IoT Jasper-A1</span>
        <span className={`flex items-center gap-1 font-medium transition-colors ${syncing ? "text-amber-400" : "text-sait-sky"}`}>
          <SyncIcon className={`w-3 h-3 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Syncing..." : "Sync"}
        </span>
      </div>

      {/* Sensor health summary row */}
      <div className="pt-2 border-t border-gray-100 dark:border-gray-800 space-y-1.5">
        <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1">Sensor Health</p>
        {[
          { name: "IoT Jasper-A1",    status: isConvexReady ? "Online" : "No link" },
          { name: "Silt Monitor S-2", status: "Online" },
          { name: "Slope Sensor SL-4",status: "Online" },
        ].map(({ name, status }) => {
          const isOnline   = status === "Online";
          const isNoLink   = status === "No link";
          const dot        = isOnline ? "bg-green-500 animate-pulse" : isNoLink ? "bg-amber-500" : "bg-red-500";
          const textColor  = isOnline ? "text-green-500" : isNoLink ? "text-amber-500" : "text-red-500";
          return (
            <div key={name} className="flex items-center justify-between text-[10px]">
              <span className="text-gray-600 dark:text-gray-400">{name}</span>
              <span className={`flex items-center gap-1 font-semibold ${textColor}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
                {status}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
