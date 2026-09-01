import { z } from "zod";

export const CheckpointDecisionSchema = z.object({
  decision: z.enum(["approved", "rejected", "changes_requested"]),
  reason: z.string().max(1000).nullish(),
  override: z
    .object({
      enabled: z.literal(true),
      category: z.enum(["false_positive", "evidence_verified", "brand_authorized", "other"]),
      acknowledged_finding_ids: z.array(z.string().min(1)).min(1),
    })
    .optional(),
});
export type CheckpointDecisionInput = z.infer<typeof CheckpointDecisionSchema>;

export interface CheckpointDto {
  id: string;
  type: string;
  status: string;
  title: string;
  summary: string | null;
  entity_type: string | null;
  entity_id: string | null;
  workflow_run_id: string | null;
  payload: Record<string, unknown>;
  priority: string;
  assignee_role: string | null;
  decided_by_name: string | null;
  decided_at: string | null;
  decision_reason: string | null;
  decision_metadata: Record<string, unknown>;
  created_at: string;
}

export const CHECKPOINT_TYPE_LABELS: Record<string, string> = {
  strategy: "策略审批",
  shortlist: "达人入围",
  brief: "Brief 审批",
  outreach_send: "外联发送",
  negotiation_terms: "谈判条款",
  content: "内容审核",
  contract: "合同审批",
  payment: "付款审批",
  report: "报告审批",
  budget: "预算审批",
};
