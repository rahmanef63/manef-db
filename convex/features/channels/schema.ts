import { defineTable } from "convex/server";
import { v } from "convex/values";

export const channelsSchema = {
    channels: defineTable({
        channelId: v.string(),
        type: v.string(), // "telegram" | "whatsapp" | "discord" | "signal"
        label: v.optional(v.string()),
        configured: v.boolean(),
        running: v.boolean(),
        linked: v.optional(v.boolean()),
        connected: v.optional(v.boolean()),
        mode: v.optional(v.string()), // "polling" | "webhook"
        lastStartAt: v.optional(v.float64()),
        lastStopAt: v.optional(v.float64()),
        lastProbeAt: v.optional(v.float64()),
        lastConnectAt: v.optional(v.float64()),
        lastMessageAt: v.optional(v.float64()),
        lastError: v.optional(v.string()),
        authAgeMs: v.optional(v.float64()),
        config: v.optional(v.any()),
        tenantId: v.optional(v.string()),
        createdAt: v.float64(),
        updatedAt: v.float64(),
    })
        .index("by_channelId", ["channelId"])
        .index("by_type", ["type"])
        .index("by_tenant", ["tenantId"]),

    channelAllowList: defineTable({
        channelId: v.string(),
        pattern: v.string(),
        tenantId: v.optional(v.string()),
        createdAt: v.float64(),
    })
        .index("by_channelId", ["channelId"])
        .index("by_tenant", ["tenantId"]),

    workspaceChannelBindings: defineTable({
        access: v.optional(v.string()),
        agentId: v.optional(v.string()),
        channelId: v.string(),
        createdAt: v.float64(),
        source: v.optional(v.string()),
        tenantId: v.optional(v.string()),
        updatedAt: v.float64(),
        workspaceId: v.id("workspaceTrees"),
    })
        .index("by_channel", ["channelId"])
        .index("by_workspace", ["workspaceId"])
        .index("by_channel_workspace", ["channelId", "workspaceId"])
        .index("by_tenant", ["tenantId"]),

    identityWorkspaceBindings: defineTable({
        access: v.optional(v.string()),
        agentId: v.optional(v.string()),
        channel: v.string(),
        createdAt: v.float64(),
        externalUserId: v.string(),
        normalizedPhone: v.optional(v.string()),
        source: v.optional(v.string()),
        tenantId: v.optional(v.string()),
        updatedAt: v.float64(),
        userId: v.optional(v.id("userProfiles")),
        workspaceId: v.id("workspaceTrees"),
    })
        .index("by_channel_external", ["channel", "externalUserId"])
        .index("by_user", ["userId"])
        .index("by_workspace", ["workspaceId"])
        .index("by_workspace_channel_external", ["workspaceId", "channel", "externalUserId"])
        .index("by_tenant", ["tenantId"]),

    channelBindingPolicies: defineTable({
        channelId: v.string(),
        createdAt: v.float64(),
        mode: v.string(),
        primaryWorkspaceId: v.optional(v.id("workspaceTrees")),
        source: v.optional(v.string()),
        tenantId: v.optional(v.string()),
        updatedAt: v.float64(),
    })
        .index("by_channel", ["channelId"])
        .index("by_tenant", ["tenantId"]),
};
