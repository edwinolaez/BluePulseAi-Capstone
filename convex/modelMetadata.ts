import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const getModelMetadata = query({
  handler: async (ctx) => {
    return await ctx.db.query("modelMetadata").collect();
  },
});

export const updateModelMetadata = mutation({
  args: {
    modelName: v.string(),
    modelVersion: v.string(),
    f1Score: v.number(),
  },

  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("modelMetadata")
      .filter((q) => q.eq(q.field("modelName"), args.modelName))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        ...args,
        trainingDate: Date.now(),
        lastPrediction: Date.now(),
      });
    } else {
      await ctx.db.insert("modelMetadata", {
        ...args,
        trainingDate: Date.now(),
        lastPrediction: Date.now(),
      });
    }
  },
});
