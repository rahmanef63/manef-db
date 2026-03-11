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
