"use client";

import { Circle, Marker, Popup, Tooltip } from "react-leaflet";
import { createBadgeIcon, BadgeIconType } from "./badgeIcon";
import { PopupField, StationPopupCard, StationStatus } from "./StationPopupCard";

interface Props {
  center: [number, number];
  radius: number;
  borderColor: string;
  fillColor: string;
  fillOpacity: number;
  label: string;
  sublabel?: string;
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
  sublabel,
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
  return (
    <>
      <Circle
        center={center}
        radius={radius}
        pathOptions={{
          color: borderColor,
          fillColor,
          fillOpacity,
          weight: 1.5,
          dashArray: "6 5",
        }}
      >
        <Tooltip permanent direction="center" className="jasper-zone-label" opacity={1}>
          <div style={{ color: borderColor }} className="font-bold text-[11px] tracking-wide uppercase text-center leading-tight">
            {label}
            {sublabel && (
              <div className="font-normal normal-case text-[10px] opacity-80">{sublabel}</div>
            )}
          </div>
        </Tooltip>
      </Circle>

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
    </>
  );
}
