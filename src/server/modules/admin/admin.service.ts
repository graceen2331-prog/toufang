import "server-only";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { ApiError } from "@/server/api/envelope";
import {
  getAiRuntimeSettings,
  getPublicAiSettings,
  mergePersistedAiSettings,
  type AiRuntimeOverride,
} from "@/server/ai/settings";
import { defaultChatModel, monthlyAiSpend, routerChat } from "@/server/ai/router";
import type { TenantCtx } from "@/server/modules/brand/brand.repository";
import { PERMISSION_OPTIONS, type AdminRoleDto, type AdminUserDto } from "@/shared/schemas/admin";
import type {
  AdminUserUpdateInput,
  AdminUsersPageDto,
  AiSettingsDto,
  AiSettingsTestInput,
  AiSettingsTestResultDto,
  AiSettingsUpdateInput,
  OrganizationSettingsDto,
  OrganizationUpdateInput,
} from "@/shared/schemas/admin";
import type { UserSettingsDto, UserSettingsUpdateInput } from "@/shared/schemas/settings";
import { adminRepository } from "./admin.repository";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

const AiSettingsTestOutputSchema = z.object({
  ok: z.boolean(),
  message: z.string(),
});

function toAiRuntimeOverride(input: AiSettingsTestInput): AiRuntimeOverride {
  const override: AiRuntimeOverride = {};
  if (input.provider) override.provider = input.provider;
  if (input.base_url !== undefined) override.baseUrl = input.base_url;
  if (input.chat_model !== undefined) override.chatModel = input.chat_model;
  if (input.light_model !== undefined) override.lightModel = input.light_model;
  if (input.embedding_model !== undefined) override.embeddingModel = input.embedding_model;
  if (input.api_key?.trim()) override.apiKey = input.api_key.trim();
  else if (input.clear_api_key) override.apiKey = null;
  return override;
}

function roleToDto(role: {
  id: string;
  key: string;
  name: string;
  permissions: unknown;
  isSystem: boolean;
}): AdminRoleDto {
  return {
    id: role.id,
    key: role.key,
    name: role.name,
    permissions: role.permissions as AdminRoleDto["permissions"],
    is_system: role.isSystem,
  };
}

function membershipToDto(
  membership: Awaited<ReturnType<typeof adminRepository.listMemberships>>[number],
): AdminUserDto {
  return {
    user_id: membership.user.id,
    email: membership.user.email,
    name: membership.user.name,
    user_status: membership.user.status,
    membership_status: membership.status,
    role_key: membership.role.key,
    role_name: membership.role.name,
    permissions: membership.role.permissions as AdminUserDto["permissions"],
    created_at: membership.user.createdAt.toISOString(),
  };
}

export async function getAdminUsersPage(ctx: TenantCtx): Promise<AdminUsersPageDto> {
  const [memberships, roles] = await Promise.all([
    adminRepository.listMemberships(ctx),
    adminRepository.listRoles(ctx),
  ]);
  return {
    users: memberships.map(membershipToDto),
    roles: roles.map(roleToDto),
    permissions: PERMISSION_OPTIONS,
  };
}

export async function updateAdminUser(
  ctx: TenantCtx,
  userId: string,
  input: AdminUserUpdateInput,
): Promise<AdminUserDto> {
  const data: { roleId?: string; status?: string } = {};
  if (input.role_key) {
    const role = await adminRepository.findRoleByKey(ctx, input.role_key);
    if (!role) throw new ApiError("RESOURCE_NOT_FOUND", "角色不存在");
    data.roleId = role.id;
  }
  if (input.status) data.status = input.status;
  const updated = await adminRepository.updateMembership(ctx, userId, data);
  if (!updated) throw new ApiError("RESOURCE_NOT_FOUND", "组织成员不存在");
  return membershipToDto(updated);
}

export async function getOrganizationSettings(ctx: TenantCtx): Promise<OrganizationSettingsDto> {
  const org = await adminRepository.getOrganization(ctx);
  if (!org) throw new ApiError("TENANT_REQUIRED", "组织不存在");
  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    status: org.status,
    settings: asRecord(org.settings),
    ai_monthly_budget_cents: org.aiMonthlyBudgetCents,
  };
}

export async function updateOrganizationSettings(
  ctx: TenantCtx,
  input: OrganizationUpdateInput,
): Promise<OrganizationSettingsDto> {
  await adminRepository.updateOrganization(ctx, {
    ...(input.name ? { name: input.name } : {}),
    ...(input.settings ? { settings: input.settings as Prisma.InputJsonValue } : {}),
  });
  return getOrganizationSettings(ctx);
}

export async function getAiSettings(ctx: TenantCtx): Promise<AiSettingsDto> {
  const org = await adminRepository.getOrganization(ctx);
  if (!org) throw new ApiError("TENANT_REQUIRED", "组织不存在");
  const settings = asRecord(org.settings);
  return {
    ai_monthly_budget_cents: org.aiMonthlyBudgetCents,
    month_spent_microcents: await monthlyAiSpend(ctx.orgId),
    settings: getPublicAiSettings(settings.ai),
  };
}

export async function updateAiSettings(
  ctx: TenantCtx,
  input: AiSettingsUpdateInput,
): Promise<AiSettingsDto> {
  const org = await adminRepository.getOrganization(ctx);
  if (!org) throw new ApiError("TENANT_REQUIRED", "组织不存在");
  const settings = asRecord(org.settings);
  const aiSettings = input.settings
    ? mergePersistedAiSettings(settings.ai, input.settings)
    : asRecord(settings.ai);
  await adminRepository.updateOrganization(ctx, {
    aiMonthlyBudgetCents: input.ai_monthly_budget_cents,
    settings: {
      ...settings,
      ai: aiSettings,
    } as Prisma.InputJsonValue,
  });
  return getAiSettings(ctx);
}

export async function testAiSettings(
  ctx: TenantCtx,
  input: AiSettingsTestInput,
): Promise<AiSettingsTestResultDto> {
  const settingsOverride = toAiRuntimeOverride(input);
  const runtime = await getAiRuntimeSettings(ctx.orgId, settingsOverride);
  const model = defaultChatModel(runtime, true);
  const start = Date.now();

  try {
    const output = await routerChat({
      tenantId: ctx.orgId,
      agentKey: "settings_test",
      promptKey: "settings.test",
      messages: [
        {
          role: "system",
          content: "你是模型连接测试器。只输出合法 JSON，不要解释。",
        },
        {
          role: "user",
          content: '请输出 {"ok":true,"message":"连接正常"}。',
        },
      ],
      outputSchema: AiSettingsTestOutputSchema,
      light: true,
      temperature: 0,
      createdBy: ctx.userId ?? null,
      settingsOverride,
    });

    return {
      ok: output.ok,
      provider: runtime.provider,
      model,
      latency_ms: Date.now() - start,
      message: output.message || "连接正常",
    };
  } catch (err) {
    return {
      ok: false,
      provider: runtime.provider,
      model,
      latency_ms: Date.now() - start,
      message: err instanceof Error ? err.message : "连接测试失败",
    };
  }
}

export async function getUserSettings(ctx: TenantCtx): Promise<UserSettingsDto> {
  const [user, org] = await Promise.all([
    adminRepository.getUser(ctx),
    adminRepository.getOrganization(ctx),
  ]);
  if (!user) throw new ApiError("AUTH_SESSION_EXPIRED");
  if (!org) throw new ApiError("TENANT_REQUIRED", "组织不存在");
  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      locale: user.locale,
      settings: asRecord(user.settings),
    },
    org: { id: org.id, name: org.name, slug: org.slug },
  };
}

export async function updateUserSettings(
  ctx: TenantCtx,
  input: UserSettingsUpdateInput,
): Promise<UserSettingsDto> {
  const current = await adminRepository.getUser(ctx);
  if (!current) throw new ApiError("AUTH_SESSION_EXPIRED");
  await adminRepository.updateUser(ctx, {
    ...(input.name ? { name: input.name } : {}),
    ...(input.locale ? { locale: input.locale } : {}),
    ...(input.settings
      ? { settings: { ...asRecord(current.settings), ...input.settings } as Prisma.InputJsonValue }
      : {}),
  });
  return getUserSettings(ctx);
}
