import { query, mutation, action } from "../../_generated/server";
import { v } from "convex/values";

async function enqueueOutbox(
    ctx: { db: { insert: (...args: any[]) => Promise<any> } },
    args: {
        entityKey: string;
        entityType: string;
        operation: string;
        payload?: unknown;
        source?: string;
        tenantId?: string;
    },
) {
    const now = Date.now();
    const eventId = `${args.entityType}:${args.entityKey}:${args.operation}:${now}`;
    return await ctx.db.insert("syncOutbox", {
        attemptCount: 0,
        createdAt: now,
        entityKey: args.entityKey,
        entityType: args.entityType,
        eventId,
        lastError: undefined,
        operation: args.operation,
        payload: args.payload,
        processedAt: undefined,
        source: args.source ?? "dashboard",
        status: "pending",
        tenantId: args.tenantId,
        updatedAt: now,
    });
}

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
        expectedUpdatedAt: v.optional(v.number()),
    },
    returns: v.object({
        entryId: v.id("configEntries"),
        outboxId: v.optional(v.id("syncOutbox")),
    }),
    handler: async (ctx, args) => {
        const {
            expectedUpdatedAt,
            ...writeArgs
        } = args;
        const existing = await ctx.db
            .query("configEntries")
            .withIndex("by_tenant_key", (q) =>
                q.eq("tenantId", writeArgs.tenantId).eq("key", writeArgs.key)
            )
            .first();
        if (
            expectedUpdatedAt !== undefined &&
            existing &&
            existing.updatedAt !== expectedUpdatedAt
        ) {
            throw new Error(
                `Config conflict for ${writeArgs.key}: expected updatedAt=${expectedUpdatedAt}, actual=${existing.updatedAt}`
            );
        }
        const payload = {
            ...writeArgs,
            source: writeArgs.source ?? "manual",
            updatedAt: Date.now(),
        };
        let entryId;
        if (existing) {
            await ctx.db.patch(existing._id, payload);
            entryId = existing._id;
        } else {
            entryId = await ctx.db.insert("configEntries", payload);
        }
        const outboxId = await enqueueOutbox(ctx, {
            entityKey: `${writeArgs.tenantId ?? ""}:${writeArgs.key}`,
            entityType: "config",
            operation: "upsert",
            payload: {
                key: writeArgs.key,
                value: writeArgs.value,
                category: writeArgs.category,
                description: writeArgs.description,
                tags: writeArgs.tags,
                valueType: writeArgs.valueType,
                defaultValue: writeArgs.defaultValue,
                runtimePath: writeArgs.runtimePath,
                tenantId: writeArgs.tenantId,
                entryId,
                expectedUpdatedAt,
            },
            source: "dashboard",
            tenantId: writeArgs.tenantId,
        });
        return { entryId, outboxId };
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
    args: {
        id: v.id("configEntries"),
        expectedUpdatedAt: v.optional(v.number()),
    },
    returns: v.null(),
    handler: async (ctx, args) => {
        const existing = await ctx.db.get(args.id);
        if (!existing) return null;
        if (
            args.expectedUpdatedAt !== undefined &&
            existing.updatedAt !== args.expectedUpdatedAt
        ) {
            throw new Error(
                `Config conflict for ${existing.key}: expected updatedAt=${args.expectedUpdatedAt}, actual=${existing.updatedAt}`
            );
        }
        await enqueueOutbox(ctx, {
            entityKey: `${existing.tenantId ?? ""}:${existing.key}`,
            entityType: "config",
            operation: "delete",
            payload: {
                key: existing.key,
                tenantId: existing.tenantId,
                runtimePath: existing.runtimePath,
                expectedUpdatedAt: args.expectedUpdatedAt,
            },
            source: "dashboard",
            tenantId: existing.tenantId,
        });
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
    handler: async (_ctx) => {
        console.log("Reloading configuration from gateway...");
        return null;
    },
});
