"use client";

import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { AsyncBoundary } from "@/components/shared/async-boundary";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { BrandLeadDetailPanel } from "@/features/brand-leads/components/brand-lead-detail-panel";
import { BrandLeadFiltersBar } from "@/features/brand-leads/components/brand-lead-filters";
import { BrandLeadPagination } from "@/features/brand-leads/components/brand-lead-pagination";
import { BrandLeadStats } from "@/features/brand-leads/components/brand-lead-stats";
import { BrandLeadTable } from "@/features/brand-leads/components/brand-lead-table";
import {
  useBrandLeads,
  useBrandLeadStats,
  type BrandLeadFilters,
} from "@/features/brand-leads/queries";
import type { BrandLeadDto } from "@/shared/schemas/brand-lead";

export function BrandLeadsPageClient() {
  const [filters, setFilters] = useState<BrandLeadFilters>({ cursor: null, limit: 20 });
  const [cursorStack, setCursorStack] = useState<Array<string | null>>([null]);
  const [selectedLead, setSelectedLead] = useState<BrandLeadDto | null>(null);
  const leadsQuery = useBrandLeads(filters);
  const statsQuery = useBrandLeadStats();
  const leads = leadsQuery.data?.items ?? [];
  const hasFilters = useMemo(
    () =>
      Boolean(
        filters.q || filters.country || filters.category || filters.tier || filters.seeking_funding,
      ),
    [filters],
  );
  const currentPage = Math.max(cursorStack.length, 1);
  const pageSize = filters.limit ?? 20;

  function updateFilters(next: BrandLeadFilters) {
    setCursorStack([null]);
    setFilters({ ...next, cursor: null, limit: pageSize });
  }

  function updatePageSize(nextPageSize: number) {
    setCursorStack([null]);
    setFilters({ ...filters, cursor: null, limit: nextPageSize });
  }

  function goNext() {
    const nextCursor = leadsQuery.data?.pagination.next_cursor;
    if (!nextCursor) return;
    setCursorStack((prev) => [...prev, nextCursor]);
    setFilters({ ...filters, cursor: nextCursor });
  }

  function goPrev() {
    if (cursorStack.length <= 1) return;
    const nextStack = cursorStack.slice(0, -1);
    setCursorStack(nextStack);
    setFilters({ ...filters, cursor: nextStack[nextStack.length - 1] ?? null });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="品牌机会雷达"
        description="把 CES 展商品牌作为需求侧线索，筛出适合达人主动合作的品牌机会。"
        actions={
          <Button variant="outline" asChild>
            <a
              href="https://github.com/aezizhu/CES-2026-Exhibitor-Database"
              target="_blank"
              rel="noreferrer"
            >
              <Download className="size-4" />
              数据来源
            </a>
          </Button>
        }
      />

      <BrandLeadStats stats={statsQuery.data} />

      <BrandLeadFiltersBar filters={filters} onChange={updateFilters} />

      <AsyncBoundary
        isLoading={leadsQuery.isLoading}
        isError={leadsQuery.isError}
        error={leadsQuery.error}
        onRetry={() => leadsQuery.refetch()}
        isEmpty={leads.length === 0}
        filtered={hasFilters}
        emptyTitle={hasFilters ? "没有匹配的品牌线索" : "还没有品牌线索"}
        emptyHint={
          hasFilters ? "换一个品类、地区或机会层级试试" : "运行 seed 后会看到 CES 演示品牌池"
        }
      >
        <BrandLeadTable leads={leads} onSelect={setSelectedLead} />
      </AsyncBoundary>

      <BrandLeadPagination
        pagination={leadsQuery.data?.pagination}
        page={currentPage}
        pageSize={pageSize}
        isFetching={leadsQuery.isFetching}
        onPageSizeChange={updatePageSize}
        onPrev={goPrev}
        onNext={goNext}
      />

      <BrandLeadDetailPanel
        lead={selectedLead}
        open={Boolean(selectedLead)}
        onOpenChange={(open) => {
          if (!open) setSelectedLead(null);
        }}
      />
    </div>
  );
}
