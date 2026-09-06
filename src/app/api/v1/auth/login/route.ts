import { createApiHandler } from "@/server/api/handler";
import { login } from "@/server/modules/auth/auth.service";
import { LoginSchema } from "@/shared/schemas/auth";
import { resolveLoginClientIp } from "@/server/auth/client-address";

export const POST = createApiHandler({
  auth: false,
  body: LoginSchema,
  handler: async (ctx) => {
    await login({
      email: ctx.body.email,
      password: ctx.body.password,
      ip: resolveLoginClientIp(ctx.req),
      userAgent: ctx.req.headers.get("user-agent"),
    });
    return { logged_in: true };
  },
});
