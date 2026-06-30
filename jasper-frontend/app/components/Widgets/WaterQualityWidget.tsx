"use client";

import { useEffect, useState } from "react";

const SPARKLINE_BASE = [38, 52, 30, 70, 48, 55, 42];

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function jitter(v: number, amount: number, min: number, max: number) {
  return clamp(v + (Math.random() - 0.5) * amount, min, max);
}

export function WaterQualityWidget() {
  const [turbidity, setTurbidity] = useState(3.6);
  const [ph, setPh]               = useState(7.21);
  const [sparkline, setSparkline] = useState(SPARKLINE_BASE);

  useEffect(() => {
    const id = setInterval(() => {
      setTurbidity((t) => Math.round(jitter(t, 0.4, 1.8, 9.5) * 100) / 100);
      setPh((p)        => Math.round(jitter(p, 0.08, 6.2, 8.4) * 100) / 100);
      setSparkline((s) => {
        const next = [...s.slice(1), clamp(s[s.length - 1] + (Math.random() - 0.5) * 20, 10, 95)];
        return next;
      });
    }, 2500);
    return () => clearInterval(id);
  }, []);

  const highlightIndex = sparkline.indexOf(Math.max(...sparkline));

  return (
    <div className="rounded-xl border border-gray-200/60 dark:border-gray-700/40 bg-surface p-3.5">
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
