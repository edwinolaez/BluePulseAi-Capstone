"use client";

import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { TemporalSlider } from "../Controls/TemporalSlider";
import { SectorPanel } from "../Controls/SectorPanel";
import { ToggleSwitch } from "../Controls/ToggleSwitch";
import { ChartLineIcon } from "../Layout/icons";
import { WaterQualityWidget } from "../Widgets/WaterQualityWidget";
import { PipelineStatusWidget } from "../Widgets/PipelineStatusWidget";
import { ModelPerformanceWidget } from "../Widgets/ModelPerformanceWidget";
import { FieldPhotosWidget } from "../Widgets/FieldPhotosWidget";
import type { FlyToTarget } from "../Map/JasperMap";

const JasperMap = dynamic(() => import("../Map/JasperMap"), {
  ssr: false,
});

interface Props {
  flyTo?: FlyToTarget | null;
}

export function MapViewPage({ flyTo }: Props) {
  const [sectorId, setSectorId]               = useState<string | null>(null);
  const [dateFrom, setDateFrom]               = useState("2024-06-01");
  const [dateTo, setDateTo]                   = useState("2024-07-24");
  const [showBurnScar, setShowBurnScar]       = useState(true);
  const [showErosion, setShowErosion]         = useState(true);
  const [showContaminant, setShowContaminant] = useState(true);
  const [zoomIn, setZoomIn]   = useState<(() => void) | null>(null);
  const [zoomOut, setZoomOut] = useState<(() => void) | null>(null);

  const handleMapInit = useCallback((zi: () => void, zo: () => void) => {
    setZoomIn(() => zi);
    setZoomOut(() => zo);
  }, []);

  return (
    <div className="flex-1 flex min-h-0">

      {/* ── Map column ── */}
      <div className="relative flex-1 overflow-hidden">
        <div className="absolute inset-0">
          <JasperMap
            onSectorClick={setSectorId}
            activeSectorId={sectorId}
            dateFrom={dateFrom}
            dateTo={dateTo}
            showBurnScar={showBurnScar}
            showErosion={showErosion}
            showContaminant={showContaminant}
            onMapInit={handleMapInit}
            flyTo={flyTo}
          />
        </div>

        {/* Top-right: Layer toggles */}
        <div className="absolute top-4 right-4 z-[1001]">
          <div className="bg-white/95 dark:bg-surface-container/95 backdrop-blur-md rounded-xl border border-gray-200/60 dark:border-gray-700/40 p-4 min-w-[230px] shadow-xl">
            <div className="space-y-3">
              <ToggleSwitch label="Soil Erosion Risk"      dotColor="#a855f7" checked={showErosion}     onChange={setShowErosion} />
              <ToggleSwitch label="River Water Quality"    dotColor="#0ea5e9" checked={showContaminant} onChange={setShowContaminant} />
              <ToggleSwitch label="Forest Regrowth Status" dotColor="#2563eb" checked={showBurnScar}    onChange={setShowBurnScar} />
            </div>
          </div>
        </div>

        {/* Bottom: Time History slider + zoom buttons */}
        <div className="absolute bottom-4 left-4 right-4 z-[1001] flex items-end gap-3">
          <div className="flex-1 min-w-0">
            <TemporalSlider
              onDateRangeChange={(from, to) => {
                setDateFrom(from);
                setDateTo(to);
              }}
            />
          </div>
          <div className="flex flex-col gap-2 shrink-0">
            <button
              onClick={() => zoomIn?.()}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-white/95 dark:bg-surface-container/95 text-gray-800 dark:text-white text-lg shadow-lg hover:scale-105 transition-transform"
            >
              +
            </button>
            <button
              onClick={() => zoomOut?.()}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-white/95 dark:bg-surface-container/95 text-gray-800 dark:text-white text-lg shadow-lg hover:scale-105 transition-transform"
            >
              −
            </button>
          </div>
        </div>
      </div>

      {/* ── Right: Live Readings column ── */}
      <aside className="w-72 shrink-0 flex flex-col gap-3 p-4 overflow-y-auto bg-surface border-l border-gray-200/60 dark:border-gray-700/40">
        {/* Sector Panel — shows data for whichever area the user clicked */}
        <SectorPanel sectorId={sectorId} dateFrom={dateFrom} dateTo={dateTo} />

        <div className="flex items-center gap-2 px-0.5 mt-1">
          <ChartLineIcon className="w-4 h-4 text-cyan-500" />
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-700 dark:text-gray-200">
            Live Readings
          </h2>
        </div>
        <WaterQualityWidget />
        <PipelineStatusWidget />
        <ModelPerformanceWidget />
        <FieldPhotosWidget />
      </aside>

    </div>
  );
}
