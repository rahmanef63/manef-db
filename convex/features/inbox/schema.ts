import { defineTable } from "convex/server";
import { v } from "convex/values";

export const inboxSchema = {
    inboxMessages: defineTable({
        sender: v.string(),
        subject: v.string(),
        content: v.string(),
        isRead: v.boolean(),
        receivedAt: v.number(),
        tenantId: v.optional(v.string()),
        userId: v.optional(v.string()),
        labels: v.optional(v.array(v.string())),
    })
        .index("by_tenant", ["tenantId"])
        .index("by_user", ["userId"])
        .index("by_read", ["isRead"])
        .index("by_time", ["receivedAt"]),
};
