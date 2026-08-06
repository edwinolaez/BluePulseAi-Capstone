/**
 * PlacedSensorLayer.tsx — renders stakeholder-placed sensor pins on the 2D Leaflet map.
 *
 * Two visual elements per sensor:
 *   1. A dashed Circle showing the coverage radius (drawn first — behind the pin)
 *   2. A Marker (custom SVG pin icon) that opens a Popup with simulation results
 *
 * Placement mode:
 *   When placementMode=true the map cursor changes to a crosshair (via CursorController)
 *   to signal that the next click will drop a sensor.  The actual click handler lives
 *   in MapViewPage.tsx; this component only manages the cursor visual.
 *
 * Why two separate .map() calls instead of one with a <Fragment key=…>?
 *   React requires Fragment keys when mapping inside JSX, which means importing Fragment
 *   from React.  Keeping two independent .map() calls — one for circles, one for markers
 *   — avoids that import entirely and produces the same DOM output.  Circles always
 *   render below markers because they appear earlier in the array.
 */
"use client";

import { useEffect } from "react";
import { Marker, Popup, Circle, useMap } from "react-leaflet";
import L from "leaflet";
import type { PlacedSensor } from "../../../lib/terrainLookup";

/** Fill colours for the coverage circle and pin icon, keyed by sensor type. */
const SENSOR_COLOR: Record<PlacedSensor["sensorType"], string> = {
  forest:  "#22c55e",  // green  — matches ElevationRiskLayer Category 3
  erosion: "#f59e0b",  // amber  — matches erosion risk Medium colour
  water:   "#00A3E0",  // sky    — SAIT Sky, matches ContaminantLayer
  flood:   "#3b82f6",  // blue   — matches ElevationRiskLayer Category 4
};

/** Human-readable label shown in the popup header alongside the coordinates. */
const SENSOR_LABEL: Record<PlacedSensor["sensorType"], string> = {
  forest:  "Forest Regrowth",
  erosion: "Soil Erosion",
  water:   "Water Quality",
  flood:   "Flood Monitoring",
};

/**
 * makePinIcon — build a Leaflet DivIcon shaped like a map pin (teardrop + white dot).
 *
 * Using an SVG pin (rather than a PNG image) means the colour is controlled at runtime
 * by passing the hex string directly into the SVG fill — no separate image file needed
 * per sensor type.
 *
 * iconAnchor [14, 36] places the bottom tip of the 40px-tall pin exactly on the sensor
 * coordinate so the pin "points to" the right spot.
 * popupAnchor [0, -38] opens the popup above the pin head, not over it.
 */
function makePinIcon(color: string): L.DivIcon {
  return L.divIcon({
    className: "",      // empty string prevents Leaflet adding its default white box class
    iconAnchor:  [14, 36],
    popupAnchor: [0, -38],
    html: `<svg width="28" height="40" viewBox="0 0 28 40" xmlns="http://www.w3.org/2000/svg">
      <path d="M14 0C6.268 0 0 6.268 0 14c0 9.333 14 26 14 26s14-16.667 14-26C28 6.268 21.732 0 14 0z" fill="${color}"/>
      <circle cx="14" cy="14" r="7" fill="white" opacity="0.92"/>
    </svg>`,
  });
}

/**
 * CursorController — invisible child component that changes the map container cursor.
 *
 * This must be a React component (not a bare useEffect in the parent) because
 * useMap() only works inside a component that is a descendant of <MapContainer>.
 * PlacedSensorLayer renders inside the map, so its children can call useMap().
 *
 * Returns null — purely a side-effect component with no rendered output.
 */
function CursorController({ placementMode }: { placementMode: boolean }) {
  const map = useMap();
  useEffect(() => {
    // Crosshair signals "click to drop sensor"; empty string restores the default pointer
    map.getContainer().style.cursor = placementMode ? "crosshair" : "";
  }, [map, placementMode]);
  return null;
}

interface Props {
  placedSensors:  PlacedSensor[];
  placementMode:  boolean;
  onRemoveSensor: (localId: string) => void; // called when user clicks "Remove pin" in the popup
}

/**
 * PlacedSensorLayer — renders all placed sensor circles and pins.
 *
 * Separated from the main JasperMap component because the sensor data and placement
 * logic are owned by MapViewPage.tsx; isolating them here keeps JasperMap.tsx clean.
 */
export function PlacedSensorLayer({ placedSensors, placementMode, onRemoveSensor }: Props) {
  return (
    <>
      {/* CursorController is rendered first so map cursor updates immediately on mode change */}
      <CursorController placementMode={placementMode} />

      {/*
        PASS 1 — Coverage circles.
        Drawn before the markers so they render below the pins in z-order.
        Each circle shows the sensor's monitoring catchment with a dashed,
        semi-transparent ring — matches the 3D ScatterplotLayer ring in ThreeDView.tsx.
      */}
      {placedSensors.map((sensor) => (
        <Circle
          key={`circle-${sensor.localId}`}  // prefix prevents key collision with marker keys below
          center={[sensor.lat, sensor.lon]}
          radius={sensor.radiusM}
          pathOptions={{
            color:       SENSOR_COLOR[sensor.sensorType],
            fillColor:   SENSOR_COLOR[sensor.sensorType],
            fillOpacity: 0.08,  // very light fill so underlying map is still readable
            opacity:     0.55,  // dashed border is visible but not dominant
            weight:      1.5,
            dashArray:   "5 4", // dashed pattern to distinguish from solid ArcGIS polygons
          }}
        />
      ))}

      {/*
        PASS 2 — Sensor pins with simulation result popups.
        Separate .map() call so circles always render below pins without needing Fragment keys.
        Each Marker has a Popup containing the full simulation output grid.
      */}
      {placedSensors.map((sensor) => {
        const color  = SENSOR_COLOR[sensor.sensorType];
        const { simulationResults: sim } = sensor;

        // Pre-compute catchment area in hectares from the radius for display in the popup.
        // This mirrors catchmentFrom() in sensorPhysics.ts but avoids importing it here
        // since the value is purely presentational and not used for any calculation.
        const areaHa = ((Math.PI * sensor.radiusM * sensor.radiusM) / 10000).toFixed(2);

        return (
          <Marker
            key={sensor.localId}
            position={[sensor.lat, sensor.lon]}
            icon={makePinIcon(color)}
          >
            <Popup minWidth={220}>
              <div style={{ fontFamily: "sans-serif", fontSize: 13, lineHeight: 1.5 }}>

                {/* Sensor name + type label + coordinates */}
                <div style={{ fontWeight: 700, marginBottom: 2, color: "#1e293b" }}>
                  {sensor.name}
                </div>
                <div style={{ fontSize: 11, color: "#64748b", marginBottom: 6 }}>
                  {SENSOR_LABEL[sensor.sensorType]} ·{" "}
                  {sensor.lat.toFixed(4)}°N, {Math.abs(sensor.lon).toFixed(4)}°W
                </div>

                {/* Terrain metadata fetched on placement via lookupTerrain() */}
                <div style={{ fontSize: 11, marginBottom: 4 }}>
                  Elevation: <strong>{sensor.elevationM} m</strong>&nbsp;·&nbsp;
                  Slope: <strong>{sensor.slopeDeg}°</strong>
                </div>

                {/* Coverage radius badge — styled to match the sensor's type colour */}
                <div style={{
                  display: "inline-block",
                  background: `${color}18`,   // 18 = 10% opacity in hex
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

                {/*
                  Simulation results grid.
                  Each field is optional because not all sensor types compute all values.
                  Fields are only rendered when the value is defined (undefined check).
                  Simulation results are snapshot at placement time — they don't update
                  if the digital twin sliders move after placement.
                */}
                <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: 6, marginBottom: 6 }}>

                  {/* Erosion rate — with colour-coded risk label */}
                  {sim.erosionRateTPerHaYr !== undefined && (
                    <div style={{ fontSize: 11 }}>
                      Erosion:&nbsp;
                      <strong>{sim.erosionRateTPerHaYr.toFixed(2)} t/ha/yr</strong>
                      {sim.erosionRiskLabel && (
                        <span style={{
                          marginLeft: 4, fontSize: 10, fontWeight: 700,
                          color: sim.erosionRiskLabel === "High"   ? "#dc2626"
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

                  {/* Forest recovery percentage from the logistic growth model */}
                  {sim.forestRecoveryPct !== undefined && (
                    <div style={{ fontSize: 11 }}>
                      Forest recovery: <strong>{sim.forestRecoveryPct.toFixed(1)}%</strong>
                    </div>
                  )}

                  {/* Peak flood discharge from the Rational Method (Q = C·i·A) */}
                  {sim.floodFlowM3s !== undefined && (
                    <div style={{ fontSize: 11 }}>
                      Flood flow (Q): <strong>{sim.floodFlowM3s.toFixed(3)} m³/s</strong>
                    </div>
                  )}

                  {/* Contaminant concentration — centre and edge of the coverage ring */}
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

                {/* Remove button — e.stopPropagation() prevents the popup from also firing */}
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

                {/*
                  Research disclaimer — required on every popup that shows model output.
                  These numbers are not verified field measurements and must not be used
                  for environmental or policy decisions.
                */}
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
