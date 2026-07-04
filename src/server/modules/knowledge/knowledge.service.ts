import "server-only";
import { ApiError, type Pagination } from "@/server/api/envelope";
import { routerEmbed } from "@/server/ai/router";
import { runAgent } from "@/server/ai/agents/run-agent";
import { knowledgeAnswerPrompt, type KnowledgeAnswerOutput } from "@/server/ai/prompts/knowledge";
import { getRagIngestQueue } from "@/server/jobs/queues";
import type { TenantCtx } from "@/server/modules/brand/brand.repository";
import { KNOWLEDGE_DOCUMENT_STATUS, assertTransition } from "@/shared/constants/status";
import type {
  KnowledgeAnswerDto,
  KnowledgeCitationDto,
  KnowledgeDocumentCreateInput,
  KnowledgeDocumentDto,
  KnowledgeQueryInput,
  RagQueryDto,
} from "@/shared/schemas/knowledge";
import { chunkText } from "./chunker";
import {
  knowledgeRepository,
  type KnowledgeDocumentListParams,
  type KnowledgeDocumentWithCount,
  type RetrievedKnowledgeChunk,
} from "./knowledge.repository";

function documentToDto(doc: KnowledgeDocumentWithCount): KnowledgeDocumentDto {
  return {
    id: doc.id,
    title: doc.title,
    type: doc.type,
    status: doc.status,
    visibility: doc.visibility,
    source_type: doc.sourceType,
    source_id: doc.sourceId,
    brand_id: doc.brandId,
    campaign_id: doc.campaignId,
    chunk_count: doc._count.chunks,
    failure_reason: doc.failureReason,
    created_at: doc.createdAt.toISOString(),
    updated_at: doc.updatedAt.toISOString(),
  };
}

function citationsFromJson(value: unknown): KnowledgeCitationDto[] {
  return Array.isArray(value) ? (value as KnowledgeCitationDto[]) : [];
}

function ragQueryToDto(row: {
  id: string;
  query: string;
  answer: string | null;
  citations: unknown;
  feedback: string | null;
  latencyMs: number;
  createdAt: Date;
}): RagQueryDto {
  return {
    id: row.id,
    query: row.query,
    answer: row.answer,
    citations: citationsFromJson(row.citations),
    feedback: row.feedback,
    latency_ms: row.latencyMs,
    created_at: row.createdAt.toISOString(),
  };
}

export function normalizeKnowledgeAnswer(
  output: KnowledgeAnswerOutput,
  retrieved: RetrievedKnowledgeChunk[],
): Pick<KnowledgeAnswerDto, "answer" | "citations" | "confidence" | "missing_knowledge"> {
  if (retrieved.length === 0) {
    return {
      answer: "知识库中没有找到足够依据回答这个问题。",
      citations: [],
      confidence: 0,
      missing_knowledge: ["当前检索范围内没有相关知识片段"],
    };
  }

  const byChunkId = new Map(retrieved.map((chunk) => [chunk.chunk_id, chunk]));
  const selected = output.citations
    .map((citation) => byChunkId.get(citation.chunk_id))
    .filter((chunk): chunk is RetrievedKnowledgeChunk => !!chunk);
  const chunks = selected.length > 0 ? selected : retrieved.slice(0, Math.min(2, retrieved.length));
  const citations = chunks.map((chunk, index) => ({
    index: index + 1,
    chunk_id: chunk.chunk_id,
    document_id: chunk.document_id,
    title: chunk.title,
    quote: chunk.content.slice(0, 160),
    score: Number(chunk.score.toFixed(4)),
  }));

  let answer = output.answer.trim();
  if (!answer.includes("[1]") && citations.length > 0) {
    answer = `${answer.replace(/[。.]?$/, "。")} [1]`;
  }

  return {
    answer,
    citations,
    confidence: output.confidence,
    missing_knowledge: answer.includes("知识库中没有") ? ["检索结果不足以支持完整回答"] : [],
  };
}

async function enqueueIngest(ctx: TenantCtx, documentId: string): Promise<void> {
  await getRagIngestQueue().add(
    `rag-ingest.${documentId}`,
    { tenantId: ctx.orgId, documentId, createdBy: ctx.userId ?? null },
    { jobId: `rag-ingest.${documentId}` },
  );
}

export async function listKnowledgeDocuments(
  ctx: TenantCtx,
  params: KnowledgeDocumentListParams,
): Promise<{ items: KnowledgeDocumentDto[]; pagination: Pagination }> {
  const { items, pagination } = await knowledgeRepository.listDocuments(ctx, params);
  return { items: items.map(documentToDto), pagination };
}

export async function getKnowledgeDocument(
  ctx: TenantCtx,
  id: string,
): Promise<KnowledgeDocumentDto> {
  const doc = await knowledgeRepository.findDocument(ctx, id);
  if (!doc) throw new ApiError("RESOURCE_NOT_FOUND", "知识文档不存在");
  return documentToDto(doc);
}

export async function createKnowledgeDocument(
  ctx: TenantCtx,
  input: KnowledgeDocumentCreateInput,
): Promise<KnowledgeDocumentDto> {
  const doc = await knowledgeRepository.createDocument(ctx, {
    title: input.title,
    type: input.type,
    visibility: input.visibility,
    sourceType: input.source_type,
    sourceId: input.source_id ?? null,
    brandId: input.brand_id ?? null,
    campaignId: input.campaign_id ?? null,
    content: input.content,
    metadata: { ingestion: "queued" },
  });
  await enqueueIngest(ctx, doc.id);
  return documentToDto(doc);
}

export async function reindexKnowledgeDocument(
  ctx: TenantCtx,
  id: string,
): Promise<KnowledgeDocumentDto> {
  const doc = await knowledgeRepository.findDocument(ctx, id);
  if (!doc) throw new ApiError("RESOURCE_NOT_FOUND", "知识文档不存在");
  assertTransition(KNOWLEDGE_DOCUMENT_STATUS, doc.status, "parsing");
  await enqueueIngest(ctx, id);
  return getKnowledgeDocument(ctx, id);
}

export async function deleteKnowledgeDocument(ctx: TenantCtx, id: string): Promise<void> {
  const doc = await knowledgeRepository.findDocument(ctx, id);
  if (!doc) throw new ApiError("RESOURCE_NOT_FOUND", "知识文档不存在");
  assertTransition(KNOWLEDGE_DOCUMENT_STATUS, doc.status, "archived");
  await knowledgeRepository.archiveDocument(ctx, id, doc.status);
}

export async function processKnowledgeDocument(input: {
  tenantId: string;
  documentId: string;
  createdBy: string | null;
}): Promise<void> {
  const ctx: TenantCtx = { orgId: input.tenantId, userId: input.createdBy ?? undefined };
  const doc = await knowledgeRepository.findDocument(ctx, input.documentId);
  if (!doc) throw new Error(`知识文档不存在: ${input.documentId}`);
  if (doc.status === "archived") return;

  try {
    if (doc.status !== "parsing") {
      assertTransition(KNOWLEDGE_DOCUMENT_STATUS, doc.status, "parsing");
      await knowledgeRepository.transitionDocument(
        ctx,
        doc.id,
        doc.status,
        "parsing",
        "开始解析文档",
      );
    }
    const text = doc.content?.trim();
    if (!text) throw new Error("文档没有可解析的文本内容");

    await knowledgeRepository.transitionDocument(
      ctx,
      doc.id,
      "parsing",
      "chunking",
      "文档解析完成",
    );
    const chunks = chunkText(text);
    if (chunks.length === 0) throw new Error("文档内容为空，无法分块");

    await knowledgeRepository.transitionDocument(
      ctx,
      doc.id,
      "chunking",
      "embedding",
      "开始生成向量",
    );
    const vectors = await routerEmbed(
      input.tenantId,
      chunks.map((chunk) => chunk.content),
      input.createdBy,
    );
    await knowledgeRepository.replaceChunks(
      ctx,
      doc.id,
      chunks.map((chunk, index) => ({ ...chunk, vector: vectors[index]! })),
    );
    await knowledgeRepository.transitionDocument(
      ctx,
      doc.id,
      "embedding",
      "ready",
      "知识索引完成",
      {
        failureReason: null,
        metadata: { chunk_count: chunks.length },
      },
    );
  } catch (err) {
    const latest = await knowledgeRepository.findDocument(ctx, doc.id);
    const from = latest?.status ?? doc.status;
    if (["parsing", "chunking", "embedding"].includes(from)) {
      await knowledgeRepository.transitionDocument(ctx, doc.id, from, "failed", "知识摄取失败", {
        failureReason: err instanceof Error ? err.message : String(err),
      });
    }
    throw err;
  }
}

export async function answerKnowledgeQuestion(
  ctx: TenantCtx,
  input: KnowledgeQueryInput,
): Promise<KnowledgeAnswerDto> {
  const start = Date.now();
  const [queryVector] = await routerEmbed(ctx.orgId, [input.question], ctx.userId ?? null);
  const retrieved = await knowledgeRepository.retrieveChunks(ctx, queryVector!, {
    limit: input.top_k,
    brandId: input.filters?.brand_id ?? null,
    campaignId: input.filters?.campaign_id ?? null,
    documentTypes: input.filters?.document_type ?? [],
  });

  if (retrieved.length === 0) {
    const answer = "知识库中没有找到足够依据回答这个问题。";
    const saved = await knowledgeRepository.createRagQuery({
      tenantId: ctx.orgId,
      userId: ctx.userId ?? null,
      agentRunId: null,
      query: input.question,
      answer,
      citations: [],
      latencyMs: Date.now() - start,
    });
    return {
      query_id: saved.id,
      answer,
      confidence: 0,
      citations: [],
      missing_knowledge: ["当前检索范围内没有相关知识片段"],
    };
  }

  const { output, agentRunId } = await runAgent({
    tenantId: ctx.orgId,
    agentKey: "knowledge",
    prompt: knowledgeAnswerPrompt,
    userMessage: JSON.stringify({
      question: input.question,
      chunks: retrieved.map((chunk, index) => ({
        index: index + 1,
        chunk_id: chunk.chunk_id,
        document_id: chunk.document_id,
        title: chunk.title,
        content: chunk.content,
      })),
    }),
    input: { question: input.question, filters: input.filters ?? {} },
    light: true,
    createdBy: ctx.userId ?? null,
  });
  const normalized = normalizeKnowledgeAnswer(output, retrieved);
  const saved = await knowledgeRepository.createRagQuery({
    tenantId: ctx.orgId,
    userId: ctx.userId ?? null,
    agentRunId,
    query: input.question,
    answer: normalized.answer,
    citations: normalized.citations,
    latencyMs: Date.now() - start,
  });

  return { query_id: saved.id, ...normalized };
}

export async function listRecentRagQueries(ctx: TenantCtx): Promise<RagQueryDto[]> {
  const rows = await knowledgeRepository.listRecentQueries(ctx);
  return rows.map(ragQueryToDto);
}
