"use client";

import { useState } from "react";
import { format } from "date-fns";
import { CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";
import { PermissionGate } from "@/components/shared/permission-gate";
import { useConfirmNegotiationTerms } from "@/features/outreach/queries";
import { formatCents, yuanToCents } from "@/lib/format";
import type { NegotiationRecordDto } from "@/shared/schemas/outreach";

function textList(value: Record<string, unknown>, key: string): string {
  const raw = value[key];
  return Array.isArray(raw) ? raw.filter(Boolean).join("、") : "—";
}

export function NegotiationCard({
  threadId,
  negotiation,
}: {
  threadId: string;
  negotiation: NegotiationRecordDto;
}) {
  const [termsOpen, setTermsOpen] = useState(false);
  return (
    <Card size="sm">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>报价与策略</CardTitle>
            <CardDescription>
              {format(new Date(negotiation.created_at), "yyyy-MM-dd HH:mm")}
            </CardDescription>
          </div>
          <Badge variant={negotiation.status === "agreed" ? "secondary" : "outline"}>
            {negotiation.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-2 text-sm">
          <InfoBlock label="达人报价" value={formatCents(negotiation.quoted_price_cents)} />
          <InfoBlock label="建议还价" value={formatCents(negotiation.counter_price_cents)} />
          <InfoBlock label="确认金额" value={formatCents(negotiation.agreed_price_cents)} />
        </div>
        {negotiation.intent_summary && (
          <p className="rounded-md bg-muted/40 p-3 text-sm">{negotiation.intent_summary}</p>
        )}
        {negotiation.strategy.length > 0 && (
          <ListBlock title="谈判策略" items={negotiation.strategy} />
        )}
        {negotiation.risk_notes.length > 0 && (
          <ListBlock title="风险提示" items={negotiation.risk_notes} />
        )}
        {negotiation.required_approvals.length > 0 && (
          <ListBlock title="需要审批" items={negotiation.required_approvals} />
        )}
        {negotiation.reply_draft && (
          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">建议回复</p>
            <p className="whitespace-pre-wrap rounded-md border bg-background p-3 text-sm">
              {negotiation.reply_draft}
            </p>
          </div>
        )}
        {negotiation.status === "agreed" ? (
          <dl className="space-y-1 text-sm">
            <InfoRow label="交付物" value={textList(negotiation.agreed_terms, "deliverables")} />
            <InfoRow
              label="授权范围"
              value={(negotiation.agreed_terms.usage_rights as string | undefined) || "—"}
            />
            <InfoRow
              label="付款条款"
              value={(negotiation.agreed_terms.payment_terms as string | undefined) || "—"}
            />
          </dl>
        ) : (
          <PermissionGate permission="outreach:write">
            <Button variant="outline" size="sm" onClick={() => setTermsOpen(true)}>
              <CheckCircle2 className="size-4" />
              确认合作条款
            </Button>
          </PermissionGate>
        )}
        <ConfirmTermsDialog
          threadId={threadId}
          negotiation={negotiation}
          open={termsOpen}
          onOpenChange={setTermsOpen}
        />
      </CardContent>
    </Card>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-background p-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-medium tabular-nums">{value}</p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[72px_1fr] gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-muted-foreground">{title}</p>
      <ul className="space-y-1 text-sm">
        {items.map((item, index) => (
          <li key={`${item}-${index}`} className="rounded-md bg-muted/40 px-3 py-2">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ConfirmTermsDialog({
  threadId,
  negotiation,
  open,
  onOpenChange,
}: {
  threadId: string;
  negotiation: NegotiationRecordDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const confirmTerms = useConfirmNegotiationTerms(threadId);
  const [price, setPrice] = useState(
    negotiation.counter_price_cents ? String(negotiation.counter_price_cents / 100) : "",
  );
  const [deliverables, setDeliverables] = useState("");
  const [usageRights, setUsageRights] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [notes, setNotes] = useState("");

  const close = (next: boolean) => {
    onOpenChange(next);
    if (!next) {
      setPrice(negotiation.counter_price_cents ? String(negotiation.counter_price_cents / 100) : "");
      setDeliverables("");
      setUsageRights("");
      setPaymentTerms("");
      setNotes("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>确认合作条款</DialogTitle>
          <DialogDescription>确认后会推进达人状态，并可在合同页登记合同。</DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel>确认金额（元）</FieldLabel>
            <Input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
          </Field>
          <Field>
            <FieldLabel>交付物</FieldLabel>
            <Input
              value={deliverables}
              onChange={(e) => setDeliverables(e.target.value)}
              placeholder="短视频 1 条、小红书图文 1 篇"
            />
            <FieldDescription>多个交付物请用顿号、逗号或换行分隔。</FieldDescription>
          </Field>
          <Field>
            <FieldLabel>授权范围</FieldLabel>
            <Textarea rows={3} value={usageRights} onChange={(e) => setUsageRights(e.target.value)} />
          </Field>
          <Field>
            <FieldLabel>付款条款</FieldLabel>
            <Textarea rows={3} value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} />
          </Field>
          <Field>
            <FieldLabel>备注</FieldLabel>
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)}>
            取消
          </Button>
          <Button
            disabled={!price.trim() || confirmTerms.isPending}
            onClick={() =>
              confirmTerms.mutate(
                {
                  negotiationId: negotiation.id,
                  input: {
                    agreed_price_cents: yuanToCents(price),
                    deliverables: deliverables
                      .split(/[、,\n]/)
                      .map((item) => item.trim())
                      .filter(Boolean),
                    usage_rights: usageRights || null,
                    payment_terms: paymentTerms || null,
                    notes: notes || null,
                  },
                },
                { onSuccess: () => close(false) },
              )
            }
          >
            {confirmTerms.isPending ? "确认中…" : "确认条款"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
