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
    const workspaceAgentLinks = await ctx.db.query("workspaceAgents").collect();

    const agentsByOwner = new Map<string, (typeof agents)[number][]>();
    for (const agent of agents) {
      if (!agent.owner) {
        continue;
      }
      const ownerAgents = agentsByOwner.get(agent.owner) ?? [];
      ownerAgents.push(agent);
      agentsByOwner.set(agent.owner, ownerAgents);
    }

    const agentIdsWithWorkspace = new Set([
      ...workspaceAgentLinks.map((link) => link.agentId),
      agentWorkspaces
        .map((workspace) => workspace.agentId)
        .filter((agentId): agentId is string => Boolean(agentId))
    ]);

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

export const listWorkspaceCoverage = query({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("userProfiles").collect();
    const agents = await ctx.db.query("agents").collect();
    const workspaceTrees = await ctx.db.query("workspaceTrees").collect();
    const workspaceAgents = await ctx.db.query("workspaceAgents").collect();

    const rootsByOwner = new Map<string, Array<(typeof workspaceTrees)[number]>>();
    const workspacesByOwner = new Map<string, Array<(typeof workspaceTrees)[number]>>();
    for (const tree of workspaceTrees) {
      if (!tree.ownerId) {
        continue;
      }
      const next = workspacesByOwner.get(tree.ownerId) ?? [];
      next.push(tree);
      workspacesByOwner.set(tree.ownerId, next);
      if (tree.type === "user") {
        const roots = rootsByOwner.get(tree.ownerId) ?? [];
        roots.push(tree);
        rootsByOwner.set(tree.ownerId, roots);
      }
    }

    const ownedAgentsByOwner = new Map<string, Array<(typeof agents)[number]>>();
    for (const agent of agents) {
      if (!agent.owner) {
        continue;
      }
      const next = ownedAgentsByOwner.get(agent.owner) ?? [];
      next.push(agent);
      ownedAgentsByOwner.set(agent.owner, next);
    }

    const linksByWorkspace = new Map<string, Array<(typeof workspaceAgents)[number]>>();
    for (const link of workspaceAgents) {
      const next = linksByWorkspace.get(link.workspaceId) ?? [];
      next.push(link);
      linksByWorkspace.set(link.workspaceId, next);
    }

    return users
      .map((user) => {
        const roots = rootsByOwner.get(user._id) ?? [];
        const workspaces = workspacesByOwner.get(user._id) ?? [];
        const ownedAgents = ownedAgentsByOwner.get(user._id) ?? [];
        const linkedAgentIds = Array.from(
          new Set(
            workspaces.flatMap((workspace) =>
              (linksByWorkspace.get(workspace._id) ?? []).map((link) => link.agentId),
            ),
          ),
        );
        return {
          userId: user._id,
          email: user.email,
          name: user.name,
          rootWorkspaceCount: roots.length,
          workspaceCount: workspaces.length,
          ownedAgentCount: ownedAgents.length,
          linkedAgentCount: linkedAgentIds.length,
          rootWorkspaceNames: roots.map((workspace) => workspace.name),
        };
      })
      .sort((left, right) =>
        (left.name ?? left.email ?? left.userId).localeCompare(
          right.name ?? right.email ?? right.userId,
        ),
      );
  },
});

export const listRuntimeWorkspaceHierarchy = query({
  args: {},
  handler: async (ctx) => {
    const trees = (
      await ctx.db
        .query("workspaceTrees")
        .withIndex("by_type", (q) => q.eq("type", "agent"))
        .collect()
    )
      .filter((tree) => tree.source === "openclaw-runtime")
      .sort((left, right) => left.name.localeCompare(right.name));

    const treesById = new Map(trees.map((tree) => [tree._id, tree]));
    return trees.map((tree) => ({
      _id: tree._id,
      name: tree.name,
      agentId: tree.agentId ?? null,
      rootPath: tree.rootPath,
      runtimePath: tree.runtimePath ?? null,
      parentId: tree.parentId ?? null,
      parentAgentId: tree.parentId ? treesById.get(tree.parentId)?.agentId ?? null : null,
      parentName: tree.parentId ? treesById.get(tree.parentId)?.name ?? null : null,
      source: tree.source ?? null,
      type: tree.type,
    }));
  },
});
