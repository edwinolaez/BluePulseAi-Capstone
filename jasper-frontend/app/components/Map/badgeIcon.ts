/**
 * badgeIcon.ts — Factory function for the circular badge markers on the 2D map.
 *
 * Creates a Leaflet DivIcon that looks like a small circular badge:
 *   - A coloured border ring matching the layer colour
 *   - A small SVG icon in the centre (mountain, flame, drop, radar, or map)
 *   - A tiny status dot in the top-right corner (optionally animated/pulsing)
 *
 * This is shared by all three layer components (BurnScarLayer, ContaminantLayer,
 * ErosionLayer) and HazardZone so the marker style stays consistent.
 *
 * Usage:
 *   const icon = createBadgeIcon({ borderColor: "#6D2077", iconType: "mountain", dotColor: "#ef4444", dotPulse: true });
 */
import L from "leaflet";

export type BadgeIconType = "mountain" | "flame" | "drop" | "radar" | "map";

const ICON_PATHS: Record<BadgeIconType, string> = {
  mountain: `<path d="m8 3 4 8 5-5 5 15H2L8 3z" />`,
  flame: `<path d="M8.5 14.5A2.5 2.5 0 0 0 11 17a2.5 2.5 0 0 0 2.5-2.5c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2 1Z" />`,
  drop: `<path d="M12 2.69s-5.5 5.27-5.5 9.86a5.5 5.5 0 0 0 11 0c0-4.59-5.5-9.86-5.5-9.86z" />`,
  radar: `<circle cx="12" cy="12" r="2" /><path d="M12 2v4M12 18v4M2 12h4M18 12h4" />`,
  map: `<path d="M9 20l-5.447-2.724A1 1 0 0 1 3 16.382V5.618a1 1 0 0 1 1.447-.894L9 7m0 13l6-3m-6-13l6 3m0 13l5.447 2.724A1 1 0 0 0 21 18.382V7.618a1 1 0 0 0-1.447-.894L15 9m0 11V9m0 0L9 7" />`,
};

interface BadgeOptions {
  borderColor: string;
  iconType: BadgeIconType;
  fillStyle?: "outline" | "filled";
  badgeBg?: string;
  fillColor?: string;
  iconColor?: string;
  dotColor: string;
  dotPulse?: boolean;
}

/**
 * createBadgeIcon
 * Builds and returns a Leaflet DivIcon for the given badge configuration.
 * All styling is inline HTML/CSS so Leaflet can render it without any
 * external stylesheet dependencies.
 *
 * @param borderColor - hex colour for the badge ring and icon stroke
 * @param iconType    - which SVG path to render inside the badge
 * @param fillStyle   - "outline" (white bg, coloured stroke) or "filled" (solid bg)
 * @param badgeBg     - custom background colour override for outline style
 * @param fillColor   - background colour used in "filled" style
 * @param iconColor   - icon stroke colour override
 * @param dotColor    - colour of the small status dot
 * @param dotPulse    - when true, adds a CSS pulse animation to the dot
 */
export function createBadgeIcon({
  borderColor,
  iconType,
  fillStyle = "outline",
  badgeBg,
  fillColor,
  iconColor,
  dotColor,
  dotPulse = false,
}: BadgeOptions): L.DivIcon {
  // Choose the background: filled style uses the fill colour; outline uses white (or override)
  const bg = fillStyle === "filled" ? (fillColor ?? borderColor) : (badgeBg ?? "#ffffff");
  // Filled badges get white icons; outline badges get the border colour
  const stroke = iconColor ?? (fillStyle === "filled" ? "#ffffff" : borderColor);

  return L.divIcon({
    className: "",
    html: `
      <div class="relative w-7 h-7 rounded-full border-2 shadow-md flex items-center justify-center" style="background:${bg};border-color:${borderColor}">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          ${ICON_PATHS[iconType]}
        </svg>
        <span class="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-white ${dotPulse ? "animate-pulse" : ""}" style="background:${dotColor}"></span>
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}
