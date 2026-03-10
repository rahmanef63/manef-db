import { defineTable } from "convex/server";
import { v } from "convex/values";

export const knowledgeSchema = {
    memories: defineTable({
        accessCount: v.optional(v.float64()),
        agentId: v.optional(v.string()),
        category: v.string(),
        context: v.optional(v.string()),
        createdAt: v.float64(),
        importance: v.optional(v.float64()),
        key: v.string(),
        lastAccessedAt: v.optional(v.float64()),
        source: v.optional(v.string()),
        tenantId: v.optional(v.string()),
        userId: v.optional(v.id("userProfiles")),
        value: v.string(),
    })
        .index("by_agent", ["agentId"])
        .index("by_agent_category", ["agentId", "category"])
        .index("by_key", ["key"])
        .index("by_tenant", ["tenantId"])
        .index("by_user", ["userId"])
        .index("by_user_category", ["userId", "category"]),
    vectorChunks: defineTable({
        agentId: v.optional(v.string()),
        createdAt: v.float64(),
        dimensions: v.float64(),
        embedding: v.array(v.float64()),
        kind: v.string(),
        metadata: v.optional(v.any()),
        ownerId: v.optional(v.id("userProfiles")),
        sessionId: v.optional(v.id("sessions")),
        sourceId: v.string(),
        tenantId: v.optional(v.string()),
        text: v.string(),
        updatedAt: v.float64(),
    })
        .index("by_agent", ["agentId"])
        .index("by_kind", ["kind"])
        .index("by_kind_session", ["kind", "sessionId"])
        .index("by_owner", ["ownerId"])
        .index("by_session", ["sessionId"])
        .index("by_source", ["sourceId"])
        .index("by_tenant", ["tenantId"])
        .index("by_tenant_agent", ["tenantId", "agentId"])
        .index("by_tenant_session", ["tenantId", "sessionId"]),
};
