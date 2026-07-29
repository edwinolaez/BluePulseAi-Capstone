/**
 * FieldPhotosWidget.tsx — Field validation photo thumbnails widget.
 *
 * Shown in the Map View Live Readings sidebar.  Currently renders two
 * placeholder gradient squares representing field photos from the monitoring
 * team.  In a full build these would be replaced with real photos uploaded
 * from the field — either from Convex storage or an S3-compatible bucket.
 */
"use client";

/**
 * FieldPhotosWidget
 * Placeholder widget showing two colour-gradient photo slots.
 * Replace the gradient divs with real <img> tags when field photo
 * storage is connected.
 */
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
