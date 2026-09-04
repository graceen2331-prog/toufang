"use client";

import { Building2, Globe2, Sparkles, TrendingUp } from "lucide-react";
import { MetricCard } from "@/components/shared/metric-card";
import type { BrandLeadStatsDto } from "@/shared/schemas/brand-lead";

export function BrandLeadStats({ stats }: { stats: BrandLeadStatsDto | undefined }) {
  return (
    <div className="grid gap-3 md:grid-cols-4">
      <MetricCard
        label="品牌线索"
        value={stats?.total ?? "—"}
        hint="CES 2026 展商品牌池"
        icon={<Building2 className="size-4 text-muted-foreground" />}
      />
      <MetricCard
        label="优先机会"
        value={stats?.priority ?? "—"}
        hint="高分且适合主动外联"
        icon={<Sparkles className="size-4 text-muted-foreground" />}
      />
      <MetricCard
        label="融资需求"
        value={stats?.seeking_funding ?? "—"}
        hint="可能更重曝光与市场验证"
        icon={<TrendingUp className="size-4 text-muted-foreground" />}
      />
      <MetricCard
        label="国家/地区"
        value={stats?.countries ?? "—"}
        hint="用于出海市场筛选"
        icon={<Globe2 className="size-4 text-muted-foreground" />}
      />
    </div>
  );
}
