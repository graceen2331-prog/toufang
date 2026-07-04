import "server-only";
import OpenAI from "openai";
import { ProviderError, type ChatRequest, type ChatResponse, type ModelProvider } from "./types";

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new ProviderError("OPENAI_API_KEY 未配置", false);
  }
  client ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client;
}

function mapError(err: unknown): ProviderError {
  if (err instanceof OpenAI.APIError) {
    const retryable = err.status === 429 || (err.status !== undefined && err.status >= 500);
    return new ProviderError(`OpenAI API 错误 ${err.status}: ${err.message}`, retryable);
  }
  return new ProviderError(err instanceof Error ? err.message : String(err), true);
}

export const openaiProvider: ModelProvider = {
  name: "openai",

  async chat(req: ChatRequest): Promise<ChatResponse> {
    try {
      const completion = await getClient().chat.completions.create({
        model: req.model,
        messages: req.messages,
        ...(req.json ? { response_format: { type: "json_object" as const } } : {}),
        ...(req.temperature !== undefined ? { temperature: req.temperature } : {}),
        ...(req.maxTokens !== undefined ? { max_completion_tokens: req.maxTokens } : {}),
      });
      const choice = completion.choices[0];
      if (!choice?.message.content) {
        throw new ProviderError("OpenAI 返回空内容", true);
      }
      return {
        content: choice.message.content,
        usage: {
          inputTokens: completion.usage?.prompt_tokens ?? 0,
          outputTokens: completion.usage?.completion_tokens ?? 0,
        },
        model: completion.model,
      };
    } catch (err) {
      if (err instanceof ProviderError) throw err;
      throw mapError(err);
    }
  },

  async embed(texts: string[], model: string) {
    try {
      const res = await getClient().embeddings.create({ model, input: texts });
      return {
        vectors: res.data.map((d) => d.embedding),
        usage: { inputTokens: res.usage?.prompt_tokens ?? 0, outputTokens: 0 },
      };
    } catch (err) {
      throw mapError(err);
    }
  },
};
