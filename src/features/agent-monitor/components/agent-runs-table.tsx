"use client";

import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/shared/data-table";
import { StatusTag } from "@/components/shared/status-tag";
import { AGENT_RUN_STATUS } from "@/shared/constants/status";
import {
  AGENT_ANOMALY_LABELS,
  AGENT_ERROR_LABELS,
  AGENT_KEY_LABELS,
  type AgentRunListItemDto,
} from "@/shared/schemas/agent-monitor";
import { formatCost } from "@/shared/schemas/workflow";
import { formatCompactNumber, formatDuration } from "../format";
import type { ApiPagination } from "@/lib/api";

export function AgentRunsTable({
  items,
  onOpen,
  pagination,
}: {
  items: AgentRunListItemDto[];
  onOpen: (run: AgentRunListItemDto) => void;
  pagination: {
    info: ApiPagination | undefined;
    page: number;
    hasPrev: boolean;
    onNext: () => void;
    onPrev: () => void;
  };
}) {
  const columns = useMemo<ColumnDef<AgentRunListItemDto, unknown>[]>(
    () => [
      {
        header: "Agent",
        cell: ({ row }) => (
          <div className="min-w-36">
            <p className="font-medium">{AGENT_KEY_LABELS[row.original.agent_key] ?? row.original.agent_key}</p>
            <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{row.original.id.slice(0, 12)}</p>
          </div>
        ),
      },
      {
        header: "状态 / 异常",
        cell: ({ row }) => (
          <div className="space-y-1.5">
            <StatusTag source={AGENT_RUN_STATUS} value={row.original.status} />
            {row.original.anomalies.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {row.original.anomalies.map((anomaly) => (
                  <Badge key={anomaly} variant="destructive" className="text-[10px]">
                    {AGENT_ANOMALY_LABELS[anomaly] ?? anomaly}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        ),
      },
      {
        header: "上下文",
        cell: ({ row }) => (
          <div className="min-w-32 text-xs">
            <p>{row.original.mode === "workflow" ? "工作流" : "同步调用"}</p>
            <p className="mt-1 text-muted-foreground">
              {row.original.subject_type ?? "未关联业务主体"}
              {row.original.subject_id ? ` · ${row.original.subject_id.slice(0, 8)}` : ""}
            </p>
            {row.original.actor && <p className="mt-1 text-muted-foreground">{row.original.actor.name}</p>}
          </div>
        ),
      },
      {
        header: "模型",
        cell: ({ row }) => (
          <div className="min-w-28 text-xs">
            <p className="font-mono">{row.original.model ?? "—"}</p>
            <p className="mt-1 text-muted-foreground">{row.original.provider ?? "—"}</p>
          </div>
        ),
      },
      {
        header: "调用 / Token",
        cell: ({ row }) => (
          <div className="text-right tabular-nums">
            <p>{row.original.call_count} 次</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatCompactNumber(row.original.input_tokens + row.original.output_tokens)} tokens
            </p>
          </div>
        ),
      },
      {
        header: "时长",
        cell: ({ row }) => (
          <div className="text-right tabular-nums">
            <p>{formatDuration(row.original.duration_ms)}</p>
            {row.original.error_type && (
              <p className="mt-1 text-xs text-destructive">
                {AGENT_ERROR_LABELS[row.original.error_type] ?? row.original.error_type}
              </p>
            )}
          </div>
        ),
      },
      {
        header: "成本",
        cell: ({ row }) => <span className="tabular-nums">{formatCost(row.original.cost_microcents)}</span>,
      },
      {
        header: "开始时间",
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">
            {format(new Date(row.original.started_at), "MM-dd HH:mm:ss")}
          </span>
        ),
      },
    ],
    [],
  );

  return <DataTable columns={columns} data={items} onRowClick={onOpen} pagination={pagination} />;
}
