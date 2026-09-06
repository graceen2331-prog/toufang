"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import type { UserSettingsDto, UserSettingsUpdateInput } from "@/shared/schemas/settings";
import { authKeys } from "@/features/auth/queries";

export const settingsKeys = {
  current: ["settings"] as const,
};

export function useUserSettings() {
  return useQuery({
    queryKey: settingsKeys.current,
    queryFn: () => apiFetch<UserSettingsDto>("/settings"),
  });
}

export function useUpdateUserSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UserSettingsUpdateInput) =>
      apiFetch<UserSettingsDto>("/settings", { method: "PATCH", body: input }),
    onSuccess: () => {
      toast.success("设置已保存");
      void queryClient.invalidateQueries({ queryKey: settingsKeys.current });
      void queryClient.invalidateQueries({ queryKey: authKeys.me });
    },
    onError: (err) => toast.error(err.message),
  });
}
