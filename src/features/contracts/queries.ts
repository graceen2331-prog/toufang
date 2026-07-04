"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch, apiFetchList } from "@/lib/api";
import type { ContractDto, PaymentDto } from "@/shared/schemas/outreach";

export interface ContractFilters {
  status?: string;
  campaign_id?: string;
  cursor?: string | null;
}

export const contractKeys = {
  all: ["contracts"] as const,
  list: (params: ContractFilters) => ["contracts", "list", params] as const,
  detail: (id: string) => ["contracts", "detail", id] as const,
  payments: (id: string) => ["contracts", "payments", id] as const,
};

export function useContracts(params: ContractFilters) {
  return useQuery({
    queryKey: contractKeys.list(params),
    queryFn: () =>
      apiFetchList<ContractDto>("/contracts", {
        params: {
          status: params.status,
          campaign_id: params.campaign_id,
          cursor: params.cursor,
          limit: 20,
        },
      }),
    placeholderData: (prev) => prev,
  });
}

export function useContract(id: string) {
  return useQuery({
    queryKey: contractKeys.detail(id),
    queryFn: () => apiFetch<ContractDto>(`/contracts/${id}`),
  });
}

export function usePayments(contractId: string) {
  return useQuery({
    queryKey: contractKeys.payments(contractId),
    queryFn: () => apiFetch<PaymentDto[]>(`/contracts/${contractId}/payments`),
  });
}

function useInvalidateContracts() {
  const queryClient = useQueryClient();
  return (id?: string) => {
    void queryClient.invalidateQueries({ queryKey: contractKeys.all });
    if (id) {
      void queryClient.invalidateQueries({ queryKey: contractKeys.detail(id) });
      void queryClient.invalidateQueries({ queryKey: contractKeys.payments(id) });
    }
  };
}

export function useCreateContract() {
  const invalidate = useInvalidateContracts();
  return useMutation({
    mutationFn: (input: {
      campaign_creator_id: string;
      amount_cents: number;
      usage_rights?: string | null;
      exclusivity_terms?: string | null;
      payment_terms?: string | null;
    }) => apiFetch<ContractDto>("/contracts", { method: "POST", body: input }),
    onSuccess: (contract) => {
      toast.success("合同已创建");
      invalidate(contract.id);
    },
    onError: (err) => toast.error(err.message),
  });
}

export function useTransitionContractStatus() {
  const invalidate = useInvalidateContracts();
  return useMutation({
    mutationFn: ({ id, to, reason }: { id: string; to: string; reason?: string }) =>
      apiFetch<ContractDto>(`/contracts/${id}/status`, {
        method: "POST",
        body: { to, reason },
      }),
    onSuccess: (contract) => {
      toast.success("合同状态已更新");
      invalidate(contract.id);
    },
    onError: (err) => toast.error(err.message),
  });
}

export function useCreatePayment(contractId: string) {
  const invalidate = useInvalidateContracts();
  return useMutation({
    mutationFn: (input: {
      amount_cents: number;
      method?: "bank" | "alipay" | "other" | null;
      notes?: string | null;
    }) =>
      apiFetch<PaymentDto>(`/contracts/${contractId}/payments`, {
        method: "POST",
        body: input,
      }),
    onSuccess: () => {
      toast.success("付款记录已创建");
      invalidate(contractId);
    },
    onError: (err) => toast.error(err.message),
  });
}

export function useTransitionPaymentStatus(contractId: string) {
  const invalidate = useInvalidateContracts();
  return useMutation({
    mutationFn: ({ paymentId, to, reason }: { paymentId: string; to: string; reason?: string }) =>
      apiFetch<PaymentDto>(`/payments/${paymentId}/status`, {
        method: "POST",
        body: { to, reason },
      }),
    onSuccess: () => {
      toast.success("付款状态已更新");
      invalidate(contractId);
    },
    onError: (err) => toast.error(err.message),
  });
}
