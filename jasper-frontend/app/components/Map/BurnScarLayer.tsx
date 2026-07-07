"use client";

import { useEffect, useState } from "react";
import { HazardZone } from "./HazardZone";
import { fetchChangeDetection, ChangeDetectionResult } from "../../../lib/api";

const CENTER: [number, number] = [52.882, -118.065];
const SECTOR_ID = "ATH-001-A";

export function BurnScarLayer() {
  const [mlData, setMlData] = useState<ChangeDetectionResult | null>(null);

  useEffect(() => {
    fetchChangeDetection(SECTOR_ID).then(setMlData).catch((err) => console.error("BurnScarLayer: change detection failed", err));
  }, []);

  const confidence = mlData
    ? `${(mlData.confidence * 100).toFixed(1)}%`
    : "94.6%";
  const riskLabel = mlData?.risk_label ?? "–";
  const status =
    mlData?.risk_label === "High"
      ? "CRITICAL"
      : mlData?.risk_label === "Medium"
      ? "WARNING"
      : "OPERATIONAL";

  return (
    <HazardZone
      center={CENTER}
      radius={2400}
      borderColor="#ef4444"
      fillColor="#f43f5e"
      fillOpacity={0.1}
      label="Vegetation Index"
      sublabel="Burn Scar Extent"
      badgeIcon="flame"
      badgeBg="#fff1f2"
      dotColor="#ef4444"
      dotPulse
      popupIcon="🔥"
      popupTitle="Post-Wildfire Forestry Analytics"
      status={status}
      name="Forest Segment SEC-V9"
      fields={[
        { label: "Forest Segment ID", value: "SEC-V9" },
        { label: "Crown Scorch", value: "82.4% (Severe)", valueColor: "text-rose-600" },
        { label: "Dead Tree Hazards", value: "412 Standing", valueColor: "text-rose-600" },
        {
          label: "ML Risk Label",
          value: riskLabel,
          valueColor:
            mlData?.risk_label === "High"
              ? "text-rose-600"
              : mlData?.risk_label === "Medium"
              ? "text-amber-600"
              : "text-green-600",
        },
        { label: "Detection Confidence", value: confidence },
        { label: "Drone Coverage", value: "Complete (RPAS-3)", valueColor: "text-green-600" },
      ]}
    />
  );
}
