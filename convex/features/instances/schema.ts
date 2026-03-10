import { defineTable } from "convex/server";
import { v } from "convex/values";

export const instancesSchema = {
    instances: defineTable({
        instanceId: v.string(),
        name: v.string(),
        info: v.optional(v.string()),
        tags: v.optional(v.array(v.string())),
        platform: v.optional(v.string()),
        arch: v.optional(v.string()),
        version: v.optional(v.string()),
        role: v.optional(v.string()), // "gateway" | "webchat" | "operator"
        scopes: v.optional(v.array(v.string())),
        lastSeenAt: v.float64(),
        lastInputAt: v.optional(v.float64()),
        reason: v.optional(v.string()),
        tenantId: v.optional(v.string()),
        createdAt: v.float64(),
    })
        .index("by_instanceId", ["instanceId"])
        .index("by_tenant", ["tenantId"])
        .index("by_lastSeen", ["lastSeenAt"]),
};
