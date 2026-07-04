"use client";

import { Suspense } from "react";
import { Sparkles } from "lucide-react";
import { AsyncBoundary } from "@/components/shared/async-boundary";
import { FilterSelect } from "@/components/shared/filter-select";
import { PageHeader } from "@/components/shared/page-header";
import { PermissionGate } from "@/components/shared/permission-gate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAnalyticsOverview, useGenerateAnalytics } from "@/features/analytics/queries";
import { InsightsPanel } from "@/features/analytics/components/insights-panel";
import { KpiStrip } from "@/features/analytics/components/kpi-strip";
import { PerformanceChart } from "@/features/analytics/components/performance-chart";
import { RankingPanel } from "@/features/analytics/components/ranking-panel";
import { useCampaigns } from "@/features/campaigns/queries";
import { useUrlFilters } from "@/lib/list-state";

const FILTER_DEFAULTS = { campaign_id: "", date_from: "", date_to: "" };

export default function AnalyticsPage() {
  return (
    <Suspense>
      <AnalyticsPageInner />
    </Suspense>
  );
}

function AnalyticsPageInner() {
  const { filters, setFilter, reset, isFiltered } = useUrlFilters(FILTER_DEFAULTS);
  const { data: campaigns } = useCampaigns({});
  const overview = useAnalyticsOverview({
    campaign_id: filters.campaign_id || undefined,
    date_from: filters.date_from || undefined,
    date_to: filters.date_to || undefined,
  });
  const generate = useGenerateAnalytics();

  return (
    <div className="space-y-6">
      <PageHeader
        title="数据分析"
        description="汇总 Campaign 指标、内容排名、AI 洞察与数据质量提示。"
        actions={
          <PermissionGate permission="ai:run">
            <Button
              disabled={!filters.campaign_id || generate.isPending}
              onClick={() =>
                generate.mutate({
                  campaign_id: filters.campaign_id,
                  date_from: filters.date_from || null,
                  date_to: filters.date_to || null,
                })
              }
            >
              <Sparkles className="size-4" />
              生成 AI 分析
            </Button>
          </PermissionGate>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <FilterSelect
          placeholder="Campaign"
          value={filters.campaign_id}
          onChange={(value) => setFilter("campaign_id", value)}
          options={(campaigns?.items ?? []).map((campaign) => ({
            value: campaign.id,
            label: campaign.name,
          }))}
        />
        <Input
          type="date"
          className="h-9 w-auto"
          value={filters.date_from}
          onChange={(event) => setFilter("date_from", event.target.value)}
          aria-label="开始日期"
        />
        <Input
          type="date"
          className="h-9 w-auto"
          value={filters.date_to}
          onChange={(event) => setFilter("date_to", event.target.value)}
          aria-label="结束日期"
        />
        {isFiltered && (
          <Button variant="ghost" size="sm" onClick={reset}>
            清除筛选
          </Button>
        )}
      </div>

      <AsyncBoundary
        isLoading={overview.isLoading}
        isError={overview.isError}
        error={overview.error}
        onRetry={() => overview.refetch()}
      >
        <KpiStrip overview={overview.data} />
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="space-y-4">
            <PerformanceChart series={overview.data?.series ?? []} />
            <RankingPanel overview={overview.data} />
          </div>
          <InsightsPanel
            insights={overview.data?.insights ?? []}
            notes={overview.data?.data_quality_notes ?? []}
          />
        </div>
      </AsyncBoundary>
    </div>
  );
}
