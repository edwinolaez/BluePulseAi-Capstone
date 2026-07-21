"use client";

interface Props {
  label: string;
  dotColor: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  iconPath?: string;  // SVG path data — when provided renders a mini map badge instead of a plain dot
}

export function ToggleSwitch({ label, dotColor, checked, onChange, iconPath }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex items-center justify-between w-full gap-3 text-sm font-medium text-gray-900 dark:text-white select-none"
    >
      <span className="flex items-center gap-2.5">
        {iconPath ? (
          // Mini badge — same structure as the HazardZone marker on the map:
          // coloured border ring, SVG icon, small dot in the top-right corner
          <span
            className="relative w-6 h-6 rounded-full border-2 bg-white dark:bg-gray-900 flex items-center justify-center shrink-0 shadow-sm"
            style={{ borderColor: dotColor }}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke={dotColor}
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d={iconPath} />
            </svg>
            <span
              className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full border-[1.5px] border-white dark:border-gray-900"
              style={{ background: dotColor }}
            />
          </span>
        ) : (
          // Fallback plain dot with white ring (used when no icon is supplied)
          <span
            className="w-4 h-4 rounded-full shrink-0"
            style={{
              background: dotColor,
              boxShadow: `0 0 0 2px #ffffff, 0 0 0 3.5px ${dotColor}99, 0 1px 4px rgba(0,0,0,0.25)`,
            }}
          />
        )}
        {label}
      </span>

      <span
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
          checked ? "bg-sait-red" : "bg-gray-300 dark:bg-gray-600"
        }`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-[18px]" : "translate-x-[3px]"
          }`}
        />
      </span>
    </button>
  );
}
