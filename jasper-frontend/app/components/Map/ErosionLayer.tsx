"use client";

import { useEffect, useState } from "react";
import { HazardZone } from "./HazardZone";
import { fetchErosionSimulation, ErosionResult } from "../../../lib/api";

const CENTER: [number, number] = [52.858, -118.092];
const SECTOR_ID = "ATH-001-B";

export function ErosionLayer() {
  const [mlData, setMlData] = useState<ErosionResult | null>(null);

  useEffect(() => {
    // 60 mm is typical post-fire rainfall for Jasper watershed
    fetchErosionSimulation(SECTOR_ID, 60).then(setMlData).catch((err) => console.error("ErosionLayer: erosion simulation failed", err));
  }, []);

  const soilLoss = mlData ? `${mlData.soil_loss_t_ha.toFixed(2)} t/ha` : "0.78 t/ha";
  const riskLevel = mlData ? mlData.risk_level : "–";
  const status = mlData?.risk_level === "High" ? "CRITICAL" : "WARNING";

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
          label: "ML Soil Loss",
          value: soilLoss,
          valueColor: mlData?.risk_level === "High" ? "text-red-600" : "text-purple-600",
        },
        { label: "ML Risk Level", value: riskLevel },
        { label: "Soil Moisture", value: "72.1% (Saturated)" },
      ]}
    />
  );
}
