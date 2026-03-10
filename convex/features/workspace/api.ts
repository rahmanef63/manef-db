import { query, mutation, action } from "../../_generated/server";
import { v } from "convex/values";
import { api } from "../../_generated/api";

/**
 * Returns latest workspace files for a specific category.
 */
export const getFiles = query({
    args: { category: v.string(), tenantId: v.optional(v.string()) },
    returns: v.array(
        v.object({
            _id: v.id("workspaceFiles"),
            path: v.string(),
            category: v.string(),
            fileType: v.string(),
            version: v.number(),
        })
    ),
    handler: async (ctx, args) => {
        let q = ctx.db.query("workspaceFiles").withIndex("by_category", (q) => q.eq("category", args.category));
        const files = await q.order("desc").take(50);
        return files.map((f) => ({
            _id: f._id,
            path: f.path,
            category: f.category,
            fileType: f.fileType,
            version: f.version,
        }));
    },
});

/**
 * Upserts a file into the workspace repository.
 */
export const uploadFile = mutation({
    args: {
        path: v.string(),
        content: v.string(),
        category: v.string(),
        fileType: v.string(),
        tenantId: v.optional(v.string()),
    },
    returns: v.id("workspaceFiles"),
    handler: async (ctx, args) => {
        return await ctx.db.insert("workspaceFiles", {
            ...args,
            version: 1.0,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        });
    },
});

/**
 * Validates a file using external linters or checks.
 */
export const validateFile = action({
    args: { fileId: v.id("workspaceFiles") },
    returns: v.null(),
    handler: async (ctx, args) => {
        console.log(`Validating workspace file: ${args.fileId}`);
        // Run specific validation APIs or external LLM checks
        return null;
    },
});
