import { createApiHandler } from "@/server/api/handler";
import { transitionPaymentStatus } from "@/server/modules/contract/contract.service";
import { PaymentStatusChangeSchema } from "@/shared/schemas/outreach";

export const POST = createApiHandler({
  permission: "payment:write",
  body: PaymentStatusChangeSchema,
  audit: "payment.status_change",
  handler: async (ctx) => {
    const payment = await transitionPaymentStatus(
      { orgId: ctx.auth.orgId, userId: ctx.auth.userId },
      ctx.params.id!,
      ctx.body.to,
      ctx.body.reason,
    );
    ctx.setAuditEntity("payment_record", payment.id, { to: ctx.body.to });
    return payment;
  },
});
