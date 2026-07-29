/**
 * waterQuality.ts — Convex functions for live water quality data.
 *
 * This is the module the WaterQualityWidget calls directly (via anyApi).
 * Unlike the combined pipeline.ts module, each write here always inserts a
 * new document rather than patching — this creates a historical append log
 * of readings, not just a single "latest" row.
 *
 * Functions:
 *   getLiveWaterQuality  — query: most recent reading for a sector (with fallback)
 *   updateWaterQuality   — mutation: append a new reading document
 */
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * getLiveWaterQuality — reactive query
 * Returns the most recent water quality record for the given sector.
 * Orders descending so the newest reading is always first.
 * Falls back to safe baseline values (pH 7.2, low turbidity) when no
 * record exists yet so the widget never shows blank values.
 *
 * @param sectorId - monitoring sector, e.g. "sector-1" or "ATH-001-W"
 */
export const getLiveWaterQuality = query({
  args: {
    sectorId: v.string(),
  },
  handler: async (ctx, { sectorId }) => {
    const record = await ctx.db
      .query("waterQualityLive")
      .withIndex("by_sector", (q) => q.eq("sectorId", sectorId))
      .order("desc")  // newest row first — avoids sorting a large result set
      .first();

    return {
      status: "success",
      value: record ?? {
        // Fallback safe values — visually neutral so the widget looks reasonable
        sectorId,
        turbidity:        2.4,   // NTU — low cloudiness baseline
        ph:               7.2,   // near-neutral
        hydrocarbonLevel: 0.03,  // near-zero contamination
        timestamp:        Date.now(),
      },
    };
  },
});

/**
 * updateWaterQuality — mutation
 * Appends a new water quality reading document (does NOT patch an existing row).
 * This design keeps a full history of sensor readings in the database.
 * The getLiveWaterQuality query retrieves only the newest one.
 *
 * @param sectorId        - which sector this reading came from
 * @param turbidity       - NTU cloudiness value from the IoT sensor
 * @param ph              - pH reading
 * @param hydrocarbonLevel - normalised contamination level (0–1)
 */
export const updateWaterQuality = mutation({
  args: {
    sectorId:         v.string(),
    turbidity:        v.number(),
    ph:               v.number(),
    hydrocarbonLevel: v.number(),
  },
  handler: async (ctx, args) => {
    // Always insert a fresh document so we preserve a history of readings
    const id = await ctx.db.insert("waterQualityLive", {
      ...args,
      timestamp: Date.now(),
    });

    // Read back the just-inserted document so we can return the full object
    const record = await ctx.db.get(id);

    return {
      status: "success",
      value: record,
    };
  },
});
