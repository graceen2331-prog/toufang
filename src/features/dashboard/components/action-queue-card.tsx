"use client";

import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  FileCheck2,
  FileText,
  Lightbulb,
  Megaphone,
  MessageSquareText,
  Plus,
  ScanText,
  ShieldCheck,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { DashboardActionItem } from "@/features/dashboard/use-dashboard-workspace";
import type { DashboardActionKey } from "@/features/dashboard/workspace-config";

const ICONS: Record<DashboardActionKey, typeof Lightbulb> = {
  new_campaign: Plus,
  campaign_risk: Megaphone,
  analytics: BarChart3,
  reports: FileText,
  approvals: ShieldCheck,
  outreach: MessageSquareText,
  content: ScanText,
  contracts: FileCheck2,
};

export function ActionQueueCard({ items }: { items: DashboardActionItem[] }) {
  return (
    <Card className="rounded-lg border-primary/20 bg-primary/5 py-0 shadow-[0_14px_40px_oklch(0.24_0.03_250_/_0.07)]">
      <CardHeader className="border-b border-primary/15 px-5 py-4">
        <CardTitle className="text-base font-semibold text-primary">我的下一步行动</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-5">
        {items.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">当前角色没有待处理入口</p>
        ) : (
          items.map((item) => {
            const Icon = ICONS[item.key];
            if (item.state === "loading") {
              return <Skeleton key={item.key} className="h-14 w-full" />;
            }
            return (
              <Link
                key={item.key}
                href={item.href}
                className="group flex items-start gap-3 rounded-lg border border-transparent px-2 py-2 transition-colors hover:border-primary/15 hover:bg-card/70 active:translate-y-px"
              >
                <span
                  className={
                    item.state === "error"
                      ? "mt-0.5 text-destructive"
                      : item.active
                        ? "mt-0.5 text-primary"
                        : "mt-0.5 text-muted-foreground"
                  }
                >
                  <Icon className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">
                    {item.state === "error" ? "数据暂时不可用" : item.title}
                  </span>
                  <span className="mt-0.5 line-clamp-2 block text-xs leading-5 text-muted-foreground">
                    {item.state === "error"
                      ? "打开对应页面重试，不影响其他工作区数据"
                      : item.detail}
                  </span>
                </span>
                <ArrowRight className="mt-0.5 size-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
              </Link>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
