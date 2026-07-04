"use client";

import { Suspense, useState } from "react";
import { Button } from "@/components/ui/button";
import { FilterSelect } from "@/components/shared/filter-select";
import { PageHeader } from "@/components/shared/page-header";
import { ReportEditor } from "@/features/analytics/components/report-editor";
import { ReportList } from "@/features/analytics/components/report-list";
import { useReport, useReports } from "@/features/analytics/queries";
import { useCampaigns } from "@/features/campaigns/queries";
import { useCursorPagination, useUrlFilters } from "@/lib/list-state";
import { REPORT_STATUS } from "@/shared/constants/status";

const FILTER_DEFAULTS = { status: "", campaign_id: "" };

export default function ReportsPage() {
  return (
    <Suspense>
      <ReportsPageInner />
    </Suspense>
  );
}

function ReportsPageInner() {
  const { filters, setFilter, reset, isFiltered } = useUrlFilters(FILTER_DEFAULTS);
  const pagination = useCursorPagination();
  const [explicitSelectedId, setExplicitSelectedId] = useState<string | null>(null);
  const { data: campaigns } = useCampaigns({});
  const reports = useReports({
    status: filters.status || undefined,
    campaign_id: filters.campaign_id || undefined,
    cursor: pagination.cursor,
  });
  const selectedId = explicitSelectedId ?? reports.data?.items[0]?.id ?? null;
  const detail = useReport(selectedId);
  const selectedReport = detail.data ?? reports.data?.items.find((item) => item.id === selectedId) ?? null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="报告"
        description="编辑 AI 复盘草稿、提交人工审批，并在批准后导出。"
      />

      <div className="flex flex-wrap items-center gap-2">
        <FilterSelect
          placeholder="状态"
          value={filters.status}
          onChange={(value) => {
            setFilter("status", value);
            pagination.resetPages();
            setExplicitSelectedId(null);
          }}
          options={Object.entries(REPORT_STATUS.states).map(([value, meta]) => ({ value, label: meta.label }))}
        />
        <FilterSelect
          placeholder="Campaign"
          value={filters.campaign_id}
          onChange={(value) => {
            setFilter("campaign_id", value);
            pagination.resetPages();
            setExplicitSelectedId(null);
          }}
          options={(campaigns?.items ?? []).map((campaign) => ({ value: campaign.id, label: campaign.name }))}
        />
        {isFiltered && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              reset();
              pagination.resetPages();
              setExplicitSelectedId(null);
            }}
          >
            清除筛选
          </Button>
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_520px]">
        <ReportList
          reports={reports.data?.items ?? []}
          isLoading={reports.isLoading}
          isError={reports.isError}
          error={reports.error}
          onRetry={() => reports.refetch()}
          onSelect={setExplicitSelectedId}
          pagination={{
            info: reports.data?.pagination,
            page: pagination.page,
            hasPrev: pagination.hasPrev,
            onNext: () =>
              reports.data?.pagination.next_cursor && pagination.next(reports.data.pagination.next_cursor),
            onPrev: pagination.prev,
          }}
        />
        <ReportEditor report={selectedReport} />
      </div>
    </div>
  );
}
