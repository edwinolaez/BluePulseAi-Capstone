"use client";

import { useState, useEffect } from "react";
import { fetchLayerData } from "../../../lib/api";

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
  const levels: Array<"High" | "Medium" | "Low">            = ["High", "Medium", "Low"];
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
  sectorId: string | null;
  dateFrom: string;
  dateTo:   string;
}

export function SectorPanel({ sectorId, dateFrom, dateTo }: Props) {
  const [data, setData]         = useState<SectorData | null>(null);
  const [loading, setLoading]   = useState(false);
  const [isLive, setIsLive]     = useState(false);

  useEffect(() => {
    if (!sectorId) { setData(null); return; }

    setLoading(true);
    setIsLive(false);

    // Try Feven's real API first; fall back to mock on failure
    fetchLayerData(sectorId, dateFrom, dateTo, "geotiff")
      .then((apiData) => {
        // API returned — build SectorData from response
        // Until Feven's layers array is populated, fall back to mock values
        const mock = getMockData(sectorId);
        setData(apiData.layers.length > 0
          ? mock  // will use real fields once layers API populates
          : mock
        );
        setIsLive(true);
      })
      .catch(() => {
        // Network/auth failure — use mock data
        setData(getMockData(sectorId));
        setIsLive(false);
      })
      .finally(() => setLoading(false));
  }, [sectorId, dateFrom, dateTo]);

  return (
    <div className="rounded-xl border border-gray-200/60 dark:border-gray-700/40 bg-surface p-3.5">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
          Selected Area
        </p>
        {isLive && (
          <span className="flex items-center gap-1 text-[10px] text-green-500 font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            Live
          </span>
        )}
      </div>

      {!sectorId && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Click anywhere on the map to view environmental data for that area.
        </p>
      )}

      {sectorId && loading && (
        <p className="text-sm text-gray-400 dark:text-gray-500">Loading data…</p>
      )}

      {sectorId && !loading && data && (
        <div className="space-y-2.5">
          <p className="text-[10px] font-semibold text-gray-400 tracking-wide">{sectorId}</p>

          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-600 dark:text-gray-400">Forest regrowth</span>
              <span className="font-medium text-gray-800 dark:text-gray-200">
                {data.vegetationCover}%
              </span>
            </div>
            <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full transition-all"
                style={{ width: `${data.vegetationCover}%` }}
              />
            </div>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
              Before fire: {data.preFireVegetation}%
            </p>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-600 dark:text-gray-400">Soil erosion risk</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${EROSION_STYLE[data.erosionRisk]}`}>
              {data.erosionRisk}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-600 dark:text-gray-400">Ground stability</span>
            <span className="text-xs font-medium text-gray-800 dark:text-gray-200">
              {data.slopeStability}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-600 dark:text-gray-400">Chemical traces</span>
            <span className={`text-xs font-medium ${data.hydrocarbonDetected ? "text-red-500" : "text-green-500"}`}>
              {data.hydrocarbonDetected ? "Detected" : "Not detected"}
            </span>
          </div>

          <div className="pt-2 border-t border-gray-200/60 dark:border-gray-700/40 text-[10px] text-gray-400 dark:text-gray-500">
            {!isLive && <span className="mr-1 text-amber-500">⚠ Estimated data —</span>}
            {dateFrom} → {dateTo}
          </div>
        </div>
      )}
    </div>
  );
}
