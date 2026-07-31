/**
 * ModelPerformanceWidget.tsx — ML model accuracy display widget.
 *
 * Shows the F1 score and training loss of the currently deployed ML model.
 * Subscribes to Rahil's getModelMetadata Convex function for live values.
 *
 * Live / mock modes:
 *   - Convex configured: LiveModelData sub-component calls useQuery and pushes
 *     real values up via the onData callback.
 *   - Convex not configured: a setInterval gently varies the F1 score and loss
 *     every 6 seconds so the widget still looks active during demos.
 *
 * A "last updated" counter ticks up every second.  It resets to 0 whenever
 * new data arrives (either from Convex or the mock animation).
 */
"use client";

import { useEffect, useState, useContext, useCallback } from "react";
import { useQuery } from "convex/react";
import { anyApi } from "convex/server";
import { SettingsIcon } from "../Layout/icons";
import { ConvexAvailableContext, ConvexErrorBoundary } from "../Providers/ConvexClientProvider";

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

/**
 * LiveModelData — inner component that safely calls Convex's useQuery hook.
 *
 * Only mounted inside a ConvexErrorBoundary when ConvexProvider is active,
 * so useQuery is never called outside its required provider context.
 * Pushes new F1 score and training loss values up to the parent via onData.
 *
 * @param onData - callback receiving (f1Score, trainingLoss) when Convex data updates
 */
function LiveModelData({
  onData,
}: {
  onData: (f1Score: number, trainingLoss: number) => void;
}) {
  // Subscribes to Rahil's getModelMetadata function.
  // Returns the deployed model's current accuracy score and training loss.
  const data = useQuery(anyApi.models.getModelMetadata, {});

  useEffect(() => {
    const value = data?.value as Record<string, unknown> | undefined;
    if (value?.f1Score !== undefined) {
      onData(value.f1Score as number, (value.trainingLoss as number) ?? 0.0032);
    }
  }, [data, onData]);

  return null;
}

/**
 * ModelPerformanceWidget — sidebar widget displaying ML model accuracy metrics.
 *
 * Conditionally mounts LiveModelData when Convex is available, otherwise runs
 * the mock animation.  Renders the F1 score, training loss, and a "last updated"
 * counter that increments every second.
 */
/** Isolated ticker — owns its own secondsAgo state so its 1s re-renders stay local. */
function AgeDisplay({ resetSignal }: { resetSignal: number }) {
  const [secondsAgo, setSecondsAgo] = useState(0);

  useEffect(() => {
    setSecondsAgo(0);
  }, [resetSignal]);

  useEffect(() => {
    const id = setInterval(() => setSecondsAgo((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const label =
    secondsAgo < 60   ? `${secondsAgo}s ago`
    : secondsAgo < 3600 ? `${Math.floor(secondsAgo / 60)}m ago`
    : `${Math.floor(secondsAgo / 3600)}h ago`;

  return <span className="text-gray-700 dark:text-gray-200 font-medium">{label}</span>;
}

export function ModelPerformanceWidget() {
  const isConvexReady = useContext(ConvexAvailableContext);

  const [f1Score, setF1Score]          = useState(0.884);
  const [trainingLoss, setTrainingLoss] = useState(0.0032);
  const [resetSignal, setResetSignal]  = useState(0);

  // Mock data animation — gently varies F1 and loss when Convex isn't set up
  useEffect(() => {
    if (isConvexReady) return;
    const updater = setInterval(() => {
      setF1Score((f) => Math.round(clamp(f + (Math.random() - 0.5) * 0.008, 0.84, 0.96) * 1000) / 1000);
      setTrainingLoss((l) => Math.round(clamp(l + (Math.random() - 0.5) * 0.0004, 0.001, 0.008) * 10000) / 10000);
      setResetSignal((n) => n + 1);
    }, 6000);
    return () => clearInterval(updater);
  }, [isConvexReady]);

  const handleLiveData = useCallback((f1: number, loss: number) => {
    setF1Score(f1);
    setTrainingLoss(loss);
    setResetSignal((n) => n + 1);
  }, []);

  return (
    <div className="rounded-xl border border-gray-200/60 dark:border-gray-700/40 bg-surface p-3.5">
      {isConvexReady && (
        <ConvexErrorBoundary>
          <LiveModelData onData={handleLiveData} />
        </ConvexErrorBoundary>
      )}

      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
          Prediction Accuracy
        </p>
        <SettingsIcon className="w-4 h-4 text-gray-400" />
      </div>

      {/* F1 Score — a number from 0 to 1 measuring how accurate the model's predictions are.
          Closer to 1 is better. Our model targets above 0.84. */}
      <p className="text-2xl font-bold text-sait-sky leading-none mb-0.5 tabular-nums transition-all duration-500">
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
          Last Update: <AgeDisplay resetSignal={resetSignal} />
        </p>
      </div>
    </div>
  );
}
