import { createApiHandler } from "@/server/api/handler";
import {
  listContentReviews,
  startContentReviewWorkflow,
} from "@/server/modules/content/content.service";
import { ContentReviewTriggerSchema } from "@/shared/schemas/content-analytics";

export const GET = createApiHandler({
  permission: "content:read",
  handler: async (ctx) =>
    listContentReviews({ orgId: ctx.auth.orgId, userId: ctx.auth.userId }, ctx.params.id!),
});

export const POST = createApiHandler({
  permission: "content:review",
  body: ContentReviewTriggerSchema,
  audit: "content_review.start",
  created: true,
  handler: async (ctx) => {
    const run = await startContentReviewWorkflow(
      { orgId: ctx.auth.orgId, userId: ctx.auth.userId },
      ctx.params.id!,
      ctx.body.instruction,
    );
    ctx.setAuditEntity("content_asset", ctx.params.id!, { workflow_run_id: run.workflow_run_id });
    return run;
  },
});
