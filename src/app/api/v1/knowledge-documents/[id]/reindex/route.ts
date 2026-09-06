import { createApiHandler } from "@/server/api/handler";
import { reindexKnowledgeDocument } from "@/server/modules/knowledge/knowledge.service";

export const POST = createApiHandler({
  permission: "knowledge:write",
  audit: "knowledge_document.reindex",
  handler: async (ctx) => {
    const doc = await reindexKnowledgeDocument(
      { orgId: ctx.auth.orgId, userId: ctx.auth.userId },
      ctx.params.id!,
    );
    ctx.setAuditEntity("knowledge_document", doc.id);
    return doc;
  },
});
