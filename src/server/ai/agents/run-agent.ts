import "server-only";
import type { z } from "zod";
import { routerChat } from "@/server/ai/router";
import type { PromptDefinition } from "@/server/ai/prompts/strategy";
import type { ChatMessage } from "@/server/ai/router/types";
import { publishAgentEvent } from "@/server/events/pubsub";
import { agentMonitorRepository } from "@/server/modules/agent-monitor/agent-monitor.repository";

export interface RunAgentOptions<TSchema extends z.ZodType> {
  tenantId: string;
  agentKey: string;
  workflowRunId?: string | null;
  subjectType?: string | null;
  subjectId?: string | null;
  prompt: PromptDefinition<TSchema>;
  userMessage: string;
  input?: Record<string, unknown>;
  light?: boolean;
  createdBy?: string | null;
}

/**
 * Agent 执行器：创建 agent_runs 记录 → ModelRouter 调用 → 写输出/失败原因。
 * 所有 AI 产物的溯源链：agent_run_id + prompt_key + prompt_version + model。
 */
export async function runAgent<TSchema extends z.ZodType>(
  options: RunAgentOptions<TSchema>,
): Promise<{ output: z.infer<TSchema>; agentRunId: string }> {
  const run = await agentMonitorRepository.createRun({
    tenantId: options.tenantId,
    workflowRunId: options.workflowRunId ?? null,
    agentKey: options.agentKey,
    subjectType: options.subjectType ?? null,
    subjectId: options.subjectId ?? null,
    input: options.input ?? {},
    promptSnapshot: { system: options.prompt.system, user: options.userMessage },
    promptKey: options.prompt.key,
    promptVersion: options.prompt.version,
    createdBy: options.createdBy ?? null,
  });
  await publishAgentEvent(run.id, { type: "run_status", status: "running" });

  try {
    const messages: ChatMessage[] = [
      { role: "system", content: options.prompt.system },
      { role: "user", content: options.userMessage },
    ];
    const output = (await routerChat({
      tenantId: options.tenantId,
      agentKey: options.agentKey,
      agentRunId: run.id,
      promptKey: options.prompt.key,
      messages,
      outputSchema: options.prompt.outputSchema,
      ...(options.light !== undefined ? { light: options.light } : {}),
      createdBy: options.createdBy ?? null,
    })) as z.infer<TSchema>;

    const model = await agentMonitorRepository.findLatestModel(options.tenantId, run.id);
    const committed = await agentMonitorRepository.completeRun(
      options.tenantId,
      run.id,
      output,
      model,
    );
    if (committed) {
      await publishAgentEvent(run.id, { type: "run_status", status: "completed" });
    } else {
      console.info(`[agent-monitor] 丢弃已取消 Agent 的迟到结果：run=${run.id}`);
    }
    return { output, agentRunId: run.id };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    const committed = await agentMonitorRepository.failRun(options.tenantId, run.id, reason);
    if (committed) {
      await publishAgentEvent(run.id, { type: "run_status", status: "failed", message: reason });
    } else {
      console.info(`[agent-monitor] 丢弃已取消 Agent 的迟到失败：run=${run.id}`);
    }
    if (committed && !options.workflowRunId && options.createdBy) {
      try {
        const { createNotificationForUser } = await import(
          "@/server/modules/notification/notification.service"
        );
        await createNotificationForUser({
          tenantId: options.tenantId,
          userId: options.createdBy,
          type: "risk_alert",
          title: `Agent 运行失败：${options.agentKey}`,
          body: reason,
          linkUrl: `/ai-runs/agents/${run.id}`,
          priority: "high",
        });
      } catch (notificationError) {
        console.error("[agent-monitor] 失败通知写入失败", notificationError);
      }
    }
    throw err;
  }
}
