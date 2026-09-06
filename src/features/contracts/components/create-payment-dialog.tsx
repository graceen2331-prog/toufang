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

const MILESTONES = {
  first_payment: "首期付款",
  delivery_milestone: "交付节点付款",
  final_payment: "最终尾款",
} as const;

export function CreatePaymentDialog({
  contractId,
  remainingAmountCents,
  open,
  onOpenChange,
}: {
  contractId: string;
  remainingAmountCents: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const createPayment = useCreatePayment(contractId);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<"bank" | "alipay" | "other">("bank");
  const [milestoneKey, setMilestoneKey] = useState<keyof typeof MILESTONES>("delivery_milestone");
  const [payeeName, setPayeeName] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [invoiceMode, setInvoiceMode] = useState<"invoice" | "exception">("invoice");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceIssuer, setInvoiceIssuer] = useState("");
  const [invoiceException, setInvoiceException] = useState("");
  const [notes, setNotes] = useState("");
  const [requestKey, setRequestKey] = useState(() => crypto.randomUUID());
  const amountCents = yuanToCents(amount);
  const isAmountValid = amountCents > 0 && amountCents <= remainingAmountCents;
  const isEvidenceValid =
    payeeName.trim().length > 0 &&
    bankName.trim().length > 0 &&
    accountNumber.replace(/[\s-]/g, "").length >= 4 &&
    (invoiceMode === "invoice"
      ? invoiceNumber.trim().length > 0 && invoiceIssuer.trim().length > 0
      : invoiceException.trim().length >= 5);

  const close = (next: boolean) => {
    onOpenChange(next);
    if (!next) {
      setAmount("");
      setMethod("bank");
      setMilestoneKey("delivery_milestone");
      setPayeeName("");
      setBankName("");
      setAccountNumber("");
      setInvoiceMode("invoice");
      setInvoiceNumber("");
      setInvoiceIssuer("");
      setInvoiceException("");
      setNotes("");
      setRequestKey(crypto.randomUUID());
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>登记付款</DialogTitle>
          <DialogDescription>
            付款记录会预留合同额度。收款账户将加密保存，最终仍需财务人工核对。
          </DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel>金额（元）</FieldLabel>
            <Input
              inputMode="decimal"
              value={amount}
              max={remainingAmountCents / 100}
              aria-describedby="payment-remaining-hint"
              onChange={(e) => setAmount(e.target.value)}
            />
            <p id="payment-remaining-hint" className="text-xs text-muted-foreground">
              剩余可付 ¥{(remainingAmountCents / 100).toLocaleString("zh-CN")}
            </p>
            {amount.trim() && !isAmountValid && (
              <p className="text-xs text-destructive">请输入不超过剩余可付金额的正数。</p>
            )}
          </Field>
          <Field>
            <FieldLabel>付款里程碑</FieldLabel>
            <Select
              value={milestoneKey}
              onValueChange={(value) => setMilestoneKey(value as keyof typeof MILESTONES)}
            >
              <SelectTrigger aria-label="付款里程碑">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(MILESTONES).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
          <div className="grid gap-3 sm:grid-cols-2">
            <Field>
              <FieldLabel>收款人</FieldLabel>
              <Input value={payeeName} onChange={(event) => setPayeeName(event.target.value)} />
            </Field>
            <Field>
              <FieldLabel>开户行 / 支付机构</FieldLabel>
              <Input value={bankName} onChange={(event) => setBankName(event.target.value)} />
            </Field>
          </div>
          <Field>
            <FieldLabel>收款账号</FieldLabel>
            <Input
              autoComplete="off"
              inputMode="numeric"
              value={accountNumber}
              onChange={(event) => setAccountNumber(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">保存后仅展示末四位，完整账号不会返回前端。</p>
          </Field>
          <Field>
            <FieldLabel>票据依据</FieldLabel>
            <Select value={invoiceMode} onValueChange={(value) => setInvoiceMode(value as typeof invoiceMode)}>
              <SelectTrigger aria-label="票据依据">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="invoice">已有发票</SelectItem>
                <SelectItem value="exception">暂无发票 / 免票依据</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {invoiceMode === "invoice" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field>
                <FieldLabel>发票号码</FieldLabel>
                <Input value={invoiceNumber} onChange={(event) => setInvoiceNumber(event.target.value)} />
              </Field>
              <Field>
                <FieldLabel>开票方</FieldLabel>
                <Input value={invoiceIssuer} onChange={(event) => setInvoiceIssuer(event.target.value)} />
              </Field>
            </div>
          ) : (
            <Field>
              <FieldLabel>免票原因</FieldLabel>
              <Textarea
                rows={2}
                value={invoiceException}
                onChange={(event) => setInvoiceException(event.target.value)}
              />
            </Field>
          )}
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
            disabled={!isAmountValid || !isEvidenceValid || createPayment.isPending}
            onClick={() =>
              createPayment.mutate(
                {
                  request_key: requestKey,
                  amount_cents: amountCents,
                  currency: "CNY",
                  method,
                  milestone_key: milestoneKey,
                  milestone_label: MILESTONES[milestoneKey],
                  payee: {
                    name: payeeName,
                    bank_name: bankName,
                    account_number: accountNumber,
                  },
                  invoice:
                    invoiceMode === "invoice"
                      ? {
                          number: invoiceNumber,
                          issuer: invoiceIssuer,
                          amount_cents: amountCents,
                          currency: "CNY",
                        }
                      : { exception_reason: invoiceException },
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
