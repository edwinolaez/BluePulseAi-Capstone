"use client";

import { useState } from "react";
import { ClockIcon } from "../Layout/icons";

const PRE_EVENT     = new Date("2024-06-01").getTime();
const RECOVERY      = new Date("2024-09-30").getTime();
const WINDOW_MS     = 14 * 24 * 60 * 60 * 1000;
const DEFAULT_VALUE = 44;

function toFriendlyDate(ms: number) {
  return new Date(ms).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function sliderToCenter(value: number) {
  return PRE_EVENT + (value / 100) * (RECOVERY - PRE_EVENT);
}

interface Props {
  onDateRangeChange: (dateFrom: string, dateTo: string, centerDate: string) => void;
}

function toISODate(ms: number) {
  return new Date(ms).toISOString().split("T")[0];
}

// TemporalSlider.tsx — The Time Slider at the Bottom of the Map
//
// This component is the horizontal slider bar that sits at the bottom of the map.
// It lets the user move through the Jasper wildfire timeline —
// from before the fire started in June 2024 all the way to the recovery period in September 2024.
//
// How it works:
//   - The slider goes from 0 to 100 (like a percentage)
//   - As you drag it, it converts that number into a real calendar date
//   - It calculates a 14-day window around the selected date (7 days before and after)
//   - It passes that date range up to MapViewPage using the onDateRangeChange function
//   - MapViewPage then shares that date with the rest of the dashboard
//
// The default position (44%) puts the slider just after the fire started —
// so the first thing users see is the damage, not the before state.
export function TemporalSlider({ onDateRangeChange }: Props) {
  const [value, setValue] = useState(DEFAULT_VALUE);
  const center = sliderToCenter(value);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = Number(e.target.value);
    setValue(v);
    const c = sliderToCenter(v);
    onDateRangeChange(
      toISODate(Math.max(c - WINDOW_MS / 2, PRE_EVENT)),
      toISODate(Math.min(c + WINDOW_MS / 2, RECOVERY)),
      toISODate(c),
    );
  }

  return (
    <div className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-md rounded-2xl shadow-2xl border border-gray-200/60 dark:border-gray-700/40 px-3 sm:px-6 py-3 sm:py-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 shrink-0">
          <ClockIcon className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          <h2 className="text-sm font-bold text-gray-800 dark:text-gray-100">Time History</h2>
        </div>
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-600 text-white whitespace-nowrap shrink-0 max-w-[140px] truncate">
          {toFriendlyDate(center)}
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
        <span>Pre-Fire</span>
        <span>Recovery</span>
      </div>
    </div>
  );
}
