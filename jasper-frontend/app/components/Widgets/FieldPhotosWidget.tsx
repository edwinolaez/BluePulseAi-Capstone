"use client";

export function FieldPhotosWidget() {
  return (
    <div className="rounded-xl border border-gray-200/60 dark:border-gray-700/40 bg-surface p-3.5">
      <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-3">
        Field Validation Photos
      </p>
      <div className="grid grid-cols-2 gap-2">
        <div className="aspect-square rounded-lg bg-gradient-to-br from-emerald-700 via-emerald-900 to-slate-900" />
        <div className="aspect-square rounded-lg bg-gradient-to-br from-slate-500 via-slate-700 to-slate-900" />
      </div>
    </div>
  );
}
