import "server-only";
import type { z } from "zod";
import { prisma } from "@/server/db/client";
import { routerChat } from "@/server/ai/router";
import type { PromptDefinition } from "@/server/ai/prompts/strategy";
import type { ChatMessage } from "@/server/ai/router/types";

export interface RunAgentOptions<TSchema extends z.ZodType> {
  tenantId: string;
  agentKey: string;
  workflowRunId?: string | null;
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
  const run = await prisma.agentRun.create({
    data: {
      tenantId: options.tenantId,
      workflowRunId: options.workflowRunId ?? null,
      agentKey: options.agentKey,
      status: "running",
      input: (options.input ?? {}) as object,
      promptKey: options.prompt.key,
      promptVersion: options.prompt.version,
      createdBy: options.createdBy ?? null,
    },
  });

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

    // 补记 model（从 usage 事件取最近一条）
    const lastUsage = await prisma.aiUsageEvent.findFirst({
      where: { agentRunId: run.id },
      orderBy: { createdAt: "desc" },
      select: { model: true },
    });
    const committed = await prisma.agentRun.updateMany({
      where: { id: run.id, tenantId: options.tenantId, status: "running" },
      data: {
        status: "completed",
        output: output as object,
        model: lastUsage?.model ?? null,
        completedAt: new Date(),
      },
    });
    if (committed.count === 0) {
      console.info(`[agent] 丢弃已取消 Agent 的迟到结果：run=${run.id}`);
    }
    return { output, agentRunId: run.id };
  } catch (err) {
    const committed = await prisma.agentRun.updateMany({
      where: { id: run.id, tenantId: options.tenantId, status: "running" },
      data: {
        status: "failed",
        failureReason: err instanceof Error ? err.message : String(err),
        completedAt: new Date(),
      },
    });
    if (committed.count === 0) {
      console.info(`[agent] 丢弃已取消 Agent 的迟到失败：run=${run.id}`);
    }
    throw err;
  }
}
