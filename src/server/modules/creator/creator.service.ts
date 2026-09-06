import "server-only";
import { ApiError, type Pagination } from "@/server/api/envelope";
import { paginate } from "@/server/api/pagination";
import { decryptJson, encryptJson } from "@/server/lib/crypto";
import { writeAuditLog } from "@/server/modules/audit/audit.service";
import { recordStatusEvent } from "@/server/modules/status-events/status-event.repository";
import type { TenantCtx } from "@/server/modules/brand/brand.repository";
import { creatorRepository, type CreatorListParams, type CreatorWithAccounts } from "./creator.repository";
import { getUserNames } from "@/server/modules/user/user.repository";
import { CREATOR_RELATIONSHIP_STATUS, assertTransition } from "@/shared/constants/status";
import type {
  ContactInfo,
  CreatorCreateInput,
  CreatorDetailDto,
  CreatorListItemDto,
  CreatorNoteDto,
  CreatorUpdateInput,
  PlatformAccountDto,
  PlatformAccountInput,
} from "@/shared/schemas/creator";

function accountToDto(a: CreatorWithAccounts["platformAccounts"][number]): PlatformAccountDto {
  return {
    id: a.id,
    platform: a.platform,
    handle: a.handle,
    url: a.url,
    followers: a.followers,
    engagement_rate: a.engagementRate,
    avg_views: a.avgViews,
  };
}

function toListItem(c: CreatorWithAccounts): CreatorListItemDto {
  return {
    id: c.id,
    display_name: c.displayName,
    relationship_status: c.relationshipStatus,
    risk_level: c.riskLevel,
    country: c.country,
    categories: (c.categories as string[]) ?? [],
    tags: c.tags,
    total_followers: c.platformAccounts.reduce((sum, a) => sum + a.followers, 0),
    max_engagement_rate: Math.max(0, ...c.platformAccounts.map((a) => a.engagementRate)),
    platforms: c.platformAccounts.map((a) => a.platform),
    created_at: c.createdAt.toISOString(),
  };
}

export async function listCreators(
  ctx: TenantCtx,
  params: CreatorListParams,
): Promise<{ items: CreatorListItemDto[]; pagination: Pagination }> {
  const rows = await creatorRepository.list(ctx, params);
  const { items, pagination } = paginate(rows, params.limit);
  return { items: items.map(toListItem), pagination };
}

export async function getCreator(ctx: TenantCtx, id: string): Promise<CreatorDetailDto> {
  const creator = await creatorRepository.findById(ctx, id);
  if (!creator) throw new ApiError("RESOURCE_NOT_FOUND", "达人不存在");
  const snapshot = await creatorRepository.latestSnapshot(ctx, id);
  const contact = decryptJson<ContactInfo>(creator.contactInfo);
  return {
    id: creator.id,
    display_name: creator.displayName,
    bio: creator.bio,
    profile_summary: creator.profileSummary,
    relationship_status: creator.relationshipStatus,
    risk_level: creator.riskLevel,
    country: creator.country,
    languages: (creator.languages as string[]) ?? [],
    categories: (creator.categories as string[]) ?? [],
    tags: creator.tags,
    source: creator.source,
    has_contact_info: !!contact && Object.values(contact).some(Boolean),
    platform_accounts: creator.platformAccounts.map(accountToDto),
    latest_snapshot: (snapshot?.payload as Record<string, unknown>) ?? null,
    created_at: creator.createdAt.toISOString(),
    updated_at: creator.updatedAt.toISOString(),
  };
}

/** 查看联系方式：单独权限 + 审计 */
export async function getCreatorContact(ctx: TenantCtx, id: string): Promise<ContactInfo> {
  const creator = await creatorRepository.findById(ctx, id);
  if (!creator) throw new ApiError("RESOURCE_NOT_FOUND", "达人不存在");
  void writeAuditLog({
    tenantId: ctx.orgId,
    actorType: "user",
    actorId: ctx.userId ?? null,
    action: "creator.contact_view",
    entityType: "creator",
    entityId: id,
  });
  return decryptJson<ContactInfo>(creator.contactInfo) ?? {};
}

export async function createCreator(
  ctx: TenantCtx,
  input: CreatorCreateInput,
): Promise<CreatorDetailDto> {
  const creator = await creatorRepository.create(ctx, {
    displayName: input.display_name,
    bio: input.bio ?? null,
    country: input.country ?? null,
    languages: input.languages,
    categories: input.categories,
    tags: input.tags,
    contactInfo: Object.values(input.contact_info).some(Boolean)
      ? (encryptJson(input.contact_info) as object)
      : {},
    source: "manual",
  });
  await recordStatusEvent({
    tenantId: ctx.orgId,
    entityType: "creator",
    entityId: creator.id,
    field: "relationship_status",
    fromValue: null,
    toValue: creator.relationshipStatus,
    actorId: ctx.userId ?? null,
  });
  return getCreator(ctx, creator.id);
}

export async function updateCreator(
  ctx: TenantCtx,
  id: string,
  input: CreatorUpdateInput,
): Promise<CreatorDetailDto> {
  const existing = await creatorRepository.findById(ctx, id);
  if (!existing) throw new ApiError("RESOURCE_NOT_FOUND", "达人不存在");
  await creatorRepository.update(ctx, id, {
    ...(input.display_name !== undefined ? { displayName: input.display_name } : {}),
    ...(input.bio !== undefined ? { bio: input.bio } : {}),
    ...(input.country !== undefined ? { country: input.country } : {}),
    ...(input.languages !== undefined ? { languages: input.languages } : {}),
    ...(input.categories !== undefined ? { categories: input.categories } : {}),
    ...(input.tags !== undefined ? { tags: input.tags } : {}),
    ...(input.risk_level !== undefined ? { riskLevel: input.risk_level } : {}),
    ...(input.contact_info !== undefined
      ? {
          contactInfo: Object.values(input.contact_info).some(Boolean)
            ? (encryptJson(input.contact_info) as object)
            : {},
        }
      : {}),
  });
  return getCreator(ctx, id);
}

/** 关系状态转移（状态机校验 + status_events） */
export async function transitionCreatorStatus(
  ctx: TenantCtx,
  id: string,
  to: string,
  reason?: string | null,
): Promise<CreatorDetailDto> {
  const creator = await creatorRepository.findById(ctx, id);
  if (!creator) throw new ApiError("RESOURCE_NOT_FOUND", "达人不存在");
  assertTransition(CREATOR_RELATIONSHIP_STATUS, creator.relationshipStatus, to);
  await creatorRepository.transitionStatus(ctx, id, creator.relationshipStatus, to, reason ?? null);
  return getCreator(ctx, id);
}

export async function deleteCreator(ctx: TenantCtx, id: string): Promise<void> {
  const existing = await creatorRepository.findById(ctx, id);
  if (!existing) throw new ApiError("RESOURCE_NOT_FOUND", "达人不存在");
  await creatorRepository.softDelete(ctx, id);
}

// ---- 平台账号 ----

export async function addPlatformAccount(
  ctx: TenantCtx,
  creatorId: string,
  input: PlatformAccountInput,
): Promise<PlatformAccountDto> {
  const creator = await creatorRepository.findById(ctx, creatorId);
  if (!creator) throw new ApiError("RESOURCE_NOT_FOUND", "达人不存在");
  const dup = await creatorRepository.findAccountByHandle(ctx, input.platform, input.handle);
  if (dup) throw new ApiError("CONFLICT", `${input.platform} 账号 @${input.handle} 已存在`);
  const account = await creatorRepository.createAccount(ctx, {
    creatorId,
    platform: input.platform,
    handle: input.handle,
    url: input.url || null,
    followers: input.followers,
    engagementRate: input.engagement_rate,
    avgViews: input.avg_views,
  });
  return accountToDto(account);
}

export async function updatePlatformAccount(
  ctx: TenantCtx,
  creatorId: string,
  accountId: string,
  input: PlatformAccountInput,
): Promise<void> {
  const account = await creatorRepository.findAccount(ctx, creatorId, accountId);
  if (!account) throw new ApiError("RESOURCE_NOT_FOUND", "平台账号不存在");
  await creatorRepository.updateAccount(ctx, accountId, {
    handle: input.handle,
    url: input.url || null,
    followers: input.followers,
    engagementRate: input.engagement_rate,
    avgViews: input.avg_views,
  });
}

export async function removePlatformAccount(
  ctx: TenantCtx,
  creatorId: string,
  accountId: string,
): Promise<void> {
  const account = await creatorRepository.findAccount(ctx, creatorId, accountId);
  if (!account) throw new ApiError("RESOURCE_NOT_FOUND", "平台账号不存在");
  await creatorRepository.deleteAccount(ctx, accountId);
}

// ---- 笔记 ----

export async function listCreatorNotes(ctx: TenantCtx, creatorId: string): Promise<CreatorNoteDto[]> {
  const notes = await creatorRepository.listNotes(ctx, creatorId);
  const nameMap = await getUserNames(notes.map((n) => n.createdBy).filter((v): v is string => !!v));
  return notes.map((n) => ({
    id: n.id,
    content: n.content,
    created_by_name: n.createdBy ? (nameMap.get(n.createdBy) ?? null) : null,
    created_at: n.createdAt.toISOString(),
  }));
}

export async function addCreatorNote(
  ctx: TenantCtx,
  creatorId: string,
  content: string,
): Promise<void> {
  const creator = await creatorRepository.findById(ctx, creatorId);
  if (!creator) throw new ApiError("RESOURCE_NOT_FOUND", "达人不存在");
  await creatorRepository.createNote(ctx, creatorId, content);
}

export async function removeCreatorNote(ctx: TenantCtx, noteId: string): Promise<void> {
  await creatorRepository.deleteNote(ctx, noteId);
}
