"use client";

import { useState } from "react";
import { CheckCircle2, KeyRound, PlugZap, Save, Server, ShieldCheck, XCircle } from "lucide-react";
import { AsyncBoundary } from "@/components/shared/async-boundary";
import { MetricCard } from "@/components/shared/metric-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAiSettings, useTestAiSettings, useUpdateAiSettings } from "@/features/admin/queries";
import { formatCost } from "@/shared/schemas/workflow";
import type { AiProvider, AiSettingsDto, AiSettingsTestInput } from "@/shared/schemas/admin";

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
  const test = useTestAiSettings();
  const [budgetYuan, setBudgetYuan] = useState(() => String(data.ai_monthly_budget_cents / 100));
  const [provider, setProvider] = useState<AiProvider>(() => data.settings.provider);
  const [baseUrl, setBaseUrl] = useState(() => data.settings.base_url ?? "");
  const [apiKey, setApiKey] = useState("");
  const [clearApiKey, setClearApiKey] = useState(false);
  const [chatModel, setChatModel] = useState(() => data.settings.chat_model);
  const [lightModel, setLightModel] = useState(() => data.settings.light_model);
  const [embeddingModel, setEmbeddingModel] = useState(() => data.settings.embedding_model);
  const [approval, setApproval] = useState(() => data.settings.high_cost_requires_approval);
  const isFakeProvider = provider === "fake";
  const modelFieldsReady =
    chatModel.trim().length > 0 && lightModel.trim().length > 0 && embeddingModel.trim().length > 0;

  const buildSettingsPayload = (): AiSettingsTestInput => {
    const payload: AiSettingsTestInput = {
      provider,
      base_url: baseUrl.trim() ? baseUrl.trim() : null,
      chat_model: chatModel.trim(),
      light_model: lightModel.trim(),
      embedding_model: embeddingModel.trim(),
      high_cost_requires_approval: approval,
    };
    if (apiKey.trim()) payload.api_key = apiKey.trim();
    else if (clearApiKey) payload.clear_api_key = true;
    return payload;
  };

  const saveSettings = () => {
    update.mutate({
      ai_monthly_budget_cents: Math.max(0, Math.round(Number(budgetYuan || 0) * 100)),
      settings: buildSettingsPayload(),
    });
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-3">
        <MetricCard
          label="本月预算"
          value={`¥${Number(budgetYuan || 0).toLocaleString("zh-CN")}`}
        />
        <MetricCard label="本月已用" value={formatCost(data.month_spent_microcents)} />
        <MetricCard
          label="当前 Provider"
          value={provider === "openai" ? "OpenAI" : "Fake"}
          hint={data.settings.api_key_set ? "密钥已保存" : "尚未保存密钥"}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Server className="size-4" />
            模型连接
          </CardTitle>
          <CardDescription>
            组织级配置会优先生效；API Key 加密保存，前端只显示掩码。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 lg:grid-cols-[180px_1fr]">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="ai-provider">
                Provider
              </label>
              <Select value={provider} onValueChange={(value) => setProvider(value as AiProvider)}>
                <SelectTrigger id="ai-provider" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai">OpenAI / 兼容接口</SelectItem>
                  <SelectItem value="fake">Fake 演示模型</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="base-url">
                模型服务地址（Base URL）
              </label>
              <Input
                id="base-url"
                value={baseUrl}
                onChange={(event) => setBaseUrl(event.target.value)}
                placeholder="https://api.openai.com/v1"
              />
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-[1fr_180px]">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="api-key">
                API Key
              </label>
              <Input
                id="api-key"
                type="password"
                value={apiKey}
                onChange={(event) => {
                  setApiKey(event.target.value);
                  if (event.target.value.trim()) setClearApiKey(false);
                }}
                placeholder={
                  data.settings.api_key_masked
                    ? `已配置：${data.settings.api_key_masked}，留空表示不修改`
                    : isFakeProvider
                      ? "Fake provider 可留空"
                      : "请输入模型服务 API Key"
                }
              />
              {data.settings.api_key_set && !apiKey.trim() && (
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <KeyRound className="size-3" />
                  已保存密钥：{data.settings.api_key_masked ?? "已配置"}
                </p>
              )}
            </div>
            <label className="flex items-center gap-2 self-end pb-2 text-sm">
              <Checkbox
                checked={clearApiKey}
                disabled={Boolean(apiKey.trim()) || !data.settings.api_key_set}
                onCheckedChange={(value) => setClearApiKey(Boolean(value))}
              />
              清空已保存密钥
            </label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">模型与治理</CardTitle>
          <CardDescription>
            轻量模型用于连接测试和低风险任务，向量模型用于知识库检索。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
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
              <label className="text-sm font-medium" htmlFor="light-model">
                轻量对话模型
              </label>
              <Input
                id="light-model"
                value={lightModel}
                onChange={(event) => setLightModel(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="embedding-model">
                向量模型
              </label>
              <Input
                id="embedding-model"
                value={embeddingModel}
                onChange={(event) => setEmbeddingModel(event.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-[220px_1fr]">
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
            <label className="flex items-center gap-2 self-end pb-2 text-sm">
              <Checkbox
                checked={approval}
                onCheckedChange={(value) => setApproval(Boolean(value))}
              />
              <ShieldCheck className="size-4 text-muted-foreground" />
              高成本 AI 任务需要审批
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              disabled={test.isPending || !modelFieldsReady}
              onClick={() => test.mutate(buildSettingsPayload())}
            >
              <PlugZap className="size-4" />
              测试连接
            </Button>
            <Button disabled={update.isPending || !modelFieldsReady} onClick={saveSettings}>
              <Save className="size-4" />
              保存 AI 设置
            </Button>
            {test.data && (
              <Badge variant={test.data.ok ? "secondary" : "destructive"} className="gap-1">
                {test.data.ok ? (
                  <CheckCircle2 className="size-3" />
                ) : (
                  <XCircle className="size-3" />
                )}
                {test.data.ok
                  ? `${test.data.model} · ${test.data.latency_ms}ms`
                  : test.data.message}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
