import { createApiHandler } from "@/server/api/handler";
import {
  answerKnowledgeQuestion,
  listRecentRagQueries,
} from "@/server/modules/knowledge/knowledge.service";
import { KnowledgeQuerySchema } from "@/shared/schemas/knowledge";

export const GET = createApiHandler({
  permission: "knowledge:read",
  handler: async (ctx) =>
    listRecentRagQueries({ orgId: ctx.auth.orgId, userId: ctx.auth.userId }),
});

export const POST = createApiHandler({
  permission: "knowledge:read",
  body: KnowledgeQuerySchema,
  audit: "knowledge.query",
  handler: async (ctx) =>
    answerKnowledgeQuestion({ orgId: ctx.auth.orgId, userId: ctx.auth.userId }, ctx.body),
});
