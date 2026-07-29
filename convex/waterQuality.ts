/** This file contains the backend functions used to retrieve and update water-quality data. */

import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

/** Retrieves the newest water-quality reading for a selected sector. */
export const getLiveWaterQuality = query({
  args: {
    sectorId: v.string(),
  },
  handler: async (ctx, { sectorId }) => {
    const record = await ctx.db
      .query("waterQualityLive")
      /** Uses the sector index for faster lookups. */
      .withIndex("by_sector", (q) => q.eq("sectorId", sectorId))
      /** Returns the newest readings first. */
      .order("desc")
      /** Only the newest reading is needed. */
      .first();

    return {
      status: "success",
      /** Returns sample values when no database record exists for that sector. */
      value: record ?? {
        sectorId,
        turbidity: 2.4,
        ph: 7.2,
        hydrocarbonLevel: 0.03,
        timestamp: Date.now(),
      },
    };
  },
});

/** Inserts a new water-quality record into the database. */
export const updateWaterQuality = mutation({
  args: {
    sectorId: v.string(),
    turbidity: v.number(),
    ph: v.number(),
    hydrocarbonLevel: v.number(),
  },
  handler: async (ctx, args) => {
    /** Use insert instead of update because we keep historical data instead of overwriting previous records. */
    const id = await ctx.db.insert("waterQualityLive", {
      ...args,
      /** timestamp */
      timestamp: Date.now(),
    });

    const record = await ctx.db.get(id);

    return {
      status: "success",
      value: record,
    };
  },
});
