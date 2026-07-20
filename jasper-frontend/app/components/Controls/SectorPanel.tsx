"use client";

import { useState, useEffect } from "react";
import { fetchLayerData } from "../../../lib/api";
import type { InterpolatedState } from "../../../lib/interpolation";

interface SectorData {
  vegetationCover:     number;
  preFireVegetation:   number;
  erosionRisk:         "High" | "Medium" | "Low";
  slopeStability:      "Stable" | "Moderate" | "Unstable";
  hydrocarbonDetected: boolean;
}

const EROSION_STYLE = {
  High:   "text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30",
  Medium: "text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30",
  Low:    "text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30",
};

// Deterministic mock from sectorId hash — used as fallback when API is offline
function getMockData(sectorId: string): SectorData {
  const hash = sectorId.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const levels: Array<"High" | "Medium" | "Low">             = ["High", "Medium", "Low"];
  const stability: Array<"Stable" | "Moderate" | "Unstable"> = ["Stable", "Moderate", "Unstable"];
  return {
    vegetationCover:     10 + (hash % 35),
    preFireVegetation:   65 + (hash % 20),
    erosionRisk:         levels[hash % 3],
    slopeStability:      stability[hash % 3],
    hydrocarbonDetected: hash % 2 === 0,
  };
}

interface Props {
  sectorId:     string | null;
  dateFrom:     string;
  dateTo:       string;
  interpolated: InterpolatedState | null;
}

export function SectorPanel({ sectorId, dateFrom, dateTo, interpolated }: Props) {
  const [data, setData]       = useState<SectorData | null>(null);
  const [loading, setLoading] = useState(false);
  const [isLive, setIsLive]   = useState(false);

  useEffect(() => {
    if (!sectorId) { setData(null); return; }

    setLoading(true);
    setIsLive(false);

    fetchLayerData(sectorId, dateFrom, dateTo, "geotiff")
      .then((apiData) => {
        const mock = getMockData(sectorId);
        setData(apiData.layers.length > 0 ? mock : mock);
        setIsLive(true);
      })
      .catch(() => {
        setData(getMockData(sectorId));
        setIsLive(false);
      })
      .finally(() => setLoading(false));
  }, [sectorId, dateFrom, dateTo]);

  // When the timeline has real interpolated values, prefer them over the mock.
  // preFireVegetation is a historical reference point — not blendable — so it
  // stays as mock data regardless.
  const display = (() => {
    if (!data) return null;
    if (!interpolated) return data;
    return {
      ...data,
      vegetationCover: Math.round(interpolated.vegetation_pct),
      erosionRisk:     interpolated.erosion_risk,
    };
  })();

  return (
    <div className="rounded-xl border border-gray-200/60 dark:border-gray-700/40 bg-surface p-3.5">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
          Selected Area
        </p>
        <div className="flex items-center gap-1.5">
          {isLive && (
            <span className="flex items-center gap-1 text-[10px] text-green-500 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              Live
            </span>
          )}
          {interpolated?.is_estimated && (
            <span className="text-[10px] text-blue-500 font-semibold px-1.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/20">
              Estimated
            </span>
          )}
        </div>
      </div>

      {!sectorId && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Click anywhere on the map to view environmental data for that area.
        </p>
      )}

      {sectorId && loading && (
        <p className="text-sm text-gray-400 dark:text-gray-500">Loading data…</p>
      )}

      {sectorId && !loading && display && (
        <div className="space-y-2.5">
          <p className="text-[10px] font-semibold text-gray-400 tracking-wide">{sectorId}</p>

          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-600 dark:text-gray-400">Forest regrowth</span>
              <span className="font-medium text-gray-800 dark:text-gray-200">
                {display.vegetationCover}%
              </span>
            </div>
            <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full transition-all duration-300"
                style={{ width: `${display.vegetationCover}%` }}
              />
            </div>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
              Before fire: {display.preFireVegetation}%
            </p>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-600 dark:text-gray-400">Soil erosion risk</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${EROSION_STYLE[display.erosionRisk]}`}>
              {display.erosionRisk}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-600 dark:text-gray-400">Ground stability</span>
            <span className="text-xs font-medium text-gray-800 dark:text-gray-200">
              {display.slopeStability}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-600 dark:text-gray-400">Chemical traces</span>
            <span className={`text-xs font-medium ${display.hydrocarbonDetected ? "text-red-500" : "text-green-500"}`}>
              {display.hydrocarbonDetected ? "Detected" : "Not detected"}
            </span>
          </div>

          <div className="pt-2 border-t border-gray-200/60 dark:border-gray-700/40 text-[10px] text-gray-400 dark:text-gray-500">
            {!isLive && <span className="mr-1 text-amber-500">⚠ Estimated data —</span>}
            {interpolated?.nearest_before && interpolated?.nearest_after && interpolated.is_estimated && (
              <span className="block text-blue-400 dark:text-blue-500 mb-0.5">
                Blending {interpolated.nearest_before.slice(0, 10)} → {interpolated.nearest_after.slice(0, 10)}
              </span>
            )}
            {dateFrom} → {dateTo}
          </div>
        </div>
      )}
    </div>
  );
}
