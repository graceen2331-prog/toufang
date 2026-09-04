"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AsyncBoundary, DetailSkeleton } from "@/components/shared/async-boundary";
import { PerformanceChart } from "@/features/analytics/components/performance-chart";
import type { MeDto } from "@/shared/schemas/auth";
import { ActionQueueCard } from "./action-queue-card";
import { CampaignHealthTable } from "./campaign-health-table";
import { DashboardHeader } from "./dashboard-header";
import { DashboardKpiGrid } from "./dashboard-kpi-grid";
import { useDashboardWorkspace } from "../use-dashboard-workspace";

export function DashboardWorkspace({
  me,
  isLoading,
  isError,
  error,
  onRetry,
}: {
  me: MeDto | undefined;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  onRetry: () => void;
}) {
  const workspace = useDashboardWorkspace(me);

  return (
    <AsyncBoundary
      isLoading={isLoading}
      isError={isError}
      error={error}
      onRetry={onRetry}
      isEmpty={!isLoading && !me?.org}
      emptyTitle="尚未加入组织"
      emptyHint="请联系管理员添加组织成员关系后再进入工作台"
      skeleton={<DetailSkeleton />}
    >
      <div className="mx-auto flex w-full max-w-[1560px] flex-col gap-5">
        <DashboardHeader
          userName={me?.user.name}
          orgName={me?.org?.name}
          title={workspace.preset.title}
          roleLabel={workspace.preset.roleLabel}
          description={workspace.preset.description}
          canCreateCampaign={workspace.canCreateCampaign}
        />
        <DashboardKpiGrid items={workspace.metrics} />
        <div
          className={
            workspace.analytics.enabled
              ? "grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.9fr)]"
              : "grid gap-4"
          }
        >
          {workspace.analytics.enabled && (
            <AsyncBoundary
              isLoading={workspace.analytics.isLoading}
              isError={workspace.analytics.isError}
              error={workspace.analytics.error}
              onRetry={() => void workspace.analytics.refetch()}
              isEmpty={!workspace.analytics.data}
              emptyTitle="暂无效果数据"
              emptyHint="录入平台指标后会展示近期效果趋势"
            >
              <PerformanceChart
                series={workspace.analytics.data?.series ?? []}
                title="近 14 天效果趋势"
                description="播放、互动与内容转化的日度走势"
                height={360}
                className="border-0 bg-card/95 shadow-[0_14px_40px_oklch(0.24_0.03_250_/_0.08)] ring-1 ring-foreground/8"
                action={
                  <Link
                    href="/analytics"
                    className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                  >
                    查看分析
                    <ArrowRight className="size-3.5" />
                  </Link>
                }
              />
            </AsyncBoundary>
          )}
          <ActionQueueCard items={workspace.actions} />
        </div>
        {workspace.campaigns.enabled && (
          <CampaignHealthTable
            campaigns={workspace.campaigns.data}
            isLoading={workspace.campaigns.isLoading}
            isError={workspace.campaigns.isError}
            error={workspace.campaigns.error}
            onRetry={() => void workspace.campaigns.refetch()}
          />
        )}
      </div>
    </AsyncBoundary>
  );
}
