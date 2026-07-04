"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AnalyticsOverviewDto } from "@/shared/schemas/content-analytics";

function PerformerList({
  title,
  items,
}: {
  title: string;
  items: AnalyticsOverviewDto["top_performers"];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">暂无排名数据</p>
        ) : (
          items.map((item, index) => (
            <div key={`${item.entity_type}-${item.entity_id}`} className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">
                  {index + 1}. {item.label}
                </p>
                <p className="text-xs text-muted-foreground">{item.entity_type}</p>
              </div>
              <span className="text-sm tabular-nums text-muted-foreground">{Math.round(item.score)}</span>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

export function RankingPanel({ overview }: { overview: AnalyticsOverviewDto | undefined }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <PerformerList title="高表现内容 / 达人" items={overview?.top_performers ?? []} />
      <PerformerList title="需关注内容 / 达人" items={overview?.low_performers ?? []} />
    </div>
  );
}
