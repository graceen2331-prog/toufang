import { createApiHandler } from "@/server/api/handler";
import { transitionContractStatus } from "@/server/modules/contract/contract.service";
import { ContractStatusChangeSchema } from "@/shared/schemas/outreach";

export const POST = createApiHandler({
  permission: "contract:write",
  body: ContractStatusChangeSchema,
  audit: "contract.status_change",
  handler: async (ctx) => {
    const contract = await transitionContractStatus(
      { orgId: ctx.auth.orgId, userId: ctx.auth.userId },
      ctx.params.id!,
      ctx.body.to,
      ctx.body.reason,
    );
    ctx.setAuditEntity("contract", contract.id, { to: ctx.body.to });
    return contract;
  },
});
