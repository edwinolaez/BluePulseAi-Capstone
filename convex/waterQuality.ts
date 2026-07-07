import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const getLiveWaterQuality = query({
  args: {
    sectorId: v.string(),
  },
  handler: async (ctx, { sectorId }) => {
    return await ctx.db
      .query("waterQualityLive")
      .withIndex("by_sector", (q) => q.eq("sectorId", sectorId))
      .order("desc")
      .first();
  },
});

export const updateWaterQuality = mutation({
  args: {
    sectorId: v.string(),
    turbidity: v.number(),
    ph: v.number(),
    hydrocarbonLevel: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("waterQualityLive", {
      ...args,
      timestamp: Date.now(),
    });
  },
});
