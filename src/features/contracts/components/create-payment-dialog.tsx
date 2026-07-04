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
import { useCreatePayment } from "@/features/contracts/queries";
import { yuanToCents } from "@/lib/format";

export function CreatePaymentDialog({
  contractId,
  open,
  onOpenChange,
}: {
  contractId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const createPayment = useCreatePayment(contractId);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<"bank" | "alipay" | "other">("bank");
  const [notes, setNotes] = useState("");

  const close = (next: boolean) => {
    onOpenChange(next);
    if (!next) {
      setAmount("");
      setMethod("bank");
      setNotes("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>登记付款</DialogTitle>
          <DialogDescription>付款记录创建后，可提交审批并在批准后标记为已付款。</DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel>金额（元）</FieldLabel>
            <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <Field>
            <FieldLabel>付款方式</FieldLabel>
            <Select value={method} onValueChange={(value) => setMethod(value as typeof method)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bank">银行转账</SelectItem>
                <SelectItem value="alipay">支付宝</SelectItem>
                <SelectItem value="other">其他</SelectItem>
              </SelectContent>
            </Select>
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
            disabled={!amount.trim() || createPayment.isPending}
            onClick={() =>
              createPayment.mutate(
                {
                  amount_cents: yuanToCents(amount),
                  method,
                  notes: notes || null,
                },
                { onSuccess: () => close(false) },
              )
            }
          >
            {createPayment.isPending ? "登记中…" : "登记付款"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
