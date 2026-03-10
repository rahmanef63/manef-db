import { query, mutation, action } from "../../_generated/server";
import { v } from "convex/values";
import { api } from "../../_generated/api";

/**
 * Returns a list of calendar events for a specific user.
 */
export const getEvents = query({
    args: {},
    returns: v.array(
        v.object({
            _id: v.id("calendarEvents"),
            title: v.string(),
            description: v.optional(v.string()),
            startTime: v.number(),
            endTime: v.number(),
            isAllDay: v.boolean(),
        })
    ),
    handler: async (ctx) => {
        const events = await ctx.db.query("calendarEvents").order("desc").take(50);
        return events.map((e) => ({
            _id: e._id,
            title: e.title,
            description: e.description,
            startTime: e.startTime,
            endTime: e.endTime,
            isAllDay: e.isAllDay,
        }));
    },
});

/**
 * Creates a new calendar event.
 */
export const createEvent = mutation({
    args: {
        title: v.string(),
        description: v.optional(v.string()),
        startTime: v.number(),
        endTime: v.number(),
        isAllDay: v.boolean(),
    },
    returns: v.id("calendarEvents"),
    handler: async (ctx, args) => {
        return await ctx.db.insert("calendarEvents", {
            ...args,
            tenantId: "default", // Replace with logic to get current tenant
        });
    },
});

/**
 * Syncs calendar events from an external provider (mock action).
 */
export const syncEvents = action({
    args: {},
    returns: v.null(),
    handler: async (ctx) => {
        console.log("Syncing calendar events from external source...");
        return null;
    },
});
