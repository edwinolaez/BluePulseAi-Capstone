import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const getLiveWaterQuality = query({
  args: {
    sectorId: v.string(),
  },
  handler: async (ctx, { sectorId }) => {
    let record = await ctx.db
      .query("waterQualityLive")
      .withIndex("by_sector", (q) => q.eq("sectorId", sectorId))
      .order("desc")
      .first();

    if (!record) {
      const id = await ctx.db.insert("waterQualityLive", {
        sectorId,
        turbidity: 2.4,
        ph: 7.2,
        hydrocarbonLevel: 0.03,
        timestamp: Date.now(),
      });

      record = await ctx.db.get(id);
    }

    return {
      status: "success",
      value: record,
    };
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
    const id = await ctx.db.insert("waterQualityLive", {
      ...args,
      timestamp: Date.now(),
    });

    return {
      status: "success",
      value: await ctx.db.get(id),
    };
  },
});
