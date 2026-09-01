"use client";

import { useState } from "react";
import { BarChart3, Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PermissionGate } from "@/components/shared/permission-gate";
import { useUpsertMetric } from "@/features/analytics/queries";
import { useTransitionContentAsset } from "@/features/content-review/queries";
import type { ContentAssetDto } from "@/shared/schemas/content-analytics";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function ContentPublishPanel({ asset }: { asset: ContentAssetDto | null }) {
  const transition = useTransitionContentAsset();
  const upsertMetric = useUpsertMetric();
  const [metricDate, setMetricDate] = useState(today);
  const [views, setViews] = useState(12000);
  const [likes, setLikes] = useState(860);
  const [comments, setComments] = useState(96);
  const [conversions, setConversions] = useState(34);

  if (!asset) {
    return null;
  }

  const canPublish = asset.status === "approved" && asset.approval_evidence_present;
  const requiresReapproval = asset.status === "approved" && !asset.approval_evidence_present;
  const canRecordMetrics = asset.status === "published";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">发布与指标</CardTitle>
        <CardDescription>内容过审后标记发布，并录入平台回传的首批指标。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!canPublish && !canRecordMetrics && !requiresReapproval && (
          <p className="text-sm text-muted-foreground">内容过审后可在这里完成发布与指标录入。</p>
        )}
        {requiresReapproval && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            该历史内容缺少与当前正文绑定的审批证据，请重新发起内容审核后再发布。
          </p>
        )}

        {canPublish && (
          <PermissionGate permission="content:review">
            <Button
              disabled={transition.isPending}
              onClick={() =>
                transition.mutate({
                  id: asset.id,
                  to: "published",
                  reason: "内容已发布",
                })
              }
            >
              <Megaphone className="size-4" />
              标记发布
            </Button>
          </PermissionGate>
        )}

        {canRecordMetrics && (
          <PermissionGate permission="analytics:write">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="metric-date">指标日期</label>
                <Input
                  id="metric-date"
                  type="date"
                  value={metricDate}
                  onChange={(event) => setMetricDate(event.target.value)}
                />
              </div>
              <MetricInput label="观看" value={views} onChange={setViews} />
              <MetricInput label="点赞" value={likes} onChange={setLikes} />
              <MetricInput label="评论" value={comments} onChange={setComments} />
              <MetricInput label="转化" value={conversions} onChange={setConversions} />
            </div>
            <Button
              variant="outline"
              disabled={upsertMetric.isPending}
              onClick={() =>
                upsertMetric.mutate({
                  entity_type: "content_asset",
                  entity_id: asset.id,
                  platform: asset.platform ?? "all",
                  metric_date: metricDate,
                  metrics: {
                    views,
                    likes,
                    comments,
                    conversions,
                    impressions: Math.max(views * 3, views),
                  },
                  source: "manual",
                })
              }
            >
              <BarChart3 className="size-4" />
              录入指标
            </Button>
          </PermissionGate>
        )}
      </CardContent>
    </Card>
  );
}

function MetricInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const id = `metric-${label}`;
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium" htmlFor={id}>{label}</label>
      <Input
        id={id}
        type="number"
        min={0}
        value={value}
        onChange={(event) => onChange(Number(event.target.value || 0))}
      />
    </div>
  );
}
