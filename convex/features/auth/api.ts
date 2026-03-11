import { v } from "convex/values";
import { mutation, query } from "../../_generated/server";

const loginCode = v.union(
  v.literal("APPROVED"),
  v.literal("DEVICE_APPROVAL_REQUIRED"),
  v.literal("DEVICE_REVOKED"),
  v.literal("BLOCKED"),
  v.literal("INVALID_CREDENTIALS"),
  v.literal("EMAIL_DOMAIN_NOT_ALLOWED")
);

const deviceStatus = v.union(
  v.literal("approved"),
  v.literal("pending"),
  v.literal("revoked")
);

function getAdminConfig() {
  const email = (process.env.AUTH_ADMIN_EMAIL ?? "admin@example.com")
    .trim()
    .toLowerCase();
  const phone = normalizePhone(process.env.AUTH_ADMIN_PHONE ?? "");
  const password = process.env.AUTH_ADMIN_PASSWORD ?? "changeme";
  const name = process.env.AUTH_ADMIN_NAME ?? email.split("@")[0] ?? "admin";
  const roles = (process.env.AUTH_ADMIN_ROLES ?? "admin")
    .split(",")
    .map((role: string) => role.trim())
    .filter(Boolean);
  return { email, name, password, phone, roles };
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function normalizePhone(phone: string) {
  const trimmed = phone.trim();
  if (!trimmed) {
    return "";
  }
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/[^\d]/g, "");
  if (!digits) {
    return "";
  }
  return `${hasPlus ? "+" : ""}${digits}`;
}

function parseIdentifier(identifier: string) {
  const normalized = identifier.trim();
  if (!normalized) {
    return {
      email: "",
      kind: "unknown" as const,
      phone: "",
      raw: "",
    };
  }
  if (normalized.includes("@")) {
    return {
      email: normalizeEmail(normalized),
      kind: "email" as const,
      phone: "",
      raw: normalized,
    };
  }
  return {
    email: "",
    kind: "phone" as const,
    phone: normalizePhone(normalized),
    raw: normalized,
  };
}

function buildSyntheticEmailFromPhone(phone: string) {
  const digits = phone.replace(/[^\d]/g, "");
  return `phone-${digits || "user"}@auth.local`;
}

function getEmailDomain(email: string) {
  return normalizeEmail(email).split("@")[1] ?? "";
}

async function hashValue(value: string) {
  const buffer = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value)
  );
  return Array.from(new Uint8Array(buffer))
    .map((chunk) => chunk.toString(16).padStart(2, "0"))
    .join("");
}

async function hashSessionToken(token: string) {
  return hashValue(token);
}

async function hashPassword(password: string) {
  return hashValue(`password:${password}`);
}

async function loadPolicy(ctx: any) {
  const existing = await ctx.db
    .query("authPolicies")
    .withIndex("by_active", (q: any) => q.eq("isActive", true))
    .first();
  if (existing) {
    return existing;
  }

  const now = Date.now();
  const policyId = await ctx.db.insert("authPolicies", {
    allowBootstrapAutoApprove: true,
    allowedEmailDomains: [],
    bootstrapCompletedAt: undefined,
    isActive: true,
    maxSessionsPerUser: 5,
    name: "default",
    policyVersion: 1,
    refreshTtlDays: 14,
    requireDeviceApproval: true,
    sessionTtlMinutes: 60,
    stepUpForNewGeo: true,
    trustedNetworks: [],
    updatedAt: now,
  });

  return await ctx.db.get(policyId);
}

async function createAuditLog(
  ctx: any,
  args: {
    event:
      | "LOGIN_ATTEMPT"
      | "DEVICE_PENDING"
      | "DEVICE_APPROVED"
      | "DEVICE_REVOKED"
      | "BOOTSTRAP_DEVICE_APPROVED"
      | "LOGIN_SUCCESS"
      | "LOGIN_DENIED"
      | "SESSION_REVOKED"
      | "SESSIONS_REVOKED";
    meta?: Record<string, unknown>;
    userId?: unknown;
  }
) {
  await ctx.db.insert("authAuditLogs", {
    createdAt: Date.now(),
    event: args.event,
    meta: args.meta,
    userId: args.userId,
  });
}

export const getAuthProfile = query({
  args: {
    userId: v.id("authUsers"),
  },
  returns: v.union(
    v.object({
      email: v.string(),
      name: v.string(),
      phone: v.optional(v.string()),
      profileId: v.optional(v.id("userProfiles")),
      roles: v.array(v.string()),
      status: v.union(v.literal("active"), v.literal("blocked")),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const authUser = await ctx.db.get(args.userId);

    if (!authUser) {
      return null;
    }

    return {
      email: authUser.email,
      name: authUser.name,
      phone: authUser.phone,
      profileId: authUser.profileId,
      roles: authUser.roles,
      status: authUser.status,
    };
  },
});

export const getAuthProfileByEmail = query({
  args: {
    email: v.string(),
  },
  returns: v.union(
    v.object({
      email: v.string(),
      name: v.string(),
      phone: v.optional(v.string()),
      profileId: v.optional(v.id("userProfiles")),
      roles: v.array(v.string()),
      status: v.union(v.literal("active"), v.literal("blocked")),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const authUser = await ctx.db
      .query("authUsers")
      .withIndex("by_email", (q) => q.eq("email", normalizeEmail(args.email)))
      .first();

    if (!authUser) {
      return null;
    }

    return {
      email: authUser.email,
      name: authUser.name,
      phone: authUser.phone,
      profileId: authUser.profileId,
      roles: authUser.roles,
      status: authUser.status,
    };
  },
});

export const authorizePasswordLogin = mutation({
  args: {
    createSession: v.optional(v.boolean()),
    deviceHash: v.string(),
    identifier: v.string(),
    ip: v.optional(v.string()),
    label: v.optional(v.string()),
    password: v.string(),
    userAgent: v.optional(v.string()),
  },
  returns: v.object({
    code: loginCode,
    deviceId: v.optional(v.id("authDevices")),
    policyVersion: v.optional(v.number()),
    roles: v.optional(v.array(v.string())),
    sessionId: v.optional(v.id("authSessions")),
    sessionVersion: v.optional(v.number()),
    userId: v.optional(v.id("authUsers")),
    userEmail: v.optional(v.string()),
    userName: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const admin = getAdminConfig();
    const identifier = parseIdentifier(args.identifier);
    const loginEmail =
      identifier.kind === "email"
        ? identifier.email
        : identifier.phone
          ? buildSyntheticEmailFromPhone(identifier.phone)
          : normalizeEmail(args.identifier);
    const policy = await loadPolicy(ctx);
    const now = Date.now();
    const shouldCreateSession = args.createSession ?? true;

    const profileByEmail =
      identifier.email
        ? await ctx.db
            .query("userProfiles")
            .withIndex("by_email", (q) => q.eq("email", identifier.email))
            .first()
        : null;
    const profileByPhone =
      identifier.phone
        ? await ctx.db
            .query("userProfiles")
            .withIndex("by_phone", (q) => q.eq("phone", identifier.phone))
            .first()
        : null;
    const resolvedProfile = profileByEmail ?? profileByPhone ?? null;

    let authUser =
      (identifier.email
        ? await ctx.db
            .query("authUsers")
            .withIndex("by_email", (q) => q.eq("email", identifier.email))
            .first()
        : null) ??
      (resolvedProfile?.email
        ? await ctx.db
            .query("authUsers")
            .withIndex("by_email", (q) => q.eq("email", normalizeEmail(resolvedProfile.email!)))
            .first()
        : null) ??
      (identifier.phone
        ? await ctx.db
            .query("authUsers")
            .withIndex("by_phone", (q) => q.eq("phone", identifier.phone))
            .first()
        : null) ??
      (resolvedProfile
        ? await ctx.db
            .query("authUsers")
            .withIndex("by_profile", (q) => q.eq("profileId", resolvedProfile._id))
            .first()
        : null);

    const isAdminIdentifier =
      identifier.email === admin.email ||
      (identifier.phone &&
        (
          (admin.phone && identifier.phone === admin.phone) ||
          resolvedProfile?.email === admin.email ||
          authUser?.email === admin.email
        ));

    await createAuditLog(ctx, {
      event: "LOGIN_ATTEMPT",
      meta: {
        deviceHash: args.deviceHash,
        identifier: identifier.raw,
        email: identifier.email || authUser?.email || loginEmail,
        phone: identifier.phone || resolvedProfile?.phone,
        ip: args.ip,
      },
      userId: authUser?._id,
    });

    if (
      identifier.email &&
      policy.allowedEmailDomains.length > 0 &&
      !policy.allowedEmailDomains.includes(getEmailDomain(identifier.email))
    ) {
      await createAuditLog(ctx, {
        event: "LOGIN_DENIED",
        meta: { identifier: identifier.raw, reason: "EMAIL_DOMAIN_NOT_ALLOWED" },
        userId: authUser?._id,
      });
      return { code: "EMAIL_DOMAIN_NOT_ALLOWED" as const };
    }

    const suppliedPasswordHash = await hashPassword(args.password);
    const storedPasswordMatches =
      !!authUser?.passwordHash && authUser.passwordHash === suppliedPasswordHash;
    const adminPasswordMatches = isAdminIdentifier && args.password === admin.password;

    if (!storedPasswordMatches && !adminPasswordMatches) {
      await createAuditLog(ctx, {
        event: "LOGIN_DENIED",
        meta: { identifier: identifier.raw, reason: "INVALID_CREDENTIALS" },
        userId: authUser?._id,
      });
      return { code: "INVALID_CREDENTIALS" as const };
    }

    if (!authUser) {
      const userId = await ctx.db.insert("authUsers", {
        createdAt: now,
        email: identifier.email || resolvedProfile?.email || admin.email || loginEmail,
        name: admin.name,
        passwordHash: suppliedPasswordHash,
        phone: identifier.phone || resolvedProfile?.phone || admin.phone || undefined,
        profileId: resolvedProfile?._id,
        roles: admin.roles,
        sessionVersion: 1,
        status: "active",
        updatedAt: now,
      });
      authUser = await ctx.db.get(userId);
    } else {
      await ctx.db.patch(authUser._id, {
        email: authUser.email || resolvedProfile?.email || loginEmail,
        name: isAdminIdentifier ? admin.name : authUser.name,
        passwordHash: adminPasswordMatches ? suppliedPasswordHash : authUser.passwordHash,
        phone: authUser.phone ?? identifier.phone ?? resolvedProfile?.phone,
        profileId: authUser.profileId ?? resolvedProfile?._id,
        roles: isAdminIdentifier ? admin.roles : authUser.roles,
        updatedAt: now,
      });
      authUser = await ctx.db.get(authUser._id);
    }

    if (!authUser) {
      throw new Error("Failed to persist auth user");
    }

    if (authUser.status === "blocked") {
      await createAuditLog(ctx, {
        event: "LOGIN_DENIED",
        meta: { identifier: identifier.raw, reason: "BLOCKED" },
        userId: authUser._id,
      });
      return { code: "BLOCKED" as const, userId: authUser._id };
    }

    const existingIdentity = await ctx.db
      .query("authIdentities")
      .withIndex("by_provider_account", (q) =>
        q.eq("provider", "credentials").eq("providerAccountId", identifier.raw)
      )
      .first();
    if (existingIdentity) {
      await ctx.db.patch(existingIdentity._id, { lastLoginAt: now });
    } else {
      await ctx.db.insert("authIdentities", {
        lastLoginAt: now,
        provider: "credentials",
        providerAccountId: identifier.raw,
        userId: authUser._id,
      });
    }

    let device = await ctx.db
      .query("authDevices")
      .withIndex("by_user_device", (q) =>
        q.eq("userId", authUser._id).eq("deviceHash", args.deviceHash)
      )
      .first();

    const hasApprovedDevice = await ctx.db
      .query("authDevices")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", authUser._id).eq("status", "approved")
      )
      .first();

    const shouldBootstrapApprove =
      authUser.email === admin.email &&
      hasApprovedDevice === null &&
      policy.allowBootstrapAutoApprove &&
      !policy.bootstrapCompletedAt;

    if (!device) {
      const status =
        policy.requireDeviceApproval && !shouldBootstrapApprove
          ? "pending"
          : "approved";
      const deviceId = await ctx.db.insert("authDevices", {
        approvedAt: status === "approved" ? now : undefined,
        approvedBy: status === "approved" ? "system-bootstrap" : undefined,
        deviceHash: args.deviceHash,
        firstSeenAt: now,
        label: args.label,
        lastSeenAt: now,
        lastSeenIp: args.ip,
        lastSeenUserAgent: args.userAgent,
        riskScore: 0,
        status,
        userId: authUser._id,
      });
      device = await ctx.db.get(deviceId);
      if (status === "approved" && shouldBootstrapApprove) {
        await ctx.db.patch(policy._id, {
          allowBootstrapAutoApprove: false,
          bootstrapCompletedAt: now,
          updatedAt: now,
        });
      }
      await createAuditLog(ctx, {
        event:
          status === "approved" && shouldBootstrapApprove
            ? "BOOTSTRAP_DEVICE_APPROVED"
            : status === "approved"
              ? "DEVICE_APPROVED"
              : "DEVICE_PENDING",
        meta: {
          deviceId,
          email: authUser.email,
          identifier: identifier.raw,
          reason: status === "approved" ? "BOOTSTRAP" : "NEW_DEVICE",
        },
        userId: authUser._id,
      });
    } else {
      await ctx.db.patch(device._id, {
        label: args.label ?? device.label,
        lastSeenAt: now,
        lastSeenIp: args.ip,
        lastSeenUserAgent: args.userAgent,
      });
      device = await ctx.db.get(device._id);
    }

    if (!device) {
      throw new Error("Failed to persist device");
    }

    if (device.status === "revoked") {
      await createAuditLog(ctx, {
        event: "LOGIN_DENIED",
        meta: {
          deviceId: device._id,
          email: authUser.email,
          identifier: identifier.raw,
          reason: "DEVICE_REVOKED",
        },
        userId: authUser._id,
      });
      return {
        code: "DEVICE_REVOKED" as const,
        deviceId: device._id,
        userId: authUser._id,
      };
    }

    if (device.status === "pending") {
      return {
        code: "DEVICE_APPROVAL_REQUIRED" as const,
        deviceId: device._id,
        userId: authUser._id,
      };
    }

    let sessionId;
    if (shouldCreateSession) {
      const sessionTokenHash = await hashSessionToken(
        `${authUser._id}:${device._id}:${now}`
      );
      sessionId = await ctx.db.insert("authSessions", {
        deviceId: device._id,
        expiresAt: now + policy.sessionTtlMinutes * 60 * 1000,
        ip: args.ip,
        policyVersion: policy.policyVersion,
        revokedAt: undefined,
        revokedBy: undefined,
        sessionTokenHash,
        userAgent: args.userAgent,
        userId: authUser._id,
      });

      const activeSessions = await ctx.db
        .query("authSessions")
        .withIndex("by_user", (q) => q.eq("userId", authUser._id))
        .collect();
      const liveSessions = activeSessions
        .filter((session: any) => !session.revokedAt)
        .sort((left: any, right: any) => right._creationTime - left._creationTime);
      if (liveSessions.length > policy.maxSessionsPerUser) {
        const toRevoke = liveSessions.slice(policy.maxSessionsPerUser);
        for (const session of toRevoke) {
          await ctx.db.patch(session._id, {
            revokedAt: now,
            revokedBy: "system-max-sessions",
          });
        }
      }

      await createAuditLog(ctx, {
        event: "LOGIN_SUCCESS",
        meta: {
          deviceId: device._id,
          email: authUser.email,
          identifier: identifier.raw,
          sessionId,
        },
        userId: authUser._id,
      });
    }

    return {
      code: "APPROVED" as const,
      deviceId: device._id,
      policyVersion: policy.policyVersion,
      roles: authUser.roles,
      sessionId,
      sessionVersion: authUser.sessionVersion,
      userEmail: authUser.email,
      userId: authUser._id,
      userName: authUser.name,
    };
  },
});

export const backfillAuthUserProfiles = mutation({
  args: {},
  returns: v.object({
    linked: v.number(),
    updated: v.number(),
  }),
  handler: async (ctx) => {
    const users = await ctx.db.query("authUsers").collect();
    let linked = 0;
    let updated = 0;

    for (const authUser of users) {
      const profile =
        (authUser.profileId ? await ctx.db.get(authUser.profileId) : null) ??
        (authUser.email
          ? await ctx.db
              .query("userProfiles")
              .withIndex("by_email", (q) => q.eq("email", authUser.email))
              .first()
          : null) ??
        (authUser.phone
          ? await ctx.db
              .query("userProfiles")
              .withIndex("by_phone", (q) => q.eq("phone", authUser.phone!))
              .first()
          : null);

      if (!profile) {
        continue;
      }

      await ctx.db.patch(authUser._id, {
        phone: authUser.phone ?? profile.phone,
        profileId: profile._id,
        updatedAt: Date.now(),
      });
      updated += 1;
      if (!authUser.profileId) {
        linked += 1;
      }
    }

    return { linked, updated };
  },
});

export const getViewerSessionState = query({
  args: { sessionId: v.id("authSessions") },
  returns: v.union(
    v.object({
      deviceStatus,
      isValid: v.boolean(),
      revokedAt: v.optional(v.number()),
      sessionVersion: v.number(),
      userStatus: v.union(v.literal("active"), v.literal("blocked")),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      return null;
    }

    const [user, device] = await Promise.all([
      ctx.db.get(session.userId),
      ctx.db.get(session.deviceId),
    ]);
    if (!user || !device) {
      return null;
    }

    return {
      deviceStatus: device.status,
      isValid:
        !session.revokedAt &&
        user.status === "active" &&
        device.status === "approved" &&
        session.expiresAt > Date.now(),
      revokedAt: session.revokedAt,
      sessionVersion: user.sessionVersion,
      userStatus: user.status,
    };
  },
});

export const listPendingDevices = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("authDevices"),
      email: v.string(),
      firstSeenAt: v.number(),
      label: v.optional(v.string()),
      lastSeenAt: v.number(),
      lastSeenIp: v.optional(v.string()),
      name: v.string(),
      riskScore: v.number(),
      status: deviceStatus,
      userId: v.id("authUsers"),
    })
  ),
  handler: async (ctx) => {
    const devices = await ctx.db
      .query("authDevices")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();

    const result = [];
    for (const device of devices) {
      const user = await ctx.db.get(device.userId);
      if (!user) {
        continue;
      }
      result.push({
        _id: device._id,
        email: user.email,
        firstSeenAt: device.firstSeenAt,
        label: device.label,
        lastSeenAt: device.lastSeenAt,
        lastSeenIp: device.lastSeenIp,
        name: user.name,
        riskScore: device.riskScore,
        status: device.status,
        userId: user._id,
      });
    }

    return result.sort((left, right) => right.lastSeenAt - left.lastSeenAt);
  },
});

export const getDeviceStatus = query({
  args: {
    deviceHash: v.string(),
    userId: v.id("authUsers"),
  },
  returns: v.union(
    v.object({
      deviceId: v.id("authDevices"),
      status: deviceStatus,
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const device = await ctx.db
      .query("authDevices")
      .withIndex("by_user_device", (q) =>
        q.eq("userId", args.userId).eq("deviceHash", args.deviceHash)
      )
      .first();
    if (!device) {
      return null;
    }
    return {
      deviceId: device._id,
      status: device.status,
    };
  },
});

export const requestDeviceApproval = mutation({
  args: {
    deviceHash: v.string(),
    ip: v.optional(v.string()),
    label: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    userId: v.id("authUsers"),
  },
  returns: v.object({
    deviceId: v.id("authDevices"),
    status: deviceStatus,
  }),
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("User not found");
    }

    const now = Date.now();
    let device = await ctx.db
      .query("authDevices")
      .withIndex("by_user_device", (q) =>
        q.eq("userId", args.userId).eq("deviceHash", args.deviceHash)
      )
      .first();

    if (!device) {
      const deviceId = await ctx.db.insert("authDevices", {
        approvedAt: undefined,
        approvedBy: undefined,
        deviceHash: args.deviceHash,
        firstSeenAt: now,
        label: args.label,
        lastSeenAt: now,
        lastSeenIp: args.ip,
        lastSeenUserAgent: args.userAgent,
        riskScore: 0,
        status: "pending",
        userId: args.userId,
      });
      await createAuditLog(ctx, {
        event: "DEVICE_PENDING",
        meta: { deviceId, reason: "API_REQUEST" },
        userId: args.userId,
      });
      return {
        deviceId,
        status: "pending" as const,
      };
    }

    if (device.status !== "approved") {
      await ctx.db.patch(device._id, {
        label: args.label ?? device.label,
        lastSeenAt: now,
        lastSeenIp: args.ip,
        lastSeenUserAgent: args.userAgent,
        status: "pending",
      });
      await createAuditLog(ctx, {
        event: "DEVICE_PENDING",
        meta: { deviceId: device._id, reason: "API_REQUEST" },
        userId: args.userId,
      });
      device = await ctx.db.get(device._id);
    }
    if (!device) {
      throw new Error("Failed to persist device request");
    }

    return {
      deviceId: device._id,
      status: device.status,
    };
  },
});

export const approveDevice = mutation({
  args: {
    approvedBy: v.string(),
    deviceId: v.id("authDevices"),
  },
  returns: v.union(v.literal("ok"), v.literal("already_done"), v.literal("not_found")),
  handler: async (ctx, args) => {
    const device = await ctx.db.get(args.deviceId);
    if (!device) {
      return "not_found";
    }
    if (device.status === "approved") {
      return "already_done";
    }

    const now = Date.now();
    await ctx.db.patch(device._id, {
      approvedAt: now,
      approvedBy: args.approvedBy,
      lastSeenAt: now,
      status: "approved",
    });

    await createAuditLog(ctx, {
      event: "DEVICE_APPROVED",
      meta: { approvedBy: args.approvedBy, deviceId: device._id },
      userId: device.userId,
    });

    return "ok";
  },
});

export const revokeDevice = mutation({
  args: {
    deviceId: v.id("authDevices"),
    revokedBy: v.string(),
  },
  returns: v.union(v.literal("ok"), v.literal("already_done"), v.literal("not_found")),
  handler: async (ctx, args) => {
    const device = await ctx.db.get(args.deviceId);
    if (!device) {
      return "not_found";
    }
    if (device.status === "revoked") {
      return "already_done";
    }

    const now = Date.now();
    await ctx.db.patch(device._id, {
      lastSeenAt: now,
      status: "revoked",
    });

    const sessions = await ctx.db
      .query("authSessions")
      .withIndex("by_user", (q) => q.eq("userId", device.userId))
      .collect();
    for (const session of sessions) {
      if (session.deviceId === device._id && !session.revokedAt) {
        await ctx.db.patch(session._id, {
          revokedAt: now,
          revokedBy: args.revokedBy,
        });
      }
    }

    await createAuditLog(ctx, {
      event: "DEVICE_REVOKED",
      meta: { deviceId: device._id, revokedBy: args.revokedBy },
      userId: device.userId,
    });

    return "ok";
  },
});

export const revokeSession = mutation({
  args: {
    revokedBy: v.string(),
    sessionId: v.id("authSessions"),
  },
  returns: v.union(v.literal("ok"), v.literal("already_done"), v.literal("not_found")),
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      return "not_found";
    }
    if (session.revokedAt) {
      return "already_done";
    }

    const now = Date.now();
    await ctx.db.patch(session._id, {
      revokedAt: now,
      revokedBy: args.revokedBy,
    });

    await createAuditLog(ctx, {
      event: "SESSION_REVOKED",
      meta: { revokedBy: args.revokedBy, sessionId: session._id },
      userId: session.userId,
    });

    return "ok";
  },
});

export const revokeAllUserSessions = mutation({
  args: {
    revokedBy: v.string(),
    userId: v.id("authUsers"),
  },
  returns: v.union(v.literal("ok"), v.literal("already_done"), v.literal("not_found")),
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      return "not_found";
    }

    const now = Date.now();
    const sessions = await ctx.db
      .query("authSessions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    let revokedAny = false;
    for (const session of sessions) {
      if (!session.revokedAt) {
        await ctx.db.patch(session._id, {
          revokedAt: now,
          revokedBy: args.revokedBy,
        });
        revokedAny = true;
      }
    }

    if (!revokedAny) {
      return "already_done";
    }

    await ctx.db.patch(args.userId, {
      sessionVersion: user.sessionVersion + 1,
      updatedAt: now,
    });

    await createAuditLog(ctx, {
      event: "SESSIONS_REVOKED",
      meta: { revokedBy: args.revokedBy },
      userId: args.userId,
    });

    return "ok";
  },
});

export const getActivePolicy = query({
  args: {},
  returns: v.object({
    allowBootstrapAutoApprove: v.boolean(),
    allowedEmailDomains: v.array(v.string()),
    bootstrapCompletedAt: v.optional(v.number()),
    maxSessionsPerUser: v.number(),
    policyVersion: v.number(),
    refreshTtlDays: v.number(),
    requireDeviceApproval: v.boolean(),
    sessionTtlMinutes: v.number(),
    stepUpForNewGeo: v.boolean(),
    trustedNetworks: v.array(v.string()),
  }),
  handler: async (ctx) => {
    const policy = await loadPolicy(ctx);
    return {
      allowBootstrapAutoApprove: policy.allowBootstrapAutoApprove,
      allowedEmailDomains: policy.allowedEmailDomains,
      bootstrapCompletedAt: policy.bootstrapCompletedAt,
      maxSessionsPerUser: policy.maxSessionsPerUser,
      policyVersion: policy.policyVersion,
      refreshTtlDays: policy.refreshTtlDays,
      requireDeviceApproval: policy.requireDeviceApproval,
      sessionTtlMinutes: policy.sessionTtlMinutes,
      stepUpForNewGeo: policy.stepUpForNewGeo,
      trustedNetworks: policy.trustedNetworks,
    };
  },
});

export const consumeOpenClawNonce = mutation({
  args: {
    nonce: v.string(),
    requestMethod: v.string(),
    requestPath: v.string(),
    ttlSeconds: v.number(),
  },
  returns: v.union(v.literal("ok"), v.literal("nonce_replay")),
  handler: async (ctx, args) => {
    const now = Date.now();
    const nonceHash = await hashValue(args.nonce);
    const existing = await ctx.db
      .query("authServiceNonces")
      .withIndex("by_nonce_hash", (q) => q.eq("nonceHash", nonceHash))
      .first();

    if (existing && existing.expiresAt > now) {
      return "nonce_replay";
    }

    if (existing) {
      await ctx.db.patch(existing._id, {
        createdAt: now,
        expiresAt: now + args.ttlSeconds * 1000,
        requestMethod: args.requestMethod,
        requestPath: args.requestPath,
      });
      return "ok";
    }

    await ctx.db.insert("authServiceNonces", {
      createdAt: now,
      expiresAt: now + args.ttlSeconds * 1000,
      nonceHash,
      requestMethod: args.requestMethod,
      requestPath: args.requestPath,
    });
    return "ok";
  },
});
