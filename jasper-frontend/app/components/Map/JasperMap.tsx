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

// Sensor-specific information shown in the right panel when a map marker is clicked.
// Each layer builds this object from its own data and passes it up via onSensorSelect.
export type SensorInfo = {
  icon: "flame" | "mountain" | "map" | "sensor";
  title: string;
  badge?: string;
  badgeVariant?: "red" | "amber" | "green" | "cyan";
  name: string;
  fields: Array<{ label: string; value: string; valueColor?: string; fullWidth?: boolean }>;
};

interface Props {
  onSensorSelect?:   (info: SensorInfo) => void;
  showBurnScar?:     boolean;
  showErosion?:      boolean;
  showContaminant?:  boolean;
  onMapInit?:        (zoomIn: () => void, zoomOut: () => void, invalidateSize: () => void) => void;
  flyTo?:            FlyToTarget | null;
  onMapClick?:       () => void;
  onMarkerClick?:    () => void;
}

// Fires on true canvas clicks only (markers have bubblingMouseEvents:false by default).
// Sole purpose: toggle the panel open/closed.
function CanvasClickHandler({ onCanvasClick }: { onCanvasClick?: () => void }) {
  useMapEvents({ click() { onCanvasClick?.(); } });
  return null;
}

function MapController({ onMapInit }: { onMapInit: (zi: () => void, zo: () => void, inv: () => void) => void }) {
  const map = useMap();
  useEffect(() => {
    onMapInit(
      () => map.zoomIn(),
      () => map.zoomOut(),
      () => map.invalidateSize(),
    );
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
  onSensorSelect,
  showBurnScar    = false,
  showErosion     = false,
  showContaminant = false,
  onMapInit,
  flyTo,
  onMapClick,
  onMarkerClick,
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

      <CanvasClickHandler onCanvasClick={onMapClick} />
      {onMapInit && <MapController onMapInit={onMapInit} />}
      {flyTo     && <FlyToController target={flyTo} />}

      {showErosion     && <ErosionLayer     onSensorSelect={onSensorSelect} onMarkerClick={onMarkerClick} />}
      {showContaminant && <ContaminantLayer onSensorSelect={onSensorSelect} onMarkerClick={onMarkerClick} />}
      {showBurnScar    && <BurnScarLayer    onSensorSelect={onSensorSelect} onMarkerClick={onMarkerClick} />}

      <TelemetryStation onSensorSelect={onSensorSelect} onMarkerClick={onMarkerClick} />
    </MapContainer>
  );
}
