"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  useAddOutreachMessage,
  useAnalyzeNegotiation,
  useDraftOutreachMessage,
} from "@/features/outreach/queries";
import { yuanToCents } from "@/lib/format";
import type {
  OutreachMessageDto,
  OutreachThreadDetailDto,
} from "@/shared/schemas/outreach";

export function DraftDialog({
  threadId,
  open,
  onOpenChange,
}: {
  threadId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const draft = useDraftOutreachMessage(threadId);
  const [instruction, setInstruction] = useState("");

  const close = (next: boolean) => {
    onOpenChange(next);
    if (!next) setInstruction("");
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>AI 起草外联消息</DialogTitle>
          <DialogDescription>生成后会保存为草稿，需要提交审批后才能发送。</DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel>追加要求</FieldLabel>
            <Textarea
              rows={4}
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder="例如：语气更正式，突出双十一档期和样品体验。"
            />
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)}>
            取消
          </Button>
          <Button
            disabled={draft.isPending}
            onClick={() =>
              draft.mutate(
                { instruction: instruction || null },
                { onSuccess: () => close(false) },
              )
            }
          >
            {draft.isPending ? "生成中…" : "生成草稿"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function MessageDialog({
  threadId,
  open,
  onOpenChange,
}: {
  threadId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const addMessage = useAddOutreachMessage(threadId);
  const [direction, setDirection] = useState<"outbound" | "inbound">("outbound");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const close = (next: boolean) => {
    onOpenChange(next);
    if (!next) {
      setDirection("outbound");
      setSubject("");
      setBody("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>记录消息</DialogTitle>
          <DialogDescription>外发消息先进入草稿态，达人回复会直接写入回复态。</DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel>方向</FieldLabel>
            <Select value={direction} onValueChange={(value) => setDirection(value as typeof direction)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="outbound">外发</SelectItem>
                <SelectItem value="inbound">达人回复</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel>主题</FieldLabel>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
          </Field>
          <Field>
            <FieldLabel>正文</FieldLabel>
            <Textarea rows={8} value={body} onChange={(e) => setBody(e.target.value)} />
            <FieldDescription>保存后可在时间线中推进状态或触发谈判分析。</FieldDescription>
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)}>
            取消
          </Button>
          <Button
            disabled={!body.trim() || addMessage.isPending}
            onClick={() =>
              addMessage.mutate(
                {
                  direction,
                  subject: subject || null,
                  body,
                },
                { onSuccess: () => close(false) },
              )
            }
          >
            {addMessage.isPending ? "保存中…" : "保存消息"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AnalyzeDialog({
  thread,
  replyMessage,
  open,
  onOpenChange,
}: {
  thread: OutreachThreadDetailDto;
  replyMessage: OutreachMessageDto | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const analyze = useAnalyzeNegotiation(thread.id);
  const [replyText, setReplyText] = useState("");
  const [quotedPrice, setQuotedPrice] = useState("");

  const close = (next: boolean) => {
    onOpenChange(next);
    if (!next) {
      setReplyText("");
      setQuotedPrice("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>生成谈判分析</DialogTitle>
          <DialogDescription>AI 会根据达人回复产出意向、报价建议、风险和回复草稿。</DialogDescription>
        </DialogHeader>
        <FieldGroup>
          {replyMessage ? (
            <Field>
              <FieldLabel>达人回复</FieldLabel>
              <p className="max-h-44 overflow-auto rounded-md border bg-muted/40 p-3 text-sm">
                {replyMessage.body}
              </p>
            </Field>
          ) : (
            <Field>
              <FieldLabel>回复文本</FieldLabel>
              <Textarea rows={5} value={replyText} onChange={(e) => setReplyText(e.target.value)} />
            </Field>
          )}
          <Field>
            <FieldLabel>达人报价（元）</FieldLabel>
            <Input
              inputMode="decimal"
              value={quotedPrice}
              onChange={(e) => setQuotedPrice(e.target.value)}
            />
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)}>
            取消
          </Button>
          <Button
            disabled={(!replyMessage && !replyText.trim()) || analyze.isPending}
            onClick={() =>
              analyze.mutate(
                {
                  reply_message_id: replyMessage?.id ?? null,
                  reply_text: replyMessage ? null : replyText,
                  quoted_price_cents: quotedPrice ? yuanToCents(quotedPrice) : null,
                },
                { onSuccess: () => close(false) },
              )
            }
          >
            {analyze.isPending ? "分析中…" : "生成分析"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
