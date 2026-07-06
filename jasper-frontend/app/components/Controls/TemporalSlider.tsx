"use client";

import { useState } from "react";
import { ClockIcon } from "../Layout/icons";

const PRE_EVENT = new Date("2024-06-01").getTime();
const RECOVERY = new Date("2024-09-30").getTime();
const FIRE_EVENT = new Date("2024-07-04").getTime();
const WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
const DEFAULT_VALUE = 44;

function toISODate(ms: number) {
  return new Date(ms).toISOString().split("T")[0];
}

function sliderToCenter(value: number) {
  return PRE_EVENT + (value / 100) * (RECOVERY - PRE_EVENT);
}

const FIRE_PCT = ((FIRE_EVENT - PRE_EVENT) / (RECOVERY - PRE_EVENT)) * 100;

interface Props {
  onDateRangeChange: (dateFrom: string, dateTo: string) => void;
}

export function TemporalSlider({ onDateRangeChange }: Props) {
  const [value, setValue] = useState(DEFAULT_VALUE);
  const center = sliderToCenter(value);
  const isPostFire = value >= FIRE_PCT;

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = Number(e.target.value);
    setValue(v);
    const c = sliderToCenter(v);
    onDateRangeChange(
      toISODate(Math.max(c - WINDOW_MS / 2, PRE_EVENT)),
      toISODate(Math.min(c + WINDOW_MS / 2, RECOVERY)),
    );
  }

  return (
    <div className="bg-white/95 dark:bg-surface-container/95 backdrop-blur-md rounded-2xl border border-gray-200/60 dark:border-gray-700/40 shadow-xl px-6 py-3.5">
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <ClockIcon className="w-4 h-4 text-gray-700 dark:text-gray-200" />
          <h2 className="text-sm font-bold text-gray-800 dark:text-gray-100">Temporal Analysis</h2>
        </div>
        <span className="text-xs font-mono font-medium px-2.5 py-1 rounded-md bg-gray-900 dark:bg-gray-700 text-white">
          {toISODate(center)} ({isPostFire ? "Post-Fire" : "Pre-Fire"})
        </span>
      </div>

      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={handleChange}
        className="w-full accent-blue-500"
      />

      <div className="flex justify-between text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mt-1.5">
        <span>Pre-Event (Jun 2024)</span>
        <span>Monitoring Recovery</span>
      </div>
    </div>
  );
}
