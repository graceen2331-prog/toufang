import { createApiHandler } from "@/server/api/handler";
import { deriveReportDraft } from "@/server/modules/analytics/analytics.service";
import { ReportDeriveSchema } from "@/shared/schemas/content-analytics";

export const POST = createApiHandler({
  permission: "report:write",
  body: ReportDeriveSchema,
  audit: "report.derive_draft",
  created: true,
  handler: async (ctx) => {
    const report = await deriveReportDraft(
      { orgId: ctx.auth.orgId, userId: ctx.auth.userId },
      ctx.params.id!,
      ctx.body.reason,
    );
    ctx.setAuditEntity("report", report.id, {
      supersedes_id: report.supersedes_id,
      version: report.version,
    });
    return report;
  },
});
