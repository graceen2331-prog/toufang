"use client";

import { AlertCircle, CheckCircle2, ListChecks, Loader2, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ApprovalCard } from "@/features/approvals/components/approval-card";
import { useApprovals } from "@/features/approvals/queries";
import {
  getStageDecision,
  STAGE_LABELS,
} from "@/features/campaigns/components/campaign-stage-decisions";
import { nextStage } from "@/features/campaigns/components/campaign-stage-flow";

const STAGE_GUIDES: Record<string, string[]> = {
  draft: ["补齐基础信息与预算", "确认策略草案", "准备进入策略制定"],
  strategy: ["审批策略草案", "确认平台预算与达人组合", "推进到市场研究"],
  research: ["完成市场和竞品研究", "沉淀关键风险与内容机会", "推进到达人发现"],
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
  completed: ["Campaign 已完成", "沉淀复盘结论", "归档审计与知识"],
};

export function CampaignActionRail({
  campaignId,
  campaignStatus,
}: {
  campaignId: string;
  campaignStatus: string;
}) {
  const approvals = useApprovals({
    status: "pending",
    campaign_id: campaignId,
    limit: 8,
    refetchIntervalMs: 5_000,
  });
  const items = approvals.data?.items ?? [];
  const decision = getStageDecision(campaignStatus);
  const next = nextStage(campaignStatus);
  const guides = STAGE_GUIDES[campaignStatus] ?? ["确认当前阶段产物", "再推进到下一阶段"];

  return (
    <aside className="space-y-4 xl:sticky xl:top-20 xl:self-start">
      <Card className="border-primary/20 bg-primary/[0.03]">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ListChecks className="size-4 text-primary" />
            当前 Campaign 待办
            {items.length > 0 && (
              <Badge variant="secondary" className="ml-auto">
                {items.length}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {approvals.isLoading && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              正在加载待办…
            </p>
          )}

          {approvals.isError && (
            <div className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm">
              <p className="text-destructive">
                {approvals.error instanceof Error ? approvals.error.message : "待办加载失败"}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => void approvals.refetch()}
              >
                <RefreshCw className="size-3.5" />
                重试
              </Button>
            </div>
          )}

          {!approvals.isLoading && !approvals.isError && items.length === 0 && (
            <div className="rounded-md border border-dashed bg-background/70 p-4 text-sm text-muted-foreground">
              当前 Campaign 暂无待处理事项
            </div>
          )}

          {!approvals.isLoading && !approvals.isError && items.length > 0 && (
            <div className="space-y-3">
              {items.map((checkpoint) => (
                <ApprovalCard key={checkpoint.id} checkpoint={checkpoint} density="compact" />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertCircle className="size-4 text-primary" />
            下一步
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">当前阶段</p>
            <p className="mt-1 font-medium">{STAGE_LABELS[campaignStatus] ?? campaignStatus}</p>
          </div>
          {next && (
            <div>
              <p className="text-xs text-muted-foreground">建议推进</p>
              <p className="mt-1 font-medium text-primary">推进到「{STAGE_LABELS[next]}」</p>
            </div>
          )}
          <div className="rounded-md border bg-muted/20 p-3">
            <p className="text-xs text-muted-foreground">审批门</p>
            <p className="mt-1 leading-relaxed">{decision.approvalGate}</p>
          </div>
          <ul className="space-y-2 text-muted-foreground">
            {guides.map((guide) => (
              <li key={guide} className="flex gap-2">
                <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-primary" />
                <span>{guide}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </aside>
  );
}
