import { ConvexError, Infer, v } from "convex/values";
import { MutationCtx, QueryCtx } from "./types";
import { Id } from "./_generated/dataModel";
import { createAppError } from "../shared/app-errors.js";

export type { Permission, Role } from "./permissions_schema";
import { Permission, Role } from "./permissions_schema";

const DEFAULT_PERMISSION_NAMES: Permission[] = [
  "Manage Workspace",
  "Delete Workspace",
  "Manage Members",
  "Read Members",
  "Contribute",
  "Manage Menu",
];

const DEFAULT_ROLE_CONFIG: Record<
  Role,
  { isDefault: boolean; permissions: Permission[] }
> = {
  Admin: {
    isDefault: false,
    permissions: DEFAULT_PERMISSION_NAMES,
  },
  Member: {
    isDefault: true,
    permissions: ["Read Members", "Contribute"],
  },
};

export async function getPermission(ctx: QueryCtx, name: Permission) {
  const permission = await ctx.table("permissions").get("name", name);
  return permission?._id ?? null;
}

export async function getRole(ctx: QueryCtx, name: Role) {
  return await ctx.table("roles").getX("name", name);
}

export async function ensureDefaultRolesSetup(ctx: MutationCtx) {
  const permissionIds = new Map<Permission, Id<"permissions">>();

  for (const permissionName of DEFAULT_PERMISSION_NAMES) {
    let permission = await ctx.table("permissions").get("name", permissionName);
    if (permission === null) {
      const permissionId = await ctx
        .table("permissions")
        .insert({ name: permissionName });
      permission = await ctx.table("permissions").getX(permissionId);
    }
    permissionIds.set(permissionName, permission._id);
  }

  const adminRole = await ensureRole(ctx, "Admin", {
    ...DEFAULT_ROLE_CONFIG.Admin,
    permissionIds,
  });
  await ensureRole(ctx, "Member", {
    ...DEFAULT_ROLE_CONFIG.Member,
    permissionIds,
  });

  return adminRole;
}

async function ensureRole(
  ctx: MutationCtx,
  name: Role,
  {
    isDefault,
    permissionIds,
    permissions,
  }: {
    isDefault: boolean;
    permissionIds: Map<Permission, Id<"permissions">>;
    permissions: Permission[];
  }
) {
  const rolePermissionIds = permissions.map((permissionName) => {
    const permissionId = permissionIds.get(permissionName);
    if (permissionId === undefined) {
      throw new Error(`Missing default permission setup for ${permissionName}`);
    }
    return permissionId;
  });

  let role = await ctx.table("roles").get("name", name);
  if (role === null) {
    const roleId = await ctx.table("roles").insert({
      name,
      isDefault,
      permissions: rolePermissionIds,
    });
    return await ctx.table("roles").getX(roleId);
  }

  const currentPermissionIds = await role
    .edge("permissions")
    .map((permission: any) => permission._id as Id<"permissions">);
  if (
    role.isDefault !== isDefault ||
    !sameIds(currentPermissionIds, rolePermissionIds)
  ) {
    await role.patch({
      isDefault,
      permissions: rolePermissionIds,
    });
    role = await ctx.table("roles").getX(role._id);
  }

  return role;
}

function sameIds(left: Id<"permissions">[], right: Id<"permissions">[]) {
  if (left.length !== right.length) {
    return false;
  }
  const leftSorted = [...left].sort();
  const rightSorted = [...right].sort();
  return leftSorted.every((value, index) => value === rightSorted[index]);
}

export async function viewerWithPermission(
  ctx: QueryCtx,
  workspaceId: Id<"workspaces">,
  name: Permission
) {
  const permissionId = await getPermission(ctx, name);
  if (permissionId === null) {
    return null;
  }

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
      .has(permissionId))
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
    throw new ConvexError(
      createAppError("COMMON_PERMISSION_DENIED", {
        details: [`Permission required: ${name}`],
        meta: { permission: name, workspaceId },
      })
    );
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
