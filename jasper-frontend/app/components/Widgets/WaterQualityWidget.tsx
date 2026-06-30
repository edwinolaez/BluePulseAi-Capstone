"use client";

const MOCK_DATA = { turbidity: 3.6, ph: 7.21 };
const SPARKLINE = [38, 52, 30, 70, 48, 55, 42];
const HIGHLIGHT_INDEX = 3;

export function WaterQualityWidget() {
  return (
    <div className="rounded-xl border border-gray-200/60 dark:border-gray-700/40 bg-surface p-3.5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          Water Quality
        </p>
        <span className="w-2 h-2 rounded-full bg-green-500" />
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3.5">
        <div>
          <p className="text-[10px] uppercase text-gray-400 tracking-wide mb-0.5">Turbidity</p>
          <p className="text-xl font-mono font-bold text-gray-900 dark:text-gray-100">
            {MOCK_DATA.turbidity}
            <span className="text-xs font-sans font-normal text-gray-400 ml-1">NTU</span>
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase text-gray-400 tracking-wide mb-0.5">pH Level</p>
          <p className="text-xl font-mono font-bold text-gray-900 dark:text-gray-100">
            {MOCK_DATA.ph}
            <span className="text-xs font-sans font-normal text-gray-400 ml-1">pH</span>
          </p>
        </div>
      </div>

      <div className="flex items-end gap-1 h-10">
        {SPARKLINE.map((h, i) => (
          <div
            key={i}
            className={`flex-1 rounded-sm ${i === HIGHLIGHT_INDEX ? "bg-green-500" : "bg-gray-200 dark:bg-gray-700"}`}
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
    </div>
  );
}
