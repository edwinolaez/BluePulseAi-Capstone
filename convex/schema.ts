/** This file defines the convex database structure.
 * It creates tables for pipeline status, live water quality, and modelmetadata.
 * It also defines field types and the by_sector index. Other files use them to read and write data
 */

import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  /**Store info about the ingestion pipeline, including status, timestamps, and processing information */
  pipelineStatus: defineTable({
    ingestType: v.string(),
    lastIngestTime: v.number(),
    recordCount: v.number(),
    status: v.string(),
    errorMessage: v.optional(v.string()),
  }),

  /** Stores the latest water-quality info for each sector */
  waterQualityLive: defineTable({
    sectorId: v.string(),
    turbidity: v.number(),
    ph: v.number(),
    hydrocarbonLevel: v.number(),
    timestamp: v.number(),
  }).index("by_sector", ["sectorId"]),

  /** Stores info about the AI model, including model version, F1 Score, and runID */
  modelMetadata: defineTable({
    modelName: v.string(),
    modelVersion: v.string(),
    f1Score: v.number(),
    runId: v.optional(v.string()),
    trainingDate: v.number(),
    lastPrediction: v.number(),
  }),

  /** Stores information about drone scans, including file details and status */
  droneScans: defineTable({
    storageId: v.id("_storage"),
    filename: v.string(),
    uploadedBy: v.string(),
    sectorId: v.string(),
    scanDate: v.number(),
    notes: v.optional(v.string()),
    fileSize: v.number(),
    mimeType: v.string(),
    status: v.union(
      v.literal("processing"),
      v.literal("ready"),
      v.literal("error"),
    ),
  })
    /**This improves look up speed when the application requests data for a specific sector. */
    .index("by_sector", ["sectorId"])
    .index("by_date", ["scanDate"]),
});
