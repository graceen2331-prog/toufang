"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ActionQueueCard } from "@/features/dashboard/components/action-queue-card";
import { CampaignHealthTable } from "@/features/dashboard/components/campaign-health-table";
import { DashboardHeader } from "@/features/dashboard/components/dashboard-header";
import { DashboardKpiGrid } from "@/features/dashboard/components/dashboard-kpi-grid";
import { PerformanceChart } from "@/features/analytics/components/performance-chart";
import { useAnalyticsOverview, useReports } from "@/features/analytics/queries";
import { useCampaigns } from "@/features/campaigns/queries";
import { useMe } from "@/features/auth/queries";

const ACTIVE_CAMPAIGN_STATUSES = new Set(["completed", "cancelled", "archived"]);

export default function DashboardPage() {
  const { data: me } = useMe();
  const { data: overview } = useAnalyticsOverview({});
  const { data: campaigns } = useCampaigns({});
  const { data: reports } = useReports({ status: "in_review" });

  const campaignItems = campaigns?.items ?? [];
  const activeCampaigns = campaignItems.filter((campaign) => !ACTIVE_CAMPAIGN_STATUSES.has(campaign.status)).length;
  const totalBudgetCents = campaignItems.reduce((sum, campaign) => sum + campaign.budget_total_cents, 0);

  return (
    <div className="mx-auto flex w-full max-w-[1560px] flex-col gap-5">
      <DashboardHeader
        userName={me?.user.name}
        orgName={me?.org?.name}
        activeCampaigns={activeCampaigns}
        openInsights={overview?.insights.length ?? 0}
      />
      <DashboardKpiGrid
        overview={overview}
        activeCampaigns={activeCampaigns}
        totalBudgetCents={totalBudgetCents}
      />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.9fr)]">
        <PerformanceChart
          series={overview?.series ?? []}
          title="近 14 天效果趋势"
          description="播放、互动与内容转化的日度走势"
          height={360}
          className="border-0 bg-card/95 shadow-[0_14px_40px_oklch(0.24_0.03_250_/_0.08)] ring-1 ring-foreground/8"
          action={
            <Link href="/analytics" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
              查看分析
              <ArrowRight className="size-3.5" />
            </Link>
          }
        />
        <ActionQueueCard
          overview={overview}
          reports={reports?.items ?? []}
          campaigns={campaignItems}
        />
      </div>
      <CampaignHealthTable campaigns={campaignItems} />
    </div>
  );
}
