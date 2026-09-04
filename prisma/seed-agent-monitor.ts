import type { PrismaClient } from "../src/generated/prisma/client";

const COMPLETED_RUN_ID = "019b0000-0000-7000-8000-000000000101";
const FAILED_RUN_ID = "019b0000-0000-7000-8000-000000000102";

/** Agent 监测演示数据：覆盖结构修复成功与 Provider 连续失败。 */
export async function seedAgentMonitor(
  prisma: PrismaClient,
  tenantId: string,
  adminId: string,
) {
  const now = Date.now();
  const completedStart = new Date(now - 22 * 60_000);
  const completedAt = new Date(now - 21 * 60_000);
  const failedStart = new Date(now - 48 * 60_000);
  const failedAt = new Date(now - 47 * 60_000);

  await prisma.agentRun.upsert({
    where: { id: COMPLETED_RUN_ID },
    update: {
      tenantId,
      status: "completed",
      subjectType: "content_asset",
      subjectId: "seed-content-asset",
      input: { content_asset_id: "seed-content-asset", contact_email: "creator@example.com" },
      output: { caption: "从通勤到周末山径，一双鞋覆盖两种节奏。", hashtags: ["城市轻越野"] },
      promptSnapshot: {
        system: "你是品牌内容编辑，请输出结构化 JSON。",
        user: "请修改顾清禾（creator@example.com）的达人内容，联系电话 +86 138 0013 8000。",
      },
      model: "fake-model",
      startedAt: completedStart,
      lastActivityAt: completedAt,
      completedAt,
      createdAt: completedStart,
      createdBy: adminId,
    },
    create: {
      id: COMPLETED_RUN_ID,
      tenantId,
      agentKey: "content_rewrite",
      status: "completed",
      subjectType: "content_asset",
      subjectId: "seed-content-asset",
      input: { content_asset_id: "seed-content-asset", contact_email: "creator@example.com" },
      output: { caption: "从通勤到周末山径，一双鞋覆盖两种节奏。", hashtags: ["城市轻越野"] },
      promptSnapshot: {
        system: "你是品牌内容编辑，请输出结构化 JSON。",
        user: "请修改顾清禾（creator@example.com）的达人内容，联系电话 +86 138 0013 8000。",
      },
      promptKey: "content.rewrite",
      promptVersion: "v1",
      model: "fake-model",
      startedAt: completedStart,
      lastActivityAt: completedAt,
      completedAt,
      createdAt: completedStart,
      createdBy: adminId,
    },
  });

  await prisma.agentCall.upsert({
    where: { id: "019b0000-0000-7000-8000-000000000201" },
    update: {
      tenantId,
      status: "completed",
      responsePayload: { content: "{\"caption\": 123}" },
      inputTokens: 824,
      outputTokens: 31,
      latencyMs: 1320,
      costMicrocents: 0,
      startedAt: completedStart,
      completedAt: new Date(completedStart.getTime() + 1320),
      createdAt: completedStart,
    },
    create: {
      id: "019b0000-0000-7000-8000-000000000201",
      tenantId,
      agentRunId: COMPLETED_RUN_ID,
      phase: "primary",
      attempt: 1,
      status: "completed",
      provider: "fake",
      model: "fake-model",
      requestPayload: { prompt_key: "content.rewrite", message_count: 2, json_mode: true },
      responsePayload: { content: "{\"caption\": 123}" },
      inputTokens: 824,
      outputTokens: 31,
      latencyMs: 1320,
      startedAt: completedStart,
      completedAt: new Date(completedStart.getTime() + 1320),
      createdAt: completedStart,
    },
  });

  const repairStart = new Date(completedStart.getTime() + 1500);
  await prisma.agentCall.upsert({
    where: { id: "019b0000-0000-7000-8000-000000000202" },
    update: {
      tenantId,
      status: "completed",
      responsePayload: { content: "{\"caption\":\"从通勤到周末山径，一双鞋覆盖两种节奏。\"}" },
      inputTokens: 910,
      outputTokens: 96,
      latencyMs: 1760,
      startedAt: repairStart,
      completedAt: new Date(repairStart.getTime() + 1760),
      createdAt: repairStart,
    },
    create: {
      id: "019b0000-0000-7000-8000-000000000202",
      tenantId,
      agentRunId: COMPLETED_RUN_ID,
      phase: "repair",
      attempt: 1,
      status: "completed",
      provider: "fake",
      model: "fake-model",
      requestPayload: { prompt_key: "content.rewrite", message_count: 4, json_mode: true },
      responsePayload: { content: "{\"caption\":\"从通勤到周末山径，一双鞋覆盖两种节奏。\"}" },
      inputTokens: 910,
      outputTokens: 96,
      latencyMs: 1760,
      startedAt: repairStart,
      completedAt: new Date(repairStart.getTime() + 1760),
      createdAt: repairStart,
    },
  });

  await prisma.agentRun.upsert({
    where: { id: FAILED_RUN_ID },
    update: {
      tenantId,
      status: "failed",
      failureReason: "OpenAI API 错误 429: rate limit exceeded",
      startedAt: failedStart,
      lastActivityAt: failedAt,
      completedAt: failedAt,
      createdAt: failedStart,
      createdBy: adminId,
    },
    create: {
      id: FAILED_RUN_ID,
      tenantId,
      agentKey: "outreach",
      status: "failed",
      subjectType: "outreach_thread",
      subjectId: "seed-outreach-thread",
      input: { instruction: "突出产品真实体验" },
      promptSnapshot: { system: "你是达人外联助手。", user: "请给 creator@example.com 起草外联。" },
      promptKey: "outreach.draft",
      promptVersion: "v1",
      failureReason: "OpenAI API 错误 429: rate limit exceeded",
      startedAt: failedStart,
      lastActivityAt: failedAt,
      completedAt: failedAt,
      createdAt: failedStart,
      createdBy: adminId,
    },
  });

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const callStarted = new Date(failedStart.getTime() + attempt * 3100);
    await prisma.agentCall.upsert({
      where: { id: `019b0000-0000-7000-8000-00000000030${attempt}` },
      update: {
        tenantId,
        status: "failed",
        latencyMs: 820 + attempt * 100,
        errorType: "rate_limit",
        errorMessage: "OpenAI API 错误 429: rate limit exceeded",
        startedAt: callStarted,
        completedAt: new Date(callStarted.getTime() + 820 + attempt * 100),
        createdAt: callStarted,
      },
      create: {
        id: `019b0000-0000-7000-8000-00000000030${attempt}`,
        tenantId,
        agentRunId: FAILED_RUN_ID,
        phase: "primary",
        attempt,
        status: "failed",
        provider: "openai",
        model: "gpt-4.1-mini",
        requestPayload: { prompt_key: "outreach.draft", message_count: 2, json_mode: true },
        latencyMs: 820 + attempt * 100,
        errorType: "rate_limit",
        errorMessage: "OpenAI API 错误 429: rate limit exceeded",
        startedAt: callStarted,
        completedAt: new Date(callStarted.getTime() + 820 + attempt * 100),
        createdAt: callStarted,
      },
    });
  }
}
