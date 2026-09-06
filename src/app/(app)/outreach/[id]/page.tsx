"use client";

import { use, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Bot, MessageCircle, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AsyncBoundary, DetailSkeleton } from "@/components/shared/async-boundary";
import { MetricCard } from "@/components/shared/metric-card";
import { PageHeader } from "@/components/shared/page-header";
import { PermissionGate } from "@/components/shared/permission-gate";
import { StatusTag } from "@/components/shared/status-tag";
import { MessageCard } from "@/features/outreach/components/message-card";
import { NegotiationCard } from "@/features/outreach/components/negotiation-card";
import {
  AnalyzeDialog,
  DraftDialog,
  MessageDialog,
} from "@/features/outreach/components/thread-dialogs";
import { THREAD_STATUS } from "@/features/outreach/constants";
import { useOutreachThread } from "@/features/outreach/queries";
import type { OutreachMessageDto } from "@/shared/schemas/outreach";

export default function OutreachDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data, isLoading, isError, error, refetch } = useOutreachThread(id);
  const [draftOpen, setDraftOpen] = useState(false);
  const [messageOpen, setMessageOpen] = useState(false);
  const [analyzeOpen, setAnalyzeOpen] = useState(false);
  const [replyMessage, setReplyMessage] = useState<OutreachMessageDto | null>(null);

  const latestInbound = useMemo(
    () => data?.messages.filter((m) => m.direction === "inbound").at(-1) ?? null,
    [data?.messages],
  );

  return (
    <AsyncBoundary
      isLoading={isLoading}
      isError={isError}
      error={error}
      onRetry={() => refetch()}
      skeleton={<DetailSkeleton />}
    >
      {data && (
        <div className="space-y-6">
          <PageHeader
            title={
              <span className="flex flex-wrap items-center gap-3">
                {data.creator_name}
                <StatusTag source={THREAD_STATUS} value={data.status} />
              </span>
            }
            description={`${data.campaign_name} · ${data.channel === "email" ? "邮件" : "手动私信"}`}
            actions={
              <>
                <Button variant="outline" onClick={() => router.push("/outreach")}>
                  返回列表
                </Button>
                <PermissionGate permission="ai:run">
                  <Button variant="outline" onClick={() => setDraftOpen(true)}>
                    <Bot className="size-4" />
                    AI 起草
                  </Button>
                </PermissionGate>
                <PermissionGate permission="outreach:write">
                  <Button onClick={() => setMessageOpen(true)}>
                    <Plus className="size-4" />
                    记录消息
                  </Button>
                </PermissionGate>
              </>
            }
          />

          <div className="grid gap-4 md:grid-cols-4">
            <MetricCard label="消息数" value={data.messages.length} />
            <MetricCard label="谈判记录" value={data.negotiations.length} />
            <MetricCard label="达人状态" value={data.campaign_creator_status} />
            <MetricCard label="最近沟通" value={data.last_message_at ? format(new Date(data.last_message_at), "MM-dd HH:mm") : "—"} />
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-base font-semibold">消息时间线</h2>
                {latestInbound && (
                  <PermissionGate permission="ai:run">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setReplyMessage(latestInbound);
                        setAnalyzeOpen(true);
                      }}
                    >
                      <MessageCircle className="size-4" />
                      分析最新回复
                    </Button>
                  </PermissionGate>
                )}
              </div>
              {data.messages.length === 0 ? (
                <Card>
                  <CardContent className="py-10 text-center text-sm text-muted-foreground">
                    暂无消息，先生成外联草稿或手动记录一次沟通。
                  </CardContent>
                </Card>
              ) : (
                data.messages.map((message) => (
                  <MessageCard
                    key={message.id}
                    threadId={data.id}
                    message={message}
                    onAnalyze={(m) => {
                      setReplyMessage(m);
                      setAnalyzeOpen(true);
                    }}
                  />
                ))
              )}
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-semibold">谈判分析</h2>
              {data.negotiations.length === 0 ? (
                <Card>
                  <CardContent className="py-10 text-center text-sm text-muted-foreground">
                    记录达人回复后，可让 AI 生成报价分析和回复策略。
                  </CardContent>
                </Card>
              ) : (
                data.negotiations.map((negotiation) => (
                  <NegotiationCard
                    key={negotiation.id}
                    threadId={data.id}
                    negotiation={negotiation}
                  />
                ))
              )}
            </section>
          </div>

          <DraftDialog threadId={data.id} open={draftOpen} onOpenChange={setDraftOpen} />
          <MessageDialog threadId={data.id} open={messageOpen} onOpenChange={setMessageOpen} />
          <AnalyzeDialog
            thread={data}
            replyMessage={replyMessage}
            open={analyzeOpen}
            onOpenChange={(open) => {
              setAnalyzeOpen(open);
              if (!open) setReplyMessage(null);
            }}
          />
        </div>
      )}
    </AsyncBoundary>
  );
}
