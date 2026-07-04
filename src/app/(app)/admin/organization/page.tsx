"use client";

import { Suspense } from "react";
import { OrganizationSettingsForm } from "@/features/admin/components/organization-settings-form";
import { PageHeader } from "@/components/shared/page-header";

export default function AdminOrganizationPage() {
  return (
    <Suspense>
      <div className="space-y-6">
        <PageHeader title="组织设置" description="维护组织基础信息和管理侧配置。" />
        <OrganizationSettingsForm />
      </div>
    </Suspense>
  );
}
