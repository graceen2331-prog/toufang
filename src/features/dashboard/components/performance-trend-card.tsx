"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AnalyticsOverviewDto } from "@/shared/schemas/content-analytics";

type SeriesItem = AnalyticsOverviewDto["series"][number];

function compact(value: number): string {
  return new Intl.NumberFormat("zh-CN", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function linePoints(series: SeriesItem[], key: "views" | "engagements", max: number): string {
  const width = 640;
  const height = 210;
  const step = series.length <= 1 ? width : width / (series.length - 1);
  return series
    .map((item, index) => {
      const x = index * step;
      const y = height - (item[key] / max) * 178 - 16;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

export function PerformanceTrendCard({ series }: { series: AnalyticsOverviewDto["series"] }) {
  const max = Math.max(1, ...series.flatMap((item) => [item.views, item.engagements]));
  const viewsPoints = linePoints(series, "views", max);
  const engagementPoints = linePoints(series, "engagements", max);
  const areaPoints = series.length ? `0,210 ${viewsPoints} 640,210` : "";
  const firstDate = series.at(0)?.date.slice(5) ?? "—";
  const lastDate = series.at(-1)?.date.slice(5) ?? "—";

  return (
    <Card className="rounded-lg border-0 bg-card/95 py-0 shadow-[0_14px_40px_oklch(0.24_0.03_250_/_0.08)] ring-1 ring-foreground/8">
      <CardHeader className="flex flex-row items-center justify-between gap-3 border-b px-5 py-4">
        <div>
          <CardTitle className="text-base font-semibold">近 14 天效果趋势</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">播放、互动与内容转化的日度走势</p>
        </div>
        <Link href="/analytics" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
          查看分析
          <ArrowRight className="size-3.5" />
        </Link>
      </CardHeader>
      <CardContent className="p-5">
        {series.length === 0 ? (
          <div className="flex h-72 items-center justify-center rounded-lg border border-dashed bg-muted/30 text-sm text-muted-foreground">
            暂无趋势数据
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{compact(max)}</span>
              <span>{firstDate} — {lastDate}</span>
            </div>
            <div className="relative h-72 overflow-hidden rounded-lg bg-[linear-gradient(180deg,var(--muted),transparent)] px-2 py-3">
              <svg className="h-full w-full overflow-visible" viewBox="0 0 640 230" role="img" aria-label="近 14 天效果趋势">
                <defs>
                  <linearGradient id="dashboard-trend-fill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.18" />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.02" />
                  </linearGradient>
                </defs>
                {[38, 96, 154, 212].map((y) => (
                  <line key={y} x1="0" x2="640" y1={y} y2={y} stroke="currentColor" className="text-border" />
                ))}
                <polygon points={areaPoints} fill="url(#dashboard-trend-fill)" />
                <polyline points={viewsPoints} fill="none" stroke="var(--primary)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" />
                <polyline points={engagementPoints} fill="none" stroke="oklch(0.56 0.14 292)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
                {series.map((item, index) => {
                  const x = series.length <= 1 ? 0 : (index * 640) / (series.length - 1);
                  const y = 210 - (item.views / max) * 178 - 16;
                  return <circle key={item.date} cx={x} cy={y} r="4" fill="var(--primary)" />;
                })}
              </svg>
            </div>
            <div className="flex items-center gap-5 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-2"><span className="size-2.5 rounded-sm bg-primary" />播放</span>
              <span className="inline-flex items-center gap-2"><span className="size-2.5 rounded-sm bg-violet-500" />互动</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
