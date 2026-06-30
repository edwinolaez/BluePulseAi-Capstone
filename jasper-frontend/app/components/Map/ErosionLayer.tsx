"use client";

import { useEffect, useState } from "react";
import { HazardZone } from "./HazardZone";
import { fetchErosionSimulation, ModelOutput } from "../../../lib/api";

const CENTER: [number, number] = [52.858, -118.092];
const SECTOR_ID = "ATH-001-B";

export function ErosionLayer() {
  const [mlData, setMlData] = useState<ModelOutput | null>(null);

  useEffect(() => {
    // 38.5° matches observed SEC-E1 slope; 60 mm is typical post-fire rainfall
    fetchErosionSimulation(SECTOR_ID, 38.5, 60).then(setMlData).catch(() => null);
  }, []);

  const riskScore = mlData ? `${mlData.risk_score.toFixed(2)} / 1.00` : "0.78 / 1.00";
  const riskLabel = mlData ? mlData.risk_label : "–";
  const status =
    mlData?.risk_label === "High" ? "CRITICAL" : "WARNING";

  return (
    <HazardZone
      center={CENTER}
      radius={1400}
      borderColor="#a855f7"
      fillColor="#c084fc"
      fillOpacity={0.15}
      label="Erosion Hazard"
      sublabel="High Stream Slurry"
      badgeIcon="mountain"
      dotColor="#ef4444"
      popupIcon="⛰️"
      popupTitle="Slope Erosion Analytics"
      status={status}
      name="Slope Sector SEC-E1"
      fields={[
        { label: "Slope Sector ID", value: "SEC-E1" },
        { label: "Slope Angle", value: "38.5° (Steep)", valueColor: "text-purple-600" },
        { label: "LiDAR Terrain Drift", value: "-12.4 cm (Slipped)", valueColor: "text-red-600" },
        {
          label: "ML Erosion Index",
          value: riskScore,
          valueColor:
            mlData?.risk_label === "High" ? "text-red-600" : "text-purple-600",
        },
        { label: "ML Risk Label", value: riskLabel },
        { label: "Soil Moisture", value: "72.1% (Saturated)" },
      ]}
    />
  );
}
