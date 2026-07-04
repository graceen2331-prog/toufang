import { createApiHandler } from "@/server/api/handler";
import { exportReport } from "@/server/modules/analytics/analytics.service";

export const POST = createApiHandler({
  permission: "report:export",
  audit: "report.export",
  handler: async (ctx) => {
    const report = await exportReport(
      { orgId: ctx.auth.orgId, userId: ctx.auth.userId },
      ctx.params.id!,
    );
    ctx.setAuditEntity("report", report.id);
    return report;
  },
});
