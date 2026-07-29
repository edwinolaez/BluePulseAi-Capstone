/**
 * models.ts — Convex functions for reading and updating ML model metadata.
 *
 * This module is used by the Model Performance widget on the dashboard sidebar.
 * Rahil's training pipeline writes F1 scores here after each model run; the
 * frontend polls them in real time via Convex's reactive query subscription.
 *
 * Functions:
 *   getModelMetadata    — query: fetch the current model's accuracy stats
 *   updateModelMetadata — mutation: upsert a model record (insert or patch)
 */
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * getModelMetadata — reactive query
 * Returns the first (most recently inserted) model metadata record.
 * Falls back to hardcoded defaults when no record exists yet, so the
 * ModelPerformanceWidget always has something to display.
 */
export const getModelMetadata = query({
  args: {},
  handler: async (ctx) => {
    const metadata = await ctx.db.query("modelMetadata").first();

    return {
      status: "success",
      value: metadata ?? {
        // Default placeholder values — replaced once Rahil's pipeline runs
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

/**
 * updateModelMetadata — mutation
 * Upsert pattern: if a record with the same modelName already exists, patch it;
 * otherwise insert a new one.  Timestamps trainingDate and lastPrediction to
 * "now" so the widget shows how fresh the model is.
 *
 * @param modelName    - which model to update (defaults to "default")
 * @param modelVersion - semver string written after each training run
 * @param f1Score      - accuracy metric between 0 and 1
 * @param runId        - optional MLflow / W&B experiment run identifier
 */
export const updateModelMetadata = mutation({
  args: {
    modelName:    v.optional(v.string()),
    modelVersion: v.string(),
    f1Score:      v.number(),
    runId:        v.optional(v.string()),
  },

  handler: async (ctx, args) => {
    const modelName = args.modelName ?? "default";

    // Look up any existing record for this model name
    const existing = await ctx.db
      .query("modelMetadata")
      .filter((q) => q.eq(q.field("modelName"), modelName))
      .first();

    const data = {
      modelName,
      modelVersion:   args.modelVersion,
      f1Score:        args.f1Score,
      runId:          args.runId ?? "run-abc123",
      trainingDate:   Date.now(),
      lastPrediction: Date.now(),
    };

    let id;

    if (existing) {
      // Record already exists — patch it in place
      await ctx.db.patch(existing._id, data);
      id = existing._id;
    } else {
      // First time this model is recorded — create a new document
      id = await ctx.db.insert("modelMetadata", data);
    }

    // Read back the updated document to return a consistent response shape
    const updated = await ctx.db.get(id);

    return {
      status: "success",
      value: updated,
    };
  },
});
