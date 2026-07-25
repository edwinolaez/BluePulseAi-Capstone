"use client";

import { useState } from "react";
import type { FieldPhoto, SimulationTag } from "../../../lib/api";
import { FilterIcon } from "../Layout/icons";

const TAG_LABELS: Record<SimulationTag, string> = {
  erosion:     "Erosion",
  contaminant: "Contaminant",
  burnScar:    "Burn Scar",
  untagged:    "Untagged",
};

const TAG_BADGE: Record<SimulationTag, string> = {
  erosion:     "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300",
  contaminant: "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300",
  burnScar:    "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300",
  untagged:    "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400",
};

type FilterState = "all" | SimulationTag;

const FILTERS: { key: FilterState; label: string }[] = [
  { key: "all",         label: "All" },
  { key: "erosion",     label: "Erosion" },
  { key: "contaminant", label: "Contaminant" },
  { key: "burnScar",    label: "Burn Scar" },
];

interface Props {
  photos?: FieldPhoto[];
}

export function FieldPhotosWidget({ photos = [] }: Props) {
  const [filter, setFilter] = useState<FilterState>("all");

  const visible = filter === "all" ? photos : photos.filter(p => p.simulationTag === filter);

  return (
    <div className="rounded-xl border border-gray-200/60 dark:border-gray-700/40 bg-surface p-3.5">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
          Field Validation Photos
        </p>
        <FilterIcon className="w-3.5 h-3.5 text-gray-400" />
      </div>

      <div className="flex gap-1 mb-3 flex-wrap">
        {FILTERS.map(f => {
          const count = f.key === "all" ? photos.length : photos.filter(p => p.simulationTag === f.key).length;
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                filter === f.key
                  ? "bg-sait-sky text-white"
                  : "bg-surface-alt text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              }`}
            >
              {f.label}
              {count > 0 && (
                <span className="ml-1 opacity-70">({count})</span>
              )}
            </button>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <div className="py-6 text-center text-xs text-gray-400 dark:text-gray-500 leading-relaxed">
          {photos.length === 0
            ? <>No photos yet.<br />Upload field photos on the Dashboard tab.</>
            : "No photos match this filter."}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {visible.map(photo => (
            <div key={photo.id} className="relative aspect-square rounded-lg overflow-hidden bg-surface-alt">
              <img
                src={photo.url}
                alt={photo.name}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-1.5 pb-1 pt-3">
                <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-semibold ${TAG_BADGE[photo.simulationTag]}`}>
                  {TAG_LABELS[photo.simulationTag]}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
