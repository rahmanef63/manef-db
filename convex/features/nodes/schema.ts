import { defineTable } from "convex/server";
import { v } from "convex/values";

export const nodesSchema = {
    nodes: defineTable({
        nodeId: v.string(),
        name: v.string(),
        host: v.string(), // "gateway" | "node-xxx"
        online: v.boolean(),
        capabilities: v.optional(v.array(v.string())),
        platform: v.optional(v.string()),
        lastSeenAt: v.float64(),
        tenantId: v.optional(v.string()),
        createdAt: v.float64(),
        updatedAt: v.float64(),
    })
        .index("by_nodeId", ["nodeId"])
        .index("by_online", ["online"])
        .index("by_tenant", ["tenantId"]),

    execApprovals: defineTable({
        host: v.string(),   // "gateway" | node name
        agentId: v.string(), // "*" or specific agent
        securityMode: v.string(),    // "allow" | "deny"
        askMode: v.string(),         // "on_miss" | "always" | "never"
        askFallback: v.string(),     // "allow" | "deny"
        autoAllowSkillClis: v.boolean(),
        allowList: v.optional(v.array(v.string())),
        denyList: v.optional(v.array(v.string())),
        tenantId: v.optional(v.string()),
        updatedAt: v.float64(),
    })
        .index("by_host_agent", ["host", "agentId"])
        .index("by_tenant", ["tenantId"]),

    nodeBindings: defineTable({
        agentId: v.string(),
        nodeId: v.string(),
        tenantId: v.optional(v.string()),
        createdAt: v.float64(),
    })
        .index("by_agent", ["agentId"])
        .index("by_node", ["nodeId"])
        .index("by_tenant", ["tenantId"]),
};
