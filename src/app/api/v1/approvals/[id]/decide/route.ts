import { createApiHandler } from "@/server/api/handler";
import { decideCheckpoint } from "@/server/modules/checkpoint/checkpoint.service";
import { CheckpointDecisionSchema } from "@/shared/schemas/checkpoint";
import { roleHasPermission } from "@/shared/constants/permissions";

export const POST = createApiHandler({
  permission: "approval:decide",
  body: CheckpointDecisionSchema,
  audit: "approval.decide",
  handler: async (ctx) => {
    const checkpoint = await decideCheckpoint(
      { orgId: ctx.auth.orgId, userId: ctx.auth.userId },
      ctx.params.id!,
      ctx.body.decision,
      ctx.body.reason,
      ctx.body.override,
      ctx.body.payment_confirmation,
      roleHasPermission(ctx.auth.permissions, "payment:approve"),
    );
    ctx.setAuditEntity("human_checkpoint", checkpoint.id, {
      decision: ctx.body.decision,
      type: checkpoint.type,
    });
    return checkpoint;
  },
});
