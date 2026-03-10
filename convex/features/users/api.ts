import { query, mutation } from "../../_generated/server";
import { v } from "convex/values";

/**
 * Returns a list of auth users from the authUsers table.
 */
export const getUsers = query({
    args: {},
    returns: v.array(
        v.object({
            _id: v.id("authUsers"),
            name: v.string(),
            email: v.string(),
            roles: v.array(v.string()),
            status: v.string(),
            createdAt: v.number(),
            updatedAt: v.number(),
        })
    ),
    handler: async (ctx) => {
        const users = await ctx.db.query("authUsers").order("desc").take(100);
        return users.map((u) => ({
            _id: u._id,
            name: u.name,
            email: u.email,
            roles: u.roles,
            status: u.status,
            createdAt: u.createdAt,
            updatedAt: u.updatedAt,
        }));
    },
});

/**
 * Update an auth user's status (block/unblock).
 */
export const updateUserStatus = mutation({
    args: {
        userId: v.id("authUsers"),
        status: v.union(v.literal("active"), v.literal("blocked")),
    },
    returns: v.null(),
    handler: async (ctx, args) => {
        const user = await ctx.db.get(args.userId);
        if (!user) {
            throw new Error("User not found");
        }
        await ctx.db.patch(args.userId, {
            status: args.status,
            updatedAt: Date.now(),
        });

        // If blocking, also revoke all sessions
        if (args.status === "blocked") {
            const sessions = await ctx.db
                .query("authSessions")
                .withIndex("by_user", (q) => q.eq("userId", args.userId))
                .collect();
            const now = Date.now();
            for (const session of sessions) {
                if (!session.revokedAt) {
                    await ctx.db.patch(session._id, {
                        revokedAt: now,
                        revokedBy: "admin-block",
                    });
                }
            }
            await ctx.db.patch(args.userId, {
                sessionVersion: user.sessionVersion + 1,
                updatedAt: now,
            });
        }
        return null;
    },
});

/**
 * Lists roles from the roles table (the ent-based roles).
 */
export const listRoles = query({
    args: {},
    returns: v.array(
        v.object({
            _id: v.id("roles"),
            name: v.string(),
            isDefault: v.boolean(),
        })
    ),
    handler: async (ctx) => {
        const roles = await ctx.db.query("roles").collect();
        return roles.map((r) => ({
            _id: r._id,
            name: r.name,
            isDefault: r.isDefault,
        }));
    },
});

/**
 * Lists auth audit logs with optional event filter.
 */
export const listAuditLogs = query({
    args: {
        eventFilter: v.optional(v.string()),
        limit: v.optional(v.number()),
    },
    returns: v.array(
        v.object({
            _id: v.id("authAuditLogs"),
            event: v.string(),
            createdAt: v.number(),
            userId: v.optional(v.id("authUsers")),
            userName: v.optional(v.string()),
            userEmail: v.optional(v.string()),
            meta: v.optional(v.any()),
        })
    ),
    handler: async (ctx, args) => {
        const take = args.limit ?? 100;
        let logs;

        logs = await ctx.db
            .query("authAuditLogs")
            .withIndex("by_created")
            .order("desc")
            .take(take);

        // Apply event filter in memory if specified
        if (args.eventFilter) {
            logs = logs.filter((log) => log.event === args.eventFilter);
        }

        // Enrich with user info
        const result = [];
        for (const log of logs) {
            let userName: string | undefined;
            let userEmail: string | undefined;
            if (log.userId) {
                const user = await ctx.db.get(log.userId);
                if (user) {
                    userName = user.name;
                    userEmail = user.email;
                }
            }
            result.push({
                _id: log._id,
                event: log.event,
                createdAt: log.createdAt,
                userId: log.userId,
                userName,
                userEmail,
                meta: log.meta,
            });
        }

        return result;
    },
});
