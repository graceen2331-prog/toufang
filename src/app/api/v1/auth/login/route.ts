import { createApiHandler } from "@/server/api/handler";
import { login } from "@/server/modules/auth/auth.service";
import { LoginSchema } from "@/shared/schemas/auth";

export const POST = createApiHandler({
  auth: false,
  body: LoginSchema,
  handler: async (ctx) => {
    await login({
      email: ctx.body.email,
      password: ctx.body.password,
      ip: ctx.req.headers.get("x-forwarded-for"),
      userAgent: ctx.req.headers.get("user-agent"),
    });
    return { logged_in: true };
  },
});
