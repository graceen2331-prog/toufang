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

export function ReportEditor({ report }: { report: ReportDto | null }) {
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

  return <ReportEditorForm key={report.id} report={report} />;
}

function ReportEditorForm({ report }: { report: ReportDto }) {
  const update = useUpdateReport();
  const transition = useTransitionReport();
  const exportReport = useExportReport();
  const [title, setTitle] = useState(report.title);
  const [summary, setSummary] = useState(String(report.content.executive_summary ?? ""));
  const [narrative, setNarrative] = useState(String(report.content.narrative ?? ""));
  const [learnings, setLearnings] = useState(textArray(report.content.key_learnings));
  const [recommendations, setRecommendations] = useState(textArray(report.content.recommendations));
  const isEditable = report.status === "draft";

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
          <CardTitle className="text-lg">报告详情</CardTitle>
          <StatusTag source={REPORT_STATUS} value={report.status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isEditable && (
          <div className="border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-foreground">
            {report.status === "in_review"
              ? "报告正在审批，审批退回草稿后才能继续编辑。"
              : "这是已冻结的正式报告。如需调整，请重新生成报告并完成审批。"}
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
                onClick={() => update.mutate({ id: report.id, title, content })}
              >
                <Save className="size-4" />
                保存
              </Button>
              {report.status === "draft" && (
                <Button
                  disabled={transition.isPending}
                  onClick={() => transition.mutate({ id: report.id, to: "in_review" })}
                >
                  <Send className="size-4" />
                  提交审批
                </Button>
              )}
            </div>
          </PermissionGate>
        )}
        <PermissionGate permission="report:export">
          {report.status === "approved" && (
            <Button
              variant="outline"
              disabled={exportReport.isPending}
              onClick={() => exportReport.mutate(report.id)}
            >
              <Download className="size-4" />
              导出
            </Button>
          )}
        </PermissionGate>
      </CardContent>
    </Card>
  );
}
