import { createApiHandler } from "@/server/api/handler";
import { ApiError } from "@/server/api/envelope";
import { listOutreachCandidates } from "@/server/modules/outreach/outreach.service";

export const GET = createApiHandler({
  permission: "outreach:read",
  handler: async (ctx) => {
    const campaignId = ctx.searchParams.get("campaign_id");
    if (!campaignId) throw new ApiError("VALIDATION_FAILED", "缺少 campaign_id");
    return listOutreachCandidates(
      { orgId: ctx.auth.orgId, userId: ctx.auth.userId },
      campaignId,
    );
  },
});
