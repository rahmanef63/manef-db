import { query, mutation, action } from "../../_generated/server";
import { v } from "convex/values";

/**
 * List all nodes.
 */
export const listNodes = query({
    args: {},
    returns: v.array(
        v.object({
            _id: v.id("nodes"),
            _creationTime: v.number(),
            nodeId: v.string(),
            name: v.string(),
            host: v.string(),
            online: v.boolean(),
            capabilities: v.optional(v.array(v.string())),
            platform: v.optional(v.string()),
            lastSeenAt: v.number(),
        })
    ),
    handler: async (ctx) => {
        const nodes = await ctx.db.query("nodes").order("desc").take(50);
        return nodes.map((n) => ({
            _id: n._id,
            _creationTime: n._creationTime,
            nodeId: n.nodeId,
            name: n.name,
            host: n.host,
            online: n.online,
            capabilities: n.capabilities,
            platform: n.platform,
            lastSeenAt: n.lastSeenAt,
        }));
    },
});

/**
 * Get exec approvals for a given host.
 */
export const getExecApprovals = query({
    args: { host: v.string(), agentId: v.string() },
    returns: v.union(
        v.object({
            _id: v.id("execApprovals"),
            host: v.string(),
            agentId: v.string(),
            securityMode: v.string(),
            askMode: v.string(),
            askFallback: v.string(),
            autoAllowSkillClis: v.boolean(),
            allowList: v.optional(v.array(v.string())),
            denyList: v.optional(v.array(v.string())),
        }),
        v.null()
    ),
    handler: async (ctx, args) => {
        const approval = await ctx.db
            .query("execApprovals")
            .withIndex("by_host_agent", (q) =>
                q.eq("host", args.host).eq("agentId", args.agentId)
            )
            .first();
        if (!approval) return null;
        return {
            _id: approval._id,
            host: approval.host,
            agentId: approval.agentId,
            securityMode: approval.securityMode,
            askMode: approval.askMode,
            askFallback: approval.askFallback,
            autoAllowSkillClis: approval.autoAllowSkillClis,
            allowList: approval.allowList,
            denyList: approval.denyList,
        };
    },
});

/**
 * Upsert exec approvals.
 */
export const upsertExecApproval = mutation({
    args: {
        host: v.string(),
        agentId: v.string(),
        securityMode: v.string(),
        askMode: v.string(),
        askFallback: v.string(),
        autoAllowSkillClis: v.boolean(),
        allowList: v.optional(v.array(v.string())),
        denyList: v.optional(v.array(v.string())),
        tenantId: v.optional(v.string()),
    },
    returns: v.id("execApprovals"),
    handler: async (ctx, args) => {
        const existing = await ctx.db
            .query("execApprovals")
            .withIndex("by_host_agent", (q) =>
                q.eq("host", args.host).eq("agentId", args.agentId)
            )
            .first();
        if (existing) {
            await ctx.db.patch(existing._id, { ...args, updatedAt: Date.now() });
            return existing._id;
        }
        return await ctx.db.insert("execApprovals", {
            ...args,
            updatedAt: Date.now(),
        });
    },
});

/**
 * Upsert a node binding (pin agent to node).
 */
export const upsertNodeBinding = mutation({
    args: {
        agentId: v.string(),
        nodeId: v.string(),
        tenantId: v.optional(v.string()),
    },
    returns: v.id("nodeBindings"),
    handler: async (ctx, args) => {
        const existing = await ctx.db
            .query("nodeBindings")
            .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
            .first();
        if (existing) {
            await ctx.db.patch(existing._id, { nodeId: args.nodeId });
            return existing._id;
        }
        return await ctx.db.insert("nodeBindings", {
            ...args,
            createdAt: Date.now(),
        });
    },
});

/**
 * Remove node binding.
 */
export const removeNodeBinding = mutation({
    args: { id: v.id("nodeBindings") },
    returns: v.null(),
    handler: async (ctx, args) => {
        await ctx.db.delete(args.id);
        return null;
    },
});

/**
 * Refresh nodes from gateway.
 */
export const refreshNodes = action({
    args: {},
    returns: v.null(),
    handler: async (ctx) => {
        console.log("Refreshing nodes from gateway...");
        return null;
    },
});
