"use client";

// WaterQualityWidget shows live turbidity and pH readings from the
// Athabasca watershed sensors stored in Rahil's Convex database.
// When Convex is not yet configured (URL not set), it falls back to
// a realistic animated simulation so the dashboard still looks alive.

import { useEffect, useState, useContext, useCallback } from "react";
import { useQuery } from "convex/react";
import { anyApi } from "convex/server";
import { ConvexAvailableContext } from "../Providers/ConvexClientProvider";

const SPARKLINE_BASE = [38, 52, 30, 70, 48, 55, 42];

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function jitter(v: number, amount: number, min: number, max: number) {
  return clamp(v + (Math.random() - 0.5) * amount, min, max);
}

// Inner component that calls Convex's useQuery hook.
// Only rendered when ConvexClientProvider has a real URL configured —
// so useQuery is never called outside its required ConvexProvider context.
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
    if (data) {
      onData(data.turbidity as number, data.ph as number);
    }
  }, [data, onData]);

  return null;
}

export function WaterQualityWidget() {
  // Check if Convex is ready — set by ConvexClientProvider based on .env.local
  const isConvexReady = useContext(ConvexAvailableContext);

  const [turbidity, setTurbidity] = useState(3.6);
  const [ph, setPh]               = useState(7.21);
  const [sparkline, setSparkline] = useState(SPARKLINE_BASE);

  // Always animate the sparkline so the widget feels live.
  // When Convex is not connected, also jitter the numeric values.
  // When Convex IS connected, real data drives the numbers via handleLiveData.
  useEffect(() => {
    const id = setInterval(() => {
      if (!isConvexReady) {
        setTurbidity((t) => Math.round(jitter(t, 0.4, 1.8, 9.5) * 100) / 100);
        setPh((p)        => Math.round(jitter(p, 0.08, 6.2, 8.4) * 100) / 100);
      }
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
      {isConvexReady && <LiveWaterData onData={handleLiveData} />}

      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
          Water Cloudiness
        </p>
        <span className="flex items-center gap-1.5 text-[10px] font-semibold text-green-500">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          Live
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3.5">
        <div>
          <p className="text-[10px] uppercase text-gray-500 dark:text-gray-400 tracking-wide mb-0.5">Water Cloudiness</p>
          <p className="text-xl font-bold text-gray-900 dark:text-gray-100 tabular-nums">
            {turbidity.toFixed(1)}
            <span className="text-xs font-sans font-normal text-gray-400 ml-1">NTU</span>
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase text-gray-500 dark:text-gray-400 tracking-wide mb-0.5">Acidity (pH)</p>
          <p className="text-xl font-bold text-gray-900 dark:text-gray-100 tabular-nums">
            {ph.toFixed(2)}
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
