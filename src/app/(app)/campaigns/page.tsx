"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AsyncBoundary } from "@/components/shared/async-boundary";
import { DataTable } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { PermissionGate } from "@/components/shared/permission-gate";
import { StatusTag } from "@/components/shared/status-tag";
import { useBrands } from "@/features/brands/queries";
import { useCampaigns } from "@/features/campaigns/queries";
import { useCursorPagination, useUrlFilters } from "@/lib/list-state";
import { CAMPAIGN_HEALTH, CAMPAIGN_STATUS } from "@/shared/constants/status";
import { CAMPAIGN_OBJECTIVES } from "@/shared/schemas/campaign";
import type { CampaignListItemDto } from "@/shared/schemas/campaign";
import { PLATFORM_LABELS } from "@/shared/schemas/creator";

const FILTER_DEFAULTS = { q: "", status: "", brand_id: "" };

function formatCents(cents: number): string {
  return `¥${(cents / 100).toLocaleString("zh-CN")}`;
}

export default function CampaignsPage() {
  return (
    <Suspense>
      <CampaignsPageInner />
    </Suspense>
  );
}

function CampaignsPageInner() {
  const router = useRouter();
  const { filters, setFilter, reset, isFiltered } = useUrlFilters(FILTER_DEFAULTS);
  const pagination = useCursorPagination();
  const [qInput, setQInput] = useState(filters.q);

  const { data: brands } = useBrands();
  const { data, isLoading, isError, error, refetch } = useCampaigns({
    q: filters.q || undefined,
    status: filters.status || undefined,
    brand_id: filters.brand_id || undefined,
    cursor: pagination.cursor,
  });

  const columns = useMemo<ColumnDef<CampaignListItemDto, unknown>[]>(
    () => [
      {
        header: "名称",
        accessorKey: "name",
        cell: ({ row }) => (
          <div>
            <div className="font-medium">{row.original.name}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">{row.original.brand_name}</div>
          </div>
        ),
      },
      {
        header: "状态",
        cell: ({ row }) => <StatusTag source={CAMPAIGN_STATUS} value={row.original.status} />,
      },
      {
        header: "健康度",
        cell: ({ row }) => (
          <StatusTag source={CAMPAIGN_HEALTH} value={row.original.health_status} />
        ),
      },
      {
        header: "目标",
        cell: ({ row }) =>
          row.original.objective ? (
            <span className="text-sm">
              {CAMPAIGN_OBJECTIVES[row.original.objective as keyof typeof CAMPAIGN_OBJECTIVES] ??
                row.original.objective}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        header: "平台",
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            {row.original.platforms.map((p) => (
              <Badge key={p} variant="outline">
                {PLATFORM_LABELS[p as keyof typeof PLATFORM_LABELS] ?? p}
              </Badge>
            ))}
          </div>
        ),
      },
      {
        header: "预算",
        cell: ({ row }) => (
          <span className="tabular-nums">{formatCents(row.original.budget_total_cents)}</span>
        ),
      },
      {
        header: "达人数",
        cell: ({ row }) => <span className="tabular-nums">{row.original.creator_count}</span>,
      },
      {
        header: "负责人",
        cell: ({ row }) => row.original.owner_name ?? <span className="text-muted-foreground">—</span>,
      },
    ],
    [],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Campaign"
        description="端到端管理营销活动：从策略、达人合作到复盘报告。"
        actions={
          <PermissionGate permission="campaign:write">
            <Button asChild>
              <Link href="/campaigns/new">
                <Plus className="size-4" />
                新建 Campaign
              </Link>
            </Button>
          </PermissionGate>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <form
          className="relative w-60"
          onSubmit={(e) => {
            e.preventDefault();
            setFilter("q", qInput);
            pagination.resetPages();
          }}
        >
          <Search className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="搜索 Campaign 名称"
            className="pl-8"
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
          />
        </form>
        <FilterSelect
          placeholder="状态"
          value={filters.status}
          onChange={(v) => {
            setFilter("status", v);
            pagination.resetPages();
          }}
          options={Object.entries(CAMPAIGN_STATUS.states).map(([value, meta]) => ({
            value,
            label: meta.label,
          }))}
        />
        <FilterSelect
          placeholder="品牌"
          value={filters.brand_id}
          onChange={(v) => {
            setFilter("brand_id", v);
            pagination.resetPages();
          }}
          options={(brands?.items ?? []).map((b) => ({ value: b.id, label: b.name }))}
        />
        {isFiltered && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              reset();
              setQInput("");
              pagination.resetPages();
            }}
          >
            清除筛选
          </Button>
        )}
      </div>

      <AsyncBoundary
        isLoading={isLoading}
        isError={isError}
        error={error}
        onRetry={() => refetch()}
        isEmpty={data?.items.length === 0}
        filtered={isFiltered}
        emptyTitle={isFiltered ? undefined : "还没有 Campaign"}
        emptyHint={isFiltered ? undefined : "点击右上角「新建 Campaign」发起第一个营销活动"}
      >
        <DataTable
          columns={columns}
          data={data?.items ?? []}
          onRowClick={(row) => router.push(`/campaigns/${row.id}`)}
          pagination={{
            info: data?.pagination,
            page: pagination.page,
            hasPrev: pagination.hasPrev,
            onNext: () => data?.pagination.next_cursor && pagination.next(data.pagination.next_cursor),
            onPrev: pagination.prev,
          }}
        />
      </AsyncBoundary>
    </div>
  );
}

function FilterSelect({
  placeholder,
  value,
  onChange,
  options,
}: {
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <Select value={value || "all"} onValueChange={(v) => onChange(v === "all" ? "" : v)}>
      <SelectTrigger className="w-36">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{placeholder}（全部）</SelectItem>
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
