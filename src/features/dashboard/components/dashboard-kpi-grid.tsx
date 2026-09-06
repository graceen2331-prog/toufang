"use client";

import {
  Activity,
  BarChart3,
  FileCheck2,
  FileText,
  Megaphone,
  MessageSquareText,
  MousePointerClick,
  ScanText,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  DashboardMetricIcon,
  DashboardMetricItem,
} from "@/features/dashboard/use-dashboard-workspace";
import { cn } from "@/lib/utils";

const ICONS: Record<DashboardMetricIcon, typeof Activity> = {
  campaign: Megaphone,
  impressions: BarChart3,
  engagement: Activity,
  conversion: MousePointerClick,
  budget: WalletCards,
  approval: ShieldCheck,
  outreach: MessageSquareText,
  content: ScanText,
  contract: FileCheck2,
  report: FileText,
};

export function DashboardKpiGrid({ items }: { items: DashboardMetricItem[] }) {
  if (items.length === 0) return null;

  return (
    <section aria-label="工作台关键指标" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {items.map((item) => (
        <KpiTile key={item.key} item={item} />
      ))}
    </section>
  );
}

function KpiTile({ item }: { item: DashboardMetricItem }) {
  const Icon = ICONS[item.icon];
  return (
    <Card className="rounded-lg border-0 bg-card/95 py-0 shadow-[0_12px_32px_oklch(0.24_0.03_250_/_0.08)] ring-1 ring-foreground/8">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium text-muted-foreground">{item.label}</span>
          <span
            className={cn(
              "grid size-7 place-items-center rounded-md",
              item.accent === "primary" && "bg-primary/10 text-primary",
              item.accent === "violet" && "bg-violet-100 text-violet-700",
              item.accent === "amber" && "bg-amber-100 text-amber-700",
              item.accent === "slate" && "bg-slate-100 text-slate-700",
            )}
          >
            <Icon className="size-4" />
          </span>
        </div>
        {item.state === "loading" ? (
          <Skeleton className="mt-3 h-8 w-24" />
        ) : item.state === "error" ? (
          <div className="mt-3 text-sm font-medium text-destructive">暂不可用</div>
        ) : (
          <div className="mt-3 text-2xl font-semibold tabular-nums">{item.value}</div>
        )}
        <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.hint}</div>
      </CardContent>
    </Card>
  );
}
