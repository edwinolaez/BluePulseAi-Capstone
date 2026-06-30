"use client";

import { useEffect, useState } from "react";
import { fetchChangeDetection, ModelOutput } from "../../../lib/api";
import { HazardZone } from "./HazardZone";

const DEFAULT_SECTOR = "ATH-001-A";
const CENTER: [number, number] = [52.882, -118.065];

// Risk label → visual style
const RISK_STYLE = {
  High:   { borderColor: "#ef4444", fillColor: "#f43f5e", badge: "text-red-500" },
  Medium: { borderColor: "#f59e0b", fillColor: "#fbbf24", badge: "text-amber-500" },
  Low:    { borderColor: "#22c55e", fillColor: "#4ade80", badge: "text-green-500" },
} as const;

export function BurnScarLayer() {
  const [result, setResult] = useState<ModelOutput | null>(null);

  useEffect(() => {
    fetchChangeDetection(DEFAULT_SECTOR)
      .then(setResult)
      .catch(() => setResult(null)); // fall back to default colours
  }, []);

  const risk = result?.risk_label ?? "High";
  const style = RISK_STYLE[risk as keyof typeof RISK_STYLE] ?? RISK_STYLE.High;
  const confidence = result ? ` (${(result.confidence * 100).toFixed(0)}% confidence)` : "";

  return (
    <HazardZone
      center={CENTER}
      radius={2400}
      borderColor={style.borderColor}
      fillColor={style.fillColor}
      fillOpacity={0.1}
      label="Forest Regrowth Monitor"
      sublabel={`Burn Area · ${risk} Risk`}
      badgeIcon="flame"
      badgeBg="#fff1f2"
      dotColor="#ef4444"
      dotPulse
      popupIcon="🌲"
      popupTitle="Forest Regrowth Status"
      status={risk === "High" ? "CRITICAL" : risk === "Medium" ? "WARNING" : "OPERATIONAL"}
      name="Forest Area SEC-V9"
      fields={[
        { label: "Area ID", value: "SEC-V9" },
        { label: "Risk Level", value: risk + confidence, valueColor: style.badge },
        { label: "Risk Score", value: result ? result.risk_score.toFixed(3) : "—" },
        { label: "Trees Damaged", value: "82.4% (Severe)", valueColor: "text-rose-600" },
        { label: "Fallen Tree Hazards", value: "412 Standing", valueColor: "text-rose-600" },
        { label: "Drone Survey", value: "Complete (RPAS-3)", valueColor: "text-green-600" },
      ]}
    />
  );
}
