import "server-only";
import { prisma } from "@/server/db/client";
import { runAgent } from "@/server/ai/agents/run-agent";
import { briefPrompt, type BriefOutput } from "@/server/ai/prompts/pipeline";
import { gatherCampaignContext } from "./research";
import type { WorkflowDefinition } from "../engine";

function briefToPlainText(brief: BriefOutput): string {
  return [
    `# ${brief.title}`,
    `\n## 背景\n${brief.background}`,
    `\n## 产品定位\n${brief.product_positioning}`,
    `\n## 核心信息\n${brief.key_messages.map((m) => `- ${m}`).join("\n")}`,
    `\n## 必须包含\n${brief.must_include.map((m) => `- ${m}`).join("\n")}`,
    `\n## 禁止出现\n${brief.must_avoid.map((m) => `- ${m}`).join("\n")}`,
    `\n## CTA\n${brief.cta}`,
    `\n## 交付物\n${brief.deliverables.map((d) => `- ${d.type} x${d.count}：${d.notes}`).join("\n")}`,
    `\n## 时间要求\n${brief.timeline_notes}`,
    `\n## 平台要求\n${brief.platform_requirements
      .map((p) => `- ${p.platform}：${p.requirements.join("；")}`)
      .join("\n")}`,
  ].join("\n");
}

/**
 * Brief 生成工作流：汇集上下文 → brief agent → 审批 → 创建 Brief + 版本
 */
export const briefWorkflow: WorkflowDefinition = {
  key: "brief",
  label: "Brief 生成",
  steps: [
    { key: "gather_context", label: "汇集上下文", run: gatherCampaignContext },
    {
      key: "generate_brief",
      label: "生成 Brief 草案",
      run: async (ctx) => {
        const context = ctx.outputs.gather_context as Record<string, unknown>;
        const { output, agentRunId } = await runAgent({
          tenantId: ctx.tenantId,
          agentKey: "brief",
          workflowRunId: ctx.runId,
          prompt: briefPrompt,
          userMessage: `请基于以下上下文生成达人内容 Brief：\n\n${JSON.stringify(context, null, 2)}`,
          createdBy: ctx.createdBy,
        });
        return { brief: output, agent_run_id: agentRunId };
      },
      checkpoint: {
        type: "brief",
        title: (_ctx, output) =>
          `Brief 审批：${(output as { brief?: BriefOutput }).brief?.title ?? ""}`,
        summary: (_ctx, output) =>
          ((output as { brief?: BriefOutput }).brief?.background ?? "").slice(0, 200),
        payload: (_ctx, output) => ({
          brief: (output as { brief?: BriefOutput }).brief ?? null,
        }),
        assigneeRole: "content_manager",
      },
    },
    {
      key: "apply_brief",
      label: "创建 Brief 版本",
      run: async (ctx) => {
        const campaignId = ctx.run.subjectId!;
        const gen = ctx.outputs.generate_brief as { brief: BriefOutput; agent_run_id: string };
        const agentRun = await prisma.agentRun.findUnique({
          where: { id: gen.agent_run_id },
          select: { promptKey: true, promptVersion: true, model: true },
        });

        const result = await prisma.$transaction(async (tx) => {
          let brief = await tx.brief.findFirst({
            where: { tenantId: ctx.tenantId, campaignId, deletedAt: null },
            orderBy: { createdAt: "asc" },
          });
          brief ??= await tx.brief.create({
            data: {
              tenantId: ctx.tenantId,
              campaignId,
              title: gen.brief.title,
              status: "draft",
              createdBy: ctx.createdBy,
            },
          });
          const last = await tx.briefVersion.findFirst({
            where: { tenantId: ctx.tenantId, briefId: brief.id },
            orderBy: { version: "desc" },
            select: { version: true },
          });
          const version = await tx.briefVersion.create({
            data: {
              tenantId: ctx.tenantId,
              briefId: brief.id,
              version: (last?.version ?? 0) + 1,
              content: gen.brief as object,
              plainText: briefToPlainText(gen.brief),
              changeSummary: "AI 生成（已过审批门）",
              aiGenerated: true,
              agentRunId: gen.agent_run_id,
              promptKey: agentRun?.promptKey ?? null,
              promptVersion: agentRun?.promptVersion ?? null,
              model: agentRun?.model ?? null,
              createdBy: ctx.createdBy,
            },
          });
          await tx.brief.updateMany({
            where: { id: brief.id, tenantId: ctx.tenantId },
            data: {
              currentVersionId: version.id,
              status: "approved",
              approvedAt: new Date(),
              approvedBy: ctx.createdBy,
              title: gen.brief.title,
            },
          });
          return { briefId: brief.id, versionId: version.id, version: version.version };
        });

        return {
          brief_id: result.briefId,
          version_id: result.versionId,
          version: result.version,
        };
      },
    },
  ],
};
