"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch, apiFetchList } from "@/lib/api";
import type { NotificationDto } from "@/shared/schemas/notification";

export interface NotificationFilters {
  unread?: boolean;
  type?: string;
  cursor?: string | null;
}

export const notificationKeys = {
  all: ["notifications"] as const,
  list: (params: NotificationFilters) => ["notifications", "list", params] as const,
  unread: ["notifications", "unread"] as const,
};

export function useNotifications(params: NotificationFilters) {
  return useQuery({
    queryKey: notificationKeys.list(params),
    queryFn: () =>
      apiFetchList<NotificationDto>("/notifications", {
        params: {
          unread: params.unread || undefined,
          type: params.type,
          cursor: params.cursor,
          limit: 20,
        },
      }),
    placeholderData: (prev) => prev,
  });
}

export function useUnreadNotifications() {
  return useQuery({
    queryKey: notificationKeys.unread,
    queryFn: () => apiFetch<{ unread: number }>("/notifications", { params: { count: "unread" } }),
    refetchInterval: 30_000,
  });
}

export function useMarkNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { ids?: string[]; all?: boolean }) =>
      apiFetch<{ updated: number }>("/notifications", { method: "PATCH", body: input }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
    onError: (err) => toast.error(err.message),
  });
}
