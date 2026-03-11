import { query, mutation, action } from "../../_generated/server";
import { v } from "convex/values";

/**
 * Returns latest workspace files for a specific category.
 */
export const getFiles = query({
    args: { category: v.string(), tenantId: v.optional(v.string()) },
    returns: v.array(
        v.object({
            _id: v.id("workspaceFiles"),
            agentId: v.optional(v.string()),
            path: v.string(),
            category: v.string(),
            fileType: v.string(),
            source: v.optional(v.string()),
            syncStatus: v.optional(v.string()),
            version: v.number(),
        })
    ),
    handler: async (ctx, args) => {
        let q = ctx.db.query("workspaceFiles").withIndex("by_category", (q) => q.eq("category", args.category));
        let files = await q.order("desc").take(200);
        if (args.tenantId) {
            files = files.filter((file) => file.tenantId === args.tenantId);
        }
        return files.map((f) => ({
            _id: f._id,
            agentId: f.agentId,
            path: f.path,
            category: f.category,
            fileType: f.fileType,
            source: f.source,
            syncStatus: f.syncStatus,
            version: f.version,
        }));
    },
});

export const listWorkspaceAgents = query({
    args: {
        workspaceId: v.id("workspaceTrees"),
    },
    returns: v.array(
        v.object({
            _id: v.id("workspaceAgents"),
            agentId: v.string(),
            inheritToChildren: v.optional(v.boolean()),
            isPrimary: v.optional(v.boolean()),
            relation: v.string(),
            source: v.optional(v.string()),
            workspaceId: v.id("workspaceTrees"),
        })
    ),
    handler: async (ctx, args) => {
        const rows = await ctx.db
            .query("workspaceAgents")
            .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
            .collect();
        return rows.map((row) => ({
            _id: row._id,
            agentId: row.agentId,
            inheritToChildren: row.inheritToChildren,
            isPrimary: row.isPrimary,
            relation: row.relation,
            source: row.source,
            workspaceId: row.workspaceId,
        }));
    },
});

/**
 * Upserts a file into the workspace repository.
 */
export const uploadFile = mutation({
    args: {
        path: v.string(),
        content: v.string(),
        category: v.string(),
        fileType: v.string(),
        tenantId: v.optional(v.string()),
    },
    returns: v.id("workspaceFiles"),
    handler: async (ctx, args) => {
        return await ctx.db.insert("workspaceFiles", {
            ...args,
            source: "manual",
            version: 1.0,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        });
    },
});

export const attachWorkspaceAgent = mutation({
    args: {
        workspaceId: v.id("workspaceTrees"),
        agentId: v.string(),
        inheritToChildren: v.optional(v.boolean()),
        isPrimary: v.optional(v.boolean()),
        relation: v.optional(v.string()),
        source: v.optional(v.string()),
        tenantId: v.optional(v.string()),
    },
    returns: v.id("workspaceAgents"),
    handler: async (ctx, args) => {
        const now = Date.now();
        const existing = await ctx.db
            .query("workspaceAgents")
            .withIndex("by_workspace_agent", (q) =>
                q.eq("workspaceId", args.workspaceId).eq("agentId", args.agentId)
            )
            .first();
        const payload = {
            agentId: args.agentId,
            inheritToChildren: args.inheritToChildren ?? false,
            isPrimary: args.isPrimary ?? false,
            relation: args.relation ?? "member",
            source: args.source ?? "manual",
            tenantId: args.tenantId,
            updatedAt: now,
            workspaceId: args.workspaceId,
        };
        if (existing) {
            await ctx.db.patch(existing._id, payload);
            return existing._id;
        }
        return await ctx.db.insert("workspaceAgents", {
            ...payload,
            createdAt: now,
        });
    },
});

export const detachWorkspaceAgent = mutation({
    args: {
        workspaceId: v.id("workspaceTrees"),
        agentId: v.string(),
    },
    returns: v.null(),
    handler: async (ctx, args) => {
        const existing = await ctx.db
            .query("workspaceAgents")
            .withIndex("by_workspace_agent", (q) =>
                q.eq("workspaceId", args.workspaceId).eq("agentId", args.agentId)
            )
            .first();
        if (!existing) {
            return null;
        }
        await ctx.db.delete(existing._id);
        return null;
    },
});

export const syncRuntimeWorkspaceSnapshot = mutation({
    args: {
        files: v.array(
            v.object({
                agentId: v.optional(v.string()),
                category: v.string(),
                content: v.string(),
                description: v.optional(v.string()),
                fileType: v.string(),
                parsedData: v.optional(v.any()),
                path: v.string(),
                source: v.optional(v.string()),
                tags: v.optional(v.array(v.string())),
                tenantId: v.optional(v.string()),
            })
        ),
        trees: v.array(
            v.object({
                agentId: v.optional(v.string()),
                description: v.optional(v.string()),
                fileCount: v.optional(v.number()),
                name: v.string(),
                parentAgentId: v.optional(v.string()),
                parentRuntimePath: v.optional(v.string()),
                rootPath: v.string(),
                runtimePath: v.optional(v.string()),
                source: v.optional(v.string()),
                status: v.string(),
                type: v.string(),
            })
        ),
        bindings: v.optional(
            v.array(
                v.object({
                    agentId: v.string(),
                    inheritToChildren: v.optional(v.boolean()),
                    isPrimary: v.optional(v.boolean()),
                    relation: v.optional(v.string()),
                    runtimePath: v.optional(v.string()),
                    source: v.optional(v.string()),
                    workspaceId: v.optional(v.id("workspaceTrees")),
                    workspaceRootPath: v.optional(v.string()),
                })
            )
        ),
    },
    returns: v.object({
        filesDeleted: v.number(),
        filesUpserted: v.number(),
        bindingsDeleted: v.number(),
        bindingsUpserted: v.number(),
        treesDeleted: v.number(),
        treesUpserted: v.number(),
    }),
    handler: async (ctx, args) => {
        const now = Date.now();
        let filesUpserted = 0;
        let filesDeleted = 0;
        let treesUpserted = 0;
        let treesDeleted = 0;
        let bindingsUpserted = 0;
        let bindingsDeleted = 0;

        const seenFilePaths = new Set<string>();
        const seenTreeKeys = new Set<string>();
        const seenBindingKeys = new Set<string>();
        const tenantIds = new Set<string>();

        for (const file of args.files) {
            seenFilePaths.add(file.path);
            if (file.tenantId) {
                tenantIds.add(file.tenantId);
            }
            const existing = await ctx.db
                .query("workspaceFiles")
                .withIndex("by_path", (q) => q.eq("path", file.path))
                .first();

            const nextVersion =
                existing && existing.content === file.content
                    ? existing.version
                    : (existing?.version ?? 0) + 1;

            const payload = {
                ...file,
                lastSyncedAt: now,
                source: file.source ?? "openclaw-runtime",
                syncStatus: "synced",
                updatedAt: now,
                version: nextVersion,
            };

            if (existing) {
                await ctx.db.patch(existing._id, payload);
            } else {
                await ctx.db.insert("workspaceFiles", {
                    ...payload,
                    createdAt: now,
                });
            }
            filesUpserted++;
        }

        for (const tree of args.trees) {
            const treeKey = tree.runtimePath ?? `${tree.agentId ?? ""}:${tree.rootPath}`;
            seenTreeKeys.add(treeKey);
            const {
                parentAgentId: _parentAgentId,
                parentRuntimePath: _parentRuntimePath,
                ...persistedTree
            } = tree;

            const existingByRuntimePath = tree.runtimePath
                ? await ctx.db
                      .query("workspaceTrees")
                      .withIndex("by_runtimePath", (q) => q.eq("runtimePath", tree.runtimePath))
                      .first()
                : null;
            const existingByAgent = tree.agentId
                ? await ctx.db
                      .query("workspaceTrees")
                      .withIndex("by_agent", (q) => q.eq("agentId", tree.agentId))
                      .first()
                : null;
            const existing = existingByRuntimePath ?? existingByAgent;
            const nextRootPath =
                existing && existing.source && existing.source !== "openclaw-runtime"
                    ? existing.rootPath
                    : tree.rootPath;
            let parentId =
                existing?.parentId ??
                undefined;
            if (tree.parentRuntimePath) {
                const parent = await ctx.db
                    .query("workspaceTrees")
                    .withIndex("by_runtimePath", (q) =>
                        q.eq("runtimePath", tree.parentRuntimePath!)
                    )
                    .first();
                parentId = parent?._id;
            } else if (tree.parentAgentId) {
                const parent = await ctx.db
                    .query("workspaceTrees")
                    .withIndex("by_agent", (q) =>
                        q.eq("agentId", tree.parentAgentId!)
                    )
                    .first();
                parentId = parent?._id ?? parentId;
            }

            const payload = {
                ...persistedTree,
                parentId,
                rootPath: nextRootPath,
                runtimePath: tree.runtimePath ?? tree.rootPath,
                source: tree.source ?? "openclaw-runtime",
                updatedAt: now,
            };

            if (existing) {
                await ctx.db.patch(existing._id, payload);
            } else {
                await ctx.db.insert("workspaceTrees", {
                    ...payload,
                    createdAt: now,
                });
            }
            treesUpserted++;
        }

        const existingFiles = tenantIds.size
            ? (
                  await Promise.all(
                      Array.from(tenantIds).map((tenantId) =>
                          ctx.db
                              .query("workspaceFiles")
                              .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
                              .collect()
                      ),
                  )
              ).flat()
            : await ctx.db.query("workspaceFiles").collect();

        for (const file of existingFiles) {
            if (file.source !== "openclaw-runtime") {
                continue;
            }
            if (!seenFilePaths.has(file.path)) {
                await ctx.db.delete(file._id);
                filesDeleted++;
            }
        }

        const existingTrees = await ctx.db.query("workspaceTrees").collect();
        for (const tree of existingTrees) {
            if (tree.source !== "openclaw-runtime") {
                continue;
            }
            const treeKey = tree.runtimePath ?? `${tree.agentId ?? ""}:${tree.rootPath}`;
            if (!seenTreeKeys.has(treeKey)) {
                await ctx.db.delete(tree._id);
                treesDeleted++;
            }
        }

        const bindings = args.bindings ?? [];
        for (const binding of bindings) {
            let workspaceId = binding.workspaceId;
            if (!workspaceId) {
                const runtimePath = binding.runtimePath;
                const workspaceRootPath = binding.workspaceRootPath;
                const workspace = binding.runtimePath
                    ? await ctx.db
                          .query("workspaceTrees")
                          .withIndex("by_runtimePath", (q) =>
                              q.eq("runtimePath", runtimePath)
                          )
                          .first()
                    : workspaceRootPath
                      ? await ctx.db
                            .query("workspaceTrees")
                            .withIndex("by_rootPath", (q) =>
                                q.eq("rootPath", workspaceRootPath)
                            )
                            .first()
                      : null;
                workspaceId = workspace?._id;
            }
            if (!workspaceId) {
                continue;
            }
            const bindingKey = `${workspaceId}:${binding.agentId}`;
            seenBindingKeys.add(bindingKey);

            const existing = await ctx.db
                .query("workspaceAgents")
                .withIndex("by_workspace_agent", (q) =>
                    q.eq("workspaceId", workspaceId!).eq("agentId", binding.agentId)
                )
                .first();
            const payload = {
                agentId: binding.agentId,
                inheritToChildren: binding.inheritToChildren ?? false,
                isPrimary: binding.isPrimary ?? false,
                relation: binding.relation ?? "member",
                source: binding.source ?? "openclaw-runtime",
                updatedAt: now,
                workspaceId,
            };
            if (existing) {
                await ctx.db.patch(existing._id, payload);
            } else {
                await ctx.db.insert("workspaceAgents", {
                    ...payload,
                    createdAt: now,
                });
            }
            bindingsUpserted++;
        }

        const existingBindings = await ctx.db.query("workspaceAgents").collect();
        for (const binding of existingBindings) {
            if (binding.source !== "openclaw-runtime") {
                continue;
            }
            const bindingKey = `${binding.workspaceId}:${binding.agentId}`;
            if (!seenBindingKeys.has(bindingKey)) {
                await ctx.db.delete(binding._id);
                bindingsDeleted++;
            }
        }

        return {
            bindingsDeleted,
            bindingsUpserted,
            filesDeleted,
            filesUpserted,
            treesDeleted,
            treesUpserted,
        };
    },
});

/**
 * Validates a file using external linters or checks.
 */
export const validateFile = action({
    args: { fileId: v.id("workspaceFiles") },
    returns: v.null(),
    handler: async (ctx, args) => {
        console.log(`Validating workspace file: ${args.fileId}`);
        // Run specific validation APIs or external LLM checks
        return null;
    },
});
