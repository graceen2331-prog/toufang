import { createApiHandler } from "@/server/api/handler";
import { exportReport } from "@/server/modules/analytics/analytics.service";
import { ReportExportSchema } from "@/shared/schemas/content-analytics";

export const POST = createApiHandler({
  permission: "report:export",
  body: ReportExportSchema,
  audit: "report.export",
  handler: async (ctx) => {
    const result = await exportReport(
      { orgId: ctx.auth.orgId, userId: ctx.auth.userId },
      ctx.params.id!,
      ctx.body,
    );
    ctx.setAuditEntity("report", result.report.id, {
      export_id: result.export.id,
      snapshot_hash: result.export.snapshot_hash,
      format: result.export.format,
      recipient: result.export.recipient,
    });
    return result;
  },
});
