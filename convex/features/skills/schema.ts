import { defineTable } from "convex/server";
import { v } from "convex/values";

export const skillsSchema = {
    skills: defineTable({
        skillId: v.string(),
        name: v.string(),
        description: v.optional(v.string()),
        source: v.string(),   // "bundled" | "managed" | "workspace"
        sourceType: v.optional(v.string()), // "openclaw_bundled" | "rahman_local" | "clawhub"
        publisherLabel: v.optional(v.string()),
        publisherHandle: v.optional(v.string()),
        trustLevel: v.optional(v.string()),
        skillScope: v.optional(v.string()),
        installState: v.optional(v.string()),
        homepage: v.optional(v.string()),
        enabled: v.boolean(),
        version: v.optional(v.string()),
        toolCount: v.optional(v.float64()),
        requiredApiKeys: v.optional(v.array(v.string())),
        config: v.optional(v.any()),
        tenantId: v.optional(v.string()),
        createdAt: v.float64(),
        updatedAt: v.float64(),
    })
        .index("by_skillId", ["skillId"])
        .index("by_source", ["source"])
        .index("by_sourceType", ["sourceType"])
        .index("by_enabled", ["enabled"])
        .index("by_tenant", ["tenantId"]),
};
