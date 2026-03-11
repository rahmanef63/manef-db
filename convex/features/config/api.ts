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
            source: v.optional(v.string()),
            runtimePath: v.optional(v.string()),
        })
    ),
    handler: async (ctx, args) => {
        let entries = args.tenantId
            ? await ctx.db
                  .query("configEntries")
                  .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId!))
                  .collect()
            : await ctx.db.query("configEntries").collect();
        if (args.category) {
            entries = entries.filter((entry) => entry.category === args.category);
        }
        entries.sort((left, right) => left.key.localeCompare(right.key));
        entries = entries.slice(0, 500);
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
            source: e.source,
            runtimePath: e.runtimePath,
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
            source: v.optional(v.string()),
            runtimePath: v.optional(v.string()),
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
            source: entry.source,
            runtimePath: entry.runtimePath,
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
        source: v.optional(v.string()),
        runtimePath: v.optional(v.string()),
    },
    returns: v.id("configEntries"),
    handler: async (ctx, args) => {
        const existing = await ctx.db
            .query("configEntries")
            .withIndex("by_tenant_key", (q) =>
                q.eq("tenantId", args.tenantId).eq("key", args.key)
            )
            .first();
        const payload = {
            ...args,
            source: args.source ?? "manual",
            updatedAt: Date.now(),
        };
        if (existing) {
            await ctx.db.patch(existing._id, payload);
            return existing._id;
        }
        return await ctx.db.insert("configEntries", payload);
    },
});

/**
 * Bulk-sync runtime-mirrored OpenClaw config entries.
 */
export const syncRuntimeConfig = mutation({
    args: {
        entries: v.array(
            v.object({
                key: v.string(),
                value: v.string(),
                category: v.string(),
                description: v.optional(v.string()),
                tags: v.optional(v.array(v.string())),
                valueType: v.optional(v.string()),
                defaultValue: v.optional(v.string()),
                source: v.optional(v.string()),
                runtimePath: v.optional(v.string()),
                tenantId: v.optional(v.string()),
            })
        ),
    },
    returns: v.object({
        upserted: v.number(),
        deleted: v.number(),
    }),
    handler: async (ctx, args) => {
        const now = Date.now();
        let upserted = 0;
        let deleted = 0;
        const seen = new Set<string>();
        const tenantIds = new Set<string>();

        for (const entry of args.entries) {
            const tenantId = entry.tenantId;
            const source = entry.source ?? "openclaw-runtime";
            if (tenantId) {
                tenantIds.add(tenantId);
            }
            seen.add(`${tenantId ?? ""}::${entry.key}`);
            const existing = await ctx.db
                .query("configEntries")
                .withIndex("by_tenant_key", (q) =>
                    q.eq("tenantId", tenantId).eq("key", entry.key)
                )
                .first();
            const payload = {
                ...entry,
                source,
                updatedAt: now,
            };
            if (existing) {
                await ctx.db.patch(existing._id, payload);
            } else {
                await ctx.db.insert("configEntries", payload);
            }
            upserted++;
        }

        for (const tenantId of tenantIds) {
            const existingEntries = await ctx.db
                .query("configEntries")
                .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
                .collect();
            for (const entry of existingEntries) {
                if (entry.source !== "openclaw-runtime") {
                    continue;
                }
                if (!seen.has(`${tenantId}::${entry.key}`)) {
                    await ctx.db.delete(entry._id);
                    deleted++;
                }
            }
        }

        return { upserted, deleted };
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
