import { query } from "./_generated/server";

const DEDICATED_AGENT_TYPES = new Set(["dedicated", "specialized"]);

export const checkSystemHealth = query({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("userProfiles").collect();
    const agents = await ctx.db.query("agents").collect();
    const agentWorkspaces = await ctx.db
      .query("workspaceTrees")
      .withIndex("by_type", (q) => q.eq("type", "agent"))
      .collect();

    const agentsByOwner = new Map<string, (typeof agents)[number][]>();
    for (const agent of agents) {
      if (!agent.owner) {
        continue;
      }
      const ownerAgents = agentsByOwner.get(agent.owner) ?? [];
      ownerAgents.push(agent);
      agentsByOwner.set(agent.owner, ownerAgents);
    }

    const agentIdsWithWorkspace = new Set(
      agentWorkspaces
        .map((workspace) => workspace.agentId)
        .filter((agentId): agentId is string => Boolean(agentId))
    );

    const anomalousUserIds = new Map<string, string>();
    let totalUsersWithoutDedicatedAgent = 0;

    for (const user of users) {
      const ownedAgents = agentsByOwner.get(user._id) ?? [];
      const hasDedicatedAgent = ownedAgents.some((agent) =>
        DEDICATED_AGENT_TYPES.has(agent.type)
      );

      if (!hasDedicatedAgent) {
        totalUsersWithoutDedicatedAgent += 1;
        anomalousUserIds.set(user._id, user._id);
      }
    }

    let totalAgentsWithoutWorkspace = 0;
    for (const agent of agents) {
      if (agentIdsWithWorkspace.has(agent.agentId)) {
        continue;
      }

      totalAgentsWithoutWorkspace += 1;
      if (agent.owner) {
        anomalousUserIds.set(agent.owner, agent.owner);
      }
    }

    return {
      totalUsers: users.length,
      totalUsersWithoutDedicatedAgent,
      totalAgentsWithoutWorkspace,
      anomalousUserIds: Array.from(anomalousUserIds.values()),
    };
  },
});
