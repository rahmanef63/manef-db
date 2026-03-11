import { query, mutation, action } from "../../_generated/server";
import { v } from "convex/values";

/**
 * Get usage records for a date range.
 */
export const getUsage = query({
    args: {
        startDate: v.optional(v.string()),
        endDate: v.optional(v.string()),
        agentId: v.optional(v.string()),
        agentIds: v.optional(v.array(v.string())),
        limit: v.optional(v.number()),
    },
    returns: v.array(
        v.object({
            _id: v.id("usageRecords"),
            _creationTime: v.number(),
            sessionKey: v.string(),
            agentId: v.optional(v.string()),
            model: v.optional(v.string()),
            inputTokens: v.number(),
            outputTokens: v.number(),
            totalTokens: v.number(),
            estimatedCost: v.optional(v.number()),
            date: v.string(),
            timestamp: v.number(),
            hasErrors: v.optional(v.boolean()),
        })
    ),
    handler: async (ctx, args) => {
        const takeCount = args.limit ?? 200;
        const records = await ctx.db
            .query("usageRecords")
            .order("desc")
            .take(takeCount);
        const allowedAgentIds = args.agentIds ? new Set(args.agentIds) : null;

        return records
            .filter((r) => {
                if (args.startDate && r.date < args.startDate) return false;
                if (args.endDate && r.date > args.endDate) return false;
                if (args.agentId && r.agentId !== args.agentId) return false;
                if (allowedAgentIds && (!r.agentId || !allowedAgentIds.has(r.agentId))) return false;
                return true;
            })
            .map((r) => ({
                _id: r._id,
                _creationTime: r._creationTime,
                sessionKey: r.sessionKey,
                agentId: r.agentId,
                model: r.model,
                inputTokens: r.inputTokens,
                outputTokens: r.outputTokens,
                totalTokens: r.totalTokens,
                estimatedCost: r.estimatedCost,
                date: r.date,
                timestamp: r.timestamp,
                hasErrors: r.hasErrors,
            }));
    },
});

/**
 * Get daily aggregated usage.
 */
export const getDailySummary = query({
    args: {
        agentIds: v.optional(v.array(v.string())),
        startDate: v.optional(v.string()),
        endDate: v.optional(v.string()),
    },
    returns: v.array(
        v.object({
            date: v.string(),
            totalTokens: v.number(),
            totalCost: v.number(),
            sessionCount: v.number(),
            errorCount: v.number(),
        })
    ),
    handler: async (ctx, args) => {
        const records = await ctx.db
            .query("usageRecords")
            .order("desc")
            .take(1000);
        const allowedAgentIds = args.agentIds ? new Set(args.agentIds) : null;

        const dailyMap: Record<
            string,
            { tokens: number; cost: number; sessions: number; errors: number }
        > = {};

        for (const r of records) {
            if (args.startDate && r.date < args.startDate) continue;
            if (args.endDate && r.date > args.endDate) continue;
            if (allowedAgentIds && (!r.agentId || !allowedAgentIds.has(r.agentId))) continue;

            if (!dailyMap[r.date]) {
                dailyMap[r.date] = { tokens: 0, cost: 0, sessions: 0, errors: 0 };
            }
            dailyMap[r.date].tokens += r.totalTokens;
            dailyMap[r.date].cost += r.estimatedCost ?? 0;
            dailyMap[r.date].sessions += 1;
            if (r.hasErrors) dailyMap[r.date].errors += 1;
        }

        return Object.entries(dailyMap)
            .map(([date, data]) => ({
                date,
                totalTokens: data.tokens,
                totalCost: data.cost,
                sessionCount: data.sessions,
                errorCount: data.errors,
            }))
            .sort((a, b) => b.date.localeCompare(a.date));
    },
});

/**
 * Record a usage event.
 */
export const recordUsage = mutation({
    args: {
        sessionKey: v.string(),
        agentId: v.optional(v.string()),
        model: v.optional(v.string()),
        inputTokens: v.number(),
        outputTokens: v.number(),
        totalTokens: v.number(),
        estimatedCost: v.optional(v.number()),
        hasErrors: v.optional(v.boolean()),
        tenantId: v.optional(v.string()),
    },
    returns: v.id("usageRecords"),
    handler: async (ctx, args) => {
        const now = Date.now();
        const date = new Date(now).toISOString().split("T")[0];
        return await ctx.db.insert("usageRecords", {
            ...args,
            date,
            timestamp: now,
        });
    },
});

/**
 * Export usage data.
 */
export const exportUsage = action({
    args: {
        agentIds: v.optional(v.array(v.string())),
        startDate: v.optional(v.string()),
        endDate: v.optional(v.string())
    },
    returns: v.null(),
    handler: async (ctx, args) => {
        console.log(`Exporting usage data: ${args.startDate} to ${args.endDate}`);
        return null;
    },
});
