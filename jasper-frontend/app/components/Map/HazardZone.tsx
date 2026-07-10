"use client";

import { useEffect, useState } from "react";
import { Circle, Marker, Popup, Tooltip, useMap } from "react-leaflet";
import { createBadgeIcon, BadgeIconType } from "./badgeIcon";
import { PopupField, StationPopupCard, StationStatus } from "./StationPopupCard";

interface Props {
  center: [number, number];
  radius: number;
  borderColor: string;
  fillColor: string;
  fillOpacity: number;
  label: string;
  badgeIcon: BadgeIconType;
  badgeBg?: string;
  badgeBorderColor?: string;
  dotColor: string;
  dotPulse?: boolean;
  popupIcon?: string;
  popupTitle: string;
  status: StationStatus;
  name: string;
  fields: PopupField[];
}

export function HazardZone({
  center,
  radius,
  borderColor,
  fillColor,
  fillOpacity,
  label,
  badgeIcon,
  badgeBg,
  badgeBorderColor,
  dotColor,
  dotPulse,
  popupIcon,
  popupTitle,
  status,
  name,
  fields,
}: Props) {
  const map = useMap();
  const [zoom, setZoom] = useState(() => map.getZoom());

  useEffect(() => {
    const onZoomEnd = () => setZoom(map.getZoom());
    map.on("zoomend", onZoomEnd);
    return () => { map.off("zoomend", onZoomEnd); };
  }, [map]);

  // Below zoom 10 the zones visually merge — suppress markers to keep the map clean
  const showDetail = zoom >= 10;

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
        >
          {/* Permanent label below the badge — same pattern as TelemetryStation */}
          <Tooltip permanent direction="bottom" offset={[0, 14]} className="jasper-zone-label" opacity={1}>
            <span style={{ color: borderColor }} className="font-semibold text-[11px] leading-none">
              {label}
            </span>
          </Tooltip>
          <Popup className="jasper-popup" closeButton={false} minWidth={260}>
            <StationPopupCard
              icon={popupIcon}
              title={popupTitle}
              status={status}
              name={name}
              fields={fields}
            />
          </Popup>
        </Marker>
      )}
    </>
  );
}
