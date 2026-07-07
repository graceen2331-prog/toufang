"use client";

import { useRouter } from "next/navigation";
import { Loader2, MessageSquarePlus, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PermissionGate } from "@/components/shared/permission-gate";
import { StatusTag } from "@/components/shared/status-tag";
import { useCreateOutreachThread, useOutreachCandidates } from "@/features/outreach/queries";
import { formatCents } from "@/lib/format";
import { CAMPAIGN_CREATOR_STATUS } from "@/shared/constants/status";
import type { OutreachCandidateDto } from "@/shared/schemas/outreach";

const ROLE_LABELS: Record<string, string> = {
  hero: "主推",
  amplifier: "放大",
  seeder: "种草",
};

function candidatePrice(candidate: OutreachCandidateDto): string | null {
  const cents = candidate.agreed_price_cents ?? candidate.quoted_price_cents;
  return cents === null ? null : formatCents(cents);
}

export function CampaignOutreachCandidates({ campaignId }: { campaignId: string }) {
  const router = useRouter();
  const candidates = useOutreachCandidates(campaignId);
  const createThread = useCreateOutreachThread();
  const items = candidates.data ?? [];

  if (!campaignId) return null;

  return (
    <section className="space-y-3 border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-medium">当前 Campaign 可外联达人</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            已按 Campaign 自动筛选，可直接开始外联或打开已有会话。
          </p>
        </div>
        {items.length > 0 && <Badge variant="secondary">{items.length} 位</Badge>}
      </div>

      {candidates.isLoading && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          正在加载可外联达人…
        </p>
      )}

      {candidates.isError && (
        <div className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm">
          <p className="text-destructive">
            {candidates.error instanceof Error ? candidates.error.message : "可外联达人加载失败"}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => void candidates.refetch()}
          >
            <RefreshCw className="size-3.5" />
            重试
          </Button>
        </div>
      )}

      {!candidates.isLoading && !candidates.isError && items.length === 0 && (
        <div className="rounded-md border border-dashed bg-background p-4 text-sm text-muted-foreground">
          当前 Campaign 暂无达人。请先在达人 Pipeline 中添加或发现达人。
        </div>
      )}

      {!candidates.isLoading && !candidates.isError && items.length > 0 && (
        <div className="divide-y rounded-md border bg-background">
          {items.map((candidate) => {
            const price = candidatePrice(candidate);
            return (
              <div
                key={candidate.campaign_creator_id}
                className="flex flex-wrap items-center gap-3 px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{candidate.creator_name}</span>
                    <StatusTag source={CAMPAIGN_CREATOR_STATUS} value={candidate.status} />
                    {candidate.role && (
                      <Badge variant="outline">{ROLE_LABELS[candidate.role] ?? candidate.role}</Badge>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {candidate.existing_thread_id
                      ? `已有外联会话${candidate.existing_thread_subject ? `：${candidate.existing_thread_subject}` : ""}`
                      : candidate.can_create_thread
                        ? "尚未创建外联会话"
                        : (candidate.blocked_reason ?? "暂不可外联")}
                    {price ? ` · 预算 ${price}` : ""}
                  </p>
                </div>
                {candidate.existing_thread_id ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/outreach/${candidate.existing_thread_id}`)}
                  >
                    打开会话
                  </Button>
                ) : candidate.can_create_thread ? (
                  <PermissionGate permission="outreach:write">
                    <Button
                      size="sm"
                      disabled={createThread.isPending}
                      onClick={() =>
                        createThread.mutate(
                          {
                            campaign_creator_id: candidate.campaign_creator_id,
                            channel: "email",
                            subject: null,
                          },
                          { onSuccess: (thread) => router.push(`/outreach/${thread.id}`) },
                        )
                      }
                    >
                      <MessageSquarePlus className="size-4" />
                      {createThread.isPending ? "创建中…" : "开始外联"}
                    </Button>
                  </PermissionGate>
                ) : (
                  <Button variant="outline" size="sm" disabled>
                    需先推进
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
