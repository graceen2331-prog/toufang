import { createApiHandler } from "@/server/api/handler";
import { transitionReportStatus } from "@/server/modules/analytics/analytics.service";
import { ReportStatusSchema } from "@/shared/schemas/content-analytics";

export const POST = createApiHandler({
  permission: "report:write",
  body: ReportStatusSchema,
  audit: "report.transition",
  handler: async (ctx) => {
    const report = await transitionReportStatus(
      { orgId: ctx.auth.orgId, userId: ctx.auth.userId },
      ctx.params.id!,
      ctx.body.to,
      ctx.body.reason,
    );
    ctx.setAuditEntity("report", report.id, { to: ctx.body.to });
    return report;
  },
});
