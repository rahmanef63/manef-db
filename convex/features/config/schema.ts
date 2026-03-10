import { defineTable } from "convex/server";
import { v } from "convex/values";

export const configSchema = {
    configEntries: defineTable({
        key: v.string(),
        value: v.string(),
        category: v.string(),  // "environment" | "agents" | "channels" | "auth" etc.
        description: v.optional(v.string()),
        tags: v.optional(v.array(v.string())),
        valueType: v.optional(v.string()),   // "string" | "boolean" | "number" | "json"
        defaultValue: v.optional(v.string()),
        tenantId: v.optional(v.string()),
        updatedAt: v.float64(),
    })
        .index("by_key", ["key"])
        .index("by_category", ["category"])
        .index("by_tenant", ["tenantId"])
        .index("by_tenant_key", ["tenantId", "key"]),
};
