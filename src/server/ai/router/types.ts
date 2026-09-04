import "server-only";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ProviderConfig {
  apiKey?: string | null;
  baseUrl?: string | null;
}

export interface ChatRequest extends ProviderConfig {
  model: string;
  messages: ChatMessage[];
  /** 需要 JSON 输出时为 true（provider 启用 JSON mode） */
  json?: boolean;
  temperature?: number;
  maxTokens?: number;
  /** 供 fake provider 返回对应 fixture */
  promptKey?: string;
}

export interface ChatUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface ChatResponse {
  content: string;
  usage: ChatUsage;
  model: string;
}

export interface ModelProvider {
  readonly name: string;
  chat(req: ChatRequest): Promise<ChatResponse>;
  embed(
    texts: string[],
    model: string,
    config?: ProviderConfig,
  ): Promise<{ vectors: number[][]; usage: ChatUsage }>;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    public retryable: boolean,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}
