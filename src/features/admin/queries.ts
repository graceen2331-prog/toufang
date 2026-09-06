"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import type {
  AdminUserDto,
  AdminUserUpdateInput,
  AdminUsersPageDto,
  AiSettingsDto,
  AiSettingsTestInput,
  AiSettingsTestResultDto,
  AiSettingsUpdateInput,
  OrganizationSettingsDto,
  OrganizationUpdateInput,
} from "@/shared/schemas/admin";

export const adminKeys = {
  users: ["admin", "users"] as const,
  organization: ["admin", "organization"] as const,
  aiSettings: ["admin", "ai-settings"] as const,
};

export function useAdminUsersPage() {
  return useQuery({
    queryKey: adminKeys.users,
    queryFn: () => apiFetch<AdminUsersPageDto>("/admin/users"),
  });
}

export function useUpdateAdminUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, input }: { userId: string; input: AdminUserUpdateInput }) =>
      apiFetch<AdminUserDto>(`/admin/users/${userId}`, { method: "PATCH", body: input }),
    onSuccess: () => {
      toast.success("成员权限已更新");
      void queryClient.invalidateQueries({ queryKey: adminKeys.users });
    },
    onError: (err) => toast.error(err.message),
  });
}

export function useOrganizationSettings() {
  return useQuery({
    queryKey: adminKeys.organization,
    queryFn: () => apiFetch<OrganizationSettingsDto>("/admin/organization"),
  });
}

export function useUpdateOrganizationSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: OrganizationUpdateInput) =>
      apiFetch<OrganizationSettingsDto>("/admin/organization", { method: "PATCH", body: input }),
    onSuccess: () => {
      toast.success("组织设置已保存");
      void queryClient.invalidateQueries({ queryKey: adminKeys.organization });
    },
    onError: (err) => toast.error(err.message),
  });
}

export function useAiSettings() {
  return useQuery({
    queryKey: adminKeys.aiSettings,
    queryFn: () => apiFetch<AiSettingsDto>("/admin/ai/settings"),
  });
}

export function useUpdateAiSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AiSettingsUpdateInput) =>
      apiFetch<AiSettingsDto>("/admin/ai/settings", { method: "PATCH", body: input }),
    onSuccess: () => {
      toast.success("AI 设置已保存");
      void queryClient.invalidateQueries({ queryKey: adminKeys.aiSettings });
    },
    onError: (err) => toast.error(err.message),
  });
}

export function useTestAiSettings() {
  return useMutation({
    mutationFn: (input: AiSettingsTestInput) =>
      apiFetch<AiSettingsTestResultDto>("/admin/ai/settings/test", {
        method: "POST",
        body: input,
      }),
    onSuccess: (result) => {
      if (result.ok) {
        toast.success(`连接测试成功：${result.model}`);
      } else {
        toast.error(result.message);
      }
    },
    onError: (err) => toast.error(err.message),
  });
}
