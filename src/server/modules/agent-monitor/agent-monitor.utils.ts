const SENSITIVE_KEY_PATTERN =
  /api[_-]?key|authorization|cookie|token|secret|password|phone|mobile|email|contact|bank|account|payment/i;

const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_PATTERN = /(?<!\d)(?:\+?\d[\d\s()-]{7,}\d)(?!\d)/g;
const BEARER_PATTERN = /Bearer\s+[A-Za-z0-9._~+/-]+=*/gi;
const API_KEY_PATTERN = /\b(?:sk|pk)-[A-Za-z0-9_-]{12,}\b/g;

export type AgentErrorType =
  | "budget"
  | "rate_limit"
  | "timeout"
  | "provider"
  | "validation"
  | "cancelled"
  | "unknown";

/** 对监控页面返回值做递归脱敏；不改变数据库中的溯源原文。 */
export function redactSensitive(value: unknown, key = ""): unknown {
  if (SENSITIVE_KEY_PATTERN.test(key)) return "••••••";
  if (Array.isArray(value)) return value.map((item) => redactSensitive(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([childKey, childValue]) => [
        childKey,
        redactSensitive(childValue, childKey),
      ]),
    );
  }
  if (typeof value !== "string") return value;
  return value
    .replace(EMAIL_PATTERN, "[已脱敏邮箱]")
    .replace(PHONE_PATTERN, "[已脱敏电话]")
    .replace(BEARER_PATTERN, "Bearer [已脱敏]")
    .replace(API_KEY_PATTERN, "[已脱敏密钥]");
}

export function classifyAgentError(error: unknown): {
  type: AgentErrorType;
  code: string | null;
  message: string;
} {
  const source = error as { code?: unknown; message?: unknown; name?: unknown } | null;
  const code = typeof source?.code === "string" ? source.code : null;
  const message =
    typeof source?.message === "string" ? source.message : error instanceof Error ? error.message : String(error);
  const normalized = `${code ?? ""} ${message}`.toLowerCase();

  if (normalized.includes("budget") || code === "AI_BUDGET_EXCEEDED") {
    return { type: "budget", code, message };
  }
  if (normalized.includes("429") || normalized.includes("rate limit") || normalized.includes("限流")) {
    return { type: "rate_limit", code, message };
  }
  if (normalized.includes("timeout") || normalized.includes("timed out") || normalized.includes("超时")) {
    return { type: "timeout", code, message };
  }
  if (
    normalized.includes("output_invalid") ||
    normalized.includes("校验") ||
    normalized.includes("合法 json")
  ) {
    return { type: "validation", code, message };
  }
  if (normalized.includes("cancel") || normalized.includes("取消")) {
    return { type: "cancelled", code, message };
  }
  if (
    normalized.includes("provider") ||
    normalized.includes("openai") ||
    normalized.includes("anthropic") ||
    normalized.includes("gemini")
  ) {
    return { type: "provider", code, message };
  }
  return { type: "unknown", code, message };
}
