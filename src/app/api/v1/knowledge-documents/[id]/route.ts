import { createApiHandler } from "@/server/api/handler";
import {
  deleteKnowledgeDocument,
  getKnowledgeDocument,
} from "@/server/modules/knowledge/knowledge.service";

export const GET = createApiHandler({
  permission: "knowledge:read",
  handler: async (ctx) =>
    getKnowledgeDocument({ orgId: ctx.auth.orgId, userId: ctx.auth.userId }, ctx.params.id!),
});

export const DELETE = createApiHandler({
  permission: "knowledge:write",
  audit: "knowledge_document.delete",
  handler: async (ctx) => {
    await deleteKnowledgeDocument({ orgId: ctx.auth.orgId, userId: ctx.auth.userId }, ctx.params.id!);
    ctx.setAuditEntity("knowledge_document", ctx.params.id!);
    return { deleted: true };
  },
});
