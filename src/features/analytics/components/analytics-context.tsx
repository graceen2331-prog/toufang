"use client";

import { CalendarRange, Database, RefreshCw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { AnalyticsOverviewDto } from "@/shared/schemas/content-analytics";

function dateRange(overview: AnalyticsOverviewDto): string {
  const { actual_date_from: from, actual_date_to: to } = overview.scope;
  if (!from || !to) return "暂无可用数据范围";
  return from === to ? from : `${from} 至 ${to}`;
}

function freshness(overview: AnalyticsOverviewDto): string {
  if (overview.freshness.latest_source_observed_at) {
    return `来源数据更新至 ${formatDateTime(overview.freshness.latest_source_observed_at)}`;
  }
  if (overview.freshness.latest_ingested_at) {
    return `最近入库 ${formatDateTime(overview.freshness.latest_ingested_at)}`;
  }
  return "暂无更新时间";
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

export function AnalyticsContext({ overview }: { overview: AnalyticsOverviewDto }) {
  const source = overview.kpi_details.impressions.source ?? "来源未统一";
  return (
    <Card className="py-0">
      <CardContent className="grid gap-3 px-4 py-3 text-sm md:grid-cols-3">
        <div className="flex items-center gap-2">
          <CalendarRange className="size-4 text-muted-foreground" />
          <span><strong>{overview.scope.label}</strong> · {dateRange(overview)}</span>
        </div>
        <div className="flex items-center gap-2">
          <Database className="size-4 text-muted-foreground" />
          <span>总览口径：{sourceLabel(source)} · 单一聚合层消重</span>
        </div>
        <div className="flex items-center gap-2">
          <RefreshCw className="size-4 text-muted-foreground" />
          <span>{freshness(overview)}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function sourceLabel(value: string): string {
  const labels: Record<string, string> = {
    manual: "人工录入",
    import: "批量导入",
    integration: "平台集成",
  };
  return labels[value] ?? value;
}
