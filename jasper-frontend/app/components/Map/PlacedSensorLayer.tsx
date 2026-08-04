"use client";

// Renders stakeholder-placed sensor pins on the 2D Leaflet map.
// Also controls the map cursor (crosshair in placement mode, default otherwise).

import { useEffect } from "react";
import { Marker, Popup, Circle, useMap } from "react-leaflet";
import L from "leaflet";
import type { PlacedSensor } from "../../../lib/terrainLookup";

const SENSOR_COLOR: Record<PlacedSensor["sensorType"], string> = {
  forest:  "#22c55e",
  erosion: "#f59e0b",
  water:   "#00A3E0",
  flood:   "#3b82f6",
};

const SENSOR_LABEL: Record<PlacedSensor["sensorType"], string> = {
  forest:  "Forest Regrowth",
  erosion: "Soil Erosion",
  water:   "Water Quality",
  flood:   "Flood Monitoring",
};

function makePinIcon(color: string): L.DivIcon {
  return L.divIcon({
    className: "",
    iconAnchor:  [14, 36],
    popupAnchor: [0, -38],
    html: `<svg width="28" height="40" viewBox="0 0 28 40" xmlns="http://www.w3.org/2000/svg">
      <path d="M14 0C6.268 0 0 6.268 0 14c0 9.333 14 26 14 26s14-16.667 14-26C28 6.268 21.732 0 14 0z" fill="${color}"/>
      <circle cx="14" cy="14" r="7" fill="white" opacity="0.92"/>
    </svg>`,
  });
}

function CursorController({ placementMode }: { placementMode: boolean }) {
  const map = useMap();
  useEffect(() => {
    map.getContainer().style.cursor = placementMode ? "crosshair" : "";
  }, [map, placementMode]);
  return null;
}

interface Props {
  placedSensors:  PlacedSensor[];
  placementMode:  boolean;
  onRemoveSensor: (localId: string) => void;
}

export function PlacedSensorLayer({ placedSensors, placementMode, onRemoveSensor }: Props) {
  return (
    <>
      <CursorController placementMode={placementMode} />

      {/* Coverage circles rendered first (below pins in z-order) */}
      {placedSensors.map((sensor) => (
        <Circle
          key={`circle-${sensor.localId}`}
          center={[sensor.lat, sensor.lon]}
          radius={sensor.radiusM}
          pathOptions={{
            color:       SENSOR_COLOR[sensor.sensorType],
            fillColor:   SENSOR_COLOR[sensor.sensorType],
            fillOpacity: 0.08,
            opacity:     0.55,
            weight:      1.5,
            dashArray:   "5 4",
          }}
        />
      ))}

      {placedSensors.map((sensor) => {
        const color = SENSOR_COLOR[sensor.sensorType];
        const { simulationResults: sim } = sensor;
        const areaHa = ((Math.PI * sensor.radiusM * sensor.radiusM) / 10000).toFixed(2);

        return (

            <Marker
              key={sensor.localId}
              position={[sensor.lat, sensor.lon]}
              icon={makePinIcon(color)}
            >
              <Popup minWidth={220}>
                <div style={{ fontFamily: "sans-serif", fontSize: 13, lineHeight: 1.5 }}>
                  <div style={{ fontWeight: 700, marginBottom: 2, color: "#1e293b" }}>
                    {sensor.name}
                  </div>
                  <div style={{ fontSize: 11, color: "#64748b", marginBottom: 6 }}>
                    {SENSOR_LABEL[sensor.sensorType]} ·{" "}
                    {sensor.lat.toFixed(4)}°N, {Math.abs(sensor.lon).toFixed(4)}°W
                  </div>

                  <div style={{ fontSize: 11, marginBottom: 4 }}>
                    Elevation: <strong>{sensor.elevationM} m</strong>&nbsp;·&nbsp;
                    Slope: <strong>{sensor.slopeDeg}°</strong>
                  </div>

                  {/* Coverage radius badge */}
                  <div style={{
                    display: "inline-block",
                    background: `${color}18`,
                    border: `1px solid ${color}55`,
                    borderRadius: 5,
                    padding: "2px 7px",
                    fontSize: 10,
                    fontWeight: 700,
                    color,
                    marginBottom: 6,
                  }}>
                    ⬤ {sensor.radiusM} m radius · {areaHa} ha catchment
                  </div>

                  <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: 6, marginBottom: 6 }}>
                    {sim.erosionRateTPerHaYr !== undefined && (
                      <div style={{ fontSize: 11 }}>
                        Erosion:&nbsp;
                        <strong>{sim.erosionRateTPerHaYr.toFixed(2)} t/ha/yr</strong>
                        {sim.erosionRiskLabel && (
                          <span style={{
                            marginLeft: 4, fontSize: 10, fontWeight: 700,
                            color: sim.erosionRiskLabel === "High" ? "#dc2626"
                                 : sim.erosionRiskLabel === "Medium" ? "#d97706" : "#16a34a",
                          }}>({sim.erosionRiskLabel})</span>
                        )}
                        {sim.erosionTotalLoadTYr !== undefined && (
                          <div style={{ fontSize: 10, color: "#94a3b8" }}>
                            Total load: {sim.erosionTotalLoadTYr.toFixed(2)} t/yr from catchment
                          </div>
                        )}
                      </div>
                    )}
                    {sim.forestRecoveryPct !== undefined && (
                      <div style={{ fontSize: 11 }}>
                        Forest recovery: <strong>{sim.forestRecoveryPct.toFixed(1)}%</strong>
                      </div>
                    )}
                    {sim.floodFlowM3s !== undefined && (
                      <div style={{ fontSize: 11 }}>
                        Flood flow (Q): <strong>{sim.floodFlowM3s.toFixed(3)} m³/s</strong>
                      </div>
                    )}
                    {sim.contaminantConcNorm !== undefined && (
                      <div style={{ fontSize: 11 }}>
                        Contamination centre: <strong>{(sim.contaminantConcNorm * 100).toFixed(0)}%</strong>
                        {sim.contaminantEdgeConc !== undefined && (
                          <span style={{ color: "#94a3b8", fontSize: 10 }}>
                            &nbsp;· edge: {(sim.contaminantEdgeConc * 100).toFixed(0)}%
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={(e) => { e.stopPropagation(); onRemoveSensor(sensor.localId); }}
                    style={{
                      width: "100%",
                      background: "#fee2e2",
                      color: "#dc2626",
                      border: "1px solid #fca5a5",
                      borderRadius: 6,
                      padding: "4px 0",
                      cursor: "pointer",
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    Remove pin
                  </button>

                  <div style={{
                    marginTop: 8, padding: "6px 8px",
                    background: "#fef2f2", border: "1px solid #fecaca",
                    borderRadius: 6, fontSize: 9, color: "#b91c1c", lineHeight: 1.5,
                  }}>
                    <strong>⚠ Not real sensor data.</strong> Model prediction only —
                    not verified by a researcher. Do not use for environmental or policy decisions.
                  </div>
                </div>
              </Popup>
            </Marker>
        );
      })}
    </>
  );
}
