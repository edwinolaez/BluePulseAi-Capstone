// ToggleSwitch is a reusable on/off switch used in the map's layer control panel.
// Each switch has a coloured dot that matches the layer it controls,
// a text label, and a sliding pill toggle.
// It's a controlled component — the parent tells it what state to be in
// and what to do when clicked.

"use client";

interface Props {
  label: string;      // text shown next to the toggle (e.g. "Soil Erosion Risk")
  dotColor: string;   // CSS colour for the small dot — matches the layer's map colour
  checked: boolean;   // whether the toggle is currently on
  onChange: (checked: boolean) => void;  // called when the user flips the switch
}

export function ToggleSwitch({ label, dotColor, checked, onChange }: Props) {
  return (
    // Using a button with role="switch" makes this accessible to screen readers
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex items-center justify-between w-full gap-3 text-sm font-medium text-gray-900 dark:text-white select-none"
    >
      {/* Left side: coloured dot + label text */}
      <span className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: dotColor }} />
        {label}
      </span>

      {/* Right side: the sliding pill toggle.
          Turns cyan when on, grey when off. */}
      <span
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
          checked ? "bg-cyan-500" : "bg-gray-300 dark:bg-gray-600"
        }`}
      >
        {/* The white circle that slides left (off) or right (on) */}
        <span
          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-[18px]" : "translate-x-[3px]"
          }`}
        />
      </span>
    </button>
  );
}
