import { z } from "zod";
import { PERMISSIONS, type Permission } from "@/shared/constants/permissions";

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

export const AiSettingsUpdateSchema = z.object({
  ai_monthly_budget_cents: z.number().int().min(0).max(100_000_000),
  settings: z
    .object({
      default_chat_model: z.string().max(80).optional(),
      default_embedding_model: z.string().max(80).optional(),
      high_cost_requires_approval: z.boolean().optional(),
    })
    .optional(),
});
export type AiSettingsUpdateInput = z.infer<typeof AiSettingsUpdateSchema>;

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
  settings: Record<string, unknown>;
}

export const PERMISSION_OPTIONS = Object.entries(PERMISSIONS).map(([key, label]) => ({
  key: key as Permission,
  label,
}));
