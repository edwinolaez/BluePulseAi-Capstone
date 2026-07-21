"use client";

import { useContext, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { anyApi } from "convex/server";
import { ConvexAvailableContext } from "../Providers/ConvexClientProvider";

const SECTORS = [
  { id: "ATH-001-H", label: "Sector H — Upper Highlands" },
  { id: "ATH-001-W", label: "Sector W — Miette River Corridor" },
  { id: "ATH-001-A", label: "Sector A — Burn Scar Zone" },
  { id: "ATH-001-M", label: "Sector M — Mid Erosion Zone" },
];

type ScanStatus = "processing" | "ready" | "error";

interface Scan {
  _id: string;
  filename: string;
  sectorId: string;
  scanDate: number;
  fileSize: number;
  mimeType: string;
  status: ScanStatus;
  uploadedBy: string;
  notes?: string;
  url: string | null;
}

const MOCK_SCANS: Scan[] = [
  { _id: "m1", filename: "sector-h-rgb-survey.jpg",     sectorId: "ATH-001-H", scanDate: Date.now() - 2 * 3600000,  fileSize: 18420000, mimeType: "image/jpeg", status: "ready",      uploadedBy: "CIRUS Team", notes: "Post-erosion RGB survey flight", url: null },
  { _id: "m2", filename: "miette-thermal-overlay.jpg",  sectorId: "ATH-001-W", scanDate: Date.now() - 26 * 3600000, fileSize: 12840000, mimeType: "image/jpeg", status: "ready",      uploadedBy: "CIRUS Team", notes: "River temp thermal overlay",     url: null },
  { _id: "m3", filename: "burn-scar-multispectral.tif", sectorId: "ATH-001-A", scanDate: Date.now() - 72 * 3600000, fileSize: 34100000, mimeType: "image/tiff", status: "processing", uploadedBy: "CIRUS Team", url: null },
  { _id: "m4", filename: "mid-erosion-zone-rgb.jpg",    sectorId: "ATH-001-M", scanDate: Date.now() - 96 * 3600000, fileSize: 15200000, mimeType: "image/jpeg", status: "ready",      uploadedBy: "CIRUS Team", notes: "Comparison with baseline",         url: null },
];

function fmtSize(bytes: number) {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
  return `${(bytes / 1e3).toFixed(0)} KB`;
}

function fmtDate(ts: number) {
  const diff = Date.now() - ts;
  const h = Math.floor(diff / 3600000);
  if (h < 1) return "Just now";
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

const STATUS_STYLE: Record<ScanStatus, { dot: string; label: string; text: string }> = {
  ready:      { dot: "bg-green-500",  label: "Ready",      text: "text-green-600 dark:text-green-400" },
  processing: { dot: "bg-amber-500 animate-pulse", label: "Processing", text: "text-amber-600 dark:text-amber-400" },
  error:      { dot: "bg-red-500",    label: "Error",       text: "text-red-600 dark:text-red-400" },
};

function ScanCard({ scan, onDelete }: { scan: Scan; onDelete?: (id: string) => void }) {
  const style = STATUS_STYLE[scan.status];
  const sector = SECTORS.find((s) => s.id === scan.sectorId);
  const isImage = scan.mimeType.startsWith("image/");

  return (
    <div className="flex gap-3 p-3 rounded-xl border border-gray-200/60 dark:border-gray-700/40 bg-surface-alt/50 hover:bg-surface-alt transition-colors">
      {/* Thumbnail / file type badge */}
      <div className="w-14 h-14 rounded-lg shrink-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800 overflow-hidden">
        {scan.url && isImage ? (
          <img src={scan.url} alt={scan.filename} className="w-full h-full object-cover" />
        ) : (
          <svg className="w-7 h-7 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            {isImage
              ? <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3 6.75h18M4.5 6.75A.75.75 0 015.25 6h13.5a.75.75 0 01.75.75v10.5a.75.75 0 01-.75.75H5.25a.75.75 0 01-.75-.75V6.75z" />
              : <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            }
          </svg>
        )}
      </div>

      {/* Meta */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">{scan.filename}</p>
          <div className={`flex items-center gap-1 text-[10px] font-semibold shrink-0 ${style.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
            {style.label}
          </div>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
          {sector?.label ?? scan.sectorId}
        </p>
        <div className="flex items-center gap-3 mt-1.5 text-[10px] text-gray-400 dark:text-gray-500">
          <span>{fmtSize(scan.fileSize)}</span>
          <span>·</span>
          <span>{fmtDate(scan.scanDate)}</span>
          {scan.notes && <><span>·</span><span className="truncate max-w-[140px]">{scan.notes}</span></>}
        </div>
      </div>

      {/* Actions */}
      {onDelete && (
        <button
          onClick={() => onDelete(scan._id)}
          className="shrink-0 mt-0.5 p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          title="Remove scan"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}

// ── Live inner component — only rendered when Convex is configured ──────────
function LiveDroneScanWidget({ filterSector }: { filterSector: string }) {
  const scans = useQuery(anyApi.droneScans.listScans, {
    sectorId: filterSector === "all" ? undefined : filterSector,
  }) as Scan[] | undefined;

  const generateUploadUrl = useMutation(anyApi.droneScans.generateUploadUrl);
  const saveScan          = useMutation(anyApi.droneScans.saveScan);
  const deleteScan        = useMutation(anyApi.droneScans.deleteScan);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading]   = useState(false);
  const [progress, setProgress]     = useState(0);
  const [dragOver, setDragOver]     = useState(false);
  const [notes, setNotes]           = useState("");
  const [sector, setSector]         = useState(SECTORS[0].id);

  async function upload(file: File) {
    setUploading(true);
    setProgress(10);
    try {
      const url = await generateUploadUrl({});
      setProgress(30);

      const xhr = new XMLHttpRequest();
      await new Promise<void>((resolve, reject) => {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setProgress(30 + Math.round((e.loaded / e.total) * 55));
        };
        xhr.onload  = () => (xhr.status === 200 ? resolve() : reject(new Error("Upload failed")));
        xhr.onerror = () => reject(new Error("Network error"));
        xhr.open("POST", url);
        xhr.setRequestHeader("Content-Type", file.type);
        xhr.send(file);
      });
      setProgress(90);

      const storageId = JSON.parse(xhr.responseText).storageId;
      await saveScan({
        storageId,
        filename:   file.name,
        uploadedBy: "CIRUS Team",
        sectorId:   sector,
        scanDate:   Date.now(),
        notes:      notes.trim() || undefined,
        fileSize:   file.size,
        mimeType:   file.type,
      });
      setProgress(100);
      setNotes("");
    } finally {
      setTimeout(() => { setUploading(false); setProgress(0); }, 600);
    }
  }

  return (
    <div className="space-y-4">
      {/* Upload drop zone */}
      <div
        className={`relative border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer ${
          dragOver
            ? "border-sait-red bg-sait-red/5"
            : "border-gray-200 dark:border-gray-700 hover:border-sait-red/60"
        }`}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) upload(f); }}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept="image/*,.tif,.tiff,.geotiff"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }}
        />
        <svg className="w-8 h-8 mx-auto mb-2 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
        </svg>
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">Drop scan file or click to browse</p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">JPEG, PNG, GeoTIFF · Max 500 MB</p>

        {uploading && (
          <div className="absolute inset-x-4 bottom-3">
            <div className="h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
              <div className="h-full rounded-full bg-sait-sky transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* Metadata row */}
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
        <select
          value={sector}
          onChange={(e) => setSector(e.target.value)}
          className="text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-surface px-3 py-2 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-sait-sky"
        >
          {SECTORS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <input
          type="text"
          placeholder="Notes (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-surface px-3 py-2 text-gray-800 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-sait-sky"
        />
      </div>

      {/* Scan list */}
      {!scans ? (
        <div className="flex items-center justify-center py-8 text-gray-400 text-sm">Loading scans…</div>
      ) : scans.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 gap-2 text-gray-400">
          <svg className="w-10 h-10 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909" />
          </svg>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No scans yet — upload your first file above</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {scans.map((scan) => (
            <ScanCard key={scan._id} scan={scan} onDelete={(id) => deleteScan({ id: id as never })} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Outer widget — renders mock when Convex is not configured ───────────────
export function DroneScanWidget() {
  const isConvexReady = useContext(ConvexAvailableContext);
  const [filterSector, setFilterSector] = useState("all");

  return (
    <div className="rounded-xl border border-gray-200/60 dark:border-gray-700/40 bg-surface p-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-sait-sky/10 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-sait-sky" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-bold text-gray-800 dark:text-gray-100">CIRUS Drone Scans</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">Upload and manage aerial survey imagery</p>
          </div>
        </div>

        {/* Sector filter */}
        <div className="flex flex-wrap gap-1 p-1 rounded-lg bg-surface-alt self-start">
          <button
            onClick={() => setFilterSector("all")}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${filterSector === "all" ? "bg-sait-red text-white shadow" : "text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"}`}
          >
            All
          </button>
          {SECTORS.map((s) => (
            <button
              key={s.id}
              onClick={() => setFilterSector(s.id)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${filterSector === s.id ? "bg-sait-red text-white shadow" : "text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"}`}
            >
              {s.id}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      {isConvexReady ? (
        <LiveDroneScanWidget filterSector={filterSector} />
      ) : (
        <div className="space-y-4">
          {/* Static mock drop zone */}
          <div className="border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl p-6 text-center">
            <svg className="w-8 h-8 mx-auto mb-2 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">Drop scan file or click to browse</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">JPEG, PNG, GeoTIFF · Max 500 MB</p>
            <p className="text-[10px] text-amber-500 mt-2 font-medium">Connect Convex to enable uploads</p>
          </div>
          <div className="flex flex-col gap-2">
            {MOCK_SCANS.filter((s) => filterSector === "all" || s.sectorId === filterSector).map((scan) => (
              <ScanCard key={scan._id} scan={scan} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
