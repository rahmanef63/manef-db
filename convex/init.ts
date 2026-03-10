import { internalMutation } from "./functions";
import { ensureDefaultRolesSetup } from "./permissions";

export const init = internalMutation({
  args: {},
  handler: async (ctx) => {
    const adminRole = await ensureDefaultRolesSetup(ctx);
    return { ok: true, adminRoleId: adminRole._id };
  },
});
