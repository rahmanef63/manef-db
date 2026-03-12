import { defineTable } from "convex/server";
import { v } from "convex/values";

export const featureStoreSchema = {
    featureStoreItems: defineTable({
        itemKey: v.string(),
        slug: v.string(),
        name: v.string(),
        description: v.optional(v.string()),
        itemType: v.string(),
        featureKey: v.optional(v.string()),
        route: v.optional(v.string()),
        builderMode: v.optional(v.string()),
        scope: v.string(),
        status: v.string(),
        source: v.string(),
        icon: v.optional(v.string()),
        tags: v.optional(v.array(v.string())),
        requiredRoles: v.optional(v.array(v.string())),
        grantedSkillKeys: v.optional(v.array(v.string())),
        runtimeDomains: v.optional(v.array(v.string())),
        config: v.optional(v.any()),
        tenantId: v.optional(v.string()),
        createdAt: v.float64(),
        updatedAt: v.float64(),
    })
        .index("by_itemKey", ["itemKey"])
        .index("by_slug", ["slug"])
        .index("by_scope", ["scope"])
        .index("by_itemType", ["itemType"])
        .index("by_status", ["status"])
        .index("by_tenant", ["tenantId"]),

    featureStorePreviews: defineTable({
        itemKey: v.string(),
        headline: v.optional(v.string()),
        summary: v.optional(v.string()),
        bullets: v.optional(v.array(v.string())),
        accent: v.optional(v.string()),
        previewType: v.optional(v.string()),
        config: v.optional(v.any()),
        createdAt: v.float64(),
        updatedAt: v.float64(),
    })
        .index("by_itemKey", ["itemKey"]),

    workspaceFeatureInstalls: defineTable({
        workspaceId: v.id("workspaceTrees"),
        itemKey: v.string(),
        installState: v.string(),
        source: v.string(),
        installedBy: v.optional(v.string()),
        config: v.optional(v.any()),
        createdAt: v.float64(),
        updatedAt: v.float64(),
    })
        .index("by_workspace", ["workspaceId"])
        .index("by_itemKey", ["itemKey"])
        .index("by_workspace_itemKey", ["workspaceId", "itemKey"]),

    agentBuilderDrafts: defineTable({
        workspaceId: v.id("workspaceTrees"),
        itemKey: v.string(),
        draftKey: v.string(),
        name: v.string(),
        appSlug: v.string(),
        description: v.optional(v.string()),
        builderMode: v.string(),
        status: v.string(),
        source: v.string(),
        linkedAgentIds: v.optional(v.array(v.string())),
        linkedChannelKeys: v.optional(v.array(v.string())),
        previewConfig: v.optional(v.any()),
        outputConfig: v.optional(v.any()),
        downstreamTarget: v.optional(v.string()),
        createdAt: v.float64(),
        updatedAt: v.float64(),
        archivedAt: v.optional(v.float64()),
    })
        .index("by_workspace", ["workspaceId"])
        .index("by_workspace_itemKey", ["workspaceId", "itemKey"])
        .index("by_workspace_draftKey", ["workspaceId", "draftKey"]),
};
