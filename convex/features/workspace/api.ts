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
                rootPath: v.string(),
                runtimePath: v.optional(v.string()),
                source: v.optional(v.string()),
                status: v.string(),
                type: v.string(),
            })
        ),
    },
    returns: v.object({
        filesDeleted: v.number(),
        filesUpserted: v.number(),
        treesDeleted: v.number(),
        treesUpserted: v.number(),
    }),
    handler: async (ctx, args) => {
        const now = Date.now();
        let filesUpserted = 0;
        let filesDeleted = 0;
        let treesUpserted = 0;
        let treesDeleted = 0;

        const seenFilePaths = new Set<string>();
        const seenTreeKeys = new Set<string>();
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

            const payload = {
                ...tree,
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

        return {
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
