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

const registrationStatus = v.union(
  v.literal("pending_workspace"),
  v.literal("ready_for_access"),
  v.literal("approved"),
  v.literal("denied")
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

function extractPhoneDigits(value: string) {
  return value.replace(/[^\d]/g, "");
}

function phoneLookupVariants(phone: string) {
  const normalized = normalizePhone(phone);
  const baseDigits = extractPhoneDigits(normalized || phone);
  const variants = new Set<string>();

  if (!baseDigits) {
    return [];
  }

  variants.add(baseDigits);
  variants.add(`+${baseDigits}`);
  variants.add(`${baseDigits}@s.whatsapp.net`);
  variants.add(`${baseDigits}@lid`);

  if (baseDigits.startsWith("0") && baseDigits.length > 1) {
    const intl = `62${baseDigits.slice(1)}`;
    variants.add(intl);
    variants.add(`+${intl}`);
    variants.add(`${intl}@s.whatsapp.net`);
    variants.add(`${intl}@lid`);
  }

  if (baseDigits.startsWith("62")) {
    variants.add(baseDigits.slice(2));
    variants.add(`0${baseDigits.slice(2)}`);
  } else if (baseDigits.startsWith("8")) {
    const intl = `62${baseDigits}`;
    variants.add(intl);
    variants.add(`+${intl}`);
    variants.add(`${intl}@s.whatsapp.net`);
    variants.add(`${intl}@lid`);
  }

  return Array.from(variants).filter(Boolean);
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

function buildDisplayName(name: string, phone: string) {
  const trimmed = name.trim();
  if (trimmed) {
    return trimmed;
  }
  const suffix = phone.replace(/[^\d]/g, "").slice(-4) || "user";
  return `User ${suffix}`;
}

function buildWorkspaceName(name: string) {
  const trimmed = name.trim();
  return trimmed ? `${trimmed}'s Workspace` : "Workspace";
}

function buildWorkspaceRootPath(userId: string) {
  return `/users/${userId}`;
}

function generateTemporaryPassword() {
  return `${Math.floor(Math.random() * 1_000_000)}`.padStart(6, "0");
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
    requireDeviceApproval: false,
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
      | "SESSIONS_REVOKED"
      | "REGISTRATION_REQUESTED"
      | "REGISTRATION_APPROVED"
      | "REGISTRATION_DENIED"
      | "TEMP_PASSWORD_ISSUED"
      | "PASSWORD_CHANGED";
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

async function resolveProfileByPhone(ctx: any, phone: string) {
  const variants = phoneLookupVariants(phone);
  if (variants.length === 0) {
    return null;
  }

  for (const variant of variants) {
    const byPhone = await ctx.db
      .query("userProfiles")
      .withIndex("by_phone", (q: any) => q.eq("phone", variant))
      .first();
    if (byPhone) {
      return byPhone;
    }
  }

  const channels = ["whatsapp", "phone", "telegram"];
  for (const channel of channels) {
    for (const variant of variants) {
      const identity = await ctx.db
        .query("userIdentities")
        .withIndex("by_channel_external", (q: any) =>
          q.eq("channel", channel).eq("externalUserId", variant)
        )
        .first();
      if (!identity) {
        continue;
      }
      const profile = await ctx.db.get(identity.userId);
      if (profile) {
        return profile;
      }
    }
  }

  return null;
}

async function listOwnedWorkspaceIds(ctx: any, profileId: any) {
  const workspaces = await ctx.db
    .query("workspaceTrees")
    .withIndex("by_owner", (q: any) => q.eq("ownerId", profileId))
    .collect();

  return workspaces
    .sort((left: any, right: any) => left.name.localeCompare(right.name))
    .map((workspace: any) => workspace._id);
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

export const submitRegistrationRequest = mutation({
  args: {
    context: v.string(),
    name: v.string(),
    phone: v.string(),
  },
  returns: v.object({
    hasWorkspace: v.boolean(),
    matchedProfileId: v.optional(v.id("userProfiles")),
    matchedWorkspaceCount: v.number(),
    requestId: v.id("authRegistrationRequests"),
    status: registrationStatus,
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const phone = normalizePhone(args.phone);
    if (!phone) {
      throw new Error("Phone number is required");
    }

    const name = buildDisplayName(args.name, phone);
    const context = args.context.trim();
    if (!context) {
      throw new Error("Registration context is required");
    }

    const matchedProfile = await resolveProfileByPhone(ctx, phone);
    const matchedWorkspaceIds = matchedProfile
      ? await listOwnedWorkspaceIds(ctx, matchedProfile._id)
      : [];
    const status =
      matchedWorkspaceIds.length > 0
        ? ("ready_for_access" as const)
        : ("pending_workspace" as const);

    const existingRequest = await ctx.db
      .query("authRegistrationRequests")
      .withIndex("by_phone", (q) => q.eq("phone", phone))
      .first();

    const payload = {
      context,
      matchedProfileId: matchedProfile?._id,
      matchedWorkspaceIds,
      name,
      phone,
      status,
      updatedAt: now,
    };

    let requestId;
    if (existingRequest && existingRequest.status !== "denied") {
      await ctx.db.patch(existingRequest._id, {
        ...payload,
        approvedAt: undefined,
        approvedBy: undefined,
        deniedAt: undefined,
        deniedBy: undefined,
        reviewNote: undefined,
        temporaryPasswordIssuedAt: undefined,
      });
      requestId = existingRequest._id;
    } else {
      requestId = await ctx.db.insert("authRegistrationRequests", {
        ...payload,
        approvedAt: undefined,
        approvedBy: undefined,
        authUserId: undefined,
        createdAt: now,
        deniedAt: undefined,
        deniedBy: undefined,
        reviewNote: undefined,
        temporaryPasswordIssuedAt: undefined,
      });
    }

    await createAuditLog(ctx, {
      event: "REGISTRATION_REQUESTED",
      meta: {
        hasWorkspace: matchedWorkspaceIds.length > 0,
        matchedProfileId: matchedProfile?._id,
        matchedWorkspaceCount: matchedWorkspaceIds.length,
        phone,
        requestId,
      },
    });

    return {
      hasWorkspace: matchedWorkspaceIds.length > 0,
      matchedProfileId: matchedProfile?._id,
      matchedWorkspaceCount: matchedWorkspaceIds.length,
      requestId,
      status,
    };
  },
});

export const listRegistrationRequests = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("authRegistrationRequests"),
      approvedAt: v.optional(v.number()),
      authUserId: v.optional(v.id("authUsers")),
      context: v.string(),
      createdAt: v.number(),
      matchedProfileId: v.optional(v.id("userProfiles")),
      matchedWorkspaceCount: v.number(),
      matchedWorkspaceNames: v.array(v.string()),
      name: v.string(),
      phone: v.string(),
      reviewNote: v.optional(v.string()),
      status: registrationStatus,
      temporaryPasswordIssuedAt: v.optional(v.number()),
      updatedAt: v.number(),
    })
  ),
  handler: async (ctx) => {
    const requests = await ctx.db
      .query("authRegistrationRequests")
      .withIndex("by_status", (q) => q.eq("status", "pending_workspace"))
      .collect();
    const readyRequests = await ctx.db
      .query("authRegistrationRequests")
      .withIndex("by_status", (q) => q.eq("status", "ready_for_access"))
      .collect();
    const approvedRequests = await ctx.db
      .query("authRegistrationRequests")
      .withIndex("by_status", (q) => q.eq("status", "approved"))
      .order("desc")
      .take(50);
    const deniedRequests = await ctx.db
      .query("authRegistrationRequests")
      .withIndex("by_status", (q) => q.eq("status", "denied"))
      .order("desc")
      .take(20);

    const all = [...requests, ...readyRequests, ...approvedRequests, ...deniedRequests]
      .sort((left, right) => right.updatedAt - left.updatedAt)
      .slice(0, 100);

    const result = [];
    for (const request of all) {
      const workspaceNames = [];
      for (const workspaceId of request.matchedWorkspaceIds) {
        const workspace = await ctx.db.get(workspaceId);
        if (workspace) {
          workspaceNames.push(workspace.name);
        }
      }

      result.push({
        _id: request._id,
        approvedAt: request.approvedAt,
        authUserId: request.authUserId,
        context: request.context,
        createdAt: request.createdAt,
        matchedProfileId: request.matchedProfileId,
        matchedWorkspaceCount: request.matchedWorkspaceIds.length,
        matchedWorkspaceNames: workspaceNames,
        name: request.name,
        phone: request.phone,
        reviewNote: request.reviewNote,
        status: request.status,
        temporaryPasswordIssuedAt: request.temporaryPasswordIssuedAt,
        updatedAt: request.updatedAt,
      });
    }

    return result;
  },
});

export const approveRegistrationRequest = mutation({
  args: {
    createWorkspace: v.optional(v.boolean()),
    requestId: v.id("authRegistrationRequests"),
  },
  returns: v.object({
    authUserId: v.id("authUsers"),
    createdWorkspaceId: v.optional(v.id("workspaceTrees")),
    requestId: v.id("authRegistrationRequests"),
    temporaryPassword: v.string(),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const request = await ctx.db.get(args.requestId);
    if (!request) {
      throw new Error("Registration request not found");
    }
    if (request.status === "denied") {
      throw new Error("Denied request cannot be approved");
    }

    let profile =
      (request.matchedProfileId
        ? await ctx.db.get(request.matchedProfileId)
        : null) ?? (await resolveProfileByPhone(ctx, request.phone));

    if (!profile && !args.createWorkspace) {
      throw new Error("Workspace approval requires an existing profile");
    }

    if (!profile) {
      const profileId = await ctx.db.insert("userProfiles", {
        createdAt: now,
        name: request.name,
        nickname: request.name,
        phone: request.phone,
        updatedAt: now,
      });
      profile = await ctx.db.get(profileId);
    }

    if (!profile) {
      throw new Error("Failed to create or load the user profile");
    }

    let matchedWorkspaceIds = await listOwnedWorkspaceIds(ctx, profile._id);
    let createdWorkspaceId;
    if (matchedWorkspaceIds.length === 0 && args.createWorkspace) {
      createdWorkspaceId = await ctx.db.insert("workspaceTrees", {
        createdAt: now,
        description: "Workspace created from admin registration approval.",
        fileCount: 0,
        name: buildWorkspaceName(request.name),
        ownerId: profile._id,
        rootPath: buildWorkspaceRootPath(profile._id),
        runtimePath: undefined,
        source: "registration",
        status: "active",
        type: "user",
        updatedAt: now,
      });
      matchedWorkspaceIds = [createdWorkspaceId];
    }

    const temporaryPassword = generateTemporaryPassword();
    const temporaryPasswordHash = await hashPassword(temporaryPassword);
    const syntheticEmail =
      profile.email ?? buildSyntheticEmailFromPhone(request.phone);

    const existingAuthUser =
      (await ctx.db
        .query("authUsers")
        .withIndex("by_profile", (q) => q.eq("profileId", profile._id))
        .first()) ??
      (await ctx.db
        .query("authUsers")
        .withIndex("by_phone", (q) => q.eq("phone", request.phone))
        .first()) ??
      (await ctx.db
        .query("authUsers")
        .withIndex("by_email", (q) => q.eq("email", syntheticEmail))
        .first());

    let authUserId;
    if (existingAuthUser) {
      await ctx.db.patch(existingAuthUser._id, {
        email: existingAuthUser.email || syntheticEmail,
        mustChangePassword: true,
        name: request.name || existingAuthUser.name,
        passwordHash: temporaryPasswordHash,
        phone: request.phone,
        profileId: profile._id,
        roles: existingAuthUser.roles.length > 0 ? existingAuthUser.roles : ["member"],
        status: "active",
        temporaryPasswordIssuedAt: now,
        updatedAt: now,
      });
      authUserId = existingAuthUser._id;
    } else {
      authUserId = await ctx.db.insert("authUsers", {
        createdAt: now,
        email: syntheticEmail,
        mustChangePassword: true,
        name: request.name,
        passwordHash: temporaryPasswordHash,
        phone: request.phone,
        profileId: profile._id,
        roles: ["member"],
        sessionVersion: 1,
        status: "active",
        temporaryPasswordIssuedAt: now,
        updatedAt: now,
      });
    }

    await ctx.db.patch(request._id, {
      approvedAt: now,
      approvedBy: "admin",
      authUserId,
      matchedProfileId: profile._id,
      matchedWorkspaceIds,
      status: "approved",
      temporaryPasswordIssuedAt: now,
      updatedAt: now,
    });

    await createAuditLog(ctx, {
      event: "REGISTRATION_APPROVED",
      meta: {
        createdWorkspaceId,
        phone: request.phone,
        requestId: request._id,
        workspaceCount: matchedWorkspaceIds.length,
      },
      userId: authUserId,
    });
    await createAuditLog(ctx, {
      event: "TEMP_PASSWORD_ISSUED",
      meta: {
        phone: request.phone,
        requestId: request._id,
      },
      userId: authUserId,
    });

    return {
      authUserId,
      createdWorkspaceId,
      requestId: request._id,
      temporaryPassword,
    };
  },
});

export const denyRegistrationRequest = mutation({
  args: {
    reason: v.optional(v.string()),
    requestId: v.id("authRegistrationRequests"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.requestId);
    if (!request) {
      throw new Error("Registration request not found");
    }
    await ctx.db.patch(request._id, {
      deniedAt: Date.now(),
      deniedBy: "admin",
      reviewNote: args.reason?.trim() || undefined,
      status: "denied",
      updatedAt: Date.now(),
    });
    await createAuditLog(ctx, {
      event: "REGISTRATION_DENIED",
      meta: {
        phone: request.phone,
        reason: args.reason?.trim() || undefined,
        requestId: request._id,
      },
      userId: request.authUserId,
    });
    return null;
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
      mustChangePassword: v.optional(v.boolean()),
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

    if (!device) {
      const status = "approved";
      const deviceId = await ctx.db.insert("authDevices", {
        approvedAt: status === "approved" ? now : undefined,
        approvedBy: "system-auto",
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
      await createAuditLog(ctx, {
        event: "DEVICE_APPROVED",
        meta: {
          deviceId,
          email: authUser.email,
          identifier: identifier.raw,
          reason: "AUTO_APPROVED",
        },
        userId: authUser._id,
      });
    } else {
      const patch: Record<string, unknown> = {
        label: args.label ?? device.label,
        lastSeenAt: now,
        lastSeenIp: args.ip,
        lastSeenUserAgent: args.userAgent,
      };
      if (device.status === "pending") {
        patch.approvedAt = now;
        patch.approvedBy = "system-auto";
        patch.status = "approved";
      }
      await ctx.db.patch(device._id, patch);
      device = await ctx.db.get(device._id);
      if (device?.status === "approved" && patch.status === "approved") {
        await createAuditLog(ctx, {
          event: "DEVICE_APPROVED",
          meta: {
            deviceId: device._id,
            email: authUser.email,
            identifier: identifier.raw,
            reason: "AUTO_APPROVED_EXISTING_PENDING",
          },
          userId: authUser._id,
        });
      }
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
      mustChangePassword: authUser.mustChangePassword,
      userEmail: authUser.email,
      userId: authUser._id,
      userName: authUser.name,
    };
  },
});

export const changePassword = mutation({
  args: {
    currentPassword: v.string(),
    newPassword: v.string(),
    userId: v.id("authUsers"),
  },
  returns: v.literal("ok"),
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("User not found");
    }

    const currentHash = await hashPassword(args.currentPassword);
    if (!user.passwordHash || user.passwordHash !== currentHash) {
      throw new Error("Current password is invalid");
    }

    const nextPassword = args.newPassword.trim();
    if (nextPassword.length < 6) {
      throw new Error("New password must be at least 6 characters");
    }

    const nextHash = await hashPassword(nextPassword);
    await ctx.db.patch(user._id, {
      mustChangePassword: false,
      passwordHash: nextHash,
      temporaryPasswordIssuedAt: undefined,
      updatedAt: Date.now(),
    });

    await createAuditLog(ctx, {
      event: "PASSWORD_CHANGED",
      meta: {
        reason: user.mustChangePassword ? "FIRST_LOGIN" : "SELF_SERVICE",
      },
      userId: user._id,
    });

    return "ok" as const;
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
    const policy = await loadPolicy(ctx);

    const now = Date.now();
    let device = await ctx.db
      .query("authDevices")
      .withIndex("by_user_device", (q) =>
        q.eq("userId", args.userId).eq("deviceHash", args.deviceHash)
      )
      .first();

    if (!device) {
      const nextStatus = policy.requireDeviceApproval ? "pending" : "approved";
      const deviceId = await ctx.db.insert("authDevices", {
        approvedAt: nextStatus === "approved" ? now : undefined,
        approvedBy: nextStatus === "approved" ? "system-auto" : undefined,
        deviceHash: args.deviceHash,
        firstSeenAt: now,
        label: args.label,
        lastSeenAt: now,
        lastSeenIp: args.ip,
        lastSeenUserAgent: args.userAgent,
        riskScore: 0,
        status: nextStatus,
        userId: args.userId,
      });
      await createAuditLog(ctx, {
        event: nextStatus === "approved" ? "DEVICE_APPROVED" : "DEVICE_PENDING",
        meta: { deviceId, reason: nextStatus === "approved" ? "AUTO_APPROVED" : "API_REQUEST" },
        userId: args.userId,
      });
      return {
        deviceId,
        status: nextStatus as "pending" | "approved",
      };
    }

    if (device.status !== "approved") {
      const nextStatus = policy.requireDeviceApproval ? "pending" : "approved";
      await ctx.db.patch(device._id, {
        approvedAt: nextStatus === "approved" ? now : device.approvedAt,
        approvedBy: nextStatus === "approved" ? "system-auto" : device.approvedBy,
        label: args.label ?? device.label,
        lastSeenAt: now,
        lastSeenIp: args.ip,
        lastSeenUserAgent: args.userAgent,
        status: nextStatus,
      });
      await createAuditLog(ctx, {
        event: nextStatus === "approved" ? "DEVICE_APPROVED" : "DEVICE_PENDING",
        meta: { deviceId: device._id, reason: nextStatus === "approved" ? "AUTO_APPROVED" : "API_REQUEST" },
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

export const setRequireDeviceApproval = mutation({
  args: {
    requireDeviceApproval: v.boolean(),
  },
  returns: v.object({
    autoApproved: v.number(),
    policyVersion: v.number(),
    requireDeviceApproval: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const policy = await loadPolicy(ctx);
    const nextPolicyVersion = policy.policyVersion + 1;

    await ctx.db.patch(policy._id, {
      policyVersion: nextPolicyVersion,
      requireDeviceApproval: args.requireDeviceApproval,
      updatedAt: now,
    });

    let autoApproved = 0;
    if (!args.requireDeviceApproval) {
      const pendingDevices = await ctx.db
        .query("authDevices")
        .withIndex("by_status", (q) => q.eq("status", "pending"))
        .collect();
      for (const device of pendingDevices) {
        await ctx.db.patch(device._id, {
          approvedAt: now,
          approvedBy: "system-auto",
          lastSeenAt: now,
          status: "approved",
        });
        autoApproved += 1;
        await createAuditLog(ctx, {
          event: "DEVICE_APPROVED",
          meta: {
            deviceId: device._id,
            reason: "POLICY_DISABLED",
          },
          userId: device.userId,
        });
      }
    }

    return {
      autoApproved,
      policyVersion: nextPolicyVersion,
      requireDeviceApproval: args.requireDeviceApproval,
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
