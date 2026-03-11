import { query, mutation, action } from "../../_generated/server";
import { v } from "convex/values";

/**
 * List all configured channels.
 */
export const listChannels = query({
    args: { tenantId: v.optional(v.string()) },
    returns: v.array(
        v.object({
            _id: v.id("channels"),
            _creationTime: v.number(),
            channelId: v.string(),
            type: v.string(),
            label: v.optional(v.string()),
            configured: v.boolean(),
            running: v.boolean(),
            linked: v.optional(v.boolean()),
            connected: v.optional(v.boolean()),
            mode: v.optional(v.string()),
            lastStartAt: v.optional(v.number()),
            lastProbeAt: v.optional(v.number()),
            lastConnectAt: v.optional(v.number()),
            lastMessageAt: v.optional(v.number()),
            authAgeMs: v.optional(v.number()),
            lastError: v.optional(v.string()),
            config: v.optional(v.any()),
        })
    ),
    handler: async (ctx, args) => {
        const channels = await ctx.db.query("channels").order("desc").take(50);
        return channels.map((c) => ({
            _id: c._id,
            _creationTime: c._creationTime,
            channelId: c.channelId,
            type: c.type,
            label: c.label,
            configured: c.configured,
            running: c.running,
            linked: c.linked,
            connected: c.connected,
            mode: c.mode,
            lastStartAt: c.lastStartAt,
            lastProbeAt: c.lastProbeAt,
            lastConnectAt: c.lastConnectAt,
            lastMessageAt: c.lastMessageAt,
            authAgeMs: c.authAgeMs,
            lastError: c.lastError,
            config: c.config,
        }));
    },
});

/**
 * Get channel by ID.
 */
export const getChannel = query({
    args: { channelId: v.string() },
    returns: v.union(
        v.object({
            _id: v.id("channels"),
            _creationTime: v.number(),
            channelId: v.string(),
            type: v.string(),
            configured: v.boolean(),
            running: v.boolean(),
            linked: v.optional(v.boolean()),
            connected: v.optional(v.boolean()),
            mode: v.optional(v.string()),
            config: v.optional(v.any()),
        }),
        v.null()
    ),
    handler: async (ctx, args) => {
        const channel = await ctx.db
            .query("channels")
            .withIndex("by_channelId", (q) => q.eq("channelId", args.channelId))
            .first();
        if (!channel) return null;
        return {
            _id: channel._id,
            _creationTime: channel._creationTime,
            channelId: channel.channelId,
            type: channel.type,
            configured: channel.configured,
            running: channel.running,
            linked: channel.linked,
            connected: channel.connected,
            mode: channel.mode,
            config: channel.config,
        };
    },
});

/**
 * Create or update a channel configuration.
 */
export const upsertChannel = mutation({
    args: {
        channelId: v.string(),
        type: v.string(),
        label: v.optional(v.string()),
        configured: v.boolean(),
        running: v.boolean(),
        linked: v.optional(v.boolean()),
        connected: v.optional(v.boolean()),
        mode: v.optional(v.string()),
        lastStartAt: v.optional(v.number()),
        lastStopAt: v.optional(v.number()),
        lastProbeAt: v.optional(v.number()),
        lastConnectAt: v.optional(v.number()),
        lastMessageAt: v.optional(v.number()),
        lastError: v.optional(v.string()),
        authAgeMs: v.optional(v.number()),
        config: v.optional(v.any()),
        tenantId: v.optional(v.string()),
    },
    returns: v.id("channels"),
    handler: async (ctx, args) => {
        const existing = await ctx.db
            .query("channels")
            .withIndex("by_channelId", (q) => q.eq("channelId", args.channelId))
            .first();
        if (existing) {
            await ctx.db.patch(existing._id, {
                ...args,
                updatedAt: Date.now(),
            });
            return existing._id;
        }
        return await ctx.db.insert("channels", {
            ...args,
            linked: args.linked ?? false,
            connected: args.connected ?? false,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        });
    },
});

/**
 * Bulk-sync channel configuration and allowlist mirrors from OpenClaw runtime.
 */
export const syncRuntimeChannels = mutation({
    args: {
        channels: v.array(
            v.object({
                channelId: v.string(),
                type: v.string(),
                label: v.optional(v.string()),
                configured: v.boolean(),
                running: v.boolean(),
                linked: v.optional(v.boolean()),
                connected: v.optional(v.boolean()),
                mode: v.optional(v.string()),
                lastStartAt: v.optional(v.number()),
                lastStopAt: v.optional(v.number()),
                lastProbeAt: v.optional(v.number()),
                lastConnectAt: v.optional(v.number()),
                lastMessageAt: v.optional(v.number()),
                lastError: v.optional(v.string()),
                authAgeMs: v.optional(v.number()),
                config: v.optional(v.any()),
                tenantId: v.optional(v.string()),
                allowList: v.optional(v.array(v.string())),
            })
        ),
    },
    returns: v.object({ upserted: v.number(), allowListEntries: v.number() }),
    handler: async (ctx, args) => {
        const now = Date.now();
        let upserted = 0;
        let allowListEntries = 0;

        for (const channel of args.channels) {
            const {
                allowList,
                ...channelRecord
            } = channel;

            const existing = await ctx.db
                .query("channels")
                .withIndex("by_channelId", (q) => q.eq("channelId", channel.channelId))
                .first();

            let channelDocId;
            if (existing) {
                await ctx.db.patch(existing._id, {
                    ...channelRecord,
                    updatedAt: now,
                });
                channelDocId = existing._id;
            } else {
                channelDocId = await ctx.db.insert("channels", {
                    ...channelRecord,
                    linked: channelRecord.linked ?? false,
                    connected: channelRecord.connected ?? false,
                    createdAt: now,
                    updatedAt: now,
                });
            }

            const existingAllowList = await ctx.db
                .query("channelAllowList")
                .withIndex("by_channelId", (q) => q.eq("channelId", channel.channelId))
                .collect();

            for (const entry of existingAllowList) {
                await ctx.db.delete(entry._id);
            }

            for (const pattern of allowList ?? []) {
                await ctx.db.insert("channelAllowList", {
                    channelId: channel.channelId,
                    pattern,
                    tenantId: channel.tenantId,
                    createdAt: now,
                });
                allowListEntries++;
            }

            void channelDocId;
            upserted++;
        }

        return { upserted, allowListEntries };
    },
});

/**
 * Delete a channel.
 */
export const deleteChannel = mutation({
    args: { id: v.id("channels") },
    returns: v.null(),
    handler: async (ctx, args) => {
        await ctx.db.delete(args.id);
        return null;
    },
});

/**
 * Trigger a channel refresh action.
 */
export const refreshChannel = action({
    args: { channelId: v.string() },
    returns: v.null(),
    handler: async (ctx, args) => {
        console.log(`Refreshing channel: ${args.channelId}`);
        return null;
    },
});
