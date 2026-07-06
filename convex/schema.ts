import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  pipelineStatus: defineTable({
    ingestType: v.string(),
    lastIngestTime: v.number(),
    recordCount: v.number(),
    status: v.string(),
    errorMessage: v.optional(v.string()),
  }),

  waterQualityLive: defineTable({
    sectorId: v.string(),
    turbidity: v.number(),
    ph: v.number(),
    hydrocarbonLevel: v.number(),
    timestamp: v.number(),
  }).index("by_sector", ["sectorId"]),

  modelMetadata: defineTable({
    modelName: v.string(),
    modelVersion: v.string(),
    f1Score: v.number(),
    trainingDate: v.number(),
    lastPrediction: v.number(),
  }),
});
