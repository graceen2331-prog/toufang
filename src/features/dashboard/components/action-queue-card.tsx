"use client";

import Link from "next/link";
import { ArrowRight, FileText, Lightbulb, ShieldAlert, TriangleAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AnalyticsOverviewDto, ReportDto } from "@/shared/schemas/content-analytics";
import type { CampaignListItemDto } from "@/shared/schemas/campaign";

export function ActionQueueCard({
  overview,
  reports,
  campaigns,
}: {
  overview: AnalyticsOverviewDto | undefined;
  reports: ReportDto[];
  campaigns: CampaignListItemDto[];
}) {
  const openInsights = overview?.insights.length ?? 0;
  const dataNotes = overview?.data_quality_notes.length ?? 0;
  const reportsInReview = reports.filter((report) => report.status === "in_review").length;
  const atRiskCampaigns = campaigns.filter((campaign) => campaign.health_status === "at_risk" || campaign.health_status === "blocked").length;
  const actions = [
    {
      title: `${openInsights} 条 AI 洞察待跟进`,
      detail: overview?.insights[0]?.title ?? "暂无打开状态的 AI 洞察",
      href: "/analytics",
      icon: Lightbulb,
      active: openInsights > 0,
    },
    {
      title: `${reportsInReview} 份报告在审核中`,
      detail: reportsInReview > 0 ? "优先处理正式复盘产物" : "暂无报告审批积压",
      href: "/reports",
      icon: FileText,
      active: reportsInReview > 0,
    },
    {
      title: `${atRiskCampaigns} 个 Campaign 需要关注`,
      detail: atRiskCampaigns > 0 ? "预算、档期或内容阶段存在风险" : "当前 Campaign 健康度稳定",
      href: "/campaigns",
      icon: TriangleAlert,
      active: atRiskCampaigns > 0,
    },
    {
      title: `${dataNotes} 条数据质量提示`,
      detail: overview?.data_quality_notes[0] ?? "指标数据完整度正常",
      href: "/analytics",
      icon: ShieldAlert,
      active: dataNotes > 0,
    },
  ];

  return (
    <Card className="rounded-lg border-primary/20 bg-primary/5 py-0 shadow-[0_14px_40px_oklch(0.24_0.03_250_/_0.07)]">
      <CardHeader className="border-b border-primary/15 px-5 py-4">
        <CardTitle className="text-base font-semibold text-primary">AI 建议与下一步行动</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-5">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.title}
              href={action.href}
              className="group flex items-start gap-3 rounded-lg border border-transparent px-2 py-2 transition-colors hover:border-primary/15 hover:bg-card/70"
            >
              <span className={action.active ? "mt-0.5 text-primary" : "mt-0.5 text-muted-foreground"}>
                <Icon className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{action.title}</span>
                <span className="mt-0.5 line-clamp-2 block text-xs leading-5 text-muted-foreground">{action.detail}</span>
              </span>
              <ArrowRight className="mt-0.5 size-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
            </Link>
          );
        })}
      </CardContent>
    </Card>
  );
}
