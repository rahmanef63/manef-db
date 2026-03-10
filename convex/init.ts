import { internalMutation } from "./functions";
import { getPermission } from "./permissions";

export const init = internalMutation({
  args: {},
  handler: async (ctx) => {
    if ((await ctx.table("roles").first()) !== null) {
      throw new Error("There's an existing roles setup already.");
    }
    await ctx
      .table("permissions")
      .insertMany([
        { name: "Manage Workspace" },
        { name: "Delete Workspace" },
        { name: "Manage Members" },
        { name: "Read Members" },
        { name: "Contribute" },
        { name: "Manage Menu" },
      ]);

    await ctx.table("roles").insert({
      name: "Admin",
      isDefault: false,
      permissions: [
        await getPermission(ctx, "Manage Workspace"),
        await getPermission(ctx, "Delete Workspace"),
        await getPermission(ctx, "Manage Members"),
        await getPermission(ctx, "Read Members"),
        await getPermission(ctx, "Contribute"),
        await getPermission(ctx, "Manage Menu"),
      ],
    });
    await ctx.table("roles").insert({
      name: "Member",
      isDefault: true,
      permissions: [
        await getPermission(ctx, "Read Members"),
        await getPermission(ctx, "Contribute"),
      ],
    });
  },
});
