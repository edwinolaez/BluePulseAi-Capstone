/**
 * pipeline.ts — Convex functions for data pipeline status, live water quality,
 * and model metadata (used by the Map View sidebar widgets).
 *
 * This is the "combined pipeline" module that Rahil's frontend widgets call
 * directly.  It duplicates some logic from waterQuality.ts and models.ts but
 * exposes a slightly different API shape that some widgets depend on.
 *
 * Functions:
 *   getPipelineStatus      — query: all pipeline rows (satellite, IoT, etc.)
 *   updatePipelineStatus   — mutation: upsert a pipeline row by ingestType
 *   getWaterQualityLive    — query: most recent water reading for a sector
 *   updateWaterQualityLive — mutation: upsert the live reading for a sector
 *   getModelMetadata       — query: all model metadata rows
 *   updateModelMetadata    — mutation: upsert a model record by modelName
 */
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// ── Pipeline Status ────────────────────────────────────────────────────────

/**
 * getPipelineStatus — reactive query
 * Returns every pipeline status row so the PipelineStatusWidget can show
 * whether satellite and IoT ingests are healthy.
 */
export const getPipelineStatus = query({
  handler: async (ctx) => {
    return await ctx.db.query("pipelineStatus").collect();
  },
});

/**
 * updatePipelineStatus — mutation
 * Upserts a row keyed by ingestType.  Called by the ingest worker each time it
 * finishes a satellite or IoT sync cycle.  Records the current time as
 * lastIngestTime so widgets can show how stale the data is.
 *
 * @param ingestType  - unique key, e.g. "satellite" or "iot"
 * @param status      - "ok" | "error" | "running"
 * @param recordCount - number of records ingested in this cycle
 * @param errorMessage - only provided when status is "error"
 */
export const updatePipelineStatus = mutation({
  args: {
    ingestType:   v.string(),
    status:       v.string(),
    recordCount:  v.number(),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Look for an existing row for this pipeline type
    const existing = await ctx.db
      .query("pipelineStatus")
      .filter((q) => q.eq(q.field("ingestType"), args.ingestType))
      .first();

    if (existing) {
      // Patch the existing row — keeps the same document ID for stable subscriptions
      await ctx.db.patch(existing._id, {
        status:         args.status,
        lastIngestTime: Date.now(),
        recordCount:    args.recordCount,
        errorMessage:   args.errorMessage,
      });
    } else {
      // First run for this pipeline — create the row
      await ctx.db.insert("pipelineStatus", {
        ingestType:     args.ingestType,
        status:         args.status,
        lastIngestTime: Date.now(),
        recordCount:    args.recordCount,
        errorMessage:   args.errorMessage,
      });
    }
  },
});

// ── Water Quality Live ─────────────────────────────────────────────────────

/**
 * getWaterQualityLive — reactive query
 * Returns the most recent water quality document for a specific sector.
 * Used by the WaterQualityWidget to show live turbidity and pH values.
 *
 * @param sectorId - e.g. "ATH-001-W"
 */
export const getWaterQualityLive = query({
  args: { sectorId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("waterQualityLive")
      .withIndex("by_sector", (q) => q.eq("sectorId", args.sectorId))
      .first();
  },
});

/**
 * updateWaterQualityLive — mutation
 * Upserts the live water quality row for a given sector.
 * Only one row per sector is kept; subsequent writes patch the existing one.
 *
 * @param sectorId        - monitoring sector, e.g. "ATH-001-W"
 * @param turbidity       - NTU reading (higher = murkier)
 * @param ph              - pH value (7 = neutral)
 * @param hydrocarbonLevel - normalised hydrocarbon contamination (0–1)
 */
export const updateWaterQualityLive = mutation({
  args: {
    sectorId:         v.string(),
    turbidity:        v.number(),
    ph:               v.number(),
    hydrocarbonLevel: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("waterQualityLive")
      .withIndex("by_sector", (q) => q.eq("sectorId", args.sectorId))
      .first();

    if (existing) {
      // Sector already has a live reading — patch it so subscribed clients update in real time
      await ctx.db.patch(existing._id, {
        turbidity:        args.turbidity,
        ph:               args.ph,
        hydrocarbonLevel: args.hydrocarbonLevel,
        timestamp:        Date.now(),
      });
    } else {
      // First reading for this sector — create the document
      await ctx.db.insert("waterQualityLive", {
        sectorId:         args.sectorId,
        turbidity:        args.turbidity,
        ph:               args.ph,
        hydrocarbonLevel: args.hydrocarbonLevel,
        timestamp:        Date.now(),
      });
    }
  },
});

// ── Model Metadata ─────────────────────────────────────────────────────────

/**
 * getModelMetadata — reactive query
 * Returns all model metadata rows.  Used by the PipelineStatusWidget
 * to check whether the deployed model is up to date.
 */
export const getModelMetadata = query({
  handler: async (ctx) => {
    return await ctx.db.query("modelMetadata").collect();
  },
});

/**
 * updateModelMetadata — mutation
 * Upserts a model record keyed by modelName.  Called by Rahil's training
 * pipeline after each run to record the new F1 score and version.
 *
 * @param modelName     - identifier for this model, e.g. "default"
 * @param modelVersion  - semver string, e.g. "v1.3"
 * @param f1Score       - accuracy metric (0–1)
 * @param trainingDate  - Unix ms when training completed
 * @param lastPrediction - Unix ms of the most recent inference
 */
export const updateModelMetadata = mutation({
  args: {
    modelName:      v.string(),
    modelVersion:   v.string(),
    f1Score:        v.number(),
    trainingDate:   v.number(),
    lastPrediction: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("modelMetadata")
      .filter((q) => q.eq(q.field("modelName"), args.modelName))
      .first();

    if (existing) {
      // Patch only the mutable fields — modelName is the key and stays the same
      await ctx.db.patch(existing._id, {
        modelVersion:   args.modelVersion,
        f1Score:        args.f1Score,
        trainingDate:   args.trainingDate,
        lastPrediction: args.lastPrediction,
      });
    } else {
      // No record yet for this model — insert a new document
      await ctx.db.insert("modelMetadata", args);
    }
  },
});
