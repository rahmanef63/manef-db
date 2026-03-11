import { query, mutation, action } from "../../_generated/server";
import { v } from "convex/values";

function slugify(value: string) {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 48);
}

function normalizeRuntimePhone(value: string | undefined) {
    const trimmed = value?.trim() ?? "";
    if (!trimmed) {
        return undefined;
    }
    const digits = trimmed.replace(/[^\d]/g, "");
    if (!digits) {
        return undefined;
    }
    if (digits.startsWith("62")) {
        return `+${digits}`;
    }
    if (digits.startsWith("0")) {
        return `+62${digits.slice(1)}`;
    }
    if (digits.startsWith("8")) {
        return `+62${digits}`;
    }
    return trimmed.startsWith("+") ? `+${digits}` : `+${digits}`;
}

async function resolveWorkspaceId(
    ctx: any,
    args: {
        agentId?: string;
        runtimePath?: string;
        workspaceId?: string;
        workspaceRootPath?: string;
    },
) {
    if (args.workspaceId) {
        return args.workspaceId;
    }
    if (args.runtimePath) {
        const byRuntimePath = await ctx.db
            .query("workspaceTrees")
            .withIndex("by_runtimePath", (q: any) => q.eq("runtimePath", args.runtimePath))
            .first();
        if (byRuntimePath) {
            return byRuntimePath._id;
        }
    }
    if (args.workspaceRootPath) {
        const byRootPath = await ctx.db
            .query("workspaceTrees")
            .withIndex("by_rootPath", (q: any) => q.eq("rootPath", args.workspaceRootPath))
            .first();
        if (byRootPath) {
            return byRootPath._id;
        }
    }
    if (args.agentId) {
        const byAgent = await ctx.db
            .query("workspaceTrees")
            .withIndex("by_agent", (q: any) => q.eq("agentId", args.agentId))
            .first();
        if (byAgent) {
            return byAgent._id;
        }
    }
    return null;
}

async function enqueueOutbox(
    ctx: { db: { insert: (...args: any[]) => Promise<any> } },
    args: {
        entityKey: string;
        entityType: string;
        operation: string;
        payload?: unknown;
        source?: string;
        tenantId?: string;
    },
) {
    const now = Date.now();
    const eventId = `${args.entityType}:${args.entityKey}:${args.operation}:${now}`;
    return await ctx.db.insert("syncOutbox", {
        attemptCount: 0,
        createdAt: now,
        entityKey: args.entityKey,
        entityType: args.entityType,
        eventId,
        lastError: undefined,
        operation: args.operation,
        payload: args.payload,
        processedAt: undefined,
        source: args.source ?? "dashboard",
        status: "pending",
        tenantId: args.tenantId,
        updatedAt: now,
    });
}

async function resolvePrimaryAgentForWorkspace(
    ctx: any,
    workspaceId: string,
) {
    const workspace = await ctx.db.get(workspaceId);
    if (!workspace) {
        return null;
    }
    const links = await ctx.db
        .query("workspaceAgents")
        .withIndex("by_workspace", (q: any) => q.eq("workspaceId", workspaceId))
        .collect();
    const primary =
        links.find((link: any) => link.isPrimary) ??
        links.find((link: any) => link.relation === "primary") ??
        links[0];
    return {
        agentId: primary?.agentId ?? workspace.agentId,
        workspace,
    };
}

/**
 * List all configured channels.
 */
export const listChannels = query({
    args: { tenantId: v.optional(v.string()) },
    returns: v.array(
        v.object({
            _id: v.id("channels"),
            _creationTime: v.number(),
            channelId: v.string(),
            type: v.string(),
            label: v.optional(v.string()),
            configured: v.boolean(),
            running: v.boolean(),
            linked: v.optional(v.boolean()),
            connected: v.optional(v.boolean()),
            mode: v.optional(v.string()),
            lastStartAt: v.optional(v.number()),
            lastProbeAt: v.optional(v.number()),
            lastConnectAt: v.optional(v.number()),
            lastMessageAt: v.optional(v.number()),
            authAgeMs: v.optional(v.number()),
            lastError: v.optional(v.string()),
            config: v.optional(v.any()),
            bindingPolicy: v.optional(
                v.object({
                    mode: v.string(),
                    primaryWorkspaceId: v.optional(v.id("workspaceTrees")),
                    source: v.optional(v.string()),
                }),
            ),
            workspaceBindings: v.array(
                v.object({
                    access: v.optional(v.string()),
                    agentId: v.optional(v.string()),
                    slug: v.string(),
                    source: v.optional(v.string()),
                    workspaceId: v.id("workspaceTrees"),
                    workspaceName: v.string(),
                }),
            ),
            identityBindings: v.array(
                v.object({
                    access: v.optional(v.string()),
                    channel: v.string(),
                    externalUserId: v.string(),
                    normalizedPhone: v.optional(v.string()),
                    source: v.optional(v.string()),
                    userId: v.optional(v.id("userProfiles")),
                    workspaceId: v.id("workspaceTrees"),
                    workspaceName: v.string(),
                }),
            ),
        })
    ),
    handler: async (ctx, args) => {
        const channels = await ctx.db.query("channels").order("desc").take(50);
        return await Promise.all(channels.map(async (c) => {
            const workspaceLinks = await ctx.db
                .query("workspaceChannelBindings")
                .withIndex("by_channel", (q) => q.eq("channelId", c.channelId))
                .collect();
            const identityLinks = await ctx.db
                .query("identityWorkspaceBindings")
                .withIndex("by_channel_external", (q) => q.eq("channel", c.channelId))
                .collect();

            const workspaceBindings = (
                await Promise.all(
                    workspaceLinks.map(async (link) => {
                        const workspace = await ctx.db.get(link.workspaceId);
                        if (!workspace) {
                            return [];
                        }
                        return [{
                            access: link.access,
                            agentId: link.agentId,
                            slug: workspace.agentId?.trim()
                                ? slugify(workspace.agentId)
                                : slugify(workspace.name) || "workspace",
                            source: link.source,
                            workspaceId: workspace._id,
                            workspaceName: workspace.name,
                        }];
                    }),
                )
            ).flat();

            const identityBindings = (
                await Promise.all(
                    identityLinks.map(async (link) => {
                        const workspace = await ctx.db.get(link.workspaceId);
                        if (!workspace) {
                            return [];
                        }
                        return [{
                            access: link.access,
                            channel: link.channel,
                            externalUserId: link.externalUserId,
                            normalizedPhone: link.normalizedPhone,
                            source: link.source,
                            userId: link.userId,
                            workspaceId: workspace._id,
                            workspaceName: workspace.name,
                        }];
                    }),
                )
            ).flat();
            const policy = await ctx.db
                .query("channelBindingPolicies")
                .withIndex("by_channel", (q) => q.eq("channelId", c.channelId))
                .first();

            return {
            _id: c._id,
            _creationTime: c._creationTime,
            channelId: c.channelId,
            type: c.type,
            label: c.label,
            configured: c.configured,
            running: c.running,
            linked: c.linked,
            connected: c.connected,
            mode: c.mode,
            lastStartAt: c.lastStartAt,
            lastProbeAt: c.lastProbeAt,
            lastConnectAt: c.lastConnectAt,
            lastMessageAt: c.lastMessageAt,
            authAgeMs: c.authAgeMs,
            lastError: c.lastError,
            config: c.config,
            bindingPolicy: policy
                ? {
                    mode: policy.mode,
                    primaryWorkspaceId: policy.primaryWorkspaceId,
                    source: policy.source,
                }
                : undefined,
            workspaceBindings,
            identityBindings,
        };
        }));
    },
});

/**
 * Get channel by ID.
 */
export const getChannel = query({
    args: { channelId: v.string() },
    returns: v.union(
        v.object({
            _id: v.id("channels"),
            _creationTime: v.number(),
            channelId: v.string(),
            type: v.string(),
            configured: v.boolean(),
            running: v.boolean(),
            linked: v.optional(v.boolean()),
            connected: v.optional(v.boolean()),
            mode: v.optional(v.string()),
            config: v.optional(v.any()),
        }),
        v.null()
    ),
    handler: async (ctx, args) => {
        const channel = await ctx.db
            .query("channels")
            .withIndex("by_channelId", (q) => q.eq("channelId", args.channelId))
            .first();
        if (!channel) return null;
        return {
            _id: channel._id,
            _creationTime: channel._creationTime,
            channelId: channel.channelId,
            type: channel.type,
            configured: channel.configured,
            running: channel.running,
            linked: channel.linked,
            connected: channel.connected,
            mode: channel.mode,
            config: channel.config,
        };
    },
});

/**
 * Create or update a channel configuration.
 */
export const upsertChannel = mutation({
    args: {
        channelId: v.string(),
        type: v.string(),
        label: v.optional(v.string()),
        configured: v.boolean(),
        running: v.boolean(),
        linked: v.optional(v.boolean()),
        connected: v.optional(v.boolean()),
        mode: v.optional(v.string()),
        lastStartAt: v.optional(v.number()),
        lastStopAt: v.optional(v.number()),
        lastProbeAt: v.optional(v.number()),
        lastConnectAt: v.optional(v.number()),
        lastMessageAt: v.optional(v.number()),
        lastError: v.optional(v.string()),
        authAgeMs: v.optional(v.number()),
        config: v.optional(v.any()),
        tenantId: v.optional(v.string()),
    },
    returns: v.id("channels"),
    handler: async (ctx, args) => {
        const existing = await ctx.db
            .query("channels")
            .withIndex("by_channelId", (q) => q.eq("channelId", args.channelId))
            .first();
        if (existing) {
            await ctx.db.patch(existing._id, {
                ...args,
                updatedAt: Date.now(),
            });
            return existing._id;
        }
        return await ctx.db.insert("channels", {
            ...args,
            linked: args.linked ?? false,
            connected: args.connected ?? false,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        });
    },
});

/**
 * Bulk-sync channel configuration and allowlist mirrors from OpenClaw runtime.
 */
export const syncRuntimeChannels = mutation({
    args: {
        channels: v.array(
            v.object({
                channelId: v.string(),
                type: v.string(),
                label: v.optional(v.string()),
                configured: v.boolean(),
                running: v.boolean(),
                linked: v.optional(v.boolean()),
                connected: v.optional(v.boolean()),
                mode: v.optional(v.string()),
                lastStartAt: v.optional(v.number()),
                lastStopAt: v.optional(v.number()),
                lastProbeAt: v.optional(v.number()),
                lastConnectAt: v.optional(v.number()),
                lastMessageAt: v.optional(v.number()),
                lastError: v.optional(v.string()),
                authAgeMs: v.optional(v.number()),
                config: v.optional(v.any()),
                tenantId: v.optional(v.string()),
                allowList: v.optional(v.array(v.string())),
            })
        ),
        workspaceBindings: v.optional(
            v.array(
                v.object({
                    access: v.optional(v.string()),
                    agentId: v.optional(v.string()),
                    channelId: v.string(),
                    runtimePath: v.optional(v.string()),
                    source: v.optional(v.string()),
                    tenantId: v.optional(v.string()),
                    workspaceId: v.optional(v.id("workspaceTrees")),
                    workspaceRootPath: v.optional(v.string()),
                }),
            ),
        ),
        identityBindings: v.optional(
            v.array(
                v.object({
                    access: v.optional(v.string()),
                    agentId: v.optional(v.string()),
                    channel: v.string(),
                    externalUserId: v.string(),
                    runtimePath: v.optional(v.string()),
                    source: v.optional(v.string()),
                    tenantId: v.optional(v.string()),
                    workspaceId: v.optional(v.id("workspaceTrees")),
                    workspaceRootPath: v.optional(v.string()),
                }),
            ),
        ),
        channelPolicies: v.optional(
            v.array(
                v.object({
                    channelId: v.string(),
                    mode: v.union(v.literal("single-primary"), v.literal("multi-workspace")),
                    primaryWorkspaceId: v.optional(v.id("workspaceTrees")),
                    source: v.optional(v.string()),
                    tenantId: v.optional(v.string()),
                }),
            ),
        ),
    },
    returns: v.object({
        allowListEntries: v.number(),
        channelPoliciesUpserted: v.number(),
        identityBindingsUpserted: v.number(),
        upserted: v.number(),
        workspaceBindingsUpserted: v.number(),
    }),
    handler: async (ctx, args) => {
        const now = Date.now();
        let upserted = 0;
        let allowListEntries = 0;
        let workspaceBindingsUpserted = 0;
        let identityBindingsUpserted = 0;
        let channelPoliciesUpserted = 0;
        const seenWorkspaceBindingKeys = new Set<string>();
        const seenIdentityBindingKeys = new Set<string>();
        const seenPolicyChannels = new Set<string>();

        for (const channel of args.channels) {
            const {
                allowList,
                ...channelRecord
            } = channel;

            const existing = await ctx.db
                .query("channels")
                .withIndex("by_channelId", (q) => q.eq("channelId", channel.channelId))
                .first();

            let channelDocId;
            if (existing) {
                await ctx.db.patch(existing._id, {
                    ...channelRecord,
                    updatedAt: now,
                });
                channelDocId = existing._id;
            } else {
                channelDocId = await ctx.db.insert("channels", {
                    ...channelRecord,
                    linked: channelRecord.linked ?? false,
                    connected: channelRecord.connected ?? false,
                    createdAt: now,
                    updatedAt: now,
                });
            }

            const existingAllowList = await ctx.db
                .query("channelAllowList")
                .withIndex("by_channelId", (q) => q.eq("channelId", channel.channelId))
                .collect();

            for (const entry of existingAllowList) {
                await ctx.db.delete(entry._id);
            }

            for (const pattern of allowList ?? []) {
                await ctx.db.insert("channelAllowList", {
                    channelId: channel.channelId,
                    pattern,
                    tenantId: channel.tenantId,
                    createdAt: now,
                });
                allowListEntries++;
            }

            void channelDocId;
            upserted++;
        }

        for (const binding of args.workspaceBindings ?? []) {
            const workspaceId = await resolveWorkspaceId(ctx, binding);
            if (!workspaceId) {
                continue;
            }
            const key = `${binding.channelId}:${workspaceId}`;
            seenWorkspaceBindingKeys.add(key);
            const existing = await ctx.db
                .query("workspaceChannelBindings")
                .withIndex("by_channel_workspace", (q) =>
                    q.eq("channelId", binding.channelId).eq("workspaceId", workspaceId)
                )
                .first();
            const payload = {
                access: binding.access ?? "owner",
                agentId: binding.agentId,
                channelId: binding.channelId,
                source: binding.source ?? "openclaw-runtime",
                tenantId: binding.tenantId,
                updatedAt: now,
                workspaceId,
            };
            if (existing) {
                await ctx.db.patch(existing._id, payload);
            } else {
                await ctx.db.insert("workspaceChannelBindings", {
                    ...payload,
                    createdAt: now,
                });
            }
            workspaceBindingsUpserted++;
        }

        for (const binding of args.identityBindings ?? []) {
            const workspaceId = await resolveWorkspaceId(ctx, binding);
            if (!workspaceId) {
                continue;
            }
            const normalizedPhone = normalizeRuntimePhone(binding.externalUserId);
            let userId = undefined;
            const existingProfile = normalizedPhone
                ? await ctx.db
                    .query("userProfiles")
                    .withIndex("by_phone", (q) => q.eq("phone", normalizedPhone))
                    .first()
                : null;
            if (existingProfile) {
                userId = existingProfile._id;
            } else {
                const existingIdentity = await ctx.db
                    .query("userIdentities")
                    .withIndex("by_channel_external", (q) =>
                        q.eq("channel", binding.channel).eq("externalUserId", binding.externalUserId)
                    )
                    .first();
                userId = existingIdentity?.userId;
            }
            const key = `${workspaceId}:${binding.channel}:${binding.externalUserId}`;
            seenIdentityBindingKeys.add(key);
            const existing = await ctx.db
                .query("identityWorkspaceBindings")
                .withIndex("by_workspace_channel_external", (q) =>
                    q.eq("workspaceId", workspaceId)
                        .eq("channel", binding.channel)
                        .eq("externalUserId", binding.externalUserId)
                )
                .first();
            const payload = {
                access: binding.access ?? "owner",
                agentId: binding.agentId,
                channel: binding.channel,
                externalUserId: binding.externalUserId,
                normalizedPhone,
                source: binding.source ?? "openclaw-runtime",
                tenantId: binding.tenantId,
                updatedAt: now,
                userId,
                workspaceId,
            };
            if (existing) {
                await ctx.db.patch(existing._id, payload);
            } else {
                await ctx.db.insert("identityWorkspaceBindings", {
                    ...payload,
                    createdAt: now,
                });
            }
            identityBindingsUpserted++;
        }

        const existingWorkspaceBindings = await ctx.db.query("workspaceChannelBindings").collect();
        for (const binding of existingWorkspaceBindings) {
            if (binding.source !== "openclaw-runtime") {
                continue;
            }
            const key = `${binding.channelId}:${binding.workspaceId}`;
            if (!seenWorkspaceBindingKeys.has(key)) {
                await ctx.db.delete(binding._id);
            }
        }

        const existingIdentityBindings = await ctx.db.query("identityWorkspaceBindings").collect();
        for (const binding of existingIdentityBindings) {
            if (binding.source !== "openclaw-runtime") {
                continue;
            }
            const key = `${binding.workspaceId}:${binding.channel}:${binding.externalUserId}`;
            if (!seenIdentityBindingKeys.has(key)) {
                await ctx.db.delete(binding._id);
            }
        }

        for (const policy of args.channelPolicies ?? []) {
            seenPolicyChannels.add(policy.channelId);
            const existing = await ctx.db
                .query("channelBindingPolicies")
                .withIndex("by_channel", (q) => q.eq("channelId", policy.channelId))
                .first();
            const payload = {
                channelId: policy.channelId,
                mode: policy.mode,
                primaryWorkspaceId: policy.primaryWorkspaceId,
                source: policy.source ?? "openclaw-runtime",
                tenantId: policy.tenantId,
                updatedAt: now,
            };
            if (existing) {
                await ctx.db.patch(existing._id, payload);
            } else {
                await ctx.db.insert("channelBindingPolicies", {
                    ...payload,
                    createdAt: now,
                });
            }
            channelPoliciesUpserted++;
        }

        const existingPolicies = await ctx.db.query("channelBindingPolicies").collect();
        for (const policy of existingPolicies) {
            if (policy.source !== "openclaw-runtime") {
                continue;
            }
            if (!seenPolicyChannels.has(policy.channelId)) {
                await ctx.db.delete(policy._id);
            }
        }

        return {
            upserted,
            allowListEntries,
            channelPoliciesUpserted,
            workspaceBindingsUpserted,
            identityBindingsUpserted,
        };
    },
});

export const listChannelWorkspaceBindings = query({
    args: { channelId: v.optional(v.string()), workspaceId: v.optional(v.id("workspaceTrees")) },
    returns: v.array(
        v.object({
            access: v.optional(v.string()),
            agentId: v.optional(v.string()),
            channelId: v.string(),
            source: v.optional(v.string()),
            workspaceId: v.id("workspaceTrees"),
            workspaceName: v.string(),
        }),
    ),
    handler: async (ctx, args) => {
        const rows = await ctx.db.query("workspaceChannelBindings").collect();
        const filtered = rows.filter((row) =>
            (!args.channelId || row.channelId === args.channelId) &&
            (!args.workspaceId || row.workspaceId === args.workspaceId)
        );
        return (
            await Promise.all(
                filtered.map(async (row) => {
                    const workspace = await ctx.db.get(row.workspaceId);
                    if (!workspace) {
                        return [];
                    }
                    return [{
                        access: row.access,
                        agentId: row.agentId,
                        channelId: row.channelId,
                        source: row.source,
                        workspaceId: row.workspaceId,
                        workspaceName: workspace.name,
                    }];
                }),
            )
        ).flat();
    },
});

export const listIdentityWorkspaceBindings = query({
    args: { workspaceId: v.optional(v.id("workspaceTrees")), channel: v.optional(v.string()) },
    returns: v.array(
        v.object({
            access: v.optional(v.string()),
            channel: v.string(),
            externalUserId: v.string(),
            normalizedPhone: v.optional(v.string()),
            source: v.optional(v.string()),
            userId: v.optional(v.id("userProfiles")),
            workspaceId: v.id("workspaceTrees"),
            workspaceName: v.string(),
        }),
    ),
    handler: async (ctx, args) => {
        const rows = await ctx.db.query("identityWorkspaceBindings").collect();
        const filtered = rows.filter((row) =>
            (!args.workspaceId || row.workspaceId === args.workspaceId) &&
            (!args.channel || row.channel === args.channel)
        );
        return (
            await Promise.all(
                filtered.map(async (row) => {
                    const workspace = await ctx.db.get(row.workspaceId);
                    if (!workspace) {
                        return [];
                    }
                    return [{
                        access: row.access,
                        channel: row.channel,
                        externalUserId: row.externalUserId,
                        normalizedPhone: row.normalizedPhone,
                        source: row.source,
                        userId: row.userId,
                        workspaceId: row.workspaceId,
                        workspaceName: workspace.name,
                    }];
                }),
            )
        ).flat();
    },
});

export const listChannelBindingPolicies = query({
    args: {},
    returns: v.array(
        v.object({
            channelId: v.string(),
            mode: v.string(),
            primaryWorkspaceId: v.optional(v.id("workspaceTrees")),
            source: v.optional(v.string()),
        }),
    ),
    handler: async (ctx) => {
        const rows = await ctx.db.query("channelBindingPolicies").collect();
        return rows.map((row) => ({
            channelId: row.channelId,
            mode: row.mode,
            primaryWorkspaceId: row.primaryWorkspaceId,
            source: row.source,
        }));
    },
});

export const attachWorkspaceChannel = mutation({
    args: {
        access: v.optional(v.string()),
        agentId: v.optional(v.string()),
        channelId: v.string(),
        source: v.optional(v.string()),
        tenantId: v.optional(v.string()),
        workspaceId: v.id("workspaceTrees"),
    },
    returns: v.id("workspaceChannelBindings"),
    handler: async (ctx, args) => {
        const now = Date.now();
        const workspaceResolution = await resolvePrimaryAgentForWorkspace(ctx, args.workspaceId);
        const agentId = args.agentId ?? workspaceResolution?.agentId;
        const workspaceName = workspaceResolution?.workspace?.name;
        const existing = await ctx.db
            .query("workspaceChannelBindings")
            .withIndex("by_channel_workspace", (q) =>
                q.eq("channelId", args.channelId).eq("workspaceId", args.workspaceId)
            )
            .first();
        const payload = {
            access: args.access ?? "manual",
            agentId,
            channelId: args.channelId,
            source: args.source ?? "manual",
            tenantId: args.tenantId,
            updatedAt: now,
            workspaceId: args.workspaceId,
        };
        if (existing) {
            await ctx.db.patch(existing._id, payload);
            await enqueueOutbox(ctx, {
                entityKey: `${args.channelId}:${args.workspaceId}`,
                entityType: "channel_binding",
                operation: "upsert",
                payload: {
                    access: payload.access,
                    agentId,
                    channelId: args.channelId,
                    source: payload.source,
                    tenantId: args.tenantId,
                    workspaceId: args.workspaceId,
                    workspaceName,
                },
                tenantId: args.tenantId,
            });
            return existing._id;
        }
        const id = await ctx.db.insert("workspaceChannelBindings", {
            ...payload,
            createdAt: now,
        });
        await enqueueOutbox(ctx, {
            entityKey: `${args.channelId}:${args.workspaceId}`,
            entityType: "channel_binding",
            operation: "upsert",
            payload: {
                access: payload.access,
                agentId,
                channelId: args.channelId,
                source: payload.source,
                tenantId: args.tenantId,
                workspaceId: args.workspaceId,
                workspaceName,
            },
            tenantId: args.tenantId,
        });
        return id;
    },
});

export const detachWorkspaceChannel = mutation({
    args: {
        channelId: v.string(),
        workspaceId: v.id("workspaceTrees"),
    },
    returns: v.null(),
    handler: async (ctx, args) => {
        const existing = await ctx.db
            .query("workspaceChannelBindings")
            .withIndex("by_channel_workspace", (q) =>
                q.eq("channelId", args.channelId).eq("workspaceId", args.workspaceId)
            )
            .first();
        if (existing) {
            await ctx.db.delete(existing._id);
            await enqueueOutbox(ctx, {
                entityKey: `${args.channelId}:${args.workspaceId}`,
                entityType: "channel_binding",
                operation: "delete",
                payload: {
                    channelId: args.channelId,
                    workspaceId: args.workspaceId,
                },
                tenantId: existing.tenantId,
            });
        }
        return null;
    },
});

export const attachIdentityWorkspace = mutation({
    args: {
        access: v.optional(v.string()),
        agentId: v.optional(v.string()),
        channel: v.string(),
        externalUserId: v.string(),
        source: v.optional(v.string()),
        tenantId: v.optional(v.string()),
        workspaceId: v.id("workspaceTrees"),
    },
    returns: v.id("identityWorkspaceBindings"),
    handler: async (ctx, args) => {
        const now = Date.now();
        const normalizedPhone = normalizeRuntimePhone(args.externalUserId);
        let userId = undefined;
        const workspaceResolution = await resolvePrimaryAgentForWorkspace(ctx, args.workspaceId);
        const agentId = args.agentId ?? workspaceResolution?.agentId;
        const workspaceName = workspaceResolution?.workspace?.name;

        const existingProfile = normalizedPhone
            ? await ctx.db
                .query("userProfiles")
                .withIndex("by_phone", (q) => q.eq("phone", normalizedPhone))
                .first()
            : null;
        if (existingProfile) {
            userId = existingProfile._id;
        } else {
            const existingIdentity = await ctx.db
                .query("userIdentities")
                .withIndex("by_channel_external", (q) =>
                    q.eq("channel", args.channel).eq("externalUserId", args.externalUserId)
                )
                .first();
            userId = existingIdentity?.userId;
        }

        const existing = await ctx.db
            .query("identityWorkspaceBindings")
            .withIndex("by_workspace_channel_external", (q) =>
                q.eq("workspaceId", args.workspaceId)
                    .eq("channel", args.channel)
                    .eq("externalUserId", args.externalUserId)
            )
            .first();
        const payload = {
            access: args.access ?? "manual",
            agentId,
            channel: args.channel,
            externalUserId: args.externalUserId,
            normalizedPhone,
            source: args.source ?? "manual",
            tenantId: args.tenantId,
            updatedAt: now,
            userId,
            workspaceId: args.workspaceId,
        };
        if (existing) {
            await ctx.db.patch(existing._id, payload);
            await enqueueOutbox(ctx, {
                entityKey: `${args.workspaceId}:${args.channel}:${args.externalUserId}`,
                entityType: "identity_binding",
                operation: "upsert",
                payload: {
                    access: payload.access,
                    agentId,
                    channel: args.channel,
                    externalUserId: args.externalUserId,
                    normalizedPhone,
                    source: payload.source,
                    tenantId: args.tenantId,
                    workspaceId: args.workspaceId,
                    workspaceName,
                },
                tenantId: args.tenantId,
            });
            return existing._id;
        }
        const id = await ctx.db.insert("identityWorkspaceBindings", {
            ...payload,
            createdAt: now,
        });
        await enqueueOutbox(ctx, {
            entityKey: `${args.workspaceId}:${args.channel}:${args.externalUserId}`,
            entityType: "identity_binding",
            operation: "upsert",
            payload: {
                access: payload.access,
                agentId,
                channel: args.channel,
                externalUserId: args.externalUserId,
                normalizedPhone,
                source: payload.source,
                tenantId: args.tenantId,
                workspaceId: args.workspaceId,
                workspaceName,
            },
            tenantId: args.tenantId,
        });
        return id;
    },
});

export const detachIdentityWorkspace = mutation({
    args: {
        channel: v.string(),
        externalUserId: v.string(),
        workspaceId: v.id("workspaceTrees"),
    },
    returns: v.null(),
    handler: async (ctx, args) => {
        const existing = await ctx.db
            .query("identityWorkspaceBindings")
            .withIndex("by_workspace_channel_external", (q) =>
                q.eq("workspaceId", args.workspaceId)
                    .eq("channel", args.channel)
                    .eq("externalUserId", args.externalUserId)
            )
            .first();
        if (existing) {
            await ctx.db.delete(existing._id);
            await enqueueOutbox(ctx, {
                entityKey: `${args.workspaceId}:${args.channel}:${args.externalUserId}`,
                entityType: "identity_binding",
                operation: "delete",
                payload: {
                    channel: args.channel,
                    externalUserId: args.externalUserId,
                    workspaceId: args.workspaceId,
                },
                tenantId: existing.tenantId,
            });
        }
        return null;
    },
});

export const setChannelBindingPolicy = mutation({
    args: {
        channelId: v.string(),
        mode: v.union(v.literal("single-primary"), v.literal("multi-workspace")),
        primaryWorkspaceId: v.optional(v.id("workspaceTrees")),
        tenantId: v.optional(v.string()),
    },
    returns: v.id("channelBindingPolicies"),
    handler: async (ctx, args) => {
        const now = Date.now();
        const existing = await ctx.db
            .query("channelBindingPolicies")
            .withIndex("by_channel", (q) => q.eq("channelId", args.channelId))
            .first();
        const payload = {
            channelId: args.channelId,
            mode: args.mode,
            primaryWorkspaceId: args.primaryWorkspaceId,
            source: "manual",
            tenantId: args.tenantId,
            updatedAt: now,
        };
        let id;
        if (existing) {
            await ctx.db.patch(existing._id, payload);
            id = existing._id;
        } else {
            id = await ctx.db.insert("channelBindingPolicies", {
                ...payload,
                createdAt: now,
            });
        }
        await enqueueOutbox(ctx, {
            entityKey: args.channelId,
            entityType: "channel_binding_policy",
            operation: "upsert",
            payload: {
                channelId: args.channelId,
                mode: args.mode,
                primaryWorkspaceId: args.primaryWorkspaceId,
            },
            tenantId: args.tenantId,
        });
        return id;
    },
});

/**
 * Delete a channel.
 */
export const deleteChannel = mutation({
    args: { id: v.id("channels") },
    returns: v.null(),
    handler: async (ctx, args) => {
        await ctx.db.delete(args.id);
        return null;
    },
});

/**
 * Trigger a channel refresh action.
 */
export const refreshChannel = action({
    args: { channelId: v.string() },
    returns: v.null(),
    handler: async (ctx, args) => {
        console.log(`Refreshing channel: ${args.channelId}`);
        return null;
    },
});
