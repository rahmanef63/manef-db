import { mutation } from "./_generated/server";
import { v } from "convex/values";

function buildAgentKey(prefix: string) {
  const randomPart = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now()}_${randomPart}`;
}

function buildUserRootPath(userId: string) {
  return `/users/${userId}`;
}

function buildChildAgentRootPath(basePath: string, childAgentId: string) {
  return `${basePath.replace(/\/$/, "")}/subagents/${childAgentId}`;
}

export const createSubAgent = mutation({
  args: {
    userId: v.id("userProfiles"),
    parentAgentId: v.string(),
    newAgentName: v.string(),
    newAgentRole: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("User profile not found.");
    }

    const parentAgent = await ctx.db
      .query("agents")
      .withIndex("by_agentId", (q) => q.eq("agentId", args.parentAgentId))
      .first();

    if (!parentAgent) {
      throw new Error("Parent agent not found.");
    }

    if (parentAgent.owner && parentAgent.owner !== args.userId) {
      throw new Error("Parent agent is owned by a different user.");
    }

    const now = Date.now();
    const subAgentId = buildAgentKey("subagent");
    const trimmedName = args.newAgentName.trim();
    const trimmedRole = args.newAgentRole.trim();

    const subAgentDocId = await ctx.db.insert("agents", {
      agentId: subAgentId,
      agentsMd: `Sub-agent for ${parentAgent.name}.`,
      createdAt: now,
      isActive: "true",
      name: trimmedName,
      owner: args.userId,
      status: "active",
      type: trimmedRole,
      updatedAt: now,
    });

    const delegationId = await ctx.db.insert("agentDelegations", {
      childAgentId: subAgentId,
      createdAt: now,
      parentAgentId: args.parentAgentId,
      relationType: parentAgent.owner ? "user_sub_agent" : "general_sub_agent",
      status: "active",
      updatedAt: now,
    });

    const parentWorkspace = await ctx.db
      .query("workspaceTrees")
      .withIndex("by_agent", (q) => q.eq("agentId", args.parentAgentId))
      .first();

    const userWorkspace = parentWorkspace
      ? null
      : (
          await ctx.db
            .query("workspaceTrees")
            .withIndex("by_owner", (q) => q.eq("ownerId", args.userId))
            .collect()
        ).find((workspace) => workspace.type === "user") ?? null;

    const basePath =
      parentWorkspace?.rootPath ??
      userWorkspace?.rootPath ??
      buildUserRootPath(args.userId);

    const agentWorkspaceId = await ctx.db.insert("workspaceTrees", {
      agentId: subAgentId,
      createdAt: now,
      description: `Workspace for sub-agent role ${trimmedRole}.`,
      fileCount: 0,
      name: trimmedName,
      ownerId: args.userId,
      parentId: parentWorkspace?._id ?? userWorkspace?._id,
      rootPath: buildChildAgentRootPath(basePath, subAgentId),
      source: "manual",
      status: "active",
      type: "agent",
      updatedAt: now,
    });
    await ctx.db.insert("workspaceAgents", {
      agentId: subAgentId,
      createdAt: now,
      inheritToChildren: true,
      isPrimary: true,
      relation: "primary",
      source: "manual",
      updatedAt: now,
      workspaceId: agentWorkspaceId,
    });

    return {
      subAgentDocId,
      subAgentId,
      delegationId,
      agentWorkspaceId,
    };
  },
});
