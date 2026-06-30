"use client";

import { HazardZone } from "./HazardZone";

const CENTER: [number, number] = [52.882, -118.065];

export function BurnScarLayer() {
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
      status="CRITICAL"
      name="Forest Segment SEC-V9"
      fields={[
        { label: "Forest Segment ID", value: "SEC-V9" },
        { label: "Crown Scorch", value: "82.4% (Severe)", valueColor: "text-rose-600" },
        { label: "Dead Tree Hazards", value: "412 Standing", valueColor: "text-rose-600" },
        { label: "Detection Confidence", value: "94.6%" },
        { label: "Drone Coverage", value: "Complete (RPAS-3)", valueColor: "text-green-600" },
      ]}
    />
  );
}
