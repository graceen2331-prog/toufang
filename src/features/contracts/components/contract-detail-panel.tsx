"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AsyncBoundary, DetailSkeleton } from "@/components/shared/async-boundary";
import { PermissionGate } from "@/components/shared/permission-gate";
import { StatusTag } from "@/components/shared/status-tag";
import { ContractStatusMenu } from "@/features/contracts/components/contract-status-menu";
import { CreatePaymentDialog } from "@/features/contracts/components/create-payment-dialog";
import { PaymentStatusMenu } from "@/features/contracts/components/payment-status-menu";
import { useContract, usePayments } from "@/features/contracts/queries";
import { formatCents } from "@/lib/format";
import { CONTRACT_STATUS, PAYMENT_STATUS } from "@/shared/constants/status";
import type { PaymentDto } from "@/shared/schemas/outreach";

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  bank: "银行转账",
  alipay: "支付宝",
  other: "其他",
};

export function ContractDetailPanel({ contractId }: { contractId: string }) {
  const { data: contract, isLoading, isError, error, refetch } = useContract(contractId);
  const {
    data: payments,
    isLoading: paymentsLoading,
    isError: paymentsError,
    error: paymentsErrorValue,
    refetch: refetchPayments,
  } = usePayments(contractId);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const remainingAmountCents = contract
    ? Math.max(0, contract.amount_cents - contract.payment_total_cents)
    : 0;
  const canCreatePayment = contract
    ? ["signed", "active"].includes(contract.status) && remainingAmountCents > 0
    : false;

  return (
    <AsyncBoundary
      isLoading={isLoading}
      isError={isError}
      error={error}
      onRetry={() => refetch()}
      skeleton={<DetailSkeleton />}
    >
      {contract && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle>{contract.contract_number}</CardTitle>
                  <CardDescription>
                    {contract.campaign_name} · {contract.creator_name}
                  </CardDescription>
                </div>
                <StatusTag source={CONTRACT_STATUS} value={contract.status} />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <AmountBlock label="合同金额" value={formatCents(contract.amount_cents)} />
                <AmountBlock
                  label="已付款"
                  value={formatCents(contract.payment_paid_cents)}
                  hint={`登记总额 ${formatCents(contract.payment_total_cents)}`}
                />
              </div>
              <dl className="space-y-2 text-sm">
                <InfoRow label="授权范围" value={contract.usage_rights ?? "—"} />
                <InfoRow label="排他条款" value={contract.exclusivity_terms ?? "—"} />
                <InfoRow label="付款条款" value={contract.payment_terms ?? "—"} />
                <InfoRow
                  label="签署时间"
                  value={
                    contract.signed_at
                      ? format(new Date(contract.signed_at), "yyyy-MM-dd HH:mm")
                      : "—"
                  }
                />
              </dl>
              <div className="flex flex-wrap gap-2">
                <PermissionGate permission="contract:write">
                  <ContractStatusMenu contract={contract} />
                </PermissionGate>
                <PermissionGate permission="payment:write">
                  <div className="space-y-1">
                    <Button
                      variant="outline"
                      disabled={!canCreatePayment}
                      onClick={() => setPaymentOpen(true)}
                    >
                      <Plus className="size-4" />
                      登记付款
                    </Button>
                    {!canCreatePayment && (
                      <p className="max-w-xs text-xs text-muted-foreground">
                        {remainingAmountCents === 0
                          ? "合同金额已全部登记。"
                          : "合同签署或生效后才能登记付款。"}
                      </p>
                    )}
                  </div>
                </PermissionGate>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>付款记录</CardTitle>
            </CardHeader>
            <CardContent>
              <AsyncBoundary
                isLoading={paymentsLoading}
                isError={paymentsError}
                error={paymentsErrorValue}
                onRetry={() => refetchPayments()}
                isEmpty={(payments ?? []).length === 0}
                emptyTitle="暂无付款记录"
                emptyHint="合同签署或生效后可登记付款"
              >
                <PaymentsTable contractId={contract.id} payments={payments ?? []} />
              </AsyncBoundary>
            </CardContent>
          </Card>

          <CreatePaymentDialog
            contractId={contract.id}
            remainingAmountCents={remainingAmountCents}
            open={paymentOpen}
            onOpenChange={setPaymentOpen}
          />
        </div>
      )}
    </AsyncBoundary>
  );
}

function PaymentsTable({ contractId, payments }: { contractId: string; payments: PaymentDto[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>金额</TableHead>
          <TableHead>状态</TableHead>
          <TableHead>里程碑</TableHead>
          <TableHead>收款账户</TableHead>
          <TableHead>票据 / 对账</TableHead>
          <TableHead>方式</TableHead>
          <TableHead className="w-10" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {payments.map((payment) => (
          <TableRow key={payment.id}>
            <TableCell className="tabular-nums">{formatCents(payment.amount_cents)}</TableCell>
            <TableCell>
              <StatusTag source={PAYMENT_STATUS} value={payment.status} />
              {payment.legacy_evidence_incomplete && (
                <p className="mt-1 text-xs text-amber-700">历史记录，证据字段不完整</p>
              )}
            </TableCell>
            <TableCell>{payment.milestone_label ?? "—"}</TableCell>
            <TableCell>
              {payment.payee_name ? (
                <span>
                  {payment.payee_name} · {payment.payee_bank_name ?? "机构未填"} · 尾号
                  {payment.payee_account_last4 ?? "—"}
                </span>
              ) : (
                "—"
              )}
            </TableCell>
            <TableCell>
              <div className="space-y-1 text-xs">
                <p>
                  {payment.invoice_number
                    ? `发票 ${payment.invoice_number}`
                    : payment.invoice_exception_reason
                      ? "已填写免票依据"
                      : "票据待补"}
                </p>
                {payment.reconciliation_reference && (
                  <p className="text-muted-foreground">流水 {payment.reconciliation_reference}</p>
                )}
              </div>
            </TableCell>
            <TableCell>
              {payment.method ? (PAYMENT_METHOD_LABELS[payment.method] ?? payment.method) : "—"}
            </TableCell>
            <TableCell className="text-right">
              <PermissionGate permission="payment:write">
                <PaymentStatusMenu contractId={contractId} payment={payment} />
              </PermissionGate>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
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

function AmountBlock({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-md border bg-background p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
