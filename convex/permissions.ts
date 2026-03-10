import { Infer, v } from "convex/values";
import { MutationCtx, QueryCtx } from "./types";
import { Id } from "./_generated/dataModel";

export type { Permission, Role } from "./permissions_schema";
import { Permission, Role } from "./permissions_schema";

export async function getPermission(ctx: QueryCtx, name: Permission) {
  return (await ctx.table("permissions").getX("name", name))._id;
}

export async function getRole(ctx: QueryCtx, name: Role) {
  return await ctx.table("roles").getX("name", name);
}

export async function viewerWithPermission(
  ctx: QueryCtx,
  workspaceId: Id<"workspaces">,
  name: Permission
) {
  const member = await ctx
    .table("members", "workspaceUser", (q: any) =>
      q.eq("workspaceId", workspaceId).eq("userId", ctx.viewerX()._id)
    )
    .unique();
  if (
    member === null ||
    !(await member
      .edge("role")
      .edge("permissions")
      .has(await getPermission(ctx, name)))
  ) {
    return null;
  }
  return member;
}

export async function viewerHasPermission(
  ctx: QueryCtx,
  workspaceId: Id<"workspaces">,
  name: Permission
) {
  const member = await viewerWithPermission(ctx, workspaceId, name);
  return member !== null;
}

export async function viewerWithPermissionX(
  ctx: MutationCtx,
  workspaceId: Id<"workspaces">,
  name: Permission
) {
  const member = await viewerWithPermission(ctx, workspaceId, name);
  if (member === null) {
    throw new Error(`Viewer does not have the permission "${name}"`);
  }
  return member;
}

export async function viewerHasPermissionX(
  ctx: MutationCtx,
  workspaceId: Id<"workspaces">,
  name: Permission
) {
  await viewerWithPermissionX(ctx, workspaceId, name);
  return true;
}
