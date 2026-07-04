"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { StatusTag } from "@/components/shared/status-tag";
import { useCreators, useTransitionCreatorStatus } from "@/features/creators/queries";
import { CREATOR_RELATIONSHIP_STATUS } from "@/shared/constants/status";
import type { CreatorListItemDto } from "@/shared/schemas/creator";

// CRM 管道列：核心关系阶段（终态类单列聚合展示）
const PIPELINE_COLUMNS = [
  "new",
  "shortlisted",
  "contacted",
  "negotiating",
  "confirmed",
  "active",
  "long_term_partner",
] as const;

export default function CreatorCrmPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="达人 CRM"
        description="按关系阶段管理达人管道，点击卡片进入详情，通过菜单推进状态。"
        actions={
          <Button variant="outline" asChild>
            <Link href="/creators">列表视图</Link>
          </Button>
        }
      />
      <div className="flex gap-3 overflow-x-auto pb-4">
        {PIPELINE_COLUMNS.map((status) => (
          <PipelineColumn key={status} status={status} />
        ))}
      </div>
    </div>
  );
}

function PipelineColumn({ status }: { status: string }) {
  const { data, isLoading } = useCreators({ relationship_status: status });
  const meta = CREATOR_RELATIONSHIP_STATUS.states[status];

  return (
    <div className="w-64 shrink-0 rounded-lg bg-muted/60 p-2">
      <div className="flex items-center justify-between px-2 py-1.5">
        <span className="text-sm font-medium">{meta?.label ?? status}</span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {data?.items.length ?? "…"}
        </span>
      </div>
      <div className="space-y-2">
        {isLoading ? (
          <>
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </>
        ) : data?.items.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">暂无达人</p>
        ) : (
          data?.items.map((creator) => <CreatorCard key={creator.id} creator={creator} />)
        )}
      </div>
    </div>
  );
}

function CreatorCard({ creator }: { creator: CreatorListItemDto }) {
  const transition = useTransitionCreatorStatus();
  const targets = CREATOR_RELATIONSHIP_STATUS.transitions[creator.relationship_status] ?? [];

  return (
    <div className="rounded-md border bg-card p-3 shadow-xs">
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/creators/${creator.id}`}
          className="min-w-0 font-medium text-sm hover:text-primary hover:underline"
        >
          {creator.display_name}
        </Link>
        {targets.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 px-1.5 text-xs">
                推进
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>转移到</DropdownMenuLabel>
              {targets.map((to) => (
                <DropdownMenuItem
                  key={to}
                  onClick={() => transition.mutate({ id: creator.id, to })}
                >
                  <StatusTag source={CREATOR_RELATIONSHIP_STATUS} value={to} />
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1">
        {creator.categories.slice(0, 2).map((c) => (
          <Badge key={c} variant="secondary" className="text-xs">
            {c}
          </Badge>
        ))}
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground tabular-nums">
        粉丝 {creator.total_followers >= 10_000 ? `${(creator.total_followers / 10_000).toFixed(1)} 万` : creator.total_followers}
        {creator.max_engagement_rate > 0 && ` · 互动 ${creator.max_engagement_rate.toFixed(1)}%`}
      </p>
    </div>
  );
}
