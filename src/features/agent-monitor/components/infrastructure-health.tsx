"use client";

import { Activity, CircleAlert, ServerCog } from "lucide-react";
import { AsyncBoundary } from "@/components/shared/async-boundary";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAgentInfrastructure } from "../queries";
import { formatDuration } from "../format";

export function InfrastructureHealth() {
  const query = useAgentInfrastructure();
  return (
    <Card className="py-0">
      <CardHeader className="flex flex-row items-start justify-between gap-4 border-b px-5 py-4">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <ServerCog className="size-4 text-primary" />队列与 Worker
          </CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">BullMQ 基础健康，只读监测</p>
        </div>
        {query.data && (
          <Badge variant={query.data.status === "healthy" ? "secondary" : "destructive"}>
            {query.data.status === "healthy" ? "运行正常" : query.data.status === "degraded" ? "需要关注" : "暂不可用"}
          </Badge>
        )}
      </CardHeader>
      <CardContent className="p-5">
        <AsyncBoundary
          isLoading={query.isLoading}
          isError={query.isError}
          error={query.error}
          onRetry={() => query.refetch()}
          isEmpty={query.data?.queues.length === 0}
          emptyTitle="没有可用的队列状态"
          emptyHint={query.data?.message ?? undefined}
        >
          <div className="grid gap-3 lg:grid-cols-2">
            {(query.data?.queues ?? []).map((queue) => (
              <article key={queue.key} className="rounded-md bg-muted/55 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{queue.label}</p>
                    <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{queue.key}</p>
                  </div>
                  {queue.status === "healthy" ? (
                    <Activity className="size-4 text-success" />
                  ) : (
                    <CircleAlert className="size-4 text-warning" />
                  )}
                </div>
                <dl className="mt-3 grid grid-cols-3 gap-2 text-xs sm:grid-cols-6">
                  <QueueMetric label="等待" value={queue.waiting} />
                  <QueueMetric label="执行中" value={queue.active} />
                  <QueueMetric label="延迟" value={queue.delayed} />
                  <QueueMetric label="已完成" value={queue.completed} />
                  <QueueMetric label="失败保留" value={queue.failed} />
                  <QueueMetric label="Worker" value={queue.workers} />
                </dl>
                <p className="mt-3 text-[11px] text-muted-foreground">
                  最老等待：{queue.oldest_wait_ms === null ? "无等待任务" : formatDuration(queue.oldest_wait_ms)}
                </p>
              </article>
            ))}
          </div>
        </AsyncBoundary>
      </CardContent>
    </Card>
  );
}

function QueueMetric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-[10px] text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium tabular-nums">{value}</dd>
    </div>
  );
}
