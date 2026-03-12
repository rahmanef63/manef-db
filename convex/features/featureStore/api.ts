import { mutation, query } from "../../_generated/server";
import { v } from "convex/values";
import { FEATURE_STORE_SEED } from "./catalog";

function normalizeEmail(email: string | null | undefined) {
    return email?.trim().toLowerCase() ?? "";
}

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

async function requireViewerContext(ctx: any) {
    const identity = await ctx.auth.getUserIdentity();
    const viewerEmail = normalizeEmail(identity?.email);
    if (!viewerEmail) {
        throw new Error("Authentication required");
    }
    const authUser = await ctx.db
        .query("authUsers")
        .withIndex("by_email", (q: any) => q.eq("email", viewerEmail))
        .first();
    if (!authUser) {
        throw new Error("Viewer auth user not found");
    }
    const isAdmin = (authUser.roles ?? []).some(
        (role: string) => role.trim().toLowerCase() === "admin",
    );
    return { authUser, isAdmin };
}

async function assertWorkspaceAccess(
    ctx: any,
    workspaceId: any,
    options?: { adminOnly?: boolean },
) {
    const viewer = await requireViewerContext(ctx);
    const workspace = await ctx.db.get(workspaceId);
    if (!workspace) {
        throw new Error("Workspace not found");
    }
    if (viewer.isAdmin) {
        return { ...viewer, workspace };
    }
    if (options?.adminOnly) {
        throw new Error("Admin access required");
    }
    if (!viewer.authUser.profileId || workspace.ownerId !== viewer.authUser.profileId) {
        throw new Error("Workspace access denied");
    }
    return { ...viewer, workspace };
}

async function syncWorkspaceCapabilityPolicies(
    ctx: any,
    workspaceId: any,
    installedItemKeys: string[],
) {
    const workspace = await ctx.db.get(workspaceId);
    if (!workspace) {
        return;
    }

    const now = Date.now();
    const featureItems = await getFeatureStoreItemMap(ctx, installedItemKeys);
    const skillSources = new Map<string, string[]>();
    for (const itemKey of installedItemKeys) {
        const item = featureItems.get(itemKey);
        for (const skillKey of item?.grantedSkillKeys ?? []) {
            const next = skillSources.get(skillKey) ?? [];
            next.push(itemKey);
            skillSources.set(skillKey, next);
        }
    }

    const effectiveSkillKeys = sortedUnique(Array.from(skillSources.keys()));
    const existingWorkspacePolicies = (
        await ctx.db
        .query("workspaceSkillPolicies")
        .withIndex("by_workspace", (q: any) => q.eq("workspaceId", workspaceId))
        .collect()
    ).filter((row: any) => row.source === "feature_install");
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
    const existingAgentPolicies = (
        await ctx.db
        .query("workspaceAgentSkillPolicies")
        .withIndex("by_workspace", (q: any) => q.eq("workspaceId", workspaceId))
        .collect()
    ).filter((row: any) => row.source === "feature_install");
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
    const installedItemKeys = Array.from<string>(
        new Set(
            installs
                .filter((row: any) => row.installState !== "uninstalled")
                .map((row: any) => row.itemKey),
        ),
    ).sort((left: string, right: string) => left.localeCompare(right, "en"));
    const itemMap = await getFeatureStoreItemMap(ctx, installedItemKeys);
    const featureKeys = Array.from<string>(
        new Set(
            installedItemKeys.flatMap((itemKey) => {
                const item = itemMap.get(itemKey);
                if (!item || item.itemType !== "dashboard-feature" || !item.featureKey) {
                    return [];
                }
                return [item.featureKey];
            }),
        ),
    ).sort((left: string, right: string) => left.localeCompare(right, "en"));
    await ctx.db.patch(workspaceId, {
        featureKeys,
        updatedAt: Date.now(),
    });
    await syncWorkspaceCapabilityPolicies(ctx, workspaceId, installedItemKeys);
}

async function getWorkspaceAgentIds(ctx: any, workspace: any) {
    const links = await ctx.db
        .query("workspaceAgents")
        .withIndex("by_workspace", (q: any) => q.eq("workspaceId", workspace._id))
        .collect();
    return sortedUnique([
        ...links.map((link: any) => link.agentId),
        ...(workspace.agentId ? [workspace.agentId] : []),
    ]);
}

async function buildWorkspaceCapabilitySnapshot(ctx: any, workspaceId: any) {
    const workspace = await ctx.db.get(workspaceId);
    if (!workspace) {
        return {
            workspace,
            featureKeys: [],
            grantedSkillKeys: [],
            availableAgentIds: [],
            agentSkillMap: new Map<string, string[]>(),
            agentSourceMap: new Map<string, string[]>(),
        };
    }

    const workspacePolicies = await ctx.db
        .query("workspaceSkillPolicies")
        .withIndex("by_workspace", (q: any) => q.eq("workspaceId", workspaceId))
        .collect();
    const agentPolicies = await ctx.db
        .query("workspaceAgentSkillPolicies")
        .withIndex("by_workspace", (q: any) => q.eq("workspaceId", workspaceId))
        .collect();
    const availableAgentIds = await getWorkspaceAgentIds(ctx, workspace);
    const agentSkillMap = new Map<string, string[]>();
    const agentSourceMap = new Map<string, string[]>();

    for (const policy of agentPolicies) {
        if (policy.status !== "active") {
            continue;
        }
        agentSkillMap.set(policy.agentId, [
            ...(agentSkillMap.get(policy.agentId) ?? []),
            policy.skillKey,
        ]);
        agentSourceMap.set(policy.agentId, [
            ...(agentSourceMap.get(policy.agentId) ?? []),
            ...policy.sourceItemKeys,
        ]);
    }

    return {
        workspace,
        featureKeys: sortedUnique(workspace.featureKeys ?? []),
        grantedSkillKeys: sortedUnique(
            workspacePolicies
                .filter((policy: any) => policy.status === "active")
                .map((policy: any) => policy.skillKey),
        ),
        availableAgentIds,
        agentSkillMap: new Map(
            Array.from(agentSkillMap.entries()).map(([agentId, skillKeys]) => [
                agentId,
                sortedUnique(skillKeys),
            ]),
        ),
        agentSourceMap: new Map(
            Array.from(agentSourceMap.entries()).map(([agentId, sourceItemKeys]) => [
                agentId,
                sortedUnique(sourceItemKeys),
            ]),
        ),
    };
}

function buildDraftCapabilityReport(
    draft: any,
    snapshot: {
        featureKeys: string[];
        grantedSkillKeys: string[];
        availableAgentIds: string[];
        agentSkillMap: Map<string, string[]>;
        agentSourceMap: Map<string, string[]>;
    },
) {
    const requiredFeatureKeys = sortedUnique(draft.requiredFeatureKeys ?? []);
    const requiredSkillKeys = sortedUnique(draft.requiredSkillKeys ?? []);
    const linkedAgentIds = sortedUnique(draft.linkedAgentIds ?? []);
    const missingFeatureKeys = requiredFeatureKeys.filter(
        (featureKey) => !snapshot.featureKeys.includes(featureKey),
    );
    const missingWorkspaceSkillKeys = requiredSkillKeys.filter(
        (skillKey) => !snapshot.grantedSkillKeys.includes(skillKey),
    );
    const unavailableAgentIds = linkedAgentIds.filter(
        (agentId) => !snapshot.availableAgentIds.includes(agentId),
    );
    const agentCoverage = linkedAgentIds.map((agentId) => {
        const agentSkillKeys = sortedUnique(snapshot.agentSkillMap.get(agentId) ?? []);
        const missingSkillKeys = requiredSkillKeys.filter(
            (skillKey) => !agentSkillKeys.includes(skillKey),
        );
        return {
            agentId,
            grantedSkillKeys: agentSkillKeys,
            sourceItemKeys: sortedUnique(snapshot.agentSourceMap.get(agentId) ?? []),
            missingSkillKeys,
        };
    });

    return {
        workspaceFeatureKeys: snapshot.featureKeys,
        workspaceSkillKeys: snapshot.grantedSkillKeys,
        availableAgentIds: snapshot.availableAgentIds,
        missingFeatureKeys,
        missingWorkspaceSkillKeys,
        unavailableAgentIds,
        agentCoverage,
        isReady:
            missingFeatureKeys.length === 0 &&
            missingWorkspaceSkillKeys.length === 0 &&
            unavailableAgentIds.length === 0 &&
            agentCoverage.every((entry) => entry.missingSkillKeys.length === 0),
    };
}

function buildCustomCodeReport(draft: any) {
    const customCode = draft.outputConfig?.customCode ?? {};
    const reviewChecklist = customCode.reviewChecklist ?? {};
    const requiredChecklistKeys = [
        "scopeReviewed",
        "secretSafe",
        "networkReviewed",
        "runtimeWriteReviewed",
    ];
    const missingChecklistKeys = requiredChecklistKeys.filter(
        (key) => reviewChecklist[key] !== true,
    );
    const sourceCode = typeof customCode.sourceCode === "string"
        ? customCode.sourceCode.trim()
        : "";
    const entryFile = typeof customCode.entryFile === "string"
        ? customCode.entryFile.trim()
        : "";
    const reviewSummary = typeof customCode.reviewSummary === "string"
        ? customCode.reviewSummary.trim()
        : "";
    const hasSourceCode = sourceCode.length > 0;
    const hasEntryFile = entryFile.length > 0;
    const hasReviewSummary = reviewSummary.length > 0;

    return {
        language: typeof customCode.language === "string" ? customCode.language : undefined,
        sourceLength: sourceCode.length,
        hasSourceCode,
        hasEntryFile,
        hasReviewSummary,
        missingChecklistKeys,
        isReady:
            draft.builderMode !== "custom_code" ||
            (
                hasSourceCode &&
                hasEntryFile &&
                hasReviewSummary &&
                missingChecklistKeys.length === 0
            ),
    };
}

export const seedFeatureStoreCatalog = mutation({
    args: {},
    returns: v.object({
        itemsUpserted: v.number(),
        previewsUpserted: v.number(),
    }),
    handler: async (ctx) => {
        await requireViewerContext(ctx).then(({ isAdmin }) => {
            if (!isAdmin) {
                throw new Error("Admin access required");
            }
        });
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
        if (args.workspaceId) {
            await assertWorkspaceAccess(ctx, args.workspaceId);
        } else {
            await requireViewerContext(ctx);
        }
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
        await assertWorkspaceAccess(ctx, args.workspaceId, { adminOnly: true });
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
        const { isAdmin } = await requireViewerContext(ctx);
        if (!isAdmin) {
            throw new Error("Admin access required");
        }
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
        await assertWorkspaceAccess(ctx, args.workspaceId, { adminOnly: true });
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
        await assertWorkspaceAccess(ctx, args.workspaceId);
        const snapshot = await buildWorkspaceCapabilitySnapshot(ctx, args.workspaceId);
        if (!snapshot.workspace) {
            return {
                workspaceId: args.workspaceId,
                featureKeys: [],
                grantedSkillKeys: [],
                agentPolicies: [],
            };
        }

        return {
            workspaceId: args.workspaceId,
            featureKeys: snapshot.featureKeys,
            grantedSkillKeys: snapshot.grantedSkillKeys,
            agentPolicies: Array.from(snapshot.agentSkillMap.entries())
                .sort(([left], [right]) => left.localeCompare(right, "en"))
                .map(([agentId, value]) => ({
                    agentId,
                    skillKeys: value,
                    sourceItemKeys: sortedUnique(snapshot.agentSourceMap.get(agentId) ?? []),
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
    capabilityReport: v.object({
        workspaceFeatureKeys: v.array(v.string()),
        workspaceSkillKeys: v.array(v.string()),
        availableAgentIds: v.array(v.string()),
        missingFeatureKeys: v.array(v.string()),
        missingWorkspaceSkillKeys: v.array(v.string()),
        unavailableAgentIds: v.array(v.string()),
        agentCoverage: v.array(
            v.object({
                agentId: v.string(),
                grantedSkillKeys: v.array(v.string()),
                sourceItemKeys: v.array(v.string()),
                missingSkillKeys: v.array(v.string()),
            }),
        ),
        isReady: v.boolean(),
    }),
    customCodeReport: v.object({
        language: v.optional(v.string()),
        sourceLength: v.number(),
        hasSourceCode: v.boolean(),
        hasEntryFile: v.boolean(),
        hasReviewSummary: v.boolean(),
        missingChecklistKeys: v.array(v.string()),
        isReady: v.boolean(),
    }),
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
        await assertWorkspaceAccess(ctx, args.workspaceId);
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
        const snapshot = await buildWorkspaceCapabilitySnapshot(ctx, args.workspaceId);

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
                capabilityReport: buildDraftCapabilityReport(row, snapshot),
                customCodeReport: buildCustomCodeReport(row),
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
        await assertWorkspaceAccess(ctx, args.workspaceId, { adminOnly: true });
        const now = Date.now();
        const baseSlug = slugifyAppName(args.appSlug ?? args.name);
        const draftKey = `${args.itemKey}:${baseSlug}`;
        const linkedAgentIds = sortedUnique(args.linkedAgentIds ?? []);
        const linkedChannelKeys = sortedUnique(args.linkedChannelKeys ?? []);
        const requiredFeatureKeys = sortedUnique(args.requiredFeatureKeys ?? []);
        const requiredSkillKeys = sortedUnique(args.requiredSkillKeys ?? []);
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
            linkedAgentIds,
            linkedChannelKeys,
            requiredFeatureKeys,
            requiredSkillKeys,
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
        await assertWorkspaceAccess(ctx, existing.workspaceId, { adminOnly: true });
        const nextPayload = {
            name: args.name?.trim() ?? existing.name,
            description: args.description?.trim() ?? existing.description,
            appSlug: args.appSlug ? slugifyAppName(args.appSlug) : existing.appSlug,
            linkedAgentIds: sortedUnique(args.linkedAgentIds ?? existing.linkedAgentIds ?? []),
            linkedChannelKeys: sortedUnique(args.linkedChannelKeys ?? existing.linkedChannelKeys ?? []),
            requiredFeatureKeys: sortedUnique(
                args.requiredFeatureKeys ?? existing.requiredFeatureKeys ?? [],
            ),
            requiredSkillKeys: sortedUnique(
                args.requiredSkillKeys ?? existing.requiredSkillKeys ?? [],
            ),
            previewConfig: args.previewConfig ?? existing.previewConfig,
            outputConfig: args.outputConfig ?? existing.outputConfig,
            downstreamTarget: args.downstreamTarget ?? existing.downstreamTarget,
        };
        const nextStatus = args.status ?? existing.status;
        if (nextStatus === "ready") {
            const snapshot = await buildWorkspaceCapabilitySnapshot(ctx, existing.workspaceId);
            const report = buildDraftCapabilityReport(
                {
                    ...existing,
                    ...nextPayload,
                },
                snapshot,
            );
            if (!report.isReady) {
                throw new Error("Draft capability requirements are not satisfied");
            }
            const customCodeReport = buildCustomCodeReport({
                ...existing,
                ...nextPayload,
            });
            if (!customCodeReport.isReady) {
                throw new Error("Custom code review requirements are not satisfied");
            }
        }
        await ctx.db.patch(args.draftId, {
            name: nextPayload.name,
            description: nextPayload.description,
            appSlug: nextPayload.appSlug,
            status: nextStatus,
            linkedAgentIds: nextPayload.linkedAgentIds,
            linkedChannelKeys: nextPayload.linkedChannelKeys,
            requiredFeatureKeys: nextPayload.requiredFeatureKeys,
            requiredSkillKeys: nextPayload.requiredSkillKeys,
            previewConfig: nextPayload.previewConfig,
            outputConfig: nextPayload.outputConfig,
            downstreamTarget: nextPayload.downstreamTarget,
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
        await assertWorkspaceAccess(ctx, existing.workspaceId, { adminOnly: true });
        await ctx.db.patch(args.draftId, {
            status: "archived",
            archivedAt: Date.now(),
            updatedAt: Date.now(),
        });
        return null;
    },
});
