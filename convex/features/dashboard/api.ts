import { query } from "../../_generated/server";
import { v } from "convex/values";

/**
 * Returns generic statistics for the dashboard overview.
 */
export const getStats = query({
    args: {},
    returns: v.object({
        totalProjects: v.number(),
        totalTasks: v.number(),
        activeAgents: v.number(),
        systemHealth: v.number(),
    }),
    handler: async (ctx) => {
        // Collect real stats from database tables if applicable.
        // As a fallback/placeholder, we use counts.
        const projects = await ctx.db.query("projects").collect();
        const tasks = await ctx.db.query("tasks").collect();
        const agents = await ctx.db.query("agents").collect();

        return {
            totalProjects: projects.length || 0,
            totalTasks: tasks.length || 0,
            activeAgents: agents.length || 0,
            systemHealth: 98.5,
        };
    },
});

/**
 * Returns a list of recent activities for the dashboard.
 */
export const getRecentActivity = query({
    args: {},
    returns: v.array(
        v.object({
            userInitials: v.string(),
            action: v.string(),
            details: v.string(),
            timeAgo: v.string(),
        })
    ),
    handler: async (ctx) => {
        // For demonstration, fetch recent tasks or projects
        const recentTasks = await ctx.db
            .query("tasks")
            .order("desc")
            .take(5);

        if (recentTasks.length === 0) {
            return [
                {
                    userInitials: "OS",
                    action: "System Initialization",
                    details: "Workspace has been created.",
                    timeAgo: "1m ago",
                },
            ];
        }

        return recentTasks.map((t) => ({
            userInitials: "Ag", // "Agent" or "User"
            action: `Task updated: ${t.status}`,
            details: t.title,
            timeAgo: "recently", // Ideally compute based on t.updatedAt
        }));
    },
});
