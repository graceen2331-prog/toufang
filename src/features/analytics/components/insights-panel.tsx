"use client";

import { AlertTriangle, Lightbulb, ShieldAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { InsightDto } from "@/shared/schemas/content-analytics";

const iconByKind = {
  anomaly: AlertTriangle,
  opportunity: Lightbulb,
  risk: ShieldAlert,
  summary: Lightbulb,
} as const;

const SEVERITY_LABELS: Record<string, string> = {
  info: "提示",
  warning: "关注",
  critical: "严重",
};

export function InsightsPanel({
  insights,
  notes,
}: {
  insights: InsightDto[];
  notes: string[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">AI 洞察</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {notes.length > 0 && (
          <div className="rounded-lg bg-muted p-3">
            <p className="text-xs font-medium text-muted-foreground">数据质量提示</p>
            <ul className="mt-2 space-y-1 text-sm">
              {notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </div>
        )}
        {insights.length === 0 ? (
          <p className="text-sm text-muted-foreground">暂无打开状态的洞察。</p>
        ) : (
          insights.map((insight) => {
            const Icon = iconByKind[insight.kind as keyof typeof iconByKind] ?? Lightbulb;
            return (
              <div key={insight.id} className="rounded-lg border p-3">
                <div className="flex items-start gap-3">
                  <Icon className="mt-0.5 size-4 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium">{insight.title}</p>
                      <Badge variant={insight.severity === "critical" ? "destructive" : "secondary"}>
                        {SEVERITY_LABELS[insight.severity] ?? "提示"}
                      </Badge>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                      {insight.content}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
