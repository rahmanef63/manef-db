import { defineTable } from "convex/server";
import { v } from "convex/values";

export const agentsSchema = {
    agentDelegations: defineTable({
        allowedSkills: v.optional(v.array(v.string())),
        allowedTools: v.optional(v.array(v.string())),
        childAgentId: v.string(),
        createdAt: v.float64(),
        notes: v.optional(v.string()),
        parentAgentId: v.string(),
        relationType: v.optional(v.string()),
        status: v.optional(v.string()),
        updatedAt: v.float64(),
    })
        .index("by_child", ["childAgentId"])
        .index("by_pair", ["parentAgentId", "childAgentId"])
        .index("by_parent", ["parentAgentId"])
        .index("by_status", ["status"]),
    agentIdentity: defineTable({
        agentId: v.string(),
        avatar: v.optional(v.string()),
        creature: v.optional(v.string()),
        emoji: v.optional(v.string()),
        identityContent: v.optional(v.string()),
        name: v.optional(v.string()),
        soulContent: v.optional(v.string()),
        updatedAt: v.float64(),
        version: v.float64(),
        vibe: v.optional(v.string()),
    }).index("by_agentId", ["agentId"]),
    agentOperations: defineTable({
        agentId: v.string(),
        operationsContent: v.string(),
        rules: v.optional(
            v.array(v.object({ category: v.string(), rule: v.string() }))
        ),
        updatedAt: v.float64(),
        version: v.float64(),
    }).index("by_agentId", ["agentId"]),
    agents: defineTable({
        agentId: v.string(),
        agentsMd: v.optional(v.string()),
        bootstrapMd: v.optional(v.string()),
        capabilities: v.optional(v.array(v.string())),
        config: v.optional(v.any()),
        createdAt: v.float64(),
        heartbeatMd: v.optional(v.string()),
        identityMd: v.optional(v.string()),
        isActive: v.optional(v.string()),
        lastActiveAt: v.optional(v.float64()),
        memoryMd: v.optional(v.string()),
        model: v.optional(v.string()),
        name: v.string(),
        owner: v.optional(v.id("userProfiles")),
        soulMd: v.optional(v.string()),
        status: v.optional(v.string()),
        tenantId: v.optional(v.string()),
        toolsMd: v.optional(v.string()),
        type: v.string(),
        updatedAt: v.float64(),
        userMd: v.optional(v.string()),
    })
        .index("by_agentId", ["agentId"])
        .index("by_isActive", ["isActive"])
        .index("by_owner", ["owner"])
        .index("by_status", ["status"])
        .index("by_tenant", ["tenantId"]),
    toolsConfig: defineTable({
        agentId: v.string(),
        cameraNames: v.optional(
            v.array(
                v.object({
                    id: v.string(),
                    location: v.optional(v.string()),
                    name: v.string(),
                })
            )
        ),
        sshHosts: v.optional(
            v.array(
                v.object({
                    alias: v.string(),
                    host: v.string(),
                    user: v.optional(v.string()),
                })
            )
        ),
        toolsContent: v.string(),
        updatedAt: v.float64(),
        version: v.float64(),
        voicePreferences: v.optional(
            v.object({
                defaultSpeaker: v.optional(v.string()),
                preferredVoice: v.optional(v.string()),
            })
        ),
    }).index("by_agentId", ["agentId"]),
};
