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
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useReconcilePayment } from "@/features/contracts/queries";

function initialPaidAt(): string {
  const date = new Date();
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export function ReconcilePaymentDialog({
  contractId,
  paymentId,
  open,
  onOpenChange,
}: {
  contractId: string;
  paymentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const reconcile = useReconcilePayment(contractId);
  const [reference, setReference] = useState("");
  const [paidAt, setPaidAt] = useState(initialPaidAt);
  const [evidenceNote, setEvidenceNote] = useState("");
  const [documentRef, setDocumentRef] = useState("");
  const [requestKey, setRequestKey] = useState(() => crypto.randomUUID());

  const close = (next: boolean) => {
    onOpenChange(next);
    if (!next) {
      setReference("");
      setPaidAt(initialPaidAt());
      setEvidenceNote("");
      setDocumentRef("");
      setRequestKey(crypto.randomUUID());
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>登记付款与对账</DialogTitle>
          <DialogDescription>
            此操作只记录外部已经发生的付款，不会从系统发起银行转账。
          </DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel>银行 / 支付流水号</FieldLabel>
            <Input value={reference} onChange={(event) => setReference(event.target.value)} />
          </Field>
          <Field>
            <FieldLabel>实际付款时间</FieldLabel>
            <Input
              type="datetime-local"
              value={paidAt}
              onChange={(event) => setPaidAt(event.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel>对账证据说明</FieldLabel>
            <Textarea
              rows={3}
              placeholder="至少 10 个字，例如：已核对网银回单金额和收款账户末四位"
              value={evidenceNote}
              onChange={(event) => setEvidenceNote(event.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel>回单或凭证引用（可选）</FieldLabel>
            <Input value={documentRef} onChange={(event) => setDocumentRef(event.target.value)} />
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)}>
            取消
          </Button>
          <Button
            disabled={
              reference.trim().length < 4 ||
              !paidAt ||
              evidenceNote.trim().length < 10 ||
              reconcile.isPending
            }
            onClick={() =>
              reconcile.mutate(
                {
                  paymentId,
                  input: {
                    settlement_request_key: requestKey,
                    reconciliation_reference: reference.trim(),
                    paid_at: new Date(paidAt).toISOString(),
                    evidence_note: evidenceNote.trim(),
                    evidence_document_ref: documentRef.trim() || null,
                  },
                },
                { onSuccess: () => close(false) },
              )
            }
          >
            {reconcile.isPending ? "登记中…" : "确认登记"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
