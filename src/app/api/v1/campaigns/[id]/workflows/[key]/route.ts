import { createApiHandler } from "@/server/api/handler";
import { ApiError } from "@/server/api/envelope";
import { startWorkflow } from "@/server/workflows/engine";
import { prisma } from "@/server/db/client";
import type { StartWorkflowResponseDto } from "@/shared/schemas/workflow";

// 当前支持从 Campaign 触发的工作流
const CAMPAIGN_WORKFLOWS = new Set(["strategy"]);

export const POST = createApiHandler({
  permission: "ai:run",
  audit: "workflow.start",
  created: true,
  handler: async (ctx) => {
    const campaignId = ctx.params.id!;
    const key = ctx.params.key!;
    if (!CAMPAIGN_WORKFLOWS.has(key)) {
      throw new ApiError("VALIDATION_FAILED", `不支持的工作流类型：${key}`);
    }
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, tenantId: ctx.auth.orgId, deletedAt: null },
      select: { id: true },
    });
    if (!campaign) throw new ApiError("RESOURCE_NOT_FOUND", "Campaign 不存在");

    // 防重：同一 Campaign 同类工作流进行中时不允许重复启动
    const running = await prisma.workflowRun.findFirst({
      where: {
        tenantId: ctx.auth.orgId,
        workflowKey: key,
        subjectType: "campaign",
        subjectId: campaignId,
        status: { in: ["queued", "running", "waiting_for_human", "retrying"] },
      },
      select: { id: true },
    });
    if (running) {
      throw new ApiError("CONFLICT", "该 Campaign 已有同类工作流进行中", {
        workflow_run_id: running.id,
      });
    }

    const run = await startWorkflow(
      { orgId: ctx.auth.orgId, userId: ctx.auth.userId },
      { key, subjectType: "campaign", subjectId: campaignId },
    );
    ctx.setAuditEntity("workflow_run", run.id, { key, campaign_id: campaignId });
    const response: StartWorkflowResponseDto = {
      workflow_run_id: run.id,
      poll_url: `/api/v1/workflow-runs/${run.id}`,
      events_url: `/api/v1/workflow-runs/${run.id}/events`,
    };
    return response;
  },
});
