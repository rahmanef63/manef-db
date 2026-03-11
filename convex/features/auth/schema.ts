import { defineTable } from "convex/server";
import { v } from "convex/values";

const authUserStatus = v.union(
  v.literal("active"),
  v.literal("blocked")
);

const authDeviceStatus = v.union(
  v.literal("approved"),
  v.literal("pending"),
  v.literal("revoked")
);

const authAuditEvent = v.union(
  v.literal("LOGIN_ATTEMPT"),
  v.literal("DEVICE_PENDING"),
  v.literal("DEVICE_APPROVED"),
  v.literal("DEVICE_REVOKED"),
  v.literal("BOOTSTRAP_DEVICE_APPROVED"),
  v.literal("LOGIN_SUCCESS"),
  v.literal("LOGIN_DENIED"),
  v.literal("SESSION_REVOKED"),
  v.literal("SESSIONS_REVOKED")
);

export const authSchema = {
  authUsers: defineTable({
    email: v.string(),
    name: v.string(),
    passwordHash: v.optional(v.string()),
    phone: v.optional(v.string()),
    profileId: v.optional(v.id("userProfiles")),
    roles: v.array(v.string()),
    sessionVersion: v.number(),
    status: authUserStatus,
    createdAt: v.float64(),
    updatedAt: v.float64(),
  })
    .index("by_email", ["email"])
    .index("by_phone", ["phone"])
    .index("by_profile", ["profileId"]),

  authIdentities: defineTable({
    lastLoginAt: v.optional(v.float64()),
    provider: v.string(),
    providerAccountId: v.string(),
    userId: v.id("authUsers"),
  })
    .index("by_user", ["userId"])
    .index("by_provider_account", ["provider", "providerAccountId"]),

  authDevices: defineTable({
    approvedAt: v.optional(v.float64()),
    approvedBy: v.optional(v.string()),
    deviceHash: v.string(),
    firstSeenAt: v.float64(),
    label: v.optional(v.string()),
    lastSeenAt: v.float64(),
    lastSeenIp: v.optional(v.string()),
    lastSeenUserAgent: v.optional(v.string()),
    riskScore: v.number(),
    status: authDeviceStatus,
    userId: v.id("authUsers"),
  })
    .index("by_user", ["userId"])
    .index("by_user_device", ["userId", "deviceHash"])
    .index("by_user_status", ["userId", "status"])
    .index("by_status", ["status"]),

  authSessions: defineTable({
    deviceId: v.id("authDevices"),
    expiresAt: v.float64(),
    ip: v.optional(v.string()),
    policyVersion: v.number(),
    revokedAt: v.optional(v.float64()),
    revokedBy: v.optional(v.string()),
    sessionTokenHash: v.string(),
    userAgent: v.optional(v.string()),
    userId: v.id("authUsers"),
  })
    .index("by_user", ["userId"])
    .index("by_user_expires", ["userId", "expiresAt"])
    .index("by_user_revoked", ["userId", "revokedAt"])
    .index("by_session_token_hash", ["sessionTokenHash"]),

  authAuditLogs: defineTable({
    createdAt: v.float64(),
    event: authAuditEvent,
    meta: v.optional(v.any()),
    userId: v.optional(v.id("authUsers")),
  })
    .index("by_user", ["userId"])
    .index("by_user_created", ["userId", "createdAt"])
    .index("by_created", ["createdAt"]),

  authServiceNonces: defineTable({
    createdAt: v.float64(),
    expiresAt: v.float64(),
    nonceHash: v.string(),
    requestMethod: v.string(),
    requestPath: v.string(),
  })
    .index("by_nonce_hash", ["nonceHash"])
    .index("by_expires", ["expiresAt"]),

  authPolicies: defineTable({
    allowBootstrapAutoApprove: v.boolean(),
    allowedEmailDomains: v.array(v.string()),
    bootstrapCompletedAt: v.optional(v.float64()),
    isActive: v.boolean(),
    maxSessionsPerUser: v.number(),
    name: v.string(),
    policyVersion: v.number(),
    refreshTtlDays: v.number(),
    requireDeviceApproval: v.boolean(),
    sessionTtlMinutes: v.number(),
    stepUpForNewGeo: v.boolean(),
    trustedNetworks: v.array(v.string()),
    updatedAt: v.float64(),
  })
    .index("by_active", ["isActive"])
    .index("by_name", ["name"]),
};
