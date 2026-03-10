import { ConvexError, v } from "convex/values";
import { internalMutation, mutation } from "./functions";
import { ensureDefaultRolesSetup } from "./permissions";
import { defaultToAccessWorkspaceSlug, getUniqueSlug } from "./users/workspaces";
import { createMember } from "./users/workspaces/members";
import { createAppError } from "../shared/app-errors.js";
import {
  buildPersonalWorkspaceName,
  buildPersonalWorkspaceSlugSource,
} from "../shared/workspaces.js";

export const store = mutation({
  args: {},
  handler: async (ctx): Promise<string> => {
    const identity = await ctx.auth.getUserIdentity();
    const fallbackEmail = process.env.AUTH_ADMIN_EMAIL ?? "admin@example.com";
    const email = identity?.email ?? fallbackEmail;
    const tokenIdentifier = identity?.tokenIdentifier ?? `session:${email}`;
    const nameFallback = emailUserName(email);
    const userFields = {
      fullName: identity?.name ?? nameFallback,
      tokenIdentifier,
      email,
      pictureUrl: identity?.pictureUrl,
      firstName: identity?.givenName,
      lastName: identity?.familyName,
    };

    const existingUser = await ctx
      .table("users")
      .get("tokenIdentifier", tokenIdentifier);
    if (existingUser !== null) {
      await existingUser.patch(userFields);
      return ensurePersonalWorkspace(ctx, existingUser, email);
    }
    let user = await ctx.table("users").get("email", email);
    if (user !== null) {
      await user.patch(userFields);
      return ensurePersonalWorkspace(ctx, user, email);
    } else {
      user = await ctx.table("users").insert(userFields).get();
      return ensurePersonalWorkspace(ctx, user, email);
    }
  },
});

export const storeFromSession = mutation({
  args: {
    email: v.string(),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<string> => {
    const email = args.email.trim().toLowerCase();
    const tokenIdentifier = `session:${email}`;

    const existingUser = await ctx
      .table("users")
      .get("tokenIdentifier", tokenIdentifier);
    if (existingUser !== null) {
      await existingUser.patch({
        email,
        fullName: args.name ?? existingUser.fullName,
      });
      return ensurePersonalWorkspace(ctx, existingUser, email);
    }

    let user = await ctx.table("users").get("email", email);
    const nameFallback = emailUserName(email);
    const fullName = args.name ?? nameFallback;
    const userFields = {
      fullName,
      tokenIdentifier,
      email,
    };
    if (user !== null) {
      await user.patch(userFields);
      return ensurePersonalWorkspace(ctx, user, email);
    }

    user = await ctx.table("users").insert(userFields).get();
    return ensurePersonalWorkspace(ctx, user, email);
  },
});

function emailUserName(email: string) {
  return email.split("@")[0];
}

async function ensurePersonalWorkspace(ctx: any, user: any, email: string) {
  const existingSlug = await defaultToAccessWorkspaceSlug(user);
  if (existingSlug !== "main") {
    return existingSlug;
  }

  const membership = await user.edge("members").first();
  if (membership) {
    const workspaceId = membership.workspaceId;
    const workspace = await ctx.table("workspaces").get(workspaceId);
    if (workspace) {
      return workspace.slug;
    }
  }

  const slug = await getUniqueSlug(ctx, buildPersonalWorkspaceSlugSource(email));
  const workspaceId = await ctx
    .table("workspaces")
    .insert({
      isPersonal: true,
      name: buildPersonalWorkspaceName(email),
      slug,
    });
  const adminRole = await ensureDefaultRolesSetup(ctx);

  await createMember(ctx, {
    workspaceId,
    user,
    roleId: adminRole._id,
  });

  const workspace = await ctx.table("workspaces").get(workspaceId);
  if (!workspace) {
    throw new ConvexError(createAppError("WORKSPACE_BOOTSTRAP_FAILED"));
  }

  return workspace.slug;
}

// export const foo = internalMutation({
//   args: {},
//   handler: async (ctx) => {
//     await ctx.table("as", "b", (q) => q.eq("_creationTime" as any, 3 as any));
//   },
// });
