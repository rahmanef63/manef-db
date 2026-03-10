import { internalMutation } from "./_generated/server";

function buildAgentKey(prefix: string) {
  const randomPart = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now()}_${randomPart}`;
}

function buildAgentRootPath(userRootPath: string, agentId: string) {
  return `${userRootPath.replace(/\/$/, "")}/agents/${agentId}`;
}

function buildDedicatedAgentName(workspaceName: string) {
  return `${workspaceName} Dedicated Agent`;
}

export const fixUsersWithoutAgents = internalMutation({
  args: {},
  handler: async (ctx) => {
    const userWorkspaces = await ctx.db
      .query("workspaceTrees")
      .withIndex("by_type", (q) => q.eq("type", "user"))
      .collect();

    const processedOwners = new Set<string>();
    const createdAgentIds: string[] = [];
    const createdWorkspaceIds = [];
    const skippedWorkspaceIds = [];

    for (const workspace of userWorkspaces) {
      if (!workspace.ownerId) {
        skippedWorkspaceIds.push(workspace._id);
        continue;
      }

      const ownerKey = workspace.ownerId;
      if (processedOwners.has(ownerKey)) {
        continue;
      }
      processedOwners.add(ownerKey);

      const existingAgent = await ctx.db
        .query("agents")
        .withIndex("by_owner", (q) => q.eq("owner", workspace.ownerId))
        .first();

      if (existingAgent) {
        continue;
      }

      const now = Date.now();
      const agentId = buildAgentKey("dedicated");
      const agentName = buildDedicatedAgentName(workspace.name);

      await ctx.db.insert("agents", {
        agentId,
        agentsMd: "Default dedicated agent created by migration.",
        createdAt: now,
        isActive: "true",
        name: agentName,
        owner: workspace.ownerId,
        status: "active",
        type: "dedicated",
        updatedAt: now,
      });

      const agentWorkspaceId = await ctx.db.insert("workspaceTrees", {
        agentId,
        createdAt: now,
        description: "Workspace for the default dedicated agent.",
        fileCount: 0,
        name: agentName,
        ownerId: workspace.ownerId,
        parentId: workspace._id,
        rootPath: buildAgentRootPath(workspace.rootPath, agentId),
        status: "active",
        type: "agent",
        updatedAt: now,
      });

      createdAgentIds.push(agentId);
      createdWorkspaceIds.push(agentWorkspaceId);
    }

    return {
      scannedUserWorkspaces: userWorkspaces.length,
      fixedUsers: createdAgentIds.length,
      createdAgentIds,
      createdWorkspaceIds,
      skippedWorkspaceIds,
    };
  },
});
