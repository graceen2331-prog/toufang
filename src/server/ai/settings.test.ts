import { beforeEach, describe, expect, it } from "vitest";
import { decryptJson, isEncrypted } from "@/server/lib/crypto";
import { getPublicAiSettings, mergePersistedAiSettings } from "./settings";

beforeEach(() => {
  process.env.DATA_ENCRYPTION_KEY = "test-key-for-ai-settings";
  delete process.env.MODEL_PROVIDER;
  delete process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_BASE_URL;
  delete process.env.OPENAI_CHAT_MODEL;
  delete process.env.OPENAI_CHAT_MODEL_LIGHT;
  delete process.env.OPENAI_EMBEDDING_MODEL;
});

describe("AI 运行时配置", () => {
  it("保存 API Key 时只落加密字段，公开配置只返回掩码", () => {
    const persisted = mergePersistedAiSettings(
      {},
      {
        provider: "openai",
        api_key: "sk-test-1234567890",
        base_url: "https://proxy.example.com/v1",
        chat_model: "gpt-4.1",
        light_model: "gpt-4.1-mini",
        embedding_model: "text-embedding-3-small",
        high_cost_requires_approval: false,
      },
    );

    expect(persisted.api_key).toBeUndefined();
    expect(isEncrypted(persisted.api_key_encrypted)).toBe(true);
    expect(decryptJson(persisted.api_key_encrypted)).toEqual({ api_key: "sk-test-1234567890" });

    expect(getPublicAiSettings(persisted)).toEqual({
      provider: "openai",
      api_key_set: true,
      api_key_masked: "sk-••••7890",
      base_url: "https://proxy.example.com/v1",
      chat_model: "gpt-4.1",
      light_model: "gpt-4.1-mini",
      embedding_model: "text-embedding-3-small",
      high_cost_requires_approval: false,
    });
  });

  it("清空 API Key 时删除已保存密文", () => {
    const persisted = mergePersistedAiSettings({}, { api_key: "sk-old-123456" });
    const cleared = mergePersistedAiSettings(persisted, { clear_api_key: true });

    expect(cleared.api_key).toBeUndefined();
    expect(cleared.api_key_encrypted).toBeUndefined();
    expect(getPublicAiSettings(cleared).api_key_set).toBe(false);
  });
});
