import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const getModelMetadata = query({
  args: {},
  handler: async (ctx) => {
    let metadata = await ctx.db.query("modelMetadata").first();

    if (!metadata) {
      const id = await ctx.db.insert("modelMetadata", {
        modelName: "default",
        modelVersion: "v1.2",
        runId: "run-abc123",
        f1Score: 0.87,
        trainingDate: Date.now(),
        lastPrediction: Date.now(),
      });

      metadata = await ctx.db.get(id);
    }

    return {
      status: "success",
      value: {
        model_version: metadata?.modelVersion ?? "v1.2",
        run_id: metadata?.runId ?? "run-abc123",
        metrics: {
          f1: metadata?.f1Score ?? 0.87,
        },
      },
    };
  },
});

export const updateModelMetadata = mutation({
  args: {
    modelName: v.optional(v.string()),
    modelVersion: v.string(),
    f1Score: v.number(),
    runId: v.optional(v.string()),
  },

  handler: async (ctx, args) => {
    const modelName = args.modelName ?? "default";

    const existing = await ctx.db
      .query("modelMetadata")
      .filter((q) => q.eq(q.field("modelName"), modelName))
      .first();

    const data = {
      modelName,
      modelVersion: args.modelVersion,
      f1Score: args.f1Score,
      runId: args.runId ?? "run-abc123",
      trainingDate: Date.now(),
      lastPrediction: Date.now(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, data);
      return {
        status: "success",
        value: data,
      };
    }

    await ctx.db.insert("modelMetadata", data);

    return {
      status: "success",
      value: data,
    };
  },
});
