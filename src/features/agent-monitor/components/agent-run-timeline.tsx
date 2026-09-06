import { Bot, Check, CircleAlert, RefreshCcw, Send } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AgentRunTimelineItemDto } from "@/shared/schemas/agent-monitor";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const ICONS = {
  agent_started: Bot,
  call_started: Send,
  call_completed: Check,
  call_failed: CircleAlert,
  agent_completed: Check,
  agent_failed: CircleAlert,
} satisfies Record<AgentRunTimelineItemDto["type"], typeof Bot>;

export function AgentRunTimeline({ items }: { items: AgentRunTimelineItemDto[] }) {
  return (
    <Card className="py-0">
      <CardHeader className="border-b px-5 py-4">
        <CardTitle className="text-base">Agent 运行时间线</CardTitle>
        <p className="text-xs text-muted-foreground">按实际发生时间还原模型请求、重试与结构修复</p>
      </CardHeader>
      <CardContent className="p-5">
        <ol className="relative space-y-0 before:absolute before:bottom-4 before:left-[15px] before:top-4 before:w-px before:bg-border">
          {items.map((item) => {
            const Icon = ICONS[item.type] ?? RefreshCcw;
            const failed = item.status === "failed";
            return (
              <li key={item.id} className="relative flex gap-4 pb-5 last:pb-0">
                <span
                  className={cn(
                    "relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border bg-card",
                    failed ? "border-destructive/30 text-destructive" : item.status === "completed" ? "border-success/30 text-success" : "text-primary",
                  )}
                >
                  <Icon className="size-3.5" />
                </span>
                <div className="min-w-0 flex-1 pt-0.5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="text-sm font-medium">{item.title}</p>
                    <time className="font-mono text-[10px] text-muted-foreground">
                      {format(new Date(item.at), "HH:mm:ss.SSS")}
                    </time>
                  </div>
                  {item.description && (
                    <p className={cn("mt-1 text-xs text-muted-foreground", failed && "text-destructive")}>
                      {item.description}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}
