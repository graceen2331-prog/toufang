"use client";

import { FileText } from "lucide-react";
import { formatCents } from "@/lib/format";
import type { CheckpointDto } from "@/shared/schemas/checkpoint";

interface PayloadRow {
  label: string;
  value: string;
  tone?: "default" | "muted" | "money";
}

const KEY_LABELS: Record<string, string> = {
  amount_cents: "金额",
  approved: "已批准",
  body: "正文",
  candidates: "候选数量",
  contract_id: "合同 ID",
  contract_number: "合同编号",
  content: "报告内容",
  from_cents: "原预算",
  reason: "原因",
  report_id: "报告 ID",
  subject: "主题",
  thread_id: "会话 ID",
  title: "标题",
  to_cents: "调整后",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nestedRecord(payload: Record<string, unknown>, key: string): Record<string, unknown> | null {
  const value = payload[key];
  return isRecord(value) ? value : null;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function countValue(value: unknown): number | null {
  return Array.isArray(value) ? value.length : null;
}

function compactPrimitive(value: unknown): string {
  if (value === null || value === undefined) return "未填写";
  if (typeof value === "string") return value;
  if (typeof value === "number") return value.toLocaleString("zh-CN");
  if (typeof value === "boolean") return value ? "是" : "否";
  if (Array.isArray(value)) return `${value.length} 项`;
  if (isRecord(value)) return `包含 ${Object.keys(value).length} 个字段`;
  return String(value);
}

function row(label: string, value: string | number | null | undefined, tone?: PayloadRow["tone"]): PayloadRow | null {
  if (value === null || value === undefined || value === "") return null;
  return { label, value: typeof value === "number" ? value.toLocaleString("zh-CN") : value, tone };
}

function centsRow(label: string, value: unknown): PayloadRow | null {
  const cents = numberValue(value);
  return cents === null ? null : { label, value: formatCents(cents), tone: "money" };
}

function buildRows(checkpoint: CheckpointDto): PayloadRow[] {
  const payload = checkpoint.payload;
  const rows: Array<PayloadRow | null> = [];

  if (checkpoint.type === "payment") {
    rows.push(centsRow("付款金额", payload.amount_cents));
  } else if (checkpoint.type === "contract") {
    rows.push(row("合同编号", stringValue(payload.contract_number)), centsRow("合同金额", payload.amount_cents));
  } else if (checkpoint.type === "budget") {
    rows.push(centsRow("原预算", payload.from_cents), centsRow("调整后", payload.to_cents), row("调整原因", stringValue(payload.reason)));
  } else if (checkpoint.type === "outreach_send") {
    rows.push(row("消息主题", stringValue(payload.subject)), row("发送内容", stringValue(payload.body)));
  } else if (checkpoint.type === "content") {
    const review = nestedRecord(payload, "review");
    rows.push(
      row("AI 判断", stringValue(review?.decision)),
      row("风险等级", stringValue(review?.risk_level)),
      row("问题数量", countValue(review?.findings)),
      row("给达人的修改说明", stringValue(review?.creator_feedback)),
    );
  } else if (checkpoint.type === "report") {
    const report = nestedRecord(payload, "report");
    const content = nestedRecord(payload, "content");
    rows.push(
      row("报告标题", stringValue(payload.title) ?? stringValue(report?.title)),
      row("高管摘要", stringValue(report?.executive_summary) ?? stringValue(content?.executive_summary)),
      row("建议数量", countValue(report?.recommendations) ?? countValue(content?.recommendations)),
    );
  } else if (checkpoint.type === "brief") {
    const brief = nestedRecord(payload, "brief");
    rows.push(
      row("Brief 标题", stringValue(brief?.title)),
      row("背景", stringValue(brief?.background)),
      row("交付要求", countValue(brief?.deliverables)),
    );
  } else if (checkpoint.type === "strategy") {
    const strategy = nestedRecord(payload, "strategy");
    rows.push(
      row("策略摘要", stringValue(strategy?.summary)),
      row("内容支柱", countValue(strategy?.content_pillars)),
      row("达人画像", countValue(strategy?.creator_personas)),
    );
  } else if (checkpoint.type === "shortlist") {
    rows.push(
      row("候选达人", countValue(payload.matches) ?? countValue(payload.scores) ?? numberValue(payload.candidates)),
      row("建议入围", numberValue(payload.approved)),
    );
  }

  const typedRows = rows.filter((item): item is PayloadRow => Boolean(item));
  if (typedRows.length > 0) return typedRows.slice(0, 5);

  const visibleEntries = Object.entries(payload).filter(([key]) => !key.endsWith("_id") && key !== "id");
  return visibleEntries
    .slice(0, 6)
    .map(([key, value]) => ({
      label: KEY_LABELS[key] ?? key.replaceAll("_", " "),
      value: compactPrimitive(value),
      tone: key.endsWith("_id") ? "muted" : "default",
    }));
}

export function ApprovalPayloadSummary({ checkpoint }: { checkpoint: CheckpointDto }) {
  const rows = buildRows(checkpoint);
  if (rows.length === 0) return null;

  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <FileText className="size-3.5" />
        审批要点
      </div>
      <dl className={rows.length === 1 ? "grid gap-2" : "grid gap-2 sm:grid-cols-2"}>
        {rows.map((item) => (
          <div key={`${item.label}-${item.value}`} className="rounded-md bg-card px-3 py-2 ring-1 ring-foreground/6">
            <dt className="text-xs text-muted-foreground">{item.label}</dt>
            <dd
              className={
                item.tone === "money"
                  ? "mt-1 text-sm font-semibold tabular-nums text-primary"
                  : item.tone === "muted"
                    ? "mt-1 break-all font-mono text-xs text-muted-foreground"
                    : "mt-1 line-clamp-3 text-sm leading-5"
              }
            >
              {item.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
