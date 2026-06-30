"use client";

import { useState, useEffect } from "react";

interface SectorData {
  vegetationCover: number;
  preFireVegetation: number;
  erosionRisk: "High" | "Medium" | "Low";
  slopeStability: "Stable" | "Moderate" | "Unstable";
  hydrocarbonDetected: boolean;
  lastUpdated: string;
}

const EROSION_STYLE = {
  High: "text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30",
  Medium: "text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30",
  Low: "text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30",
};

function getMockData(sectorId: string): SectorData {
  const hash = sectorId.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const erosionLevels: Array<"High" | "Medium" | "Low"> = ["High", "Medium", "Low"];
  const stability: Array<"Stable" | "Moderate" | "Unstable"> = ["Stable", "Moderate", "Unstable"];
  return {
    vegetationCover: 10 + (hash % 35),
    preFireVegetation: 65 + (hash % 20),
    erosionRisk: erosionLevels[hash % 3],
    slopeStability: stability[hash % 3],
    hydrocarbonDetected: hash % 2 === 0,
    lastUpdated: "2023-09-15",
  };
}

interface Props {
  sectorId: string | null;
  dateFrom: string;
  dateTo: string;
}

export function SectorPanel({ sectorId, dateFrom, dateTo }: Props) {
  const [data, setData] = useState<SectorData | null>(null);

  useEffect(() => {
    if (!sectorId) { setData(null); return; }
    const t = setTimeout(() => setData(getMockData(sectorId)), 300);
    return () => clearTimeout(t);
  }, [sectorId]);

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-3">
      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
        Sector Data
      </p>

      {!sectorId && (
        <p className="text-sm text-gray-400 dark:text-gray-500">
          Click a sector on the map to view environmental data.
        </p>
      )}

      {sectorId && !data && (
        <p className="text-sm text-gray-400 dark:text-gray-500">Loading...</p>
      )}

      {sectorId && data && (
        <div className="space-y-2.5">
          <p className="text-xs font-mono text-gray-400 dark:text-gray-500">{sectorId}</p>

          {/* Vegetation cover bar */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-500 dark:text-gray-400">Vegetation cover</span>
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
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              Pre-fire: {data.preFireVegetation}%
            </p>
          </div>

          {/* Erosion risk */}
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-500 dark:text-gray-400">Erosion risk</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${EROSION_STYLE[data.erosionRisk]}`}>
              {data.erosionRisk}
            </span>
          </div>

          {/* Slope stability */}
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-500 dark:text-gray-400">Slope stability</span>
            <span className="text-xs font-medium text-gray-800 dark:text-gray-200">
              {data.slopeStability}
            </span>
          </div>

          {/* Hydrocarbon */}
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-500 dark:text-gray-400">Hydrocarbon</span>
            <span className={`text-xs font-medium ${data.hydrocarbonDetected ? "text-red-500" : "text-green-500"}`}>
              {data.hydrocarbonDetected ? "Detected" : "Not detected"}
            </span>
          </div>

          <div className="pt-2 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-400 dark:text-gray-500">
            {dateFrom} → {dateTo}
          </div>
        </div>
      )}
    </div>
  );
}