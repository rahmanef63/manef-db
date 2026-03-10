import { defineTable } from "convex/server";
import { v } from "convex/values";

export const calendarSchema = {
    calendarEvents: defineTable({
        title: v.string(),
        description: v.optional(v.string()),
        startTime: v.number(),
        endTime: v.number(),
        isAllDay: v.boolean(),
        location: v.optional(v.string()),
        participantIds: v.optional(v.array(v.string())),
        tenantId: v.optional(v.string()),
        userId: v.optional(v.string()), // or v.id("users")
    })
        .index("by_tenant", ["tenantId"])
        .index("by_user", ["userId"])
        .index("by_time", ["startTime"]),
};
