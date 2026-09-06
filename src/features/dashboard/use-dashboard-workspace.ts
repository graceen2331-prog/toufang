"use client";

import type { QueryObserverResult } from "@tanstack/react-query";
import { formatCents } from "@/lib/format";
import type { MeDto } from "@/shared/schemas/auth";
import type { CampaignListItemDto } from "@/shared/schemas/campaign";
import { useDashboardQueries } from "./queries";
import { dashboardCan, type DashboardActionKey, type DashboardResource } from "./workspace-config";

export type DashboardMetricIcon =
  | "campaign"
  | "impressions"
  | "engagement"
  | "conversion"
  | "budget"
  | "approval"
  | "outreach"
  | "content"
  | "contract"
  | "report";

export interface DashboardMetricItem {
  key: string;
  label: string;
  value: string | null;
  hint: string;
  icon: DashboardMetricIcon;
  accent: "primary" | "violet" | "amber" | "slate";
  state: "loading" | "error" | "ready";
}

export interface DashboardActionItem {
  key: DashboardActionKey;
  title: string;
  detail: string;
  href: string;
  active: boolean;
  state: "loading" | "error" | "ready";
}

interface DashboardCommonMetrics {
  campaignActive: DashboardMetricItem;
  campaignRisk: DashboardMetricItem;
  impressions: DashboardMetricItem;
  engagement: DashboardMetricItem;
  conversions: DashboardMetricItem;
  budget: DashboardMetricItem;
  approvals: DashboardMetricItem;
  reports: DashboardMetricItem;
  outreach: DashboardMetricItem;
  negotiations: DashboardMetricItem;
  contentReview: DashboardMetricItem;
  contentRevision: DashboardMetricItem;
  contracts: DashboardMetricItem;
  unpaid: DashboardMetricItem;
}

const METRIC_RESOURCES: Record<string, DashboardResource> = {
  "campaign-active": "campaigns",
  "campaign-risk": "campaigns",
  impressions: "analytics",
  engagement: "analytics",
  conversions: "analytics",
  budget: "campaigns",
  approvals: "approvals",
  reports: "reports",
  outreach: "outreach",
  negotiations: "outreach",
  "content-review": "content",
  "content-revision": "content",
  contracts: "contracts",
  unpaid: "contracts",
};

type QueryStateLike = Pick<QueryObserverResult<unknown>, "isLoading" | "isError">;

function displayState(query: QueryStateLike): DashboardMetricItem["state"] {
  if (query.isLoading) return "loading";
  if (query.isError) return "error";
  return "ready";
}

function countText(value: number): string {
  return value.toLocaleString("zh-CN");
}

function percentText(value: number | null | undefined): string {
  return value === null || value === undefined ? "缺数据" : `${(value * 100).toFixed(1)}%`;
}

function metric(
  key: string,
  label: string,
  value: string,
  hint: string,
  icon: DashboardMetricIcon,
  accent: DashboardMetricItem["accent"],
  query: QueryStateLike,
): DashboardMetricItem {
  const state = displayState(query);
  return { key, label, value: state === "ready" ? value : null, hint, icon, accent, state };
}

function campaignSummary(campaigns: CampaignListItemDto[]) {
  const terminal = new Set(["completed", "cancelled", "archived"]);
  return {
    active: campaigns.filter((campaign) => !terminal.has(campaign.status)).length,
    atRisk: campaigns.filter((campaign) => ["at_risk", "blocked"].includes(campaign.health_status))
      .length,
    budget: campaigns.reduce((sum, campaign) => sum + campaign.budget_total_cents, 0),
  };
}

export function useDashboardWorkspace(me: MeDto | undefined) {
  const identity = me?.org
    ? {
        orgId: me.org.id,
        userId: me.user.id,
        roleKey: me.role_key,
        permissions: me.permissions,
      }
    : null;
  const queries = useDashboardQueries(identity);
  const campaigns = queries.campaigns.data?.items ?? [];
  const campaignStats = campaignSummary(campaigns);
  const analytics = queries.analytics.data;
  const reports = queries.reports.data?.items ?? [];
  const approvals = queries.approvals.data?.items ?? [];
  const outreach = queries.outreach.data?.items ?? [];
  const content = queries.content.data?.items ?? [];
  const contracts = queries.contracts.data?.items ?? [];
  const roleKey = me?.role_key ?? "unknown";

  const common: DashboardCommonMetrics = {
    campaignActive: metric(
      "campaign-active",
      "近期活跃 Campaign",
      countText(campaignStats.active),
      "最近加载的 20 个 Campaign",
      "campaign" as const,
      "primary" as const,
      queries.campaigns,
    ),
    campaignRisk: metric(
      "campaign-risk",
      "近期风险 Campaign",
      countText(campaignStats.atRisk),
      "最近加载列表中的风险项",
      "campaign" as const,
      "amber" as const,
      queries.campaigns,
    ),
    impressions: metric(
      "impressions",
      "总曝光",
      countText(analytics?.totals.impressions ?? 0),
      analytics?.kpi_details.impressions.reason ?? "当前授权数据范围",
      "impressions" as const,
      "primary" as const,
      queries.analytics,
    ),
    engagement: metric(
      "engagement",
      "互动率",
      percentText(analytics?.kpis.engagement_rate),
      analytics?.kpi_details.engagement_rate.reason ?? "按有效曝光口径计算",
      "engagement" as const,
      "violet" as const,
      queries.analytics,
    ),
    conversions: metric(
      "conversions",
      "转化",
      countText(analytics?.totals.conversions ?? 0),
      `CVR ${percentText(analytics?.kpis.conversion_rate)}`,
      "conversion" as const,
      "amber" as const,
      queries.analytics,
    ),
    budget: metric(
      "budget",
      "近期预算池",
      formatCents(campaignStats.budget),
      "最近加载的 20 个 Campaign",
      "budget" as const,
      "slate" as const,
      queries.campaigns,
    ),
    approvals: metric(
      "approvals",
      "待审批事项",
      countText(approvals.length),
      "最多展示最近 20 项",
      "approval" as const,
      "amber" as const,
      queries.approvals,
    ),
    reports: metric(
      "reports",
      "审核中报告",
      countText(reports.length),
      "最多展示最近 20 份",
      "report" as const,
      "slate" as const,
      queries.reports,
    ),
    outreach: metric(
      "outreach",
      "待推进会话",
      countText(
        outreach.filter((item) => !["closed_won", "closed_lost"].includes(item.status)).length,
      ),
      "最近加载的 20 条会话",
      "outreach" as const,
      "primary" as const,
      queries.outreach,
    ),
    negotiations: metric(
      "negotiations",
      "谈判中",
      countText(outreach.filter((item) => item.status === "negotiating").length),
      "需要确认价格或合作条款",
      "outreach" as const,
      "violet" as const,
      queries.outreach,
    ),
    contentReview: metric(
      "content-review",
      "待审内容",
      countText(content.filter((item) => ["submitted", "in_review"].includes(item.status)).length),
      "最近加载的 20 条内容",
      "content" as const,
      "primary" as const,
      queries.content,
    ),
    contentRevision: metric(
      "content-revision",
      "待修改内容",
      countText(content.filter((item) => item.status === "revision_requested").length),
      "根据审核意见完成修改",
      "content" as const,
      "amber" as const,
      queries.content,
    ),
    contracts: metric(
      "contracts",
      "履约中合同",
      countText(contracts.filter((item) => ["signed", "active"].includes(item.status)).length),
      "最近加载的 20 份合同",
      "contract" as const,
      "primary" as const,
      queries.contracts,
    ),
    unpaid: metric(
      "unpaid",
      "近期待付金额",
      formatCents(
        contracts.reduce(
          (sum, item) => sum + Math.max(0, item.payment_total_cents - item.payment_paid_cents),
          0,
        ),
      ),
      "最近加载合同的未付部分",
      "budget" as const,
      "amber" as const,
      queries.contracts,
    ),
  };

  const metricsByRole: Record<string, DashboardMetricItem[]> = {
    admin: [
      common.impressions,
      common.engagement,
      common.campaignActive,
      common.campaignRisk,
      common.approvals,
    ],
    director: [
      common.impressions,
      common.engagement,
      common.campaignActive,
      common.campaignRisk,
      common.approvals,
    ],
    manager: [
      common.campaignActive,
      common.campaignRisk,
      common.budget,
      common.approvals,
      common.reports,
    ],
    kol_manager: [common.outreach, common.negotiations, common.campaignActive, common.contracts],
    content_manager: [
      common.contentReview,
      common.contentRevision,
      common.approvals,
      common.conversions,
    ],
    finance: [common.contracts, common.unpaid, common.approvals, common.reports],
    viewer: [
      common.impressions,
      common.engagement,
      common.conversions,
      common.campaignActive,
      common.reports,
    ],
  };

  const actionData: Record<DashboardActionKey, Omit<DashboardActionItem, "href">> = {
    new_campaign: {
      key: "new_campaign",
      title: "创建新的 Campaign",
      detail: "从目标、预算和市场范围开始搭建执行计划",
      active: true,
      state: "ready",
    },
    campaign_risk: {
      key: "campaign_risk",
      title: `${campaignStats.atRisk} 个近期 Campaign 需要关注`,
      detail: campaignStats.atRisk
        ? "预算、档期或内容阶段存在风险"
        : "最近加载的 Campaign 状态稳定",
      active: campaignStats.atRisk > 0,
      state: displayState(queries.campaigns),
    },
    analytics: {
      key: "analytics",
      title: `${analytics?.insights.length ?? 0} 条 AI 洞察待跟进`,
      detail: analytics?.insights[0]?.title ?? "暂无打开状态的 AI 洞察",
      active: (analytics?.insights.length ?? 0) > 0,
      state: displayState(queries.analytics),
    },
    reports: {
      key: "reports",
      title: `${reports.length} 份报告在审核中`,
      detail: reports.length ? "优先处理正式复盘产物" : "暂无报告审批积压",
      active: reports.length > 0,
      state: displayState(queries.reports),
    },
    approvals: {
      key: "approvals",
      title: `${approvals.length} 个待审批事项`,
      detail: approvals.some((item) => item.is_overdue)
        ? "存在已逾期审批，请优先处理"
        : "关键操作均经过人工确认",
      active: approvals.length > 0,
      state: displayState(queries.approvals),
    },
    outreach: {
      key: "outreach",
      title: `${outreach.filter((item) => !["closed_won", "closed_lost"].includes(item.status)).length} 条会话待推进`,
      detail: outreach.some((item) => item.status === "replied")
        ? "已有达人回复等待跟进"
        : "查看最近的触达和谈判进度",
      active: outreach.length > 0,
      state: displayState(queries.outreach),
    },
    content: {
      key: "content",
      title: `${content.filter((item) => ["submitted", "in_review"].includes(item.status)).length} 条内容待审核`,
      detail: content.some((item) => item.status === "revision_requested")
        ? "另有内容等待按意见修改"
        : "发布前审核证据状态正常",
      active: content.length > 0,
      state: displayState(queries.content),
    },
    contracts: {
      key: "contracts",
      title: `${contracts.filter((item) => ["draft", "in_review", "signed", "active"].includes(item.status)).length} 份合同待推进`,
      detail: "查看签署、付款和对账节点",
      active: contracts.length > 0,
      state: displayState(queries.contracts),
    },
  };

  return {
    identity,
    preset: queries.preset,
    canCreateCampaign: dashboardCan(me?.permissions ?? [], "campaign:write"),
    metrics: (
      metricsByRole[roleKey] ?? metricsForUnknownRole(common, queries.preset.resources)
    ).filter((item) => {
      const resource = METRIC_RESOURCES[item.key];
      return resource ? queries.preset.resources.includes(resource) : false;
    }),
    actions: queries.preset.actions.map((preset) => ({
      ...actionData[preset.key],
      href: preset.href,
    })),
    analytics: {
      enabled: queries.preset.resources.includes("analytics"),
      data: queries.analytics.data,
      isLoading: queries.analytics.isLoading,
      isError: queries.analytics.isError,
      error: queries.analytics.error,
      refetch: queries.analytics.refetch,
    },
    campaigns: {
      enabled: queries.preset.resources.includes("campaigns"),
      data: campaigns,
      isLoading: queries.campaigns.isLoading,
      isError: queries.campaigns.isError,
      error: queries.campaigns.error,
      refetch: queries.campaigns.refetch,
    },
  };
}

function metricsForUnknownRole(
  common: DashboardCommonMetrics,
  resources: string[],
): DashboardMetricItem[] {
  const metrics: DashboardMetricItem[] = [];
  if (resources.includes("campaigns")) metrics.push(common.campaignActive, common.campaignRisk);
  if (resources.includes("analytics")) metrics.push(common.impressions, common.engagement);
  if (resources.includes("approvals")) metrics.push(common.approvals);
  if (resources.includes("outreach")) metrics.push(common.outreach);
  if (resources.includes("content")) metrics.push(common.contentReview);
  if (resources.includes("contracts")) metrics.push(common.contracts);
  if (resources.includes("reports")) metrics.push(common.reports);
  return metrics.slice(0, 5);
}
