"use client";

import Link from "next/link";
import { CalendarDays, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PermissionGate } from "@/components/shared/permission-gate";

function todayText(): string {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(new Date());
}

export function DashboardHeader({
  userName,
  orgName,
  activeCampaigns,
  openInsights,
}: {
  userName: string | undefined;
  orgName: string | undefined;
  activeCampaigns: number;
  openInsights: number;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-primary/15 bg-[linear-gradient(135deg,color-mix(in_oklch,var(--primary),white_90%),var(--card)_48%,color-mix(in_oklch,var(--warning),white_88%))] px-5 py-5 shadow-[0_18px_50px_oklch(0.22_0.04_165_/_0.08)]">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <div className="mb-3 inline-flex items-center gap-2 rounded-md border border-primary/15 bg-card/75 px-2.5 py-1 text-xs font-medium text-primary shadow-sm">
            <Sparkles className="size-3.5" />
            KOL Marketing OS
          </div>
          <h1 className="text-3xl font-semibold leading-tight text-balance md:text-4xl">工作台</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            {userName ? `${userName}，${orgName ?? "当前组织"} 今天有 ${activeCampaigns} 个 Campaign 在推进。` : "正在同步组织运营状态。"}
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="grid grid-cols-2 gap-3 sm:min-w-72">
            <div className="rounded-lg border border-foreground/10 bg-card/80 px-3 py-2.5 shadow-sm">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <CalendarDays className="size-3.5" />
                今日
              </div>
              <div className="mt-1 text-sm font-semibold">{todayText()}</div>
            </div>
            <div className="rounded-lg border border-primary/15 bg-primary/10 px-3 py-2.5 shadow-sm">
              <div className="text-xs text-primary/80">打开洞察</div>
              <div className="mt-1 text-sm font-semibold tabular-nums text-primary">{openInsights} 条</div>
            </div>
          </div>
          <PermissionGate permission="campaign:write">
            <Button asChild size="lg" className="h-10 rounded-md px-3.5">
              <Link href="/campaigns/new">
                <Plus className="size-4" />
                新建 Campaign
              </Link>
            </Button>
          </PermissionGate>
        </div>
      </div>
    </section>
  );
}
