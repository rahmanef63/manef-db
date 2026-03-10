import { query, mutation, action } from "../../_generated/server";
import { v } from "convex/values";
import { api } from "../../_generated/api";

/**
 * Returns a list of knowledge memories by category.
 */
export const getMemories = query({
    args: { tenantId: v.optional(v.string()), category: v.string() },
    returns: v.array(
        v.object({
            _id: v.id("memories"),
            key: v.string(),
            value: v.string(),
            category: v.string(),
            createdAt: v.number(),
        })
    ),
    handler: async (ctx, args) => {
        const items = args.tenantId
            ? await ctx.db.query("memories").withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId)).filter((q) => q.eq(q.field("category"), args.category)).order("desc").take(50)
            : await ctx.db.query("memories").filter((q) => q.eq(q.field("category"), args.category)).order("desc").take(50);

        return items.map((i) => ({
            _id: i._id,
            key: i.key,
            value: i.value,
            category: i.category,
            createdAt: i.createdAt,
        }));
    },
});

/**
 * Adds a new knowledge memory entry.
 */
export const addMemory = mutation({
    args: {
        key: v.string(),
        value: v.string(),
        category: v.string(),
        tenantId: v.optional(v.string())
    },
    returns: v.id("memories"),
    handler: async (ctx, args) => {
        return await ctx.db.insert("memories", {
            key: args.key,
            value: args.value,
            category: args.category,
            tenantId: args.tenantId,
            createdAt: Date.now(),
        });
    },
});

/**
 * Runs vector search on knowledge memories (mock action).
 */
export const searchKnowledge = action({
    args: { query: v.string() },
    returns: v.null(),
    handler: async (ctx, args) => {
        console.log(`Searching vector knowledge for: ${args.query}`);
        // Typically would call external API to embed query, then use Vector Search on 'vectorChunks'
        return null;
    },
});
