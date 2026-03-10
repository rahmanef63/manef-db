import { query, mutation, action } from "../../_generated/server";
import { v } from "convex/values";
import { api } from "../../_generated/api";

/**
 * Returns a list of agents for a specific tenant/user.
 */
export const getAgents = query({
    args: {},
    returns: v.array(
        v.object({
            _id: v.id("agents"),
            name: v.string(),
            description: v.optional(v.string()),
            role: v.string(),
            status: v.string(),
        })
    ),
    handler: async (ctx) => {
        const agents = await ctx.db.query("agents").order("desc").take(50);
        return agents.map((a) => ({
            _id: a._id,
            name: a.name,
            description: a.agentsMd,
            role: a.type,
            status: a.status || "active",
        }));
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
