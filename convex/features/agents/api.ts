import { query, mutation, action } from "../../_generated/server";
import { v } from "convex/values";

/**
 * Returns a list of agents for a specific tenant/user.
 */
export const getAgents = query({
    args: {
        agentIds: v.optional(v.array(v.string())),
        ownerId: v.optional(v.id("userProfiles")),
    },
    returns: v.array(
        v.object({
            _id: v.id("agents"),
            agentId: v.string(),
            name: v.string(),
            description: v.optional(v.string()),
            workspacePath: v.optional(v.string()),
            agentDir: v.optional(v.string()),
            boundChannels: v.array(v.string()),
            capabilities: v.array(v.string()),
            childCount: v.number(),
            sessionCount: v.number(),
            lastActiveAt: v.optional(v.number()),
            model: v.optional(v.string()),
            owner: v.optional(v.id("userProfiles")),
            ownerName: v.optional(v.string()),
            role: v.string(),
            status: v.string(),
        })
    ),
    handler: async (ctx, args) => {
        const agents = await ctx.db.query("agents").order("desc").take(50);
        const allowedAgentIds = args.agentIds ? new Set(args.agentIds) : null;
        const filteredAgents = agents.filter((agent) => {
            if (args.ownerId && agent.owner !== args.ownerId) return false;
            if (allowedAgentIds && !allowedAgentIds.has(agent.agentId)) return false;
            return true;
        });

        const enrichedAgents = await Promise.all(
            filteredAgents.map(async (agent) => {
                const [ownerProfile, workspaceTree, childDelegations, sessions] =
                    await Promise.all([
                        agent.owner
                            ? ctx.db.get(agent.owner)
                            : Promise.resolve(null),
                        ctx.db
                            .query("workspaceTrees")
                            .withIndex("by_agent", (q) => q.eq("agentId", agent.agentId))
                            .first(),
                        ctx.db
                            .query("agentDelegations")
                            .withIndex("by_parent", (q) => q.eq("parentAgentId", agent.agentId))
                            .collect(),
                        ctx.db
                            .query("sessions")
                            .withIndex("by_agent", (q) => q.eq("agentId", agent.agentId))
                            .collect(),
                    ]);

                const config = agent.config ?? {};
                const bindings: any[] = Array.isArray(config.bindings)
                    ? config.bindings
                    : [];
                const boundChannels = bindings
                    .map((binding: any) => {
                        const channel = binding?.match?.channel;
                        return typeof channel === "string" ? channel : null;
                    })
                    .filter((value: string | null): value is string => Boolean(value));

                return {
                    _id: agent._id,
                    agentId: agent.agentId,
                    name: agent.name,
                    description: agent.agentsMd,
                    workspacePath:
                        (workspaceTree as { runtimePath?: string } | null)?.runtimePath ??
                        workspaceTree?.rootPath,
                    agentDir:
                        typeof config.agentDir === "string" ? config.agentDir : undefined,
                    boundChannels: Array.from(new Set(boundChannels)),
                    capabilities: agent.capabilities ?? [],
                    childCount: childDelegations.length,
                    sessionCount: sessions.length,
                    lastActiveAt: agent.lastActiveAt,
                    model: agent.model,
                    owner: agent.owner,
                    ownerName: ownerProfile?.name,
                    role: agent.type,
                    status: agent.status || "active",
                };
            }),
        );

        return enrichedAgents;
    },
});

async function enqueueAgentOutbox(
    ctx: { db: { insert: (...args: any[]) => Promise<any> } },
    agentId: string,
    operation: string,
    payload: unknown,
) {
    const now = Date.now();
    const eventId = `agent:${agentId}:${operation}:${now}`;
    return await ctx.db.insert("syncOutbox", {
        attemptCount: 0,
        createdAt: now,
        entityKey: agentId,
        entityType: "agent",
        eventId,
        operation,
        payload,
        processedAt: undefined,
        source: "dashboard",
        status: "pending",
        updatedAt: now,
    });
}

/**
 * Deploys a new agent (Convex-side draft only — real agent creation requires OpenClaw CLI).
 */
export const deployAgent = mutation({
    args: {
        name: v.string(),
        role: v.string(),
        description: v.optional(v.string()),
        tenantId: v.optional(v.string()),
    },
    returns: v.id("agents"),
    handler: async (ctx, args) => {
        const agentId = `draft_${args.name.toLowerCase().replace(/\s+/g, "-")}_${Date.now()}`;
        const id = await ctx.db.insert("agents", {
            agentId,
            name: args.name,
            type: args.role,
            agentsMd: args.description,
            status: "draft",
            tenantId: args.tenantId,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        });
        return id;
    },
});

/**
 * Update agent metadata — writes to Convex and enqueues outbox event for runtime write-through.
 * Only updates fields safe to change from dashboard: model, name, description.
 */
export const updateAgent = mutation({
    args: {
        id: v.id("agents"),
        name: v.optional(v.string()),
        model: v.optional(v.string()),
        description: v.optional(v.string()),
    },
    returns: v.null(),
    handler: async (ctx, args) => {
        const { id, ...fields } = args;
        const agent = await ctx.db.get(id);
        if (!agent) throw new Error(`Agent ${id} not found`);
        const patch: Record<string, unknown> = { updatedAt: Date.now() };
        if (fields.name !== undefined) patch.name = fields.name;
        if (fields.model !== undefined) patch.model = fields.model;
        if (fields.description !== undefined) patch.agentsMd = fields.description;
        await ctx.db.patch(id, patch);
        await enqueueAgentOutbox(ctx, agent.agentId, "update", {
            agentId: agent.agentId,
            name: fields.name,
            model: fields.model,
        });
        return null;
    },
});

/**
 * Archive a runtime agent (marks inactive in Convex, enqueues outbox for runtime).
 * Only affects Convex mirror — cannot delete actual OpenClaw agent workspace from dashboard.
 */
export const archiveAgent = mutation({
    args: { id: v.id("agents") },
    returns: v.null(),
    handler: async (ctx, args) => {
        const agent = await ctx.db.get(args.id);
        if (!agent) throw new Error(`Agent ${args.id} not found`);
        await ctx.db.patch(args.id, { status: "inactive", updatedAt: Date.now() });
        await enqueueAgentOutbox(ctx, agent.agentId, "archive", { agentId: agent.agentId });
        return null;
    },
});

/**
 * Upsert runtime-mirrored agents from OpenClaw config.
 */
export const syncRuntimeAgents = mutation({
    args: {
        agents: v.array(
            v.object({
                agentId: v.string(),
                name: v.string(),
                type: v.string(),
                status: v.optional(v.string()),
                model: v.optional(v.string()),
                lastActiveAt: v.optional(v.number()),
                capabilities: v.optional(v.array(v.string())),
                workspacePath: v.optional(v.string()),
                agentDir: v.optional(v.string()),
                agentsMd: v.optional(v.string()),
                bootstrapMd: v.optional(v.string()),
                heartbeatMd: v.optional(v.string()),
                identityMd: v.optional(v.string()),
                memoryMd: v.optional(v.string()),
                soulMd: v.optional(v.string()),
                toolsMd: v.optional(v.string()),
                userMd: v.optional(v.string()),
                config: v.optional(v.any()),
                tenantId: v.optional(v.string()),
            })
        ),
    },
    returns: v.object({ upserted: v.number(), deleted: v.number() }),
    handler: async (ctx, args) => {
        const now = Date.now();
        let upserted = 0;
        let deleted = 0;
        const seen = new Set<string>();
        const tenantIds = new Set<string>();

        for (const agent of args.agents) {
            const {
                workspacePath,
                agentDir,
                ...agentPayload
            } = agent;
            if (agent.tenantId) {
                tenantIds.add(agent.tenantId);
            }
            seen.add(`${agent.tenantId ?? ""}::${agent.agentId}`);

            const existing = await ctx.db
                .query("agents")
                .withIndex("by_agentId", (q) => q.eq("agentId", agent.agentId))
                .first();
            const payload = {
                ...agentPayload,
                status: agentPayload.status ?? "active",
                config: {
                    ...(existing?.config ?? {}),
                    ...(agentPayload.config ?? {}),
                    runtimeWorkspacePath: workspacePath,
                    agentDir: agentDir ?? agentPayload.config?.agentDir ?? existing?.config?.agentDir,
                    runtimeSource: "openclaw.json",
                },
                createdAt: existing?.createdAt ?? now,
                updatedAt: now,
            };

            if (existing) {
                await ctx.db.patch(existing._id, payload);
            } else {
                await ctx.db.insert("agents", payload);
            }
            upserted++;
        }

        for (const tenantId of tenantIds) {
            const existingAgents = await ctx.db
                .query("agents")
                .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
                .collect();
            for (const agent of existingAgents) {
                if (agent.config?.runtimeSource !== "openclaw.json") {
                    continue;
                }
                if (!seen.has(`${tenantId}::${agent.agentId}`)) {
                    await ctx.db.patch(agent._id, {
                        status: "inactive",
                        updatedAt: now,
                    });
                    deleted++;
                }
            }
        }

        return { upserted, deleted };
    },
});

/**
 * Triggers an agent task (mock action).
 */
export const runAgentTask = action({
    args: { agentId: v.id("agents") },
    returns: v.null(),
    handler: async (ctx, args) => {
        console.log(`Instructing agent ${args.agentId} to perform latest task...`);
        return null;
    },
});
