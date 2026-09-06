import { createApiHandler } from "@/server/api/handler";
import { createBudgetItem, listBudgetItems } from "@/server/modules/campaign/campaign.service";
import { BudgetItemSchema } from "@/shared/schemas/campaign";

export const GET = createApiHandler({
  permission: "campaign:read",
  handler: async (ctx) =>
    listBudgetItems({ orgId: ctx.auth.orgId, userId: ctx.auth.userId }, ctx.params.id!),
});

export const POST = createApiHandler({
  permission: "campaign:write",
  body: BudgetItemSchema,
  audit: "campaign.budget_create",
  created: true,
  handler: async (ctx) => {
    await createBudgetItem(
      { orgId: ctx.auth.orgId, userId: ctx.auth.userId },
      ctx.params.id!,
      ctx.body,
    );
    ctx.setAuditEntity("campaign", ctx.params.id!);
    return { created: true };
  },
});
