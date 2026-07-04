import { createApiHandler } from "@/server/api/handler";
import {
  deleteCampaignTask,
  updateCampaignTask,
} from "@/server/modules/campaign/campaign.service";
import { CampaignTaskUpdateSchema } from "@/shared/schemas/campaign";

export const PATCH = createApiHandler({
  permission: "campaign:write",
  body: CampaignTaskUpdateSchema,
  audit: "campaign.task_update",
  handler: async (ctx) => {
    await updateCampaignTask(
      { orgId: ctx.auth.orgId, userId: ctx.auth.userId },
      ctx.params.taskId!,
      ctx.body,
    );
    return { updated: true };
  },
});

export const DELETE = createApiHandler({
  permission: "campaign:write",
  audit: "campaign.task_delete",
  handler: async (ctx) => {
    await deleteCampaignTask(
      { orgId: ctx.auth.orgId, userId: ctx.auth.userId },
      ctx.params.taskId!,
    );
    return { deleted: true };
  },
});
