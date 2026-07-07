"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { FlaskConical, Gauge, Play, Radar } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PermissionGate } from "@/components/shared/permission-gate";
import { WorkflowProgress } from "@/components/shared/workflow-progress";
import { campaignKeys } from "@/features/campaigns/queries";
import { useStartCampaignWorkflow, workflowKeys } from "@/features/workflows/queries";

/** 流水线工作流卡片配置 */
const PIPELINE_WORKFLOWS = [
  {
    key: "research",
    title: "市场研究",
    description: "生成市场与竞品研究，风险落入洞察",
    icon: FlaskConical,
  },
  {
    key: "creator_discovery",
    title: "达人发现",
    description: "AI 从达人库筛选匹配的候选并加入管道",
    icon: Radar,
  },
  {
    key: "creator_scoring",
    title: "达人评分",
    description: "对候选达人做六维评分并推荐入围名单",
    icon: Gauge,
  },
] as const;

interface ActiveRun {
  key: string;
  runId: string;
}

/** 达人流水线 Tab：市场研究 → 达人发现 → 达人评分 三个工作流的触发与进度 */
export function PipelineTab({
  campaignId,
  campaignName,
}: {
  campaignId: string;
  campaignName: string;
}) {
  const queryClient = useQueryClient();
  const start = useStartCampaignWorkflow();
  const [activeRun, setActiveRun] = useState<ActiveRun | null>(null);

  const handleRun = (key: string) => {
    start.mutate(
      { campaignId, key },
      { onSuccess: (res) => setActiveRun({ key, runId: res.workflow_run_id }) },
    );
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        {PIPELINE_WORKFLOWS.map((wf) => (
          <Card key={wf.key}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <wf.icon className="size-4 text-muted-foreground" />
                {wf.title}
              </CardTitle>
              <CardDescription>{wf.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <PermissionGate permission="ai:run">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={start.isPending}
                  onClick={() => handleRun(wf.key)}
                >
                  <Play className="size-4" />
                  {start.isPending && start.variables?.key === wf.key ? "启动中…" : "运行"}
                </Button>
              </PermissionGate>
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        建议执行顺序：研究 → 发现 → 评分。达人发现在策略已批准后效果更好；达人评分要求「{campaignName}
        」下存在处于「候选」状态的达人。
      </p>

      {activeRun && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">运行进度</CardTitle>
          </CardHeader>
          <CardContent>
            <WorkflowProgress
              runId={activeRun.runId}
              inlineApproval
              onFinished={() => {
                void queryClient.invalidateQueries({ queryKey: campaignKeys.all });
                void queryClient.invalidateQueries({ queryKey: workflowKeys.all });
              }}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
