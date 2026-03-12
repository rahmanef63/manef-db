import { query, mutation, action } from "../../_generated/server";
import { v } from "convex/values";

function sortedUnique(values: string[]) {
    return Array.from(new Set(values.filter(Boolean))).sort((left, right) =>
        left.localeCompare(right, "en"),
    );
}

async function getWorkspaceAgentIds(ctx: any, workspaceId: any) {
    const workspace = await ctx.db.get(workspaceId);
    if (!workspace) {
        return [];
    }
    const links = await ctx.db
        .query("workspaceAgents")
        .withIndex("by_workspace", (q: any) => q.eq("workspaceId", workspaceId))
        .collect();
    return sortedUnique([
        ...links.map((link: any) => link.agentId),
        ...(workspace.agentId ? [workspace.agentId] : []),
    ]);
}

/**
 * List all skills, optionally filtered by source.
 */
export const listSkills = query({
    args: {
        source: v.optional(v.string()),
        sourceType: v.optional(v.string()),
        filter: v.optional(v.string()),
        workspaceId: v.optional(v.id("workspaceTrees")),
    },
    returns: v.array(
        v.object({
            _id: v.id("skills"),
            _creationTime: v.number(),
            skillId: v.string(),
            name: v.string(),
            description: v.optional(v.string()),
            source: v.string(),
            sourceType: v.optional(v.string()),
            publisherLabel: v.optional(v.string()),
            publisherHandle: v.optional(v.string()),
            trustLevel: v.optional(v.string()),
            skillScope: v.optional(v.string()),
            installState: v.optional(v.string()),
            homepage: v.optional(v.string()),
            enabled: v.boolean(),
            runtimeEnabled: v.optional(v.boolean()),
            hasManualOverride: v.optional(v.boolean()),
            version: v.optional(v.string()),
            toolCount: v.optional(v.number()),
            workspacePolicyEnabled: v.optional(v.boolean()),
            workspacePolicySources: v.optional(v.array(v.string())),
            workspaceAssignedAgentCount: v.optional(v.number()),
        })
    ),
    handler: async (ctx, args) => {
        let skills;
        if (args.source) {
            skills = await ctx.db
                .query("skills")
                .withIndex("by_source", (q) => q.eq("source", args.source!))
                .order("desc")
                .take(200);
        } else if (args.sourceType) {
            skills = await ctx.db
                .query("skills")
                .withIndex("by_sourceType", (q) => q.eq("sourceType", args.sourceType!))
                .order("desc")
                .take(200);
        } else {
            skills = await ctx.db.query("skills").order("desc").take(200);
        }
        // Client-side text filter
        if (args.filter) {
            const f = args.filter.toLowerCase();
            skills = skills.filter(
                (s) =>
                    s.name.toLowerCase().includes(f) ||
                    (s.description && s.description.toLowerCase().includes(f))
            );
        }
        const workspacePolicies = args.workspaceId
            ? await ctx.db
                .query("workspaceSkillPolicies")
                .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId!))
                .collect()
            : [];
        const workspacePolicyMap = new Map<string, string[]>();
        for (const policy of workspacePolicies) {
            if (policy.status !== "active") {
                continue;
            }
            const next = workspacePolicyMap.get(policy.skillKey) ?? [];
            next.push(policy.source);
            workspacePolicyMap.set(policy.skillKey, next);
        }
        const workspaceAgentPolicies = args.workspaceId
            ? await ctx.db
                .query("workspaceAgentSkillPolicies")
                .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId!))
                .collect()
            : [];
        const workspaceAgentCountMap = new Map<string, Set<string>>();
        for (const policy of workspaceAgentPolicies) {
            if (policy.status !== "active") {
                continue;
            }
            const next = workspaceAgentCountMap.get(policy.skillKey) ?? new Set<string>();
            next.add(policy.agentId);
            workspaceAgentCountMap.set(policy.skillKey, next);
        }
        return skills.map((s) => ({
            _id: s._id,
            _creationTime: s._creationTime,
            skillId: s.skillId,
            name: s.name,
            description: s.description,
            source: s.source,
            sourceType: s.sourceType,
            publisherLabel: s.publisherLabel,
            publisherHandle: s.publisherHandle,
            trustLevel: s.trustLevel,
            skillScope: s.skillScope,
            installState: s.installState,
            homepage: s.homepage,
            enabled: s.enabled,
            runtimeEnabled: s.config?.runtimeEnabled,
            hasManualOverride: s.config?.manualOverrideEnabled !== undefined,
            version: s.version,
            toolCount: s.toolCount,
            workspacePolicyEnabled: args.workspaceId
                ? workspacePolicyMap.has(s.skillId)
                : undefined,
            workspacePolicySources: args.workspaceId
                ? sortedUnique(workspacePolicyMap.get(s.skillId) ?? [])
                : undefined,
            workspaceAssignedAgentCount: args.workspaceId
                ? (workspaceAgentCountMap.get(s.skillId)?.size ?? 0)
                : undefined,
        }));
    },
});

/**
 * Toggle a skill on or off.
 */
export const toggleSkill = mutation({
    args: { id: v.id("skills"), enabled: v.boolean() },
    returns: v.null(),
    handler: async (ctx, args) => {
        const existing = await ctx.db.get(args.id);
        if (!existing) {
            return null;
        }
        await ctx.db.patch(args.id, {
            enabled: args.enabled,
            config: {
                ...(existing.config ?? {}),
                manualOverrideEnabled: args.enabled,
                runtimeEnabled:
                    existing.config?.runtimeEnabled ?? existing.enabled,
            },
            updatedAt: Date.now(),
        });
        return null;
    },
});

export const setWorkspaceSkillPolicy = mutation({
    args: {
        workspaceId: v.id("workspaceTrees"),
        skillId: v.id("skills"),
        enabled: v.boolean(),
        agentIds: v.optional(v.array(v.string())),
    },
    returns: v.null(),
    handler: async (ctx, args) => {
        const skill = await ctx.db.get(args.skillId);
        if (!skill) {
            return null;
        }
        const now = Date.now();
        const targetAgentIds = sortedUnique(
            args.agentIds?.length ? args.agentIds : await getWorkspaceAgentIds(ctx, args.workspaceId),
        );
        const skillKey = skill.skillId;
        const existingWorkspacePolicies = await ctx.db
            .query("workspaceSkillPolicies")
            .withIndex("by_workspace_skillKey", (q) =>
                q.eq("workspaceId", args.workspaceId).eq("skillKey", skillKey),
            )
            .collect();
        const manualWorkspacePolicy = existingWorkspacePolicies.find(
            (row) => row.source === "skill_store",
        );
        if (args.enabled) {
            const workspacePayload = {
                workspaceId: args.workspaceId,
                skillKey,
                source: "skill_store",
                sourceItemKeys: [skill.skillId],
                status: "active",
                updatedAt: now,
            };
            if (manualWorkspacePolicy) {
                await ctx.db.patch(manualWorkspacePolicy._id, workspacePayload);
            } else {
                await ctx.db.insert("workspaceSkillPolicies", {
                    ...workspacePayload,
                    createdAt: now,
                });
            }
        } else if (manualWorkspacePolicy) {
            await ctx.db.delete(manualWorkspacePolicy._id);
        }

        const existingAgentPolicies = await ctx.db
            .query("workspaceAgentSkillPolicies")
            .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
            .collect();
        const manualAgentPolicies = existingAgentPolicies.filter(
            (row) => row.source === "skill_store" && row.skillKey === skillKey,
        );
        if (!args.enabled) {
            for (const row of manualAgentPolicies) {
                await ctx.db.delete(row._id);
            }
            return null;
        }

        const manualAgentPolicyMap = new Map(
            manualAgentPolicies.map((row) => [row.agentId, row]),
        );
        for (const row of manualAgentPolicies) {
            if (!targetAgentIds.includes(row.agentId)) {
                await ctx.db.delete(row._id);
            }
        }
        for (const agentId of targetAgentIds) {
            const payload = {
                workspaceId: args.workspaceId,
                agentId,
                skillKey,
                source: "skill_store",
                sourceItemKeys: [skill.skillId],
                status: "active",
                updatedAt: now,
            };
            const existing = manualAgentPolicyMap.get(agentId);
            if (existing) {
                await ctx.db.patch(existing._id, payload);
            } else {
                await ctx.db.insert("workspaceAgentSkillPolicies", {
                    ...payload,
                    createdAt: now,
                });
            }
        }
        return null;
    },
});

/**
 * Register a new workspace skill.
 */
export const createSkill = mutation({
    args: {
        skillId: v.string(),
        name: v.string(),
        description: v.optional(v.string()),
        source: v.string(),
        sourceType: v.optional(v.string()),
        publisherLabel: v.optional(v.string()),
        publisherHandle: v.optional(v.string()),
        trustLevel: v.optional(v.string()),
        skillScope: v.optional(v.string()),
        installState: v.optional(v.string()),
        homepage: v.optional(v.string()),
        enabled: v.boolean(),
        version: v.optional(v.string()),
        requiredApiKeys: v.optional(v.array(v.string())),
        tenantId: v.optional(v.string()),
    },
    returns: v.id("skills"),
    handler: async (ctx, args) => {
        const now = Date.now();
        return await ctx.db.insert("skills", {
            ...args,
            toolCount: 0,
            createdAt: now,
            updatedAt: now,
        });
    },
});

/**
 * Create or update runtime-mirrored skills in bulk.
 */
export const syncRuntimeSkills = mutation({
    args: {
        skills: v.array(
            v.object({
                skillId: v.string(),
                name: v.string(),
                description: v.optional(v.string()),
                source: v.string(),
                sourceType: v.optional(v.string()),
                publisherLabel: v.optional(v.string()),
                publisherHandle: v.optional(v.string()),
                trustLevel: v.optional(v.string()),
                skillScope: v.optional(v.string()),
                installState: v.optional(v.string()),
                homepage: v.optional(v.string()),
                enabled: v.boolean(),
                version: v.optional(v.string()),
                toolCount: v.optional(v.number()),
                requiredApiKeys: v.optional(v.array(v.string())),
                config: v.optional(v.any()),
                tenantId: v.optional(v.string()),
            })
        ),
    },
    returns: v.object({ upserted: v.number() }),
    handler: async (ctx, args) => {
        const now = Date.now();
        let upserted = 0;

        for (const skill of args.skills) {
            const existing = await ctx.db
                .query("skills")
                .withIndex("by_skillId", (q) => q.eq("skillId", skill.skillId))
                .first();

            const runtimeEnabled = skill.enabled;
            const manualOverrideEnabled =
                existing?.config?.manualOverrideEnabled;
            const effectiveEnabled =
                manualOverrideEnabled !== undefined
                    ? manualOverrideEnabled
                    : runtimeEnabled;
            const config = {
                ...(existing?.config ?? {}),
                ...(skill.config ?? {}),
                runtimeEnabled,
                manualOverrideEnabled,
            };

            if (existing) {
                await ctx.db.patch(existing._id, {
                    ...skill,
                    enabled: effectiveEnabled,
                    config,
                    updatedAt: now,
                });
            } else {
                await ctx.db.insert("skills", {
                    ...skill,
                    enabled: effectiveEnabled,
                    config,
                    createdAt: now,
                    updatedAt: now,
                });
            }

            upserted++;
        }

        return { upserted };
    },
});

/**
 * Delete a skill.
 */
export const deleteSkill = mutation({
    args: { id: v.id("skills") },
    returns: v.null(),
    handler: async (ctx, args) => {
        await ctx.db.delete(args.id);
        return null;
    },
});

/**
 * Refresh skills from gateway.
 */
export const refreshSkills = action({
    args: {},
    returns: v.null(),
    handler: async (ctx) => {
        console.log("Refreshing skills from gateway...");
        return null;
    },
});

export const getSkillStoreStatus = query({
    args: {},
    returns: v.object({
        total: v.number(),
        bySourceType: v.array(v.object({ key: v.string(), count: v.number() })),
        hasClawHubItems: v.boolean(),
        hasRahmanItems: v.boolean(),
        hasBundledItems: v.boolean(),
    }),
    handler: async (ctx) => {
        const skills = await ctx.db.query("skills").take(500);
        const counts = new Map<string, number>();
        for (const skill of skills) {
            const key = skill.sourceType ?? "unknown";
            counts.set(key, (counts.get(key) ?? 0) + 1);
        }
        const bySourceType = Array.from(counts.entries())
            .sort(([a], [b]) => a.localeCompare(b, "en"))
            .map(([key, count]) => ({ key, count }));

        return {
            total: skills.length,
            bySourceType,
            hasClawHubItems: skills.some((skill) => skill.sourceType === "clawhub"),
            hasRahmanItems: skills.some((skill) => skill.sourceType === "rahman_local"),
            hasBundledItems: skills.some((skill) => skill.sourceType === "openclaw_bundled"),
        };
    },
});
