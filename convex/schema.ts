/**
 * schema.ts — Convex database schema for Project Jasper.
 *
 * Defines every table that lives in the Convex database and the shape of each
 * document inside it.  Convex enforces these types at runtime, so any write
 * that doesn't match will be rejected automatically.
 *
 * Tables:
 *   pipelineStatus    — tracks whether each data-ingest pipeline is healthy
 *   waterQualityLive  — latest turbidity / pH / hydrocarbon reading per sector
 *   modelMetadata     — accuracy stats for the deployed ML model
 *   droneScans        — uploaded CIRUS drone imagery files with metadata
 */
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  /**
   * One document per data pipeline (e.g. "satellite", "iot").
   * Updated whenever the ingest worker runs — lets the dashboard show
   * whether data is fresh or stale.
   */
  pipelineStatus: defineTable({
    ingestType:    v.string(),           // identifier for the pipeline, e.g. "satellite"
    lastIngestTime: v.number(),          // Unix timestamp (ms) of the last successful run
    recordCount:   v.number(),           // how many records were ingested in that run
    status:        v.string(),           // "ok", "error", etc.
    errorMessage:  v.optional(v.string()), // present only when status is "error"
  }),

  /**
   * Latest water quality reading for each monitoring sector.
   * Only one "live" row per sector is kept — the mutation patches the existing row.
   * Indexed by sectorId for fast single-sector lookups.
   */
  waterQualityLive: defineTable({
    sectorId:         v.string(),  // e.g. "ATH-001-W"
    turbidity:        v.number(),  // NTU — higher = murkier water
    ph:               v.number(),  // 0–14 scale; 7 = neutral
    hydrocarbonLevel: v.number(),  // normalised 0–1 contamination proxy
    timestamp:        v.number(),  // Unix ms of when this reading was taken
  }).index("by_sector", ["sectorId"]),

  /**
   * Accuracy metrics for the currently deployed ML model.
   * Written by Rahil's model pipeline after each training run.
   */
  modelMetadata: defineTable({
    modelName:      v.string(),           // which model, e.g. "default"
    modelVersion:   v.string(),           // semver string, e.g. "v1.2"
    f1Score:        v.number(),           // 0–1 accuracy metric (higher is better)
    runId:          v.optional(v.string()), // MLflow/W&B run identifier for traceability
    trainingDate:   v.number(),           // Unix ms when training finished
    lastPrediction: v.number(),           // Unix ms of most recent inference
  }),

  /**
   * Drone scan files uploaded by the CIRUS team.
   * storageId is a reference to a file in Convex's built-in file storage.
   * Indexed by sector and date so the widget can list scans quickly.
   */
  droneScans: defineTable({
    storageId:   v.id("_storage"),  // file stored in Convex's built-in file storage
    filename:    v.string(),
    uploadedBy:  v.string(),        // e.g. "CIRUS Team"
    sectorId:    v.string(),        // which monitoring sector this scan covers
    scanDate:    v.number(),        // Unix ms timestamp of the actual flight
    notes:       v.optional(v.string()), // optional field notes from the pilot
    fileSize:    v.number(),        // bytes
    mimeType:    v.string(),        // e.g. "image/jpeg" or "image/tiff"
    // processing = file uploaded but not yet analysed
    // ready      = analysis complete, file is viewable
    // error      = ingest pipeline failed for this scan
    status:      v.union(v.literal("processing"), v.literal("ready"), v.literal("error")),
  })
    .index("by_sector", ["sectorId"])
    .index("by_date",   ["scanDate"]),

  /**
   * Stakeholder-placed sensor simulations.
   * Created when a user drops a custom sensor pin on the map and confirms the
   * placement modal.  Always stored with needsVerification: true.
   * Max 3 active rows (enforced on the frontend).
   */
  userSimulations: defineTable({
    name:       v.string(),
    lat:        v.number(),
    lon:        v.number(),
    sensorType: v.union(v.literal("forest"), v.literal("erosion"),
                        v.literal("water"),  v.literal("flood")),
    elevationM: v.number(),
    slopeDeg:   v.number(),
    radiusM:    v.number(),   // user-set monitoring radius in metres
    simulationResults: v.object({
      catchmentAreaHa:     v.optional(v.number()), // π·r²/10000
      forestRecoveryPct:   v.optional(v.number()),
      erosionRateTPerHaYr: v.optional(v.number()),
      erosionRiskLabel:    v.optional(v.string()),
      erosionTotalLoadTYr: v.optional(v.number()), // rate × catchmentAreaHa
      floodFlowM3s:        v.optional(v.number()), // Q = C·i·π·r² (accurate)
      contaminantConcNorm: v.optional(v.number()), // Gaussian at center
      contaminantEdgeConc: v.optional(v.number()), // Gaussian at radius edge
    }),
    needsVerification: v.boolean(),
    verificationNote:  v.string(),
    placedAt:          v.number(),
  }).index("by_placed_at", ["placedAt"]),
});
