import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const getModelMetadata = query({
  args: {},
  handler: async (ctx) => {
    const metadata = await ctx.db.query("modelMetadata").first();

    if (!metadata) {
      return null;
    }

    return {
      model_version: metadata.modelVersion,
      run_id: metadata.runId ?? "run-abc123",
      metrics: {
        f1: metadata.f1Score,
      },
    };
  },
});

export const updateModelMetadata = mutation({
  args: {
    modelName: v.string(),
    modelVersion: v.string(),
    f1Score: v.number(),
    runId: v.optional(v.string()),
  },

  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("modelMetadata")
      .filter((q) => q.eq(q.field("modelName"), args.modelName))
      .first();

    const data = {
      modelName: args.modelName,
      modelVersion: args.modelVersion,
      f1Score: args.f1Score,
      runId: args.runId ?? "run-abc123",
      trainingDate: Date.now(),
      lastPrediction: Date.now(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, data);
      return existing._id;
    }

    return await ctx.db.insert("modelMetadata", data);
  },
});
