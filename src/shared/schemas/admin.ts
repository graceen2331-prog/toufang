import { z } from "zod";
import { PERMISSIONS, type Permission } from "@/shared/constants/permissions";

export const AiProviderSchema = z.enum(["openai", "fake"]);
export type AiProvider = z.infer<typeof AiProviderSchema>;

export const AdminUserUpdateSchema = z.object({
  role_key: z.string().min(1).optional(),
  status: z.enum(["active", "disabled"]).optional(),
});
export type AdminUserUpdateInput = z.infer<typeof AdminUserUpdateSchema>;

export const OrganizationUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
});
export type OrganizationUpdateInput = z.infer<typeof OrganizationUpdateSchema>;

export const AiRuntimeSettingsInputSchema = z.object({
  provider: AiProviderSchema.optional(),
  api_key: z.string().max(2000).optional(),
  clear_api_key: z.boolean().optional(),
  base_url: z.string().max(300).optional().nullable(),
  chat_model: z.string().min(1, "请输入默认对话模型").max(120).optional(),
  light_model: z.string().min(1, "请输入轻量对话模型").max(120).optional(),
  embedding_model: z.string().min(1, "请输入向量模型").max(120).optional(),
  high_cost_requires_approval: z.boolean().optional(),
});

export const AiSettingsUpdateSchema = z.object({
  ai_monthly_budget_cents: z.number().int().min(0).max(100_000_000),
  settings: AiRuntimeSettingsInputSchema.optional(),
});
export type AiSettingsUpdateInput = z.infer<typeof AiSettingsUpdateSchema>;

export const AiSettingsTestSchema = AiRuntimeSettingsInputSchema;
export type AiSettingsTestInput = z.infer<typeof AiSettingsTestSchema>;

export interface AdminUserDto {
  user_id: string;
  email: string;
  name: string;
  user_status: string;
  membership_status: string;
  role_key: string;
  role_name: string;
  permissions: Permission[] | ["*"];
  created_at: string;
}

export interface AdminRoleDto {
  id: string;
  key: string;
  name: string;
  permissions: Permission[] | ["*"];
  is_system: boolean;
}

export interface AdminUsersPageDto {
  users: AdminUserDto[];
  roles: AdminRoleDto[];
  permissions: Array<{ key: Permission; label: string }>;
}

export interface OrganizationSettingsDto {
  id: string;
  name: string;
  slug: string;
  status: string;
  settings: Record<string, unknown>;
  ai_monthly_budget_cents: number;
}

export interface AiSettingsDto {
  ai_monthly_budget_cents: number;
  month_spent_microcents: number;
  settings: AiSettingsFormSettings;
}

export interface AiSettingsFormSettings {
  provider: AiProvider;
  api_key_set: boolean;
  api_key_masked: string | null;
  base_url: string | null;
  chat_model: string;
  light_model: string;
  embedding_model: string;
  high_cost_requires_approval: boolean;
}

export interface AiSettingsTestResultDto {
  ok: boolean;
  provider: AiProvider;
  model: string;
  latency_ms: number;
  message: string;
}

export const PERMISSION_OPTIONS = Object.entries(PERMISSIONS).map(([key, label]) => ({
  key: key as Permission,
  label,
}));
