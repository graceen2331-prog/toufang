import { createApiHandler } from "@/server/api/handler";
import {
  createCampaignTask,
  listCampaignTasks,
} from "@/server/modules/campaign/campaign.service";
import { CampaignTaskSchema } from "@/shared/schemas/campaign";

export const GET = createApiHandler({
  permission: "campaign:read",
  handler: async (ctx) =>
    listCampaignTasks({ orgId: ctx.auth.orgId, userId: ctx.auth.userId }, ctx.params.id!),
});

export const POST = createApiHandler({
  permission: "campaign:write",
  body: CampaignTaskSchema,
  audit: "campaign.task_create",
  created: true,
  handler: async (ctx) => {
    await createCampaignTask(
      { orgId: ctx.auth.orgId, userId: ctx.auth.userId },
      ctx.params.id!,
      ctx.body,
    );
    ctx.setAuditEntity("campaign", ctx.params.id!);
    return { created: true };
  },
});
