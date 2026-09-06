import "server-only";
import { ApiError } from "@/server/api/envelope";
import { getWorkflowStepQueue } from "@/server/jobs/queues";
import type { TenantCtx } from "@/server/modules/brand/brand.repository";
import { workflowRepository } from "@/server/modules/workflow/workflow.repository";
import type { WorkflowExecutionHealthDto } from "@/shared/schemas/workflow";

const QUEUE_DELAY_WARNING_MS = 60_000;

/** 只返回当前运行所需的最小健康信息，不向普通运行权限暴露全局队列指标。 */
export async function getWorkflowExecutionHealth(
  ctx: TenantCtx,
  runId: string,
): Promise<WorkflowExecutionHealthDto> {
  const run = await workflowRepository.findRunStatus(ctx, runId);
  if (!run) throw new ApiError("RESOURCE_NOT_FOUND", "工作流不存在");

  const checkedAt = new Date();
  if (!["queued", "retrying", "running"].includes(run.status)) {
    return { status: "not_applicable", checked_at: checkedAt.toISOString(), message: null };
  }

  try {
    const workers = await getWorkflowStepQueue().getWorkersCount();
    if (workers === 0) {
      return {
        status: "offline",
        checked_at: checkedAt.toISOString(),
        message: "执行服务暂不可用，任务会保留在队列中；恢复后将自动继续。",
      };
    }

    const queuedForMs = checkedAt.getTime() - run.createdAt.getTime();
    if (["queued", "retrying"].includes(run.status) && queuedForMs >= QUEUE_DELAY_WARNING_MS) {
      return {
        status: "degraded",
        checked_at: checkedAt.toISOString(),
        message: "任务排队时间较长，执行服务仍在线，请稍后刷新。",
      };
    }
    return { status: "healthy", checked_at: checkedAt.toISOString(), message: null };
  } catch {
    return {
      status: "unavailable",
      checked_at: checkedAt.toISOString(),
      message: "暂时无法读取执行服务状态，工作流记录不受影响。",
    };
  }
}
