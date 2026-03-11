import { defineTable } from "convex/server";
import { v } from "convex/values";

export const workspaceSchema = {
    fileVersions: defineTable({
        changeSummary: v.optional(v.string()),
        changedBy: v.optional(v.id("userProfiles")),
        content: v.string(),
        fileId: v.id("workspaceFiles"),
        tenantId: v.optional(v.string()),
        timestamp: v.float64(),
        version: v.float64(),
    })
        .index("by_file", ["fileId"])
        .index("by_file_time", ["fileId", "timestamp"])
        .index("by_file_version", ["fileId", "version"])
        .index("by_tenant", ["tenantId"]),
    workspaceFiles: defineTable({
        agentId: v.optional(v.string()),
        category: v.string(),
        content: v.string(),
        createdAt: v.float64(),
        description: v.optional(v.string()),
        fileType: v.string(),
        isTemplate: v.optional(v.boolean()),
        lastSyncedAt: v.optional(v.float64()),
        ownerId: v.optional(v.id("userProfiles")),
        parsedData: v.optional(v.any()),
        path: v.string(),
        source: v.optional(v.string()),
        syncStatus: v.optional(v.string()),
        tags: v.optional(v.array(v.string())),
        tenantId: v.optional(v.string()),
        updatedAt: v.float64(),
        version: v.float64(),
    })
        .index("by_agent", ["agentId"])
        .index("by_agent_path", ["agentId", "path"])
        .index("by_category", ["category"])
        .index("by_isTemplate", ["isTemplate"])
        .index("by_owner", ["ownerId"])
        .index("by_owner_category", ["ownerId", "category"])
        .index("by_path", ["path"])
        .index("by_tenant", ["tenantId"]),
    workspaceTrees: defineTable({
        agentId: v.optional(v.string()),
        createdAt: v.float64(),
        description: v.optional(v.string()),
        fileCount: v.optional(v.float64()),
        name: v.string(),
        ownerId: v.optional(v.id("userProfiles")),
        parentId: v.optional(v.id("workspaceTrees")),
        rootPath: v.string(),
        runtimePath: v.optional(v.string()),
        source: v.optional(v.string()),
        status: v.string(),
        type: v.string(),
        updatedAt: v.float64(),
    })
        .index("by_agent", ["agentId"])
        .index("by_owner", ["ownerId"])
        .index("by_parent", ["parentId"])
        .index("by_rootPath", ["rootPath"])
        .index("by_runtimePath", ["runtimePath"])
        .index("by_type", ["type"]),
    workspaceAgents: defineTable({
        agentId: v.string(),
        createdAt: v.float64(),
        inheritToChildren: v.optional(v.boolean()),
        isPrimary: v.optional(v.boolean()),
        relation: v.string(),
        source: v.optional(v.string()),
        tenantId: v.optional(v.string()),
        updatedAt: v.float64(),
        workspaceId: v.id("workspaceTrees"),
    })
        .index("by_agent", ["agentId"])
        .index("by_workspace", ["workspaceId"])
        .index("by_workspace_agent", ["workspaceId", "agentId"])
        .index("by_tenant", ["tenantId"]),
};
