"use client";

import { useState } from "react";
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
import { useTransitionContractStatus } from "@/features/contracts/queries";
import { CONTRACT_STATUS } from "@/shared/constants/status";
import type { ContractDto } from "@/shared/schemas/outreach";

export function ContractStatusMenu({ contract }: { contract: ContractDto }) {
  const transition = useTransitionContractStatus();
  const [pendingTo, setPendingTo] = useState<string | null>(null);
  const targets = (CONTRACT_STATUS.transitions[contract.status] ?? []).filter(
    (to) => !(contract.status === "in_review" && to === "sent"),
  );
  if (targets.length === 0) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" disabled={transition.isPending}>
            推进合同状态
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>转移到</DropdownMenuLabel>
          {targets.map((to) => (
            <DropdownMenuItem key={to} onClick={() => setPendingTo(to)}>
              <StatusTag source={CONTRACT_STATUS} value={to} />
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={pendingTo !== null}
        onOpenChange={(open) => !open && setPendingTo(null)}
        title="确认推进合同状态？"
        description={
          pendingTo && (
            <span className="flex items-center gap-2">
              <StatusTag source={CONTRACT_STATUS} value={contract.status} />
              <span>→</span>
              <StatusTag source={CONTRACT_STATUS} value={pendingTo} />
            </span>
          )
        }
        confirmLabel={pendingTo === "in_review" ? "提交审批" : "确认推进"}
        destructive={pendingTo === "cancelled" || pendingTo === "disputed"}
        pending={transition.isPending}
        onConfirm={() => {
          if (!pendingTo) return;
          transition.mutate(
            { id: contract.id, to: pendingTo },
            { onSuccess: () => setPendingTo(null) },
          );
        }}
      />
    </>
  );
}
