import { randomUUID } from "node:crypto";
import { Prisma, type PrismaClient } from "../src/generated/prisma/client";
import { chunkText } from "../src/server/modules/knowledge/chunker";

const KNOWLEDGE_DOCS = [
  {
    title: "GlowLab 双十一内容复盘知识卡",
    type: "report",
    visibility: "workspace",
    content: `# GlowLab 双十一内容复盘知识卡

## 内容策略结论
历史美妆 Campaign 复盘显示，成分实测内容更适合承担信任背书，尤其是 28 天打卡、前后对比和配方师解释这三类内容。短视频负责快速建立认知，图文笔记负责沉淀收藏和搜索。

## 转化链路
内容末尾必须补齐购物车 CTA，并用清晰利益点承接转化。没有购物车 CTA 的内容，点击率通常低于 Campaign 均值；带有双十一专属优惠提醒的内容，更容易把收藏转化为加购。

## 合规提醒
禁止使用“医疗级”“治愈”“最强”“第一”等绝对化或医疗化表达。达人初稿提交后应先进入内容审核，再进入发布排期。`,
  },
  {
    title: "品牌知识 SOP：RAG 可引用资料整理",
    type: "sop",
    visibility: "workspace",
    content: `# 品牌知识 SOP：RAG 可引用资料整理

## 入库范围
可入库资料包括品牌手册、Campaign Brief、复盘报告、研究摘要、内容审核规则和 SOP。资料必须有明确标题，正文尽量使用 Markdown 小标题，方便分块后引用。

## 问答规则
知识问答只能依据已入库且状态为就绪的资料回答。若知识库中没有足够依据，必须明确说明“知识库中没有”，不能凭空补全。

## 运营建议
每次 Campaign 结束后，把关键复盘结论沉淀为 1 篇摘要，并标记品牌、Campaign 与资料类型。`,
  },
];

function deterministicVector(text: string): number[] {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  }
  const vec = new Array<number>(1536);
  let x = h;
  for (let i = 0; i < 1536; i += 1) {
    x = Math.imul(x ^ (x >>> 15), 2246822507);
    vec[i] = ((x >>> 0) / 4294967296) * 2 - 1;
  }
  return vec;
}

function vectorLiteral(vector: number[]): string {
  return `[${vector.map((value) => Number(value.toFixed(6))).join(",")}]`;
}

async function ensureStatusEvent(
  prisma: PrismaClient,
  input: {
    tenantId: string;
    entityId: string;
    toValue: string;
    actorId: string;
    reason: string;
  },
) {
  const existing = await prisma.statusEvent.findFirst({
    where: {
      tenantId: input.tenantId,
      entityType: "knowledge_document",
      entityId: input.entityId,
      toValue: input.toValue,
    },
  });
  if (existing) return;
  await prisma.statusEvent.create({
    data: {
      tenantId: input.tenantId,
      entityType: "knowledge_document",
      entityId: input.entityId,
      fromValue: null,
      toValue: input.toValue,
      actorId: input.actorId,
      reason: input.reason,
      metadata: { seed: true },
    },
  });
}

async function upsertReadyKnowledgeDocument(
  prisma: PrismaClient,
  tenantId: string,
  createdBy: string,
  doc: (typeof KNOWLEDGE_DOCS)[number],
) {
  const existing = await prisma.knowledgeDocument.findFirst({
    where: { tenantId, title: doc.title, deletedAt: null },
  });
  const saved = existing
    ? await prisma.knowledgeDocument.update({
        where: { id: existing.id },
        data: {
          type: doc.type,
          status: "ready",
          visibility: doc.visibility,
          sourceType: "upload",
          content: doc.content,
          metadata: { seed: true, ingestion: "seeded" },
          failureReason: null,
          updatedBy: createdBy,
        },
      })
    : await prisma.knowledgeDocument.create({
        data: {
          tenantId,
          title: doc.title,
          type: doc.type,
          status: "ready",
          visibility: doc.visibility,
          sourceType: "upload",
          content: doc.content,
          metadata: { seed: true, ingestion: "seeded" },
          createdBy,
          updatedBy: createdBy,
        },
      });

  await prisma.knowledgeChunk.deleteMany({ where: { tenantId, documentId: saved.id } });
  const chunks = chunkText(doc.content);
  for (const chunk of chunks) {
    await prisma.$executeRaw`
      INSERT INTO knowledge_chunks (
        id, tenant_id, document_id, chunk_index, content, content_hash, heading_path, metadata, embedding
      )
      VALUES (
        ${randomUUID()},
        ${tenantId},
        ${saved.id},
        ${chunk.chunkIndex},
        ${chunk.content},
        ${chunk.contentHash},
        ${chunk.headingPath},
        ${JSON.stringify(chunk.metadata)}::jsonb,
        ${vectorLiteral(deterministicVector(chunk.content))}::vector
      )
    `;
  }

  await ensureStatusEvent(prisma, {
    tenantId,
    entityId: saved.id,
    toValue: "ready",
    actorId: createdBy,
    reason: "seed 预生成知识索引",
  });
}

async function upsertNotification(
  prisma: PrismaClient,
  input: {
    tenantId: string;
    userId: string;
    type: string;
    title: string;
    body: string;
    linkUrl: string;
    priority?: string;
  },
) {
  const existing = await prisma.notification.findFirst({
    where: { tenantId: input.tenantId, userId: input.userId, title: input.title },
  });
  if (existing) {
    await prisma.notification.update({
      where: { id: existing.id },
      data: {
        type: input.type,
        body: input.body,
        linkUrl: input.linkUrl,
        priority: input.priority ?? "normal",
      },
    });
    return;
  }
  await prisma.notification.create({
    data: {
      tenantId: input.tenantId,
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      linkUrl: input.linkUrl,
      priority: input.priority ?? "normal",
    },
  });
}

async function ensureAuditLog(
  prisma: PrismaClient,
  input: {
    tenantId: string;
    actorId: string;
    action: string;
    entityType: string;
    entityId: string;
    metadata: Record<string, unknown>;
  },
) {
  const existing = await prisma.auditLog.findFirst({
    where: {
      tenantId: input.tenantId,
      actorId: input.actorId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
    },
  });
  if (existing) return;
  await prisma.auditLog.create({
    data: {
      tenantId: input.tenantId,
      actorId: input.actorId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      metadata: input.metadata as Prisma.InputJsonValue,
    },
  });
}

export async function seedKnowledge(
  prisma: PrismaClient,
  tenantId: string,
  createdBy: string,
): Promise<void> {
  for (const doc of KNOWLEDGE_DOCS) {
    await upsertReadyKnowledgeDocument(prisma, tenantId, createdBy, doc);
  }

  const memberships = await prisma.membership.findMany({
    where: { tenantId, deletedAt: null, status: "active" },
    include: { role: true, user: true },
  });
  const admin = memberships.find((membership) => membership.role.key === "admin")?.user;
  const viewer = memberships.find((membership) => membership.role.key === "viewer")?.user;

  if (admin) {
    await upsertNotification(prisma, {
      tenantId,
      userId: admin.id,
      type: "system",
      title: "知识库已准备好",
      body: "W8 seed 已写入可直接问答的中文知识文档。",
      linkUrl: "/knowledge",
      priority: "normal",
    });
    await upsertNotification(prisma, {
      tenantId,
      userId: admin.id,
      type: "risk_alert",
      title: "内容合规规则已入库",
      body: "医疗化与绝对化表达已整理为 RAG 可引用资料。",
      linkUrl: "/knowledge",
      priority: "high",
    });
  }
  if (viewer) {
    await upsertNotification(prisma, {
      tenantId,
      userId: viewer.id,
      type: "system",
      title: "你可以查看知识库",
      body: "只读成员可查看知识库并进行带引用的问答。",
      linkUrl: "/knowledge",
    });
  }

  const docs = await prisma.knowledgeDocument.findMany({
    where: { tenantId, title: { in: KNOWLEDGE_DOCS.map((doc) => doc.title) }, deletedAt: null },
  });
  for (const doc of docs) {
    await ensureAuditLog(prisma, {
      tenantId,
      actorId: createdBy,
      action: "knowledge_document.seed_ready",
      entityType: "knowledge_document",
      entityId: doc.id,
      metadata: { title: doc.title, seed: true },
    });
  }

  console.log("[seed] 已补齐 W8 知识库/RAG/通知/审计演示数据");
}
