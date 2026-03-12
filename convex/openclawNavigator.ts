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

function uniqueAgentIds(agentIds: string[]) {
  return Array.from(new Set(agentIds.filter(Boolean)));
}

function scopeSlugForTree(tree: {
  _id: string;
  agentId?: string | null;
  name: string;
}) {
  if (tree.agentId?.trim()) {
    return slugify(tree.agentId) || tree.agentId;
  }
  return buildScopeSlug([tree.name, tree._id]);
}

export const listScopes = query({
  args: {},
  returns: v.object({
    defaultScopeSlug: v.optional(v.string()),
    isAdmin: v.boolean(),
    roots: v.array(
      v.object({
        _id: v.id("workspaceTrees"),
        agentId: v.optional(v.string()),
        agentIds: v.array(v.string()),
        childCount: v.number(),
        featureKeys: v.array(v.string()),
        children: v.array(
          v.object({
            _id: v.id("workspaceTrees"),
            agentId: v.optional(v.string()),
            agentIds: v.array(v.string()),
            featureKeys: v.array(v.string()),
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
        defaultScopeSlug: undefined,
      };
    }

    const authUser = await ctx.db
      .query("authUsers")
      .withIndex("by_email", (q) => q.eq("email", viewerEmail))
      .first();
    const isAdmin = (authUser?.roles ?? []).some(
      (role) => role.trim().toLowerCase() === "admin",
    );

    const visibleProfiles = (isAdmin
      ? await ctx.db.query("userProfiles").collect()
      : authUser?.profileId
        ? (
            await Promise.all([ctx.db.get(authUser.profileId)])
          ).filter(
            (
              profile,
            ): profile is NonNullable<typeof profile> => profile !== null,
          )
        : await ctx.db
            .query("userProfiles")
            .withIndex("by_email", (q) => q.eq("email", viewerEmail))
            .collect()) as Array<{ _id: any; email?: string; name?: string; phone?: string }>;

    const visibleOwnerIds = new Set(
      visibleProfiles.map((profile) => profile._id),
    );

    if (visibleOwnerIds.size === 0) {
      return {
        isAdmin,
        roots: [],
        viewerEmail,
        defaultScopeSlug: undefined,
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

    const workspaceAgentLinks = await ctx.db.query("workspaceAgents").collect();
    const workspaceFeatureInstalls = await ctx.db
      .query("workspaceFeatureInstalls")
      .collect();
    const agentLinksByWorkspace = new Map<
      string,
      Array<(typeof workspaceAgentLinks)[number]>
    >();
    for (const link of workspaceAgentLinks) {
      const key = link.workspaceId as string;
      const next = agentLinksByWorkspace.get(key) ?? [];
      next.push(link);
      agentLinksByWorkspace.set(key, next);
    }
    const featureKeysByWorkspace = new Map<string, string[]>();
    for (const install of workspaceFeatureInstalls) {
      if (install.installState === "uninstalled") {
        continue;
      }
      const key = install.workspaceId as string;
      const next = featureKeysByWorkspace.get(key) ?? [];
      next.push(install.itemKey);
      featureKeysByWorkspace.set(key, next);
    }

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

    const getDirectChildren = (
      treeId: (typeof workspaceTrees)[number]["_id"],
    ): Array<(typeof workspaceTrees)[number]> => {
      return (
        childrenByParent.get(treeId as string)?.slice().sort((a, b) =>
          a.name.localeCompare(b.name),
        ) ?? []
      );
    };

    const collectDescendants = (
      treeId: (typeof workspaceTrees)[number]["_id"],
    ): Array<(typeof workspaceTrees)[number]> => {
      const directChildren = getDirectChildren(treeId);
      return directChildren.flatMap((child) => [child, ...collectDescendants(child._id)]);
    };

    const directAgentIdsForTree = (
      tree: (typeof workspaceTrees)[number],
    ): string[] => {
      const linked = agentLinksByWorkspace.get(tree._id as string) ?? [];
      const preferred = linked
        .slice()
        .sort((left, right) => {
          const leftWeight = left.isPrimary ? 0 : 1;
          const rightWeight = right.isPrimary ? 0 : 1;
          return leftWeight - rightWeight;
        })
        .map((link) => link.agentId);
      if (preferred.length > 0) {
        return Array.from(new Set(preferred));
      }
      return tree.agentId ? [tree.agentId] : [];
    };

    const primaryAgentIdForTree = (
      tree: (typeof workspaceTrees)[number],
    ): string | undefined => {
      const linked = agentLinksByWorkspace.get(tree._id as string) ?? [];
      const primary =
        linked.find((link) => link.isPrimary) ??
        linked.find((link) => link.relation === "primary") ??
        linked[0];
      return primary?.agentId ?? tree.agentId;
    };

    const featureKeysForTree = (
      tree: (typeof workspaceTrees)[number],
    ): string[] => {
      return Array.from(
        new Set([
          ...(tree.featureKeys ?? []),
          ...(featureKeysByWorkspace.get(tree._id as string) ?? []),
        ]),
      ).sort((left, right) => left.localeCompare(right, "en"));
    };

    const rawRoots = workspaceTrees
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
      .flatMap((root) => {
        const profile = root.ownerId ? profilesById.get(root.ownerId) : null;
        const visibleRoots =
          root.type === "user" && getDirectChildren(root._id).length > 0
            ? getDirectChildren(root._id)
            : [root];

        return visibleRoots.map((visibleRoot) => {
          const effectiveProfile =
            visibleRoot.ownerId ? profilesById.get(visibleRoot.ownerId) : profile;
          const directChildren = getDirectChildren(visibleRoot._id);
          const rootAgentIds = uniqueAgentIds([
            ...directAgentIdsForTree(visibleRoot),
            ...collectDescendants(visibleRoot._id).flatMap((tree) =>
              directAgentIdsForTree(tree),
            ),
          ]);

          const children = directChildren.map((child) => {
            const childProfile = child.ownerId
              ? profilesById.get(child.ownerId)
              : effectiveProfile;
            const childAgentIds = uniqueAgentIds([
              ...directAgentIdsForTree(child),
              ...collectDescendants(child._id).flatMap((tree) =>
                directAgentIdsForTree(tree),
              ),
            ]);

            return {
              _id: child._id,
              agentId: primaryAgentIdForTree(child),
              agentIds: childAgentIds,
              featureKeys: featureKeysForTree(child),
              name:
                child.type === "user"
                  ? childProfile?.name ?? child.name
                  : child.name,
              ownerEmail: childProfile?.email,
              ownerId: child.ownerId,
              ownerName: childProfile?.name ?? child.name,
              ownerPhone: childProfile?.phone,
              rootPath: child.rootPath,
              slug: scopeSlugForTree(child),
              type: child.type,
            };
          });

          return {
            _id: visibleRoot._id,
            agentId: primaryAgentIdForTree(visibleRoot),
            agentIds: rootAgentIds,
            childCount: children.length,
            featureKeys: featureKeysForTree(visibleRoot),
            children,
            name:
              visibleRoot.type === "user"
                ? effectiveProfile?.name ?? visibleRoot.name
                : visibleRoot.name,
            ownerEmail: effectiveProfile?.email,
            ownerId: visibleRoot.ownerId,
            ownerName: effectiveProfile?.name ?? visibleRoot.name,
            ownerPhone: effectiveProfile?.phone,
            rootPath: visibleRoot.rootPath,
            slug: scopeSlugForTree(visibleRoot),
            type: visibleRoot.type,
          };
        });
      });

    const mainRoot =
      rawRoots.find((root) => root.agentId === "main" || root.slug === "main") ??
      rawRoots.find((root) =>
        root.children.some((child) => child.agentId === "main" || child.slug === "main"),
      );
    const defaultScopeSlug =
      (mainRoot?.agentId === "main" || mainRoot?.slug === "main"
        ? "main"
        : mainRoot?.children.find(
            (child) => child.agentId === "main" || child.slug === "main",
          )?.slug) ??
      rawRoots[0]?.slug;

    return {
      defaultScopeSlug,
      isAdmin,
      roots: rawRoots,
      viewerEmail,
    };
  },
});
