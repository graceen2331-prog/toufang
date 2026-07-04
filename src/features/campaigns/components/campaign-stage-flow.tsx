"use client";

import { useMemo, useState } from "react";
import { ArrowRight, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { PermissionGate } from "@/components/shared/permission-gate";
import { StatusTag } from "@/components/shared/status-tag";
import { useTransitionCampaignStatus } from "@/features/campaigns/queries";
import {
  CAMPAIGN_PIPELINE,
  CAMPAIGN_STATUS,
  statusMeta,
  type StatusTone,
} from "@/shared/constants/status";
import { cn } from "@/lib/utils";

const STAGE_LABELS: Record<string, string> = {
  draft: "草稿",
  strategy: "策略",
  research: "研究",
  creator_discovery: "达人发现",
  shortlisting: "筛选",
  brief_creation: "Brief",
  outreach: "触达",
  negotiation: "谈判",
  contracting: "签约",
  content_creation: "内容制作",
  content_review: "内容审核",
  publishing: "发布",
  metrics_collection: "数据回收",
  reporting: "复盘",
  completed: "已完成",
};

const TONE_DOT_CLASSES: Record<StatusTone, string> = {
  neutral: "bg-muted-foreground",
  info: "bg-info",
  progress: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-destructive",
};

function nextStage(currentStatus: string): string | null {
  const index = CAMPAIGN_PIPELINE.indexOf(currentStatus as (typeof CAMPAIGN_PIPELINE)[number]);
  if (index < 0 || index >= CAMPAIGN_PIPELINE.length - 1) return null;
  return CAMPAIGN_PIPELINE[index + 1]!;
}

function previousStage(currentStatus: string): string | null {
  const index = CAMPAIGN_PIPELINE.indexOf(currentStatus as (typeof CAMPAIGN_PIPELINE)[number]);
  if (index <= 0) return null;
  return CAMPAIGN_PIPELINE[index - 1]!;
}

function secondaryTargets(currentStatus: string): string[] {
  const targets = CAMPAIGN_STATUS.transitions[currentStatus] ?? [];
  const previous = previousStage(currentStatus);
  return targets.filter(
    (target) => target === previous || target === "cancelled" || target === "archived",
  );
}

export function CampaignStageFlow({
  campaignId,
  currentStatus,
}: {
  campaignId: string;
  currentStatus: string;
}) {
  const transition = useTransitionCampaignStatus();
  const [pendingTo, setPendingTo] = useState<string | null>(null);
  const currentIndex = CAMPAIGN_PIPELINE.indexOf(
    currentStatus as (typeof CAMPAIGN_PIPELINE)[number],
  );
  const next = nextStage(currentStatus);
  const secondary = useMemo(() => secondaryTargets(currentStatus), [currentStatus]);
  const currentMeta = statusMeta(CAMPAIGN_STATUS, currentStatus);

  return (
    <section className="border bg-card p-4 shadow-[0_14px_36px_rgba(8,28,20,0.07)]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <StatusTag source={CAMPAIGN_STATUS} value={currentStatus} />
          <span className="text-sm text-muted-foreground">当前阶段</span>
        </div>
        <PermissionGate permission="campaign:status">
          <div className="flex items-center gap-2">
            {next && (
              <Button disabled={transition.isPending} onClick={() => setPendingTo(next)}>
                推进到「{STAGE_LABELS[next]}」
                <ArrowRight className="size-4" />
              </Button>
            )}
            {secondary.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    disabled={transition.isPending}
                    aria-label="更多状态操作"
                  >
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>其他状态操作</DropdownMenuLabel>
                  {secondary.map((target) => (
                    <DropdownMenuItem key={target} onClick={() => setPendingTo(target)}>
                      <StatusTag source={CAMPAIGN_STATUS} value={target} />
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </PermissionGate>
      </div>

      <div className="overflow-x-auto pb-1">
        <ol className="grid min-w-[1200px] grid-cols-[repeat(15,minmax(0,1fr))] items-start gap-0 px-10">
          {CAMPAIGN_PIPELINE.map((stage, index) => {
            const isDone = currentIndex > index || currentStatus === "completed";
            const isCurrent = currentStatus === stage;
            const isFuture = currentIndex >= 0 && currentIndex < index;
            const meta = statusMeta(CAMPAIGN_STATUS, stage);
            return (
              <li key={stage} className="relative flex flex-col items-center gap-2 text-center">
                {index > 0 && (
                  <span
                    className={cn(
                      "absolute top-[9px] right-1/2 h-0.5 w-full",
                      isDone || isCurrent ? "bg-primary" : "bg-border",
                    )}
                  />
                )}
                <span
                  className={cn(
                    "relative z-10 flex size-5 items-center justify-center rounded-full border-2 bg-card",
                    isCurrent
                      ? "border-primary shadow-[0_0_0_6px_rgba(0,120,88,0.12)]"
                      : isDone
                        ? "border-primary bg-primary"
                        : "border-border",
                  )}
                  aria-label={meta.label}
                >
                  <span
                    className={cn(
                      "size-2.5 rounded-full",
                      isCurrent
                        ? TONE_DOT_CLASSES[currentMeta.tone]
                        : isDone
                          ? "bg-primary-foreground"
                          : isFuture
                            ? "bg-muted"
                            : TONE_DOT_CLASSES[meta.tone],
                    )}
                  />
                </span>
                <span
                  className={cn(
                    "w-20 text-xs font-medium",
                    isCurrent
                      ? "text-primary"
                      : isFuture
                        ? "text-muted-foreground"
                        : "text-foreground",
                  )}
                >
                  {STAGE_LABELS[stage]}
                </span>
              </li>
            );
          })}
        </ol>
      </div>

      <ConfirmDialog
        open={pendingTo !== null}
        onOpenChange={(open) => !open && setPendingTo(null)}
        title="确认推进 Campaign 阶段？"
        description={
          pendingTo && (
            <span className="flex items-center gap-2">
              <StatusTag source={CAMPAIGN_STATUS} value={currentStatus} />
              <span>→</span>
              <StatusTag source={CAMPAIGN_STATUS} value={pendingTo} />
            </span>
          )
        }
        confirmLabel="确认推进"
        destructive={pendingTo === "cancelled" || pendingTo === "archived"}
        pending={transition.isPending}
        onConfirm={() => {
          if (!pendingTo) return;
          transition.mutate(
            { id: campaignId, to: pendingTo, reason: "页面阶段推进" },
            { onSuccess: () => setPendingTo(null) },
          );
        }}
      />
    </section>
  );
}

export { STAGE_LABELS, nextStage };
