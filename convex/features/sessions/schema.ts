import { defineTable } from "convex/server";
import { v } from "convex/values";

export const sessionsSchema = {
    agentSessions: defineTable({
        agentId: v.string(),
        channel: v.optional(v.string()),
        convexSessionId: v.optional(v.id("sessions")),
        endedAt: v.optional(v.float64()),
        messageCount: v.optional(v.float64()),
        metadata: v.optional(v.any()),
        model: v.optional(v.string()),
        sessionId: v.string(),
        startedAt: v.float64(),
        status: v.string(),
        tokenUsage: v.optional(
            v.object({
                input: v.float64(),
                output: v.float64(),
                total: v.float64(),
            })
        ),
        userId: v.optional(v.id("userProfiles")),
    })
        .index("by_agent", ["agentId"])
        .index("by_agent_status", ["agentId", "status"])
        .index("by_convexSession", ["convexSessionId"])
        .index("by_sessionId", ["sessionId"])
        .index("by_status", ["status"])
        .index("by_user", ["userId"]),
    agentMessages: defineTable({
        agentId: v.optional(v.string()),
        content: v.string(),
        externalId: v.optional(v.string()),
        metadata: v.optional(v.any()),
        role: v.string(),
        sessionId: v.id("sessions"),
        tenantId: v.optional(v.string()),
        timestamp: v.float64(),
        tokenCount: v.optional(v.float64()),
    })
        .index("by_agent", ["agentId"])
        .index("by_session", ["sessionId"])
        .index("by_session_role", ["sessionId", "role"])
        .index("by_session_time", ["sessionId", "timestamp"])
        .index("by_tenant", ["tenantId"]),
    sessionSummaries: defineTable({
        agentId: v.optional(v.string()),
        checksum: v.optional(v.string()),
        constraints: v.optional(v.array(v.string())),
        createdAt: v.float64(),
        decisions: v.optional(v.array(v.string())),
        entities: v.optional(v.array(v.string())),
        firstMessageAt: v.optional(v.float64()),
        intent: v.optional(v.string()),
        keyFacts: v.optional(v.array(v.string())),
        lastMessageAt: v.optional(v.float64()),
        lastResolvedAt: v.optional(v.float64()),
        messageCount: v.optional(v.float64()),
        openTodos: v.optional(v.array(v.string())),
        pendingActions: v.optional(v.array(v.string())),
        sessionId: v.id("sessions"),
        source: v.optional(v.string()),
        sourceMessageRange: v.optional(
            v.object({
                from: v.optional(v.float64()),
                to: v.optional(v.float64()),
            })
        ),
        summary: v.string(),
        summaryVersion: v.optional(v.float64()),
        updatedAt: v.float64(),
    })
        .index("by_agent", ["agentId"])
        .index("by_session", ["sessionId"])
        .index("by_session_updated", [
            "sessionId",
            "updatedAt",
        ]),
    sessions: defineTable({
        agentId: v.optional(v.string()),
        channel: v.optional(v.string()),
        createdAt: v.float64(),
        lastActiveAt: v.float64(),
        messageCount: v.optional(v.float64()),
        metadata: v.optional(v.any()),
        model: v.optional(v.string()),
        sessionKey: v.string(),
        status: v.optional(v.string()),
        tenantId: v.optional(v.string()),
        userId: v.optional(v.id("userProfiles")),
    })
        .index("by_agent", ["agentId"])
        .index("by_agent_channel", ["agentId", "channel"])
        .index("by_agent_status", ["agentId", "status"])
        .index("by_channel", ["channel"])
        .index("by_sessionKey", ["sessionKey"])
        .index("by_tenant", ["tenantId"])
        .index("by_user", ["userId"]),
};
