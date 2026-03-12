import { mutation, query } from "../../_generated/server";
import { v } from "convex/values";
import { FEATURE_STORE_SEED } from "./catalog";

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
                builderMode: item.builderMode,
                scope: item.scope,
                status: item.status,
                source: item.source,
                icon: item.icon,
                tags: item.tags,
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
            name: v.string(),
            description: v.optional(v.string()),
            itemType: v.string(),
            builderMode: v.optional(v.string()),
            scope: v.string(),
            status: v.string(),
            source: v.string(),
            icon: v.optional(v.string()),
            tags: v.optional(v.array(v.string())),
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
                    name: item.name,
                    description: item.description,
                    itemType: item.itemType,
                    builderMode: item.builderMode,
                    scope: item.scope,
                    status: item.status,
                    source: item.source,
                    icon: item.icon,
                    tags: item.tags,
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
            return existing._id;
        }

        return await ctx.db.insert("workspaceFeatureInstalls", {
            ...payload,
            createdAt: now,
        });
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
        return null;
    },
});
