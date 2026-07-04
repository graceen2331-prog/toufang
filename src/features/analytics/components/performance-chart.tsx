"use client";

import ReactECharts from "echarts-for-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AnalyticsOverviewDto } from "@/shared/schemas/content-analytics";

export function PerformanceChart({ series }: { series: AnalyticsOverviewDto["series"] }) {
  const option = {
    tooltip: { trigger: "axis" },
    legend: { top: 0, right: 0 },
    grid: { left: 40, right: 20, top: 40, bottom: 30 },
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
    <Card>
      <CardHeader>
        <CardTitle className="text-base">趋势</CardTitle>
      </CardHeader>
      <CardContent>
        {series.length ? (
          <ReactECharts option={option} style={{ height: 300 }} />
        ) : (
          <div className="flex h-[300px] items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
            暂无趋势数据
          </div>
        )}
      </CardContent>
    </Card>
  );
}
