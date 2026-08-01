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
  /** Scenario panel: contamination level 0–1 passed through to ContaminantLayer */
  contaminationLevel?: number;
  /** Scenario panel: projection hours passed through to ContaminantLayer */
  projectionHours?:    number;
  /** Forest growth panel: years since the Jasper wildfire (drives regrowth colour) */
  yearsSinceFire?:     number;
  /** Forest growth panel: annual precipitation in mm/yr (drives regrowth rate) */
  precipMmYr?:         number;
  /** Soil erosion panel: slope angle in degrees — passed to ErosionLayer for live ML re-fetch */
  slopeDeg?:           number;
  /** Soil erosion panel: rainfall in mm — passed to ErosionLayer for live ML re-fetch */
  rainfallMm?:         number;
  /** Flood elevation panel: water level rise in metres — drives ElevationRiskLayer highlight */
  waterLevelM?:        number;
}

/**
 * SectorClickHandler — invisible component that converts Leaflet map clicks
 * into a deterministic sector ID string by snapping the lat/lng to a 0.05°
 * grid cell.  This gives each area of the map a stable ID for the SectorPanel.
 */
function SectorClickHandler({ onClick }: { onClick: (id: string) => void }) {
  useMapEvents({
    click(e) {
      // Snap to a ~5 km grid so nearby clicks resolve to the same sector
      const lat = Math.floor(e.latlng.lat / 0.05);
      const lng = Math.floor(e.latlng.lng / 0.05);
      onClick(`sector_${lat}_${lng}`);
    },
  });
  return null;
}

/**
 * MapController — exposes the Leaflet map's zoomIn/zoomOut methods to the
 * parent via a callback.  This is the correct pattern for accessing the Leaflet
 * map instance from outside a react-leaflet component tree.
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
 * Uses a nonce (timestamp) instead of comparing lat/lng so that clicking the
 * same sector twice still triggers the animation.
 */
function FlyToController({ target }: { target: FlyToTarget }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([target.lat, target.lng], target.zoom, { duration: 1.2 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target.nonce]); // intentionally only react to nonce, not lat/lng/zoom
  return null;
}

/**
 * JasperMap (default export)
 * 2D Leaflet map centred on the Athabasca watershed.  Layer components are
 * mounted conditionally so they only request API data when their toggle is on.
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
}: Props) {
  return (
    <MapContainer
      center={ATHABASCA_CENTER}
      zoom={DEFAULT_ZOOM}
      scrollWheelZoom
      zoomControl={false}
      style={{ height: "100%", width: "100%" }}
    >
      {/* Base map tiles — shows roads, rivers, and place names */}
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {onSectorClick && <SectorClickHandler onClick={onSectorClick} />}
      {onMapInit     && <MapController onMapInit={onMapInit} />}
      {flyTo         && <FlyToController target={flyTo} />}

      {/* Elevation flood risk zones — toggleable via Sidebar */}
      {showElevation && <ElevationRiskLayer waterLevelM={waterLevelM} />}

      {/* Sensor-specific layers render on top of the risk surface */}
      {showErosion     && <ErosionLayer slopeDeg={slopeDeg} rainfallMm={rainfallMm} />}
      {showContaminant && (
        <ContaminantLayer
          contaminationLevel={contaminationLevel}
          projectionHours={projectionHours}
        />
      )}
      {showBurnScar    && <BurnScarLayer yearsSinceFire={yearsSinceFire} precipMmYr={precipMmYr} />}

      <TelemetryStation />
    </MapContainer>
  );
}
