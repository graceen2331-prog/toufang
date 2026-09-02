"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AnalyticsOverviewDto } from "@/shared/schemas/content-analytics";

const ENTITY_TYPE_LABELS: Record<string, string> = {
  campaign: "Campaign",
  campaign_creator: "达人合作",
  content_asset: "内容资产",
};

const PLATFORM_LABELS: Record<string, string> = {
  all: "全平台",
  douyin: "抖音",
  xiaohongshu: "小红书",
  bilibili: "哔哩哔哩",
  weibo: "微博",
};

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
            <div
              key={`${item.entity_type}-${item.entity_id}`}
              className="flex items-center justify-between gap-3"
            >
              <div>
                <p className="text-sm font-medium">
                  {index + 1}. {item.label}
                </p>
                <p className="text-xs text-muted-foreground">
                  {ENTITY_TYPE_LABELS[item.entity_type] ?? "业务对象"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium tabular-nums">
                  {(item.metric_value * 100).toFixed(2)}%
                </p>
                <p className="text-xs text-muted-foreground">
                  样本 {item.sample_size.toLocaleString("zh-CN")} 曝光
                </p>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

export function RankingPanel({ overview }: { overview: AnalyticsOverviewDto | undefined }) {
  const groups = overview?.ranking_groups ?? [];
  if (groups.length === 0) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <PerformerList title="高表现内容 / 达人" items={[]} />
        <PerformerList title="需关注内容 / 达人" items={[]} />
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {groups.map((group) => {
        const scope = `${ENTITY_TYPE_LABELS[group.entity_type]} · ${PLATFORM_LABELS[group.platform] ?? group.platform}`;
        return (
          <section key={`${group.entity_type}-${group.platform}`} className="space-y-2">
            <p className="text-xs text-muted-foreground">
              {scope} · 按互动率排名 · 最低 {group.minimum_impressions.toLocaleString("zh-CN")} 曝光
            </p>
            <div className="grid gap-4 lg:grid-cols-2">
              <PerformerList title="高表现" items={group.top} />
              <PerformerList title="需关注" items={group.low} />
            </div>
          </section>
        );
      })}
    </div>
  );
}
