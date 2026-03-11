import { query, mutation, action } from "../../_generated/server";
import { v } from "convex/values";

/**
 * List all cron jobs.
 */
export const listJobs = query({
    args: { enabled: v.optional(v.boolean()) },
    returns: v.array(
        v.object({
            _id: v.id("cronJobs"),
            _creationTime: v.number(),
            runtimeJobId: v.optional(v.string()),
            name: v.string(),
            description: v.optional(v.string()),
            agentId: v.optional(v.string()),
            schedule: v.string(),
            interval: v.optional(v.string()),
            prompt: v.optional(v.string()),
            delivery: v.optional(v.string()),
            enabled: v.boolean(),
            isolated: v.optional(v.boolean()),
            deleteAfterRun: v.optional(v.boolean()),
            sessionTarget: v.optional(v.string()),
            wakeMode: v.optional(v.string()),
            failureAlert: v.optional(v.boolean()),
            source: v.optional(v.string()),
            lastRunAt: v.optional(v.number()),
            lastRunStatus: v.optional(v.string()),
            nextRunAt: v.optional(v.number()),
        })
    ),
    handler: async (ctx, args) => {
        let jobs = await ctx.db.query("cronJobs").order("desc").take(100);
        if (args.enabled !== undefined) {
            jobs = jobs.filter((job) => job.enabled === args.enabled);
        }
        return jobs.map((j) => ({
            _id: j._id,
            _creationTime: j._creationTime,
            runtimeJobId: j.runtimeJobId,
            name: j.name,
            description: j.description,
            agentId: j.agentId,
            schedule: j.schedule,
            interval: j.interval,
            prompt: j.prompt,
            delivery: j.delivery,
            enabled: j.enabled,
            isolated: j.isolated,
            deleteAfterRun: j.deleteAfterRun,
            sessionTarget: j.sessionTarget,
            wakeMode: j.wakeMode,
            failureAlert: j.failureAlert,
            source: j.source,
            lastRunAt: j.lastRunAt,
            lastRunStatus: j.lastRunStatus,
            nextRunAt: j.nextRunAt,
        }));
    },
});

/**
 * Get a single job by ID.
 */
export const getJob = query({
    args: { id: v.id("cronJobs") },
    returns: v.union(
        v.object({
            _id: v.id("cronJobs"),
            _creationTime: v.number(),
            runtimeJobId: v.optional(v.string()),
            name: v.string(),
            description: v.optional(v.string()),
            agentId: v.optional(v.string()),
            schedule: v.string(),
            interval: v.optional(v.string()),
            intervalMs: v.optional(v.number()),
            cronExpression: v.optional(v.string()),
            prompt: v.optional(v.string()),
            delivery: v.optional(v.string()),
            enabled: v.boolean(),
            isolated: v.optional(v.boolean()),
            deleteAfterRun: v.optional(v.boolean()),
            sessionTarget: v.optional(v.string()),
            wakeMode: v.optional(v.string()),
            failureAlert: v.optional(v.boolean()),
            source: v.optional(v.string()),
            nextRunAt: v.optional(v.number()),
        }),
        v.null()
    ),
    handler: async (ctx, args) => {
        const job = await ctx.db.get(args.id);
        if (!job) return null;
        return {
            _id: job._id,
            _creationTime: job._creationTime,
            runtimeJobId: job.runtimeJobId,
            name: job.name,
            description: job.description,
            agentId: job.agentId,
            schedule: job.schedule,
            interval: job.interval,
            intervalMs: job.intervalMs,
            cronExpression: job.cronExpression,
            prompt: job.prompt,
            delivery: job.delivery,
            enabled: job.enabled,
            isolated: job.isolated,
            deleteAfterRun: job.deleteAfterRun,
            sessionTarget: job.sessionTarget,
            wakeMode: job.wakeMode,
            failureAlert: job.failureAlert,
            source: job.source,
            nextRunAt: job.nextRunAt,
        };
    },
});

/**
 * Create a new cron job.
 */
export const createJob = mutation({
    args: {
        name: v.string(),
        description: v.optional(v.string()),
        agentId: v.optional(v.string()),
        schedule: v.string(),
        interval: v.optional(v.string()),
        intervalMs: v.optional(v.number()),
        cronExpression: v.optional(v.string()),
        prompt: v.optional(v.string()),
        delivery: v.optional(v.string()),
        enabled: v.boolean(),
        isolated: v.optional(v.boolean()),
        tenantId: v.optional(v.string()),
        source: v.optional(v.string()),
    },
    returns: v.id("cronJobs"),
    handler: async (ctx, args) => {
        const now = Date.now();
        return await ctx.db.insert("cronJobs", {
            ...args,
            source: args.source ?? "manual",
            runCount: 0,
            createdAt: now,
            updatedAt: now,
        });
    },
});

/**
 * Update an existing cron job.
 */
export const updateJob = mutation({
    args: {
        id: v.id("cronJobs"),
        name: v.optional(v.string()),
        description: v.optional(v.string()),
        agentId: v.optional(v.string()),
        schedule: v.optional(v.string()),
        interval: v.optional(v.string()),
        intervalMs: v.optional(v.number()),
        prompt: v.optional(v.string()),
        delivery: v.optional(v.string()),
        enabled: v.optional(v.boolean()),
        isolated: v.optional(v.boolean()),
    },
    returns: v.null(),
    handler: async (ctx, args) => {
        const { id, ...rest } = args;
        const updates: Record<string, unknown> = { updatedAt: Date.now() };
        for (const [key, val] of Object.entries(rest)) {
            if (val !== undefined) updates[key] = val;
        }
        await ctx.db.patch(id, updates);
        return null;
    },
});

/**
 * Bulk-sync cron jobs from OpenClaw runtime store.
 */
export const syncRuntimeJobs = mutation({
    args: {
        jobs: v.array(
            v.object({
                runtimeJobId: v.string(),
                name: v.string(),
                description: v.optional(v.string()),
                agentId: v.optional(v.string()),
                schedule: v.string(),
                interval: v.optional(v.string()),
                intervalMs: v.optional(v.number()),
                cronExpression: v.optional(v.string()),
                prompt: v.optional(v.string()),
                delivery: v.optional(v.string()),
                enabled: v.boolean(),
                isolated: v.optional(v.boolean()),
                deleteAfterRun: v.optional(v.boolean()),
                sessionTarget: v.optional(v.string()),
                wakeMode: v.optional(v.string()),
                failureAlert: v.optional(v.boolean()),
                lastRunAt: v.optional(v.number()),
                lastRunStatus: v.optional(v.string()),
                nextRunAt: v.optional(v.number()),
                runCount: v.optional(v.number()),
                tenantId: v.optional(v.string()),
                source: v.optional(v.string()),
                createdAt: v.optional(v.number()),
                updatedAt: v.optional(v.number()),
            })
        ),
    },
    returns: v.object({ upserted: v.number(), deleted: v.number() }),
    handler: async (ctx, args) => {
        let upserted = 0;
        let deleted = 0;
        const seen = new Set<string>();
        const tenantIds = new Set<string>();
        const now = Date.now();

        for (const job of args.jobs) {
            const tenantId = job.tenantId;
            if (tenantId) {
                tenantIds.add(tenantId);
            }
            seen.add(`${tenantId ?? ""}::${job.runtimeJobId}`);

            const existing = tenantId
                ? await ctx.db
                      .query("cronJobs")
                      .withIndex("by_tenant_runtimeJobId", (q) =>
                          q.eq("tenantId", tenantId).eq("runtimeJobId", job.runtimeJobId)
                      )
                      .first()
                : await ctx.db
                      .query("cronJobs")
                      .withIndex("by_runtimeJobId", (q) => q.eq("runtimeJobId", job.runtimeJobId))
                      .first();

            const payload = {
                ...job,
                source: job.source ?? "openclaw-runtime",
                createdAt: job.createdAt ?? existing?.createdAt ?? now,
                updatedAt: job.updatedAt ?? now,
            };

            if (existing) {
                await ctx.db.patch(existing._id, payload);
            } else {
                await ctx.db.insert("cronJobs", payload);
            }
            upserted++;
        }

        for (const tenantId of tenantIds) {
            const existingJobs = await ctx.db
                .query("cronJobs")
                .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
                .collect();
            for (const job of existingJobs) {
                if (job.source !== "openclaw-runtime" || !job.runtimeJobId) {
                    continue;
                }
                if (!seen.has(`${tenantId}::${job.runtimeJobId}`)) {
                    await ctx.db.delete(job._id);
                    deleted++;
                }
            }
        }

        return { upserted, deleted };
    },
});

/**
 * Delete a cron job.
 */
export const deleteJob = mutation({
    args: { id: v.id("cronJobs") },
    returns: v.null(),
    handler: async (ctx, args) => {
        await ctx.db.delete(args.id);
        return null;
    },
});

/**
 * List run history for a job.
 */
export const listRuns = query({
    args: { jobId: v.optional(v.id("cronJobs")), limit: v.optional(v.number()) },
    returns: v.array(
        v.object({
            _id: v.id("cronRuns"),
            _creationTime: v.number(),
            jobId: v.id("cronJobs"),
            jobName: v.string(),
            status: v.string(),
            startedAt: v.number(),
            finishedAt: v.optional(v.number()),
            durationMs: v.optional(v.number()),
            summary: v.optional(v.string()),
            error: v.optional(v.string()),
            tokensUsed: v.optional(v.number()),
        })
    ),
    handler: async (ctx, args) => {
        const takeCount = args.limit ?? 50;
        let q;
        if (args.jobId) {
            q = ctx.db
                .query("cronRuns")
                .withIndex("by_job", (idx) => idx.eq("jobId", args.jobId!))
                .order("desc");
        } else {
            q = ctx.db.query("cronRuns").order("desc");
        }
        const runs = await q.take(takeCount);
        return runs.map((r) => ({
            _id: r._id,
            _creationTime: r._creationTime,
            jobId: r.jobId,
            jobName: r.jobName,
            status: r.status,
            startedAt: r.startedAt,
            finishedAt: r.finishedAt,
            durationMs: r.durationMs,
            summary: r.summary,
            error: r.error,
            tokensUsed: r.tokensUsed,
        }));
    },
});

/**
 * Trigger an immediate cron run.
 */
export const triggerRun = action({
    args: { jobId: v.id("cronJobs") },
    returns: v.null(),
    handler: async (ctx, args) => {
        console.log(`Manually triggering cron job: ${args.jobId}`);
        return null;
    },
});
