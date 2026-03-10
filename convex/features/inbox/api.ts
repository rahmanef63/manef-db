import { query, mutation, action } from "../../_generated/server";
import { v } from "convex/values";
import { api } from "../../_generated/api";

/**
 * Returns inbox messages for the current user.
 */
export const getMessages = query({
    args: {},
    returns: v.array(
        v.object({
            _id: v.id("inboxMessages"),
            sender: v.string(),
            subject: v.string(),
            content: v.string(),
            isRead: v.boolean(),
            receivedAt: v.number(),
        })
    ),
    handler: async (ctx) => {
        const messages = await ctx.db.query("inboxMessages").order("desc").take(50);
        return messages.map((m) => ({
            _id: m._id,
            sender: m.sender,
            subject: m.subject,
            content: m.content,
            isRead: m.isRead,
            receivedAt: m.receivedAt,
        }));
    },
});

/**
 * Marks a message as read.
 */
export const markAsRead = mutation({
    args: { messageId: v.id("inboxMessages") },
    returns: v.null(),
    handler: async (ctx, args) => {
        await ctx.db.patch(args.messageId, { isRead: true });
        return null;
    },
});

/**
 * Triggers an external email sync (mock action).
 */
export const syncEmails = action({
    args: {},
    returns: v.null(),
    handler: async (ctx) => {
        console.log("Syncing emails...");
        return null;
    },
});
