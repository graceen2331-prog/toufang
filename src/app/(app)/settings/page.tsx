"use client";

import { Suspense } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { SettingsForm } from "@/features/settings/components/settings-form";

export default function SettingsPage() {
  return (
    <Suspense>
      <div className="space-y-6">
        <PageHeader title="设置" description="管理个人资料、通知偏好、语言与当前组织上下文。" />
        <SettingsForm />
      </div>
    </Suspense>
  );
}
