"use client";

import { Suspense } from "react";
import { AiSettingsForm } from "@/features/admin/components/ai-settings-form";
import { PageHeader } from "@/components/shared/page-header";

export default function AdminAiSettingsPage() {
  return (
    <Suspense>
      <div className="space-y-6">
        <PageHeader
          title="AI 设置"
          description="配置模型路由、月度预算和高成本任务治理策略。"
        />
        <AiSettingsForm />
      </div>
    </Suspense>
  );
}
