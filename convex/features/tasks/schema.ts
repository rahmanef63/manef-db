import { defineTable } from "convex/server";
import { v } from "convex/values";

export const tasksSchema = {
    dailyNotes: defineTable({
        agentId: v.optional(v.string()),
        content: v.string(),
        createdAt: v.float64(),
        date: v.string(),
        summary: v.optional(v.string()),
        tags: v.optional(v.array(v.string())),
        tenantId: v.optional(v.string()),
        updatedAt: v.float64(),
        userId: v.optional(v.id("userProfiles")),
    })
        .index("by_agent", ["agentId"])
        .index("by_agent_date", ["agentId", "date"])
        .index("by_date", ["date"])
        .index("by_tenant", ["tenantId"])
        .index("by_user", ["userId"]),
    heartbeatTasks: defineTable({
        agentId: v.optional(v.string()),
        config: v.optional(v.any()),
        createdAt: v.float64(),
        description: v.string(),
        enabled: v.boolean(),
        lastResult: v.optional(v.string()),
        lastRun: v.optional(v.float64()),
        nextRun: v.optional(v.float64()),
        schedule: v.optional(v.string()),
        taskId: v.string(),
        tenantId: v.optional(v.string()),
        updatedAt: v.float64(),
    })
        .index("by_agent", ["agentId"])
        .index("by_agent_enabled", ["agentId", "enabled"])
        .index("by_enabled", ["enabled"])
        .index("by_taskId", ["taskId"])
        .index("by_tenant", ["tenantId"]),
    tasks: defineTable({
        agentId: v.optional(v.string()),
        createdAt: v.float64(),
        dueAt: v.optional(v.float64()),
        payload: v.optional(v.any()),
        priority: v.optional(v.string()),
        result: v.optional(v.any()),
        sessionId: v.optional(v.id("sessions")),
        status: v.string(),
        tenantId: v.optional(v.string()),
        title: v.string(),
        updatedAt: v.float64(),
        userId: v.optional(v.id("userProfiles")),
    })
        .index("by_agent", ["agentId"])
        .index("by_session", ["sessionId"])
        .index("by_tenant", ["tenantId"])
        .index("by_tenant_status", ["tenantId", "status"])
        .index("by_user", ["userId"]),
};
