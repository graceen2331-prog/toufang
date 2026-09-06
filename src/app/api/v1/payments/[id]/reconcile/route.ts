import { createApiHandler } from "@/server/api/handler";
import { reconcilePayment } from "@/server/modules/contract/contract.service";
import { PaymentReconcileSchema } from "@/shared/schemas/outreach";

export const POST = createApiHandler({
  permission: "payment:reconcile",
  body: PaymentReconcileSchema,
  audit: "payment.reconcile",
  handler: async (ctx) => {
    const payment = await reconcilePayment(
      { orgId: ctx.auth.orgId, userId: ctx.auth.userId },
      ctx.params.id!,
      ctx.body,
    );
    ctx.setAuditEntity("payment_record", payment.id, {
      reconciliation_reference: payment.reconciliation_reference,
    });
    return payment;
  },
});
