import { defineTable } from "convex/server";
import { v } from "convex/values";

const syncStatus = v.union(
  v.literal("pending"),
  v.literal("processing"),
  v.literal("done"),
  v.literal("failed")
);

const syncDirection = v.union(
  v.literal("pull"),
  v.literal("push"),
  v.literal("reconcile")
);

export const coreSchema = {
    tenantCrudItems: defineTable({
        createdAt: v.float64(),
        createdBy: v.optional(v.string()),
        deletedAt: v.optional(v.float64()),
        key: v.string(),
        metadata: v.optional(v.any()),
        tenantId: v.string(),
        updatedAt: v.float64(),
        value: v.string(),
    })
        .index("by_tenant", ["tenantId"])
        .index("by_tenant_deleted", ["tenantId", "deletedAt"])
        .index("by_tenant_key", ["tenantId", "key"]),

    syncOutbox: defineTable({
        attemptCount: v.float64(),
        createdAt: v.float64(),
        entityKey: v.string(),
        entityType: v.string(),
        eventId: v.string(),
        lastError: v.optional(v.string()),
        operation: v.string(),
        payload: v.optional(v.any()),
        processedAt: v.optional(v.float64()),
        source: v.optional(v.string()),
        status: syncStatus,
        tenantId: v.optional(v.string()),
        updatedAt: v.float64(),
    })
        .index("by_eventId", ["eventId"])
        .index("by_status", ["status"])
        .index("by_tenant", ["tenantId"])
        .index("by_tenant_status", ["tenantId", "status"])
        .index("by_entity", ["entityType", "entityKey"]),

    syncRuns: defineTable({
        direction: syncDirection,
        endedAt: v.optional(v.float64()),
        error: v.optional(v.string()),
        runId: v.string(),
        source: v.string(),
        startedAt: v.float64(),
        stats: v.optional(v.any()),
        status: syncStatus,
        tenantId: v.optional(v.string()),
        updatedAt: v.float64(),
    })
        .index("by_runId", ["runId"])
        .index("by_status", ["status"])
        .index("by_direction", ["direction"])
        .index("by_tenant", ["tenantId"]),

    syncState: defineTable({
        createdAt: v.float64(),
        key: v.string(),
        notes: v.optional(v.string()),
        tenantId: v.optional(v.string()),
        updatedAt: v.float64(),
        value: v.any(),
    })
        .index("by_key", ["key"])
        .index("by_tenant", ["tenantId"])
        .index("by_tenant_key", ["tenantId", "key"]),
};
