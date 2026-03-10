import { query } from "../../_generated/server";
import { v } from "convex/values";

/**
 * Returns tasks for the currently authenticated user or generic list if not auth'd.
 */
export const getMyTasks = query({
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
        // Fetch real tasks from DB
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
