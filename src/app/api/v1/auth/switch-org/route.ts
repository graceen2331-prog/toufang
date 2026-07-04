import { createApiHandler } from "@/server/api/handler";
import { switchOrg } from "@/server/modules/auth/auth.service";
import { SwitchOrgSchema } from "@/shared/schemas/auth";

export const POST = createApiHandler({
  body: SwitchOrgSchema,
  audit: "auth.switch_org",
  handler: async (ctx) => {
    await switchOrg(ctx.auth, ctx.body.org_id);
    return { switched: true };
  },
});
