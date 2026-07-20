// ThreeDView — full 3D scene using deck.gl.
//
// Base map: TerrainLayer fetches elevation data from AWS Terrain Tiles and
// drapes OSM tiles on top, giving us real Rocky Mountain topography (no API key needed).
//
// Each monitoring sector is rendered as an extruded ColumnLayer column whose:
//   - base is positioned at the sector's actual terrain elevation
//   - height encodes erosion_risk_score  (0–1 → 0–900 m above base)
//   - colour encodes risk label          (red / amber / green)
//
// All five sectors interpolate live from the timeline slider.
// Loaded dynamically (ssr: false) in MapViewPage because deck.gl uses WebGL.

"use client";

import { useEffect, useState } from "react";
import DeckGL from "@deck.gl/react";
import { ColumnLayer } from "@deck.gl/layers";
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

// OSM tiles draped as surface texture over the terrain mesh
const SURFACE_TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

// ── Sector definitions ────────────────────────────────────────────────────────

// Positions match the 2D Leaflet circles.
// elevation = approximate terrain height (m above sea level) at each sector's GPS position.
// The Jasper valley sits at ~1060 m; surrounding Rockies reach 2500–3700 m.
// Column bases are planted here so they rise from — not through — the terrain.
const SECTORS = [
  { id: "ATH-001-H", label: "High Erosion Zone",  lat: 52.858, lon: -118.092, elevation: 1380, defaultScore: 0.87, defaultRisk: "High"   },
  { id: "ATH-001-M", label: "Mid Erosion Zone",   lat: 52.870, lon: -118.070, elevation: 1180, defaultScore: 0.52, defaultRisk: "Medium" },
  { id: "ATH-001-L", label: "Low Erosion Zone",   lat: 52.884, lon: -118.045, elevation: 1090, defaultScore: 0.22, defaultRisk: "Low"    },
  { id: "ATH-001-A", label: "Burn Scar Zone",     lat: 52.882, lon: -118.065, elevation: 1100, defaultScore: 0.75, defaultRisk: "High"   },
  { id: "ATH-001-W", label: "Contaminant Zone",   lat: 52.875, lon: -118.060, elevation: 1055, defaultScore: 0.44, defaultRisk: "Medium" },
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

// ── Datum type ────────────────────────────────────────────────────────────────

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
      };
    });

  const liveCount = SECTORS.filter(s => (sectorScans[s.id]?.length ?? 0) > 0).length;

  const layers = [
    // 3D terrain — elevation mesh from AWS + OSM texture draped on top
    new TerrainLayer({
      id:               "terrain",
      minZoom:          0,
      maxZoom:          15,
      strategy:         "no-overlap",
      elevationDecoder: ELEVATION_DECODER,
      elevationData:    ELEVATION_TILES,
      texture:          SURFACE_TILES,
      elevationScale:   1,
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
      // [lon, lat, elevation] — plants each column at the correct terrain height
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
  ];

  return (
    <div className="relative w-full h-full">
      <DeckGL
        initialViewState={INITIAL_VIEW_STATE}
        controller
        layers={layers}
        getTooltip={({ object }: { object?: SectorDatum }) => {
          if (!object) return null;
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
                ${object.isEstimated ? '<div style="color:#60a5fa;font-size:10px;margin-top:4px;">● Timeline interpolated</div>' : ""}
                ${object.isActive    ? '<div style="color:#a78bfa;font-size:10px;">★ Selected</div>' : ""}
              </div>`,
            style: { background: "none" },
          };
        }}
      />

      {/* ── Legend ── */}
      <div className="absolute top-4 left-4 z-10 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm rounded-xl border border-gray-200/60 dark:border-gray-700/40 p-3 shadow-xl select-none pointer-events-none">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-2">
          Erosion Risk · 3D Terrain
        </p>
        {(["High", "Medium", "Low"] as const).map((level) => {
          const [r, g, b] = RISK_RGBA[level];
          return (
            <div key={level} className="flex items-center gap-2 mb-1 last:mb-0">
              <span className="inline-block w-3 h-3 rounded-sm flex-shrink-0"
                style={{ background: `rgb(${r},${g},${b})` }} />
              <span className="text-xs text-gray-700 dark:text-gray-300">{level}</span>
            </div>
          );
        })}
        <div className="mt-2 pt-2 border-t border-gray-200/60 dark:border-gray-700/40 space-y-0.5">
          <p className="text-[10px] text-gray-400 dark:text-gray-500">Column height = risk score</p>
          <p className="text-[10px] text-gray-400 dark:text-gray-500">Terrain = real Rocky Mtn elevation</p>
        </div>
        {liveCount > 0 && (
          <p className="text-[10px] text-green-500 mt-1.5">● {liveCount}/5 sectors live</p>
        )}
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
