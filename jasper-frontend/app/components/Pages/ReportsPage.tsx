"use client";

import { useState } from "react";
import { CheckCircleIcon, ClockIcon, DownloadIcon, SendIcon } from "../Layout/icons";

type Category = "Hydro-geology" | "Limnology" | "Remote Sensing" | "Model Output";
type Status = "Ready" | "Running..." | "Draft Model";

interface Report {
  id: string;
  category: Category;
  title: string;
  author: string;
  date: string;
  fileSize: string;
  status: Status;
}

const CATEGORIES: ("All" | Category)[] = ["All", "Hydro-geology", "Limnology", "Remote Sensing", "Model Output"];

const INITIAL_REPORTS: Report[] = [
  { id: "REP-001", category: "Hydro-geology",  title: "Jasper Post-Fire Runoff & Erosion Risk Model",          author: "Dr. Eleanor Vance",        date: "2024-07-28", fileSize: "14.2 MB", status: "Ready" },
  { id: "REP-002", category: "Limnology",      title: "Athabasca Watershed Basin Water Quality Diagnostic",    author: "Jasper GIS Alpha Team",    date: "2024-07-24", fileSize: "8.7 MB",  status: "Ready" },
  { id: "REP-003", category: "Remote Sensing", title: "Sentinel-2 Multi-Spectral Biomass Recovery Analysis",   author: "Canadian Forestry Service", date: "2024-07-15", fileSize: "31.5 MB", status: "Ready" },
  { id: "REP-004", category: "Model Output",   title: "Soil Stability Assessment & Contour Plume Prediction",  author: "Erosion Predictor v2.4",   date: "2024-07-29", fileSize: "4.1 MB",  status: "Draft Model" },
];

export function ReportsPage() {
  const [filter, setFilter]           = useState<"All" | Category>("All");
  const [reports, setReports]         = useState(INITIAL_REPORTS);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const visible = filter === "All" ? reports : reports.filter((r) => r.category === filter);

  function handleDownload(id: string) {
    setDownloadingId(id);
    setTimeout(() => setDownloadingId(null), 1200);
  }

  function handleRunIngest(id: string) {
    setReports((prev) => prev.map((r) => (r.id === id ? { ...r, status: "Running..." } : r)));
    setTimeout(() => {
      setReports((prev) => prev.map((r) => (r.id === id ? { ...r, status: "Ready" } : r)));
    }, 1500);
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-background">
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">
            Hydrological & GIS Reports
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Access and generate standardized environmental diagnostic reports, satellite surveys, and soil stability runs.
          </p>
        </div>
        <div className="flex items-center gap-1 p-1 rounded-lg bg-surface-alt flex-wrap">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                filter === cat
                  ? "bg-blue-600 text-white shadow"
                  : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {visible.map((report) => (
          <div key={report.id} className="rounded-xl border border-gray-200/60 dark:border-gray-700/40 bg-surface p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                {report.category}
              </span>
              <span className="text-xs font-mono text-gray-400">{report.id}</span>
            </div>

            <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-3 pb-3 border-b border-gray-200/60 dark:border-gray-700/40">
              {report.title}
            </h3>

            <div className="grid grid-cols-2 gap-3 mb-4 text-xs">
              <div>
                <p className="text-gray-400 mb-0.5">Author</p>
                <p className="font-medium text-gray-800 dark:text-gray-100">{report.author}</p>
              </div>
              <div>
                <p className="text-gray-400 mb-0.5">Date</p>
                <p className="font-medium text-gray-800 dark:text-gray-100">{report.date}</p>
              </div>
              <div>
                <p className="text-gray-400 mb-0.5">File Size</p>
                <p className="font-medium text-gray-800 dark:text-gray-100">{report.fileSize}</p>
              </div>
              <div>
                <p className="text-gray-400 mb-0.5">Status</p>
                <p className={`flex items-center gap-1 font-medium ${report.status === "Ready" ? "text-green-500" : "text-amber-500"}`}>
                  {report.status === "Ready" ? <CheckCircleIcon className="w-3.5 h-3.5" /> : <ClockIcon className="w-3.5 h-3.5" />}
                  {report.status}
                </p>
              </div>
            </div>

            {report.status === "Ready" ? (
              <button
                onClick={() => handleDownload(report.id)}
                disabled={downloadingId === report.id}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-70 text-white text-sm font-semibold transition-colors"
              >
                <DownloadIcon className="w-4 h-4" />
                {downloadingId === report.id ? "Preparing Download..." : "Download PDF Report"}
              </button>
            ) : (
              <button
                onClick={() => handleRunIngest(report.id)}
                disabled={report.status === "Running..."}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-green-700 hover:bg-green-600 disabled:opacity-70 text-white text-sm font-semibold transition-colors"
              >
                <SendIcon className="w-4 h-4" />
                {report.status === "Running..." ? "Running Ingest..." : "Run Stability Model Ingest"}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
