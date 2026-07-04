"use client";

import { Activity, MousePointerClick, TrendingUp, Users } from "lucide-react";
import { MetricCard } from "@/components/shared/metric-card";
import type { AnalyticsOverviewDto } from "@/shared/schemas/content-analytics";

function numberText(value: number | undefined): string {
  return (value ?? 0).toLocaleString("zh-CN");
}

function percentText(value: number | null): string {
  return value === null ? "缺数据" : `${(value * 100).toFixed(1)}%`;
}

export function KpiStrip({ overview }: { overview: AnalyticsOverviewDto | undefined }) {
  const totals = overview?.totals ?? {};
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <MetricCard
        label="曝光"
        value={numberText(totals.impressions)}
        hint={`观看 ${numberText(totals.views)}`}
        icon={<Users className="size-4 text-muted-foreground" />}
      />
      <MetricCard
        label="互动率"
        value={percentText(overview?.kpis.engagement_rate ?? null)}
        hint={`互动 ${numberText((totals.likes ?? 0) + (totals.comments ?? 0) + (totals.shares ?? 0))}`}
        icon={<Activity className="size-4 text-muted-foreground" />}
      />
      <MetricCard
        label="点击率"
        value={percentText(overview?.kpis.ctr ?? null)}
        hint={`点击 ${numberText(totals.clicks)}`}
        icon={<MousePointerClick className="size-4 text-muted-foreground" />}
      />
      <MetricCard
        label="ROI"
        value={overview?.kpis.roi === null || overview?.kpis.roi === undefined ? "缺数据" : overview.kpis.roi.toFixed(2)}
        hint={`转化 ${numberText(totals.conversions)}`}
        icon={<TrendingUp className="size-4 text-muted-foreground" />}
      />
    </div>
  );
}
