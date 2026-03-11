import { query, mutation, action } from "../../_generated/server";
import { v } from "convex/values";
import { api } from "../../_generated/api";

/**
 * Returns latest active sessions.
 */
export const getSessions = query({
    args: {
        agentId: v.optional(v.string()),
        agentIds: v.optional(v.array(v.string())),
        activeWithinMinutes: v.optional(v.number()),
        includeUnknown: v.optional(v.boolean()),
        limit: v.optional(v.number())
    },
    returns: v.array(
        v.object({
            _id: v.id("sessions"),
            agentId: v.optional(v.string()),
            channel: v.optional(v.string()),
            sessionKey: v.string(),
            status: v.string(),
            messageCount: v.number(),
            lastActiveAt: v.number(),
        })
    ),
    handler: async (ctx, args) => {
        const takeCount = args.limit ?? 50;
        const sessions = await ctx.db.query("sessions").order("desc").take(takeCount);
        const allowedAgentIds = args.agentIds ? new Set(args.agentIds) : null;
        const activeCutoff = args.activeWithinMinutes
            ? Date.now() - args.activeWithinMinutes * 60 * 1000
            : null;
        return sessions.map((s) => ({
            _id: s._id,
            agentId: s.agentId,
            channel: s.channel,
            sessionKey: s.sessionKey,
            status: s.status || "active",
            messageCount: s.messageCount || 0,
            lastActiveAt: s.lastActiveAt,
        })).filter((session) => {
            if (args.agentId && session.agentId !== args.agentId) return false;
            if (allowedAgentIds && session.agentId && !allowedAgentIds.has(session.agentId)) return false;
            if (allowedAgentIds && !session.agentId && !args.includeUnknown) return false;
            if (!args.includeUnknown && !session.agentId) return false;
            if (activeCutoff && session.lastActiveAt < activeCutoff) return false;
            return true;
        });
    },
});

/**
 * Creates a new conversational session.
 */
export const createSession = mutation({
    args: { sessionKey: v.string(), tenantId: v.optional(v.string()) },
    returns: v.id("sessions"),
    handler: async (ctx, args) => {
        return await ctx.db.insert("sessions", {
            sessionKey: args.sessionKey,
            tenantId: args.tenantId,
            status: "active",
            messageCount: 0,
            lastActiveAt: Date.now(),
            createdAt: Date.now(),
        });
    },
});

/**
 * Bulk-sync runtime-mirrored sessions from OpenClaw local stores.
 */
export const syncRuntimeSessions = mutation({
    args: {
        sessions: v.array(
            v.object({
                sessionKey: v.string(),
                agentId: v.optional(v.string()),
                channel: v.optional(v.string()),
                status: v.optional(v.string()),
                messageCount: v.optional(v.number()),
                createdAt: v.number(),
                lastActiveAt: v.number(),
                tenantId: v.optional(v.string()),
                metadata: v.optional(v.any()),
            })
        ),
    },
    returns: v.object({ upserted: v.number(), deleted: v.number() }),
    handler: async (ctx, args) => {
        const now = Date.now();
        let upserted = 0;
        let deleted = 0;
        const seen = new Set<string>();
        const tenantIds = new Set<string>();

        for (const session of args.sessions) {
            if (session.tenantId) {
                tenantIds.add(session.tenantId);
            }
            seen.add(`${session.tenantId ?? ""}::${session.sessionKey}`);
            const existing = await ctx.db
                .query("sessions")
                .withIndex("by_sessionKey", (q) => q.eq("sessionKey", session.sessionKey))
                .first();
            const payload = {
                ...session,
                status: session.status ?? "active",
                messageCount: session.messageCount ?? 0,
                metadata: {
                    ...(existing?.metadata ?? {}),
                    ...(session.metadata ?? {}),
                    source: "openclaw-runtime",
                },
            };
            if (existing) {
                await ctx.db.patch(existing._id, payload);
            } else {
                await ctx.db.insert("sessions", payload);
            }
            upserted++;
        }

        for (const tenantId of tenantIds) {
            const existingSessions = await ctx.db
                .query("sessions")
                .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
                .collect();
            for (const session of existingSessions) {
                if (session.metadata?.source !== "openclaw-runtime") {
                    continue;
                }
                if (!seen.has(`${tenantId}::${session.sessionKey}`)) {
                    await ctx.db.delete(session._id);
                    deleted++;
                }
            }
        }

        void now;
        return { upserted, deleted };
    },
});

export const deleteSession = mutation({
    args: { id: v.id("sessions") },
    returns: v.null(),
    handler: async (ctx, args) => {
        await ctx.db.delete(args.id);
        return null;
    },
});

/**
 * Triggers a summary action for an active session.
 */
export const summarizeSession = action({
    args: { sessionId: v.id("sessions") },
    returns: v.null(),
    handler: async (ctx, args) => {
        console.log(`Summarizing session via LLM: ${args.sessionId}`);
        // Typically call OpenAI/Agents and then run mutation to log summary
        return null;
    },
});
