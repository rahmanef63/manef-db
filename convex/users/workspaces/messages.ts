import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { mutation, query } from "../../functions";
import { viewerHasPermission, viewerWithPermissionX } from "../../permissions";
import { createAppError } from "../../../shared/app-errors.js";

export const list = query({
  args: {
    workspaceId: v.id("workspaces"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, { workspaceId, paginationOpts }) => {
    if (
      ctx.viewer === null ||
      !(await viewerHasPermission(ctx, workspaceId, "Contribute"))
    ) {
      return {
        page: [],
        isDone: true,
        continueCursor: "",
      };
    }
    return await ctx
      .table("workspaces")
      .getX(workspaceId)
      .edge("messages")
      .order("desc")
      .paginate(paginationOpts)
      .map(async (message: any) => {
        const member = await message.edge("member");
        const user = await member.edge("user");
        return {
          _id: message._id,
          _creationTime: message._creationTime,
          text: message.text,
          author: user.firstName ?? user.fullName,
          authorPictureUrl: user.pictureUrl,
          isAuthorDeleted: false,
        };
      });
  },
});

export const create = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    text: v.string(),
  },
  handler: async (ctx, { workspaceId, text }) => {
    const member = await viewerWithPermissionX(ctx, workspaceId, "Contribute");
    if (text.trim().length === 0) {
      throw new ConvexError(createAppError("MESSAGES_EMPTY"));
    }
    await ctx.table("messages").insert({
      text,
      workspaceId: workspaceId,
      memberId: member._id,
    });
  },
});
