import { query, mutation, action } from "../../_generated/server";
import { v } from "convex/values";

/**
 * List config entries, optionally by category.
 */
export const listConfig = query({
    args: { category: v.optional(v.string()), tenantId: v.optional(v.string()) },
    returns: v.array(
        v.object({
            _id: v.id("configEntries"),
            _creationTime: v.number(),
            key: v.string(),
            value: v.string(),
            category: v.string(),
            description: v.optional(v.string()),
            tags: v.optional(v.array(v.string())),
            valueType: v.optional(v.string()),
            defaultValue: v.optional(v.string()),
        })
    ),
    handler: async (ctx, args) => {
        let entries;
        if (args.category) {
            entries = await ctx.db
                .query("configEntries")
                .withIndex("by_category", (q) => q.eq("category", args.category!))
                .order("asc")
                .take(500);
        } else {
            entries = await ctx.db.query("configEntries").order("asc").take(500);
        }
        return entries.map((e) => ({
            _id: e._id,
            _creationTime: e._creationTime,
            key: e.key,
            value: e.value,
            category: e.category,
            description: e.description,
            tags: e.tags,
            valueType: e.valueType,
            defaultValue: e.defaultValue,
        }));
    },
});

/**
 * Get a single config entry by key.
 */
export const getConfig = query({
    args: { key: v.string() },
    returns: v.union(
        v.object({
            _id: v.id("configEntries"),
            key: v.string(),
            value: v.string(),
            category: v.string(),
            description: v.optional(v.string()),
            valueType: v.optional(v.string()),
        }),
        v.null()
    ),
    handler: async (ctx, args) => {
        const entry = await ctx.db
            .query("configEntries")
            .withIndex("by_key", (q) => q.eq("key", args.key))
            .first();
        if (!entry) return null;
        return {
            _id: entry._id,
            key: entry.key,
            value: entry.value,
            category: entry.category,
            description: entry.description,
            valueType: entry.valueType,
        };
    },
});

/**
 * Set a config entry (upsert).
 */
export const setConfig = mutation({
    args: {
        key: v.string(),
        value: v.string(),
        category: v.string(),
        description: v.optional(v.string()),
        tags: v.optional(v.array(v.string())),
        valueType: v.optional(v.string()),
        defaultValue: v.optional(v.string()),
        tenantId: v.optional(v.string()),
    },
    returns: v.id("configEntries"),
    handler: async (ctx, args) => {
        const existing = await ctx.db
            .query("configEntries")
            .withIndex("by_key", (q) => q.eq("key", args.key))
            .first();
        if (existing) {
            await ctx.db.patch(existing._id, { ...args, updatedAt: Date.now() });
            return existing._id;
        }
        return await ctx.db.insert("configEntries", {
            ...args,
            updatedAt: Date.now(),
        });
    },
});

/**
 * Delete a config entry.
 */
export const deleteConfig = mutation({
    args: { id: v.id("configEntries") },
    returns: v.null(),
    handler: async (ctx, args) => {
        await ctx.db.delete(args.id);
        return null;
    },
});

/**
 * Reload config from gateway.
 */
export const reloadConfig = action({
    args: {},
    returns: v.null(),
    handler: async (ctx) => {
        console.log("Reloading configuration from gateway...");
        return null;
    },
});
