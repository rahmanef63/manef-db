import { query, mutation, action } from "../../_generated/server";
import { v } from "convex/values";

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
            workspacePath: v.optional(v.string()),
            agentDir: v.optional(v.string()),
            boundChannels: v.array(v.string()),
            capabilities: v.array(v.string()),
            childCount: v.number(),
            sessionCount: v.number(),
            lastActiveAt: v.optional(v.number()),
            model: v.optional(v.string()),
            owner: v.optional(v.id("userProfiles")),
            ownerName: v.optional(v.string()),
            role: v.string(),
            status: v.string(),
        })
    ),
    handler: async (ctx, args) => {
        const agents = await ctx.db.query("agents").order("desc").take(50);
        const allowedAgentIds = args.agentIds ? new Set(args.agentIds) : null;
        const filteredAgents = agents.filter((agent) => {
            if (args.ownerId && agent.owner !== args.ownerId) return false;
            if (allowedAgentIds && !allowedAgentIds.has(agent.agentId)) return false;
            return true;
        });

        const enrichedAgents = await Promise.all(
            filteredAgents.map(async (agent) => {
                const [ownerProfile, workspaceTree, childDelegations, sessions] =
                    await Promise.all([
                        agent.owner
                            ? ctx.db.get(agent.owner)
                            : Promise.resolve(null),
                        ctx.db
                            .query("workspaceTrees")
                            .withIndex("by_agent", (q) => q.eq("agentId", agent.agentId))
                            .first(),
                        ctx.db
                            .query("agentDelegations")
                            .withIndex("by_parent", (q) => q.eq("parentAgentId", agent.agentId))
                            .collect(),
                        ctx.db
                            .query("sessions")
                            .withIndex("by_agent", (q) => q.eq("agentId", agent.agentId))
                            .collect(),
                    ]);

                const config = agent.config ?? {};
                const bindings: any[] = Array.isArray(config.bindings)
                    ? config.bindings
                    : [];
                const boundChannels = bindings
                    .map((binding: any) => {
                        const channel = binding?.match?.channel;
                        return typeof channel === "string" ? channel : null;
                    })
                    .filter((value: string | null): value is string => Boolean(value));

                return {
                    _id: agent._id,
                    agentId: agent.agentId,
                    name: agent.name,
                    description: agent.agentsMd,
                    workspacePath: workspaceTree?.rootPath,
                    agentDir:
                        typeof config.agentDir === "string" ? config.agentDir : undefined,
                    boundChannels: Array.from(new Set(boundChannels)),
                    capabilities: agent.capabilities ?? [],
                    childCount: childDelegations.length,
                    sessionCount: sessions.length,
                    lastActiveAt: agent.lastActiveAt,
                    model: agent.model,
                    owner: agent.owner,
                    ownerName: ownerProfile?.name,
                    role: agent.type,
                    status: agent.status || "active",
                };
            }),
        );

        return enrichedAgents;
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
