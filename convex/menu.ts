import { v } from "convex/values";
import { mutation, query } from "./functions";
import { viewerHasPermissionX } from "./permissions";

export const listOverrides = query({
  args: {
    workspaceId: v.id("workspaces"),
  },
  async handler(ctx, { workspaceId }) {
    if (ctx.viewer === null) {
      return null;
    }

    const member = await ctx
      .table("members", "workspaceUser", (q: any) =>
        q.eq("workspaceId", workspaceId).eq("userId", ctx.viewerX()._id)
      )
      .unique();

    if (member === null) {
      return null;
    }

    const overrides = await ctx
      .table("menuItemOverrides", "workspaceId", (q: any) => q.eq("workspaceId", workspaceId))
      .map((doc: any) => doc);

    return overrides.map((override: any) => ({
      featureId: override.featureId,
      label: override.label,
      icon: override.icon,
      hidden: override.hidden,
      order: override.order,
      groupIds: override.groupIds,
      projectId: override.projectId,
    }));
  },
});

export const viewerRole = query({
  args: {
    workspaceId: v.id("workspaces"),
  },
  async handler(ctx, { workspaceId }) {
    if (ctx.viewer === null) {
      return null;
    }

    const member = await ctx
      .table("members", "workspaceUser", (q: any) =>
        q.eq("workspaceId", workspaceId).eq("userId", ctx.viewerX()._id)
      )
      .unique();

    if (member === null) {
      return null;
    }

    return (await member.edge("role")).name;
  },
});

const overridePatch = v.object({
  label: v.optional(v.string()),
  icon: v.optional(v.string()),
  hidden: v.optional(v.boolean()),
  order: v.optional(v.number()),
  groupIds: v.optional(v.array(v.string())),
  projectId: v.optional(v.string()),
});

export const upsertOverride = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    featureId: v.string(),
    patch: overridePatch,
  },
  async handler(ctx, { workspaceId, featureId, patch }) {
    await viewerHasPermissionX(ctx, workspaceId, "Manage Menu");

    const cleanedPatch = Object.fromEntries(
      Object.entries(patch).filter(([, value]) => value !== undefined)
    );

    const existing = await ctx
      .table("menuItemOverrides", "workspaceFeature", (q: any) =>
        q.eq("workspaceId", workspaceId).eq("featureId", featureId)
      )
      .unique();

    if (existing) {
      await existing.patch(cleanedPatch);
      return existing._id;
    }

    return await ctx.table("menuItemOverrides").insert({
      workspaceId,
      featureId,
      ...cleanedPatch,
    });
  },
});

export const clearOverride = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    featureId: v.string(),
  },
  async handler(ctx, { workspaceId, featureId }) {
    await viewerHasPermissionX(ctx, workspaceId, "Manage Menu");

    const existing = await ctx
      .table("menuItemOverrides", "workspaceFeature", (q: any) =>
        q.eq("workspaceId", workspaceId).eq("featureId", featureId)
      )
      .unique();

    if (existing) {
      await existing.delete();
    }
  },
});
