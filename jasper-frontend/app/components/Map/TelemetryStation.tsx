"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import { Marker, Popup, Tooltip } from "react-leaflet";
import { StationPopupCard } from "./StationPopupCard";

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

export function TelemetryStation() {
  const markerRef = useRef<L.Marker>(null);

  useEffect(() => {
    markerRef.current?.openPopup();
  }, []);

  return (
    <Marker ref={markerRef} position={STATION_CENTER} icon={radarPinIcon}>
      <Tooltip permanent direction="bottom" offset={[0, 14]} className="jasper-zone-label" opacity={1}>
        <span className="font-semibold text-[11px] leading-none text-sait-sky">
          Live Sensor — SEC-B4
        </span>
      </Tooltip>
      <Popup className="jasper-popup" closeButton={false} minWidth={260}>
        <StationPopupCard
          icon="🎯"
          title="Live Water Sensor Station"
          status="OPERATIONAL"
          name="Sector B-4 Upper Stream"
          fields={[
            { label: "Station ID", value: "SEC-B4" },
            { label: "Last Updated", value: "12 mins ago" },
            { label: "Location (Lat / Lng)", value: "54.6800° N, 113.5500° W" },
            { label: "Water Acidity", value: "5.5 pH (Acidic)", valueColor: "text-red-600" },
          ]}
        />
      </Popup>
    </Marker>
  );
}
