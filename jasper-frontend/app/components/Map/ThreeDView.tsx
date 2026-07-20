// ThreeDView renders the five monitoring sectors as 3D extruded columns using deck.gl.
// Column height encodes erosion_risk_score (0–1 → 0–900 m).
// Column colour encodes the risk label (red / amber / green).
// All five sectors fetch their own timeline data and interpolate independently
// as the slider moves — so every column animates, not just the selected one.
// Loaded dynamically (ssr: false) in MapViewPage because deck.gl uses WebGL.

"use client";

import { useEffect, useState } from "react";
import DeckGL from "@deck.gl/react";
import { ColumnLayer, BitmapLayer } from "@deck.gl/layers";
import { TileLayer } from "@deck.gl/geo-layers";
import { fetchTimeline } from "../../../lib/api";
import type { TimelineScan } from "../../../lib/api";
import { interpolateScans } from "../../../lib/interpolation";
import type { InterpolatedState } from "../../../lib/interpolation";

// ── View ─────────────────────────────────────────────────────────────────────

const INITIAL_VIEW_STATE = {
  longitude:  -118.070,
  latitude:    52.875,
  zoom:        12.3,
  pitch:       55,
  bearing:    -20,
  minZoom:     10,
  maxZoom:     18,
};

// ── Sector definitions ────────────────────────────────────────────────────────

// Positions match the 2D Leaflet circles in ErosionLayer, BurnScarLayer,
// and ContaminantLayer so both views feel consistent.
const SECTORS = [
  { id: "ATH-001-H", label: "High Erosion Zone",  lat: 52.858, lon: -118.092, defaultScore: 0.87, defaultRisk: "High"   },
  { id: "ATH-001-M", label: "Mid Erosion Zone",   lat: 52.870, lon: -118.070, defaultScore: 0.52, defaultRisk: "Medium" },
  { id: "ATH-001-L", label: "Low Erosion Zone",   lat: 52.884, lon: -118.045, defaultScore: 0.22, defaultRisk: "Low"    },
  { id: "ATH-001-A", label: "Burn Scar Zone",     lat: 52.882, lon: -118.065, defaultScore: 0.75, defaultRisk: "High"   },
  { id: "ATH-001-W", label: "Contaminant Zone",   lat: 52.875, lon: -118.060, defaultScore: 0.44, defaultRisk: "Medium" },
] as const;

type SectorId = typeof SECTORS[number]["id"];

// ── Colour map ────────────────────────────────────────────────────────────────

const RISK_RGBA: Record<string, [number, number, number, number]> = {
  High:   [239, 68,  68,  215],  // red-500
  Medium: [245, 158, 11,  215],  // amber-500
  Low:    [34,  197, 94,  215],  // green-500
};

// ── Datum type ────────────────────────────────────────────────────────────────

interface SectorDatum {
  id:          SectorId;
  label:       string;
  lat:         number;
  lon:         number;
  score:       number;
  risk:        string;
  isActive:    boolean;
  isEstimated: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  centerDate:     string;        // ISO date from the timeline slider
  activeSectorId: string | null;
  onSectorClick:  (id: string) => void;
}

export function ThreeDView({ centerDate, activeSectorId, onSectorClick }: Props) {

  // One entry per sector — populated by parallel fetchTimeline calls on mount
  const [sectorScans, setSectorScans] = useState<Record<string, TimelineScan[]>>(
    () => Object.fromEntries(SECTORS.map(s => [s.id, []]))
  );

  // Interpolated state per sector — recomputed whenever the slider moves
  const [sectorInterps, setSectorInterps] = useState<Record<string, InterpolatedState | null>>(
    () => Object.fromEntries(SECTORS.map(s => [s.id, null]))
  );

  // Fetch all five sector timelines in parallel on mount
  useEffect(() => {
    let cancelled = false;
    SECTORS.forEach(async (s) => {
      try {
        const data = await fetchTimeline(s.id);
        if (!cancelled) {
          setSectorScans(prev => ({ ...prev, [s.id]: data.scans }));
        }
      } catch {
        // backend has no data for this sector yet — keep the empty array default
      }
    });
    return () => { cancelled = true; };
  }, []);

  // Re-interpolate every sector whenever the slider date or scan data changes
  useEffect(() => {
    const ms = new Date(centerDate).getTime();
    setSectorInterps(
      Object.fromEntries(
        SECTORS.map(s => [s.id, interpolateScans(sectorScans[s.id] ?? [], ms)])
      )
    );
  }, [centerDate, sectorScans]);

  // Build the ColumnLayer data array — prefer live interpolated values, fall back to defaults
  const data: SectorDatum[] = SECTORS.map((s) => {
    const interp = sectorInterps[s.id];
    const isActive = s.id === activeSectorId;
    return {
      id:          s.id,
      label:       s.label,
      lat:         s.lat,
      lon:         s.lon,
      score:       interp ? interp.erosion_risk_score : s.defaultScore,
      risk:        interp ? interp.erosion_risk       : s.defaultRisk,
      isActive,
      isEstimated: interp ? interp.is_estimated : false,
    };
  });

  const layers = [
    // OSM base map tiles rendered as flat bitmaps beneath the 3D columns
    new TileLayer({
      id:       "osm-tiles",
      data:     "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png",
      tileSize: 256,
      renderSubLayers(props: Parameters<NonNullable<ConstructorParameters<typeof TileLayer>[0]["renderSubLayers"]>>[0]) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const bbox = (props.tile as any).bbox as { west: number; south: number; east: number; north: number };
        return new BitmapLayer({
          ...props,
          data:  undefined,
          // props.data is the resolved tile image at runtime; TypeScript types it as URLTemplate
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          image:  props.data as any,
          bounds: [bbox.west, bbox.south, bbox.east, bbox.north],
        });
      },
    }),

    // One extruded column per monitoring sector — all animated by the slider
    new ColumnLayer<SectorDatum>({
      id:             "sector-columns",
      data,
      diskResolution: 32,
      radius:         700,
      extruded:       true,
      pickable:       true,
      opacity:        0.9,
      getPosition:    (d) => [d.lon, d.lat],
      getElevation:   (d) => d.score * 900,
      getFillColor:   (d) => RISK_RGBA[d.risk] ?? RISK_RGBA.Medium,
      getLineColor:   [20, 20, 20, 60],
      lineWidthMinPixels: 1,
      // Trigger re-evaluation on every slider tick (centerDate drives all five interpolations)
      updateTriggers: {
        getElevation: centerDate,
        getFillColor:  centerDate,
      },
      onClick: (info) => {
        if (info.object) onSectorClick(info.object.id);
      },
    }),
  ];

  // Count how many sectors have live data (vs. still using hardcoded defaults)
  const liveCount = SECTORS.filter(s => (sectorScans[s.id]?.length ?? 0) > 0).length;

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
                <div>ID: <span style="color:#94a3b8">${object.id}</span></div>
                ${object.isEstimated
                  ? '<div style="color:#60a5fa;font-size:10px;margin-top:4px;">● Timeline interpolated</div>'
                  : ""}
                ${object.isActive
                  ? '<div style="color:#a78bfa;font-size:10px;">★ Selected</div>'
                  : ""}
              </div>`,
            style: { background: "none" },
          };
        }}
      />

      {/* ── Legend ── */}
      <div className="absolute top-4 left-4 z-10 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm rounded-xl border border-gray-200/60 dark:border-gray-700/40 p-3 shadow-xl select-none pointer-events-none">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-2">
          Erosion Risk · 3D
        </p>
        {(["High", "Medium", "Low"] as const).map((level) => {
          const [r, g, b] = RISK_RGBA[level];
          return (
            <div key={level} className="flex items-center gap-2 mb-1 last:mb-0">
              <span
                className="inline-block w-3 h-3 rounded-sm flex-shrink-0"
                style={{ background: `rgb(${r},${g},${b})` }}
              />
              <span className="text-xs text-gray-700 dark:text-gray-300">{level}</span>
            </div>
          );
        })}
        <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-2 leading-tight">
          Column height = risk score<br />
          Click a column to select
        </p>
        {liveCount > 0 && (
          <p className="text-[10px] text-green-500 mt-1.5">
            ● {liveCount}/5 sectors live
          </p>
        )}
      </div>

      {/* ── Navigation hint ── */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-none">
        <div className="bg-black/50 text-white/80 text-[10px] px-3 py-1.5 rounded-full backdrop-blur-sm">
          Drag to rotate · Scroll to zoom · Click column to select
        </div>
      </div>
    </div>
  );
}
