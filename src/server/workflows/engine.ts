import "server-only";
import type { TenantCtx } from "@/server/modules/brand/brand.repository";

/**
 * 工作流引擎（W4 实现）。
 * 当前为占位：审批中心在 W3 已接入 onCheckpointDecided 钩子。
 */
export async function onCheckpointDecided(
  _ctx: TenantCtx,
  _workflowRunId: string,
  _checkpointId: string,
  _decision: "approved" | "rejected" | "changes_requested",
): Promise<void> {
  // W4：根据决策恢复（approve → advance）或终止（reject → fail/rollback）工作流
}
