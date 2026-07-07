"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { MessageSquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AsyncBoundary } from "@/components/shared/async-boundary";
import { DataTable } from "@/components/shared/data-table";
import { FilterSelect } from "@/components/shared/filter-select";
import { PageHeader } from "@/components/shared/page-header";
import { PermissionGate } from "@/components/shared/permission-gate";
import { StatusTag } from "@/components/shared/status-tag";
import { useCampaigns } from "@/features/campaigns/queries";
import { CampaignOutreachCandidates } from "@/features/outreach/components/campaign-outreach-candidates";
import { CreateOutreachDialog } from "@/features/outreach/components/create-outreach-dialog";
import { THREAD_STATUS } from "@/features/outreach/constants";
import { useOutreachThreads } from "@/features/outreach/queries";
import { useCursorPagination, useUrlFilters } from "@/lib/list-state";
import type { OutreachThreadListItemDto } from "@/shared/schemas/outreach";

const FILTER_DEFAULTS = { status: "", campaign_id: "" };

export default function OutreachPage() {
  return (
    <Suspense>
      <OutreachPageInner />
    </Suspense>
  );
}

function OutreachPageInner() {
  const router = useRouter();
  const { filters, setFilter, reset, isFiltered } = useUrlFilters(FILTER_DEFAULTS);
  const pagination = useCursorPagination();
  const [createOpen, setCreateOpen] = useState(false);
  const { data: campaigns } = useCampaigns({});
  const { data, isLoading, isError, error, refetch } = useOutreachThreads({
    status: filters.status || undefined,
    campaign_id: filters.campaign_id || undefined,
    cursor: pagination.cursor,
  });

  const columns = useMemo<ColumnDef<OutreachThreadListItemDto, unknown>[]>(
    () => [
      {
        header: "Campaign / 达人",
        cell: ({ row }) => (
          <div>
            <div className="font-medium">{row.original.campaign_name}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">{row.original.creator_name}</div>
          </div>
        ),
      },
      {
        header: "状态",
        cell: ({ row }) => <StatusTag source={THREAD_STATUS} value={row.original.status} />,
      },
      {
        header: "渠道",
        cell: ({ row }) => (row.original.channel === "email" ? "邮件" : "手动私信"),
      },
      {
        header: "主题",
        cell: ({ row }) => row.original.subject ?? <span className="text-muted-foreground">—</span>,
      },
      {
        header: "消息数",
        cell: ({ row }) => <span className="tabular-nums">{row.original.message_count}</span>,
      },
      {
        header: "待审批",
        cell: ({ row }) => (row.original.has_pending_approval ? "是" : "—"),
      },
      {
        header: "最近沟通",
        cell: ({ row }) =>
          row.original.last_message_at ? (
            <span className="tabular-nums text-muted-foreground">
              {format(new Date(row.original.last_message_at), "MM-dd HH:mm")}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
    ],
    [],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="外联工作台"
        description="管理达人触达、发送审批、回复记录与谈判分析。"
        actions={
          <PermissionGate permission="outreach:write">
            <Button onClick={() => setCreateOpen(true)}>
              <MessageSquarePlus className="size-4" />
              新建外联
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
          options={Object.entries(THREAD_STATUS).map(([value, meta]) => ({
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

      {filters.campaign_id && <CampaignOutreachCandidates campaignId={filters.campaign_id} />}

      <AsyncBoundary
        isLoading={isLoading}
        isError={isError}
        error={error}
        onRetry={() => refetch()}
        isEmpty={data?.items.length === 0}
        filtered={isFiltered}
        emptyTitle={isFiltered ? undefined : "还没有外联会话"}
        emptyHint={isFiltered ? undefined : "从已批准或已回复的 Campaign 达人创建外联会话"}
      >
        <DataTable
          columns={columns}
          data={data?.items ?? []}
          onRowClick={(row) => router.push(`/outreach/${row.id}`)}
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

      <CreateOutreachDialog
        key={filters.campaign_id || "all-campaigns"}
        open={createOpen}
        onOpenChange={setCreateOpen}
        initialCampaignId={filters.campaign_id || undefined}
      />
    </div>
  );
}
