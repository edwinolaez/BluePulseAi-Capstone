"use client";

// ModelPerformanceWidget shows how accurate the ML model predictions are.
// It polls Rahil's getModelMetadata Convex function to get the latest
// F1 score and training loss from whichever model is currently deployed.
// Falls back to animated mock data when Convex isn't configured yet.

import { useEffect, useState, useContext, useCallback } from "react";
import { useQuery } from "convex/react";
import { anyApi } from "convex/server";
import { SettingsIcon } from "../Layout/icons";
import { ConvexAvailableContext } from "../Providers/ConvexClientProvider";

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

// Inner component that calls useQuery — only mounted when ConvexProvider is active
function LiveModelData({
  onData,
}: {
  onData: (f1Score: number, trainingLoss: number) => void;
}) {
  // Subscribes to Rahil's getModelMetadata function.
  // Returns the deployed model's current accuracy score and training loss.
  const data = useQuery(anyApi.modelMetadata.getModelMetadata, {});

  useEffect(() => {
    if (data) {
      onData(data.f1Score as number, data.trainingLoss as number);
    }
  }, [data, onData]);

  return null;
}

export function ModelPerformanceWidget() {
  const isConvexReady = useContext(ConvexAvailableContext);

  const [f1Score, setF1Score]          = useState(0.884);
  const [trainingLoss, setTrainingLoss] = useState(0.0032);
  const [secondsAgo, setSecondsAgo]    = useState(0);

  // Clock that ticks up every second to show time since last model update
  useEffect(() => {
    const ticker = setInterval(() => setSecondsAgo((s) => s + 1), 1000);
    return () => clearInterval(ticker);
  }, []);

  // Mock data animation — gently varies F1 and loss when Convex isn't set up
  useEffect(() => {
    if (isConvexReady) return;
    const updater = setInterval(() => {
      setF1Score((f) => Math.round(clamp(f + (Math.random() - 0.5) * 0.008, 0.84, 0.96) * 1000) / 1000);
      setTrainingLoss((l) => Math.round(clamp(l + (Math.random() - 0.5) * 0.0004, 0.001, 0.008) * 10000) / 10000);
      setSecondsAgo(0);
    }, 6000);
    return () => clearInterval(updater);
  }, [isConvexReady]);

  const handleLiveData = useCallback((f1: number, loss: number) => {
    setF1Score(f1);
    setTrainingLoss(loss);
    setSecondsAgo(0);
  }, []);

  function formatAge(s: number) {
    if (s < 60)   return `${s}s ago`;
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    return `${Math.floor(s / 3600)}h ago`;
  }

  return (
    <div className="rounded-xl border border-gray-200/60 dark:border-gray-700/40 bg-surface p-3.5">
      {isConvexReady && <LiveModelData onData={handleLiveData} />}

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
          Last Update:{" "}
          <span className="text-gray-700 dark:text-gray-200 font-medium">{formatAge(secondsAgo)}</span>
        </p>
      </div>
    </div>
  );
}
