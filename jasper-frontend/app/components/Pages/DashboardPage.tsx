// Dashboard Page — the first thing users see after logging in.
// Shows a health overview of the Jasper watershed with 4 key readings:
// water cloudiness, acidity, ash levels, and ground stability.
// Users can click each card to change the chart below it,
// and filter by sensor station using the buttons at the top right.

"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import {
  DropletIcon,
  TargetIcon,
  FlameIcon,
  PulseIcon,
  ChartLineIcon,
  LayersIcon,
  FolderIcon,
  XIcon,
} from "../Layout/icons";
import { DroneScanWidget } from "../Widgets/DroneScanWidget";
import type { FieldPhoto, SimulationTag, SimulationResults } from "../../../lib/api";

interface DashboardProps {
  photos:            FieldPhoto[];
  onPhotosChange:    (photos: FieldPhoto[]) => void;
  simulationResults: SimulationResults | null;
}

const TAG_LABELS: Record<SimulationTag, string> = {
  erosion:     "Erosion",
  contaminant: "Contaminant",
  burnScar:    "Burn Scar",
  untagged:    "Untagged",
};

const TAG_ACTIVE: Record<SimulationTag, string> = {
  erosion:     "bg-amber-500 text-white border-amber-500",
  contaminant: "bg-blue-500 text-white border-blue-500",
  burnScar:    "bg-red-500 text-white border-red-500",
  untagged:    "bg-gray-500 text-white border-gray-500",
};

const TAG_BADGE: Record<SimulationTag, string> = {
  erosion:     "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300",
  contaminant: "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300",
  burnScar:    "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300",
  untagged:    "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400",
};

// The list of sensor stations the user can filter by
const STATIONS = ["All Stations", "IoT Jasper-A1", "Silt Monitor S-2", "Slope Sensor SL-4"] as const;
type Station = (typeof STATIONS)[number];

// The four environmental readings shown on the dashboard cards
type MetricKey = "turbidity" | "ph" | "ash" | "soil";

interface StationStats {
  turbidity: number; turbidityStatus: string; turbidityBadge: string; turbidityDelta: string; trendTurbidity: number[];
  ph: number; phStatus: string; phBadge: string; phDelta: string; trendPh: number[];
  ash: number; ashStatus: string; ashBadge: string; ashDelta: string; trendAsh: number[];
  soil: number; soilStatus: string; soilBadge: string; soilDelta: string; trendSoil: number[];
}

// Color styles for the status badges (green = good, amber = warning, red = danger)
const BADGE = {
  green: "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400",
  amber: "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400",
  red:   "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400",
  gray:  "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400",
};

// Sample readings for each station — these are placeholder numbers until the real API is connected.
// Each station has its own set of values and a trend array (12 hourly data points for the chart).
const STATION_DATA: Record<Station, StationStats> = {
  "All Stations": {
    turbidity: 4.2, turbidityStatus: "Elevated", turbidityBadge: BADGE.amber, turbidityDelta: "+0.4 NTU from last week", trendTurbidity: [20, 28, 30, 26, 34, 46, 62, 70, 58, 60, 64, 70],
    ph: 7.12, phStatus: "Neutral", phBadge: BADGE.gray, phDelta: "-0.05 pH from last week", trendPh: [62, 60, 64, 58, 56, 60, 55, 58, 54, 57, 53, 56],
    ash: 18.4, ashStatus: "High Risk", ashBadge: BADGE.red, ashDelta: "+2.1 ppm since fire event", trendAsh: [30, 34, 38, 42, 50, 58, 64, 70, 74, 72, 76, 80],
    soil: 94.2, soilStatus: "Optimal", soilBadge: BADGE.green, soilDelta: "+1.2% stabilization rate", trendSoil: [70, 72, 74, 76, 78, 82, 85, 87, 90, 91, 93, 94],
  },
  "IoT Jasper-A1": {
    turbidity: 4.2, turbidityStatus: "Elevated", turbidityBadge: BADGE.amber, turbidityDelta: "+0.4 NTU from last week", trendTurbidity: [22, 30, 28, 32, 40, 50, 66, 72, 60, 58, 62, 68],
    ph: 7.08, phStatus: "Neutral", phBadge: BADGE.gray, phDelta: "-0.02 pH from last week", trendPh: [60, 58, 62, 60, 57, 59, 56, 57, 55, 56, 54, 55],
    ash: 19.1, ashStatus: "High Risk", ashBadge: BADGE.red, ashDelta: "+2.4 ppm since fire event", trendAsh: [32, 36, 40, 44, 52, 60, 66, 73, 76, 74, 78, 82],
    soil: 92.8, soilStatus: "Optimal", soilBadge: BADGE.green, soilDelta: "+1.0% stabilization rate", trendSoil: [68, 70, 72, 74, 76, 80, 83, 85, 88, 89, 91, 93],
  },
  "Silt Monitor S-2": {
    turbidity: 6.1, turbidityStatus: "Severe", turbidityBadge: BADGE.red, turbidityDelta: "+1.8 NTU from last week", trendTurbidity: [30, 38, 44, 40, 52, 60, 74, 82, 70, 68, 72, 80],
    ph: 6.94, phStatus: "Slightly Acidic", phBadge: BADGE.amber, phDelta: "-0.12 pH from last week", trendPh: [54, 52, 50, 48, 46, 44, 45, 42, 44, 41, 43, 40],
    ash: 21.7, ashStatus: "High Risk", ashBadge: BADGE.red, ashDelta: "+3.0 ppm since fire event", trendAsh: [38, 44, 48, 54, 60, 68, 74, 80, 84, 82, 86, 90],
    soil: 89.5, soilStatus: "Moderate", soilBadge: BADGE.amber, soilDelta: "+0.6% stabilization rate", trendSoil: [60, 62, 64, 63, 66, 68, 70, 72, 75, 76, 78, 79],
  },
  "Slope Sensor SL-4": {
    turbidity: 2.9, turbidityStatus: "Nominal", turbidityBadge: BADGE.green, turbidityDelta: "-0.1 NTU from last week", trendTurbidity: [16, 20, 24, 22, 26, 32, 40, 46, 38, 36, 38, 42],
    ph: 7.31, phStatus: "Neutral", phBadge: BADGE.gray, phDelta: "+0.01 pH from last week", trendPh: [64, 65, 63, 66, 64, 67, 65, 66, 64, 65, 63, 64],
    ash: 14.2, ashStatus: "Elevated", ashBadge: BADGE.amber, ashDelta: "+1.0 ppm since fire event", trendAsh: [24, 26, 28, 30, 34, 38, 42, 46, 48, 47, 49, 50],
    soil: 96.0, soilStatus: "Optimal", soilBadge: BADGE.green, soilDelta: "+1.8% stabilization rate", trendSoil: [78, 80, 82, 84, 86, 88, 90, 91, 93, 94, 95, 96],
  },
};

// Config for each metric — label shown on the card, the unit, and where the danger line sits on the chart
const METRICS: Record<MetricKey, { label: string; unit: string; dangerValue: number; dangerLabel: string }> = {
  turbidity: { label: "Water Cloudiness",  unit: "NTU", dangerValue: 50, dangerLabel: "Warning Level (5.0 NTU)" },
  ph:        { label: "Acidity (pH)",      unit: "pH",  dangerValue: 40, dangerLabel: "Warning Level (6.0 pH)" },
  ash:       { label: "Ash Levels",        unit: "ppm", dangerValue: 60, dangerLabel: "Warning Level (20 ppm)" },
  soil:      { label: "Ground Stability",  unit: "%",   dangerValue: 70, dangerLabel: "Stability Floor (80%)" },
};

// Time labels along the bottom of the chart — shows the last 12 hours of data
const HOUR_LABELS = ["06:00", "07:00", "08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "Now"];
const CHART_MAX = 100;

// Area health alerts shown in the right panel — highlights anything that needs attention
const ALERTS = [
  {
    icon: FlameIcon,
    accentBorder: "border-red-500",
    accentText: "text-red-500",
    title: "Soil Runoff Risk Detected",
    description: "Soil in Burn Area 4A is dry and at high risk of washing away. Close monitoring is active.",
  },
  {
    icon: DropletIcon,
    accentBorder: "border-amber-500",
    accentText: "text-amber-500",
    title: "River Getting Cloudier",
    description: "Water sensor IoT Jasper-A1 shows water cloudiness rising — up 8.5% in the past 3 readings.",
  },
  {
    icon: PulseIcon,
    accentBorder: "border-green-500",
    accentText: "text-green-500",
    title: "Satellite Data Up to Date",
    description: "Latest satellite images downloaded successfully (98% quality) at 4:15 PM today.",
  },
];

// The line chart that appears below the stat cards.
// It draws the hourly trend for whichever card the user last clicked,
// and shows a dashed warning line so you can see if readings are getting close to danger levels.
function TrendChart({ data, dangerValue, dangerLabel }: { data: number[]; dangerValue: number; dangerLabel: string }) {
  const width = 700;
  const height = 180;
  const stepX = width / (data.length - 1);
  const toY = (v: number) => height - (v / CHART_MAX) * height;
  const points = data.map((v, i) => `${i * stepX},${toY(v)}`).join(" ");
  const dangerY = toY(dangerValue);

  return (
    <div className="flex gap-3">
      <div className="flex flex-col justify-between text-[10px] text-gray-400 dark:text-gray-500 py-1 shrink-0 w-14 text-right">
        <span>Extreme</span>
        <span>High</span>
        <span>Nominal</span>
        <span>Low</span>
      </div>
      <div className="flex-1 min-w-0">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-44" preserveAspectRatio="none">
          <line x1={0} y1={dangerY} x2={width} y2={dangerY} stroke="#f59e0b" strokeDasharray="6 4" strokeWidth={1.5} />
          <text x={8} y={dangerY - 6} fill="#f59e0b" fontSize="11" fontWeight={600}>{dangerLabel.toUpperCase()}</text>
          <polyline points={points} fill="none" stroke="#00A3E0" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {/* On mobile hide every other label so they don't overlap in narrow space */}
        <div className="flex justify-between text-[10px] text-gray-400 dark:text-gray-500 mt-1">
          {HOUR_LABELS.map((h, i) => (
            <span key={h} className={[1, 3, 5, 7, 9].includes(i) ? "hidden sm:inline" : ""}>{h}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

// Each of the 4 clickable cards at the top of the dashboard.
// Clicking a card selects it (shows a blue border) and updates the chart below to match that metric.
function StatCard({
  icon: Icon, label, value, unit, status, badge, delta, selected, onClick,
}: {
  icon: typeof DropletIcon; label: string; value: string; unit: string; status: string; badge: string; delta: string;
  selected: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-left rounded-xl border bg-surface p-4 transition-colors ${
        selected ? "border-sait-red ring-1 ring-sait-red" : "border-gray-200/60 dark:border-gray-700/40 hover:border-sait-red/60"
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{label}</p>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${selected ? "bg-sait-red/15" : "bg-surface-alt"}`}>
          <Icon className={`w-4 h-4 ${selected ? "text-sait-red" : "text-gray-500 dark:text-gray-300"}`} />
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
        {value} <span className="text-sm font-sans font-normal text-gray-400">{unit}</span>
      </p>
      <div className="flex items-center gap-2 text-xs flex-wrap">
        <span className={`px-2 py-0.5 rounded font-medium ${badge}`}>{status}</span>
        <span className="text-gray-400 dark:text-gray-500">{delta}</span>
      </div>
    </button>
  );
}

export function DashboardPage({ photos, onPhotosChange, simulationResults }: DashboardProps) {
  // Which station the user has selected — starts on "All Stations"
  const [station, setStation] = useState<Station>("All Stations");
  // Which metric card is currently selected — starts on water cloudiness
  const [metric, setMetric] = useState<MetricKey>("turbidity");
  // Which simulation tag to apply on the next photo upload
  const [pendingTag, setPendingTag] = useState<SimulationTag>("untagged");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const s = STATION_DATA[station];
  const metricConfig = METRICS[metric];

  // Auto-suggest a tag based on whatever simulation last ran in AI Overview
  const suggestedTag = useMemo((): SimulationTag => {
    if (!simulationResults) return "untagged";
    if (simulationResults.contaminant) return "contaminant";
    if (simulationResults.erosion) return "erosion";
    if (simulationResults.burn) return "burnScar";
    return "untagged";
  }, [simulationResults]);

  useEffect(() => { setPendingTag(suggestedTag); }, [suggestedTag]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    const now = new Date().toISOString();
    const newPhotos: FieldPhoto[] = files.map(file => ({
      id:            `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      url:           URL.createObjectURL(file),
      name:          file.name,
      uploadedAt:    now,
      simulationTag: pendingTag,
    }));
    onPhotosChange([...photos, ...newPhotos]);
    e.target.value = "";
  }

  function removePhoto(id: string) {
    const photo = photos.find(p => p.id === id);
    if (photo) URL.revokeObjectURL(photo.url);
    onPhotosChange(photos.filter(p => p.id !== id));
  }

  const trendByMetric: Record<MetricKey, number[]> = {
    turbidity: s.trendTurbidity,
    ph: s.trendPh,
    ash: s.trendAsh,
    soil: s.trendSoil,
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-background">
      <div className="flex flex-col gap-3 mb-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">
            Jasper Valley Health Monitor
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Live environmental readings and risk indicators for the Jasper area.
          </p>
          <span className="inline-flex items-center gap-1.5 mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sait-sky/10 text-sait-sky border border-sait-sky/20">
            <span className="w-1.5 h-1.5 rounded-full bg-sait-sky animate-pulse" />
            Observed data · IoT &amp; satellite sensors
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-surface-alt self-start">
          {STATIONS.map((st) => (
            <button
              key={st}
              onClick={() => setStation(st)}
              className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                station === st
                  ? "bg-sait-red text-white shadow"
                  : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon={DropletIcon} label="Water Cloudiness" value={s.turbidity.toFixed(1)} unit="NTU" status={s.turbidityStatus} badge={s.turbidityBadge} delta={s.turbidityDelta} selected={metric === "turbidity"} onClick={() => setMetric("turbidity")} />
        <StatCard icon={TargetIcon} label="Acidity (pH)" value={s.ph.toFixed(2)} unit="pH" status={s.phStatus} badge={s.phBadge} delta={s.phDelta} selected={metric === "ph"} onClick={() => setMetric("ph")} />
        <StatCard icon={FlameIcon} label="Ash Levels" value={s.ash.toFixed(1)} unit="ppm" status={s.ashStatus} badge={s.ashBadge} delta={s.ashDelta} selected={metric === "ash"} onClick={() => setMetric("ash")} />
        <StatCard icon={PulseIcon} label="Ground Stability" value={s.soil.toFixed(1)} unit="%" status={s.soilStatus} badge={s.soilBadge} delta={s.soilDelta} selected={metric === "soil"} onClick={() => setMetric("soil")} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
        <div className="rounded-xl border border-gray-200/60 dark:border-gray-700/40 bg-surface p-5">
          <div className="flex items-start justify-between gap-2 mb-1">
            <div className="flex items-center gap-2">
              <ChartLineIcon className="w-4 h-4 text-sait-sky" />
              <h2 className="text-sm font-bold text-gray-800 dark:text-gray-100">{metricConfig.label} Over Time</h2>
            </div>
            <span className="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sait-sky/10 text-sait-sky border border-sait-sky/20">
              <span className="w-1.5 h-1.5 rounded-full bg-sait-sky animate-pulse" />
              Observed · IoT Sensors
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            Hourly readings from the past 12-hour sensor cycle.
          </p>
          <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 mb-2">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-sait-sky" /> Active Stream</span>
            <span className="flex items-center gap-1.5"><span className="w-3 border-t border-dashed border-amber-500" /> Danger Baseline</span>
          </div>
          <TrendChart data={trendByMetric[metric]} dangerValue={metricConfig.dangerValue} dangerLabel={metricConfig.dangerLabel} />
        </div>

        <div className="rounded-xl border border-gray-200/60 dark:border-gray-700/40 bg-surface p-5">
          <div className="flex items-center gap-2 mb-1">
            <LayersIcon className="w-4 h-4 text-gray-500" />
            <h2 className="text-sm font-bold text-gray-800 dark:text-gray-100">Area Health Summary</h2>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            Live alerts based on current sensor readings across Jasper Valley.
          </p>
          <div className="flex flex-col gap-3">
            {ALERTS.map(({ icon: Icon, accentBorder, accentText, title, description }) => (
              <div key={title} className={`flex gap-3 p-3 rounded-lg border-l-4 bg-surface-alt/60 ${accentBorder}`}>
                <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${accentText}`} />
                <div>
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{title}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CIRUS Drone Scans — full-width section below the main grid */}
      <div className="mt-4">
        <DroneScanWidget />
      </div>

      {/* Field Photo Upload */}
      <div className="mt-4">
        <div className="rounded-xl border border-gray-200/60 dark:border-gray-700/40 bg-surface p-5">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-sm font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
              <FolderIcon className="w-4 h-4 text-sait-sky" />
              Field Validation Photos
            </h2>
            <span className="text-xs text-gray-400">{photos.length} uploaded</span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            Upload site photos and tag them to a simulation type. Tagged photos appear in the Map View sidebar.
          </p>

          {/* Tag picker */}
          <div className="mb-3">
            <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
              Simulation Tag
              {simulationResults && (
                <span className="ml-2 text-sait-sky normal-case font-normal">
                  · auto-suggested from last AI run
                </span>
              )}
            </p>
            <div className="flex gap-2 flex-wrap">
              {(["erosion", "contaminant", "burnScar", "untagged"] as SimulationTag[]).map(tag => (
                <button
                  key={tag}
                  onClick={() => setPendingTag(tag)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                    pendingTag === tag
                      ? TAG_ACTIVE[tag]
                      : "bg-transparent text-gray-500 border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500"
                  }`}
                >
                  {TAG_LABELS[tag]}
                </button>
              ))}
            </div>
          </div>

          {/* Upload button */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleFileChange}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full py-2.5 rounded-lg border-2 border-dashed border-sait-sky/30 hover:border-sait-sky/60 text-sait-sky text-xs font-semibold flex items-center justify-center gap-2 transition-colors mb-4"
          >
            <span className="text-base leading-none">↑</span>
            Browse &amp; Upload Images
          </button>

          {/* Uploaded thumbnails */}
          {photos.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
              {photos.map(photo => (
                <div key={photo.id} className="relative group aspect-square rounded-lg overflow-hidden bg-surface-alt">
                  <img
                    src={photo.url}
                    alt={photo.name}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button
                      onClick={() => removePhoto(photo.id)}
                      className="w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600"
                      title="Remove photo"
                    >
                      <XIcon className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-1.5 pb-0.5 pt-2">
                    <span className={`text-[8px] font-semibold ${TAG_BADGE[photo.simulationTag]}`}>
                      {TAG_LABELS[photo.simulationTag]}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
