import { createApiHandler } from "@/server/api/handler";
import { logout } from "@/server/modules/auth/auth.service";

export const POST = createApiHandler({
  auth: false, // 已过期的会话也允许登出
  handler: async () => {
    await logout();
    return { logged_out: true };
  },
});
