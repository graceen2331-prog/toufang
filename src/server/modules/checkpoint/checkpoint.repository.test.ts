import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/db/client", () => ({ prisma: {} }));

import {
  buildCampaignCheckpointWhere,
  type CampaignCheckpointRefs,
} from "./checkpoint.repository";

describe("Campaign 审批过滤", () => {
  it("构造能覆盖 Campaign 及其派生实体的审批查询条件", () => {
    const refs: CampaignCheckpointRefs = {
      campaignCreatorIds: ["cc-1"],
      contentAssetIds: ["asset-1"],
      contractIds: ["contract-1"],
      outreachMessageIds: ["msg-1"],
      paymentRecordIds: ["payment-1"],
      reportIds: ["report-1"],
    };

    const where = buildCampaignCheckpointWhere("campaign-1", refs);

    expect(where.OR).toEqual(
      expect.arrayContaining([
        { entityType: "campaign", entityId: "campaign-1" },
        { entityType: "campaign_creator", entityId: { in: ["cc-1"] } },
        { entityType: "outreach_message", entityId: { in: ["msg-1"] } },
        { entityType: "contract", entityId: { in: ["contract-1"] } },
        { entityType: "payment_record", entityId: { in: ["payment-1"] } },
        { entityType: "content_asset", entityId: { in: ["asset-1"] } },
        { entityType: "report", entityId: { in: ["report-1"] } },
      ]),
    );
    expect(where.OR).toEqual(
      expect.arrayContaining([
        {
          workflowRun: {
            is: {
              OR: [
                { subjectType: "campaign", subjectId: "campaign-1" },
                { subjectType: "campaign_creator", subjectId: { in: ["cc-1"] } },
                { subjectType: "content_asset", subjectId: { in: ["asset-1"] } },
              ],
            },
          },
        },
      ]),
    );
  });

  it("没有关联实体时仍保留 Campaign 直接审批和工作流审批条件", () => {
    const where = buildCampaignCheckpointWhere("campaign-1", {
      campaignCreatorIds: [],
      contentAssetIds: [],
      contractIds: [],
      outreachMessageIds: [],
      paymentRecordIds: [],
      reportIds: [],
    });

    expect(where.OR).toEqual([
      { entityType: "campaign", entityId: "campaign-1" },
      {
        workflowRun: {
          is: {
            OR: [{ subjectType: "campaign", subjectId: "campaign-1" }],
          },
        },
      },
    ]);
  });
});
