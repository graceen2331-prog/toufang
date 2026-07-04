"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import type { LoginInput, MeDto } from "@/shared/schemas/auth";

export const authKeys = {
  me: ["auth", "me"] as const,
};

export function useMe() {
  return useQuery({
    queryKey: authKeys.me,
    queryFn: () => apiFetch<MeDto>("/auth/me"),
    staleTime: 5 * 60_000,
  });
}

export function useLogin() {
  const router = useRouter();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: LoginInput) =>
      apiFetch<{ logged_in: boolean }>("/auth/login", { method: "POST", body: input }),
    onSuccess: () => {
      queryClient.clear();
      const params = new URLSearchParams(window.location.search);
      router.replace(params.get("next") ?? "/dashboard");
    },
  });
}

export function useLogout() {
  return useMutation({
    mutationFn: () => apiFetch<{ logged_out: boolean }>("/auth/logout", { method: "POST" }),
    onSuccess: () => {
      window.location.href = "/login";
    },
  });
}

export function useSwitchOrg() {
  return useMutation({
    mutationFn: (orgId: string) =>
      apiFetch<{ switched: boolean }>("/auth/switch-org", {
        method: "POST",
        body: { org_id: orgId },
      }),
    onSuccess: () => {
      // 切换组织后所有数据都要重新拉取，整页刷新最干净
      window.location.href = "/dashboard";
    },
  });
}
