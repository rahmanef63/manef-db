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

function buildUserRootPath(userId: string) {
  return `/users/${userId}`;
}

function buildUserWorkspaceName(name: string | undefined | null, email: string | undefined | null, userId: string) {
  const base =
    name?.trim() ||
    email?.split("@")[0]?.trim() ||
    `user-${userId.slice(0, 6)}`;
  return `${base}'s Workspace`;
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
        source: "migration",
        status: "active",
        type: "agent",
        updatedAt: now,
      });
      await ctx.db.insert("workspaceAgents", {
        agentId,
        createdAt: now,
        inheritToChildren: true,
        isPrimary: true,
        relation: "primary",
        source: "migration",
        updatedAt: now,
        workspaceId: agentWorkspaceId,
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

export const backfillWorkspaceScopesForUsers = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const users = await ctx.db.query("userProfiles").collect();
    const agents = await ctx.db.query("agents").collect();
    const workspaceTrees = await ctx.db.query("workspaceTrees").collect();
    const workspaceAgents = await ctx.db.query("workspaceAgents").collect();

    const rootByOwner = new Map<string, (typeof workspaceTrees)[number]>();
    for (const tree of workspaceTrees) {
      if (tree.type === "user" && tree.ownerId) {
        rootByOwner.set(tree.ownerId, tree);
      }
    }

    const workspaceByAgentId = new Map<string, (typeof workspaceTrees)[number]>();
    for (const tree of workspaceTrees) {
      if (tree.agentId) {
        workspaceByAgentId.set(tree.agentId, tree);
      }
    }

    const linkKeys = new Set(
      workspaceAgents.map((link) => `${link.workspaceId}:${link.agentId}`),
    );

    const agentsByOwner = new Map<string, Array<(typeof agents)[number]>>();
    for (const agent of agents) {
      if (!agent.owner) {
        continue;
      }
      const next = agentsByOwner.get(agent.owner) ?? [];
      next.push(agent);
      agentsByOwner.set(agent.owner, next);
    }

    const createdRootWorkspaceIds: string[] = [];
    const patchedWorkspaceIds: string[] = [];
    const linkedWorkspaceAgentIds: string[] = [];

    for (const user of users) {
      let userRoot = rootByOwner.get(user._id) ?? null;
      if (!userRoot) {
        const workspaceId = await ctx.db.insert("workspaceTrees", {
          createdAt: now,
          description: "Backfilled root workspace scope for existing user.",
          fileCount: 0,
          name: buildUserWorkspaceName(user.name, user.email, user._id),
          ownerId: user._id,
          rootPath: buildUserRootPath(user._id),
          source: "backfill",
          status: "active",
          type: "user",
          updatedAt: now,
        });
        const created = await ctx.db.get(workspaceId);
        if (created) {
          userRoot = created;
          rootByOwner.set(user._id, created);
          createdRootWorkspaceIds.push(workspaceId);
        }
      }

      if (!userRoot) {
        continue;
      }

      const ownedAgents = agentsByOwner.get(user._id) ?? [];
      for (const agent of ownedAgents) {
        let agentWorkspace = workspaceByAgentId.get(agent.agentId) ?? null;
        if (agentWorkspace) {
          const patch: Record<string, unknown> = {};
          if (!agentWorkspace.ownerId) {
            patch.ownerId = user._id;
          }
          if (!agentWorkspace.parentId) {
            patch.parentId = userRoot._id;
          }
          if (!agentWorkspace.source) {
            patch.source = "backfill";
          }
          if (Object.keys(patch).length > 0) {
            patch.updatedAt = now;
            await ctx.db.patch(agentWorkspace._id, patch);
            const refreshed = await ctx.db.get(agentWorkspace._id);
            if (refreshed) {
              agentWorkspace = refreshed;
              workspaceByAgentId.set(agent.agentId, refreshed);
            }
            patchedWorkspaceIds.push(agentWorkspace._id);
          }
        }

        if (!agentWorkspace) {
          const workspaceId = await ctx.db.insert("workspaceTrees", {
            agentId: agent.agentId,
            createdAt: now,
            description: "Backfilled agent workspace scope.",
            fileCount: 0,
            name: agent.name,
            ownerId: user._id,
            parentId: userRoot._id,
            rootPath: buildAgentRootPath(userRoot.rootPath, agent.agentId),
            runtimePath: agent.config?.runtimeWorkspacePath,
            source: "backfill",
            status: agent.status ?? "active",
            type: "agent",
            updatedAt: now,
          });
          const created = await ctx.db.get(workspaceId);
          if (created) {
            agentWorkspace = created;
            workspaceByAgentId.set(agent.agentId, created);
            patchedWorkspaceIds.push(workspaceId);
          }
        }

        if (!agentWorkspace) {
          continue;
        }

        const linkKey = `${agentWorkspace._id}:${agent.agentId}`;
        if (!linkKeys.has(linkKey)) {
          await ctx.db.insert("workspaceAgents", {
            agentId: agent.agentId,
            createdAt: now,
            inheritToChildren: true,
            isPrimary: true,
            relation: "primary",
            source: "backfill",
            tenantId: agent.tenantId,
            updatedAt: now,
            workspaceId: agentWorkspace._id,
          });
          linkKeys.add(linkKey);
          linkedWorkspaceAgentIds.push(linkKey);
        }
      }
    }

    return {
      createdRootWorkspaceIds,
      linkedWorkspaceAgentIds,
      patchedWorkspaceIds,
      totalUsers: users.length,
    };
  },
});
