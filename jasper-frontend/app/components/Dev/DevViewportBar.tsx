"use client";

type ViewportMode = "desktop" | "tablet" | "mobile";

interface Props {
  mode: ViewportMode;
  onChange: (mode: ViewportMode) => void;
}

const BUTTONS: { id: ViewportMode; label: string; icon: React.ReactNode }[] = [
  {
    id: "desktop",
    label: "Desktop",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
      </svg>
    ),
  },
  {
    id: "tablet",
    label: "Tablet",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="2" width="16" height="20" rx="2" />
        <circle cx="12" cy="18.5" r="0.5" fill="currentColor" />
      </svg>
    ),
  },
  {
    id: "mobile",
    label: "Mobile",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="5" y="2" width="14" height="20" rx="2" />
        <circle cx="12" cy="18.5" r="0.5" fill="currentColor" />
      </svg>
    ),
  },
];

export function DevViewportBar({ mode, onChange }: Props) {
  return (
    <div className="flex-none w-full flex items-center justify-center gap-1 px-4 py-1.5 bg-gray-950 border-b border-gray-800">
      {BUTTONS.map((btn) => (
        <button
          key={btn.id}
          onClick={() => onChange(btn.id)}
          title={btn.label}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
            mode === btn.id
              ? "bg-sait-red text-white"
              : "text-gray-500 hover:text-gray-200 hover:bg-gray-800"
          }`}
        >
          {btn.icon}
          <span>{btn.label}</span>
        </button>
      ))}
      <span className="ml-4 text-[10px] text-gray-700 font-mono tracking-wider uppercase select-none">
        dev preview
      </span>
    </div>
  );
}
