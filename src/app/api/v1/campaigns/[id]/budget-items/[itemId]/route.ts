import { createApiHandler } from "@/server/api/handler";
import { deleteBudgetItem, updateBudgetItem } from "@/server/modules/campaign/campaign.service";
import { BudgetItemSchema } from "@/shared/schemas/campaign";

export const PATCH = createApiHandler({
  permission: "campaign:write",
  body: BudgetItemSchema.partial(),
  audit: "campaign.budget_update",
  handler: async (ctx) => {
    await updateBudgetItem(
      { orgId: ctx.auth.orgId, userId: ctx.auth.userId },
      ctx.params.itemId!,
      ctx.body,
    );
    return { updated: true };
  },
});

export const DELETE = createApiHandler({
  permission: "campaign:write",
  audit: "campaign.budget_delete",
  handler: async (ctx) => {
    await deleteBudgetItem(
      { orgId: ctx.auth.orgId, userId: ctx.auth.userId },
      ctx.params.itemId!,
    );
    return { deleted: true };
  },
});
