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

export const listNodeBindings = query({
    args: {
        agentIds: v.optional(v.array(v.string())),
    },
    returns: v.array(
        v.object({
            _id: v.id("nodeBindings"),
            agentId: v.string(),
            nodeId: v.string(),
            nodeHost: v.optional(v.string()),
            nodeName: v.optional(v.string()),
        }),
    ),
    handler: async (ctx, args) => {
        const bindings = await ctx.db.query("nodeBindings").collect();
        const allowedAgentIds = args.agentIds ? new Set(args.agentIds) : null;
        const filteredBindings = bindings.filter((binding) => {
            if (allowedAgentIds && !allowedAgentIds.has(binding.agentId)) {
                return false;
            }
            return true;
        });

        return Promise.all(
            filteredBindings.map(async (binding) => {
                const node = await ctx.db
                    .query("nodes")
                    .withIndex("by_nodeId", (q) => q.eq("nodeId", binding.nodeId))
                    .first();
                return {
                    _id: binding._id,
                    agentId: binding.agentId,
                    nodeId: binding.nodeId,
                    nodeHost: node?.host,
                    nodeName: node?.name,
                };
            }),
        );
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
 * Bulk-sync nodes from OpenClaw runtime (gateway + paired nodes).
 */
export const syncRuntimeNodes = mutation({
    args: {
        nodes: v.array(
            v.object({
                nodeId: v.string(),
                name: v.string(),
                host: v.string(),
                online: v.boolean(),
                capabilities: v.optional(v.array(v.string())),
                platform: v.optional(v.string()),
                lastSeenAt: v.optional(v.number()),
                tenantId: v.optional(v.string()),
            })
        ),
    },
    returns: v.object({ upserted: v.number() }),
    handler: async (ctx, args) => {
        const now = Date.now();
        let upserted = 0;
        for (const node of args.nodes) {
            const existing = await ctx.db
                .query("nodes")
                .withIndex("by_nodeId", (q) => q.eq("nodeId", node.nodeId))
                .first();
            const payload = {
                ...node,
                lastSeenAt: node.lastSeenAt ?? now,
                createdAt: existing?.createdAt ?? now,
                updatedAt: now,
            };
            if (existing) {
                await ctx.db.patch(existing._id, payload);
            } else {
                await ctx.db.insert("nodes", payload);
            }
            upserted++;
        }
        return { upserted };
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
