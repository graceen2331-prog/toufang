import { createApiHandler, paginated } from "@/server/api/handler";
import { parseListQuery } from "@/server/api/pagination";
import {
  createKnowledgeDocument,
  listKnowledgeDocuments,
} from "@/server/modules/knowledge/knowledge.service";
import { KnowledgeDocumentCreateSchema } from "@/shared/schemas/knowledge";

export const GET = createApiHandler({
  permission: "knowledge:read",
  handler: async (ctx) => {
    const query = parseListQuery(ctx.searchParams, { sortable: ["created_at"], defaultSort: "created_at" });
    const { items, pagination } = await listKnowledgeDocuments(
      { orgId: ctx.auth.orgId, userId: ctx.auth.userId },
      {
        ...query,
        status: ctx.searchParams.get("status"),
        type: ctx.searchParams.get("type"),
      },
    );
    return paginated(items, pagination);
  },
});

export const POST = createApiHandler({
  permission: "knowledge:write",
  body: KnowledgeDocumentCreateSchema,
  audit: "knowledge_document.create",
  created: true,
  handler: async (ctx) => {
    const doc = await createKnowledgeDocument(
      { orgId: ctx.auth.orgId, userId: ctx.auth.userId },
      ctx.body,
    );
    ctx.setAuditEntity("knowledge_document", doc.id, { title: doc.title });
    return doc;
  },
});
