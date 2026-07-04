import { createApiHandler } from "@/server/api/handler";
import { getReport, updateReport } from "@/server/modules/analytics/analytics.service";
import { ReportUpdateSchema } from "@/shared/schemas/content-analytics";

export const GET = createApiHandler({
  permission: "report:read",
  handler: async (ctx) =>
    getReport({ orgId: ctx.auth.orgId, userId: ctx.auth.userId }, ctx.params.id!),
});

export const PATCH = createApiHandler({
  permission: "report:write",
  body: ReportUpdateSchema,
  audit: "report.update",
  handler: async (ctx) => {
    const report = await updateReport(
      { orgId: ctx.auth.orgId, userId: ctx.auth.userId },
      ctx.params.id!,
      ctx.body,
    );
    ctx.setAuditEntity("report", report.id);
    return report;
  },
});
