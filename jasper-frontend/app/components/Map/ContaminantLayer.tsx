"use client";

import { Polyline } from "react-leaflet";
import { HazardZone } from "./HazardZone";

const RIVER_MAIN: [number, number][] = [
  [52.820, -118.200],
  [52.840, -118.155],
  [52.858, -118.105],
  [52.875, -118.060],
  [52.890, -118.020],
  [52.910, -117.975],
  [52.935, -117.920],
];

const RIVER_BRANCH: [number, number][] = RIVER_MAIN.map(
  ([lat, lng]): [number, number] => [lat + 0.004, lng + 0.006]
);

const CRITICAL_CENTER: [number, number] = [52.875, -118.060];

export function ContaminantLayer() {
  return (
    <>
      <Polyline
        positions={RIVER_MAIN}
        pathOptions={{ color: "#0ea5e9", weight: 5, opacity: 0.8, lineCap: "round", lineJoin: "round" }}
      />
      <Polyline
        positions={RIVER_BRANCH}
        pathOptions={{ color: "#38bdf8", weight: 3, opacity: 0.7, lineCap: "round", lineJoin: "round" }}
      />

      <HazardZone
        center={CRITICAL_CENTER}
        radius={1500}
        borderColor="#ef4444"
        fillColor="#f87171"
        fillOpacity={0.12}
        label="Critical"
        sublabel="Discharge Detected"
        badgeIcon="map"
        badgeBorderColor="#0ea5e9"
        dotColor="#ef4444"
        popupIcon="💧"
        popupTitle="Water Chemistry Dashboard"
        status="WARNING"
        name="Athabasca Run SEC-W2"
        fields={[
          { label: "Athabasca Run ID", value: "SEC-W2" },
          { label: "Turbidity Level", value: "18.4 NTU (Severe)", valueColor: "text-red-600" },
          { label: "Hydrocarbon Trace", value: "0.04 ppm", valueColor: "text-amber-600" },
          { label: "Discharge Flow", value: "2.1 m³/s" },
          { label: "Telemetry Link", value: "Active Sync", valueColor: "text-green-600" },
        ]}
      />
    </>
  );
}
