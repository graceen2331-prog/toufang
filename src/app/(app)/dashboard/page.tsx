"use client";

import { useMe } from "@/features/auth/queries";
import { DashboardWorkspace } from "@/features/dashboard/components/dashboard-workspace";

export default function DashboardPage() {
  const me = useMe();

  return (
    <DashboardWorkspace
      me={me.data}
      isLoading={me.isLoading}
      isError={me.isError}
      error={me.error}
      onRetry={() => void me.refetch()}
    />
  );
}
