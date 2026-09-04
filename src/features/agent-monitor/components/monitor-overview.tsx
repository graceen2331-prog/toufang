"use client";

import ReactECharts from "echarts-for-react";
import { Activity, CircleDollarSign, Clock3, TriangleAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AgentMonitorSummaryDto } from "@/shared/schemas/agent-monitor";
import { formatCost } from "@/shared/schemas/workflow";
import { formatCompactNumber, formatDuration, formatPercent } from "../format";

export function MonitorOverview({ summary }: { summary: AgentMonitorSummaryDto }) {
  const option = {
    animationDuration: 300,
    tooltip: { trigger: "axis" },
    color: ["#0b7a58", "#c3453f"],
    grid: { left: 34, right: 18, top: 18, bottom: 28 },
    xAxis: {
      type: "category",
      boundaryGap: false,
      data: summary.trend.map((point) =>
        new Date(point.bucket).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
      ),
      axisLabel: { interval: 5, color: "#737373", fontSize: 10 },
      axisLine: { lineStyle: { color: "#e5e7eb" } },
    },
    yAxis: {
      type: "value",
      minInterval: 1,
      axisLabel: { color: "#737373", fontSize: 10 },
      splitLine: { lineStyle: { color: "#eef0ef" } },
    },
    series: [
      {
        name: "运行数",
        type: "line",
        smooth: true,
        symbol: "none",
        areaStyle: { opacity: 0.1 },
        data: summary.trend.map((point) => point.total),
      },
      {
        name: "失败数",
        type: "line",
        smooth: true,
        symbol: "none",
        data: summary.trend.map((point) => point.failed),
      },
    ],
  };

  return (
    <section aria-label="运行健康总览" className="grid gap-4 lg:grid-cols-[minmax(0,1.65fr)_minmax(19rem,0.75fr)]">
      <Card className="py-0">
        <CardHeader className="flex flex-row items-start justify-between gap-4 border-b px-5 py-4">
          <div>
            <CardTitle className="text-base">最近 24 小时运行趋势</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">所有工作流与同步 Agent 运行</p>
          </div>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Activity className="size-3.5 text-primary" />5 秒刷新
          </span>
        </CardHeader>
        <CardContent className="px-3 pb-2 pt-3">
          <ReactECharts option={option} style={{ height: 220 }} />
        </CardContent>
      </Card>

      <Card className="overflow-hidden py-0">
        <CardContent className="p-0">
          <div className="border-b bg-primary/[0.06] px-5 pb-5 pt-4">
            <p className="text-xs font-medium tracking-wide text-muted-foreground">运行健康</p>
            <div className="mt-2 flex items-end justify-between gap-4">
              <div>
                <p className="text-4xl font-semibold tracking-tight tabular-nums">
                  {formatPercent(summary.success_rate)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">24 小时成功率</p>
              </div>
              <div className="text-right text-xs text-muted-foreground">
                <p><span className="font-medium text-foreground">{summary.active_runs}</span> 个运行中</p>
                <p className="mt-1"><span className="font-medium text-destructive">{summary.failed_runs}</span> 个失败</p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 divide-x divide-y">
            <HealthMetric icon={Activity} label="24 小时调用" value={summary.total_calls.toLocaleString("zh-CN")} />
            <HealthMetric icon={TriangleAlert} label="失败率" value={formatPercent(summary.failure_rate)} danger={summary.failure_rate > 0} />
            <HealthMetric icon={Clock3} label="P95 时延" value={formatDuration(summary.p95_latency_ms)} />
            <HealthMetric icon={TriangleAlert} label="疑似卡死" value={`${summary.stuck_runs}`} danger={summary.stuck_runs > 0} />
            <HealthMetric icon={CircleDollarSign} label="今日成本" value={formatCost(summary.today_cost_microcents)} />
            <HealthMetric
              icon={Activity}
              label="今日 Token"
              value={formatCompactNumber(summary.today_input_tokens + summary.today_output_tokens)}
            />
          </div>
          <div className="px-5 py-4">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">本月已用</span>
              <span className="font-medium tabular-nums">{formatPercent(summary.budget_usage_rate)}</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className={summary.budget_usage_rate >= 0.8 ? "h-full bg-warning" : "h-full bg-primary"}
                style={{ width: `${Math.min(100, summary.budget_usage_rate * 100)}%` }}
              />
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              {formatCost(summary.month_spent_microcents)} / ¥{(summary.month_budget_cents / 100).toLocaleString("zh-CN")}
            </p>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

function HealthMetric({
  icon: Icon,
  label,
  value,
  danger = false,
}: {
  icon: typeof Clock3;
  label: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <div className="px-4 py-3.5">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Icon className="size-3.5" />{label}
      </div>
      <p className={danger ? "mt-1 text-lg font-semibold tabular-nums text-destructive" : "mt-1 text-lg font-semibold tabular-nums"}>
        {value}
      </p>
    </div>
  );
}
