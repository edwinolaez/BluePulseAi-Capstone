/**
 * JasperMap.tsx — 2D Leaflet map container for the Jasper watershed.
 *
 * Renders a full-size MapContainer centred on the Athabasca watershed with
 * OpenStreetMap base tiles.  Conditionally mounts the three environmental
 * layer components (ErosionLayer, ContaminantLayer, BurnScarLayer) based on
 * the toggle props passed from MapViewPage / Sidebar.
 *
 * Three internal helper components are defined here:
 *   SectorClickHandler — converts map clicks to sector IDs
 *   PlacementClickHandler — captures a single click in placement mode
 *   MapController      — exposes zoomIn/zoomOut callbacks to the parent
 *   FlyToController    — animates the map to a target when flyTo changes
 *
 * This component is loaded dynamically with ssr:false in MapViewPage because
 * Leaflet requires browser APIs (window, DOM) that don't exist server-side.
 */
"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, useMapEvents, useMap } from "react-leaflet";
import { BurnScarLayer } from "./BurnScarLayer";
import { ErosionLayer } from "./ErosionLayer";
import { ContaminantLayer } from "./ContaminantLayer";
import { TelemetryStation } from "./TelemetryStation";
import { ElevationRiskLayer } from "./ElevationRiskLayer";
import { PlacedSensorLayer } from "./PlacedSensorLayer";
import type { PlacedSensor } from "../../../lib/terrainLookup";

const ATHABASCA_CENTER: [number, number] = [52.875, -118.08];
const DEFAULT_ZOOM = 12;

export interface FlyToTarget {
  lat: number;
  lng: number;
  zoom: number;
  nonce: number;
}

interface Props {
  onSectorClick?:      (sectorId: string) => void;
  activeSectorId?:     string | null;
  dateFrom?:           string;
  dateTo?:             string;
  showBurnScar?:       boolean;
  showErosion?:        boolean;
  showContaminant?:    boolean;
  showElevation?:      boolean;
  onMapInit?:          (zoomIn: () => void, zoomOut: () => void) => void;
  flyTo?:              FlyToTarget | null;
  contaminationLevel?: number;
  projectionHours?:    number;
  yearsSinceFire?:     number;
  precipMmYr?:         number;
  slopeDeg?:           number;
  rainfallMm?:         number;
  waterLevelM?:        number;
  /** When true, the next map click places a sensor instead of selecting a sector */
  placementMode?:      boolean;
  /** Called with (lat, lon) when the user clicks in placement mode */
  onPlaceSensor?:      (lat: number, lon: number) => void;
  /** Stakeholder-placed sensor pins */
  placedSensors?:      PlacedSensor[];
  /** Called with localId when the user removes a placed sensor */
  onRemoveSensor?:     (localId: string) => void;
}

/**
 * SectorClickHandler — converts map clicks to sector IDs by snapping the
 * lat/lng to a 0.05° grid cell.
 */
function SectorClickHandler({ onClick }: { onClick: (id: string) => void }) {
  useMapEvents({
    click(e) {
      const lat = Math.floor(e.latlng.lat / 0.05);
      const lng = Math.floor(e.latlng.lng / 0.05);
      onClick(`sector_${lat}_${lng}`);
    },
  });
  return null;
}

/**
 * PlacementClickHandler — captures the next map click and fires onPlace.
 * Rendered in place of SectorClickHandler when placementMode is true.
 */
function PlacementClickHandler({ onPlace }: { onPlace: (lat: number, lon: number) => void }) {
  useMapEvents({
    click(e) {
      onPlace(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

/**
 * MapController — exposes the Leaflet map's zoomIn/zoomOut methods to the
 * parent via a callback.
 */
function MapController({ onMapInit }: { onMapInit: (zi: () => void, zo: () => void) => void }) {
  const map = useMap();
  useEffect(() => {
    onMapInit(() => map.zoomIn(), () => map.zoomOut());
  }, [map, onMapInit]);
  return null;
}

/**
 * FlyToController — animates the map to a new position whenever target changes.
 * Uses a nonce so clicking the same sector twice still triggers the animation.
 */
function FlyToController({ target }: { target: FlyToTarget }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([target.lat, target.lng], target.zoom, { duration: 1.2 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target.nonce]);
  return null;
}

/**
 * JasperMap (default export)
 * 2D Leaflet map centred on the Athabasca watershed.
 */
export default function JasperMap({
  onSectorClick,
  showBurnScar       = false,
  showErosion        = false,
  showContaminant    = false,
  showElevation      = true,
  onMapInit,
  flyTo,
  contaminationLevel = 0.72,
  projectionHours    = 24,
  yearsSinceFire     = 2,
  precipMmYr         = 450,
  slopeDeg           = 22,
  rainfallMm         = 82,
  waterLevelM        = 1.5,
  placementMode      = false,
  onPlaceSensor,
  placedSensors      = [],
  onRemoveSensor     = () => {},
}: Props) {
  const erosionRate = slopeDeg > 0 && rainfallMm > 0
    ? 2.0 * Math.pow(rainfallMm / 82, 1.2) * Math.pow(slopeDeg / 22, 1.4)
    : 0;
  const erosionRiskLabel: "High" | "Medium" | "Low" =
    erosionRate >= 4.0 ? "High" : erosionRate >= 1.5 ? "Medium" : "Low";

  return (
    <MapContainer
      center={ATHABASCA_CENTER}
      zoom={DEFAULT_ZOOM}
      scrollWheelZoom
      zoomControl={false}
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* Click handler: placement mode captures pin drop, otherwise selects sector */}
      {placementMode && onPlaceSensor
        ? <PlacementClickHandler onPlace={onPlaceSensor} />
        : onSectorClick && <SectorClickHandler onClick={onSectorClick} />
      }

      {onMapInit && <MapController onMapInit={onMapInit} />}
      {flyTo     && <FlyToController target={flyTo} />}

      {showElevation   && <ElevationRiskLayer waterLevelM={waterLevelM} />}
      {showErosion     && <ErosionLayer slopeDeg={slopeDeg} rainfallMm={rainfallMm} riskLabel={erosionRiskLabel} />}
      {showContaminant && (
        <ContaminantLayer
          contaminationLevel={contaminationLevel}
          projectionHours={projectionHours}
        />
      )}
      {showBurnScar && <BurnScarLayer yearsSinceFire={yearsSinceFire} precipMmYr={precipMmYr} />}

      <TelemetryStation />

      {/* Stakeholder-placed sensor pins */}
      <PlacedSensorLayer
        placedSensors={placedSensors}
        placementMode={placementMode}
        onRemoveSensor={onRemoveSensor}
      />
    </MapContainer>
  );
}
