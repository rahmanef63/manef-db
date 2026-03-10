import { defineTable } from "convex/server";
import { v } from "convex/values";

export const cronsSchema = {
    cronJobs: defineTable({
        name: v.string(),
        description: v.optional(v.string()),
        agentId: v.optional(v.string()),
        schedule: v.string(),     // "every" | "cron"
        interval: v.optional(v.string()),  // "30m" | "1h" | "1d"
        intervalMs: v.optional(v.float64()),
        cronExpression: v.optional(v.string()),
        prompt: v.optional(v.string()),
        delivery: v.optional(v.string()),  // "announce" | "silent"
        enabled: v.boolean(),
        isolated: v.optional(v.boolean()),
        lastRunAt: v.optional(v.float64()),
        lastRunStatus: v.optional(v.string()),
        nextRunAt: v.optional(v.float64()),
        runCount: v.optional(v.float64()),
        tenantId: v.optional(v.string()),
        createdAt: v.float64(),
        updatedAt: v.float64(),
    })
        .index("by_enabled", ["enabled"])
        .index("by_agentId", ["agentId"])
        .index("by_nextRun", ["nextRunAt"])
        .index("by_tenant", ["tenantId"]),

    cronRuns: defineTable({
        jobId: v.id("cronJobs"),
        jobName: v.string(),
        status: v.string(),  // "success" | "error" | "running" | "skipped"
        startedAt: v.float64(),
        finishedAt: v.optional(v.float64()),
        durationMs: v.optional(v.float64()),
        summary: v.optional(v.string()),
        error: v.optional(v.string()),
        tokensUsed: v.optional(v.float64()),
        tenantId: v.optional(v.string()),
    })
        .index("by_job", ["jobId"])
        .index("by_status", ["status"])
        .index("by_startedAt", ["startedAt"])
        .index("by_tenant", ["tenantId"]),
};
