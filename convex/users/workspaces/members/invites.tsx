import { ConvexError, v } from "convex/values";
import { Resend } from "resend";
import { INVITE_PARAM } from "../../../../shared/constants/invite";
import { Id } from "../../../_generated/dataModel";
import { action } from "../../../_generated/server";
import { internalMutation, mutation, query } from "../../../functions";
import {
  viewerHasPermission,
  viewerHasPermissionX,
} from "../../../permissions";
import { makeFunctionReference } from "convex/server";
import type { Ent } from "../../../types";

const prepareInviteRef = makeFunctionReference<
  "mutation",
  { workspaceId: Id<"workspaces"> },
  { inviterEmail: string; workspaceName: string }
>("users/workspaces/members/invites:prepare");

const createInviteRef = makeFunctionReference<
  "mutation",
  {
    workspaceId: Id<"workspaces">;
    email: string;
    roleId: Id<"roles">;
    inviterEmail: string;
  },
  Id<"invites">
>("users/workspaces/members/invites:create");

const deleteInviteRef = makeFunctionReference<
  "mutation",
  { inviteId: Id<"invites"> },
  void
>("users/workspaces/members/invites:deleteInvite");

export const list = query({
  args: {
    workspaceId: v.optional(v.id("workspaces")),
  },
  async handler(ctx, { workspaceId }) {
    if (
      workspaceId === undefined ||
      ctx.viewer === null ||
      !(await viewerHasPermission(ctx, workspaceId, "Read Members"))
    ) {
      return null;
    }

    return await ctx
      .table("workspaces")
      .getX(workspaceId)
      .edge("invites")
      .map(async (invite: Ent<"invites">) => {
        return {
          _id: invite._id,
          email: invite.email,
          role: (await invite.edge("role")).name,
        };
      });
  },
});

export const deleteInvite = mutation({
  args: {
    inviteId: v.id("invites"),
  },
  async handler(ctx, { inviteId }) {
    const invite = await ctx.table("invites").getX(inviteId);
    await viewerHasPermissionX(ctx, invite.workspaceId, "Manage Members");
    await ctx.table("invites").getX(inviteId).delete();
  },
});

// To enable sending emails, set
// - `RESEND_API_KEY`
// - `HOSTED_URL` to the URL where your site is hosted
// on your Convex dashboard:
// https://dashboard.convex.dev/deployment/settings/environment-variables
// To test emails, override the email address by setting
// `OVERRIDE_INVITE_EMAIL`.
export const send = action({
  args: {
    workspaceId: v.id("workspaces"),
    email: v.string(),
    roleId: v.id("roles"),
  },
  async handler(ctx, { workspaceId, email, roleId }) {
    const { inviterEmail, workspaceName } = await ctx.runMutation(prepareInviteRef, {
      workspaceId,
    });
    const inviteId = await ctx.runMutation(createInviteRef, {
      workspaceId,
      email,
      roleId,
      inviterEmail,
    });
    try {
      await sendInviteEmail({ email, inviteId, inviterEmail, workspaceName });
    } catch (error) {
      await ctx.runMutation(deleteInviteRef, { inviteId });
      throw error;
    }
  },
});

export const prepare = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
  },
  async handler(ctx, { workspaceId }) {
    await viewerHasPermissionX(ctx, workspaceId, "Manage Members");
    return {
      inviterEmail: ctx.viewerX().email,
      workspaceName: (await ctx.table("workspaces").getX(workspaceId)).name,
    };
  },
});

export const create = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    email: v.string(),
    roleId: v.id("roles"),
    inviterEmail: v.string(),
  },
  async handler(ctx, { workspaceId, email, roleId, inviterEmail }) {
    return await ctx.table("invites").insert({
      workspaceId,
      email,
      roleId,
      inviterEmail,
    });
  },
});

async function sendInviteEmail({
  email,
  inviteId,
  inviterEmail,
  workspaceName,
}: {
  email: string;
  inviteId: Id<"invites">;
  inviterEmail: string;
  workspaceName: string;
}) {
  if (
    process.env.RESEND_API_KEY === undefined ||
    process.env.HOSTED_URL === undefined
  ) {
    console.error(
      "Set up `RESEND_API_KEY` and `HOSTED_URL` to send invite emails"
    );
    return;
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: "My App <onboarding@resend.dev>",
    to: [process.env.OVERRIDE_INVITE_EMAIL ?? email],
    subject: `${inviterEmail} invited you to join them in My App`,
    react: (
      <div>
        <strong>{inviterEmail}</strong> invited you to join workspace{" "}
        <strong>{workspaceName}</strong> in My App. Click{" "}
        <a
          href={`${process.env.HOSTED_URL}/dashboard?${INVITE_PARAM}=${inviteId}`}
        >
          here to accept
        </a>{" "}
        or log in to My App.
      </div>
    ),
  });

  if (error) {
    throw new ConvexError("Could not send invitation email");
  }
}
