import type { StatusMeta } from "@/shared/constants/status";

export const THREAD_STATUS: Record<string, StatusMeta> = {
  open: { label: "进行中", tone: "info" },
  replied: { label: "已回复", tone: "progress" },
  negotiating: { label: "谈判中", tone: "progress" },
  closed_won: { label: "达成合作", tone: "success" },
  closed_lost: { label: "未达成", tone: "danger" },
  no_response: { label: "无回应", tone: "warning" },
};

export const DIRECTION_LABELS: Record<string, string> = {
  outbound: "外发",
  inbound: "达人回复",
};

export const CONTACTABLE_STATUSES = new Set([
  "approved",
  "contacted",
  "replied",
  "negotiating",
  "confirmed",
  "contracting",
  "active",
]);
