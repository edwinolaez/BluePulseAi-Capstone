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
      { key: "?",   label: "Show / hide this shortcuts panel" },
      { key: "Esc", label: "Close sidebar or this panel" },
    ],
  },
];

interface Props { onClose: () => void; }

export function KeyboardShortcutsHelp({ onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-gray-700/60 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-sait-sky" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="2" y="5" width="16" height="11" rx="2" />
              <path d="M6 9h.01M10 9h.01M14 9h.01M6 13h8" strokeLinecap="round" />
            </svg>
            <span className="text-sm font-bold text-white">Keyboard Shortcuts</span>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white transition-colors leading-none text-lg w-6 h-6 flex items-center justify-center rounded hover:bg-gray-800"
          >
            ✕
          </button>
        </div>

        {/* Shortcut groups */}
        <div className="px-5 py-4 space-y-5 max-h-[65vh] overflow-y-auto">
          {SHORTCUTS.map(g => (
            <div key={g.group}>
              <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-2.5 font-semibold">
                {g.group}
              </p>
              <div className="space-y-2">
                {g.entries.map(entry => (
                  <div key={entry.key} className="flex items-center justify-between gap-4">
                    <span className="text-sm text-gray-300">{entry.label}</span>
                    <kbd className="flex-shrink-0 px-2 py-0.5 rounded-md bg-gray-800 border border-gray-600 text-[11px] font-mono text-gray-200 font-semibold">
                      {entry.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer hint */}
        <div className="px-5 py-3 border-t border-gray-800 text-center">
          <p className="text-[10px] text-gray-600">
            Press{" "}
            <kbd className="px-1.5 py-0.5 rounded bg-gray-800 border border-gray-700 text-[10px] font-mono text-gray-400">?</kbd>
            {" "}or{" "}
            <kbd className="px-1.5 py-0.5 rounded bg-gray-800 border border-gray-700 text-[10px] font-mono text-gray-400">Esc</kbd>
            {" "}to close
          </p>
        </div>
      </div>
    </div>
  );
}
