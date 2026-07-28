"use client";

import { useEffect, useState } from "react";
import { Circle, Marker, useMap } from "react-leaflet";
import { createBadgeIcon, BadgeIconType } from "./badgeIcon";
import type { SensorInfo } from "./JasperMap";

interface Props {
  center: [number, number];
  radius: number;
  borderColor: string;
  fillColor: string;
  fillOpacity: number;
  badgeIcon: BadgeIconType;
  badgeBg?: string;
  badgeBorderColor?: string;
  dotColor: string;
  dotPulse?: boolean;
  // Sensor-specific data shown in the right panel when this marker is clicked.
  // The parent layer builds this and passes it down.
  sensorInfo?: SensorInfo;
  onSectorClick?: (id: string) => void;
  onSensorSelect?: (info: SensorInfo) => void;
  onMarkerClick?: () => void;
}

// HazardZone.tsx — The Clickable Badge and Dashed Circle on the Map
//
// Every environmental zone you see on the map — the burn scar, the erosion areas,
// the river contamination — uses this component to draw itself.
//
// It does two things:
//   1. Draws a dashed circle on the map in the zone's colour (red, amber, or green)
//   2. Places a small badge icon in the centre of that circle
//
// When the user clicks the badge, HazardZone takes the sensor data for that
// zone (passed in by the parent layer) and sends it upward to MapViewPage.
// MapViewPage then passes it to SectorPanel so the right side panel updates.
//
// The circle and badge also hide automatically when the user zooms out too far —
// this keeps the map clean and uncluttered at low zoom levels.
export function HazardZone({
  center,
  radius,
  borderColor,
  fillColor,
  fillOpacity,
  badgeIcon,
  badgeBg,
  badgeBorderColor,
  dotColor,
  dotPulse,
  sensorInfo,
  onSectorClick,
  onSensorSelect,
  onMarkerClick,
}: Props) {
  const sectorId = `sector_${Math.floor(center[0] / 0.05)}_${Math.floor(center[1] / 0.05)}`;
  const map = useMap();
  const [zoom, setZoom] = useState(() => map.getZoom());

  useEffect(() => {
    const onZoomEnd = () => setZoom(map.getZoom());
    map.on("zoomend", onZoomEnd);
    return () => { map.off("zoomend", onZoomEnd); };
  }, [map]);

  const showDetail = zoom >= 10;

  function handleClick() {
    if (sensorInfo) onSensorSelect?.(sensorInfo);
    // onSectorClick intentionally NOT called here — marker clicks show sensor-specific info,
    // not generic sector data. CanvasClickHandler is the only caller of onSectorClick.
    onMarkerClick?.();
  }

  return (
    <>
      <Circle
        center={center}
        radius={radius}
        interactive={false}
        pathOptions={{
          color: borderColor,
          fillColor,
          fillOpacity: showDetail ? fillOpacity : fillOpacity * 0.4,
          weight: showDetail ? 1.5 : 0.8,
          dashArray: "6 5",
        }}
      />

      {showDetail && (
        <Marker
          position={center}
          icon={createBadgeIcon({
            borderColor: badgeBorderColor ?? borderColor,
            iconType: badgeIcon,
            badgeBg,
            dotColor,
            dotPulse,
          })}
          eventHandlers={{ click: handleClick }}
        />
      )}
    </>
  );
}
