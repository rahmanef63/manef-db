import { ConvexError, v } from "convex/values";
import { mutation, query } from "../functions";
import {
  ensureDefaultRolesSetup,
  viewerHasPermissionX,
} from "../permissions";
import { Ent, QueryCtx } from "../types";
import { slugify } from "../utils";
import { createMember } from "./workspaces/members";
import { createAppError } from "../../shared/app-errors.js";

export async function defaultToAccessWorkspaceSlug(viewer: Ent<"users">) {
  const workspaces = await viewer.edge("members").map((member: any) => member.edge("workspace").doc());
  const personal = workspaces.find((workspace) => workspace.isPersonal);
  if (personal) return personal.slug;
  return workspaces[0]?.slug ?? "main";
}

export const list = query({
  args: {},
  async handler(ctx) {
    if (ctx.viewer === null) {
      return null;
    }
    return await ctx.viewer
      .edge("members")
      .map(async (member: any) => {
        const workspace = await member.edge("workspace");
        return {
          _id: workspace._id,
          name: workspace.name,
          slug: workspace.slug,
          isPersonal: workspace.isPersonal,
          pictureUrl: workspace.isPersonal ? ctx.viewer!.pictureUrl : null,
          isDeleted: false,
        };
      })
      .filter((member: any) => !member.isDeleted);
  },
});

export const create = mutation({
  args: {
    name: v.string(),
  },
  async handler(ctx, { name }) {
    const normalizedName = normalizeWorkspaceName(name);
    const slug = await getUniqueSlug(ctx, normalizedName);
    const workspaceId = await ctx
      .table("workspaces")
      .insert({ name: normalizedName, isPersonal: false, slug });
    const adminRole = await ensureDefaultRolesSetup(ctx);
    await createMember(ctx, {
      workspaceId,
      user: ctx.viewerX(),
      roleId: adminRole._id,
    });
    return slug;
  },
});

export const update = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    name: v.string(),
  },
  async handler(ctx, { workspaceId, name }) {
    await viewerHasPermissionX(ctx, workspaceId, "Manage Workspace");
    const workspace = await ctx.table("workspaces").getX(workspaceId);
    await workspace.patch({ name: normalizeWorkspaceName(name) });
  },
});

export const deleteWorkspace = mutation({
  args: {
    workspaceId: v.id("workspaces"),
  },
  async handler(ctx, { workspaceId }) {
    await viewerHasPermissionX(ctx, workspaceId, "Delete Workspace");
    const workspace = await ctx.table("workspaces").getX(workspaceId);
    await workspace.delete();
    if (workspace.isPersonal) {
      await ctx.viewerX().delete();
    }
  },
});

export async function getUniqueSlug(ctx: QueryCtx, name: string) {
  const base = slugify(name) || "workspace";
  let slug;
  let n = 0;
  for (; ;) {
    slug = n === 0 ? base : `${base}-${n}`;
    const existing = await ctx.table("workspaces").get("slug", slug);
    if (existing === null) {
      break;
    }
    n++;
  }
  return slug;
}

function normalizeWorkspaceName(name: string) {
  const normalized = name.trim().replace(/\s+/g, " ");
  if (normalized.length === 0) {
    throw new ConvexError(createAppError("WORKSPACE_NAME_REQUIRED"));
  }
  if (normalized.length < 3) {
    throw new ConvexError(
      createAppError("WORKSPACE_NAME_TOO_SHORT", {
        meta: { minLength: 3 },
      })
    );
  }
  return normalized;
}
