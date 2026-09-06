"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Bot, MoreHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PermissionGate } from "@/components/shared/permission-gate";
import { StatusTag } from "@/components/shared/status-tag";
import { DIRECTION_LABELS } from "@/features/outreach/constants";
import { useTransitionOutreachMessage } from "@/features/outreach/queries";
import { APPROVAL_STATUS, OUTREACH_MESSAGE_STATUS } from "@/shared/constants/status";
import { REPLY_INTENT_LABELS, type OutreachMessageDto } from "@/shared/schemas/outreach";

export function MessageCard({
  threadId,
  message,
  onAnalyze,
}: {
  threadId: string;
  message: OutreachMessageDto;
  onAnalyze: (message: OutreachMessageDto) => void;
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={message.direction === "outbound" ? "secondary" : "outline"}>
                {DIRECTION_LABELS[message.direction] ?? message.direction}
              </Badge>
              <StatusTag source={OUTREACH_MESSAGE_STATUS} value={message.status} />
              <StatusTag source={APPROVAL_STATUS} value={message.approval_status} />
              {message.reply_intent && (
                <Badge variant="outline">
                  {REPLY_INTENT_LABELS[message.reply_intent] ?? message.reply_intent}
                </Badge>
              )}
              {message.ai_generated && <Badge variant="outline">AI 生成</Badge>}
            </div>
            <CardTitle>{message.subject || "无主题消息"}</CardTitle>
            <CardDescription>
              {format(new Date(message.created_at), "yyyy-MM-dd HH:mm")}
              {message.sent_at && ` · 发送于 ${format(new Date(message.sent_at), "MM-dd HH:mm")}`}
            </CardDescription>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {message.direction === "inbound" && (
              <PermissionGate permission="ai:run">
                <Button variant="outline" size="sm" onClick={() => onAnalyze(message)}>
                  <Bot className="size-4" />
                  谈判分析
                </Button>
              </PermissionGate>
            )}
            {message.direction === "outbound" && (
              <PermissionGate permission="outreach:send">
                <MessageStatusMenu threadId={threadId} message={message} />
              </PermissionGate>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="whitespace-pre-wrap text-sm leading-6">{message.body}</p>
        {message.ai_generated && (
          <p className="text-xs text-muted-foreground">
            溯源：{message.prompt_key ?? "unknown"} v{message.prompt_version ?? "?"} ·{" "}
            {message.model ?? "unknown"}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function MessageStatusMenu({
  threadId,
  message,
}: {
  threadId: string;
  message: OutreachMessageDto;
}) {
  const transition = useTransitionOutreachMessage(threadId);
  const [pendingTo, setPendingTo] = useState<string | null>(null);
  const targets = (OUTREACH_MESSAGE_STATUS.transitions[message.status] ?? []).filter(
    (to) => !(message.status === "pending_approval" && to === "approved"),
  );
  if (targets.length === 0) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon-sm" disabled={transition.isPending}>
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>推进消息状态</DropdownMenuLabel>
          {targets.map((to) => (
            <DropdownMenuItem key={to} onClick={() => setPendingTo(to)}>
              <StatusTag source={OUTREACH_MESSAGE_STATUS} value={to} />
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={pendingTo !== null}
        onOpenChange={(open) => !open && setPendingTo(null)}
        title="确认推进消息状态？"
        description={
          pendingTo && (
            <span className="flex items-center gap-2">
              <StatusTag source={OUTREACH_MESSAGE_STATUS} value={message.status} />
              <span>→</span>
              <StatusTag source={OUTREACH_MESSAGE_STATUS} value={pendingTo} />
            </span>
          )
        }
        confirmLabel={pendingTo === "pending_approval" ? "提交审批" : "确认推进"}
        destructive={pendingTo === "cancelled" || pendingTo === "failed"}
        pending={transition.isPending}
        onConfirm={() => {
          if (!pendingTo) return;
          transition.mutate(
            { messageId: message.id, to: pendingTo },
            { onSuccess: () => setPendingTo(null) },
          );
        }}
      />
    </>
  );
}
