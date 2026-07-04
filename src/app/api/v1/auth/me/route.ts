import { createApiHandler } from "@/server/api/handler";
import { getMe } from "@/server/modules/auth/auth.service";

export const GET = createApiHandler({
  handler: async (ctx) => getMe(ctx.auth),
});
