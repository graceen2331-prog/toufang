"use client";

import { Activity, BarChart3, Megaphone, MousePointerClick, WalletCards } from "lucide-react";
import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import type { AnalyticsOverviewDto } from "@/shared/schemas/content-analytics";
import { formatCents } from "@/lib/format";
import { cn } from "@/lib/utils";

function numberText(value: number | undefined): string {
  return (value ?? 0).toLocaleString("zh-CN");
}

function percentText(value: number | null | undefined): string {
  return value === null || value === undefined ? "缺数据" : `${(value * 100).toFixed(1)}%`;
}

export function DashboardKpiGrid({
  overview,
  activeCampaigns,
  totalBudgetCents,
}: {
  overview: AnalyticsOverviewDto | undefined;
  activeCampaigns: number;
  totalBudgetCents: number;
}) {
  const totals = overview?.totals ?? {};
  const engagements = (totals.likes ?? 0) + (totals.comments ?? 0) + (totals.shares ?? 0);

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <KpiTile
        label="活跃 Campaign"
        value={activeCampaigns.toLocaleString("zh-CN")}
        hint="排除完成、取消与归档"
        icon={<Megaphone className="size-4" />}
        accent="primary"
      />
      <KpiTile
        label="总曝光"
        value={numberText(totals.impressions)}
        hint={`观看 ${numberText(totals.views)}`}
        icon={<BarChart3 className="size-4" />}
        accent="primary"
      />
      <KpiTile
        label="互动率"
        value={percentText(overview?.kpis.engagement_rate)}
        hint={`互动 ${numberText(engagements)}`}
        icon={<Activity className="size-4" />}
        accent="violet"
      />
      <KpiTile
        label="转化"
        value={numberText(totals.conversions)}
        hint={`CVR ${percentText(overview?.kpis.conversion_rate)}`}
        icon={<MousePointerClick className="size-4" />}
        accent="amber"
      />
      <KpiTile
        label="预算池"
        value={formatCents(totalBudgetCents)}
        hint="当前列表 Campaign 预算"
        icon={<WalletCards className="size-4" />}
        accent="slate"
      />
    </div>
  );
}

function KpiTile({
  label,
  value,
  hint,
  icon,
  accent,
}: {
  label: string;
  value: string;
  hint: string;
  icon: ReactNode;
  accent: "primary" | "violet" | "amber" | "slate";
}) {
  return (
    <Card className="rounded-lg border-0 bg-card/95 py-0 shadow-[0_12px_32px_oklch(0.24_0.03_250_/_0.08)] ring-1 ring-foreground/8">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium text-muted-foreground">{label}</span>
          <span
            className={cn(
              "grid size-7 place-items-center rounded-md",
              accent === "primary" && "bg-primary/10 text-primary",
              accent === "violet" && "bg-violet-100 text-violet-700",
              accent === "amber" && "bg-amber-100 text-amber-700",
              accent === "slate" && "bg-slate-100 text-slate-700",
            )}
          >
            {icon}
          </span>
        </div>
        <div className="mt-3 text-2xl font-semibold tabular-nums">{value}</div>
        <div className="mt-1 text-xs text-muted-foreground">{hint}</div>
      </CardContent>
    </Card>
  );
}
