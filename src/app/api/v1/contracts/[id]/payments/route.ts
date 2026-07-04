import { createApiHandler } from "@/server/api/handler";
import { createPayment, listPayments } from "@/server/modules/contract/contract.service";
import { PaymentCreateSchema } from "@/shared/schemas/outreach";

export const GET = createApiHandler({
  permission: "payment:read",
  handler: async (ctx) =>
    listPayments({ orgId: ctx.auth.orgId, userId: ctx.auth.userId }, ctx.params.id!),
});

export const POST = createApiHandler({
  permission: "payment:write",
  body: PaymentCreateSchema.omit({ contract_id: true }),
  audit: "payment.create",
  created: true,
  handler: async (ctx) => {
    const payment = await createPayment(
      { orgId: ctx.auth.orgId, userId: ctx.auth.userId },
      ctx.params.id!,
      ctx.body,
    );
    ctx.setAuditEntity("payment_record", payment.id, { contract_id: payment.contract_id });
    return payment;
  },
});
