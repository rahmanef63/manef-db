import { query, mutation, action } from "../../_generated/server";
import { v } from "convex/values";

const syncStatus = v.union(
  v.literal("pending"),
  v.literal("processing"),
  v.literal("done"),
  v.literal("failed")
);

const syncDirection = v.union(
  v.literal("pull"),
  v.literal("push"),
  v.literal("reconcile")
);

export const getTenantItems = query({
    args: { tenantId: v.string() },
    returns: v.array(
        v.object({
            _id: v.id("tenantCrudItems"),
            key: v.string(),
            value: v.string(),
            createdAt: v.number(),
            updatedAt: v.number(),
        })
    ),
    handler: async (ctx, args) => {
        const items = await ctx.db
            .query("tenantCrudItems")
            .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
            .order("desc")
            .take(50);
        return items.map((i) => ({
            _id: i._id,
            key: i.key,
            value: i.value,
            createdAt: i.createdAt,
            updatedAt: i.updatedAt,
        }));
    },
});

export const setTenantItem = mutation({
    args: {
        tenantId: v.string(),
        key: v.string(),
        value: v.string(),
    },
    returns: v.id("tenantCrudItems"),
    handler: async (ctx, args) => {
        return await ctx.db.insert("tenantCrudItems", {
            tenantId: args.tenantId,
            key: args.key,
            value: args.value,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        });
    },
});

export const enqueueSyncOutbox = mutation({
    args: {
        entityKey: v.string(),
        entityType: v.string(),
        operation: v.string(),
        payload: v.optional(v.any()),
        source: v.optional(v.string()),
        tenantId: v.optional(v.string()),
    },
    returns: v.id("syncOutbox"),
    handler: async (ctx, args) => {
        const now = Date.now();
        const eventId = `${args.entityType}:${args.entityKey}:${args.operation}:${now}`;
        return await ctx.db.insert("syncOutbox", {
            attemptCount: 0,
            createdAt: now,
            entityKey: args.entityKey,
            entityType: args.entityType,
            eventId,
            operation: args.operation,
            payload: args.payload,
            source: args.source ?? "dashboard",
            status: "pending",
            tenantId: args.tenantId,
            updatedAt: now,
        });
    },
});

export const listPendingOutbox = query({
    args: {
        limit: v.optional(v.number()),
        tenantId: v.optional(v.string()),
    },
    returns: v.array(
        v.object({
            _id: v.id("syncOutbox"),
            eventId: v.string(),
            entityType: v.string(),
            entityKey: v.string(),
            operation: v.string(),
            payload: v.optional(v.any()),
            status: syncStatus,
            attemptCount: v.number(),
            lastError: v.optional(v.string()),
            createdAt: v.number(),
            updatedAt: v.number(),
        })
    ),
    handler: async (ctx, args) => {
        const take = args.limit ?? 100;
        const rows = args.tenantId
          ? await ctx.db
              .query("syncOutbox")
              .withIndex("by_tenant_status", (q) => q.eq("tenantId", args.tenantId).eq("status", "pending"))
              .take(take)
          : await ctx.db
              .query("syncOutbox")
              .withIndex("by_status", (q) => q.eq("status", "pending"))
              .take(take);
        return rows.map((row) => ({
          _id: row._id,
          eventId: row.eventId,
          entityType: row.entityType,
          entityKey: row.entityKey,
          operation: row.operation,
          payload: row.payload,
          status: row.status,
          attemptCount: row.attemptCount,
          lastError: row.lastError,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        }));
    },
});

export const markOutboxStatus = mutation({
    args: {
        id: v.id("syncOutbox"),
        lastError: v.optional(v.string()),
        status: syncStatus,
    },
    returns: v.null(),
    handler: async (ctx, args) => {
        const existing = await ctx.db.get(args.id);
        if (!existing) return null;
        const now = Date.now();
        await ctx.db.patch(args.id, {
            attemptCount:
              args.status === "failed" || args.status === "processing"
                ? existing.attemptCount + 1
                : existing.attemptCount,
            lastError: args.lastError,
            processedAt: args.status === "done" ? now : existing.processedAt,
            status: args.status,
            updatedAt: now,
        });
        return null;
    },
});

export const startSyncRun = mutation({
    args: {
        direction: syncDirection,
        source: v.string(),
        tenantId: v.optional(v.string()),
    },
    returns: v.id("syncRuns"),
    handler: async (ctx, args) => {
        const now = Date.now();
        const runId = `${args.direction}:${args.source}:${now}`;
        return await ctx.db.insert("syncRuns", {
            direction: args.direction,
            runId,
            source: args.source,
            startedAt: now,
            status: "processing",
            tenantId: args.tenantId,
            updatedAt: now,
        });
    },
});

export const finishSyncRun = mutation({
    args: {
        id: v.id("syncRuns"),
        error: v.optional(v.string()),
        stats: v.optional(v.any()),
        status: syncStatus,
    },
    returns: v.null(),
    handler: async (ctx, args) => {
        await ctx.db.patch(args.id, {
            endedAt: Date.now(),
            error: args.error,
            stats: args.stats,
            status: args.status,
            updatedAt: Date.now(),
        });
        return null;
    },
});

export const upsertSyncState = mutation({
    args: {
        key: v.string(),
        notes: v.optional(v.string()),
        tenantId: v.optional(v.string()),
        value: v.any(),
    },
    returns: v.id("syncState"),
    handler: async (ctx, args) => {
        const existing = args.tenantId
          ? await ctx.db
              .query("syncState")
              .withIndex("by_tenant_key", (q) => q.eq("tenantId", args.tenantId).eq("key", args.key))
              .first()
          : await ctx.db
              .query("syncState")
              .withIndex("by_key", (q) => q.eq("key", args.key))
              .first();
        const now = Date.now();
        if (existing) {
          await ctx.db.patch(existing._id, {
            notes: args.notes,
            updatedAt: now,
            value: args.value,
          });
          return existing._id;
        }
        return await ctx.db.insert("syncState", {
          createdAt: now,
          key: args.key,
          notes: args.notes,
          tenantId: args.tenantId,
          updatedAt: now,
          value: args.value,
        });
    },
});

export const processCoreItem = action({
    args: { itemId: v.id("tenantCrudItems") },
    returns: v.null(),
    handler: async (_ctx, args) => {
        console.log(`Processing core item: ${args.itemId}`);
        return null;
    },
});
