import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const getModelMetadata = query({
  args: {},
  handler: async (ctx) => {
    const metadata = await ctx.db.query("modelMetadata").first();

    return {
      status: "success",
      value: metadata ?? {
        modelName: "default",
        modelVersion: "v1.2",
        runId: "run-abc123",
        f1Score: 0.87,
        trainingDate: Date.now(),
        lastPrediction: Date.now(),
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

    let id;

    if (existing) {
      await ctx.db.patch(existing._id, data);
      id = existing._id;
    } else {
      id = await ctx.db.insert("modelMetadata", data);
    }

    const updated = await ctx.db.get(id);

    return {
      status: "success",
      value: updated,
    };
  },
});
