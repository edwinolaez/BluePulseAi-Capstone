import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// ── Pipeline Status ────────────────────────────────────────────────────────

export const getPipelineStatus = query({
  handler: async (ctx) => {
    return await ctx.db.query("pipelineStatus").collect();
  },
});

export const updatePipelineStatus = mutation({
  args: {
    ingestType: v.string(),
    status: v.string(),
    recordCount: v.number(),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("pipelineStatus")
      .filter((q) => q.eq(q.field("ingestType"), args.ingestType))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        status: args.status,
        lastIngestTime: Date.now(),
        recordCount: args.recordCount,
        errorMessage: args.errorMessage,
      });
    } else {
      await ctx.db.insert("pipelineStatus", {
        ingestType: args.ingestType,
        status: args.status,
        lastIngestTime: Date.now(),
        recordCount: args.recordCount,
        errorMessage: args.errorMessage,
      });
    }
  },
});

// ── Water Quality Live ─────────────────────────────────────────────────────

export const getWaterQualityLive = query({
  args: { sectorId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("waterQualityLive")
      .withIndex("by_sector", (q) => q.eq("sectorId", args.sectorId))
      .first();
  },
});

export const updateWaterQualityLive = mutation({
  args: {
    sectorId: v.string(),
    turbidity: v.number(),
    ph: v.number(),
    hydrocarbonLevel: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("waterQualityLive")
      .withIndex("by_sector", (q) => q.eq("sectorId", args.sectorId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        turbidity: args.turbidity,
        ph: args.ph,
        hydrocarbonLevel: args.hydrocarbonLevel,
        timestamp: Date.now(),
      });
    } else {
      await ctx.db.insert("waterQualityLive", {
        sectorId: args.sectorId,
        turbidity: args.turbidity,
        ph: args.ph,
        hydrocarbonLevel: args.hydrocarbonLevel,
        timestamp: Date.now(),
      });
    }
  },
});

// ── Model Metadata ─────────────────────────────────────────────────────────

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
    trainingDate: v.number(),
    lastPrediction: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("modelMetadata")
      .filter((q) => q.eq(q.field("modelName"), args.modelName))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        modelVersion: args.modelVersion,
        f1Score: args.f1Score,
        trainingDate: args.trainingDate,
        lastPrediction: args.lastPrediction,
      });
    } else {
      await ctx.db.insert("modelMetadata", args);
    }
  },
});
