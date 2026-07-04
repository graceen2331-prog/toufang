"use client";

import { useState } from "react";
import { Save } from "lucide-react";
import { AsyncBoundary } from "@/components/shared/async-boundary";
import { MetricCard } from "@/components/shared/metric-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useAiSettings, useUpdateAiSettings } from "@/features/admin/queries";
import { formatCost } from "@/shared/schemas/workflow";
import type { AiSettingsDto } from "@/shared/schemas/admin";

export function AiSettingsForm() {
  const query = useAiSettings();

  return (
    <AsyncBoundary
      isLoading={query.isLoading}
      isError={query.isError}
      error={query.error}
      onRetry={() => query.refetch()}
    >
      {query.data && <AiSettingsFormBody data={query.data} />}
    </AsyncBoundary>
  );
}

function AiSettingsFormBody({ data }: { data: AiSettingsDto }) {
  const update = useUpdateAiSettings();
  const [budgetYuan, setBudgetYuan] = useState(() => String(data.ai_monthly_budget_cents / 100));
  const [chatModel, setChatModel] = useState(() =>
    String(data.settings.default_chat_model ?? "gpt-4.1-mini"),
  );
  const [embeddingModel, setEmbeddingModel] = useState(() =>
    String(data.settings.default_embedding_model ?? "text-embedding-3-small"),
  );
  const [approval, setApproval] = useState(() =>
    Boolean(data.settings.high_cost_requires_approval ?? true),
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <MetricCard
          label="本月预算"
          value={`¥${Number(budgetYuan || 0).toLocaleString("zh-CN")}`}
        />
        <MetricCard label="本月已用" value={formatCost(data.month_spent_microcents)} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">模型与预算配置</CardTitle>
        </CardHeader>
        <CardContent className="max-w-2xl space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="ai-budget">
              月度预算（元）
            </label>
            <Input
              id="ai-budget"
              type="number"
              min="0"
              value={budgetYuan}
              onChange={(event) => setBudgetYuan(event.target.value)}
            />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="chat-model">
                默认对话模型
              </label>
              <Input
                id="chat-model"
                value={chatModel}
                onChange={(event) => setChatModel(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="embedding-model">
                默认向量模型
              </label>
              <Input
                id="embedding-model"
                value={embeddingModel}
                onChange={(event) => setEmbeddingModel(event.target.value)}
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={approval} onCheckedChange={(value) => setApproval(Boolean(value))} />
            高成本 AI 任务需要审批
          </label>
          <Button
            disabled={update.isPending}
            onClick={() =>
              update.mutate({
                ai_monthly_budget_cents: Math.round(Number(budgetYuan || 0) * 100),
                settings: {
                  default_chat_model: chatModel,
                  default_embedding_model: embeddingModel,
                  high_cost_requires_approval: approval,
                },
              })
            }
          >
            <Save className="size-4" />
            保存 AI 设置
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
