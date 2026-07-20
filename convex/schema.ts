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
    runId: v.optional(v.string()),
    trainingDate: v.number(),
    lastPrediction: v.number(),
  }),

  droneScans: defineTable({
    storageId:   v.id("_storage"),
    filename:    v.string(),
    uploadedBy:  v.string(),
    sectorId:    v.string(),
    scanDate:    v.number(),
    notes:       v.optional(v.string()),
    fileSize:    v.number(),
    mimeType:    v.string(),
    status:      v.union(v.literal("processing"), v.literal("ready"), v.literal("error")),
  })
    .index("by_sector", ["sectorId"])
    .index("by_date",   ["scanDate"]),
});
