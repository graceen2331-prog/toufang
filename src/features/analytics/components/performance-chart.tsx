"use client";

import type { ReactNode } from "react";
import ReactECharts from "echarts-for-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AnalyticsOverviewDto } from "@/shared/schemas/content-analytics";
import { cn } from "@/lib/utils";

export function PerformanceChart({
  series,
  title = "趋势",
  description,
  action,
  className,
  height = 300,
}: {
  series: AnalyticsOverviewDto["series"];
  title?: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  height?: number;
}) {
  const option = {
    tooltip: { trigger: "axis" },
    legend: { top: 0, right: 0, itemGap: 14 },
    color: ["#0b7a58", "#b6da2b", "#5f6477"],
    grid: { left: 48, right: 46, top: 48, bottom: 34 },
    xAxis: { type: "category", data: series.map((item) => item.date) },
    yAxis: [
      { type: "value", name: "互动/转化" },
      { type: "value", name: "观看", splitLine: { show: false } },
    ],
    series: [
      { name: "观看", type: "line", yAxisIndex: 1, smooth: true, data: series.map((item) => item.views) },
      { name: "互动", type: "bar", data: series.map((item) => item.engagements) },
      { name: "转化", type: "line", smooth: true, data: series.map((item) => item.conversions) },
    ],
  };

  return (
    <Card className={cn("rounded-lg py-0", className)}>
      <CardHeader className="flex flex-row items-start justify-between gap-3 border-b px-5 py-4">
        <div>
          <CardTitle className="text-base">{title}</CardTitle>
          {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
        </div>
        {action}
      </CardHeader>
      <CardContent className="p-5">
        {series.length ? (
          <ReactECharts option={option} style={{ height }} />
        ) : (
          <div
            className="flex items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground"
            style={{ height }}
          >
            暂无趋势数据
          </div>
        )}
      </CardContent>
    </Card>
  );
}
