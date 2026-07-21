"use client";

import { useEffect, useState } from "react";
import DeckGL from "@deck.gl/react";
import { LightingEffect, AmbientLight, DirectionalLight } from "@deck.gl/core";
import { ColumnLayer, ScatterplotLayer, PolygonLayer } from "@deck.gl/layers";
import { TerrainLayer } from "@deck.gl/geo-layers";
import { fetchTimeline } from "../../../lib/api";
import type { TimelineScan } from "../../../lib/api";
import { interpolateScans } from "../../../lib/interpolation";
import type { InterpolatedState } from "../../../lib/interpolation";

// ── View ─────────────────────────────────────────────────────────────────────

const INITIAL_VIEW_STATE = {
  longitude:  -118.070,
  latitude:    52.872,
  zoom:        11.8,
  pitch:       62,           // steep angle to show Rocky Mountain terrain clearly
  bearing:    -25,
  minZoom:     10,
  maxZoom:     16,
};

// ── Terrain tiles ─────────────────────────────────────────────────────────────

// AWS Terrain Tiles — Terrarium encoding, public, no API key required
const ELEVATION_TILES = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";

// Terrarium decoding: elevation (m) = R×256 + G + B/256 − 32768
const ELEVATION_DECODER = {
  rScaler:  256,
  gScaler:  1,
  bScaler:  1 / 256,
  offset:  -32768,
};

// ESRI World Imagery — free satellite tiles, no API key, much higher visual quality than OSM
// Note: ESRI uses {z}/{y}/{x} ordering (row/col), not {z}/{x}/{y}
const SURFACE_TILES = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

// ── Lighting ──────────────────────────────────────────────────────────────────

// Simulates afternoon sun over the Rockies — southwest direction, moderate elevation angle
const SUN_LIGHT   = new DirectionalLight({ color: [255, 248, 220], intensity: 1.8, direction: [-2, -3, -1] });
const SKY_AMBIENT = new AmbientLight({ color: [200, 220, 255], intensity: 0.6 });
const LIGHTING    = new LightingEffect({ SUN_LIGHT, SKY_AMBIENT });

// ── Sector definitions ────────────────────────────────────────────────────────

// Sector GPS positions and elevations.
// ★ = real public-database coordinates   ○ = estimated (no public point-sensor network exists)
//
// ATH-001-W: Water Survey of Canada station 07AA001, Miette River at Jasper
//            Source: wateroffice.ec.gc.ca
// ATH-001-A: 2024 Jasper Wildfire burn-scar centroid
//            Source: Alberta Wildfire open data / NFDB fire polygon
// ATH-001-H/M/L: approximate erosion-risk zones derived from DEM terrain analysis
//                (no public point-sensor network for soil erosion in Jasper NP)
const SECTORS = [
  { id: "ATH-001-H", label: "High Erosion Zone",          lat: 52.858,  lon: -118.092,  elevation: 1380, defaultScore: 0.87, defaultRisk: "High",   source: ""                      },
  { id: "ATH-001-M", label: "Mid Erosion Zone",            lat: 52.870,  lon: -118.070,  elevation: 1180, defaultScore: 0.52, defaultRisk: "Medium", source: ""                      },
  { id: "ATH-001-L", label: "Low Erosion Zone",            lat: 52.884,  lon: -118.045,  elevation: 1090, defaultScore: 0.22, defaultRisk: "Low",    source: ""                      },
  { id: "ATH-001-A", label: "2024 Wildfire Burn Scar",     lat: 52.848,  lon: -118.083,  elevation: 1080, defaultScore: 0.75, defaultRisk: "High",   source: "Alberta Wildfire 2024" },
  { id: "ATH-001-W", label: "Miette River (WSC 07AA001)",  lat: 52.8639, lon: -118.1069, elevation: 1062, defaultScore: 0.44, defaultRisk: "Medium", source: "WSC 07AA001"           },
] as const;

type SectorId = typeof SECTORS[number]["id"];

// ── Visibility mapping ────────────────────────────────────────────────────────

const SECTOR_LAYER: Record<SectorId, "erosion" | "contaminant" | "burnScar"> = {
  "ATH-001-H": "erosion",
  "ATH-001-M": "erosion",
  "ATH-001-L": "erosion",
  "ATH-001-W": "contaminant",
  "ATH-001-A": "burnScar",
};

// ── Colour map ────────────────────────────────────────────────────────────────

const RISK_RGBA: Record<string, [number, number, number, number]> = {
  High:   [239, 68,  68,  220],
  Medium: [245, 158, 11,  220],
  Low:    [34,  197, 94,  220],
};

// Sensor dot colours — match the toggle dotColor props in MapViewPage
const SENSOR_COLOR: Record<"erosion" | "contaminant" | "burnScar", [number, number, number, number]> = {
  erosion:     [109, 32,  119, 255],  // #6D2077 SAIT Purple  — Soil Erosion
  contaminant: [0,   163, 224, 255],  // #00A3E0 SAIT Sky    — River Water Quality
  burnScar:    [0,   94,  184, 255],  // #005EB8 SAIT Blue   — Forest Regrowth
};


// ── Datum types ───────────────────────────────────────────────────────────────

interface SensorDot {
  id:        SectorId;
  label:     string;
  lon:       number;
  lat:       number;
  elevation: number;
  layerType: "erosion" | "contaminant" | "burnScar";
}

interface SectorDatum {
  id:          SectorId;
  label:       string;
  lat:         number;
  lon:         number;
  elevation:   number;
  score:       number;
  risk:        string;
  isActive:    boolean;
  isEstimated: boolean;
  source:      string;
}

interface OsmBuilding {
  polygon: [number, number][];
  height:  number;
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  centerDate:      string;
  activeSectorId:  string | null;
  onSectorClick:   (id: string) => void;
  showErosion:     boolean;
  showContaminant: boolean;
  showBurnScar:    boolean;
}

export function ThreeDView({
  centerDate,
  activeSectorId,
  onSectorClick,
  showErosion,
  showContaminant,
  showBurnScar,
}: Props) {

  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);

  const handleZoomIn  = () => setViewState(v => ({ ...v, zoom: Math.min(v.zoom + 1, INITIAL_VIEW_STATE.maxZoom),  transitionDuration: 250 }));
  const handleZoomOut = () => setViewState(v => ({ ...v, zoom: Math.max(v.zoom - 1, INITIAL_VIEW_STATE.minZoom), transitionDuration: 250 }));

  const [sectorScans, setSectorScans] = useState<Record<string, TimelineScan[]>>(
    () => Object.fromEntries(SECTORS.map(s => [s.id, []]))
  );
  const [sectorInterps, setSectorInterps] = useState<Record<string, InterpolatedState | null>>(
    () => Object.fromEntries(SECTORS.map(s => [s.id, null]))
  );

  // Fetch all five sector timelines in parallel on mount
  useEffect(() => {
    let cancelled = false;
    SECTORS.forEach(async (s) => {
      try {
        const data = await fetchTimeline(s.id);
        if (!cancelled) setSectorScans(prev => ({ ...prev, [s.id]: data.scans }));
      } catch {
        // backend has no scans for this sector yet — keep empty array
      }
    });
    return () => { cancelled = true; };
  }, []);

  // Re-interpolate every sector on every slider tick
  useEffect(() => {
    const ms = new Date(centerDate).getTime();
    setSectorInterps(
      Object.fromEntries(
        SECTORS.map(s => [s.id, interpolateScans(sectorScans[s.id] ?? [], ms)])
      )
    );
  }, [centerDate, sectorScans]);

  const [buildings, setBuildings] = useState<OsmBuilding[]>([]);

  // Fetch OSM building footprints for Jasper townsite on mount
  useEffect(() => {
    const query = `
      [out:json][timeout:25];
      (way["building"](52.84,-118.16,52.92,-118.03););
      out body;>;out skel qt;
    `;
    fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`)
      .then(r => r.json())
      .then((json: { elements: { type: string; id: number; lat?: number; lon?: number; nodes?: number[]; tags?: Record<string, string> }[] }) => {
        const nodes = new Map<number, [number, number]>();
        for (const el of json.elements) {
          if (el.type === "node" && el.lon != null && el.lat != null)
            nodes.set(el.id, [el.lon, el.lat]);
        }
        const polys: OsmBuilding[] = [];
        for (const el of json.elements) {
          if (el.type !== "way" || !el.nodes) continue;
          const coords = el.nodes.map(id => nodes.get(id)).filter((c): c is [number, number] => c != null);
          if (coords.length < 3) continue;
          const levels = parseFloat(el.tags?.["building:levels"] ?? "2");
          const tagged = parseFloat(el.tags?.["height"] ?? "0");
          polys.push({ polygon: coords, height: tagged > 0 ? tagged : levels * 3.2 });
        }
        setBuildings(polys);
      })
      .catch(() => { /* Overpass unavailable — render without buildings */ });
  }, []);

  const layerVisible: Record<string, boolean> = {
    erosion:     showErosion,
    contaminant: showContaminant,
    burnScar:    showBurnScar,
  };

  const data: SectorDatum[] = SECTORS
    .filter(s => layerVisible[SECTOR_LAYER[s.id]])
    .map((s) => {
      const interp = sectorInterps[s.id];
      return {
        id:          s.id,
        label:       s.label,
        lat:         s.lat,
        lon:         s.lon,
        elevation:   s.elevation,
        score:       interp ? interp.erosion_risk_score : s.defaultScore,
        risk:        interp ? interp.erosion_risk       : s.defaultRisk,
        isActive:    s.id === activeSectorId,
        isEstimated: interp ? interp.is_estimated : false,
        source:      s.source,
      };
    });

  const liveCount = SECTORS.filter(s => (sectorScans[s.id]?.length ?? 0) > 0).length;

  // Sensor dots — always visible regardless of layer toggles
  const sensorDots: SensorDot[] = SECTORS
    .map(s => ({
      id:        s.id,
      label:     s.label,
      lon:       s.lon,
      lat:       s.lat,
      elevation: s.elevation + 50,
      layerType: SECTOR_LAYER[s.id],
    }));

  const layers = [
    // 3D terrain — high-res elevation mesh with satellite imagery draped on top
    new TerrainLayer({
      id:               "terrain",
      minZoom:          0,
      maxZoom:          15,
      strategy:         "no-overlap",
      elevationDecoder: ELEVATION_DECODER,
      elevationData:    ELEVATION_TILES,
      texture:          SURFACE_TILES,
      elevationScale:   1,
      meshMaxError:     1.5,   // default 4m — lower = sharper ridgelines and valleys
    }),

    // OSM 3D buildings — extruded footprints from Overpass API
    new PolygonLayer<OsmBuilding>({
      id:                   "osm-buildings",
      data:                 buildings,
      getPolygon:           (d) => d.polygon,
      getElevation:         (d) => d.height,
      getFillColor:         [235, 228, 215, 210],
      getLineColor:         [180, 170, 155, 120],
      lineWidthMinPixels:   1,
      extruded:             true,
      pickable:             false,
      material: {
        ambient:       0.35,
        diffuse:       0.65,
        shininess:     24,
        specularColor: [255, 255, 255],
      },
    }),

    // Sensor location dots — visual only, not pickable (hit-target layer below handles events)
    new ScatterplotLayer<SensorDot>({
      id:                  "sensor-dots",
      data:                sensorDots,
      getPosition:         (d) => [d.lon, d.lat, d.elevation],
      getFillColor:        (d) => SENSOR_COLOR[d.layerType],
      getLineColor:        [255, 255, 255, 220],
      getRadius:           160,
      radiusMinPixels:     6,
      radiusMaxPixels:     12,
      filled:              true,
      stroked:             true,
      lineWidthMinPixels:  2,
      pickable:            false,
    }),

    // Risk columns — bases anchored at sector terrain elevation, height = risk score
    new ColumnLayer<SectorDatum>({
      id:             "sector-columns",
      data,
      diskResolution: 32,
      radius:         650,
      extruded:       true,
      pickable:       true,
      opacity:        0.88,
      getPosition:    (d) => [d.lon, d.lat, d.elevation],
      getElevation:   (d) => d.score * 900,
      getFillColor:   (d) => RISK_RGBA[d.risk] ?? RISK_RGBA.Medium,
      getLineColor:   [20, 20, 20, 60],
      lineWidthMinPixels: 1,
      updateTriggers: {
        getElevation: [centerDate, showErosion, showContaminant, showBurnScar],
        getFillColor:  [centerDate, showErosion, showContaminant, showBurnScar],
      },
      onClick: (info) => {
        if (info.object) onSectorClick(info.object.id);
      },
    }),

    // Transparent hit-target layer for sensor dots — rendered last so it wins picking over columns.
    // Larger radius makes hover + click reliable without changing the visual dot size.
    new ScatterplotLayer<SensorDot>({
      id:              "sensor-dots-hit",
      data:            sensorDots,
      getPosition:     (d) => [d.lon, d.lat, d.elevation],
      getFillColor:    [0, 0, 0, 0],
      getLineColor:    [0, 0, 0, 0],
      getRadius:       350,
      radiusMinPixels: 20,
      radiusMaxPixels: 32,
      filled:          true,
      stroked:         false,
      pickable:        true,
      onClick: (info) => {
        if (info.object) onSectorClick(info.object.id);
      },
    }),
  ];

  return (
    <div className="relative w-full h-full">
      <DeckGL
        viewState={viewState}
        onViewStateChange={({ viewState: vs }) => setViewState(vs as typeof INITIAL_VIEW_STATE)}
        controller
        layers={layers}
        effects={[LIGHTING]}
        getTooltip={({ object }: { object?: SectorDatum | SensorDot }) => {
          if (!object) return null;

          const SENSOR_TYPE_LABEL: Record<"erosion" | "contaminant" | "burnScar", string> = {
            erosion:     "Soil Erosion Sensor",
            contaminant: "River Water Quality Sensor",
            burnScar:    "Forest Regrowth Sensor",
          };

          // Sensor dot hover — show name + coordinates
          if ("layerType" in object) {
            const latStr = `${Math.abs(object.lat).toFixed(4)}°${object.lat >= 0 ? "N" : "S"}`;
            const lonStr = `${Math.abs(object.lon).toFixed(4)}°${object.lon >= 0 ? "E" : "W"}`;
            return {
              html: `
                <div style="
                  background:#1e293b;color:#f1f5f9;
                  padding:10px 14px;border-radius:10px;
                  font-size:12px;line-height:1.7;
                  box-shadow:0 4px 20px rgba(0,0,0,.4);
                ">
                  <div style="font-weight:700;margin-bottom:4px;">${object.label}</div>
                  <div style="color:#94a3b8;font-size:11px;margin-bottom:4px;">${SENSOR_TYPE_LABEL[object.layerType]}</div>
                  <div>ID: <span style="color:#94a3b8">${object.id}</span></div>
                  <div>Location: <span style="color:#94a3b8">${latStr}, ${lonStr}</span></div>
                  <div style="color:#64748b;font-size:10px;margin-top:4px;">Click to select sector</div>
                </div>`,
              style: { background: "none" },
            };
          }

          // Column hover — show full risk detail
          return {
            html: `
              <div style="
                background:#1e293b;color:#f1f5f9;
                padding:10px 14px;border-radius:10px;
                font-size:12px;line-height:1.7;
                box-shadow:0 4px 20px rgba(0,0,0,.4);
              ">
                <div style="font-weight:700;margin-bottom:4px;">${object.label}</div>
                <div>Risk: <span style="font-weight:600">${object.risk}</span></div>
                <div>Score: <span style="font-weight:600">${(object.score * 100).toFixed(0)} %</span></div>
                <div>Terrain: <span style="color:#94a3b8">${object.elevation.toLocaleString()} m asl</span></div>
                <div>ID: <span style="color:#94a3b8">${object.id}</span></div>
                ${object.source      ? `<div style="color:#34d399;font-size:10px;margin-top:4px;">★ ${object.source}</div>` : '<div style="color:#94a3b8;font-size:10px;margin-top:4px;">○ Estimated position</div>'}
                ${object.isEstimated ? '<div style="color:#00A3E0;font-size:10px;">● Timeline interpolated</div>' : ""}
                ${object.isActive    ? '<div style="color:#6D2077;font-size:10px;">★ Selected</div>' : ""}
              </div>`,
            style: { background: "none" },
          };
        }}
      />

      {/* ── Live count badge ── */}
      {liveCount > 0 && (
        <div className="absolute top-4 left-4 z-10 pointer-events-none">
          <div className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm rounded-full px-2.5 py-1 shadow text-[10px] text-green-500 font-semibold border border-gray-200/60 dark:border-gray-700/40">
            ● {liveCount}/5 live
          </div>
        </div>
      )}

      {/* ── Zoom buttons ── */}
      <div className="absolute bottom-16 right-4 hidden md:flex flex-col gap-2">
        <button
          onClick={handleZoomIn}
          title="Zoom in"
          className="w-9 h-9 flex items-center justify-center rounded-full bg-white dark:bg-gray-800 text-gray-800 dark:text-white shadow-lg hover:scale-105 hover:bg-sait-sky/10 dark:hover:bg-gray-700 transition-transform border border-gray-200/60 dark:border-gray-600"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="8" y1="2" x2="8" y2="14" />
            <line x1="2" y1="8" x2="14" y2="8" />
          </svg>
        </button>
        <button
          onClick={handleZoomOut}
          title="Zoom out"
          className="w-9 h-9 flex items-center justify-center rounded-full bg-white dark:bg-gray-800 text-gray-800 dark:text-white shadow-lg hover:scale-105 hover:bg-sait-sky/10 dark:hover:bg-gray-700 transition-transform border border-gray-200/60 dark:border-gray-600"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="2" y1="8" x2="14" y2="8" />
          </svg>
        </button>
      </div>

      {/* ── Navigation hint ── */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-none">
        <div className="bg-black/50 text-white/80 text-[10px] px-3 py-1.5 rounded-full backdrop-blur-sm">
          Drag to orbit · Scroll to zoom · Click column to select
        </div>
      </div>
    </div>
  );
}
