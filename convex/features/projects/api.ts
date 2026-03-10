import { query, mutation, action } from "../../_generated/server";
import { v } from "convex/values";
import { api } from "../../_generated/api";

/**
 * Returns a list of projects.
 */
export const listProjects = query({
    args: { tenantId: v.optional(v.string()) },
    returns: v.array(
        v.object({
            _id: v.id("projects"),
            name: v.string(),
            slug: v.string(),
            description: v.optional(v.string()),
            status: v.string(),
            createdAt: v.number(),
        })
    ),
    handler: async (ctx, args) => {
        const projects = args.tenantId
            ? await ctx.db.query("projects").withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId)).order("desc").take(50)
            : await ctx.db.query("projects").order("desc").take(50);

        return projects.map((p) => ({
            _id: p._id,
            name: p.name,
            slug: p.slug,
            description: p.description,
            status: p.status,
            createdAt: p.createdAt,
        }));
    },
});

/**
 * Creates a project.
 */
export const createProject = mutation({
    args: {
        name: v.string(),
        slug: v.string(),
        description: v.optional(v.string()),
        tenantId: v.optional(v.string()),
    },
    returns: v.id("projects"),
    handler: async (ctx, args) => {
        return await ctx.db.insert("projects", {
            ...args,
            status: "active",
            createdAt: Date.now(),
            updatedAt: Date.now(),
        });
    },
});

/**
 * Trigger project deployment action.
 */
export const deployProject = action({
    args: { projectId: v.id("projects") },
    returns: v.null(),
    handler: async (ctx, args) => {
        console.log(`Starting deployment for project: ${args.projectId}`);
        // Typically call webhooks or CI/CD pipelines
        return null;
    },
});
