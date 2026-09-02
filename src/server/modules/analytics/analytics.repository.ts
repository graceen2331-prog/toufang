import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "@/server/db/client";
import type { Campaign, Insight, PerformanceMetric, Prisma, Report } from "@/generated/prisma/client";
import type { TenantCtx } from "@/server/modules/brand/brand.repository";
import { recordStatusEvent } from "@/server/modules/status-events/status-event.repository";
import {
  buildReportSnapshot,
  hashReportSnapshot,
  REPORT_HASH_ALGORITHM,
} from "./report-integrity";

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
  globalOnly?: boolean;
}

export interface ReportListParams {
  limit: number;
  cursor: string | null;
  order: "asc" | "desc";
  campaignId: string | null;
  status: string | null;
}

export type MetricWithLabel = PerformanceMetric & {
  label: string;
  campaignId: string | null;
  campaignCurrency: string | null;
};

async function findMetricEntityContext(
  ctx: TenantCtx,
  entityType: string,
  entityId: string,
): Promise<{ campaignId: string; currency: string } | null> {
  if (entityType === "campaign") {
    const campaign = await prisma.campaign.findFirst({
      where: { id: entityId, tenantId: ctx.orgId, deletedAt: null },
      select: { id: true, currency: true },
    });
    return campaign ? { campaignId: campaign.id, currency: campaign.currency } : null;
  }
  if (entityType === "campaign_creator") {
    const campaignCreator = await prisma.campaignCreator.findFirst({
      where: { id: entityId, tenantId: ctx.orgId, deletedAt: null },
      include: { campaign: { select: { id: true, currency: true } } },
    });
    return campaignCreator
      ? { campaignId: campaignCreator.campaign.id, currency: campaignCreator.campaign.currency }
      : null;
  }
  if (entityType === "content_asset") {
    const asset = await prisma.contentAsset.findFirst({
      where: { id: entityId, tenantId: ctx.orgId, deletedAt: null },
      select: { campaignCreatorId: true },
    });
    if (!asset) return null;
    const campaignCreator = await prisma.campaignCreator.findFirst({
      where: { id: asset.campaignCreatorId, tenantId: ctx.orgId, deletedAt: null },
      include: { campaign: { select: { id: true, currency: true } } },
    });
    return campaignCreator
      ? { campaignId: campaignCreator.campaign.id, currency: campaignCreator.campaign.currency }
      : null;
  }
  return null;
}

const reportRelations = {
  supersededBy: { select: { id: true } },
  exports: { orderBy: { createdAt: "desc" as const }, take: 20 },
} satisfies Prisma.ReportInclude;

export type ReportWithRelations = Prisma.ReportGetPayload<{ include: typeof reportRelations }>;

type NewRootReportData = Omit<
  Prisma.ReportUncheckedCreateInput,
  | "id"
  | "tenantId"
  | "seriesId"
  | "version"
  | "supersedesId"
  | "lockVersion"
  | "submittedSnapshotHash"
  | "approvedSnapshotHash"
  | "hashAlgorithm"
  | "derivationReason"
>;

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
      currency?: string | null;
      attributionWindowDays?: number | null;
      attributionModel?: string | null;
      sourceRecordId?: string | null;
      sourceObservedAt?: Date | null;
      metricSchemaVersion?: number;
    },
  ): Promise<PerformanceMetric | null> {
    const context = await findMetricEntityContext(ctx, data.entityType, data.entityId);
    if (!context) return null;
    const semanticData = {
      currency: data.currency ?? context.currency,
      attributionWindowDays: data.attributionWindowDays ?? null,
      attributionModel: data.attributionModel ?? null,
      sourceRecordId: data.sourceRecordId ?? null,
      sourceObservedAt: data.sourceObservedAt ?? null,
      metricSchemaVersion: data.metricSchemaVersion ?? 2,
    };
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
        ...semanticData,
      },
      create: {
        tenantId: ctx.orgId,
        entityType: data.entityType,
        entityId: data.entityId,
        platform: data.platform,
        metricDate: data.metricDate,
        metrics: data.metrics,
        source: data.source,
        ...semanticData,
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
    const metricCampaignCreatorIds = rows
      .filter((row) => row.entityType === "campaign_creator")
      .map((row) => row.entityId);
    const contentAssetIds = rows.filter((row) => row.entityType === "content_asset").map((row) => row.entityId);

    const [campaigns, contentAssets] = await Promise.all([
      campaignIds.length
        ? prisma.campaign.findMany({
            where: { tenantId: ctx.orgId, id: { in: campaignIds }, deletedAt: null },
            select: { id: true, name: true, currency: true },
          })
        : [],
      contentAssetIds.length
        ? prisma.contentAsset.findMany({
            where: { tenantId: ctx.orgId, id: { in: contentAssetIds }, deletedAt: null },
            select: { id: true, title: true, platform: true, campaignCreatorId: true },
          })
        : [],
    ]);

    const campaignCreatorIds = [
      ...new Set([
        ...metricCampaignCreatorIds,
        ...contentAssets.map((asset) => asset.campaignCreatorId),
      ]),
    ];
    const campaignCreators = campaignCreatorIds.length
      ? await prisma.campaignCreator.findMany({
          where: { tenantId: ctx.orgId, id: { in: campaignCreatorIds }, deletedAt: null },
          include: {
            creator: { select: { displayName: true } },
            campaign: { select: { id: true, currency: true } },
          },
        })
      : [];

    const campaignLabels = new Map(campaigns.map((campaign) => [campaign.id, campaign.name]));
    const creatorLabels = new Map(campaignCreators.map((cc) => [cc.id, cc.creator.displayName]));
    const creatorCampaigns = new Map(
      campaignCreators.map((cc) => [cc.id, { id: cc.campaign.id, currency: cc.campaign.currency }]),
    );
    const contentLabels = new Map(
      contentAssets.map((asset) => [asset.id, asset.title ?? `${asset.platform ?? "内容"} ${asset.id.slice(-6)}`]),
    );
    const contentCampaigns = new Map(
      contentAssets.map((asset) => [asset.id, creatorCampaigns.get(asset.campaignCreatorId) ?? null]),
    );
    const campaignCurrencies = new Map(campaigns.map((campaign) => [campaign.id, campaign.currency]));
    return rows.map((row) => {
      const context = row.entityType === "campaign"
        ? { id: row.entityId, currency: campaignCurrencies.get(row.entityId) ?? null }
        : row.entityType === "campaign_creator"
          ? (creatorCampaigns.get(row.entityId) ?? null)
          : (contentCampaigns.get(row.entityId) ?? null);
      return {
        ...row,
        label:
          row.entityType === "campaign"
            ? (campaignLabels.get(row.entityId) ?? row.entityId)
            : row.entityType === "campaign_creator"
              ? (creatorLabels.get(row.entityId) ?? row.entityId)
              : (contentLabels.get(row.entityId) ?? row.entityId),
        campaignId: context?.id ?? null,
        campaignCurrency: context?.currency ?? null,
      };
    });
  },

  async listInsights(ctx: TenantCtx, params: InsightListParams): Promise<Insight[]> {
    return prisma.insight.findMany({
      where: {
        tenantId: ctx.orgId,
        deletedAt: null,
        ...(params.campaignId ? { campaignId: params.campaignId } : {}),
        ...(!params.campaignId && params.globalOnly ? { campaignId: null } : {}),
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

  async listReports(ctx: TenantCtx, params: ReportListParams): Promise<ReportWithRelations[]> {
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
      include: reportRelations,
    });
  },

  async findReport(ctx: TenantCtx, id: string): Promise<ReportWithRelations | null> {
    return prisma.report.findFirst({
      where: { id, tenantId: ctx.orgId, deletedAt: null },
      include: reportRelations,
    });
  },

  async createReport(ctx: TenantCtx, data: NewRootReportData): Promise<Report> {
    return prisma.$transaction(async (tx) => {
      const id = randomUUID();
      const status = data.status ?? "draft";
      const snapshotSource = {
        id,
        seriesId: id,
        version: 1,
        campaignId: data.campaignId ?? null,
        title: data.title,
        kind: data.kind ?? "campaign_retro",
        content: data.content ?? {},
        aiGenerated: data.aiGenerated ?? true,
        agentRunId: data.agentRunId ?? null,
        promptKey: data.promptKey ?? null,
        promptVersion: data.promptVersion ?? null,
        model: data.model ?? null,
      };
      const formalHash = ["approved", "exported"].includes(status)
        ? hashReportSnapshot(buildReportSnapshot(snapshotSource))
        : null;
      const report = await tx.report.create({
        data: {
          ...data,
          id,
          tenantId: ctx.orgId,
          seriesId: id,
          version: 1,
          approvedSnapshotHash: formalHash,
          hashAlgorithm: formalHash ? REPORT_HASH_ALGORITHM : null,
          createdBy: ctx.userId ?? null,
        },
      });
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

  async updateDraftReport(
    ctx: TenantCtx,
    id: string,
    expectedLockVersion: number,
    data: { title?: string; content?: Prisma.InputJsonValue },
  ): Promise<ReportWithRelations | null> {
    const updated = await prisma.report.updateMany({
      where: {
        id,
        tenantId: ctx.orgId,
        deletedAt: null,
        status: "draft",
        lockVersion: expectedLockVersion,
      },
      data: { ...data, lockVersion: { increment: 1 }, updatedBy: ctx.userId ?? null },
    });
    if (updated.count !== 1) return null;
    return this.findReport(ctx, id);
  },

  async submitReportForReview(ctx: TenantCtx, id: string, expectedLockVersion: number) {
    return prisma.$transaction(async (tx) => {
      const report = await tx.report.findFirst({
        where: { id, tenantId: ctx.orgId, deletedAt: null },
      });
      if (!report) return { kind: "not_found" as const };
      if (report.status !== "draft") return { kind: "not_draft" as const };
      if (report.lockVersion !== expectedLockVersion) return { kind: "lock_conflict" as const };

      const submittedHash = hashReportSnapshot(buildReportSnapshot(report));
      const updated = await tx.report.updateMany({
        where: {
          id,
          tenantId: ctx.orgId,
          deletedAt: null,
          status: "draft",
          lockVersion: expectedLockVersion,
        },
        data: {
          status: "in_review",
          submittedSnapshotHash: submittedHash,
          hashAlgorithm: REPORT_HASH_ALGORITHM,
          updatedBy: ctx.userId ?? null,
        },
      });
      if (updated.count !== 1) return { kind: "lock_conflict" as const };

      await tx.humanCheckpoint.create({
        data: {
          tenantId: ctx.orgId,
          type: "report",
          status: "pending",
          title: `报告审批：${report.title}`,
          summary: String(
            (report.content as { executive_summary?: string })?.executive_summary ?? "",
          ).slice(0, 200),
          entityType: "report",
          entityId: report.id,
          payload: {
            report_id: report.id,
            version: report.version,
            title: report.title,
            content: report.content,
            submitted_snapshot_hash: submittedHash,
          },
          priority: "high",
          assigneeRole: "manager",
          createdBy: ctx.userId ?? null,
        },
      });
      await recordStatusEvent(
        {
          tenantId: ctx.orgId,
          entityType: "report",
          entityId: report.id,
          fromValue: "draft",
          toValue: "in_review",
          actorId: ctx.userId ?? null,
          reason: "提交报告审批",
          metadata: { submitted_snapshot_hash: submittedHash, version: report.version },
        },
        tx,
      );
      const result = await tx.report.findUnique({ where: { id }, include: reportRelations });
      return { kind: "submitted" as const, report: result! };
    });
  },

  async transitionReport(
    ctx: TenantCtx,
    id: string,
    fromValue: string,
    toValue: string,
    reason: string | null,
    extra: Prisma.ReportUncheckedUpdateInput = {},
  ): Promise<boolean> {
    return prisma.$transaction(async (tx) => {
      const updated = await tx.report.updateMany({
        where: { id, tenantId: ctx.orgId, deletedAt: null, status: fromValue },
        data: { status: toValue, updatedBy: ctx.userId ?? null, ...extra },
      });
      if (updated.count !== 1) return false;
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
      return true;
    });
  },

  async decideReportCheckpoint(input: {
    ctx: TenantCtx;
    checkpointId: string;
    reportId: string;
    decision: "approved" | "rejected" | "changes_requested";
    reason: string | null;
    expectedVersion?: number;
  }) {
    return prisma.$transaction(async (tx) => {
      const checkpoint = await tx.humanCheckpoint.findFirst({
        where: {
          id: input.checkpointId,
          tenantId: input.ctx.orgId,
          type: "report",
          entityType: "report",
          entityId: input.reportId,
          status: "pending",
          ...(input.expectedVersion === undefined ? {} : { version: input.expectedVersion }),
        },
      });
      if (!checkpoint) return { kind: "not_pending" as const };
      const report = await tx.report.findFirst({
        where: {
          id: input.reportId,
          tenantId: input.ctx.orgId,
          deletedAt: null,
          status: "in_review",
        },
      });
      if (!report) return { kind: "report_conflict" as const };
      const currentHash = hashReportSnapshot(buildReportSnapshot(report));
      if (!report.submittedSnapshotHash || currentHash !== report.submittedSnapshotHash) {
        return { kind: "integrity_mismatch" as const };
      }

      const approved = input.decision === "approved";
      const targetStatus = approved ? "approved" : "draft";
      const reportUpdated = await tx.report.updateMany({
        where: {
          id: report.id,
          tenantId: input.ctx.orgId,
          status: "in_review",
          submittedSnapshotHash: currentHash,
        },
        data: approved
          ? {
              status: targetStatus,
              approvedAt: new Date(),
              approvedBy: input.ctx.userId ?? null,
              approvedSnapshotHash: currentHash,
              hashAlgorithm: REPORT_HASH_ALGORITHM,
              updatedBy: input.ctx.userId ?? null,
            }
          : {
              status: targetStatus,
              submittedSnapshotHash: null,
              lockVersion: { increment: 1 },
              updatedBy: input.ctx.userId ?? null,
            },
      });
      if (reportUpdated.count !== 1) return { kind: "report_conflict" as const };
      const checkpointUpdated = await tx.humanCheckpoint.updateMany({
        where: {
          id: checkpoint.id,
          tenantId: input.ctx.orgId,
          status: "pending",
          ...(input.expectedVersion === undefined ? {} : { version: input.expectedVersion }),
        },
        data: {
          status: input.decision,
          decidedBy: input.ctx.userId ?? null,
          decidedAt: new Date(),
          decisionReason: input.reason,
          version: { increment: 1 },
        },
      });
      if (checkpointUpdated.count !== 1) return { kind: "not_pending" as const };
      await tx.humanCheckpointEvent.create({
        data: {
          tenantId: input.ctx.orgId,
          checkpointId: checkpoint.id,
          eventType: "decided",
          actorId: input.ctx.userId ?? null,
          fromStatus: "pending",
          toStatus: input.decision,
          fromAssigneeId: checkpoint.assigneeId,
          reason: input.reason,
        },
      });

      await recordStatusEvent(
        {
          tenantId: input.ctx.orgId,
          entityType: "report",
          entityId: report.id,
          fromValue: "in_review",
          toValue: targetStatus,
          actorId: input.ctx.userId ?? null,
          reason: approved ? "报告审批通过" : input.reason,
          metadata: { snapshot_hash: currentHash, version: report.version },
        },
        tx,
      );
      return { kind: "decided" as const };
    });
  },

  async deriveReportDraft(ctx: TenantCtx, sourceId: string, reason: string) {
    try {
      return await prisma.$transaction(async (tx) => {
        const source = await tx.report.findFirst({
          where: { id: sourceId, tenantId: ctx.orgId, deletedAt: null },
          include: { supersededBy: true },
        });
        if (!source) return { kind: "not_found" as const };
        if (!["approved", "exported"].includes(source.status)) {
          return { kind: "not_formal" as const };
        }
        if (source.supersededBy) {
          return { kind: "created" as const, report: source.supersededBy, reused: true };
        }

        const report = await tx.report.create({
          data: {
            id: randomUUID(),
            tenantId: ctx.orgId,
            seriesId: source.seriesId,
            version: source.version + 1,
            supersedesId: source.id,
            campaignId: source.campaignId,
            title: source.title,
            kind: source.kind,
            status: "draft",
            content: source.content as Prisma.InputJsonValue,
            derivationReason: reason,
            aiGenerated: source.aiGenerated,
            agentRunId: source.agentRunId,
            promptKey: source.promptKey,
            promptVersion: source.promptVersion,
            model: source.model,
            createdBy: ctx.userId ?? null,
          },
        });
        await recordStatusEvent(
          {
            tenantId: ctx.orgId,
            entityType: "report",
            entityId: report.id,
            fromValue: null,
            toValue: "draft",
            actorId: ctx.userId ?? null,
            reason: "从正式版本创建修订草稿",
            metadata: { supersedes_id: source.id, version: report.version, derivation_reason: reason },
          },
          tx,
        );
        return { kind: "created" as const, report, reused: false };
      });
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
        const existing = await prisma.report.findFirst({
          where: { tenantId: ctx.orgId, supersedesId: sourceId, deletedAt: null },
        });
        if (existing) return { kind: "created" as const, report: existing, reused: true };
      }
      throw error;
    }
  },

  async createReportExport(input: {
    ctx: TenantCtx;
    reportId: string;
    format: "json_snapshot";
    recipient: string;
    purpose: string | null;
    idempotencyKey: string;
  }) {
    try {
      return await prisma.$transaction(async (tx) => {
      const existing = await tx.reportExport.findFirst({
        where: { tenantId: input.ctx.orgId, idempotencyKey: input.idempotencyKey },
      });
      if (existing) {
        if (existing.reportId !== input.reportId) return { kind: "idempotency_conflict" as const };
        const report = await tx.report.findUnique({
          where: { id: existing.reportId },
          include: reportRelations,
        });
        return { kind: "created" as const, report: report!, exportRecord: existing, reused: true };
      }

      const report = await tx.report.findFirst({
        where: {
          id: input.reportId,
          tenantId: input.ctx.orgId,
          deletedAt: null,
          status: { in: ["approved", "exported"] },
        },
      });
      if (!report) return { kind: "not_exportable" as const };
      const snapshot = buildReportSnapshot(report);
      const snapshotHash = hashReportSnapshot(snapshot);
      if (report.approvedSnapshotHash && report.approvedSnapshotHash !== snapshotHash) {
        return { kind: "integrity_mismatch" as const };
      }

      const exportRecord = await tx.reportExport.create({
        data: {
          tenantId: input.ctx.orgId,
          reportId: report.id,
          reportVersion: report.version,
          format: input.format,
          recipient: input.recipient,
          purpose: input.purpose,
          snapshot: snapshot as unknown as Prisma.InputJsonValue,
          snapshotHash,
          hashAlgorithm: REPORT_HASH_ALGORITHM,
          idempotencyKey: input.idempotencyKey,
          createdBy: input.ctx.userId ?? null,
        },
      });

      if (report.status === "approved") {
        const updated = await tx.report.updateMany({
          where: { id: report.id, tenantId: input.ctx.orgId, status: "approved" },
          data: {
            status: "exported",
            approvedSnapshotHash: snapshotHash,
            hashAlgorithm: REPORT_HASH_ALGORITHM,
            updatedBy: input.ctx.userId ?? null,
          },
        });
        if (updated.count !== 1) throw new Error("报告导出状态已变化");
        await recordStatusEvent(
          {
            tenantId: input.ctx.orgId,
            entityType: "report",
            entityId: report.id,
            fromValue: "approved",
            toValue: "exported",
            actorId: input.ctx.userId ?? null,
            reason: "创建正式报告导出快照",
            metadata: { export_id: exportRecord.id, snapshot_hash: snapshotHash },
          },
          tx,
        );
      } else if (!report.approvedSnapshotHash) {
        await tx.report.updateMany({
          where: {
            id: report.id,
            tenantId: input.ctx.orgId,
            status: "exported",
            approvedSnapshotHash: null,
          },
          data: {
            approvedSnapshotHash: snapshotHash,
            hashAlgorithm: REPORT_HASH_ALGORITHM,
            updatedBy: input.ctx.userId ?? null,
          },
        });
      }

      const result = await tx.report.findUnique({ where: { id: report.id }, include: reportRelations });
        return { kind: "created" as const, report: result!, exportRecord, reused: false };
      });
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
        const existing = await prisma.reportExport.findFirst({
          where: { tenantId: input.ctx.orgId, idempotencyKey: input.idempotencyKey },
        });
        if (existing) {
          if (existing.reportId !== input.reportId) {
            return { kind: "idempotency_conflict" as const };
          }
          const report = await prisma.report.findFirst({
            where: { id: existing.reportId, tenantId: input.ctx.orgId, deletedAt: null },
            include: reportRelations,
          });
          if (report) {
            return { kind: "created" as const, report, exportRecord: existing, reused: true };
          }
        }
      }
      throw error;
    }
  },

  async getAgentRunTrace(agentRunId: string) {
    return prisma.agentRun.findUnique({
      where: { id: agentRunId },
      select: { promptKey: true, promptVersion: true, model: true },
    });
  },
};
