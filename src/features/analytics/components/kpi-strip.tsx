"use client";

import { Activity, BadgeDollarSign, MousePointerClick, ShoppingCart, Users } from "lucide-react";
import { MetricCard } from "@/components/shared/metric-card";
import type { AnalyticsOverviewDto } from "@/shared/schemas/content-analytics";

function numberText(value: number | undefined): string {
  return value === undefined ? "缺数据" : value.toLocaleString("zh-CN");
}

function percentText(value: number | null): string {
  return value === null ? "缺数据" : `${(value * 100).toFixed(1)}%`;
}

export function KpiStrip({ overview }: { overview: AnalyticsOverviewDto | undefined }) {
  const totals = overview?.totals ?? {};
  const engagements = [totals.likes, totals.comments, totals.shares].every(
    (value) => value !== undefined,
  )
    ? (totals.likes ?? 0) + (totals.comments ?? 0) + (totals.shares ?? 0)
    : undefined;
  const finance = overview?.financial_context;
  const roasHint = overview?.kpis.roas === null || overview?.kpis.roas === undefined
    ? qualityHint(overview?.kpi_details.roas.reason)
    : [
        finance?.currency,
        finance?.attribution_window_days ? `${finance.attribution_window_days} 天归因` : null,
        finance?.attribution_model ? attributionLabel(finance.attribution_model) : null,
      ].filter(Boolean).join(" · ");
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
      <MetricCard
        label="曝光"
        value={numberText(totals.impressions)}
        hint={`观看 ${numberText(totals.views)}`}
        icon={<Users className="size-4 text-muted-foreground" />}
      />
      <MetricCard
        label="互动率"
        value={percentText(overview?.kpis.engagement_rate ?? null)}
        hint={`互动 ${numberText(engagements)}`}
        icon={<Activity className="size-4 text-muted-foreground" />}
      />
      <MetricCard
        label="点击率"
        value={percentText(overview?.kpis.ctr ?? null)}
        hint={`点击 ${numberText(totals.clicks)}`}
        icon={<MousePointerClick className="size-4 text-muted-foreground" />}
      />
      <MetricCard
        label="转化率"
        value={percentText(overview?.kpis.conversion_rate ?? null)}
        hint={`转化 ${numberText(totals.conversions)}`}
        icon={<ShoppingCart className="size-4 text-muted-foreground" />}
      />
      <MetricCard
        label="ROAS（收入/成本）"
        value={overview?.kpis.roas === null || overview?.kpis.roas === undefined
          ? "口径不足"
          : `${overview.kpis.roas.toFixed(2)}x`}
        hint={roasHint || "需完整币种与归因口径"}
        icon={<BadgeDollarSign className="size-4 text-muted-foreground" />}
      />
    </div>
  );
}

function attributionLabel(value: string): string {
  const labels: Record<string, string> = {
    last_click: "末次点击",
    first_click: "首次点击",
    platform: "平台归因",
  };
  return labels[value] ?? value;
}

function qualityHint(reason: string | null | undefined): string {
  const labels: Record<string, string> = {
    financial_context_incomplete: "币种或归因口径不完整",
    mixed_sources: "指标来源不一致",
    mixed_grain: "指标聚合层不一致",
    partial_coverage: "指标覆盖不完整",
    zero_denominator: "已记录成本为 0",
  };
  return reason ? (labels[reason] ?? "财务口径不足") : "需完整币种与归因口径";
}
