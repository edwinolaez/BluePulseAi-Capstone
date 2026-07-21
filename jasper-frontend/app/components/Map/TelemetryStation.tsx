"use client";

import L from "leaflet";
import { Marker } from "react-leaflet";
import type { SensorInfo } from "./JasperMap";

const STATION_CENTER: [number, number] = [52.875, -118.08];

const radarPinIcon = L.divIcon({
  className: "",
  html: `
    <div class="relative w-9 h-9 flex items-center justify-center">
      <span class="absolute w-9 h-9 rounded-full border-2 border-sait-sky animate-ping opacity-40"></span>
      <div class="relative w-7 h-7 rounded-full bg-white border-2 border-sait-sky shadow-md flex items-center justify-center">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#00A3E0" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="2" />
          <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
        </svg>
      </div>
    </div>
  `,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
});

const STATION_INFO: SensorInfo = {
  icon: "sensor",
  title: "TELEMETRY STATION",
  badge: "LIVE",
  badgeVariant: "cyan",
  name: "Jasper-A1 Monitoring Station",
  fields: [
    { label: "STATION ID", value: "JAS-A1" },
    { label: "STATUS",     value: "Active",        valueColor: "#22c55e" },
    { label: "LOCATION",   value: "Jasper, AB" },
    { label: "ELEVATION",  value: "1,061 m" },
  ],
};

interface Props {
  onSectorClick?:  (id: string) => void; // accepted for API compatibility with other layers
  onSensorSelect?: (info: SensorInfo) => void;
  onMarkerClick?:  () => void;
}

export function TelemetryStation({ onSensorSelect, onMarkerClick }: Props) {
  function handleClick() {
    onSensorSelect?.(STATION_INFO);
    onMarkerClick?.();
  }

  return (
    <Marker
      position={STATION_CENTER}
      icon={radarPinIcon}
      eventHandlers={{ click: handleClick }}
    />
  );
}
