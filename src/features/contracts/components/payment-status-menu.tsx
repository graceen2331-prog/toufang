"use client";

import { useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusTag } from "@/components/shared/status-tag";
import { useTransitionPaymentStatus } from "@/features/contracts/queries";
import { ReconcilePaymentDialog } from "@/features/contracts/components/reconcile-payment-dialog";
import { PAYMENT_STATUS } from "@/shared/constants/status";
import type { PaymentDto } from "@/shared/schemas/outreach";

export function PaymentStatusMenu({
  contractId,
  payment,
}: {
  contractId: string;
  payment: PaymentDto;
}) {
  const transition = useTransitionPaymentStatus(contractId);
  const [pendingTo, setPendingTo] = useState<string | null>(null);
  const [reconcileOpen, setReconcileOpen] = useState(false);
  const targets = (PAYMENT_STATUS.transitions[payment.status] ?? []).filter(
    (to) =>
      !(payment.status === "pending_approval" && to === "approved") &&
      to !== "paid",
  );
  const canReconcile = ["approved", "scheduled"].includes(payment.status);
  if (targets.length === 0 && !canReconcile) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon-sm" disabled={transition.isPending}>
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>推进付款状态</DropdownMenuLabel>
          {targets.map((to) => (
            <DropdownMenuItem key={to} onClick={() => setPendingTo(to)}>
              <StatusTag source={PAYMENT_STATUS} value={to} />
            </DropdownMenuItem>
          ))}
          {canReconcile && (
            <DropdownMenuItem onClick={() => setReconcileOpen(true)}>
              登记付款与对账
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={pendingTo !== null}
        onOpenChange={(open) => !open && setPendingTo(null)}
        title="确认推进付款状态？"
        description={
          pendingTo && (
            <span className="flex items-center gap-2">
              <StatusTag source={PAYMENT_STATUS} value={payment.status} />
              <span>→</span>
              <StatusTag source={PAYMENT_STATUS} value={pendingTo} />
            </span>
          )
        }
        confirmLabel={pendingTo === "pending_approval" ? "提交审批" : "确认推进"}
        destructive={pendingTo === "cancelled" || pendingTo === "failed"}
        pending={transition.isPending}
        onConfirm={() => {
          if (!pendingTo) return;
          transition.mutate(
            { paymentId: payment.id, to: pendingTo },
            { onSuccess: () => setPendingTo(null) },
          );
        }}
      />
      <ReconcilePaymentDialog
        contractId={contractId}
        paymentId={payment.id}
        open={reconcileOpen}
        onOpenChange={setReconcileOpen}
      />
    </>
  );
}
