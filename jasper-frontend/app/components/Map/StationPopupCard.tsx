/**
 * StationPopupCard.tsx — Popup card shown inside Leaflet map markers.
 *
 * Renders a compact information card used by HazardZone and TelemetryStation
 * when a marker is clicked.  The card shows:
 *   - An emoji icon + title row with a colour-coded status badge
 *   - A large station name
 *   - A two-column grid of key/value data fields
 *
 * The status badge colours are:
 *   OPERATIONAL — grey (all good)
 *   WARNING     — amber (attention needed)
 *   CRITICAL    — red (immediate action required)
 */
"use client";

export type StationStatus = "OPERATIONAL" | "WARNING" | "CRITICAL";

export interface PopupField {
  label: string;
  value: string;
  valueColor?: string;
}

interface Props {
  icon?: string;
  title: string;
  status: StationStatus;
  name: string;
  fields: PopupField[];
}

const STATUS_BADGE: Record<StationStatus, string> = {
  OPERATIONAL: "bg-gray-100 text-gray-600",
  WARNING:     "bg-amber-100 text-amber-700",
  CRITICAL:    "bg-red-100 text-red-700",
};

/**
 * StationPopupCard
 * Compact data card rendered inside a Leaflet Popup.
 *
 * @param icon   - emoji displayed at the start of the title row (default "✨")
 * @param title  - header text describing the sensor type
 * @param status - determines the badge colour
 * @param name   - full station or area name shown prominently
 * @param fields - array of label/value rows displayed in a two-column grid
 */
export function StationPopupCard({ icon = "✨", title, status, name, fields }: Props) {
  return (
    <div className="w-64 font-sans">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5 text-sait-sky text-[10px] font-bold uppercase tracking-wide">
          <span>{icon}</span>
          {title}
        </div>
        <span className={`text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded ${STATUS_BADGE[status]}`}>
          {status}
        </span>
      </div>

      <p className="text-sm font-bold text-gray-900 mb-2">{name}</p>

      <div className="grid grid-cols-2 gap-x-3 gap-y-2 border-t border-gray-100 pt-2">
        {fields.map((field) => (
          <div key={field.label}>
            <p className="text-[9px] uppercase text-gray-400 tracking-wide">{field.label}</p>
            <p className={`text-xs font-mono font-bold ${field.valueColor ?? "text-gray-800"}`}>
              {field.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
