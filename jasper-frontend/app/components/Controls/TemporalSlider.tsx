"use client";

import { useState } from "react";
import { ClockIcon } from "../Layout/icons";

const PRE_EVENT   = new Date("2024-06-01").getTime();
const RECOVERY    = new Date("2024-09-30").getTime();
const FIRE_EVENT  = new Date("2024-07-04").getTime();
const WINDOW_MS   = 14 * 24 * 60 * 60 * 1000;
const DEFAULT_VALUE = 44;

const FIRE_PCT       = ((FIRE_EVENT  - PRE_EVENT) / (RECOVERY - PRE_EVENT)) * 100;
const MONITORING_PCT = ((new Date("2024-08-01").getTime() - PRE_EVENT) / (RECOVERY - PRE_EVENT)) * 100;

function toFriendlyDate(ms: number) {
  return new Date(ms).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function sliderToCenter(value: number) {
  return PRE_EVENT + (value / 100) * (RECOVERY - PRE_EVENT);
}

function getPhaseLabel(value: number) {
  if (value < FIRE_PCT)       return "Before the Fire";
  if (value < MONITORING_PCT) return "Immediately After";
  return "Current Recovery";
}

interface Props {
  onDateRangeChange: (dateFrom: string, dateTo: string) => void;
}

function toISODate(ms: number) {
  return new Date(ms).toISOString().split("T")[0];
}

export function TemporalSlider({ onDateRangeChange }: Props) {
  const [value, setValue] = useState(DEFAULT_VALUE);
  const center = sliderToCenter(value);
  const phase  = getPhaseLabel(value);

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
    <div className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-md rounded-2xl shadow-2xl border border-gray-200/60 dark:border-gray-700/40 px-3 sm:px-6 py-3 sm:py-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 shrink-0">
          <ClockIcon className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          <h2 className="text-sm font-bold text-gray-800 dark:text-gray-100">Time History</h2>
        </div>
        {/* On mobile only show the date; on sm+ show "Phase — Date" */}
        <span className="text-[10px] sm:text-xs font-semibold px-2 py-0.5 sm:px-3 sm:py-1 rounded-full bg-blue-600 text-white whitespace-nowrap shrink-0">
          <span className="hidden sm:inline">{phase} — </span>{toFriendlyDate(center)}
        </span>
      </div>

      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={handleChange}
        className="w-full accent-blue-500 cursor-pointer"
      />

      <div className="flex justify-between text-[10px] font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-500 mt-2">
        <span>
          <span className="hidden sm:inline">Before the Fire (Jun 2024)</span>
          <span className="sm:hidden">Pre-Fire</span>
        </span>
        <span>
          <span className="hidden sm:inline">Current Recovery</span>
          <span className="sm:hidden">Recovery</span>
        </span>
      </div>
    </div>
  );
}
