import "server-only";
import { prisma } from "@/server/db/client";
import type { Prisma } from "@/generated/prisma/client";
import type { TenantCtx } from "@/server/modules/brand/brand.repository";

export const briefRepository = {
  async findByCampaign(ctx: TenantCtx, campaignId: string) {
    return prisma.brief.findFirst({
      where: { tenantId: ctx.orgId, campaignId, deletedAt: null },
      orderBy: { createdAt: "asc" },
    });
  },

  async findById(ctx: TenantCtx, id: string) {
    return prisma.brief.findFirst({ where: { id, tenantId: ctx.orgId, deletedAt: null } });
  },

  async listVersions(ctx: TenantCtx, briefId: string) {
    return prisma.briefVersion.findMany({
      where: { tenantId: ctx.orgId, briefId },
      orderBy: { version: "desc" },
    });
  },

  async findVersion(ctx: TenantCtx, versionId: string) {
    return prisma.briefVersion.findFirst({ where: { id: versionId, tenantId: ctx.orgId } });
  },

  async create(ctx: TenantCtx, data: Omit<Prisma.BriefUncheckedCreateInput, "tenantId">) {
    return prisma.brief.create({
      data: { ...data, tenantId: ctx.orgId, createdBy: ctx.userId ?? null },
    });
  },

  /** 新增版本并把 brief 指到该版本（事务） */
  async addVersion(
    ctx: TenantCtx,
    briefId: string,
    data: {
      content: object;
      plainText: string;
      changeSummary: string | null;
      title?: string;
    },
  ) {
    return prisma.$transaction(async (tx) => {
      const last = await tx.briefVersion.findFirst({
        where: { tenantId: ctx.orgId, briefId },
        orderBy: { version: "desc" },
        select: { version: true },
      });
      const version = await tx.briefVersion.create({
        data: {
          tenantId: ctx.orgId,
          briefId,
          version: (last?.version ?? 0) + 1,
          content: data.content,
          plainText: data.plainText,
          changeSummary: data.changeSummary,
          aiGenerated: false,
          createdBy: ctx.userId ?? null,
        },
      });
      await tx.brief.updateMany({
        where: { id: briefId, tenantId: ctx.orgId },
        data: {
          currentVersionId: version.id,
          status: "draft", // 人工改版后回到草稿，需重新走审批
          ...(data.title ? { title: data.title } : {}),
          updatedBy: ctx.userId ?? null,
        },
      });
      return version;
    });
  },

  async updateStatus(ctx: TenantCtx, id: string, status: string, approved: boolean) {
    await prisma.brief.updateMany({
      where: { id, tenantId: ctx.orgId, deletedAt: null },
      data: {
        status,
        updatedBy: ctx.userId ?? null,
        ...(approved ? { approvedAt: new Date(), approvedBy: ctx.userId ?? null } : {}),
      },
    });
  },
};
