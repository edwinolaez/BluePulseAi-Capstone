import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

export const saveScan = mutation({
  args: {
    storageId:  v.id("_storage"),
    filename:   v.string(),
    uploadedBy: v.string(),
    sectorId:   v.string(),
    scanDate:   v.number(),
    notes:      v.optional(v.string()),
    fileSize:   v.number(),
    mimeType:   v.string(),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("droneScans", {
      ...args,
      status: "processing",
    });
    return id;
  },
});

export const listScans = query({
  args: { sectorId: v.optional(v.string()) },
  handler: async (ctx, { sectorId }) => {
    const rows = sectorId
      ? await ctx.db
          .query("droneScans")
          .withIndex("by_sector", (q) => q.eq("sectorId", sectorId))
          .order("desc")
          .take(20)
      : await ctx.db.query("droneScans").order("desc").take(20);

    return await Promise.all(
      rows.map(async (row) => ({
        ...row,
        url: row.status === "ready" ? await ctx.storage.getUrl(row.storageId) : null,
      }))
    );
  },
});

export const deleteScan = mutation({
  args: { id: v.id("droneScans") },
  handler: async (ctx, { id }) => {
    const scan = await ctx.db.get(id);
    if (!scan) return;
    await ctx.storage.delete(scan.storageId);
    await ctx.db.delete(id);
  },
});
