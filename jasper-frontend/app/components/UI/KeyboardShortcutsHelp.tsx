"use client";

interface ShortcutEntry { key: string; label: string; }
interface ShortcutGroup { group: string; entries: ShortcutEntry[]; }

const SHORTCUTS: ShortcutGroup[] = [
  {
    group: "Navigation",
    entries: [
      { key: "M", label: "Map view" },
      { key: "D", label: "Dashboard" },
      { key: "A", label: "AI Overview" },
      { key: "R", label: "Reports" },
      { key: "S", label: "Toggle sidebar" },
    ],
  },
  {
    group: "Map layers  (Map tab only)",
    entries: [
      { key: "E", label: "Toggle Erosion layer" },
      { key: "F", label: "Toggle Forest Burn layer" },
      { key: "W", label: "Toggle Water · Contaminant layer" },
      { key: "L", label: "Toggle Flood Elevation layer" },
      { key: "3", label: "Toggle 2D / 3D view" },
    ],
  },
  {
    group: "Map control  (2D only)",
    entries: [
      { key: "+ / =", label: "Zoom in" },
      { key: "−",     label: "Zoom out" },
    ],
  },
  {
    group: "General",
    entries: [
      { key: "?",   label: "Show / hide shortcuts" },
      { key: "Esc", label: "Close sidebar or panel" },
    ],
  },
];

interface Props { onClose: () => void; }

export function KeyboardShortcutsHelp({ onClose }: Props) {
  return (
    <div className="fixed bottom-20 right-4 z-[500] w-72 rounded-xl shadow-2xl bg-gray-900/95 backdrop-blur-md border border-gray-700/60 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <svg className="w-3.5 h-3.5 text-sait-sky flex-shrink-0" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
            <rect x="2" y="5" width="16" height="11" rx="2" />
            <path d="M6 9h.01M10 9h.01M14 9h.01M6 13h8" strokeLinecap="round" />
          </svg>
          <span className="text-xs font-bold text-white">Keyboard Shortcuts</span>
        </div>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-white transition-colors leading-none text-sm w-5 h-5 flex items-center justify-center rounded hover:bg-gray-800"
          aria-label="Close shortcuts panel"
        >
          ✕
        </button>
      </div>

      {/* Shortcut groups */}
      <div className="px-4 py-3 space-y-4 max-h-[60vh] overflow-y-auto">
        {SHORTCUTS.map(g => (
          <div key={g.group}>
            <p className="text-[9px] uppercase tracking-widest text-gray-500 mb-2 font-semibold">
              {g.group}
            </p>
            <div className="space-y-1.5">
              {g.entries.map(entry => (
                <div key={entry.key} className="flex items-center justify-between gap-3">
                  <span className="text-xs text-gray-300">{entry.label}</span>
                  <kbd className="flex-shrink-0 px-1.5 py-0.5 rounded bg-gray-800 border border-gray-600 text-[10px] font-mono text-gray-200 font-semibold">
                    {entry.key}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="px-4 py-2.5 border-t border-gray-800">
        <p className="text-[9px] text-gray-600 text-center">
          Press{" "}
          <kbd className="px-1 py-0.5 rounded bg-gray-800 border border-gray-700 text-[9px] font-mono text-gray-400">?</kbd>
          {" "}or{" "}
          <kbd className="px-1 py-0.5 rounded bg-gray-800 border border-gray-700 text-[9px] font-mono text-gray-400">Esc</kbd>
          {" "}to close
        </p>
      </div>
    </div>
  );
}
