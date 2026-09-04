"use client";

import { Eye, LockKeyhole } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AgentRunDetailDto } from "@/shared/schemas/agent-monitor";
import { useAgentRunSensitive } from "../queries";
import { HydratedPermissionGate } from "./hydrated-permission-gate";

export function TraceContentPanel({ run }: { run: AgentRunDetailDto }) {
  const sensitive = useAgentRunSensitive();
  const content = sensitive.data ?? {
    id: run.id,
    prompt: run.prompt,
    input: run.input,
    output: run.output,
    calls: run.calls.map((call) => ({ id: call.id, request: call.request, response: call.response })),
  };

  return (
    <Card className="py-0">
      <CardHeader className="flex flex-row items-start justify-between gap-4 border-b px-5 py-4">
        <div>
          <CardTitle className="text-base">Prompt、输入与输出</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            {sensitive.data ? "正在显示完整上下文，本次查看已写入审计日志" : "默认展示脱敏内容"}
          </p>
        </div>
        <HydratedPermissionGate
          permission="admin:ai_trace"
          fallback={<span className="flex items-center gap-1.5 text-xs text-muted-foreground"><LockKeyhole className="size-3.5" />仅管理员可查看原文</span>}
        >
          <Button
            variant="outline"
            size="sm"
            disabled={sensitive.isPending || !!sensitive.data}
            onClick={() => sensitive.mutate(run.id)}
          >
            <Eye className="size-3.5" />
            {sensitive.isPending ? "读取中…" : sensitive.data ? "已显示完整内容" : "查看完整内容"}
          </Button>
        </HydratedPermissionGate>
      </CardHeader>
      <CardContent className="p-5">
        {sensitive.isError && (
          <Alert variant="destructive" className="mb-4">
            <AlertTitle>完整内容读取失败</AlertTitle>
            <AlertDescription>{sensitive.error.message}</AlertDescription>
          </Alert>
        )}
        {sensitive.data && (
          <Alert className="mb-4 border-warning/30 bg-warning/10">
            <Eye className="size-4" />
            <AlertTitle>完整上下文已展开</AlertTitle>
            <AlertDescription>请仅将这些信息用于故障定位，不要复制到外部渠道。</AlertDescription>
          </Alert>
        )}
        <Tabs defaultValue="prompt">
          <TabsList variant="line" className="mb-4">
            <TabsTrigger value="prompt">Prompt</TabsTrigger>
            <TabsTrigger value="input">结构化输入</TabsTrigger>
            <TabsTrigger value="output">Agent 输出</TabsTrigger>
            <TabsTrigger value="calls">模型请求 / 响应</TabsTrigger>
          </TabsList>
          <TabsContent value="prompt"><JsonPanel value={content.prompt} /></TabsContent>
          <TabsContent value="input"><JsonPanel value={content.input} /></TabsContent>
          <TabsContent value="output"><JsonPanel value={content.output} /></TabsContent>
          <TabsContent value="calls">
            <div className="space-y-3">
              {content.calls.map((call, index) => (
                <details key={call.id} className="rounded-md border bg-muted/30" open={index === 0}>
                  <summary className="cursor-pointer px-3 py-2 text-xs font-medium">调用 #{index + 1}</summary>
                  <div className="grid gap-px border-t bg-border lg:grid-cols-2">
                    <JsonPanel title="请求摘要" value={call.request} compact />
                    <JsonPanel title="响应" value={call.response} compact />
                  </div>
                </details>
              ))}
              {content.calls.length === 0 && <p className="text-sm text-muted-foreground">没有调用载荷</p>}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function JsonPanel({
  value,
  title,
  compact = false,
}: {
  value: Record<string, unknown>;
  title?: string;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "min-w-0 bg-card p-3" : "overflow-hidden rounded-md border bg-muted/30"}>
      {title && <p className="mb-2 text-[11px] font-medium text-muted-foreground">{title}</p>}
      <pre className={compact ? "max-h-72 overflow-auto whitespace-pre-wrap break-words text-[11px] leading-relaxed" : "max-h-[28rem] overflow-auto whitespace-pre-wrap break-words p-4 text-xs leading-relaxed"}>
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}
