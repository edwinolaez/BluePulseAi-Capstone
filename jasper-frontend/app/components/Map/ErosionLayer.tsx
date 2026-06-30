"use client";

import { HazardZone } from "./HazardZone";

const CENTER: [number, number] = [52.858, -118.092];

export function ErosionLayer() {
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
      status="WARNING"
      name="Slope Sector SEC-E1"
      fields={[
        { label: "Slope Sector ID", value: "SEC-E1" },
        { label: "Slope Angle", value: "38.5° (Steep)", valueColor: "text-purple-600" },
        { label: "LiDAR Terrain Drift", value: "-12.4 cm (Slipped)", valueColor: "text-red-600" },
        { label: "Erosion Index", value: "0.78 / 1.00", valueColor: "text-purple-600" },
        { label: "Soil Moisture", value: "72.1% (Saturated)" },
      ]}
    />
  );
}
