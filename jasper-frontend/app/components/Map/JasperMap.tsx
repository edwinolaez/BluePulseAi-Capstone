"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, useMapEvents, useMap } from "react-leaflet";
import { BurnScarLayer } from "./BurnScarLayer";
import { ErosionLayer } from "./ErosionLayer";
import { ContaminantLayer } from "./ContaminantLayer";
import { TelemetryStation } from "./TelemetryStation";

const ATHABASCA_CENTER: [number, number] = [52.875, -118.08];
const DEFAULT_ZOOM = 12;

export interface FlyToTarget {
  lat: number;
  lng: number;
  zoom: number;
  nonce: number;
}

interface Props {
  onSectorClick?:  (sectorId: string) => void;
  activeSectorId?: string | null;
  dateFrom?:       string;
  dateTo?:         string;
  showBurnScar?:   boolean;
  showErosion?:    boolean;
  showContaminant?: boolean;
  onMapInit?:      (zoomIn: () => void, zoomOut: () => void) => void;
  flyTo?:          FlyToTarget | null;
}

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

function MapController({ onMapInit }: { onMapInit: (zi: () => void, zo: () => void) => void }) {
  const map = useMap();
  useEffect(() => {
    onMapInit(() => map.zoomIn(), () => map.zoomOut());
  }, [map, onMapInit]);
  return null;
}

function FlyToController({ target }: { target: FlyToTarget }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([target.lat, target.lng], target.zoom, { duration: 1.2 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target.nonce]);
  return null;
}

export default function JasperMap({
  onSectorClick,
  showBurnScar    = false,
  showErosion     = false,
  showContaminant = false,
  onMapInit,
  flyTo,
}: Props) {
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

      {onSectorClick && <SectorClickHandler onClick={onSectorClick} />}
      {onMapInit     && <MapController onMapInit={onMapInit} />}
      {flyTo         && <FlyToController target={flyTo} />}

      {showErosion     && <ErosionLayer />}
      {showContaminant && <ContaminantLayer />}
      {showBurnScar    && <BurnScarLayer />}

      <TelemetryStation />
    </MapContainer>
  );
}
