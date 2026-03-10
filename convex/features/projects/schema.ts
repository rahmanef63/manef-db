import { defineTable } from "convex/server";
import { v } from "convex/values";

export const projectsSchema = {
    instanceConfig: defineTable({
        createdAt: v.float64(),
        notes: v.optional(v.string()),
        tenantId: v.string(),
        updatedAt: v.float64(),
    }).index("by_tenant", ["tenantId"]),
    projectDefaults: defineTable({
        backend: v.object({
            convexProjectPolicy: v.string(),
            database: v.string(),
            framework: v.string(),
            schemaPolicy: v.string(),
        }),
        basePath: v.string(),
        createdAt: v.float64(),
        db: v.object({
            mode: v.string(),
            mvpRule: v.string(),
            mvpStorage: v.string(),
            url: v.optional(v.string()),
        }),
        deploy: v.object({
            mustUseContainer: v.optional(v.boolean()),
            notes: v.optional(v.string()),
            primary: v.string(),
            secondary: v.optional(v.string()),
        }),
        frontend: v.object({
            architecture: v.optional(v.string()),
            framework: v.string(),
            rootFolders: v.optional(v.array(v.string())),
        }),
        projectRootPattern: v.string(),
        scope: v.string(),
        structure: v.object({
            backendDir: v.string(),
            frontendDir: v.string(),
        }),
        tenantId: v.optional(v.string()),
        updatedAt: v.float64(),
    })
        .index("by_scope", ["scope"])
        .index("by_tenant", ["tenantId"]),
    projects: defineTable({
        config: v.optional(v.any()),
        createdAt: v.float64(),
        deployedAt: v.optional(v.float64()),
        description: v.optional(v.string()),
        domain: v.optional(v.string()),
        name: v.string(),
        slug: v.string(),
        status: v.string(),
        technologies: v.optional(v.array(v.string())),
        tenantId: v.optional(v.string()),
        type: v.optional(v.string()),
        updatedAt: v.float64(),
    })
        .index("by_slug", ["slug"])
        .index("by_status", ["status"])
        .index("by_tenant", ["tenantId"]),
};
