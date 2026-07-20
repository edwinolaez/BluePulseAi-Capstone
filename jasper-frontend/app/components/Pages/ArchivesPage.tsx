// Archives Page — stores historical GIS survey records of the Jasper watershed.
// Users can search by name or ID, and click "View Snapshot" to expand a record.
// The snapshot preview currently shows a placeholder message — it would display
// the actual map data once connected to the archive storage backend.

"use client";

import { useState } from "react";
import { FolderIcon, HistoryIcon, LayersIcon } from "../Layout/icons";

interface Snapshot {
  id: string;
  name: string;
  date: string;
  type: "Full Survey" | "Incremental" | "Satellite Pass";
  size: string;
}

// Historical survey records — each one represents a point-in-time snapshot of the watershed.
// In production these would be loaded from the backend storage service.
const SNAPSHOTS: Snapshot[] = [
  { id: "ARC-014", name: "Pre-Fire Baseline Survey",      date: "2023-05-01", type: "Full Survey",     size: "212 MB" },
  { id: "ARC-021", name: "Post-Fire Initial Assessment",  date: "2023-08-10", type: "Full Survey",     size: "248 MB" },
  { id: "ARC-027", name: "Q4 2023 Recovery Snapshot",     date: "2023-12-15", type: "Incremental",     size: "64 MB" },
  { id: "ARC-033", name: "Sentinel-2 Winter Pass",        date: "2024-02-02", type: "Satellite Pass",  size: "97 MB" },
  { id: "ARC-041", name: "Q2 2024 Recovery Snapshot",     date: "2024-05-20", type: "Incremental",     size: "71 MB" },
  { id: "ARC-048", name: "Mid-Summer Watershed Survey",   date: "2024-07-24", type: "Full Survey",     size: "256 MB" },
];

const TYPE_BADGE: Record<Snapshot["type"], string> = {
  "Full Survey":    "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400",
  "Incremental":    "bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400",
  "Satellite Pass": "bg-cyan-50 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400",
};

export function ArchivesPage() {
  // Text typed into the search box
  const [query, setQuery] = useState("");
  // Tracks which archive row is currently expanded (only one at a time)
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Filter the list to only show records matching what the user searched for
  const visible = SNAPSHOTS.filter((s) =>
    s.name.toLowerCase().includes(query.toLowerCase()) || s.id.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-background">
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">
            Watershed Survey Archives
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Browse historical environmental survey snapshots and satellite passes for the Jasper Region.
          </p>
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search archives..."
          className="px-3 py-2 rounded-lg bg-surface-alt text-sm text-gray-800 dark:text-gray-100 placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-blue-500 min-w-[220px]"
        />
      </div>

      <div className="flex flex-col gap-3">
        {visible.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-10">No archives match &ldquo;{query}&rdquo;.</p>
        )}

        {visible.map((snap) => (
          <div key={snap.id} className="rounded-xl border border-gray-200/60 dark:border-gray-700/40 bg-surface p-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-surface-alt flex items-center justify-center shrink-0">
                  <FolderIcon className="w-4 h-4 text-gray-500 dark:text-gray-300" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{snap.name}</p>
                  <p className="text-xs font-mono text-gray-400">{snap.id} &middot; {snap.date}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 sm:gap-3 shrink-0 flex-wrap justify-end">
                <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded ${TYPE_BADGE[snap.type]}`}>
                  {snap.type}
                </span>
                <span className="hidden sm:inline text-xs text-gray-400 w-16 text-right">{snap.size}</span>
                <button
                  onClick={() => setExpandedId((id) => (id === snap.id ? null : snap.id))}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors"
                >
                  <LayersIcon className="w-3.5 h-3.5" />
                  {expandedId === snap.id ? "Hide Snapshot" : "View Snapshot"}
                </button>
              </div>
            </div>

            {expandedId === snap.id && (
              <div className="mt-4 pt-4 border-t border-gray-200/60 dark:border-gray-700/40">
                <div className="rounded-lg bg-surface-alt border border-gray-200/60 dark:border-gray-700/40 p-4 flex flex-col items-center gap-3 text-center">
                  <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <HistoryIcon className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{snap.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {snap.type} &middot; {snap.date} &middot; {snap.size}
                    </p>
                  </div>
                  <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-lg px-3 py-2 w-full">
                    Map layer preview is not available in this build — archived GIS data for <strong>{snap.id}</strong> would render here when connected to the archive storage service.
                  </p>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
