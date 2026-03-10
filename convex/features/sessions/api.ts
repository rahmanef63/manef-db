import { query, mutation, action } from "../../_generated/server";
import { v } from "convex/values";
import { api } from "../../_generated/api";

/**
 * Returns latest active sessions.
 */
export const getSessions = query({
    args: { limit: v.optional(v.number()) },
    returns: v.array(
        v.object({
            _id: v.id("sessions"),
            sessionKey: v.string(),
            status: v.string(),
            messageCount: v.number(),
            lastActiveAt: v.number(),
        })
    ),
    handler: async (ctx, args) => {
        const takeCount = args.limit ?? 50;
        const sessions = await ctx.db.query("sessions").order("desc").take(takeCount);
        return sessions.map((s) => ({
            _id: s._id,
            sessionKey: s.sessionKey,
            status: s.status || "active",
            messageCount: s.messageCount || 0,
            lastActiveAt: s.lastActiveAt,
        }));
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
