import { mutation } from "./_generated/server";

const NOW = () => Date.now();
const OWNER_EMAIL = "rahmanef63@gmail.com";
const OWNER_PHONE = "+6285856697754";
const OWNER_NAME = "Rahman";
const INSTANCE_ID = "srv614914";
const INSTANCE_IP = "76.13.23.37";
const TENANT_ID = "main";

const OPENCLAW_AGENTS = [
  { agentId: "main", name: "Manef", type: "main", status: "active", isActive: "true" },
  { agentId: "ina", name: "Ka Ina Agent", type: "assistant", status: "inactive", isActive: "false" },
  { agentId: "irul", name: "Ka Irul Agent", type: "assistant", status: "inactive", isActive: "false" },
  { agentId: "irul-bisnis", name: "Irul Bisnis Agent", type: "assistant", status: "inactive", isActive: "false" },
  { agentId: "irul-kuliah", name: "Irul Kuliah Agent", type: "assistant", status: "inactive", isActive: "false" },
  { agentId: "official-zianinn", name: "Official Zianinn", type: "assistant", status: "inactive", isActive: "false" },
  { agentId: "rysha", name: "Rysha Agent", type: "assistant", status: "inactive", isActive: "false" },
  { agentId: "si-coder", name: "si-coder", type: "specialist", status: "inactive", isActive: "false" },
  { agentId: "si-db", name: "si-db", type: "specialist", status: "inactive", isActive: "false" },
  { agentId: "si-it", name: "si-it", type: "specialist", status: "inactive", isActive: "false" },
  { agentId: "si-nml", name: "Si NML", type: "specialist", status: "inactive", isActive: "false" },
  { agentId: "si-pinter", name: "si-pinter", type: "specialist", status: "inactive", isActive: "false" },
  { agentId: "si-pm", name: "si-pm", type: "specialist", status: "inactive", isActive: "false" },
  { agentId: "user-005203", name: "user-005203", type: "user-agent", status: "inactive", isActive: "false" },
  { agentId: "zahra", name: "Zahra Agent", type: "assistant", status: "inactive", isActive: "false" },
] as const;

const OPENCLAW_SKILLS = [
  ["coding-agent", "Coding Agent", "Delegate coding tasks to coding agents", "bundled"],
  ["healthcheck", "Healthcheck", "Host security and hardening checks", "bundled"],
  ["project-template", "Project Template", "Project scaffolding and templates", "bundled"],
  ["convex-crud", "Convex CRUD", "CRUD operations against Convex", "managed"],
  ["weather", "Weather", "Current weather and forecasts", "bundled"],
  ["system-check", "System Check", "Check Convex, Dokploy, and containers", "managed"],
  ["google-drive", "Google Drive", "Access Rahman's Google Drive via rclone", "managed"],
] as const;

const OPENCLAW_CHANNELS = [
  {
    channelId: "telegram:default",
    type: "telegram",
    label: "default (manef ai)",
    configured: true,
    running: true,
    linked: true,
    connected: true,
    mode: "bot",
    config: { account: "default", notes: "token config; allow:*" },
  },
  {
    channelId: "whatsapp:default:+6285706461111",
    type: "whatsapp",
    label: "default (manefAi)",
    configured: true,
    running: true,
    linked: true,
    connected: true,
    mode: "pairing",
    config: {
      account: "default",
      phone: "+6285706461111",
      allow: ["+6285856697754", "+6285825516154", "+6281342261553"],
    },
  },
] as const;

const OPENCLAW_SESSIONS = [
  {
    agentId: "main",
    sessionKey: "agent:main:main",
    openclawSessionId: "1df5d760-1ca4-44d2-83ac-9ed6e611c522",
    channel: "webchat",
    lastActiveAt: 1773102138667,
    metadata: { source: "openclaw", surface: "webchat" },
  },
  {
    agentId: "main",
    sessionKey: "agent:main:telegram:slash:7730229886",
    openclawSessionId: "add41317-bd5f-4a8d-94b3-1660b554f15d",
    channel: "telegram",
    lastActiveAt: 1772037683946,
    metadata: { source: "openclaw", surface: "telegram", chatType: "slash" },
  },
  {
    agentId: "main",
    sessionKey: "agent:main:telegram:slash:1087968824",
    openclawSessionId: "9d126a0c-e93f-479a-9dbf-5080f7bc5539",
    channel: "telegram",
    lastActiveAt: 1772462007753,
    metadata: { source: "openclaw", surface: "telegram", chatType: "slash" },
  },
  {
    agentId: "main",
    sessionKey: "agent:main:telegram:group:-1003889990005",
    openclawSessionId: "18a5e4f2-f8e3-43e7-b112-45b619dd4c38",
    channel: "telegram",
    lastActiveAt: 1772524046329,
    metadata: { source: "openclaw", surface: "telegram", chatType: "group" },
  },
  {
    agentId: "main",
    sessionKey: "agent:main:whatsapp:group:120363406023005203@g.us",
    openclawSessionId: "9e3aa2e4-c2d2-49d3-9f6f-db49e53c74f5",
    channel: "whatsapp",
    lastActiveAt: 1772474160559,
    metadata: { source: "openclaw", surface: "whatsapp", chatType: "group" },
  },
  {
    agentId: "main",
    sessionKey: "agent:main:tui-48e729bf-1c7a-433a-8e13-4437d0f71cfa",
    openclawSessionId: "7cac6bf0-7e45-4cf2-9c3f-427ed15d6e22",
    channel: "webchat",
    lastActiveAt: 1773075958617,
    metadata: { source: "openclaw", surface: "webchat", chatType: "tui" },
  },
  {
    agentId: "main",
    sessionKey: "agent:main:tui-4212a2d2-fa6d-40a2-aa5e-02dce402481e",
    openclawSessionId: "97fd5969-06d8-4714-89ec-ae6a0dd2a46c",
    channel: "webchat",
    lastActiveAt: 1773078302600,
    metadata: { source: "openclaw", surface: "webchat", chatType: "tui" },
  },
  {
    agentId: "main",
    sessionKey: "agent:main:cron:fd2b771e-24db-4774-a1a4-46f7933abc51",
    openclawSessionId: "818181c9-57e6-4b1b-a817-196de9125e32",
    channel: "cron",
    lastActiveAt: 1773071136443,
    metadata: { source: "openclaw", surface: "cron", chatType: "cron" },
  },
  {
    agentId: "main",
    sessionKey: "agent:main:cron:fd2b771e-24db-4774-a1a4-46f7933abc51:run:818181c9-57e6-4b1b-a817-196de9125e32",
    openclawSessionId: "818181c9-57e6-4b1b-a817-196de9125e32",
    channel: "cron",
    lastActiveAt: 1773071136443,
    metadata: { source: "openclaw", surface: "cron", chatType: "cron-run" },
  },
  {
    agentId: "rysha",
    sessionKey: "agent:rysha:main",
    openclawSessionId: "5e50f1a1-2fce-488f-b9c6-8f6efe178cd1",
    channel: "unknown",
    lastActiveAt: 1772395006241,
    metadata: { source: "openclaw", surface: "unknown" },
  },
] as const;

export const populateDatabase = mutation({
  args: {},
  handler: async (ctx) => {
    const now = NOW();

    const adminRole = await ensureAdminRole(ctx);
    const workspaceId = await ensureWorkspace(ctx, now);
    const entUserId = await ensureEntUser(ctx, now);
    await ensureEntMember(ctx, entUserId, workspaceId, adminRole._id, now);

    const profileId = await ensureUserProfile(ctx, now);
    await ensureAuthUser(ctx, now);
    await ensureUserIdentity(ctx, profileId, now);
    await ensureInstance(ctx, now);
    await ensureChannels(ctx, now);
    await ensureSkills(ctx, now);
    await ensureAgents(ctx, profileId, now);
    await ensureOpenClawSessions(ctx, profileId, now);

    return {
      ok: true,
      ownerEmail: OWNER_EMAIL,
      tenantId: TENANT_ID,
      workspaceSlug: "main",
      instanceId: INSTANCE_ID,
      seededAgents: OPENCLAW_AGENTS.length,
      seededChannels: OPENCLAW_CHANNELS.length,
      seededSkills: OPENCLAW_SKILLS.length,
    };
  },
});

async function ensureAdminRole(ctx: any) {
  let role = await ctx.db.query("roles").withIndex("name", (q: any) => q.eq("name", "Admin")).first();
  if (!role) {
    const roleId = await ctx.db.insert("roles", { name: "Admin", isDefault: false });
    role = await ctx.db.get(roleId);
  }
  return role;
}

async function ensureWorkspace(ctx: any, now: number) {
  const existing = await ctx.db.query("workspaces").withIndex("slug", (q: any) => q.eq("slug", "main")).first();
  if (existing) return existing._id;
  return await ctx.db.insert("workspaces", {
    slug: "main",
    name: "Main Workspace",
    isPersonal: false,
  });
}

async function ensureEntUser(ctx: any, now: number) {
  const tokenIdentifier = `session:${OWNER_EMAIL}`;
  const existing = await ctx.db.query("users").withIndex("email", (q: any) => q.eq("email", OWNER_EMAIL)).first();
  if (existing) {
    await ctx.db.patch(existing._id, {
      fullName: OWNER_NAME,
      firstName: OWNER_NAME,
      email: OWNER_EMAIL,
      tokenIdentifier,
    });
    return existing._id;
  }
  return await ctx.db.insert("users", {
    email: OWNER_EMAIL,
    fullName: OWNER_NAME,
    firstName: OWNER_NAME,
    tokenIdentifier,
  });
}

async function ensureEntMember(ctx: any, userId: any, workspaceId: any, roleId: any, now: number) {
  const existing = await ctx.db
    .query("members")
    .withIndex("workspaceUser", (q: any) => q.eq("workspaceId", workspaceId).eq("userId", userId))
    .first();
  if (existing) return existing._id;
  return await ctx.db.insert("members", {
    userId,
    workspaceId,
    roleId,
    searchable: `${OWNER_NAME} ${OWNER_EMAIL}`.toLowerCase(),
  });
}

async function ensureUserProfile(ctx: any, now: number) {
  const existing = await ctx.db
    .query("userProfiles")
    .withIndex("by_email", (q: any) => q.eq("email", OWNER_EMAIL))
    .first();
  if (existing) {
    await ctx.db.patch(existing._id, {
      email: OWNER_EMAIL,
      name: OWNER_NAME,
      phone: OWNER_PHONE,
      timezone: "Asia/Makassar",
      tenantId: TENANT_ID,
      updatedAt: now,
    });
    return existing._id;
  }
  return await ctx.db.insert("userProfiles", {
    createdAt: now,
    email: OWNER_EMAIL,
    labels: ["owner", "admin", "openclaw"],
    name: OWNER_NAME,
    nickname: "rahman",
    phone: OWNER_PHONE,
    tenantId: TENANT_ID,
    timezone: "Asia/Makassar",
    updatedAt: now,
  });
}

async function ensureAuthUser(ctx: any, now: number) {
  const existing = await ctx.db
    .query("authUsers")
    .withIndex("by_email", (q: any) => q.eq("email", OWNER_EMAIL))
    .first();
  if (existing) {
    await ctx.db.patch(existing._id, {
      name: OWNER_NAME,
      roles: ["admin"],
      status: "active",
      updatedAt: now,
    });
    return existing._id;
  }
  return await ctx.db.insert("authUsers", {
    createdAt: now,
    email: OWNER_EMAIL,
    name: OWNER_NAME,
    roles: ["admin"],
    sessionVersion: 1,
    status: "active",
    updatedAt: now,
  });
}

async function ensureUserIdentity(ctx: any, profileId: any, now: number) {
  const existing = await ctx.db
    .query("userIdentities")
    .withIndex("by_channel_external", (q: any) => q.eq("channel", "whatsapp").eq("externalUserId", OWNER_PHONE))
    .first();
  if (existing) return existing._id;
  return await ctx.db.insert("userIdentities", {
    channel: "whatsapp",
    createdAt: now,
    externalUserId: OWNER_PHONE,
    metadata: { source: "openclaw-status", role: "owner" },
    updatedAt: now,
    userId: profileId,
    verified: true,
  });
}

async function ensureInstance(ctx: any, now: number) {
  const existing = await ctx.db
    .query("instances")
    .withIndex("by_instanceId", (q: any) => q.eq("instanceId", INSTANCE_ID))
    .first();
  const payload = {
    instanceId: INSTANCE_ID,
    name: INSTANCE_ID,
    info: `OpenClaw gateway on ${INSTANCE_IP}`,
    tags: ["openclaw", "gateway", "production"],
    platform: "linux",
    arch: "x64",
    version: "2026.3.7",
    role: "gateway",
    scopes: ["telegram", "whatsapp", "agents"],
    lastSeenAt: now,
    reason: "seeded from openclaw status",
    tenantId: TENANT_ID,
  };
  if (existing) {
    await ctx.db.patch(existing._id, payload);
    return existing._id;
  }
  return await ctx.db.insert("instances", { ...payload, createdAt: now });
}

async function ensureChannels(ctx: any, now: number) {
  for (const channel of OPENCLAW_CHANNELS) {
    const existing = await ctx.db
      .query("channels")
      .withIndex("by_channelId", (q: any) => q.eq("channelId", channel.channelId))
      .first();
    const payload = {
      ...channel,
      tenantId: TENANT_ID,
      updatedAt: now,
      lastConnectAt: now,
      lastProbeAt: now,
    };
    if (existing) {
      await ctx.db.patch(existing._id, payload);
    } else {
      await ctx.db.insert("channels", { ...payload, createdAt: now });
    }
  }
}

async function ensureSkills(ctx: any, now: number) {
  for (const [skillId, name, description, source] of OPENCLAW_SKILLS) {
    const existing = await ctx.db
      .query("skills")
      .withIndex("by_skillId", (q: any) => q.eq("skillId", skillId))
      .first();
    const payload = {
      skillId,
      name,
      description,
      source,
      enabled: true,
      tenantId: TENANT_ID,
      toolCount: 0,
      updatedAt: now,
    };
    if (existing) {
      await ctx.db.patch(existing._id, payload);
    } else {
      await ctx.db.insert("skills", { ...payload, createdAt: now });
    }
  }
}

async function ensureAgents(ctx: any, ownerId: any, now: number) {
  for (const agent of OPENCLAW_AGENTS) {
    const existing = await ctx.db
      .query("agents")
      .withIndex("by_agentId", (q: any) => q.eq("agentId", agent.agentId))
      .first();
    const payload = {
      agentId: agent.agentId,
      name: agent.name,
      type: agent.type,
      owner: ownerId,
      status: agent.status,
      isActive: agent.isActive,
      tenantId: TENANT_ID,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      lastActiveAt: agent.agentId === "main" ? now : existing?.lastActiveAt,
      config: {
        source: "openclaw-status",
        instanceId: INSTANCE_ID,
      },
    };
    if (existing) {
      await ctx.db.patch(existing._id, payload);
    } else {
      await ctx.db.insert("agents", payload);
    }
  }
}

async function ensureOpenClawSessions(ctx: any, ownerId: any, now: number) {
  for (const sourceSession of OPENCLAW_SESSIONS) {
    let session = await ctx.db
      .query("sessions")
      .withIndex("by_sessionKey", (q: any) => q.eq("sessionKey", sourceSession.sessionKey))
      .first();

    const sessionPayload = {
      agentId: sourceSession.agentId,
      channel: sourceSession.channel,
      lastActiveAt: sourceSession.lastActiveAt,
      messageCount: session?.messageCount ?? 0,
      metadata: {
        ...(session?.metadata ?? {}),
        ...sourceSession.metadata,
        openclawSessionId: sourceSession.openclawSessionId,
        instanceId: INSTANCE_ID,
      },
      sessionKey: sourceSession.sessionKey,
      status: session?.status ?? "active",
      tenantId: TENANT_ID,
      userId: ownerId,
    };

    if (!session) {
      const sessionId = await ctx.db.insert("sessions", {
        ...sessionPayload,
        createdAt: sourceSession.lastActiveAt,
      });
      session = await ctx.db.get(sessionId);
    } else {
      await ctx.db.patch(session._id, sessionPayload);
      session = await ctx.db.get(session._id);
    }

    const existingAgentSession = await ctx.db
      .query("agentSessions")
      .withIndex("by_sessionId", (q: any) => q.eq("sessionId", sourceSession.sessionKey))
      .first();

    const agentSessionPayload = {
      agentId: sourceSession.agentId,
      channel: sourceSession.channel,
      convexSessionId: session._id,
      messageCount: existingAgentSession?.messageCount ?? 0,
      metadata: {
        ...(existingAgentSession?.metadata ?? {}),
        ...sourceSession.metadata,
        openclawSessionId: sourceSession.openclawSessionId,
        externalSessionKey: sourceSession.sessionKey,
      },
      sessionId: sourceSession.sessionKey,
      startedAt: existingAgentSession?.startedAt ?? sourceSession.lastActiveAt,
      status: existingAgentSession?.status ?? "active",
      userId: ownerId,
    };

    if (!existingAgentSession) {
      await ctx.db.insert("agentSessions", agentSessionPayload);
    } else {
      await ctx.db.patch(existingAgentSession._id, agentSessionPayload);
    }
  }
}
