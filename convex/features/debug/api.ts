import { query, mutation, action } from "../../_generated/server";
import { v } from "convex/values";

/**
 * Get the latest snapshot for each type.
 */
export const getLatestSnapshots = query({
    args: {},
    returns: v.array(
        v.object({
            _id: v.id("debugSnapshots"),
            _creationTime: v.number(),
            type: v.string(),
            data: v.any(),
            capturedAt: v.number(),
        })
    ),
    handler: async (ctx) => {
        const types = ["status", "health", "heartbeat"];
        const results = [];
        for (const type of types) {
            const snapshot = await ctx.db
                .query("debugSnapshots")
                .withIndex("by_type", (q) => q.eq("type", type))
                .order("desc")
                .first();
            if (snapshot) {
                results.push({
                    _id: snapshot._id,
                    _creationTime: snapshot._creationTime,
                    type: snapshot.type,
                    data: snapshot.data,
                    capturedAt: snapshot.capturedAt,
                });
            }
        }
        return results;
    },
});

/**
 * Save a debug snapshot.
 */
export const saveSnapshot = mutation({
    args: {
        type: v.string(),
        data: v.any(),
        tenantId: v.optional(v.string()),
    },
    returns: v.id("debugSnapshots"),
    handler: async (ctx, args) => {
        return await ctx.db.insert("debugSnapshots", {
            ...args,
            capturedAt: Date.now(),
        });
    },
});

/**
 * List recent RPC calls.
 */
export const listRpcCalls = query({
    args: { limit: v.optional(v.number()) },
    returns: v.array(
        v.object({
            _id: v.id("rpcCalls"),
            _creationTime: v.number(),
            method: v.string(),
            params: v.optional(v.any()),
            result: v.optional(v.any()),
            error: v.optional(v.string()),
            calledAt: v.number(),
            durationMs: v.optional(v.number()),
        })
    ),
    handler: async (ctx, args) => {
        const takeCount = args.limit ?? 50;
        const calls = await ctx.db.query("rpcCalls").order("desc").take(takeCount);
        return calls.map((c) => ({
            _id: c._id,
            _creationTime: c._creationTime,
            method: c.method,
            params: c.params,
            result: c.result,
            error: c.error,
            calledAt: c.calledAt,
            durationMs: c.durationMs,
        }));
    },
});

/**
 * Execute a manual RPC call.
 */
export const callRpc = action({
    args: {
        method: v.string(),
        params: v.optional(v.any()),
    },
    returns: v.null(),
    handler: async (ctx, args) => {
        console.log(`Manual RPC call: ${args.method}`, args.params);
        // In production, this would call the gateway API
        return null;
    },
});

/**
 * Refresh snapshots from gateway.
 */
export const refreshSnapshots = action({
    args: {},
    returns: v.null(),
    handler: async (ctx) => {
        console.log("Refreshing debug snapshots from gateway...");
        return null;
    },
});

/**
 * Record a sync audit entry after a runtime sync run.
 */
export const recordSyncAudit = mutation({
    args: {
        domain: v.string(),
        inserted: v.optional(v.number()),
        updated: v.optional(v.number()),
        unchanged: v.optional(v.number()),
        deleted: v.optional(v.number()),
        upserted: v.optional(v.number()),
        failed: v.optional(v.number()),
        error: v.optional(v.string()),
        status: v.string(),
        tenantId: v.optional(v.string()),
    },
    returns: v.id("syncAuditLog"),
    handler: async (ctx, args) => {
        // Keep only last 500 audit entries per domain to prevent unbounded growth
        const old = await ctx.db
            .query("syncAuditLog")
            .withIndex("by_domain", (q) => q.eq("domain", args.domain))
            .order("asc")
            .take(1);
        const count = await ctx.db.query("syncAuditLog")
            .withIndex("by_domain", (q) => q.eq("domain", args.domain))
            .collect();
        if (count.length >= 500 && old.length > 0) {
            await ctx.db.delete(old[0]._id);
        }
        return await ctx.db.insert("syncAuditLog", {
            ...args,
            syncedAt: Date.now(),
        });
    },
});

/**
 * List recent sync audit entries.
 */
export const listSyncAudit = query({
    args: { domain: v.optional(v.string()), limit: v.optional(v.number()) },
    returns: v.array(
        v.object({
            _id: v.id("syncAuditLog"),
            _creationTime: v.number(),
            domain: v.string(),
            inserted: v.optional(v.number()),
            updated: v.optional(v.number()),
            unchanged: v.optional(v.number()),
            deleted: v.optional(v.number()),
            upserted: v.optional(v.number()),
            failed: v.optional(v.number()),
            error: v.optional(v.string()),
            status: v.string(),
            syncedAt: v.number(),
        })
    ),
    handler: async (ctx, args) => {
        const takeCount = args.limit ?? 50;
        let entries;
        if (args.domain) {
            entries = await ctx.db
                .query("syncAuditLog")
                .withIndex("by_domain", (q) => q.eq("domain", args.domain!))
                .order("desc")
                .take(takeCount);
        } else {
            entries = await ctx.db
                .query("syncAuditLog")
                .withIndex("by_syncedAt")
                .order("desc")
                .take(takeCount);
        }
        return entries.map((e) => ({
            _id: e._id,
            _creationTime: e._creationTime,
            domain: e.domain,
            inserted: e.inserted,
            updated: e.updated,
            unchanged: e.unchanged,
            deleted: e.deleted,
            upserted: e.upserted,
            failed: e.failed,
            error: e.error,
            status: e.status,
            syncedAt: e.syncedAt,
        }));
    },
});
