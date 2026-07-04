import "server-only";
import { prisma } from "@/server/db/client";
import type { CampaignCreator, Contract, PaymentRecord, Prisma } from "@/generated/prisma/client";
import type { TenantCtx } from "@/server/modules/brand/brand.repository";
import { recordStatusEvent } from "@/server/modules/status-events/status-event.repository";

export interface ContractListParams {
  limit: number;
  cursor: string | null;
  order: "asc" | "desc";
  status: string | null;
  campaignId: string | null;
}

const contractInclude = {
  payments: { where: { deletedAt: null }, orderBy: { createdAt: "desc" as const } },
} satisfies Prisma.ContractInclude;

type ContractRow = Prisma.ContractGetPayload<{ include: typeof contractInclude }>;

export type ContractWithRelations = ContractRow & {
  campaignCreator: CampaignCreator & {
    campaign: { id: string; name: string };
    creator: { id: string; displayName: string };
  };
};

export type PaymentWithContract = PaymentRecord & {
  contract: Contract & {
    campaignCreator: CampaignCreator & {
      creator: { displayName: string };
    };
  };
};

async function hydrateContracts(ctx: TenantCtx, rows: ContractRow[]): Promise<ContractWithRelations[]> {
  if (rows.length === 0) return [];
  const campaignCreatorIds = [...new Set(rows.map((row) => row.campaignCreatorId))];
  const campaignCreators = await prisma.campaignCreator.findMany({
    where: { id: { in: campaignCreatorIds }, tenantId: ctx.orgId, deletedAt: null },
    include: {
      campaign: { select: { id: true, name: true } },
      creator: { select: { id: true, displayName: true } },
    },
  });
  const byId = new Map(campaignCreators.map((cc) => [cc.id, cc]));
  return rows.map((row) => {
    const campaignCreator = byId.get(row.campaignCreatorId);
    if (!campaignCreator) {
      throw new Error(`contract ${row.id} 缺少 campaign_creator ${row.campaignCreatorId}`);
    }
    return { ...row, campaignCreator };
  });
}

export const contractRepository = {
  async listContracts(ctx: TenantCtx, params: ContractListParams): Promise<ContractWithRelations[]> {
    let campaignCreatorIds: string[] | null = null;
    if (params.campaignId) {
      const campaignCreators = await prisma.campaignCreator.findMany({
        where: { tenantId: ctx.orgId, campaignId: params.campaignId, deletedAt: null },
        select: { id: true },
      });
      campaignCreatorIds = campaignCreators.map((cc) => cc.id);
      if (campaignCreatorIds.length === 0) return [];
    }

    const rows = await prisma.contract.findMany({
      where: {
        tenantId: ctx.orgId,
        deletedAt: null,
        ...(params.status ? { status: params.status } : {}),
        ...(campaignCreatorIds ? { campaignCreatorId: { in: campaignCreatorIds } } : {}),
        ...(params.cursor
          ? { id: params.order === "desc" ? { lt: params.cursor } : { gt: params.cursor } }
          : {}),
      },
      include: contractInclude,
      orderBy: { id: params.order },
      take: params.limit + 1,
    });
    return hydrateContracts(ctx, rows);
  },

  async findContract(ctx: TenantCtx, id: string): Promise<ContractWithRelations | null> {
    const row = await prisma.contract.findFirst({
      where: { id, tenantId: ctx.orgId, deletedAt: null },
      include: contractInclude,
    });
    if (!row) return null;
    return (await hydrateContracts(ctx, [row]))[0] ?? null;
  },

  async findContractByCampaignCreator(ctx: TenantCtx, campaignCreatorId: string) {
    const row = await prisma.contract.findFirst({
      where: { tenantId: ctx.orgId, campaignCreatorId, deletedAt: null },
      include: contractInclude,
      orderBy: { createdAt: "desc" },
    });
    if (!row) return null;
    return (await hydrateContracts(ctx, [row]))[0] ?? null;
  },

  async createContract(
    ctx: TenantCtx,
    data: Omit<Prisma.ContractUncheckedCreateInput, "tenantId">,
  ): Promise<Contract> {
    return prisma.contract.create({
      data: { ...data, tenantId: ctx.orgId, createdBy: ctx.userId ?? null },
    });
  },

  async transitionContract(
    ctx: TenantCtx,
    id: string,
    fromValue: string,
    toValue: string,
    reason: string | null,
    extra: Prisma.ContractUncheckedUpdateInput = {},
  ): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await tx.contract.updateMany({
        where: { id, tenantId: ctx.orgId, deletedAt: null },
        data: { status: toValue, updatedBy: ctx.userId ?? null, ...extra },
      });
      await recordStatusEvent(
        {
          tenantId: ctx.orgId,
          entityType: "contract",
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

  async listPayments(ctx: TenantCtx, contractId: string): Promise<PaymentRecord[]> {
    return prisma.paymentRecord.findMany({
      where: { tenantId: ctx.orgId, contractId, deletedAt: null },
      orderBy: { createdAt: "desc" },
    });
  },

  async findPayment(ctx: TenantCtx, id: string): Promise<PaymentWithContract | null> {
    const row = await prisma.paymentRecord.findFirst({
      where: { id, tenantId: ctx.orgId, deletedAt: null },
      include: { contract: true },
    });
    if (!row) return null;
    const campaignCreator = await prisma.campaignCreator.findFirst({
      where: { id: row.contract.campaignCreatorId, tenantId: ctx.orgId, deletedAt: null },
      include: { creator: { select: { displayName: true } } },
    });
    if (!campaignCreator) {
      throw new Error(`payment ${row.id} 缺少 campaign_creator ${row.contract.campaignCreatorId}`);
    }
    return { ...row, contract: { ...row.contract, campaignCreator } };
  },

  async createPayment(
    ctx: TenantCtx,
    data: Omit<Prisma.PaymentRecordUncheckedCreateInput, "tenantId">,
  ): Promise<PaymentRecord> {
    return prisma.paymentRecord.create({
      data: { ...data, tenantId: ctx.orgId, createdBy: ctx.userId ?? null },
    });
  },

  async transitionPayment(
    ctx: TenantCtx,
    id: string,
    fromValue: string,
    toValue: string,
    reason: string | null,
    extra: Prisma.PaymentRecordUncheckedUpdateInput = {},
  ): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await tx.paymentRecord.updateMany({
        where: { id, tenantId: ctx.orgId, deletedAt: null },
        data: { status: toValue, updatedBy: ctx.userId ?? null, ...extra },
      });
      await recordStatusEvent(
        {
          tenantId: ctx.orgId,
          entityType: "payment_record",
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

  async paidTotal(ctx: TenantCtx, contractId: string): Promise<number> {
    const agg = await prisma.paymentRecord.aggregate({
      where: { tenantId: ctx.orgId, contractId, deletedAt: null, status: "paid" },
      _sum: { amountCents: true },
    });
    return agg._sum.amountCents ?? 0;
  },
};
