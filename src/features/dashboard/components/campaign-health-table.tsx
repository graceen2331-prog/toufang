"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusTag } from "@/components/shared/status-tag";
import { CAMPAIGN_HEALTH, CAMPAIGN_STATUS } from "@/shared/constants/status";
import type { CampaignListItemDto } from "@/shared/schemas/campaign";
import { formatCents } from "@/lib/format";

function dateText(value: string | null): string {
  return value ? value.slice(0, 10) : "未设置";
}

export function CampaignHealthTable({ campaigns }: { campaigns: CampaignListItemDto[] }) {
  const rows = campaigns.slice(0, 5);

  return (
    <Card className="rounded-lg border-0 bg-card/95 py-0 shadow-[0_14px_40px_oklch(0.24_0.03_250_/_0.08)] ring-1 ring-foreground/8">
      <CardHeader className="flex flex-row items-center justify-between gap-3 border-b px-5 py-4">
        <CardTitle className="text-base font-semibold">Campaign 健康度</CardTitle>
        <Link href="/campaigns" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
          全部 Campaign
          <ArrowRight className="size-3.5" />
        </Link>
      </CardHeader>
      <CardContent className="p-0">
        {rows.length === 0 ? (
          <div className="px-5 py-10 text-sm text-muted-foreground">暂无 Campaign 数据</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 text-left font-medium">Campaign</th>
                  <th className="px-4 py-3 text-left font-medium">阶段</th>
                  <th className="px-4 py-3 text-left font-medium">健康度</th>
                  <th className="px-4 py-3 text-right font-medium">达人</th>
                  <th className="px-4 py-3 text-right font-medium">预算</th>
                  <th className="px-5 py-3 text-left font-medium">结束日期</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((campaign) => (
                  <tr key={campaign.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-5 py-3">
                      <Link href={`/campaigns/${campaign.id}`} className="font-medium hover:text-primary">
                        {campaign.name}
                      </Link>
                      <div className="mt-0.5 text-xs text-muted-foreground">{campaign.brand_name}</div>
                    </td>
                    <td className="px-4 py-3"><StatusTag source={CAMPAIGN_STATUS} value={campaign.status} /></td>
                    <td className="px-4 py-3"><StatusTag source={CAMPAIGN_HEALTH} value={campaign.health_status} /></td>
                    <td className="px-4 py-3 text-right tabular-nums">{campaign.creator_count}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatCents(campaign.budget_total_cents)}</td>
                    <td className="px-5 py-3 text-muted-foreground tabular-nums">{dateText(campaign.end_date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
