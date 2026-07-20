"use client";

import type { SensorInfo } from "../Map/JasperMap";

const BADGE_STYLE: Record<string, string> = {
  red:   "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400",
  amber: "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400",
  green: "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400",
  cyan:  "bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400",
};

const SENSOR_ICON_PATH: Record<SensorInfo["icon"], string> = {
  mountain: `<path d="m8 3 4 8 5-5 5 15H2L8 3z" />`,
  flame:    `<path d="M8.5 14.5A2.5 2.5 0 0 0 11 17a2.5 2.5 0 0 0 2.5-2.5c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2 1Z" />`,
  map:      `<path d="M9 20l-5.447-2.724A1 1 0 0 1 3 16.382V5.618a1 1 0 0 1 1.447-.894L9 7m0 13l6-3m-6-13l6 3m0 13l5.447 2.724A1 1 0 0 0 21 18.382V7.618a1 1 0 0 0-1.447-.894L15 9m0 11V9m0 0L9 7" />`,
  sensor:   `<circle cx="12" cy="12" r="2" /><path d="M12 2v4M12 18v4M2 12h4M18 12h4" />`,
};

const SENSOR_ICON_COLOR: Record<SensorInfo["icon"], string> = {
  mountain: "#a855f7",
  flame:    "#ef4444",
  map:      "#0ea5e9",
  sensor:   "#0ea5e9",
};

interface Props {
  sensorInfo?: SensorInfo | null;
}

export function SectorPanel({ sensorInfo }: Props) {
  return (
    <div className="rounded-xl border border-gray-200/60 dark:border-gray-700/40 bg-surface p-3.5">

      {/* Header — always "Selected Area"; badge appears when a sensor is selected */}
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
          Selected Area
        </p>
        {sensorInfo?.badge && (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${BADGE_STYLE[sensorInfo.badgeVariant ?? "cyan"]}`}>
            {sensorInfo.badge}
          </span>
        )}
      </div>

      {/* Sensor badge clicked — show that sensor's ML model data */}
      {sensorInfo && (() => {
        const iconColor = SENSOR_ICON_COLOR[sensorInfo.icon];
        return (
          <>
            <div className="flex items-center gap-1.5 mb-2">
              <svg
                width="13" height="13" viewBox="0 0 24 24"
                fill="none" stroke={iconColor}
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                dangerouslySetInnerHTML={{ __html: SENSOR_ICON_PATH[sensorInfo.icon] }}
              />
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: iconColor }}>
                {sensorInfo.title}
              </p>
            </div>

            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
              {sensorInfo.name}
            </p>

            <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
              {sensorInfo.fields.map((field) => (
                <div key={field.label} className={field.fullWidth ? "col-span-2" : ""}>
                  <p className="text-[10px] uppercase text-gray-400 dark:text-gray-500 tracking-wide mb-0.5">
                    {field.label}
                  </p>
                  <p
                    className="text-sm font-semibold text-gray-800 dark:text-gray-100"
                    style={field.valueColor ? { color: field.valueColor } : undefined}
                  >
                    {field.value}
                  </p>
                </div>
              ))}
            </div>
          </>
        );
      })()}

      {/* Nothing selected yet */}
      {!sensorInfo && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Click a sensor badge on the map to view environmental data for that area.
        </p>
      )}
    </div>
  );
}
