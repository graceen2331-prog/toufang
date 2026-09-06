import "server-only";
import { randomUUID } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/db/client";
import type { Pagination } from "@/server/api/envelope";
import { paginate } from "@/server/api/pagination";
import type { TenantCtx } from "@/server/modules/brand/brand.repository";
import { recordStatusEvent } from "@/server/modules/status-events/status-event.repository";
import type { KnowledgeChunkDraft } from "./chunker";

export interface KnowledgeDocumentListParams {
  limit: number;
  cursor: string | null;
  order: "asc" | "desc";
  status: string | null;
  type: string | null;
  q: string | null;
}

export interface KnowledgeSearchParams {
  limit: number;
  brandId?: string | null;
  campaignId?: string | null;
  documentTypes?: string[];
}

export interface RetrievedKnowledgeChunk {
  chunk_id: string;
  document_id: string;
  title: string;
  content: string;
  heading_path: string | null;
  distance: number;
  score: number;
}

interface ChunkInsert extends KnowledgeChunkDraft {
  vector: number[];
}

const documentInclude = {
  _count: { select: { chunks: true } },
} satisfies Prisma.KnowledgeDocumentInclude;

export type KnowledgeDocumentWithCount = Prisma.KnowledgeDocumentGetPayload<{
  include: typeof documentInclude;
}>;

function vectorLiteral(vector: number[]): string {
  return `[${vector.map((value) => Number(value.toFixed(6))).join(",")}]`;
}

export function buildKnowledgeSearchSql(
  ctx: TenantCtx,
  vector: number[],
  params: KnowledgeSearchParams,
): Prisma.Sql {
  const vectorText = vectorLiteral(vector);
  const typeFilter =
    params.documentTypes && params.documentTypes.length > 0
      ? Prisma.sql`AND kd.type IN (${Prisma.join(params.documentTypes)})`
      : Prisma.empty;
  const brandFilter = params.brandId
    ? Prisma.sql`AND kd.brand_id = ${params.brandId}`
    : Prisma.empty;
  const campaignFilter = params.campaignId
    ? Prisma.sql`AND kd.campaign_id = ${params.campaignId}`
    : Prisma.empty;
  const privateOwner = ctx.userId ?? "";

  return Prisma.sql`
    SELECT
      kc.id AS chunk_id,
      kc.document_id,
      kd.title,
      kc.content,
      kc.heading_path,
      (kc.embedding <=> ${vectorText}::vector) AS distance
    FROM knowledge_chunks kc
    JOIN knowledge_documents kd ON kd.id = kc.document_id
    WHERE kc.tenant_id = ${ctx.orgId}
      AND kd.tenant_id = ${ctx.orgId}
      AND kd.deleted_at IS NULL
      AND kd.status = 'ready'
      AND kc.embedding IS NOT NULL
      AND (
        kd.visibility IN ('workspace', 'team')
        OR (kd.visibility = 'private' AND kd.created_by = ${privateOwner})
      )
      ${brandFilter}
      ${campaignFilter}
      ${typeFilter}
    ORDER BY kc.embedding <=> ${vectorText}::vector
    LIMIT ${params.limit}
  `;
}

export const knowledgeRepository = {
  async listDocuments(
    ctx: TenantCtx,
    params: KnowledgeDocumentListParams,
  ): Promise<{ items: KnowledgeDocumentWithCount[]; pagination: Pagination }> {
    const rows = await prisma.knowledgeDocument.findMany({
      where: {
        tenantId: ctx.orgId,
        deletedAt: null,
        ...(params.status ? { status: params.status } : {}),
        ...(params.type ? { type: params.type } : {}),
        ...(params.q ? { title: { contains: params.q, mode: "insensitive" } } : {}),
        ...(params.cursor
          ? { id: params.order === "desc" ? { lt: params.cursor } : { gt: params.cursor } }
          : {}),
      },
      include: documentInclude,
      orderBy: { id: params.order },
      take: params.limit + 1,
    });
    return paginate(rows, params.limit);
  },

  async findDocument(ctx: TenantCtx, id: string): Promise<KnowledgeDocumentWithCount | null> {
    return prisma.knowledgeDocument.findFirst({
      where: { id, tenantId: ctx.orgId, deletedAt: null },
      include: documentInclude,
    });
  },

  async createDocument(
    ctx: TenantCtx,
    data: Omit<Prisma.KnowledgeDocumentUncheckedCreateInput, "tenantId">,
  ) {
    return prisma.knowledgeDocument.create({
      data: { ...data, tenantId: ctx.orgId, createdBy: ctx.userId ?? null },
      include: documentInclude,
    });
  },

  async transitionDocument(
    ctx: TenantCtx,
    id: string,
    fromValue: string,
    toValue: string,
    reason: string | null,
    extra: Prisma.KnowledgeDocumentUncheckedUpdateInput = {},
  ): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await tx.knowledgeDocument.updateMany({
        where: { id, tenantId: ctx.orgId, deletedAt: null },
        data: { status: toValue, updatedBy: ctx.userId ?? null, ...extra },
      });
      await recordStatusEvent(
        {
          tenantId: ctx.orgId,
          entityType: "knowledge_document",
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

  async archiveDocument(ctx: TenantCtx, id: string, fromValue: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await tx.knowledgeDocument.updateMany({
        where: { id, tenantId: ctx.orgId, deletedAt: null },
        data: { status: "archived", deletedAt: new Date(), deletedBy: ctx.userId ?? null },
      });
      await recordStatusEvent(
        {
          tenantId: ctx.orgId,
          entityType: "knowledge_document",
          entityId: id,
          fromValue,
          toValue: "archived",
          actorId: ctx.userId ?? null,
          reason: "归档知识文档",
        },
        tx,
      );
    });
  },

  async replaceChunks(ctx: TenantCtx, documentId: string, chunks: ChunkInsert[]): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await tx.knowledgeChunk.deleteMany({ where: { tenantId: ctx.orgId, documentId } });
      for (const chunk of chunks) {
        await tx.$executeRaw`
          INSERT INTO knowledge_chunks (
            id, tenant_id, document_id, chunk_index, content, content_hash, heading_path, metadata, embedding
          )
          VALUES (
            ${randomUUID()},
            ${ctx.orgId},
            ${documentId},
            ${chunk.chunkIndex},
            ${chunk.content},
            ${chunk.contentHash},
            ${chunk.headingPath},
            ${JSON.stringify(chunk.metadata)}::jsonb,
            ${vectorLiteral(chunk.vector)}::vector
          )
        `;
      }
    });
  },

  async retrieveChunks(
    ctx: TenantCtx,
    vector: number[],
    params: KnowledgeSearchParams,
  ): Promise<RetrievedKnowledgeChunk[]> {
    const rows = await prisma.$queryRaw<Array<Omit<RetrievedKnowledgeChunk, "score">>>(
      buildKnowledgeSearchSql(ctx, vector, params),
    );
    return rows.map((row) => ({
      ...row,
      distance: Number(row.distance),
      score: Math.max(0, 1 - Number(row.distance)),
    }));
  },

  async createRagQuery(input: {
    tenantId: string;
    userId: string | null;
    agentRunId: string | null;
    query: string;
    answer: string;
    citations: unknown[];
    latencyMs: number;
  }) {
    return prisma.ragQuery.create({
      data: {
        tenantId: input.tenantId,
        userId: input.userId,
        agentRunId: input.agentRunId,
        query: input.query,
        answer: input.answer,
        citations: input.citations as object,
        latencyMs: input.latencyMs,
      },
    });
  },

  async listRecentQueries(ctx: TenantCtx, limit = 10) {
    return prisma.ragQuery.findMany({
      where: { tenantId: ctx.orgId, userId: ctx.userId ?? undefined },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  },
};
