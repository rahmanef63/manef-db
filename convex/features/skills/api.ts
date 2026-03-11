import { query, mutation, action } from "../../_generated/server";
import { v } from "convex/values";

/**
 * List all skills, optionally filtered by source.
 */
export const listSkills = query({
    args: { source: v.optional(v.string()), filter: v.optional(v.string()) },
    returns: v.array(
        v.object({
            _id: v.id("skills"),
            _creationTime: v.number(),
            skillId: v.string(),
            name: v.string(),
            description: v.optional(v.string()),
            source: v.string(),
            enabled: v.boolean(),
            runtimeEnabled: v.optional(v.boolean()),
            hasManualOverride: v.optional(v.boolean()),
            version: v.optional(v.string()),
            toolCount: v.optional(v.number()),
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
        return skills.map((s) => ({
            _id: s._id,
            _creationTime: s._creationTime,
            skillId: s.skillId,
            name: s.name,
            description: s.description,
            source: s.source,
            enabled: s.enabled,
            runtimeEnabled: s.config?.runtimeEnabled,
            hasManualOverride: s.config?.manualOverrideEnabled !== undefined,
            version: s.version,
            toolCount: s.toolCount,
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

/**
 * Register a new workspace skill.
 */
export const createSkill = mutation({
    args: {
        skillId: v.string(),
        name: v.string(),
        description: v.optional(v.string()),
        source: v.string(),
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
