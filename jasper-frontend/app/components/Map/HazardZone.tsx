/**
 * HazardZone.tsx — Reusable hazard zone overlay for the 2D Leaflet map.
 *
 * Renders a dashed circle on the map representing a monitored risk zone
 * (erosion, contamination, or burn scar area), along with a floating badge
 * marker in the centre that shows a tooltip and opens a popup card on click.
 *
 * At zoom levels below 10 the zones would visually merge, so the badge
 * marker is hidden and the circle fill is reduced to keep the map readable.
 *
 * Used by: BurnScarLayer, ContaminantLayer, ErosionLayer
 */
"use client";

import { useEffect, useState } from "react";
import { Marker, Popup, Tooltip, useMap } from "react-leaflet";
import { createBadgeIcon, BadgeIconType } from "./badgeIcon";
import { PopupField, StationPopupCard, StationStatus } from "./StationPopupCard";

interface Props {
  /** GPS centre of the hazard zone [lat, lng]. */
  center: [number, number];
  /** Radius of the circle in metres. */
  radius: number;
  /** Hex colour for the dashed circle border. */
  borderColor: string;
  /** Hex colour for the circle fill. */
  fillColor: string;
  /** Fill opacity (0–1). */
  fillOpacity: number;
  /** Short text shown in the tooltip below the badge. */
  label: string;
  /** Icon type for the badge marker at the zone centre. */
  badgeIcon: BadgeIconType;
  /** Optional background colour for the badge circle. */
  badgeBg?: string;
  /** Optional border colour override for the badge. */
  badgeBorderColor?: string;
  /** Hex colour for the status dot on the badge. */
  dotColor: string;
  /** When true, the status dot pulses to draw attention. */
  dotPulse?: boolean;
  /** Emoji shown at the top of the popup card. */
  popupIcon?: string;
  /** Title row of the popup card. */
  popupTitle: string;
  /** OPERATIONAL | WARNING | CRITICAL — colours the status badge in the popup. */
  status: StationStatus;
  /** Station/area name shown in the popup card. */
  name: string;
  /** Data rows shown in the popup grid. */
  fields: PopupField[];
}

/**
 * HazardZone
 * Renders a dashed risk-zone circle and an interactive badge marker.
 * Subscribes to Leaflet zoom events so it can hide detail below zoom 10.
 */
export function HazardZone({
  center,
  radius: _radius,
  borderColor,
  fillColor: _fillColor,
  fillOpacity: _fillOpacity,
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
          <Tooltip direction="bottom" offset={[0, 14]} className="jasper-zone-label" opacity={1}>
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
