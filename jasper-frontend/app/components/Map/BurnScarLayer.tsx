"use client";

import { CircleMarker, Tooltip } from "react-leaflet";

const CENTER: [number, number] = [52.848, -118.083];

export function BurnScarLayer() {
  return (
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
}
