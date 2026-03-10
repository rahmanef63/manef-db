import { query, mutation, action } from "../../_generated/server";
import { v } from "convex/values";

/**
 * List all connected instances.
 */
export const listInstances = query({
    args: {},
    returns: v.array(
        v.object({
            _id: v.id("instances"),
            _creationTime: v.number(),
            instanceId: v.string(),
            name: v.string(),
            info: v.optional(v.string()),
            tags: v.optional(v.array(v.string())),
            platform: v.optional(v.string()),
            version: v.optional(v.string()),
            role: v.optional(v.string()),
            lastSeenAt: v.number(),
        })
    ),
    handler: async (ctx) => {
        const instances = await ctx.db.query("instances").order("desc").take(100);
        return instances.map((i) => ({
            _id: i._id,
            _creationTime: i._creationTime,
            instanceId: i.instanceId,
            name: i.name,
            info: i.info,
            tags: i.tags,
            platform: i.platform,
            version: i.version,
            role: i.role,
            lastSeenAt: i.lastSeenAt,
        }));
    },
});

/**
 * Register or update an instance heartbeat.
 */
export const upsertInstance = mutation({
    args: {
        instanceId: v.string(),
        name: v.string(),
        info: v.optional(v.string()),
        tags: v.optional(v.array(v.string())),
        platform: v.optional(v.string()),
        arch: v.optional(v.string()),
        version: v.optional(v.string()),
        role: v.optional(v.string()),
        tenantId: v.optional(v.string()),
    },
    returns: v.id("instances"),
    handler: async (ctx, args) => {
        const existing = await ctx.db
            .query("instances")
            .withIndex("by_instanceId", (q) => q.eq("instanceId", args.instanceId))
            .first();
        const now = Date.now();
        if (existing) {
            await ctx.db.patch(existing._id, {
                ...args,
                lastSeenAt: now,
            });
            return existing._id;
        }
        return await ctx.db.insert("instances", {
            ...args,
            lastSeenAt: now,
            createdAt: now,
        });
    },
});

/**
 * Remove a disconnected instance.
 */
export const removeInstance = mutation({
    args: { id: v.id("instances") },
    returns: v.null(),
    handler: async (ctx, args) => {
        await ctx.db.delete(args.id);
        return null;
    },
});

/**
 * Trigger instance refresh.
 */
export const refreshInstances = action({
    args: {},
    returns: v.null(),
    handler: async (ctx) => {
        console.log("Refreshing instances from gateway...");
        return null;
    },
});
