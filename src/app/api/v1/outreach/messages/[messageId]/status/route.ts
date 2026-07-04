import { createApiHandler } from "@/server/api/handler";
import { transitionMessage } from "@/server/modules/outreach/outreach.service";
import { OutreachMessageStatusSchema } from "@/shared/schemas/outreach";

export const POST = createApiHandler({
  permission: "outreach:send",
  body: OutreachMessageStatusSchema,
  audit: "outreach.message_status",
  handler: async (ctx) => {
    await transitionMessage(
      { orgId: ctx.auth.orgId, userId: ctx.auth.userId },
      ctx.params.messageId!,
      ctx.body.to,
      ctx.body.reason,
    );
    ctx.setAuditEntity("outreach_message", ctx.params.messageId!, { to: ctx.body.to });
    return { updated: true };
  },
});
