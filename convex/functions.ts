import { entsTableFactory, scheduledDeleteFactory } from "convex-ents";
import {
  customCtx,
  customMutation,
  customQuery,
} from "convex-helpers/server/customFunctions";
import {
  MutationCtx as BaseMutationCtx,
  QueryCtx as BaseQueryCtx,
  internalMutation as baseInternalMutation,
  internalQuery as baseInternalQuery,
  mutation as baseMutation,
  query as baseQuery,
} from "./_generated/server";
import { entDefinitions } from "./schema";

// Explicitly type the entDefinitions to avoid TypeScript recursion depth issues
// with complex bidirectional edge relationships
type EntDefinitions = typeof entDefinitions;

// Create a properly typed table factory
function createTable(ctx: BaseQueryCtx): ReturnType<typeof entsTableFactory>;
function createTable(ctx: BaseMutationCtx): ReturnType<typeof entsTableFactory>;
function createTable(ctx: BaseQueryCtx | BaseMutationCtx) {
  return entsTableFactory(ctx, entDefinitions);
}

export const query = customQuery(
  baseQuery,
  customCtx(async (ctx) => {
    const table = createTable(ctx);
    const viewer = await getViewerQuery(ctx);
    return {
      ...ctx,
      table,
      db: undefined as unknown as undefined,
      viewer,
      viewerX: () => {
        if (viewer === null) {
          throw new Error("Expected authenticated viewer");
        }
        return viewer;
      },
    };
  })
);

export const internalQuery = customQuery(
  baseInternalQuery,
  customCtx(async (ctx) => {
    const table = createTable(ctx);
    const viewer = await getViewerQuery(ctx);
    return {
      ...ctx,
      table,
      db: undefined as unknown as undefined,
      viewer,
      viewerX: () => {
        if (viewer === null) {
          throw new Error("Expected authenticated viewer");
        }
        return viewer;
      },
    };
  })
);

export const mutation = customMutation(
  baseMutation,
  customCtx(async (ctx) => {
    const table = createTable(ctx);
    const viewer = await getViewerMutation(ctx);
    return {
      ...ctx,
      table,
      db: undefined as unknown as undefined,
      viewer,
      viewerX: () => {
        if (viewer === null) {
          throw new Error("Expected authenticated viewer");
        }
        return viewer;
      },
    };
  })
);

export const internalMutation = customMutation(
  baseInternalMutation,
  customCtx(async (ctx) => {
    const table = createTable(ctx);
    const viewer = await getViewerMutation(ctx);
    return {
      ...ctx,
      table,
      db: undefined as unknown as undefined,
      viewer,
      viewerX: () => {
        if (viewer === null) {
          throw new Error("Expected authenticated viewer");
        }
        return viewer;
      },
    };
  })
);

async function getViewerQuery(ctx: BaseQueryCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (identity === null) {
    return null;
  }
  const table = createTable(ctx);
  return await table("users").get("tokenIdentifier", identity.tokenIdentifier);
}

async function getViewerMutation(ctx: BaseMutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (identity === null) {
    return null;
  }
  const table = createTable(ctx);
  return await table("users").get("tokenIdentifier", identity.tokenIdentifier);
}

export const scheduledDelete = scheduledDeleteFactory(entDefinitions);
