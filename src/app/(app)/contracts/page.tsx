"use client";

import { Suspense, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AsyncBoundary } from "@/components/shared/async-boundary";
import { DataTable } from "@/components/shared/data-table";
import { FilterSelect } from "@/components/shared/filter-select";
import { PageHeader } from "@/components/shared/page-header";
import { PermissionGate } from "@/components/shared/permission-gate";
import { StatusTag } from "@/components/shared/status-tag";
import { useCampaigns } from "@/features/campaigns/queries";
import { ContractDetailPanel } from "@/features/contracts/components/contract-detail-panel";
import { CreateContractDialog } from "@/features/contracts/components/create-contract-dialog";
import { useContracts } from "@/features/contracts/queries";
import { formatCents } from "@/lib/format";
import { useCursorPagination, useUrlFilters } from "@/lib/list-state";
import { CONTRACT_STATUS } from "@/shared/constants/status";
import type { ContractDto } from "@/shared/schemas/outreach";

const FILTER_DEFAULTS = { status: "", campaign_id: "" };

export default function ContractsPage() {
  return (
    <Suspense>
      <ContractsPageInner />
    </Suspense>
  );
}

function ContractsPageInner() {
  const { filters, setFilter, reset, isFiltered } = useUrlFilters(FILTER_DEFAULTS);
  const pagination = useCursorPagination();
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data: campaigns } = useCampaigns({});
  const { data, isLoading, isError, error, refetch } = useContracts({
    status: filters.status || undefined,
    campaign_id: filters.campaign_id || undefined,
    cursor: pagination.cursor,
  });

  const columns = useMemo<ColumnDef<ContractDto, unknown>[]>(
    () => [
      {
        header: "合同 / 达人",
        cell: ({ row }) => (
          <div>
            <div className="font-medium">{row.original.contract_number}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              {row.original.campaign_name} · {row.original.creator_name}
            </div>
          </div>
        ),
      },
      {
        header: "状态",
        cell: ({ row }) => <StatusTag source={CONTRACT_STATUS} value={row.original.status} />,
      },
      {
        header: "合同金额",
        cell: ({ row }) => (
          <span className="tabular-nums">{formatCents(row.original.amount_cents)}</span>
        ),
      },
      {
        header: "已付款",
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatCents(row.original.payment_paid_cents)} /{" "}
            {formatCents(row.original.payment_total_cents)}
          </span>
        ),
      },
      {
        header: "创建时间",
        cell: ({ row }) => (
          <span className="tabular-nums text-muted-foreground">
            {format(new Date(row.original.created_at), "MM-dd HH:mm")}
          </span>
        ),
      },
    ],
    [],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="合同与付款"
        description="合同审批、签署状态、付款登记与付款审批集中管理。"
        actions={
          <PermissionGate permission="contract:write">
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" />
              新建合同
            </Button>
          </PermissionGate>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <FilterSelect
          placeholder="状态"
          value={filters.status}
          onChange={(v) => {
            setFilter("status", v);
            pagination.resetPages();
          }}
          options={Object.entries(CONTRACT_STATUS.states).map(([value, meta]) => ({
            value,
            label: meta.label,
          }))}
        />
        <FilterSelect
          placeholder="Campaign"
          value={filters.campaign_id}
          onChange={(v) => {
            setFilter("campaign_id", v);
            pagination.resetPages();
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
            }}
          >
            清除筛选
          </Button>
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <AsyncBoundary
          isLoading={isLoading}
          isError={isError}
          error={error}
          onRetry={() => refetch()}
          isEmpty={data?.items.length === 0}
          filtered={isFiltered}
          emptyTitle={isFiltered ? undefined : "还没有合同"}
          emptyHint={isFiltered ? undefined : "确认合作条款后，可从已确认达人创建合同"}
        >
          <DataTable
            columns={columns}
            data={data?.items ?? []}
            onRowClick={(row) => setSelectedId(row.id)}
            pagination={{
              info: data?.pagination,
              page: pagination.page,
              hasPrev: pagination.hasPrev,
              onNext: () =>
                data?.pagination.next_cursor && pagination.next(data.pagination.next_cursor),
              onPrev: pagination.prev,
            }}
          />
        </AsyncBoundary>

        {selectedId ? (
          <ContractDetailPanel contractId={selectedId} />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>合同详情</CardTitle>
              <CardDescription>从左侧列表选择一份合同查看付款与状态操作。</CardDescription>
            </CardHeader>
          </Card>
        )}
      </div>

      <CreateContractDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(contract) => setSelectedId(contract.id)}
      />
    </div>
  );
}
