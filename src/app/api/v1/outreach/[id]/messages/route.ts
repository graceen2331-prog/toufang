import { createApiHandler } from "@/server/api/handler";
import { addMessage } from "@/server/modules/outreach/outreach.service";
import { OutreachMessageCreateSchema } from "@/shared/schemas/outreach";

export const POST = createApiHandler({
  permission: "outreach:write",
  body: OutreachMessageCreateSchema,
  audit: "outreach.message_create",
  created: true,
  handler: async (ctx) => {
    const message = await addMessage(
      { orgId: ctx.auth.orgId, userId: ctx.auth.userId },
      ctx.params.id!,
      ctx.body,
    );
    ctx.setAuditEntity("outreach_message", message.id, { direction: message.direction });
    return message;
  },
});
