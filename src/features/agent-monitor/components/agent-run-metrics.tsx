import { Card, CardContent } from "@/components/ui/card";
import type { AgentRunDetailDto } from "@/shared/schemas/agent-monitor";
import { formatCost } from "@/shared/schemas/workflow";
import { formatDuration } from "../format";

export function AgentRunMetrics({ run }: { run: AgentRunDetailDto }) {
  const metrics = [
    { label: "总时长", value: formatDuration(run.duration_ms) },
    { label: "模型调用", value: `${run.call_count} 次` },
    { label: "输入 / 输出 Token", value: `${run.input_tokens.toLocaleString("zh-CN")} / ${run.output_tokens.toLocaleString("zh-CN")}` },
    { label: "累计成本", value: formatCost(run.cost_microcents) },
  ];
  return (
    <Card className="overflow-hidden py-0">
      <CardContent className="grid p-0 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((metric) => (
          <div key={metric.label} className="border-b px-5 py-4 last:border-b-0 sm:border-r lg:border-b-0">
            <p className="text-xs text-muted-foreground">{metric.label}</p>
            <p className="mt-1.5 text-lg font-semibold tracking-tight tabular-nums">{metric.value}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
