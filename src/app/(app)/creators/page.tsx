"use client";

import { Suspense, useMemo, useState } from "react";
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
import { CreatorFormDialog } from "@/features/creators/components/creator-form-dialog";
import { useCreators } from "@/features/creators/queries";
import { useCursorPagination, useUrlFilters } from "@/lib/list-state";
import { CREATOR_RELATIONSHIP_STATUS, RISK_LEVEL } from "@/shared/constants/status";
import { PLATFORM_LABELS, PLATFORMS } from "@/shared/schemas/creator";
import type { CreatorListItemDto } from "@/shared/schemas/creator";

const FILTER_DEFAULTS = { q: "", platform: "", relationship_status: "", risk_level: "" };

function formatFollowers(n: number): string {
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)} 亿`;
  if (n >= 10_000) return `${(n / 10_000).toFixed(1)} 万`;
  return String(n);
}

export default function CreatorsPage() {
  return (
    <Suspense>
      <CreatorsPageInner />
    </Suspense>
  );
}

function CreatorsPageInner() {
  const router = useRouter();
  const { filters, setFilter, reset, isFiltered } = useUrlFilters(FILTER_DEFAULTS);
  const pagination = useCursorPagination();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [qInput, setQInput] = useState(filters.q);

  const { data, isLoading, isError, error, refetch } = useCreators({
    q: filters.q || undefined,
    platform: filters.platform || undefined,
    relationship_status: filters.relationship_status || undefined,
    risk_level: filters.risk_level || undefined,
    cursor: pagination.cursor,
  });

  const columns = useMemo<ColumnDef<CreatorListItemDto, unknown>[]>(
    () => [
      {
        header: "达人",
        accessorKey: "display_name",
        cell: ({ row }) => (
          <div>
            <div className="font-medium">{row.original.display_name}</div>
            <div className="mt-0.5 flex flex-wrap gap-1">
              {row.original.categories.slice(0, 3).map((c) => (
                <Badge key={c} variant="secondary" className="text-xs">
                  {c}
                </Badge>
              ))}
            </div>
          </div>
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
        header: "总粉丝",
        cell: ({ row }) => (
          <span className="tabular-nums">{formatFollowers(row.original.total_followers)}</span>
        ),
      },
      {
        header: "互动率",
        cell: ({ row }) => (
          <span className="tabular-nums">
            {row.original.max_engagement_rate > 0
              ? `${row.original.max_engagement_rate.toFixed(1)}%`
              : "—"}
          </span>
        ),
      },
      {
        header: "关系状态",
        cell: ({ row }) => (
          <StatusTag source={CREATOR_RELATIONSHIP_STATUS} value={row.original.relationship_status} />
        ),
      },
      {
        header: "风险",
        cell: ({ row }) => <StatusTag source={RISK_LEVEL} value={row.original.risk_level} />,
      },
    ],
    [],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="达人库"
        description="发现、筛选与管理达人资源，支持按平台、状态与风险过滤。"
        actions={
          <PermissionGate permission="creator:write">
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="size-4" />
              新建达人
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
            placeholder="搜索名称 / 简介"
            className="pl-8"
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
          />
        </form>
        <FilterSelect
          placeholder="平台"
          value={filters.platform}
          onChange={(v) => {
            setFilter("platform", v);
            pagination.resetPages();
          }}
          options={PLATFORMS.map((p) => ({ value: p, label: PLATFORM_LABELS[p] }))}
        />
        <FilterSelect
          placeholder="关系状态"
          value={filters.relationship_status}
          onChange={(v) => {
            setFilter("relationship_status", v);
            pagination.resetPages();
          }}
          options={Object.entries(CREATOR_RELATIONSHIP_STATUS.states).map(([value, meta]) => ({
            value,
            label: meta.label,
          }))}
        />
        <FilterSelect
          placeholder="风险等级"
          value={filters.risk_level}
          onChange={(v) => {
            setFilter("risk_level", v);
            pagination.resetPages();
          }}
          options={Object.entries(RISK_LEVEL).map(([value, meta]) => ({ value, label: meta.label }))}
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
        emptyTitle={isFiltered ? undefined : "达人库还是空的"}
        emptyHint={isFiltered ? undefined : "点击右上角「新建达人」，或等待 AI 达人发现工作流上线"}
      >
        <DataTable
          columns={columns}
          data={data?.items ?? []}
          onRowClick={(row) => router.push(`/creators/${row.id}`)}
          pagination={{
            info: data?.pagination,
            page: pagination.page,
            hasPrev: pagination.hasPrev,
            onNext: () => data?.pagination.next_cursor && pagination.next(data.pagination.next_cursor),
            onPrev: pagination.prev,
          }}
        />
      </AsyncBoundary>

      <CreatorFormDialog open={dialogOpen} onOpenChange={setDialogOpen} />
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
      <SelectTrigger className="w-32">
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
