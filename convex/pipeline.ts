import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

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
