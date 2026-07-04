"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PermissionGate } from "@/components/shared/permission-gate";
import { WorkflowProgress } from "@/components/shared/workflow-progress";
import {
  useStartCampaignWorkflow,
  useStrategyVersions,
  workflowKeys,
} from "@/features/workflows/queries";
import type { StrategyVersionDto } from "@/shared/schemas/workflow";

/** 策略内容结构（与策略生成工作流输出约定一致） */
interface StrategyContent {
  summary: string;
  objectives: string[];
  platform_plan: Array<{
    platform: string;
    budget_ratio: number;
    content_focus: string;
  }>;
  creator_mix: Array<{
    tier: string;
    count: number;
    budget_ratio: number;
    role: string;
  }>;
  timeline: Array<{
    phase: string;
    start_offset_days: number;
    duration_days: number;
    focus: string;
  }>;
  kpi_suggestions: Record<string, number>;
  risks: Array<{ risk: string; mitigation: string }>;
}

const STRATEGY_STATUS_LABELS: Record<string, string> = {
  draft: "草稿",
  in_review: "审批中",
  approved: "已批准",
  rejected: "已驳回",
  locked: "已锁定",
};

function ratioPercent(ratio: number): string {
  return `${(ratio * 100).toFixed(0)}%`;
}

export function StrategyTab({ campaignId }: { campaignId: string }) {
  const queryClient = useQueryClient();
  const { data: versions, isLoading } = useStrategyVersions(campaignId);
  const start = useStartCampaignWorkflow();
  const [activeRunId, setActiveRunId] = useState<string | null>(null);

  const handleGenerate = () => {
    start.mutate(
      { campaignId, key: "strategy" },
      { onSuccess: (res) => setActiveRunId(res.workflow_run_id) },
    );
  };

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">加载中…</p>;
  }

  const list = versions ?? [];
  const latest = list[0] ?? null;
  const history = list.slice(1);

  // 空态：既无版本也没有进行中的运行
  if (!latest && !activeRunId) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-card py-16 text-center">
        <Sparkles className="size-8 text-muted-foreground/50" />
        <p className="mt-3 font-medium">还没有 AI 策略</p>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          基于 Campaign 目标、预算与平台组合，让 AI 生成投放策略草案。
        </p>
        <PermissionGate permission="ai:run">
          <Button className="mt-4" disabled={start.isPending} onClick={handleGenerate}>
            <Sparkles className="size-4" />
            {start.isPending ? "启动中…" : "AI 生成策略"}
          </Button>
        </PermissionGate>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <PermissionGate permission="ai:run">
          <Button variant="outline" disabled={start.isPending} onClick={handleGenerate}>
            <Sparkles className="size-4" />
            {start.isPending ? "启动中…" : latest ? "重新生成" : "AI 生成策略"}
          </Button>
        </PermissionGate>
      </div>

      {activeRunId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">生成进度</CardTitle>
          </CardHeader>
          <CardContent>
            <WorkflowProgress
              runId={activeRunId}
              onFinished={() => {
                void queryClient.invalidateQueries({
                  queryKey: workflowKeys.strategyVersions(campaignId),
                });
              }}
            />
          </CardContent>
        </Card>
      )}

      {latest && <StrategyVersionCard version={latest} />}

      {history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">历史版本</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y text-sm">
              {history.map((v) => (
                <li key={v.id} className="flex items-center gap-3 py-2">
                  <span className="font-medium tabular-nums">v{v.version}</span>
                  <Badge variant="secondary">
                    {STRATEGY_STATUS_LABELS[v.status] ?? v.status}
                  </Badge>
                  <span className="text-muted-foreground">
                    {format(new Date(v.created_at), "yyyy-MM-dd HH:mm")}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------
// 最新版本完整渲染
// ---------------------------------------------------------------

function StrategyVersionCard({ version }: { version: StrategyVersionDto }) {
  const content = version.content as unknown as StrategyContent;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          策略 v{version.version}
          <Badge variant="secondary">
            {STRATEGY_STATUS_LABELS[version.status] ?? version.status}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {content.summary && <p className="text-sm leading-relaxed">{content.summary}</p>}

        {content.objectives?.length > 0 && (
          <section>
            <h3 className="mb-2 text-sm font-medium">策略目标</h3>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {content.objectives.map((obj, i) => (
                <li key={i}>{obj}</li>
              ))}
            </ul>
          </section>
        )}

        {content.platform_plan?.length > 0 && (
          <section>
            <h3 className="mb-2 text-sm font-medium">平台规划</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>平台</TableHead>
                  <TableHead className="text-right">预算占比</TableHead>
                  <TableHead>内容重点</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {content.platform_plan.map((plan, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{plan.platform}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {ratioPercent(plan.budget_ratio)}
                    </TableCell>
                    <TableCell>{plan.content_focus}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </section>
        )}

        {content.creator_mix?.length > 0 && (
          <section>
            <h3 className="mb-2 text-sm font-medium">达人组合</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>层级</TableHead>
                  <TableHead className="text-right">人数</TableHead>
                  <TableHead className="text-right">预算占比</TableHead>
                  <TableHead>角色</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {content.creator_mix.map((mix, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{mix.tier}</TableCell>
                    <TableCell className="text-right tabular-nums">{mix.count}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {ratioPercent(mix.budget_ratio)}
                    </TableCell>
                    <TableCell>{mix.role}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </section>
        )}

        {content.timeline?.length > 0 && (
          <section>
            <h3 className="mb-2 text-sm font-medium">时间线</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>阶段</TableHead>
                  <TableHead className="text-right">开始（第 N 天）</TableHead>
                  <TableHead className="text-right">持续（天）</TableHead>
                  <TableHead>重点</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {content.timeline.map((phase, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{phase.phase}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {phase.start_offset_days}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {phase.duration_days}
                    </TableCell>
                    <TableCell>{phase.focus}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </section>
        )}

        {content.kpi_suggestions && Object.keys(content.kpi_suggestions).length > 0 && (
          <section>
            <h3 className="mb-2 text-sm font-medium">KPI 建议</h3>
            <div className="flex flex-wrap gap-2">
              {Object.entries(content.kpi_suggestions).map(([key, value]) => (
                <Badge key={key} variant="outline" className="tabular-nums">
                  {key}：{value.toLocaleString("zh-CN")}
                </Badge>
              ))}
            </div>
          </section>
        )}

        {content.risks?.length > 0 && (
          <section>
            <h3 className="mb-2 text-sm font-medium">风险与缓解</h3>
            <ul className="space-y-2 text-sm">
              {content.risks.map((item, i) => (
                <li key={i} className="rounded-md border p-3">
                  <p className="font-medium text-destructive">风险：{item.risk}</p>
                  <p className="mt-1 text-muted-foreground">缓解：{item.mitigation}</p>
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="border-t pt-3 text-xs text-muted-foreground">
          模型 {version.model ?? "—"} · Prompt {version.prompt_key ?? "—"}@
          {version.prompt_version ?? "—"} ·{" "}
          {format(new Date(version.created_at), "yyyy-MM-dd HH:mm")}
        </p>
      </CardContent>
    </Card>
  );
}
