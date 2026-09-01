"use client";

import { useState } from "react";
import { Download, Save, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { StatusTag } from "@/components/shared/status-tag";
import { PermissionGate } from "@/components/shared/permission-gate";
import { REPORT_STATUS } from "@/shared/constants/status";
import type { ReportDto } from "@/shared/schemas/content-analytics";
import {
  useDeriveReportDraft,
  useExportReport,
  useTransitionReport,
  useUpdateReport,
} from "@/features/analytics/queries";

function textArray(value: unknown): string {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string").join("\n") : "";
}

function splitLines(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function ReportEditor({
  report,
  onSelectReport,
}: {
  report: ReportDto | null;
  onSelectReport?: (id: string) => void;
}) {
  if (!report) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>报告详情</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          选择一份报告后查看正文与审批操作。
        </CardContent>
      </Card>
    );
  }

  return <ReportEditorForm key={report.id} report={report} onSelectReport={onSelectReport} />;
}

function ReportEditorForm({
  report,
  onSelectReport,
}: {
  report: ReportDto;
  onSelectReport?: (id: string) => void;
}) {
  const update = useUpdateReport();
  const transition = useTransitionReport();
  const exportReport = useExportReport();
  const derive = useDeriveReportDraft();
  const [title, setTitle] = useState(report.title);
  const [summary, setSummary] = useState(String(report.content.executive_summary ?? ""));
  const [narrative, setNarrative] = useState(String(report.content.narrative ?? ""));
  const [learnings, setLearnings] = useState(textArray(report.content.key_learnings));
  const [recommendations, setRecommendations] = useState(textArray(report.content.recommendations));
  const [recipient, setRecipient] = useState("内部存档");
  const [derivationReason, setDerivationReason] = useState("基于正式版本修订");
  const isEditable = report.status === "draft";
  const isFormal = report.status === "approved" || report.status === "exported";

  const content = {
    ...report.content,
    executive_summary: summary,
    narrative,
    key_learnings: splitLines(learnings),
    recommendations: splitLines(recommendations),
  };

  return (
    <Card>
      <CardHeader className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-lg">报告详情 · V{report.version}</CardTitle>
          <StatusTag source={REPORT_STATUS} value={report.status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isEditable && (
          <div className="border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-foreground">
            {report.status === "in_review"
              ? "报告正在审批，审批退回草稿后才能继续编辑。"
              : "这是已冻结的正式报告。如需调整，请基于此版本创建修订草稿并重新审批。"}
          </div>
        )}
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="report-title">
            标题
          </label>
          <Input
            id="report-title"
            value={title}
            disabled={!isEditable}
            onChange={(event) => setTitle(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="report-summary">
            高管摘要
          </label>
          <Textarea
            id="report-summary"
            value={summary}
            disabled={!isEditable}
            onChange={(event) => setSummary(event.target.value)}
            rows={4}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="report-narrative">
            分析叙事
          </label>
          <Textarea
            id="report-narrative"
            value={narrative}
            disabled={!isEditable}
            onChange={(event) => setNarrative(event.target.value)}
            rows={7}
          />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="report-learnings">
              关键学习
            </label>
            <Textarea
              id="report-learnings"
              value={learnings}
              disabled={!isEditable}
              onChange={(event) => setLearnings(event.target.value)}
              rows={5}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="report-recommendations">
              下一步建议
            </label>
            <Textarea
              id="report-recommendations"
              value={recommendations}
              disabled={!isEditable}
              onChange={(event) => setRecommendations(event.target.value)}
              rows={5}
            />
          </div>
        </div>

        {isEditable && (
          <PermissionGate permission="report:write">
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                disabled={update.isPending}
                onClick={() =>
                  update.mutate({
                    id: report.id,
                    title,
                    content,
                    expected_lock_version: report.lock_version,
                  })
                }
              >
                <Save className="size-4" />
                保存
              </Button>
              {report.status === "draft" && (
                <Button
                  disabled={transition.isPending}
                  onClick={() =>
                    transition.mutate({
                      id: report.id,
                      to: "in_review",
                      expected_lock_version: report.lock_version,
                    })
                  }
                >
                  <Send className="size-4" />
                  提交审批
                </Button>
              )}
            </div>
          </PermissionGate>
        )}
        {isFormal && (
          <div className="space-y-3 border-t pt-4">
            <p className="text-sm font-medium">正式版本操作</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="report-recipient">
                  快照接收方 / 用途
                </label>
                <Input
                  id="report-recipient"
                  value={recipient}
                  onChange={(event) => setRecipient(event.target.value)}
                />
                <PermissionGate permission="report:export">
                  <Button
                    variant="outline"
                    disabled={exportReport.isPending || !recipient.trim()}
                    onClick={() =>
                      exportReport.mutate({ id: report.id, recipient: recipient.trim() })
                    }
                  >
                    <Download className="size-4" />
                    创建 JSON 导出快照
                  </Button>
                </PermissionGate>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="report-derivation-reason">
                  修订原因
                </label>
                <Input
                  id="report-derivation-reason"
                  value={derivationReason}
                  onChange={(event) => setDerivationReason(event.target.value)}
                />
                <PermissionGate permission="report:write">
                  <Button
                    variant="outline"
                    disabled={derive.isPending || !derivationReason.trim()}
                    onClick={() =>
                      derive.mutate(
                        { id: report.id, reason: derivationReason.trim() },
                        { onSuccess: (draft) => onSelectReport?.(draft.id) },
                      )
                    }
                  >
                    <Save className="size-4" />
                    基于此版本创建修订草稿
                  </Button>
                </PermissionGate>
              </div>
            </div>

            {report.approved_snapshot_hash && (
              <p className="break-all font-mono text-xs text-muted-foreground">
                SHA-256：{report.approved_snapshot_hash}
              </p>
            )}
            {report.exports.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">导出快照记录</p>
                {report.exports.map((item) => (
                  <div key={item.id} className="border px-3 py-2 text-xs text-muted-foreground">
                    V{item.report_version} · {item.recipient} · {item.created_at.slice(0, 19).replace("T", " ")}
                    <span className="ml-2 font-mono">{item.snapshot_hash.slice(0, 12)}…</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
