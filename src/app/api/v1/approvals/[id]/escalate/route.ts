import { createApiHandler } from "@/server/api/handler";
import { escalateCheckpoint } from "@/server/modules/checkpoint/checkpoint.service";
import { CheckpointEscalateSchema } from "@/shared/schemas/checkpoint";

export const POST = createApiHandler({
  permission: "approval:escalate",
  body: CheckpointEscalateSchema,
  audit: "approval.escalate",
  handler: async (ctx) => {
    const checkpoint = await escalateCheckpoint(
      { orgId: ctx.auth.orgId, userId: ctx.auth.userId },
      ctx.params.id!,
      ctx.body.reason,
      ctx.body.target_user_id,
      ctx.body.expected_version,
    );
    ctx.setAuditEntity("human_checkpoint", checkpoint.id, { target_user_id: ctx.body.target_user_id ?? null });
    return checkpoint;
  },
});
