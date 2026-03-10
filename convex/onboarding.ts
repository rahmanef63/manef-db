import { mutation } from "./_generated/server";

const DEDICATED_AGENT_TYPES = new Set(["dedicated", "specialized"]);

function buildAgentKey(prefix: string) {
  const randomPart = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now()}_${randomPart}`;
}

function emailLocalPart(email: string) {
  return email.split("@")[0] || "user";
}

function buildDisplayName(name: string | null | undefined, email: string) {
  return name?.trim() || emailLocalPart(email);
}

function buildUserWorkspaceName(displayName: string) {
  return `${displayName}'s Workspace`;
}

function buildDedicatedAgentName(displayName: string) {
  return `${displayName} Dedicated Agent`;
}

function buildUserRootPath(userId: string) {
  return `/users/${userId}`;
}

function buildAgentRootPath(userRootPath: string, agentId: string) {
  return `${userRootPath.replace(/\/$/, "")}/agents/${agentId}`;
}

export const initializeNewUser = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication is required to initialize a user.");
    }

    const email = identity.email?.trim().toLowerCase();
    if (!email) {
      throw new Error("Authenticated user is missing an email address.");
    }

    const now = Date.now();
    const displayName = buildDisplayName(
      identity.name ?? identity.nickname,
      email
    );

    let createdUser = false;
    let user = await ctx.db
      .query("userProfiles")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();

    if (!user) {
      const userId = await ctx.db.insert("userProfiles", {
        createdAt: now,
        email,
        name: displayName,
        nickname: identity.nickname ?? emailLocalPart(email),
        updatedAt: now,
      });
      user = await ctx.db.get(userId);
      createdUser = true;
    } else {
      const patch: Record<string, string | number> = {};
      if (!user.name) {
        patch.name = displayName;
      }
      if (!user.nickname && identity.nickname) {
        patch.nickname = identity.nickname;
      }
      if (Object.keys(patch).length > 0) {
        patch.updatedAt = now;
        await ctx.db.patch(user._id, patch);
        user = (await ctx.db.get(user._id)) ?? user;
      }
    }

    if (!user) {
      throw new Error("Failed to load or create the user profile.");
    }

    const ownerWorkspaces = await ctx.db
      .query("workspaceTrees")
      .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
      .collect();

    let createdUserWorkspace = false;
    let userWorkspace =
      ownerWorkspaces.find((workspace) => workspace.type === "user") ?? null;

    if (!userWorkspace) {
      const userWorkspaceId = await ctx.db.insert("workspaceTrees", {
        createdAt: now,
        description: "Primary workspace for the user.",
        fileCount: 0,
        name: buildUserWorkspaceName(displayName),
        ownerId: user._id,
        rootPath: buildUserRootPath(user._id),
        status: "active",
        type: "user",
        updatedAt: now,
      });
      userWorkspace = await ctx.db.get(userWorkspaceId);
      createdUserWorkspace = true;
    }

    if (!userWorkspace) {
      throw new Error("Failed to load or create the user workspace.");
    }

    const ownedAgents = await ctx.db
      .query("agents")
      .withIndex("by_owner", (q) => q.eq("owner", user._id))
      .collect();

    let createdDedicatedAgent = false;
    let dedicatedAgent =
      ownedAgents.find((agent) => DEDICATED_AGENT_TYPES.has(agent.type)) ?? null;

    if (!dedicatedAgent) {
      const agentId = buildAgentKey("dedicated");
      const dedicatedAgentDocId = await ctx.db.insert("agents", {
        agentId,
        agentsMd: "Default dedicated agent created during onboarding.",
        createdAt: now,
        isActive: "true",
        name: buildDedicatedAgentName(displayName),
        owner: user._id,
        status: "active",
        type: "dedicated",
        updatedAt: now,
      });
      dedicatedAgent = await ctx.db.get(dedicatedAgentDocId);
      createdDedicatedAgent = true;
    }

    if (!dedicatedAgent) {
      throw new Error("Failed to load or create the dedicated agent.");
    }

    let createdAgentWorkspace = false;
    let agentWorkspace = await ctx.db
      .query("workspaceTrees")
      .withIndex("by_agent", (q) => q.eq("agentId", dedicatedAgent.agentId))
      .first();

    if (!agentWorkspace) {
      const agentWorkspaceId = await ctx.db.insert("workspaceTrees", {
        agentId: dedicatedAgent.agentId,
        createdAt: now,
        description: "Workspace for the user's dedicated agent.",
        fileCount: 0,
        name: dedicatedAgent.name,
        ownerId: user._id,
        parentId: userWorkspace._id,
        rootPath: buildAgentRootPath(userWorkspace.rootPath, dedicatedAgent.agentId),
        status: "active",
        type: "agent",
        updatedAt: now,
      });
      agentWorkspace = await ctx.db.get(agentWorkspaceId);
      createdAgentWorkspace = true;
    }

    return {
      userId: user._id,
      userWorkspaceId: userWorkspace._id,
      dedicatedAgentDocId: dedicatedAgent._id,
      dedicatedAgentId: dedicatedAgent.agentId,
      agentWorkspaceId: agentWorkspace?._id ?? null,
      created: {
        user: createdUser,
        userWorkspace: createdUserWorkspace,
        dedicatedAgent: createdDedicatedAgent,
        agentWorkspace: createdAgentWorkspace,
      },
    };
  },
});
