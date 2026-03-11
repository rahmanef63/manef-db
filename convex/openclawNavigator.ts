import { query } from "./_generated/server";
import { v } from "convex/values";

function normalizeEmail(email: string | null | undefined) {
  return email?.trim().toLowerCase() ?? null;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function buildScopeSlug(parts: Array<string | null | undefined>) {
  const base = slugify(parts.filter(Boolean).join("-")) || "scope";
  return base;
}

export const listScopes = query({
  args: {},
  returns: v.object({
    isAdmin: v.boolean(),
    roots: v.array(
      v.object({
        _id: v.id("workspaceTrees"),
        agentId: v.optional(v.string()),
        agentIds: v.array(v.string()),
        childCount: v.number(),
        children: v.array(
          v.object({
            _id: v.id("workspaceTrees"),
            agentId: v.optional(v.string()),
            agentIds: v.array(v.string()),
            name: v.string(),
            ownerEmail: v.optional(v.string()),
            ownerId: v.optional(v.id("userProfiles")),
            ownerName: v.string(),
            ownerPhone: v.optional(v.string()),
            rootPath: v.string(),
            slug: v.string(),
            type: v.string(),
          }),
        ),
        name: v.string(),
        ownerEmail: v.optional(v.string()),
        ownerId: v.optional(v.id("userProfiles")),
        ownerName: v.string(),
        ownerPhone: v.optional(v.string()),
        rootPath: v.string(),
        slug: v.string(),
        type: v.string(),
      }),
    ),
    viewerEmail: v.optional(v.string()),
  }),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    const viewerEmail = normalizeEmail(identity?.email);

    if (!viewerEmail) {
      return {
        isAdmin: false,
        roots: [],
        viewerEmail: undefined,
      };
    }

    const authUser = await ctx.db
      .query("authUsers")
      .withIndex("by_email", (q) => q.eq("email", viewerEmail))
      .first();
    const isAdmin = (authUser?.roles ?? []).some(
      (role) => role.trim().toLowerCase() === "admin",
    );

    const visibleProfiles = isAdmin
      ? await ctx.db.query("userProfiles").collect()
      : await ctx.db
          .query("userProfiles")
          .withIndex("by_email", (q) => q.eq("email", viewerEmail))
          .collect();

    const visibleOwnerIds = new Set(
      visibleProfiles.map((profile) => profile._id),
    );

    if (visibleOwnerIds.size === 0) {
      return {
        isAdmin,
        roots: [],
        viewerEmail,
      };
    }

    const profilesById = new Map(
      visibleProfiles.map((profile) => [profile._id, profile]),
    );

    const workspaceTrees = (
      await Promise.all(
        visibleProfiles.map((profile) =>
          ctx.db
            .query("workspaceTrees")
            .withIndex("by_owner", (q) => q.eq("ownerId", profile._id))
            .collect(),
        ),
      )
    ).flat();

    const treesById = new Map(workspaceTrees.map((tree) => [tree._id, tree]));
    const childrenByParent = new Map<
      string,
      Array<(typeof workspaceTrees)[number]>
    >();

    for (const tree of workspaceTrees) {
      if (!tree.parentId) {
        continue;
      }
      const key = tree.parentId;
      const next = childrenByParent.get(key) ?? [];
      next.push(tree);
      childrenByParent.set(key, next);
    }

    const collectDescendants = (
      treeId: (typeof workspaceTrees)[number]["_id"],
    ): Array<(typeof workspaceTrees)[number]> => {
      const directChildren =
        childrenByParent.get(treeId as string)?.sort((a, b) =>
          a.name.localeCompare(b.name),
        ) ?? [];
      return directChildren.flatMap((child) => [
        child,
        ...collectDescendants(child._id),
      ]);
    };

    const roots = workspaceTrees
      .filter((tree) => {
        if (!tree.parentId) {
          return true;
        }
        const parent = treesById.get(tree.parentId);
        return parent == null || !visibleOwnerIds.has(parent.ownerId as any);
      })
      .sort((a, b) => {
        const aProfile = a.ownerId ? profilesById.get(a.ownerId) : null;
        const bProfile = b.ownerId ? profilesById.get(b.ownerId) : null;
        const byOwner = (aProfile?.name ?? a.name).localeCompare(
          bProfile?.name ?? b.name,
        );
        if (byOwner !== 0) {
          return byOwner;
        }
        return a.name.localeCompare(b.name);
      })
      .map((root) => {
        const profile = root.ownerId ? profilesById.get(root.ownerId) : null;
        const descendants = collectDescendants(root._id);
        const rootAgentIds = [root.agentId, ...descendants.map((tree) => tree.agentId)]
          .filter((value): value is string => Boolean(value));

        const children = descendants.map((child) => {
          const childProfile = child.ownerId
            ? profilesById.get(child.ownerId)
            : profile;
          const childDescendantAgentIds = [
            child.agentId,
            ...collectDescendants(child._id).map((tree) => tree.agentId),
          ].filter((value): value is string => Boolean(value));

          return {
            _id: child._id,
            agentId: child.agentId,
            agentIds: Array.from(new Set(childDescendantAgentIds)),
            name:
              child.type === "user"
                ? childProfile?.name ?? child.name
                : child.name,
            ownerEmail: childProfile?.email,
            ownerId: child.ownerId,
            ownerName: childProfile?.name ?? child.name,
            ownerPhone: childProfile?.phone,
            rootPath: child.rootPath,
            slug: buildScopeSlug([
              childProfile?.name ?? child.name,
              child.agentId,
              child._id,
            ]),
            type: child.type,
          };
        });

        return {
          _id: root._id,
          agentId: root.agentId,
          agentIds: Array.from(new Set(rootAgentIds)),
          childCount: children.length,
          children,
          name:
            root.type === "user" ? profile?.name ?? root.name : root.name,
          ownerEmail: profile?.email,
          ownerId: root.ownerId,
          ownerName: profile?.name ?? root.name,
          ownerPhone: profile?.phone,
          rootPath: root.rootPath,
          slug: buildScopeSlug([
            profile?.name ?? root.name,
            root.agentId,
            root._id,
          ]),
          type: root.type,
        };
      });

    return {
      isAdmin,
      roots,
      viewerEmail,
    };
  },
});
