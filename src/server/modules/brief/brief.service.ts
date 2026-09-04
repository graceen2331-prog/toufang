import "server-only";
import { ApiError } from "@/server/api/envelope";
import { recordStatusEvent } from "@/server/modules/status-events/status-event.repository";
import { getUserNames } from "@/server/modules/user/user.repository";
import type { TenantCtx } from "@/server/modules/brand/brand.repository";
import { briefRepository } from "./brief.repository";
import { BRIEF_STATUS, assertTransition } from "@/shared/constants/status";
import {
  BriefContentSchema,
  type BriefContent,
  type BriefDto,
  type BriefVersionDto,
} from "@/shared/schemas/brief";
import type { BriefVersion } from "@/generated/prisma/client";

function contentToPlainText(content: BriefContent): string {
  return [
    `# ${content.title}`,
    content.background,
    content.product_positioning,
    ...content.key_messages,
    ...content.must_include,
    ...content.must_avoid,
    content.cta,
    content.timeline_notes,
  ]
    .filter(Boolean)
    .join("\n");
}

async function versionToDto(v: BriefVersion): Promise<BriefVersionDto> {
  const names = await getUserNames(v.createdBy ? [v.createdBy] : []);
  const content = BriefContentSchema.parse(v.content);
  return {
    id: v.id,
    version: v.version,
    content,
    plain_text: v.plainText,
    change_summary: v.changeSummary,
    ai_generated: v.aiGenerated,
    model: v.model,
    prompt_key: v.promptKey,
    prompt_version: v.promptVersion,
    created_by_name: v.createdBy ? (names.get(v.createdBy) ?? null) : null,
    created_at: v.createdAt.toISOString(),
  };
}

/** 按 Campaign 查 Brief（含当前版本与版本列表）；无则返回 null */
export async function getBriefByCampaign(
  ctx: TenantCtx,
  campaignId: string,
): Promise<BriefDto | null> {
  const brief = await briefRepository.findByCampaign(ctx, campaignId);
  if (!brief) return null;
  const versions = await briefRepository.listVersions(ctx, brief.id);
  const current = versions.find((v) => v.id === brief.currentVersionId) ?? versions[0] ?? null;
  return {
    id: brief.id,
    campaign_id: brief.campaignId,
    title: brief.title,
    status: brief.status,
    current_version_id: brief.currentVersionId,
    current_version: current ? await versionToDto(current) : null,
    versions: versions.map((v) => ({
      id: v.id,
      version: v.version,
      change_summary: v.changeSummary,
      ai_generated: v.aiGenerated,
      created_at: v.createdAt.toISOString(),
    })),
    approved_at: brief.approvedAt?.toISOString() ?? null,
    created_at: brief.createdAt.toISOString(),
    updated_at: brief.updatedAt.toISOString(),
  };
}

export async function getBriefVersion(ctx: TenantCtx, versionId: string): Promise<BriefVersionDto> {
  const version = await briefRepository.findVersion(ctx, versionId);
  if (!version) throw new ApiError("RESOURCE_NOT_FOUND", "Brief 版本不存在");
  return versionToDto(version);
}

/** 人工保存新版本（编辑器保存）；Brief 不存在则创建 */
export async function saveBriefVersion(
  ctx: TenantCtx,
  campaignId: string,
  content: BriefContent,
  changeSummary?: string | null,
): Promise<BriefDto> {
  let brief = await briefRepository.findByCampaign(ctx, campaignId);
  if (brief && brief.status === "locked") {
    throw new ApiError("CONFLICT", "Brief 已锁定，不能修改；请先归档或联系管理员");
  }
  brief ??= await briefRepository.create(ctx, {
    campaignId,
    title: content.title,
    status: "draft",
  });
  await briefRepository.addVersion(ctx, brief.id, {
    content: content as object,
    plainText: contentToPlainText(content),
    changeSummary: changeSummary ?? "人工编辑",
    title: content.title,
  });
  const result = await getBriefByCampaign(ctx, campaignId);
  return result!;
}

/** Brief 状态流转（draft → in_review → approved → locked → archived） */
export async function transitionBriefStatus(
  ctx: TenantCtx,
  briefId: string,
  to: string,
  reason?: string | null,
): Promise<void> {
  const brief = await briefRepository.findById(ctx, briefId);
  if (!brief) throw new ApiError("RESOURCE_NOT_FOUND", "Brief 不存在");
  assertTransition(BRIEF_STATUS, brief.status, to);
  await briefRepository.updateStatus(ctx, briefId, to, to === "approved");
  await recordStatusEvent({
    tenantId: ctx.orgId,
    entityType: "brief",
    entityId: briefId,
    fromValue: brief.status,
    toValue: to,
    actorId: ctx.userId ?? null,
    reason: reason ?? null,
  });
}
