import { createApiHandler } from "@/server/api/handler";
import { transferCheckpoint } from "@/server/modules/checkpoint/checkpoint.service";
import { CheckpointTransferSchema } from "@/shared/schemas/checkpoint";

export const POST = createApiHandler({
  permission: "approval:assign",
  body: CheckpointTransferSchema,
  audit: "approval.transfer",
  handler: async (ctx) => {
    const checkpoint = await transferCheckpoint(
      { orgId: ctx.auth.orgId, userId: ctx.auth.userId },
      ctx.params.id!,
      ctx.body.to_user_id,
      ctx.body.reason,
      ctx.body.expected_version,
    );
    ctx.setAuditEntity("human_checkpoint", checkpoint.id, { to_user_id: ctx.body.to_user_id });
    return checkpoint;
  },
});
