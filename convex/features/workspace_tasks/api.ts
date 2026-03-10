import { query, mutation, action } from "../../_generated/server";
import { v } from "convex/values";
import { api } from "../../_generated/api";

/**
 * Returns tasks shared within the workspace.
 */
export const getWorkspaceTasks = query({
    args: {},
    returns: v.array(
        v.object({
            _id: v.id("tasks"),
            title: v.string(),
            status: v.string(),
            priority: v.optional(v.string()),
            createdAt: v.number(),
        })
    ),
    handler: async (ctx) => {
        // Query tasks for the workspace (using "tasks" table)
        const tasks = await ctx.db
            .query("tasks")
            .order("desc")
            .take(50);

        return tasks.map((task) => ({
            _id: task._id,
            title: task.title,
            status: task.status,
            priority: task.priority,
            createdAt: task.createdAt,
        }));
    },
});

/**
 * Creates a workspace task.
 */
export const createWorkspaceTask = mutation({
    args: {
        title: v.string(),
        priority: v.optional(v.string()),
    },
    returns: v.id("tasks"),
    handler: async (ctx, args) => {
        return await ctx.db.insert("tasks", {
            title: args.title,
            priority: args.priority || "Normal",
            status: "pending",
            createdAt: Date.now(),
            updatedAt: Date.now(),
        });
    },
});

/**
 * Assign task to a user (mock action).
 */
export const assignTask = action({
    args: { taskId: v.id("tasks"), userId: v.string() },
    returns: v.null(),
    handler: async (ctx, args) => {
        console.log(`Assigning task ${args.taskId} to user ${args.userId}`);
        return null;
    },
});
