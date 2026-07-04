import "server-only";
import { prisma } from "@/server/db/client";
import type { Campaign, Insight, PerformanceMetric, Prisma, Report } from "@/generated/prisma/client";
import type { TenantCtx } from "@/server/modules/brand/brand.repository";
import { recordStatusEvent } from "@/server/modules/status-events/status-event.repository";

export interface AnalyticsQueryParams {
  campaignId: string | null;
  dateFrom: Date | null;
  dateTo: Date | null;
}

export interface InsightListParams {
  limit: number;
  cursor: string | null;
  order: "asc" | "desc";
  campaignId: string | null;
  status: string | null;
}

export interface ReportListParams {
  limit: number;
  cursor: string | null;
  order: "asc" | "desc";
  campaignId: string | null;
  status: string | null;
}

export type MetricWithLabel = PerformanceMetric & { label: string };

export const analyticsRepository = {
  async upsertMetric(
    ctx: TenantCtx,
    data: {
      entityType: string;
      entityId: string;
      platform: string;
      metricDate: Date;
      metrics: Record<string, number>;
      source: string;
    },
  ): Promise<PerformanceMetric> {
    return prisma.performanceMetric.upsert({
      where: {
        tenantId_entityType_entityId_platform_metricDate: {
          tenantId: ctx.orgId,
          entityType: data.entityType,
          entityId: data.entityId,
          platform: data.platform,
          metricDate: data.metricDate,
        },
      },
      update: {
        metrics: data.metrics,
        source: data.source,
      },
      create: {
        tenantId: ctx.orgId,
        entityType: data.entityType,
        entityId: data.entityId,
        platform: data.platform,
        metricDate: data.metricDate,
        metrics: data.metrics,
        source: data.source,
        createdBy: ctx.userId ?? null,
      },
    });
  },

  async getCampaign(ctx: TenantCtx, campaignId: string): Promise<Campaign | null> {
    return prisma.campaign.findFirst({
      where: { tenantId: ctx.orgId, id: campaignId, deletedAt: null },
    });
  },

  async listCampaignEntityIds(ctx: TenantCtx, campaignId: string): Promise<{
    campaignCreatorIds: string[];
    contentAssetIds: string[];
  }> {
    const campaignCreators = await prisma.campaignCreator.findMany({
      where: { tenantId: ctx.orgId, campaignId, deletedAt: null },
      select: { id: true },
    });
    const campaignCreatorIds = campaignCreators.map((cc) => cc.id);
    const contentAssets = campaignCreatorIds.length
      ? await prisma.contentAsset.findMany({
          where: { tenantId: ctx.orgId, campaignCreatorId: { in: campaignCreatorIds }, deletedAt: null },
          select: { id: true },
        })
      : [];
    return {
      campaignCreatorIds,
      contentAssetIds: contentAssets.map((asset) => asset.id),
    };
  },

  async listMetrics(ctx: TenantCtx, params: AnalyticsQueryParams): Promise<MetricWithLabel[]> {
    const where: Prisma.PerformanceMetricWhereInput = {
      tenantId: ctx.orgId,
      ...(params.dateFrom || params.dateTo
        ? {
            metricDate: {
              ...(params.dateFrom ? { gte: params.dateFrom } : {}),
              ...(params.dateTo ? { lte: params.dateTo } : {}),
            },
          }
        : {}),
    };

    if (params.campaignId) {
      const ids = await this.listCampaignEntityIds(ctx, params.campaignId);
      where.OR = [
        { entityType: "campaign", entityId: params.campaignId },
        { entityType: "campaign_creator", entityId: { in: ids.campaignCreatorIds } },
        { entityType: "content_asset", entityId: { in: ids.contentAssetIds } },
      ];
    }

    const rows = await prisma.performanceMetric.findMany({
      where,
      orderBy: [{ metricDate: "asc" }, { entityType: "asc" }],
    });
    return this.attachMetricLabels(ctx, rows);
  },

  async attachMetricLabels(ctx: TenantCtx, rows: PerformanceMetric[]): Promise<MetricWithLabel[]> {
    const campaignIds = rows.filter((row) => row.entityType === "campaign").map((row) => row.entityId);
    const campaignCreatorIds = rows
      .filter((row) => row.entityType === "campaign_creator")
      .map((row) => row.entityId);
    const contentAssetIds = rows.filter((row) => row.entityType === "content_asset").map((row) => row.entityId);

    const [campaigns, campaignCreators, contentAssets] = await Promise.all([
      campaignIds.length
        ? prisma.campaign.findMany({
            where: { tenantId: ctx.orgId, id: { in: campaignIds }, deletedAt: null },
            select: { id: true, name: true },
          })
        : [],
      campaignCreatorIds.length
        ? prisma.campaignCreator.findMany({
            where: { tenantId: ctx.orgId, id: { in: campaignCreatorIds }, deletedAt: null },
            include: { creator: { select: { displayName: true } } },
          })
        : [],
      contentAssetIds.length
        ? prisma.contentAsset.findMany({
            where: { tenantId: ctx.orgId, id: { in: contentAssetIds }, deletedAt: null },
            select: { id: true, title: true, platform: true },
          })
        : [],
    ]);

    const campaignLabels = new Map(campaigns.map((campaign) => [campaign.id, campaign.name]));
    const creatorLabels = new Map(campaignCreators.map((cc) => [cc.id, cc.creator.displayName]));
    const contentLabels = new Map(
      contentAssets.map((asset) => [asset.id, asset.title ?? `${asset.platform ?? "内容"} ${asset.id.slice(-6)}`]),
    );
    return rows.map((row) => ({
      ...row,
      label:
        row.entityType === "campaign"
          ? (campaignLabels.get(row.entityId) ?? row.entityId)
          : row.entityType === "campaign_creator"
            ? (creatorLabels.get(row.entityId) ?? row.entityId)
            : (contentLabels.get(row.entityId) ?? row.entityId),
    }));
  },

  async listInsights(ctx: TenantCtx, params: InsightListParams): Promise<Insight[]> {
    return prisma.insight.findMany({
      where: {
        tenantId: ctx.orgId,
        deletedAt: null,
        ...(params.campaignId ? { campaignId: params.campaignId } : {}),
        ...(params.status ? { status: params.status } : {}),
        ...(params.cursor
          ? { id: params.order === "desc" ? { lt: params.cursor } : { gt: params.cursor } }
          : {}),
      },
      orderBy: { id: params.order },
      take: params.limit + 1,
    });
  },

  async createInsight(ctx: TenantCtx, data: Omit<Prisma.InsightUncheckedCreateInput, "tenantId">): Promise<Insight> {
    return prisma.insight.create({ data: { ...data, tenantId: ctx.orgId } });
  },

  async updateInsightStatus(ctx: TenantCtx, id: string, status: string): Promise<Insight | null> {
    await prisma.insight.updateMany({ where: { id, tenantId: ctx.orgId, deletedAt: null }, data: { status } });
    return prisma.insight.findFirst({ where: { id, tenantId: ctx.orgId, deletedAt: null } });
  },

  async listReports(ctx: TenantCtx, params: ReportListParams): Promise<Report[]> {
    return prisma.report.findMany({
      where: {
        tenantId: ctx.orgId,
        deletedAt: null,
        ...(params.campaignId ? { campaignId: params.campaignId } : {}),
        ...(params.status ? { status: params.status } : {}),
        ...(params.cursor
          ? { id: params.order === "desc" ? { lt: params.cursor } : { gt: params.cursor } }
          : {}),
      },
      orderBy: { id: params.order },
      take: params.limit + 1,
    });
  },

  async findReport(ctx: TenantCtx, id: string): Promise<Report | null> {
    return prisma.report.findFirst({ where: { id, tenantId: ctx.orgId, deletedAt: null } });
  },

  async createReport(ctx: TenantCtx, data: Omit<Prisma.ReportUncheckedCreateInput, "tenantId">): Promise<Report> {
    return prisma.$transaction(async (tx) => {
      const report = await tx.report.create({ data: { ...data, tenantId: ctx.orgId, createdBy: ctx.userId ?? null } });
      await recordStatusEvent(
        {
          tenantId: ctx.orgId,
          entityType: "report",
          entityId: report.id,
          fromValue: null,
          toValue: report.status,
          actorId: ctx.userId ?? null,
        },
        tx,
      );
      return report;
    });
  },

  async updateReport(ctx: TenantCtx, id: string, data: Prisma.ReportUncheckedUpdateInput): Promise<Report | null> {
    await prisma.report.updateMany({
      where: { id, tenantId: ctx.orgId, deletedAt: null },
      data: { ...data, updatedBy: ctx.userId ?? null },
    });
    return this.findReport(ctx, id);
  },

  async transitionReport(
    ctx: TenantCtx,
    id: string,
    fromValue: string,
    toValue: string,
    reason: string | null,
    extra: Prisma.ReportUncheckedUpdateInput = {},
  ): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await tx.report.updateMany({
        where: { id, tenantId: ctx.orgId, deletedAt: null },
        data: { status: toValue, updatedBy: ctx.userId ?? null, ...extra },
      });
      await recordStatusEvent(
        {
          tenantId: ctx.orgId,
          entityType: "report",
          entityId: id,
          fromValue,
          toValue,
          actorId: ctx.userId ?? null,
          reason,
        },
        tx,
      );
    });
  },

  async getAgentRunTrace(agentRunId: string) {
    return prisma.agentRun.findUnique({
      where: { id: agentRunId },
      select: { promptKey: true, promptVersion: true, model: true },
    });
  },
};
