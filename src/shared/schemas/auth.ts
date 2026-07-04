import { z } from "zod";

export const LoginSchema = z.object({
  email: z.email("邮箱格式不正确"),
  password: z.string().min(1, "请输入密码"),
});
export type LoginInput = z.infer<typeof LoginSchema>;

export const SwitchOrgSchema = z.object({
  org_id: z.string().min(1),
});
export type SwitchOrgInput = z.infer<typeof SwitchOrgSchema>;

export interface MeDto {
  user: { id: string; email: string; name: string };
  org: { id: string; name: string; slug: string } | null;
  role_key: string | null;
  permissions: string[];
  memberships: Array<{ org_id: string; org_name: string; role_key: string; role_name: string }>;
}
