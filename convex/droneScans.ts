/**
 * droneScans.ts — Convex functions for CIRUS drone scan file management.
 *
 * Drone scan files (JPEG, GeoTIFF, etc.) are stored in Convex's built-in
 * file storage.  This module handles the two-step upload flow:
 *   1. generateUploadUrl — get a short-lived upload URL from Convex storage
 *   2. saveScan          — record the file metadata in the droneScans table
 *
 * Additional functions:
 *   listScans  — query: list recent scans (optionally filtered by sector)
 *   deleteScan — mutation: remove the file from storage AND the table row
 */
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * generateUploadUrl — mutation
 * Step 1 of the file upload flow.
 * Returns a short-lived, pre-signed URL that the browser can POST a file to
 * directly, without routing the bytes through any server function.
 * The URL expires after a few minutes — call it immediately before uploading.
 */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * saveScan — mutation
 * Step 2 of the upload flow.  After the browser has uploaded the file bytes,
 * call this to record the metadata in the droneScans table.
 * Status starts as "processing" — a background job would flip it to "ready"
 * once it has verified or processed the file.
 *
 * @param storageId  - the ID returned by Convex storage after the raw upload
 * @param filename   - original file name shown in the widget list
 * @param uploadedBy - user or team name, e.g. "CIRUS Team"
 * @param sectorId   - which watershed sector this scan covers
 * @param scanDate   - Unix ms timestamp of the actual drone flight
 * @param notes      - optional field notes from the pilot
 * @param fileSize   - bytes, displayed in the widget
 * @param mimeType   - e.g. "image/jpeg" or "image/tiff"
 */
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
    // New uploads always start as "processing" — status is updated later
    const id = await ctx.db.insert("droneScans", {
      ...args,
      status: "processing",
    });
    return id;
  },
});

/**
 * listScans — reactive query
 * Returns up to 20 scans, newest first.  If sectorId is provided, filters to
 * that sector only (uses the by_sector index for speed).
 * For "ready" scans, also generates a temporary download URL from Convex
 * storage so the widget can display thumbnails or trigger downloads.
 *
 * @param sectorId - optional filter; omit to list scans across all sectors
 */
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

    // Attach a signed URL to each "ready" scan so the widget can show a thumbnail.
    // "processing" or "error" scans get null — the widget handles that gracefully.
    return await Promise.all(
      rows.map(async (row) => ({
        ...row,
        url: row.status === "ready" ? await ctx.storage.getUrl(row.storageId) : null,
      }))
    );
  },
});

/**
 * deleteScan — mutation
 * Removes a scan from both the database table and Convex file storage.
 * Deleting the storage object first ensures we don't leave orphaned blobs
 * if the db.delete call somehow fails after the storage delete.
 *
 * @param id - the droneScans document ID to remove
 */
export const deleteScan = mutation({
  args: { id: v.id("droneScans") },
  handler: async (ctx, { id }) => {
    const scan = await ctx.db.get(id);
    if (!scan) return;  // already deleted — safe to do nothing
    // Delete the binary file from Convex storage first
    await ctx.storage.delete(scan.storageId);
    // Then remove the metadata row from the table
    await ctx.db.delete(id);
  },
});
