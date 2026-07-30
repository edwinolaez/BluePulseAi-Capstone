/**
 * WaterQualityWidget.tsx — Live water turbidity and pH sensor widget.
 *
 * Displays the latest turbidity (NTU) and acidity (pH) readings from the
 * Athabasca watershed sensors, plus a 7-bar sparkline showing recent turbidity history.
 *
 * Live / mock modes:
 *   - Convex configured: LiveWaterData subscribes to getLiveWaterQuality and
 *     pushes new turbidity + pH values up via the onData callback.
 *   - Convex not configured: a setInterval applies small random jitter every
 *     2.5 seconds so the numbers and sparkline stay in motion during demos.
 *
 * The useCallback on handleLiveData is important — without it a new function
 * reference would be created every render, causing LiveWaterData's useEffect
 * to re-fire and potentially create an update loop.
 */
"use client";

import { useEffect, useState, useContext, useCallback } from "react";
import { useQuery } from "convex/react";
import { anyApi } from "convex/server";
import { ConvexAvailableContext, ConvexErrorBoundary } from "../Providers/ConvexClientProvider";

const SPARKLINE_BASE = [38, 52, 30, 70, 48, 55, 42];

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function jitter(v: number, amount: number, min: number, max: number) {
  return clamp(v + (Math.random() - 0.5) * amount, min, max);
}

/**
 * LiveWaterData — inner component that safely calls Convex's useQuery hook.
 *
 * Only rendered inside a ConvexErrorBoundary when ConvexProvider is active.
 * Subscribes to getLiveWaterQuality for sector "sector-1" and pushes new
 * turbidity + pH readings up to the parent widget via onData.
 *
 * @param onData - callback receiving (turbidity, ph) whenever Convex data updates
 */
function LiveWaterData({
  onData,
}: {
  onData: (turbidity: number, ph: number) => void;
}) {
  // Subscribes to Rahil's getLiveWaterQuality function in real time.
  // When the sensor data changes in the database, this component re-renders
  // and pushes the new values up to the parent widget.
  const data = useQuery(anyApi.waterQuality.getLiveWaterQuality, {
    sectorId: "sector-1",
  });

  useEffect(() => {
    if (data && typeof data.turbidity === "number" && typeof data.ph === "number") {
      onData(data.turbidity, data.ph);
    }
  }, [data, onData]);

  return null;
}

/**
 * WaterQualityWidget — sidebar widget displaying turbidity, pH, and a mini sparkline.
 *
 * Conditionally mounts LiveWaterData when Convex is available; otherwise runs
 * the mock jitter animation.  Shows a "Live · Observed" badge when live, or
 * "Simulated" when running in mock mode.
 */
export function WaterQualityWidget() {
  // Check if Convex is ready — set by ConvexClientProvider based on .env.local
  const isConvexReady = useContext(ConvexAvailableContext);

  const [turbidity, setTurbidity] = useState(3.6);
  const [ph, setPh]               = useState(7.21);
  const [sparkline, setSparkline] = useState(SPARKLINE_BASE);

  // Animated mock data — only runs when Convex isn't configured yet.
  // Simulates realistic sensor readings so the widget always looks live.
  useEffect(() => {
    if (isConvexReady) return;
    const id = setInterval(() => {
      setTurbidity((t) => Math.round(jitter(t, 0.4, 1.8, 9.5) * 100) / 100);
      setPh((p)        => Math.round(jitter(p, 0.08, 6.2, 8.4) * 100) / 100);
      setSparkline((s) => {
        const next = [...s.slice(1), clamp(s[s.length - 1] + (Math.random() - 0.5) * 20, 10, 95)];
        return next;
      });
    }, 2500);
    return () => clearInterval(id);
  }, [isConvexReady]);

  // Stable callback — useCallback prevents a new reference on every render,
  // which would cause LiveWaterData's useEffect to re-fire and loop infinitely.
  const handleLiveData = useCallback((t: number, p: number) => {
    setTurbidity(t);
    setPh(p);
    setSparkline((s) => [...s.slice(1), clamp((t / 10) * 95, 10, 95)]);
  }, []);

  const highlightIndex = sparkline.indexOf(Math.max(...sparkline));

  return (
    <div className="rounded-xl border border-gray-200/60 dark:border-gray-700/40 bg-surface p-3.5">
      {/* When Convex URL is set, this sub-component fetches live sensor data */}
      {isConvexReady && (
        <ConvexErrorBoundary>
          <LiveWaterData onData={handleLiveData} />
        </ConvexErrorBoundary>
      )}

      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
          Water Cloudiness
        </p>
        {isConvexReady
          ? <span className="flex items-center gap-1.5 text-[10px] font-semibold text-green-500"><span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />Live · Observed</span>
          : <span className="flex items-center gap-1.5 text-[10px] font-semibold text-amber-500"><span className="w-1.5 h-1.5 rounded-full bg-amber-500" />Simulated</span>
        }
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3.5">
        <div>
          <p className="text-[10px] uppercase text-gray-500 dark:text-gray-400 tracking-wide mb-0.5">Water Cloudiness</p>
          <p className="text-xl font-bold text-gray-900 dark:text-gray-100 tabular-nums">
            {(turbidity ?? 3.6).toFixed(1)}
            <span className="text-xs font-sans font-normal text-gray-400 ml-1">NTU</span>
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase text-gray-500 dark:text-gray-400 tracking-wide mb-0.5">Acidity (pH)</p>
          <p className="text-xl font-bold text-gray-900 dark:text-gray-100 tabular-nums">
            {(ph ?? 7.21).toFixed(2)}
            <span className="text-xs font-sans font-normal text-gray-400 ml-1">pH</span>
          </p>
        </div>
      </div>

      {/* Mini sparkline chart — each bar is a recent turbidity reading */}
      <div className="flex items-end gap-1 h-10">
        {sparkline.map((h, i) => (
          <div
            key={i}
            className={`flex-1 rounded-sm transition-all duration-700 ${
              i === highlightIndex ? "bg-green-500" : "bg-gray-200 dark:bg-gray-700"
            }`}
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
    </div>
  );
}
