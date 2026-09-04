import "server-only";
import { prisma } from "@/server/db/client";
import { decryptJson, encryptJson } from "@/server/lib/crypto";
import { ApiError } from "@/server/api/envelope";
import type { AiSettingsFormSettings, AiProvider } from "@/shared/schemas/admin";

export interface AiRuntimeOverride {
  provider?: AiProvider;
  apiKey?: string | null;
  baseUrl?: string | null;
  chatModel?: string | null;
  lightModel?: string | null;
  embeddingModel?: string | null;
}

export interface AiRuntimeSettings {
  provider: AiProvider;
  apiKey: string | null;
  baseUrl: string | null;
  chatModel: string;
  lightModel: string;
  embeddingModel: string;
  highCostRequiresApproval: boolean;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function providerValue(value: unknown): AiProvider | null {
  return value === "fake" || value === "openai" ? value : null;
}

function boolValue(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function maskSecret(value: string | null): string | null {
  if (!value) return null;
  if (value.length <= 8) return "已配置";
  return `${value.slice(0, 3)}••••${value.slice(-4)}`;
}

function decryptApiKey(settings: Record<string, unknown>): string | null {
  const decrypted = decryptJson<{ api_key?: string }>(settings.api_key_encrypted);
  return stringValue(decrypted?.api_key);
}

export function getPublicAiSettings(rawSettings: unknown): AiSettingsFormSettings {
  const settings = asRecord(rawSettings);
  const apiKey = decryptApiKey(settings);
  return {
    provider: providerValue(settings.provider) ?? "openai",
    base_url: stringValue(settings.base_url),
    chat_model:
      stringValue(settings.chat_model) ?? stringValue(settings.default_chat_model) ?? "gpt-4.1",
    light_model: stringValue(settings.light_model) ?? "gpt-4.1-mini",
    embedding_model:
      stringValue(settings.embedding_model) ??
      stringValue(settings.default_embedding_model) ??
      "text-embedding-3-small",
    high_cost_requires_approval: boolValue(settings.high_cost_requires_approval, true),
    api_key_set: Boolean(apiKey),
    api_key_masked: maskSecret(apiKey),
  };
}

export function mergePersistedAiSettings(
  rawSettings: unknown,
  input: Partial<
    Pick<
      AiSettingsFormSettings,
      | "provider"
      | "base_url"
      | "chat_model"
      | "light_model"
      | "embedding_model"
      | "high_cost_requires_approval"
    >
  > & { api_key?: string; clear_api_key?: boolean },
): Record<string, unknown> {
  const current = asRecord(rawSettings);
  const next: Record<string, unknown> = { ...current };

  if (input.provider) next.provider = input.provider;
  if (input.base_url !== undefined) {
    const baseUrl = stringValue(input.base_url);
    if (baseUrl) next.base_url = baseUrl;
    else delete next.base_url;
  }
  if (input.chat_model !== undefined) next.chat_model = stringValue(input.chat_model) ?? "";
  if (input.light_model !== undefined) next.light_model = stringValue(input.light_model) ?? "";
  if (input.embedding_model !== undefined) {
    next.embedding_model = stringValue(input.embedding_model) ?? "";
  }
  if (input.high_cost_requires_approval !== undefined) {
    next.high_cost_requires_approval = input.high_cost_requires_approval;
  }

  const apiKey = stringValue(input.api_key);
  if (apiKey) {
    next.api_key_encrypted = encryptJson({ api_key: apiKey });
  } else if (input.clear_api_key) {
    delete next.api_key_encrypted;
  }
  delete next.api_key;

  return next;
}

export async function getAiRuntimeSettings(
  tenantId: string,
  override: AiRuntimeOverride = {},
): Promise<AiRuntimeSettings> {
  const org = await prisma.organization.findFirst({
    where: { id: tenantId, deletedAt: null },
    select: { settings: true },
  });
  if (!org) throw new ApiError("TENANT_REQUIRED", "组织不存在");

  const publicSettings = getPublicAiSettings(asRecord(org.settings).ai);
  const rawAi = asRecord(asRecord(org.settings).ai);
  const storedApiKey = decryptApiKey(rawAi) ?? stringValue(process.env.OPENAI_API_KEY);
  const hasOverrideApiKey = Object.prototype.hasOwnProperty.call(override, "apiKey");
  // E2E runner 专用：保证组织已保存真实模型配置时，自动验收仍使用确定性 fake provider。
  const forceFakeProvider = process.env.E2E_FORCE_FAKE_PROVIDER === "1";

  return {
    provider:
      (forceFakeProvider
        ? "fake"
        : (override.provider ??
          providerValue(rawAi.provider) ??
          providerValue(process.env.MODEL_PROVIDER) ??
          publicSettings.provider)),
    apiKey: hasOverrideApiKey ? stringValue(override.apiKey) : storedApiKey,
    baseUrl:
      override.baseUrl !== undefined
        ? stringValue(override.baseUrl)
        : (stringValue(rawAi.base_url) ?? stringValue(process.env.OPENAI_BASE_URL)),
    chatModel:
      stringValue(override.chatModel) ??
      stringValue(rawAi.chat_model) ??
      stringValue(rawAi.default_chat_model) ??
      stringValue(process.env.OPENAI_CHAT_MODEL) ??
      publicSettings.chat_model,
    lightModel:
      stringValue(override.lightModel) ??
      stringValue(rawAi.light_model) ??
      stringValue(process.env.OPENAI_CHAT_MODEL_LIGHT) ??
      publicSettings.light_model,
    embeddingModel:
      stringValue(override.embeddingModel) ??
      stringValue(rawAi.embedding_model) ??
      stringValue(rawAi.default_embedding_model) ??
      stringValue(process.env.OPENAI_EMBEDDING_MODEL) ??
      publicSettings.embedding_model,
    highCostRequiresApproval: publicSettings.high_cost_requires_approval,
  };
}
