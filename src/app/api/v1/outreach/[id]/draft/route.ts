import { createApiHandler } from "@/server/api/handler";
import { draftOutreachMessage } from "@/server/modules/outreach/outreach.service";
import { OutreachDraftRequestSchema } from "@/shared/schemas/outreach";

export const POST = createApiHandler({
  permission: "ai:run",
  body: OutreachDraftRequestSchema,
  audit: "outreach.draft_ai",
  created: true,
  handler: async (ctx) => {
    const message = await draftOutreachMessage(
      { orgId: ctx.auth.orgId, userId: ctx.auth.userId },
      ctx.params.id!,
      ctx.body.instruction,
    );
    ctx.setAuditEntity("outreach_message", message.id);
    return message;
  },
});
