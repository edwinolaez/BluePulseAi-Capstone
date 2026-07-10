// ErosionLayer draws three overlapping erosion risk zones on the map —
// one High, one Medium, one Low — at different terrain positions in the watershed.
// Each zone fetches its own risk prediction from Richard's erosion simulation API
// using the real slope angle and rainfall amount for that specific location.
// All three API calls run at the same time for speed.

"use client";

import { useEffect, useState } from "react";
import { fetchErosionSimulation, ModelOutput } from "../../../lib/api";
import { HazardZone } from "./HazardZone";

// The three erosion monitoring zones — different terrain positions with different conditions.
// Higher slope and more rainfall = higher erosion risk.
const ZONES = [
  { sectorId: "ATH-001-H", center: [52.858, -118.092] as [number, number], radius: 1400, slopeDeg: 42, rainfallMm: 95 },
  { sectorId: "ATH-001-M", center: [52.870, -118.070] as [number, number], radius: 1100, slopeDeg: 28, rainfallMm: 68 },
  { sectorId: "ATH-001-L", center: [52.884, -118.045] as [number, number], radius: 900,  slopeDeg: 16, rainfallMm: 40 },
];

// Colour and label for each risk level — purple tones to visually separate erosion from burn scar
const STYLE_BY_LABEL = {
  High:   { borderColor: "#a855f7", fillColor: "#c084fc", label: "Landslide & Soil Risk" },
  Medium: { borderColor: "#8b5cf6", fillColor: "#a78bfa", label: "Landslide & Soil Risk" },
  Low:    { borderColor: "#6d28d9", fillColor: "#7c3aed", label: "Soil Erosion Risk"     },
} as const;

// Default risk order if the API hasn't responded yet — High for the steepest zone, Low for the flattest
const DEFAULT_RISK = ["High", "Medium", "Low"] as const;

export function ErosionLayer() {
  // One result slot per zone — starts as null until each API call resolves
  const [results, setResults] = useState<(ModelOutput | null)[]>([null, null, null]);

  // Fetch all three erosion predictions at the same time when the layer loads.
  // Promise.allSettled means a failure in one zone doesn't affect the other two.
  useEffect(() => {
    Promise.allSettled(
      ZONES.map((z) => fetchErosionSimulation(z.sectorId, z.slopeDeg, z.rainfallMm))
    ).then((settled) => {
      // If a call failed, store null for that zone so we fall back to the default risk
      setResults(
        settled.map((r) => (r.status === "fulfilled" ? r.value : null))
      );
    });
  }, []);

  // Render one HazardZone circle per erosion monitoring area
  return (
    <>
      {ZONES.map((zone, i) => {
        // Use the live risk label if available, otherwise use the preset default for this zone
        const risk = results[i]?.risk_label ?? DEFAULT_RISK[i];
        const style = STYLE_BY_LABEL[risk as keyof typeof STYLE_BY_LABEL] ?? STYLE_BY_LABEL.Medium;
        const score = results[i]?.risk_score;

        return (
          <HazardZone
            key={zone.sectorId}
            center={zone.center}
            radius={zone.radius}
            borderColor={style.borderColor}
            fillColor={style.fillColor}
            fillOpacity={0.12}
            label={style.label}
            badgeIcon="mountain"
            dotColor="#ef4444"
            popupIcon="⛰️"
            popupTitle="Soil Erosion Analysis"
            status={risk === "High" ? "CRITICAL" : risk === "Medium" ? "WARNING" : "OPERATIONAL"}
            name={`Slope Area ${zone.sectorId}`}
            fields={[
              { label: "Area ID",        value: zone.sectorId },
              { label: "Risk Level",     value: risk, valueColor: risk === "High" ? "text-red-600" : risk === "Medium" ? "text-amber-600" : "text-green-600" },
              { label: "Risk Score",     value: score != null ? score.toFixed(3) : "—" },
              // Slope and rainfall are the inputs sent to Richard's RUSLE model
              { label: "Slope Angle",    value: `${zone.slopeDeg}°`, valueColor: "text-purple-600" },
              { label: "Rainfall Input", value: `${zone.rainfallMm} mm` },
            ]}
          />
        );
      })}
    </>
  );
}
