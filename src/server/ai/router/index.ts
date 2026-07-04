import "server-only";
import type { ZodType } from "zod";
import { prisma } from "@/server/db/client";
import { ApiError } from "@/server/api/envelope";
import { openaiProvider } from "./openai";
import { fakeProvider } from "./fake";
import { ProviderError, type ChatMessage, type ModelProvider } from "./types";

// 模型单价（USD / 百万 token）；成本记账单位 microcents（美分的百万分之一）避免浮点
const PRICING: Record<string, { input: number; output: number }> = {
  "gpt-4.1": { input: 2.0, output: 8.0 },
  "gpt-4.1-mini": { input: 0.4, output: 1.6 },
  "text-embedding-3-small": { input: 0.02, output: 0 },
  "fake-model": { input: 0, output: 0 },
};

function costMicrocents(model: string, inputTokens: number, outputTokens: number): number {
  const price = PRICING[model] ?? PRICING[model.split("-20")[0] ?? ""] ?? { input: 2, output: 8 };
  // USD/1M token → microcents/token = price * 100(美分) * 1e6(micro) / 1e6(M) = price * 100
  return Math.round(inputTokens * price.input * 100 + outputTokens * price.output * 100);
}

function getProvider(): ModelProvider {
  const name = process.env.MODEL_PROVIDER ?? "openai";
  switch (name) {
    case "openai":
      return openaiProvider;
    case "fake":
      return fakeProvider;
    case "anthropic":
    case "gemini":
      throw new ApiError("AI_PROVIDER_NOT_CONFIGURED", `${name} Provider 尚未实现，请在 ModelRouter 中扩展`);
    default:
      throw new ApiError("AI_PROVIDER_NOT_CONFIGURED", `未知 Provider: ${name}`);
  }
}

export function defaultChatModel(light = false): string {
  if ((process.env.MODEL_PROVIDER ?? "openai") === "fake") return "fake-model";
  return light
    ? (process.env.OPENAI_CHAT_MODEL_LIGHT ?? "gpt-4.1-mini")
    : (process.env.OPENAI_CHAT_MODEL ?? "gpt-4.1");
}

export function embeddingModel(): string {
  if ((process.env.MODEL_PROVIDER ?? "openai") === "fake") return "fake-model";
  return process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small";
}

/** 当月已消耗 AI 成本（microcents） */
export async function monthlyAiSpend(tenantId: string): Promise<number> {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const agg = await prisma.aiUsageEvent.aggregate({
    where: { tenantId, createdAt: { gte: monthStart } },
    _sum: { costMicrocents: true },
  });
  return agg._sum.costMicrocents ?? 0;
}

async function assertBudget(tenantId: string): Promise<void> {
  const org = await prisma.organization.findUnique({
    where: { id: tenantId },
    select: { aiMonthlyBudgetCents: true },
  });
  if (!org) throw new ApiError("TENANT_REQUIRED");
  const spent = await monthlyAiSpend(tenantId);
  if (spent >= org.aiMonthlyBudgetCents * 1_000_000) {
    throw new ApiError("AI_BUDGET_EXCEEDED");
  }
}

async function recordUsage(input: {
  tenantId: string;
  agentRunId?: string | null;
  agentKey?: string | null;
  provider: string;
  model: string;
  purpose: "chat" | "embedding";
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  createdBy?: string | null;
}): Promise<void> {
  await prisma.aiUsageEvent.create({
    data: {
      tenantId: input.tenantId,
      agentRunId: input.agentRunId ?? null,
      agentKey: input.agentKey ?? null,
      provider: input.provider,
      model: input.model,
      purpose: input.purpose,
      inputTokens: input.inputTokens,
      outputTokens: input.outputTokens,
      costMicrocents: costMicrocents(input.model, input.inputTokens, input.outputTokens),
      latencyMs: input.latencyMs,
      createdBy: input.createdBy ?? null,
    },
  });
}

export interface RouterChatOptions<T> {
  tenantId: string;
  agentKey: string;
  agentRunId?: string | null;
  promptKey: string;
  messages: ChatMessage[];
  /** 结构化输出校验；失败会带错误信息自动重试一次 */
  outputSchema: ZodType<T>;
  light?: boolean;
  temperature?: number;
  createdBy?: string | null;
}

const MAX_PROVIDER_RETRIES = 2;

async function callWithRetry(provider: ModelProvider, req: Parameters<ModelProvider["chat"]>[0]) {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= MAX_PROVIDER_RETRIES; attempt++) {
    try {
      return await provider.chat(req);
    } catch (err) {
      lastErr = err;
      const retryable = err instanceof ProviderError ? err.retryable : true;
      if (!retryable || attempt === MAX_PROVIDER_RETRIES) break;
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
    }
  }
  throw new ApiError(
    "AI_PROVIDER_ERROR",
    lastErr instanceof Error ? lastErr.message : "模型调用失败",
  );
}

/**
 * 结构化模型调用：预算闸门 → provider(退避重试) → JSON 解析 + Zod 校验（失败自修复一次）→ 用量记账。
 */
export async function routerChat<T>(options: RouterChatOptions<T>): Promise<T> {
  await assertBudget(options.tenantId);
  const provider = getProvider();
  const model = defaultChatModel(options.light);

  const baseReq = {
    model,
    messages: options.messages,
    json: true,
    promptKey: options.promptKey,
    ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
  };

  const start = Date.now();
  let response = await callWithRetry(provider, baseReq);
  await recordUsage({
    tenantId: options.tenantId,
    agentRunId: options.agentRunId,
    agentKey: options.agentKey,
    provider: provider.name,
    model: response.model,
    purpose: "chat",
    inputTokens: response.usage.inputTokens,
    outputTokens: response.usage.outputTokens,
    latencyMs: Date.now() - start,
    createdBy: options.createdBy,
  });

  const firstTry = parseAndValidate(response.content, options.outputSchema);
  if (firstTry.ok) return firstTry.value;

  // 自修复一次：把校验错误回传给模型
  const repairStart = Date.now();
  response = await callWithRetry(provider, {
    ...baseReq,
    messages: [
      ...options.messages,
      { role: "assistant" as const, content: response.content },
      {
        role: "user" as const,
        content: `你上面的 JSON 输出未通过校验：${firstTry.error}。请严格按照要求的结构重新输出完整 JSON，不要输出任何额外文本。`,
      },
    ],
  });
  await recordUsage({
    tenantId: options.tenantId,
    agentRunId: options.agentRunId,
    agentKey: options.agentKey,
    provider: provider.name,
    model: response.model,
    purpose: "chat",
    inputTokens: response.usage.inputTokens,
    outputTokens: response.usage.outputTokens,
    latencyMs: Date.now() - repairStart,
    createdBy: options.createdBy,
  });

  const secondTry = parseAndValidate(response.content, options.outputSchema);
  if (secondTry.ok) return secondTry.value;
  throw new ApiError("AI_OUTPUT_INVALID", secondTry.error);
}

function parseAndValidate<T>(
  content: string,
  schema: ZodType<T>,
): { ok: true; value: T } | { ok: false; error: string } {
  let json: unknown;
  try {
    json = JSON.parse(content);
  } catch {
    return { ok: false, error: "输出不是合法 JSON" };
  }
  const result = schema.safeParse(json);
  if (result.success) return { ok: true, value: result.data };
  return {
    ok: false,
    error: result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
  };
}

/** 批量 embedding（RAG 用）；记账到 tenant */
export async function routerEmbed(
  tenantId: string,
  texts: string[],
  createdBy?: string | null,
): Promise<number[][]> {
  await assertBudget(tenantId);
  const provider = getProvider();
  const model = embeddingModel();
  const start = Date.now();
  const { vectors, usage } = await provider.embed(texts, model);
  await recordUsage({
    tenantId,
    provider: provider.name,
    model,
    purpose: "embedding",
    inputTokens: Math.round(usage.inputTokens),
    outputTokens: 0,
    latencyMs: Date.now() - start,
    createdBy,
  });
  return vectors;
}
