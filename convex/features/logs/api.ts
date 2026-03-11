import { query, mutation, action } from "../../_generated/server";
import { v } from "convex/values";

/**
 * Stream latest log entries.
 */
export const getRecentLogs = query({
    args: {
        level: v.optional(v.string()),
        source: v.optional(v.string()),
        searchText: v.optional(v.string()),
        limit: v.optional(v.number()),
    },
    returns: v.array(
        v.object({
            _id: v.id("gatewayLogs"),
            _creationTime: v.number(),
            level: v.string(),
            source: v.string(),
            message: v.string(),
            timestamp: v.number(),
        })
    ),
    handler: async (ctx, args) => {
        const takeCount = args.limit ?? 100;
        let logs;
        if (args.level) {
            logs = await ctx.db
                .query("gatewayLogs")
                .withIndex("by_level", (q) => q.eq("level", args.level!))
                .order("desc")
                .take(takeCount);
        } else {
            logs = await ctx.db.query("gatewayLogs").order("desc").take(takeCount);
        }
        let mapped = logs.map((l) => ({
            _id: l._id,
            _creationTime: l._creationTime,
            level: l.level,
            source: l.source,
            message: l.message,
            timestamp: l.timestamp,
        }));
        if (args.source) {
            mapped = mapped.filter((log) => log.source === args.source);
        }
        if (args.searchText) {
            const needle = args.searchText.toLowerCase();
            mapped = mapped.filter((log) =>
                log.message.toLowerCase().includes(needle) ||
                log.source.toLowerCase().includes(needle)
            );
        }
        return mapped;
    },
});

/**
 * Write a log entry.
 */
export const writeLog = mutation({
    args: {
        runtimeKey: v.optional(v.string()),
        level: v.string(),
        source: v.string(),
        message: v.string(),
        details: v.optional(v.any()),
        tenantId: v.optional(v.string()),
    },
    returns: v.id("gatewayLogs"),
    handler: async (ctx, args) => {
        return await ctx.db.insert("gatewayLogs", {
            ...args,
            timestamp: Date.now(),
        });
    },
});

/**
 * Upsert runtime log entries in bulk using a stable runtime key.
 */
export const syncRuntimeLogs = mutation({
    args: {
        logs: v.array(
            v.object({
                runtimeKey: v.string(),
                level: v.string(),
                source: v.string(),
                message: v.string(),
                details: v.optional(v.any()),
                timestamp: v.number(),
                tenantId: v.optional(v.string()),
            })
        ),
    },
    returns: v.object({ upserted: v.number() }),
    handler: async (ctx, args) => {
        let upserted = 0;

        for (const entry of args.logs) {
            const existing = await ctx.db
                .query("gatewayLogs")
                .withIndex("by_runtimeKey", (q) => q.eq("runtimeKey", entry.runtimeKey))
                .first();

            if (existing) {
                await ctx.db.patch(existing._id, entry);
            } else {
                await ctx.db.insert("gatewayLogs", entry);
            }

            upserted++;
        }

        return { upserted };
    },
});

/**
 * Clear old log entries.
 */
export const clearLogs = mutation({
    args: { olderThanMs: v.optional(v.number()) },
    returns: v.number(),
    handler: async (ctx, args) => {
        const cutoff = args.olderThanMs
            ? Date.now() - args.olderThanMs
            : Date.now() - 7 * 24 * 60 * 60 * 1000; // 7 days default
        const oldLogs = await ctx.db
            .query("gatewayLogs")
            .withIndex("by_timestamp")
            .order("asc")
            .take(500);
        let deleted = 0;
        for (const log of oldLogs) {
            if (log.timestamp < cutoff) {
                await ctx.db.delete(log._id);
                deleted++;
            }
        }
        return deleted;
    },
});

/**
 * Fetch logs from the gateway (action).
 */
export const fetchGatewayLogs = action({
    args: {},
    returns: v.null(),
    handler: async (ctx) => {
        console.log("Fetching logs from gateway...");
        return null;
    },
});
