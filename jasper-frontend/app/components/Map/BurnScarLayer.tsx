// BurnScarLayer shows the forest burn scar zone on the map.
// It calls Richard's change-detection ML model to find out the current risk level
// for the Athabasca watershed sector, then draws a coloured circle on the map
// where the risk is — red for high, amber for medium, green for low.
// If the API call fails, it just defaults to showing High risk colours.

"use client";

import { useEffect, useState } from "react";
import { fetchChangeDetection, ModelOutput } from "../../../lib/api";
import { HazardZone } from "./HazardZone";

// The sector ID we're monitoring — maps to a specific area in the watershed
const DEFAULT_SECTOR = "ATH-001-A";
// GPS centre of the burn scar zone — where the map circle is drawn
const CENTER: [number, number] = [52.882, -118.065];

// Visual styles for each risk level — controls the circle's border and fill colour
const RISK_STYLE = {
  High:   { borderColor: "#ef4444", fillColor: "#f43f5e", badge: "text-red-500" },
  Medium: { borderColor: "#f59e0b", fillColor: "#fbbf24", badge: "text-amber-500" },
  Low:    { borderColor: "#22c55e", fillColor: "#4ade80", badge: "text-green-500" },
} as const;

export function BurnScarLayer() {
  // Holds the response from Richard's API — null while loading or if the call failed
  const [result, setResult] = useState<ModelOutput | null>(null);

  // Fetch the burn scar prediction when the layer first appears on the map
  useEffect(() => {
    fetchChangeDetection(DEFAULT_SECTOR)
      .then(setResult)
      // If the API is down or unreachable, silently fall back to the default High style
      .catch(() => setResult(null));
  }, []);

  // Pick the visual style based on what the ML model returned.
  // If we have no data, default to High risk (most visible and most cautious).
  const risk = result?.risk_label ?? "High";
  const style = RISK_STYLE[risk as keyof typeof RISK_STYLE] ?? RISK_STYLE.High;
  // Show confidence percentage in the popup if live data is available
  const confidence = result ? ` (${(result.confidence * 100).toFixed(0)}% confidence)` : "";

  // HazardZone draws a Leaflet circle with a tooltip and a click popup
  return (
    <HazardZone
      center={CENTER}
      radius={2400}
      borderColor={style.borderColor}
      fillColor={style.fillColor}
      fillOpacity={0.08}
      label="Forest Regrowth Monitor"
      badgeIcon="flame"
      badgeBg="#fff1f2"
      dotColor="#ef4444"
      dotPulse
      popupIcon="🌲"
      popupTitle="Forest Regrowth Status"
      status={risk === "High" ? "CRITICAL" : risk === "Medium" ? "WARNING" : "OPERATIONAL"}
      name="Forest Area SEC-V9"
      fields={[
        { label: "Area ID",             value: "SEC-V9" },
        { label: "Risk Level",          value: risk + confidence,                  valueColor: style.badge },
        { label: "Risk Score",          value: result ? result.risk_score.toFixed(3) : "—" },
        { label: "Trees Damaged",       value: "82.4% (Severe)",                  valueColor: "text-rose-600" },
        { label: "Fallen Tree Hazards", value: "412 Standing",                    valueColor: "text-rose-600" },
        { label: "Drone Survey",        value: "Complete (RPAS-3)",               valueColor: "text-green-600" },
      ]}
    />
  );
}
