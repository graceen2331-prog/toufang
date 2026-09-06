import { z } from "zod";

export const NotificationMarkReadSchema = z.object({
  ids: z.array(z.string()).optional(),
  all: z.boolean().optional(),
});
export type NotificationMarkReadInput = z.infer<typeof NotificationMarkReadSchema>;

export interface NotificationDto {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link_url: string | null;
  priority: string;
  read_at: string | null;
  created_at: string;
}

export const NOTIFICATION_TYPE_LABELS: Record<string, string> = {
  approval_pending: "待审批",
  workflow_completed: "工作流完成",
  workflow_failed: "工作流失败",
  risk_alert: "风险提醒",
  mention: "提及",
  system: "系统通知",
};
