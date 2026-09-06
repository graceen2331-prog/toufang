import { createApiHandler } from "@/server/api/handler";
import { prisma } from "@/server/db/client";
import type { StrategyVersionDto } from "@/shared/schemas/workflow";

export const GET = createApiHandler({
  permission: "campaign:read",
  handler: async (ctx) => {
    const versions = await prisma.campaignStrategyVersion.findMany({
      where: { tenantId: ctx.auth.orgId, campaignId: ctx.params.id!, deletedAt: null },
      orderBy: { version: "desc" },
    });
    return versions.map(
      (v): StrategyVersionDto => ({
        id: v.id,
        version: v.version,
        status: v.status,
        summary: v.summary,
        content: (v.content as Record<string, unknown>) ?? {},
        model: v.model,
        prompt_key: v.promptKey,
        prompt_version: v.promptVersion,
        approved_at: v.approvedAt?.toISOString() ?? null,
        created_at: v.createdAt.toISOString(),
      }),
    );
  },
});
