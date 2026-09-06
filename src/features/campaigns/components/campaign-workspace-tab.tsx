"use client";

import Link from "next/link";
import {
  BarChart3,
  ClipboardCheck,
  ExternalLink,
  FileText,
  MessageSquare,
  ScrollText,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type WorkspaceKind = "outreach" | "content" | "contracts" | "analytics" | "reports";

interface WorkspaceConfig {
  title: string;
  description: string;
  href: (campaignId: string) => string;
  action: string;
  icon: LucideIcon;
  checkpoints: string[];
}

const WORKSPACES: Record<WorkspaceKind, WorkspaceConfig> = {
  outreach: {
    title: "Outreach",
    description: "达人触达、发送审批、回复记录与谈判分析集中在外联工作台。",
    href: (campaignId) => `/outreach?campaign_id=${encodeURIComponent(campaignId)}`,
    action: "打开外联工作台",
    icon: MessageSquare,
    checkpoints: ["外联草稿审批", "回复与跟进", "谈判分析"],
  },
  content: {
    title: "内容",
    description: "内容初稿、AI findings、人工复核与发布指标在内容审核页串联。",
    href: (campaignId) => `/content-review?campaign_id=${encodeURIComponent(campaignId)}`,
    action: "打开内容审核",
    icon: ClipboardCheck,
    checkpoints: ["内容提交", "AI 审核", "发布与首批指标"],
  },
  contracts: {
    title: "合同付款",
    description: "合同审批、签署状态、付款登记与付款审批统一在合同付款页处理。",
    href: (campaignId) => `/contracts?campaign_id=${encodeURIComponent(campaignId)}`,
    action: "打开合同付款",
    icon: ScrollText,
    checkpoints: ["合同审批", "签署确认", "付款登记"],
  },
  analytics: {
    title: "数据",
    description: "Campaign 指标、内容排名、AI 洞察与数据质量提示在数据分析页汇总。",
    href: (campaignId) => `/analytics?campaign_id=${encodeURIComponent(campaignId)}`,
    action: "打开数据分析",
    icon: BarChart3,
    checkpoints: ["KPI 汇总", "内容表现", "AI 洞察"],
  },
  reports: {
    title: "报告",
    description: "复盘草稿、正式审批与导出动作在报告页完成，并沉淀为知识资产。",
    href: (campaignId) => `/reports?campaign_id=${encodeURIComponent(campaignId)}`,
    action: "打开报告",
    icon: FileText,
    checkpoints: ["复盘草稿", "正式审批", "导出归档"],
  },
};

export function CampaignWorkspaceTab({
  campaignId,
  kind,
}: {
  campaignId: string;
  kind: WorkspaceKind;
}) {
  const config = WORKSPACES[kind];
  const Icon = config.icon;

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="size-4 text-primary" />
          {config.title}
        </CardTitle>
        <CardDescription>{config.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-3">
          {config.checkpoints.map((checkpoint) => (
            <div key={checkpoint} className="border bg-background p-3">
              <p className="text-sm font-medium">{checkpoint}</p>
            </div>
          ))}
        </div>
        <Button asChild>
          <Link href={config.href(campaignId)}>
            {config.action}
            <ExternalLink className="size-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
