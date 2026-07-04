"use client";

import type { ReactNode } from "react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusTimeline } from "@/components/shared/status-timeline";
import { StatusTag } from "@/components/shared/status-tag";
import { useCampaignEvents } from "@/features/campaigns/queries";
import { nextStage, STAGE_LABELS } from "@/features/campaigns/components/campaign-stage-flow";
import { CAMPAIGN_STATUS } from "@/shared/constants/status";
import { CAMPAIGN_OBJECTIVES, type CampaignDetailDto } from "@/shared/schemas/campaign";
import { PLATFORM_LABELS } from "@/shared/schemas/creator";

const GOAL_LABELS: Record<string, string> = {
  impressions: "曝光",
  engagement: "互动",
  clicks: "点击",
  conversions: "转化",
  roi: "ROI",
  notes: "备注",
};

const STAGE_GUIDES: Record<string, string[]> = {
  draft: ["补齐基础信息与预算", "生成或确认策略草案", "准备进入策略制定"],
  strategy: ["审批策略草案", "确认平台预算与达人组合", "推进到市场研究"],
  research: ["完成市场/竞品研究", "沉淀关键风险与内容机会", "推进到达人发现"],
  creator_discovery: ["运行达人发现", "确认候选池质量", "进入筛选与评分"],
  shortlisting: ["完成达人评分", "审批 shortlist", "把关键达人推进到已批准"],
  brief_creation: ["生成并编辑 Brief", "提交内容负责人确认", "准备进入触达"],
  outreach: ["发送外联草稿", "记录回复和档期", "有意向达人进入谈判"],
  negotiation: ["确认报价、授权和排期", "沉淀谈判结论", "推进签约"],
  contracting: ["登记合同与审批门", "确认付款节点", "推进内容制作"],
  content_creation: ["跟进达人交付物", "收集内容初稿", "提交内容审核"],
  content_review: ["处理 AI findings", "完成人工复核", "安排发布"],
  publishing: ["确认发布时间与链接", "记录发布状态", "进入数据回收"],
  metrics_collection: ["录入各平台指标", "检查 KPI 缺口", "生成复盘分析"],
  reporting: ["生成 Campaign 报告", "审批正式报告", "归档知识与复盘"],
  completed: ["Campaign 已完成", "复盘结论可沉淀到知识库"],
};

function formatCents(cents: number): string {
  return `¥${(cents / 100).toLocaleString("zh-CN")}`;
}

function platformLabel(platform: string): string {
  return PLATFORM_LABELS[platform as keyof typeof PLATFORM_LABELS] ?? platform;
}

function formatDate(date: string | null): string {
  return date ? format(new Date(date), "yyyy-MM-dd") : "待定";
}

function goalValue(value: number | string): string {
  return typeof value === "number" ? value.toLocaleString("zh-CN") : value;
}

export function CampaignOverviewTab({ campaign }: { campaign: CampaignDetailDto }) {
  const { data: events, isLoading } = useCampaignEvents(campaign.id);
  const goalEntries = Object.entries(campaign.goals).filter(
    ([, value]) => value !== null && value !== undefined && value !== "",
  );
  const budgetRatio =
    campaign.budget_total_cents > 0
      ? Math.min(100, (campaign.budget_used_cents / campaign.budget_total_cents) * 100)
      : 0;
  const next = nextStage(campaign.status);
  const guides = STAGE_GUIDES[campaign.status] ?? ["确认当前阶段产物", "再推进到下一阶段"];

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-4">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <CardTitle className="text-base">Campaign 概况</CardTitle>
            <StatusTag source={CAMPAIGN_STATUS} value={campaign.status} />
          </CardHeader>
          <CardContent className="space-y-5">
            <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
              <InfoRow label="品牌" value={campaign.brand_name} />
              <InfoRow label="产品" value={campaign.product_name ?? "—"} />
              <InfoRow
                label="目标"
                value={
                  campaign.objective
                    ? (CAMPAIGN_OBJECTIVES[
                        campaign.objective as keyof typeof CAMPAIGN_OBJECTIVES
                      ] ?? campaign.objective)
                    : "—"
                }
              />
              <InfoRow label="负责人" value={campaign.owner_name ?? "—"} />
              <InfoRow
                label="市场"
                value={campaign.markets.length ? campaign.markets.join("、") : "—"}
              />
              <InfoRow
                label="周期"
                value={`${formatDate(campaign.start_date)} → ${formatDate(campaign.end_date)}`}
              />
              <InfoRow
                label="平台"
                value={
                  campaign.platforms.length ? (
                    <span className="flex flex-wrap gap-1">
                      {campaign.platforms.map((platform) => (
                        <Badge key={platform} variant="outline">
                          {platformLabel(platform)}
                        </Badge>
                      ))}
                    </span>
                  ) : (
                    "—"
                  )
                }
              />
              <InfoRow
                label="KPI"
                value={
                  goalEntries.length ? (
                    <span className="flex flex-wrap gap-1.5">
                      {goalEntries.map(([key, value]) => (
                        <Badge key={key} variant="secondary">
                          {GOAL_LABELS[key] ?? key}: {goalValue(value)}
                        </Badge>
                      ))}
                    </span>
                  ) : (
                    "—"
                  )
                }
              />
            </dl>

            <div>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="text-muted-foreground">
                  预算：已占用 {formatCents(campaign.budget_used_cents)} / 总额{" "}
                  {formatCents(campaign.budget_total_cents)}
                </span>
                <span className="font-medium tabular-nums">{budgetRatio.toFixed(1)}%</span>
              </div>
              <div className="h-2 overflow-hidden bg-muted">
                <div className="h-full bg-primary" style={{ width: `${budgetRatio}%` }} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">状态历史</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">加载中…</p>
            ) : (
              <StatusTimeline events={events ?? []} source={CAMPAIGN_STATUS} />
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-primary/25 bg-primary/[0.03]">
        <CardHeader>
          <CardTitle className="text-base">阶段指引</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">当前阶段</p>
            <p className="mt-1 text-lg font-semibold">
              {STAGE_LABELS[campaign.status] ?? campaign.status}
            </p>
          </div>
          {next && (
            <div>
              <p className="text-xs text-muted-foreground">下一阶段</p>
              <p className="mt-1 font-medium text-primary">推进到「{STAGE_LABELS[next]}」</p>
            </div>
          )}
          <div className="border-t pt-4">
            <p className="font-medium">进入下一步前建议确认</p>
            <ul className="mt-3 space-y-3 text-muted-foreground">
              {guides.map((guide) => (
                <li key={guide} className="flex gap-2">
                  <span className="mt-1.5 size-1.5 shrink-0 bg-primary" />
                  <span>{guide}</span>
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-[5rem_minmax(0,1fr)] gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 font-medium">{value}</dd>
    </div>
  );
}
