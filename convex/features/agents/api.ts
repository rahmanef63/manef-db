import { query, mutation, action } from "../../_generated/server";
import { v } from "convex/values";
import { api } from "../../_generated/api";

/**
 * Returns a list of agents for a specific tenant/user.
 */
export const getAgents = query({
    args: {
        agentIds: v.optional(v.array(v.string())),
        ownerId: v.optional(v.id("userProfiles")),
    },
    returns: v.array(
        v.object({
            _id: v.id("agents"),
            agentId: v.string(),
            name: v.string(),
            description: v.optional(v.string()),
            owner: v.optional(v.id("userProfiles")),
            role: v.string(),
            status: v.string(),
        })
    ),
    handler: async (ctx, args) => {
        const agents = await ctx.db.query("agents").order("desc").take(50);
        const allowedAgentIds = args.agentIds ? new Set(args.agentIds) : null;
        return agents.map((a) => ({
            _id: a._id,
            agentId: a.agentId,
            name: a.name,
            description: a.agentsMd,
            owner: a.owner,
            role: a.type,
            status: a.status || "active",
        })).filter((agent) => {
            if (args.ownerId && agent.owner !== args.ownerId) return false;
            if (allowedAgentIds && !allowedAgentIds.has(agent.agentId)) return false;
            return true;
        });
    },
});

/**
 * Deploys a new agent (mock mutation).
 */
export const deployAgent = mutation({
    args: {
        name: v.string(),
        role: v.string(),
        description: v.optional(v.string())
    },
    returns: v.id("agents"),
    handler: async (ctx, args) => {
        return await ctx.db.insert("agents", {
            agentId: "agent_" + Math.floor(Math.random() * 1000000),
            name: args.name,
            type: args.role,
            agentsMd: args.description,
            status: "active",
            createdAt: Date.now(),
            updatedAt: Date.now(),
        });
    },
});

/**
 * Triggers an agent task (mock action).
 */
export const runAgentTask = action({
    args: { agentId: v.id("agents") },
    returns: v.null(),
    handler: async (ctx, args) => {
        console.log(`Instructing agent ${args.agentId} to perform latest task...`);
        return null;
    },
});
