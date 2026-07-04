"use client";

import { Suspense, useState } from "react";
import { Plus } from "lucide-react";
import { FilterSelect } from "@/components/shared/filter-select";
import { PageHeader } from "@/components/shared/page-header";
import { PermissionGate } from "@/components/shared/permission-gate";
import { Button } from "@/components/ui/button";
import { useCampaigns } from "@/features/campaigns/queries";
import { ContentAssetQueue } from "@/features/content-review/components/content-asset-queue";
import { ContentPublishPanel } from "@/features/content-review/components/content-publish-panel";
import { ContentPreview } from "@/features/content-review/components/content-preview";
import { CreateContentAssetDialog } from "@/features/content-review/components/create-content-asset-dialog";
import { ReviewFindingsPanel } from "@/features/content-review/components/review-findings-panel";
import { useContentAsset, useContentAssets } from "@/features/content-review/queries";
import { useCursorPagination, useUrlFilters } from "@/lib/list-state";
import { CONTENT_ASSET_STATUS } from "@/shared/constants/status";

const FILTER_DEFAULTS = { status: "", campaign_id: "" };

export default function ContentReviewPage() {
  return (
    <Suspense>
      <ContentReviewPageInner />
    </Suspense>
  );
}

function ContentReviewPageInner() {
  const { filters, setFilter, reset, isFiltered } = useUrlFilters(FILTER_DEFAULTS);
  const pagination = useCursorPagination();
  const [explicitSelectedId, setExplicitSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const { data: campaigns } = useCampaigns({});
  const list = useContentAssets({
    status: filters.status || undefined,
    campaign_id: filters.campaign_id || undefined,
    cursor: pagination.cursor,
  });
  const selectedId = explicitSelectedId ?? list.data?.items[0]?.id ?? null;
  const detail = useContentAsset(selectedId);
  const asset = detail.data ?? list.data?.items.find((item) => item.id === selectedId) ?? null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="内容审核"
        description="集中处理达人内容初稿、AI 合规 findings 与人工复核。"
        actions={
          <PermissionGate permission="content:review">
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" />
              提交内容
            </Button>
          </PermissionGate>
        }
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
          options={Object.entries(CONTENT_ASSET_STATUS.states).map(([value, meta]) => ({
            value,
            label: meta.label,
          }))}
        />
        <FilterSelect
          placeholder="Campaign"
          value={filters.campaign_id}
          onChange={(value) => {
            setFilter("campaign_id", value);
            pagination.resetPages();
            setExplicitSelectedId(null);
          }}
          options={(campaigns?.items ?? []).map((campaign) => ({
            value: campaign.id,
            label: campaign.name,
          }))}
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

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_430px]">
        <ContentAssetQueue
          items={list.data?.items ?? []}
          isLoading={list.isLoading}
          isError={list.isError}
          error={list.error}
          onRetry={() => list.refetch()}
          selectedId={selectedId}
          onSelect={setExplicitSelectedId}
          pagination={{
            info: list.data?.pagination,
            page: pagination.page,
            hasPrev: pagination.hasPrev,
            onNext: () =>
              list.data?.pagination.next_cursor && pagination.next(list.data.pagination.next_cursor),
            onPrev: pagination.prev,
          }}
        />
        <div className="space-y-4">
          <ContentPreview asset={asset} />
          <ReviewFindingsPanel asset={asset} />
          <ContentPublishPanel asset={asset} />
        </div>
      </div>
      <CreateContentAssetDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={setExplicitSelectedId}
      />
    </div>
  );
}
