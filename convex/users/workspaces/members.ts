import { ConvexError, v } from "convex/values";
import { mutation, query } from "../../functions";
import {
  getRole,
  viewerHasPermission,
  viewerHasPermissionX,
} from "../../permissions";
import { Ent, MutationCtx, QueryCtx } from "../../types";
import { paginationOptsValidator } from "convex/server";
import { emptyPage, normalizeStringForSearch } from "../../utils";
import { Id } from "../../_generated/dataModel";
import { createAppError } from "../../../shared/app-errors.js";

export const viewerPermissions = query({
  args: {
    workspaceId: v.optional(v.id("workspaces")),
  },
  async handler(ctx, { workspaceId }) {
    if (workspaceId === undefined || ctx.viewer === null) {
      return null;
    }
    return await ctx
      .table("members", "workspaceUser", (q: any) =>
        q.eq("workspaceId", workspaceId).eq("userId", ctx.viewerX()._id)
      )
      .uniqueX()
      .edge("role")
      .edge("permissions")
      .map((permission: any) => permission.name);
  },
});

export const list = query({
  args: {
    workspaceId: v.id("workspaces"),
    search: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  async handler(ctx, { workspaceId, search, paginationOpts }) {
    if (
      ctx.viewer === null ||
      !(await viewerHasPermission(ctx, workspaceId, "Read Members"))
    ) {
      return emptyPage();
    }
    const query =
      search === ""
        ? ctx.table("workspaces").getX(workspaceId).edge("members")
        : ctx
          .table("members")
          .search("searchable", (q: any) =>
            q
              .search("searchable", normalizeStringForSearch(search))
              .eq("workspaceId", workspaceId)
          );
    return await query
      .paginate(paginationOpts)
      .map(async (member: any) => {
        const user = await member.edge("user");
        return {
          _id: member._id,
          fullName: user.fullName,
          email: user.email,
          pictureUrl: user.pictureUrl,
          initials:
            user.firstName === undefined || user.lastName === undefined
              ? user.fullName[0]
              : user.firstName[0] + user.lastName[0],
          roleId: member.roleId,
        };
      });
  },
});

export const update = mutation({
  args: {
    memberId: v.id("members"),
    roleId: v.id("roles"),
  },
  async handler(ctx, { memberId, roleId }) {
    const member = await ctx.table("members").getX(memberId);
    await viewerHasPermissionX(ctx, member.workspaceId, "Manage Members");
    await checkAnotherAdminExists(ctx, member);
    await member.patch({ roleId });
  },
});

export const deleteMember = mutation({
  args: {
    memberId: v.id("members"),
  },
  async handler(ctx, { memberId }) {
    const member = await ctx.table("members").getX(memberId);
    await viewerHasPermissionX(ctx, member.workspaceId, "Manage Members");
    await checkAnotherAdminExists(ctx, member);
    await ctx.table("members").getX(memberId).delete();
  },
});

async function checkAnotherAdminExists(ctx: QueryCtx, member: Ent<"members">) {
  const adminRole = await getRole(ctx, "Admin");
  const otherAdmin = await ctx
    .table("workspaces")
    .getX(member.workspaceId)
    .edge("members")
    .filter((q: any) =>
      q.and(
        q.eq(q.field("roleId"), adminRole._id),
        q.neq(q.field("_id"), member._id)
      )
    )
    .first();
  if (otherAdmin === null) {
    throw new ConvexError(createAppError("MEMBERS_LAST_ADMIN"));
  }
}

export async function createMember(
  ctx: MutationCtx,
  {
    workspaceId,
    roleId,
    user,
  }: { workspaceId: Id<"workspaces">; roleId: Id<"roles">; user: Ent<"users"> }
) {
  return await ctx.table("members").insert({
    workspaceId,
    userId: user._id,
    roleId,
    searchable: normalizeStringForSearch(`${user.fullName} ${user.email}`),
  });
}
