import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusTag } from "@/components/shared/status-tag";
import { AGENT_CALL_STATUS } from "@/shared/constants/status";
import {
  AGENT_CALL_PHASE_LABELS,
  AGENT_ERROR_LABELS,
  type AgentCallDto,
} from "@/shared/schemas/agent-monitor";
import { formatCost } from "@/shared/schemas/workflow";
import { formatDuration } from "../format";

export function AgentCallTable({ calls }: { calls: AgentCallDto[] }) {
  return (
    <Card className="py-0">
      <CardHeader className="border-b px-5 py-4">
        <CardTitle className="text-base">模型调用明细</CardTitle>
        <p className="text-xs text-muted-foreground">失败尝试、Provider 自动重试和结构修复分别记录</p>
      </CardHeader>
      <CardContent className="p-0">
        {calls.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">这次运行没有模型调用记录</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>阶段</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>Provider / 模型</TableHead>
                <TableHead className="text-right">时延</TableHead>
                <TableHead className="text-right">Token</TableHead>
                <TableHead className="text-right">成本</TableHead>
                <TableHead>错误</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {calls.map((call) => (
                <TableRow key={call.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span>{AGENT_CALL_PHASE_LABELS[call.phase] ?? call.phase}</span>
                      <Badge variant="outline">#{call.attempt}</Badge>
                    </div>
                  </TableCell>
                  <TableCell><StatusTag source={AGENT_CALL_STATUS} value={call.status} /></TableCell>
                  <TableCell>
                    <p className="text-xs">{call.provider}</p>
                    <p className="mt-1 font-mono text-[11px] text-muted-foreground">{call.model}</p>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatDuration(call.latency_ms)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {call.input_tokens.toLocaleString("zh-CN")} / {call.output_tokens.toLocaleString("zh-CN")}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatCost(call.cost_microcents)}</TableCell>
                  <TableCell>
                    {call.error_type ? (
                      <span className="text-xs text-destructive" title={call.error_message ?? undefined}>
                        {AGENT_ERROR_LABELS[call.error_type] ?? call.error_type}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
