import { defineTable } from "convex/server";
import { v } from "convex/values";

export const usersSchema = {
    notifications: defineTable({
        actionUrl: v.optional(v.string()),
        createdAt: v.float64(),
        message: v.string(),
        read: v.boolean(),
        readAt: v.optional(v.float64()),
        tenantId: v.optional(v.string()),
        title: v.string(),
        type: v.string(),
        userId: v.id("userProfiles"),
    })
        .index("by_tenant", ["tenantId"])
        .index("by_user", ["userId"])
        .index("by_user_read", ["userId", "read"])
        .index("by_user_time", ["userId", "createdAt"]),
    permissionLogs: defineTable({
        action: v.string(),
        metadata: v.optional(v.any()),
        performedBy: v.optional(v.id("userProfiles")),
        resource: v.optional(v.string()),
        roleId: v.optional(v.id("roles")),
        tenantId: v.optional(v.string()),
        timestamp: v.float64(),
        userId: v.id("userProfiles"),
    })
        .index("by_tenant", ["tenantId"])
        .index("by_timestamp", ["timestamp"])
        .index("by_user", ["userId"])
        .index("by_user_time", ["userId", "timestamp"]),
    agentRoles: defineTable({
        createdAt: v.float64(),
        description: v.optional(v.string()),
        displayName: v.string(),
        isSystem: v.boolean(),
        level: v.float64(),
        name: v.string(),
        permissions: v.array(v.string()),
        tenantId: v.optional(v.string()),
        updatedAt: v.float64(),
    })
        .index("by_level", ["level"])
        .index("by_name", ["name"])
        .index("by_tenant", ["tenantId"]),
    userIdentities: defineTable({
        channel: v.string(),
        confidence: v.optional(v.float64()),
        createdAt: v.float64(),
        externalUserId: v.string(),
        metadata: v.optional(v.any()),
        updatedAt: v.float64(),
        userId: v.id("userProfiles"),
        verified: v.optional(v.boolean()),
    })
        .index("by_channel", ["channel"])
        .index("by_channel_external", [
            "channel",
            "externalUserId",
        ])
        .index("by_user", ["userId"]),
    userProfiles: defineTable({
        createdAt: v.float64(),
        email: v.optional(v.string()),
        labels: v.optional(v.array(v.string())),
        language: v.optional(v.string()),
        name: v.optional(v.string()),
        nickname: v.optional(v.string()),
        phone: v.optional(v.string()),
        preferences: v.optional(
            v.object({
                notifications: v.optional(v.boolean()),
                quietHours: v.optional(
                    v.object({
                        end: v.optional(v.string()),
                        start: v.optional(v.string()),
                    })
                ),
                voiceResponse: v.optional(v.boolean()),
            })
        ),
        profession: v.optional(v.string()),
        profileUrls: v.optional(
            v.array(
                v.object({ type: v.string(), url: v.string() })
            )
        ),
        tenantId: v.optional(v.string()),
        timezone: v.optional(v.string()),
        updatedAt: v.float64(),
    })
        .index("by_email", ["email"])
        .index("by_phone", ["phone"])
        .index("by_tenant", ["tenantId"]),
    userRoles: defineTable({
        expiresAt: v.optional(v.float64()),
        grantedAt: v.float64(),
        grantedBy: v.optional(v.id("userProfiles")),
        isActive: v.boolean(),
        roleId: v.id("roles"),
        tenantId: v.optional(v.string()),
        userId: v.id("userProfiles"),
    })
        .index("by_role", ["roleId"])
        .index("by_tenant", ["tenantId"])
        .index("by_user", ["userId"])
        .index("by_user_role", ["userId", "roleId"]),
};
