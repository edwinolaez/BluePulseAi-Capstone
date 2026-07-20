"use client";

import { useEffect, useRef, useState } from "react";
import { DownloadIcon, PauseIcon, PlayIcon, TerminalIcon, TrashIcon, XIcon } from "./icons";

type Level = "INFO" | "SUCCESS" | "WARN" | "ERROR";

interface LogEntry {
  id: number;
  time: string;
  level: Level;
  message: string;
}

const LEVEL_BADGE: Record<Level, string> = {
  INFO:    "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-200",
  SUCCESS: "bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-200",
  WARN:    "bg-amber-100 dark:bg-amber-700 text-amber-700 dark:text-amber-100",
  ERROR:   "bg-red-100 dark:bg-red-800 text-red-700 dark:text-red-200",
};

const MESSAGE_POOL: { level: Level; message: string }[] = [
  { level: "INFO",    message: "Rainfall tracker synced: 0.0 mm recorded in Jasper valley." },
  { level: "SUCCESS", message: "Soil erosion model updated. Map layers refreshed." },
  { level: "WARN",    message: "River drainage rising quickly in Sector 4B — monitoring closely." },
  { level: "ERROR",   message: "Could not reach Silt Monitor S-3. Retrying in 15 seconds." },
  { level: "INFO",    message: "Checking live sensor: IoT Jasper-A1 is active." },
  { level: "SUCCESS", message: "Satellite imagery downloaded successfully (98% quality)." },
];

function timestamp() {
  return new Date().toLocaleTimeString("en-US", { hour12: false });
}

function randomEntry(id: number): LogEntry {
  const pick = MESSAGE_POOL[Math.floor(Math.random() * MESSAGE_POOL.length)];
  return { id, time: timestamp(), ...pick };
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export function LiveGisLogsPanel({ open, onClose }: Props) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [paused, setPaused] = useState(false);
  const [exported, setExported] = useState(false);
  const nextId = useRef(1);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || paused) return;
    const interval = setInterval(() => {
      setLogs((prev) => {
        const next = [...prev, randomEntry(nextId.current++)];
        return next.length > 100 ? next.slice(next.length - 100) : next;
      });
    }, 2500);
    return () => clearInterval(interval);
  }, [open, paused]);

  useEffect(() => {
    if (logs.length === 0 && open) {
      setLogs(Array.from({ length: 6 }, () => randomEntry(nextId.current++)));
    }
  }, [open, logs.length]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [logs]);

  function handleExport() {
    const text = logs.map((l) => `[${l.time}] ${l.level} — ${l.message}`).join("\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `jasper-activity-logs-${new Date().toISOString().split("T")[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    setExported(true);
    setTimeout(() => setExported(false), 1500);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-[2000] w-full max-w-md flex flex-col bg-white dark:bg-gray-950 border-l border-gray-200 dark:border-gray-800 shadow-2xl">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
          <TerminalIcon className="w-5 h-5" />
          <h2 className="text-base font-bold">Live Activity Logs</h2>
        </div>
        <button onClick={onClose} className="text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 transition-colors">
          <XIcon className="w-5 h-5" />
        </button>
      </div>

      <div className="flex items-center justify-between gap-2 px-5 py-3 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPaused((p) => !p)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs font-semibold transition-colors"
          >
            {paused ? <PlayIcon className="w-3.5 h-3.5" /> : <PauseIcon className="w-3.5 h-3.5" />}
            {paused ? "Resume" : "Pause"}
          </button>
          <button
            onClick={() => setLogs([])}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs font-semibold transition-colors"
          >
            <TrashIcon className="w-3.5 h-3.5" />
            Clear
          </button>
        </div>
        <button
          onClick={handleExport}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors"
        >
          <DownloadIcon className="w-3.5 h-3.5" />
          {exported ? "Saved ✓" : "Export"}
        </button>
      </div>

      <div ref={listRef} className="flex-1 overflow-y-auto px-5 py-3 flex flex-col gap-3">
        {logs.map((log) => (
          <div key={log.id} className="flex items-start gap-2.5 text-xs">
            <span className="font-mono text-gray-400 dark:text-gray-500 shrink-0 pt-0.5">{log.time}</span>
            <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold ${LEVEL_BADGE[log.level]}`}>
              {log.level}
            </span>
            <span className="text-gray-700 dark:text-gray-300 leading-relaxed">{log.message}</span>
          </div>
        ))}
      </div>

      <div className="px-5 py-2.5 border-t border-gray-200 dark:border-gray-800 text-[11px] text-gray-500 dark:text-gray-500 text-center">
        Data Processing Rate: 1.2 MB/s &nbsp;|&nbsp; Queue: {logs.length}
      </div>
    </div>
  );
}
