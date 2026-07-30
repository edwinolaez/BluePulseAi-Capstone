/**
 * BurnScarLayer.tsx — Forest burn scar hazard zone for the Leaflet map.
 *
 * On mount, calls Richard's change-detection ML model (fetchChangeDetection)
 * for sector ATH-001-A.  The returned risk_label (High / Medium / Low) drives
 * both the visual style of the HazardZone overlay and the popup badge colour.
 *
 * If the API call fails for any reason, the layer falls back to "High" risk
 * styling — the most visible and most cautious default.
 *
 * Rendered elements:
 *   - A small sensor dot (CircleMarker) at the burn scar centroid
 *   - A large semi-transparent HazardZone circle around the affected area
 */

"use client";

import { useEffect, useState } from "react";
import { CircleMarker, Tooltip } from "react-leaflet";
import { fetchChangeDetection, ModelOutput } from "../../../lib/api";
import { HazardZone } from "./HazardZone";

// The sector ID we're monitoring — maps to a specific area in the watershed
const DEFAULT_SECTOR = "ATH-001-A";
// GPS centre of the burn scar zone — 2024 Jasper Wildfire centroid (Alberta Wildfire open data / NFDB fire polygon)
const CENTER: [number, number] = [52.848, -118.083];

// Zone border/fill always uses Forest sensor blue (#2563eb) so the zone colour matches
// the sensor dot. Risk level is shown via fill lightness and in the popup badge.
const RISK_STYLE = {
  High:   { borderColor: "#005EB8", fillColor: "#0076e0", badge: "text-red-500",   dotColor: "#ef4444" },
  Medium: { borderColor: "#005EB8", fillColor: "#3387d0", badge: "text-amber-500", dotColor: "#f59e0b" },
  Low:    { borderColor: "#004a92", fillColor: "#5aaee0", badge: "text-green-500", dotColor: "#22c55e" },
} as const;

/**
 * BurnScarLayer — react-leaflet layer component for the forest burn scar zone.
 *
 * Fetches the current burn risk from Richard's API on first render and
 * renders a sensor dot + hazard zone circle with colour-coded risk styling.
 * No props — uses the hard-coded DEFAULT_SECTOR and CENTER constants.
 */
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

  const dot = (
    <CircleMarker
      center={CENTER}
      radius={7}
      pathOptions={{ color: "#ffffff", fillColor: "#005EB8", fillOpacity: 1, weight: 2 }}
    >
      <Tooltip direction="top" offset={[0, -8]} opacity={1}>
        <div className="text-xs font-semibold">ATH-001-A</div>
        <div className="text-xs text-gray-500">Forest Regrowth Sensor</div>
        <div className="text-xs text-gray-400">52.8480°N, 118.0830°W</div>
      </Tooltip>
    </CircleMarker>
  );

  const zone = (
    <HazardZone
      center={CENTER}
      radius={2400}
      borderColor={style.borderColor}
      fillColor={style.fillColor}
      fillOpacity={0.08}
      label="Forest Regrowth Monitor"
      badgeIcon="flame"
      badgeBg="#fff1f2"
      dotColor={style.dotColor}
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

  return <>{dot}{zone}</>;
}
