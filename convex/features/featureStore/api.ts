import { mutation, query } from "../../_generated/server";
import { v } from "convex/values";
import { FEATURE_STORE_SEED } from "./catalog";

function sortedUnique(values: string[]) {
    return Array.from(new Set(values.filter(Boolean))).sort((left, right) =>
        left.localeCompare(right, "en"),
    );
}

async function getFeatureStoreItemMap(ctx: any, itemKeys: string[]) {
    const rows = await Promise.all(
        itemKeys.map((itemKey) =>
            ctx.db
                .query("featureStoreItems")
                .withIndex("by_itemKey", (q: any) => q.eq("itemKey", itemKey))
                .first(),
        ),
    );
    return new Map(
        rows
            .filter((row): row is NonNullable<typeof row> => row != null)
            .map((row) => [row.itemKey, row]),
    );
}

async function syncWorkspaceCapabilityPolicies(
    ctx: any,
    workspaceId: any,
    featureKeys: string[],
) {
    const workspace = await ctx.db.get(workspaceId);
    if (!workspace) {
        return;
    }

    const now = Date.now();
    const featureItems = await getFeatureStoreItemMap(ctx, featureKeys);
    const skillSources = new Map<string, string[]>();
    for (const featureKey of featureKeys) {
        const item = featureItems.get(featureKey);
        for (const skillKey of item?.grantedSkillKeys ?? []) {
            const next = skillSources.get(skillKey) ?? [];
            next.push(featureKey);
            skillSources.set(skillKey, next);
        }
    }

    const effectiveSkillKeys = sortedUnique(Array.from(skillSources.keys()));
    const existingWorkspacePolicies = await ctx.db
        .query("workspaceSkillPolicies")
        .withIndex("by_workspace", (q: any) => q.eq("workspaceId", workspaceId))
        .collect();
    const existingWorkspacePolicyMap = new Map<string, any>(
        existingWorkspacePolicies.map((row: any) => [row.skillKey, row]),
    );

    for (const row of existingWorkspacePolicies) {
        if (!skillSources.has(row.skillKey)) {
            await ctx.db.delete(row._id);
        }
    }

    for (const skillKey of effectiveSkillKeys) {
        const sourceItemKeys = sortedUnique(skillSources.get(skillKey) ?? []);
        const existing = existingWorkspacePolicyMap.get(skillKey);
        const payload = {
            workspaceId,
            skillKey,
            source: "feature_install",
            sourceItemKeys,
            status: "active",
            updatedAt: now,
        };
        if (existing) {
            await ctx.db.patch(existing._id, payload);
        } else {
            await ctx.db.insert("workspaceSkillPolicies", {
                ...payload,
                createdAt: now,
            });
        }
    }

    const links = await ctx.db
        .query("workspaceAgents")
        .withIndex("by_workspace", (q: any) => q.eq("workspaceId", workspaceId))
        .collect();
    const agentIds = sortedUnique([
        ...links.map((link: any) => link.agentId),
        ...(workspace.agentId ? [workspace.agentId] : []),
    ]);
    const existingAgentPolicies = await ctx.db
        .query("workspaceAgentSkillPolicies")
        .withIndex("by_workspace", (q: any) => q.eq("workspaceId", workspaceId))
        .collect();
    const keepKeys = new Set(
        agentIds.flatMap((agentId) =>
            effectiveSkillKeys.map((skillKey) => `${agentId}::${skillKey}`),
        ),
    );
    for (const row of existingAgentPolicies) {
        if (!keepKeys.has(`${row.agentId}::${row.skillKey}`)) {
            await ctx.db.delete(row._id);
        }
    }

    const existingAgentPolicyMap = new Map<string, any>(
        existingAgentPolicies.map((row: any) => [`${row.agentId}::${row.skillKey}`, row]),
    );
    for (const agentId of agentIds) {
        for (const skillKey of effectiveSkillKeys) {
            const sourceItemKeys = sortedUnique(skillSources.get(skillKey) ?? []);
            const existing = existingAgentPolicyMap.get(`${agentId}::${skillKey}`);
            const payload = {
                workspaceId,
                agentId,
                skillKey,
                source: "feature_install",
                sourceItemKeys,
                status: "active",
                updatedAt: now,
            };
            if (existing) {
                await ctx.db.patch(existing._id, payload);
            } else {
                await ctx.db.insert("workspaceAgentSkillPolicies", {
                    ...payload,
                    createdAt: now,
                });
            }
        }
    }
}

async function syncWorkspaceFeatureKeys(
    ctx: any,
    workspaceId: any,
) {
    const installs = await ctx.db
        .query("workspaceFeatureInstalls")
        .withIndex("by_workspace", (q: any) => q.eq("workspaceId", workspaceId))
        .collect();
    const featureKeys = Array.from<string>(
        new Set(
            installs
                .filter((row: any) => row.installState !== "uninstalled")
                .map((row: any) => row.itemKey),
        ),
    ).sort((left: string, right: string) => left.localeCompare(right, "en"));
    await ctx.db.patch(workspaceId, {
        featureKeys,
        updatedAt: Date.now(),
    });
    await syncWorkspaceCapabilityPolicies(ctx, workspaceId, featureKeys);
}

export const seedFeatureStoreCatalog = mutation({
    args: {},
    returns: v.object({
        itemsUpserted: v.number(),
        previewsUpserted: v.number(),
    }),
    handler: async (ctx) => {
        const now = Date.now();
        let itemsUpserted = 0;
        let previewsUpserted = 0;

        for (const item of FEATURE_STORE_SEED) {
            const existing = await ctx.db
                .query("featureStoreItems")
                .withIndex("by_itemKey", (q) => q.eq("itemKey", item.itemKey))
                .first();
            const payload = {
                itemKey: item.itemKey,
                slug: item.slug,
                name: item.name,
                description: item.description,
                itemType: item.itemType,
                featureKey: item.featureKey,
                route: item.route,
                builderMode: item.builderMode,
                scope: item.scope,
                status: item.status,
                source: item.source,
                icon: item.icon,
                tags: item.tags,
                requiredRoles: item.requiredRoles,
                grantedSkillKeys: item.grantedSkillKeys,
                runtimeDomains: item.runtimeDomains,
                config: item.config,
                updatedAt: now,
            };
            if (existing) {
                await ctx.db.patch(existing._id, payload);
            } else {
                await ctx.db.insert("featureStoreItems", {
                    ...payload,
                    createdAt: now,
                });
            }
            itemsUpserted++;

            if (item.preview) {
                const previewExisting = await ctx.db
                    .query("featureStorePreviews")
                    .withIndex("by_itemKey", (q) => q.eq("itemKey", item.itemKey))
                    .first();
                const previewPayload = {
                    itemKey: item.itemKey,
                    headline: item.preview.headline,
                    summary: item.preview.summary,
                    bullets: item.preview.bullets,
                    accent: item.preview.accent,
                    previewType: item.preview.previewType,
                    config: item.preview.config,
                    updatedAt: now,
                };
                if (previewExisting) {
                    await ctx.db.patch(previewExisting._id, previewPayload);
                } else {
                    await ctx.db.insert("featureStorePreviews", {
                        ...previewPayload,
                        createdAt: now,
                    });
                }
                previewsUpserted++;
            }
        }

        return { itemsUpserted, previewsUpserted };
    },
});

export const listFeatureStoreItems = query({
    args: {
        workspaceId: v.optional(v.id("workspaceTrees")),
        itemType: v.optional(v.string()),
        scope: v.optional(v.string()),
        status: v.optional(v.string()),
        q: v.optional(v.string()),
    },
    returns: v.array(
        v.object({
            _id: v.id("featureStoreItems"),
            itemKey: v.string(),
            slug: v.string(),
            featureKey: v.optional(v.string()),
            route: v.optional(v.string()),
            name: v.string(),
            description: v.optional(v.string()),
            itemType: v.string(),
            builderMode: v.optional(v.string()),
            scope: v.string(),
            status: v.string(),
            source: v.string(),
            icon: v.optional(v.string()),
            tags: v.optional(v.array(v.string())),
            requiredRoles: v.optional(v.array(v.string())),
            grantedSkillKeys: v.optional(v.array(v.string())),
            runtimeDomains: v.optional(v.array(v.string())),
            isInstalled: v.boolean(),
            installState: v.optional(v.string()),
            workspaceInstallId: v.optional(v.id("workspaceFeatureInstalls")),
            preview: v.optional(
                v.object({
                    headline: v.optional(v.string()),
                    summary: v.optional(v.string()),
                    bullets: v.optional(v.array(v.string())),
                    accent: v.optional(v.string()),
                    previewType: v.optional(v.string()),
                }),
            ),
        }),
    ),
    handler: async (ctx, args) => {
        let items = await ctx.db.query("featureStoreItems").collect();
        const installs = args.workspaceId
            ? await ctx.db
                .query("workspaceFeatureInstalls")
                .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId!))
                .collect()
            : [];
        const installMap = new Map(installs.map((row) => [row.itemKey, row]));
        const previews = await ctx.db.query("featureStorePreviews").collect();
        const previewMap = new Map(previews.map((row) => [row.itemKey, row]));

        if (args.itemType) {
            items = items.filter((item) => item.itemType === args.itemType);
        }
        if (args.scope) {
            items = items.filter((item) => item.scope === args.scope);
        }
        if (args.status) {
            items = items.filter((item) => item.status === args.status);
        }
        if (args.q) {
            const needle = args.q.toLowerCase();
            items = items.filter((item) =>
                item.name.toLowerCase().includes(needle) ||
                item.slug.toLowerCase().includes(needle) ||
                (item.description?.toLowerCase().includes(needle) ?? false) ||
                (item.tags?.some((tag) => tag.toLowerCase().includes(needle)) ?? false),
            );
        }

        return items
            .sort((a, b) => a.name.localeCompare(b.name, "en"))
            .map((item) => {
                const install = installMap.get(item.itemKey);
                const preview = previewMap.get(item.itemKey);
                return {
                    _id: item._id,
                    itemKey: item.itemKey,
                    slug: item.slug,
                    featureKey: item.featureKey,
                    route: item.route,
                    name: item.name,
                    description: item.description,
                    itemType: item.itemType,
                    builderMode: item.builderMode,
                    scope: item.scope,
                    status: item.status,
                    source: item.source,
                    icon: item.icon,
                    tags: item.tags,
                    requiredRoles: item.requiredRoles,
                    grantedSkillKeys: item.grantedSkillKeys,
                    runtimeDomains: item.runtimeDomains,
                    isInstalled: Boolean(install && install.installState !== "uninstalled"),
                    installState: install?.installState,
                    workspaceInstallId: install?._id,
                    preview: preview
                        ? {
                            headline: preview.headline,
                            summary: preview.summary,
                            bullets: preview.bullets,
                            accent: preview.accent,
                            previewType: preview.previewType,
                        }
                        : undefined,
                };
            });
    },
});

export const installFeatureStoreItem = mutation({
    args: {
        workspaceId: v.id("workspaceTrees"),
        itemKey: v.string(),
        config: v.optional(v.any()),
    },
    returns: v.id("workspaceFeatureInstalls"),
    handler: async (ctx, args) => {
        const now = Date.now();
        const existing = await ctx.db
            .query("workspaceFeatureInstalls")
            .withIndex("by_workspace_itemKey", (q) =>
                q.eq("workspaceId", args.workspaceId).eq("itemKey", args.itemKey),
            )
            .first();

        const payload = {
            workspaceId: args.workspaceId,
            itemKey: args.itemKey,
            installState: "installed",
            source: "manual",
            config: args.config,
            updatedAt: now,
        };

        if (existing) {
            await ctx.db.patch(existing._id, payload);
            await syncWorkspaceFeatureKeys(ctx, args.workspaceId);
            return existing._id;
        }

        const installId = await ctx.db.insert("workspaceFeatureInstalls", {
            ...payload,
            createdAt: now,
        });
        await syncWorkspaceFeatureKeys(ctx, args.workspaceId);
        return installId;
    },
});

export const rebuildWorkspaceCapabilityPolicies = mutation({
    args: {
        workspaceId: v.optional(v.id("workspaceTrees")),
    },
    returns: v.object({
        workspacesProcessed: v.number(),
    }),
    handler: async (ctx, args) => {
        const workspaceIds = args.workspaceId
            ? [args.workspaceId]
            : Array.from(
                new Set(
                    (
                        await ctx.db.query("workspaceFeatureInstalls").collect()
                    ).map((row) => row.workspaceId),
                ),
            );
        for (const workspaceId of workspaceIds) {
            await syncWorkspaceFeatureKeys(ctx, workspaceId);
        }
        return { workspacesProcessed: workspaceIds.length };
    },
});

export const uninstallFeatureStoreItem = mutation({
    args: {
        workspaceId: v.id("workspaceTrees"),
        itemKey: v.string(),
    },
    returns: v.null(),
    handler: async (ctx, args) => {
        const existing = await ctx.db
            .query("workspaceFeatureInstalls")
            .withIndex("by_workspace_itemKey", (q) =>
                q.eq("workspaceId", args.workspaceId).eq("itemKey", args.itemKey),
            )
            .first();
        if (!existing) {
            return null;
        }
        await ctx.db.patch(existing._id, {
            installState: "uninstalled",
            updatedAt: Date.now(),
        });
        await syncWorkspaceFeatureKeys(ctx, args.workspaceId);
        return null;
    },
});

export const getWorkspaceCapabilityPolicy = query({
    args: {
        workspaceId: v.id("workspaceTrees"),
    },
    returns: v.object({
        workspaceId: v.id("workspaceTrees"),
        featureKeys: v.array(v.string()),
        grantedSkillKeys: v.array(v.string()),
        agentPolicies: v.array(
            v.object({
                agentId: v.string(),
                skillKeys: v.array(v.string()),
                sourceItemKeys: v.array(v.string()),
            }),
        ),
    }),
    handler: async (ctx, args) => {
        const workspace = await ctx.db.get(args.workspaceId);
        if (!workspace) {
            return {
                workspaceId: args.workspaceId,
                featureKeys: [],
                grantedSkillKeys: [],
                agentPolicies: [],
            };
        }

        const workspacePolicies = await ctx.db
            .query("workspaceSkillPolicies")
            .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
            .collect();
        const agentPolicies = await ctx.db
            .query("workspaceAgentSkillPolicies")
            .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
            .collect();
        const groupedAgentPolicies = new Map<
            string,
            { skillKeys: string[]; sourceItemKeys: string[] }
        >();

        for (const policy of agentPolicies) {
            if (policy.status !== "active") {
                continue;
            }
            const existing = groupedAgentPolicies.get(policy.agentId) ?? {
                skillKeys: [],
                sourceItemKeys: [],
            };
            existing.skillKeys.push(policy.skillKey);
            existing.sourceItemKeys.push(...policy.sourceItemKeys);
            groupedAgentPolicies.set(policy.agentId, existing);
        }

        return {
            workspaceId: args.workspaceId,
            featureKeys: sortedUnique(workspace.featureKeys ?? []),
            grantedSkillKeys: sortedUnique(
                workspacePolicies
                    .filter((policy) => policy.status === "active")
                    .map((policy) => policy.skillKey),
            ),
            agentPolicies: Array.from(groupedAgentPolicies.entries())
                .sort(([left], [right]) => left.localeCompare(right, "en"))
                .map(([agentId, value]) => ({
                    agentId,
                    skillKeys: sortedUnique(value.skillKeys),
                    sourceItemKeys: sortedUnique(value.sourceItemKeys),
                })),
        };
    },
});

const draftReturnValidator = v.object({
    _id: v.id("agentBuilderDrafts"),
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
    requiredFeatureKeys: v.optional(v.array(v.string())),
    requiredSkillKeys: v.optional(v.array(v.string())),
    previewConfig: v.optional(v.any()),
    outputConfig: v.optional(v.any()),
    downstreamTarget: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    archivedAt: v.optional(v.number()),
});

function slugifyAppName(value: string) {
    return value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "workspace-app";
}

export const listAgentBuilderDrafts = query({
    args: {
        workspaceId: v.id("workspaceTrees"),
        itemKey: v.optional(v.string()),
        includeArchived: v.optional(v.boolean()),
    },
    returns: v.array(draftReturnValidator),
    handler: async (ctx, args) => {
        const rows = args.itemKey
            ? await ctx.db
                .query("agentBuilderDrafts")
                .withIndex("by_workspace_itemKey", (q) =>
                    q.eq("workspaceId", args.workspaceId).eq("itemKey", args.itemKey!),
                )
                .collect()
            : await ctx.db
                .query("agentBuilderDrafts")
                .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
                .collect();

        return rows
            .filter((row) => args.includeArchived || !row.archivedAt)
            .sort((a, b) => b.updatedAt - a.updatedAt)
            .map((row) => ({
                _id: row._id,
                workspaceId: row.workspaceId,
                itemKey: row.itemKey,
                draftKey: row.draftKey,
                name: row.name,
                appSlug: row.appSlug,
                description: row.description,
                builderMode: row.builderMode,
                status: row.status,
                source: row.source,
                linkedAgentIds: row.linkedAgentIds,
                linkedChannelKeys: row.linkedChannelKeys,
                requiredFeatureKeys: row.requiredFeatureKeys,
                requiredSkillKeys: row.requiredSkillKeys,
                previewConfig: row.previewConfig,
                outputConfig: row.outputConfig,
                downstreamTarget: row.downstreamTarget,
                createdAt: row.createdAt,
                updatedAt: row.updatedAt,
                archivedAt: row.archivedAt,
            }));
    },
});

export const createAgentBuilderDraft = mutation({
    args: {
        workspaceId: v.id("workspaceTrees"),
        itemKey: v.string(),
        name: v.string(),
        description: v.optional(v.string()),
        builderMode: v.union(v.literal("json_blocks"), v.literal("custom_code")),
        appSlug: v.optional(v.string()),
        linkedAgentIds: v.optional(v.array(v.string())),
        linkedChannelKeys: v.optional(v.array(v.string())),
        requiredFeatureKeys: v.optional(v.array(v.string())),
        requiredSkillKeys: v.optional(v.array(v.string())),
        previewConfig: v.optional(v.any()),
        outputConfig: v.optional(v.any()),
        downstreamTarget: v.optional(v.string()),
    },
    returns: v.id("agentBuilderDrafts"),
    handler: async (ctx, args) => {
        const now = Date.now();
        const baseSlug = slugifyAppName(args.appSlug ?? args.name);
        const draftKey = `${args.itemKey}:${baseSlug}`;
        const existing = await ctx.db
            .query("agentBuilderDrafts")
            .withIndex("by_workspace_draftKey", (q) =>
                q.eq("workspaceId", args.workspaceId).eq("draftKey", draftKey),
            )
            .first();

        const payload = {
            workspaceId: args.workspaceId,
            itemKey: args.itemKey,
            draftKey,
            name: args.name.trim(),
            appSlug: baseSlug,
            description: args.description?.trim(),
            builderMode: args.builderMode,
            status: "draft",
            source: "manual",
            linkedAgentIds: args.linkedAgentIds,
            linkedChannelKeys: args.linkedChannelKeys,
            requiredFeatureKeys: args.requiredFeatureKeys,
            requiredSkillKeys: args.requiredSkillKeys,
            previewConfig: args.previewConfig,
            outputConfig: args.outputConfig,
            downstreamTarget: args.downstreamTarget,
            updatedAt: now,
            archivedAt: undefined,
        };

        if (existing) {
            await ctx.db.patch(existing._id, payload);
            return existing._id;
        }

        return await ctx.db.insert("agentBuilderDrafts", {
            ...payload,
            createdAt: now,
        });
    },
});

export const updateAgentBuilderDraft = mutation({
    args: {
        draftId: v.id("agentBuilderDrafts"),
        name: v.optional(v.string()),
        description: v.optional(v.string()),
        appSlug: v.optional(v.string()),
        status: v.optional(v.union(v.literal("draft"), v.literal("ready"), v.literal("archived"))),
        linkedAgentIds: v.optional(v.array(v.string())),
        linkedChannelKeys: v.optional(v.array(v.string())),
        requiredFeatureKeys: v.optional(v.array(v.string())),
        requiredSkillKeys: v.optional(v.array(v.string())),
        previewConfig: v.optional(v.any()),
        outputConfig: v.optional(v.any()),
        downstreamTarget: v.optional(v.string()),
    },
    returns: v.id("agentBuilderDrafts"),
    handler: async (ctx, args) => {
        const existing = await ctx.db.get(args.draftId);
        if (!existing) {
            throw new Error("Draft not found");
        }
        const nextStatus = args.status ?? existing.status;
        await ctx.db.patch(args.draftId, {
            name: args.name?.trim() ?? existing.name,
            description: args.description?.trim() ?? existing.description,
            appSlug: args.appSlug ? slugifyAppName(args.appSlug) : existing.appSlug,
            status: nextStatus,
            linkedAgentIds: args.linkedAgentIds ?? existing.linkedAgentIds,
            linkedChannelKeys: args.linkedChannelKeys ?? existing.linkedChannelKeys,
            requiredFeatureKeys: args.requiredFeatureKeys ?? existing.requiredFeatureKeys,
            requiredSkillKeys: args.requiredSkillKeys ?? existing.requiredSkillKeys,
            previewConfig: args.previewConfig ?? existing.previewConfig,
            outputConfig: args.outputConfig ?? existing.outputConfig,
            downstreamTarget: args.downstreamTarget ?? existing.downstreamTarget,
            archivedAt: nextStatus === "archived" ? Date.now() : undefined,
            updatedAt: Date.now(),
        });
        return args.draftId;
    },
});

export const archiveAgentBuilderDraft = mutation({
    args: {
        draftId: v.id("agentBuilderDrafts"),
    },
    returns: v.null(),
    handler: async (ctx, args) => {
        const existing = await ctx.db.get(args.draftId);
        if (!existing) {
            return null;
        }
        await ctx.db.patch(args.draftId, {
            status: "archived",
            archivedAt: Date.now(),
            updatedAt: Date.now(),
        });
        return null;
    },
});
