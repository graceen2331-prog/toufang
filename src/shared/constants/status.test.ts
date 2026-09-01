import { describe, expect, it } from "vitest";
import {
  CAMPAIGN_CREATOR_STATUS,
  CAMPAIGN_STATUS,
  CONTENT_ASSET_STATUS,
  CONTENT_REVIEW_STATUS,
  InvalidTransitionError,
  OUTREACH_MESSAGE_STATUS,
  REPORT_STATUS,
  WORKFLOW_RUN_STATUS,
  assertTransition,
  canTransition,
  statusMeta,
} from "./status";

describe("Campaign 状态机", () => {
  it("允许沿主流程推进", () => {
    expect(canTransition(CAMPAIGN_STATUS, "draft", "strategy")).toBe(true);
    expect(canTransition(CAMPAIGN_STATUS, "strategy", "research")).toBe(true);
    expect(canTransition(CAMPAIGN_STATUS, "reporting", "completed")).toBe(true);
  });

  it("允许向前跳过阶段", () => {
    expect(canTransition(CAMPAIGN_STATUS, "draft", "outreach")).toBe(true);
    expect(canTransition(CAMPAIGN_STATUS, "strategy", "brief_creation")).toBe(true);
  });

  it("允许回退一步用于纠错", () => {
    expect(canTransition(CAMPAIGN_STATUS, "research", "strategy")).toBe(true);
    expect(canTransition(CAMPAIGN_STATUS, "outreach", "brief_creation")).toBe(true);
  });

  it("禁止回退多步", () => {
    expect(canTransition(CAMPAIGN_STATUS, "outreach", "draft")).toBe(false);
    expect(canTransition(CAMPAIGN_STATUS, "completed", "draft")).toBe(false);
  });

  it("任意非终态可取消，终态可归档", () => {
    expect(canTransition(CAMPAIGN_STATUS, "negotiation", "cancelled")).toBe(true);
    expect(canTransition(CAMPAIGN_STATUS, "completed", "archived")).toBe(true);
    expect(canTransition(CAMPAIGN_STATUS, "cancelled", "archived")).toBe(true);
    expect(canTransition(CAMPAIGN_STATUS, "archived", "draft")).toBe(false);
  });

  it("非法转移抛出 InvalidTransitionError", () => {
    expect(() => assertTransition(CAMPAIGN_STATUS, "completed", "draft")).toThrow(
      InvalidTransitionError,
    );
  });
});

describe("CampaignCreator 状态机", () => {
  it("候选 → 评分 → 入围 → 批准", () => {
    expect(canTransition(CAMPAIGN_CREATOR_STATUS, "candidate", "scored")).toBe(true);
    expect(canTransition(CAMPAIGN_CREATOR_STATUS, "scored", "shortlisted")).toBe(true);
    expect(canTransition(CAMPAIGN_CREATOR_STATUS, "shortlisted", "approved")).toBe(true);
  });

  it("未批准不可直接触达", () => {
    expect(canTransition(CAMPAIGN_CREATOR_STATUS, "candidate", "contacted")).toBe(false);
    expect(canTransition(CAMPAIGN_CREATOR_STATUS, "shortlisted", "contacted")).toBe(false);
  });

  it("被淘汰的达人可重新进入候选", () => {
    expect(canTransition(CAMPAIGN_CREATOR_STATUS, "rejected", "candidate")).toBe(true);
  });
});

describe("Outreach 消息状态机", () => {
  it("外发消息必须先审批", () => {
    expect(canTransition(OUTREACH_MESSAGE_STATUS, "draft", "sent")).toBe(false);
    expect(canTransition(OUTREACH_MESSAGE_STATUS, "draft", "pending_approval")).toBe(true);
    expect(canTransition(OUTREACH_MESSAGE_STATUS, "pending_approval", "approved")).toBe(true);
    expect(canTransition(OUTREACH_MESSAGE_STATUS, "approved", "sent")).toBe(true);
  });

  it("发送失败可重新排期", () => {
    expect(canTransition(OUTREACH_MESSAGE_STATUS, "failed", "scheduled")).toBe(true);
  });
});

describe("内容审核状态机", () => {
  it("内容资产审核通过必须从 in_review 进入 approved", () => {
    expect(canTransition(CONTENT_ASSET_STATUS, "submitted", "in_review")).toBe(true);
    expect(canTransition(CONTENT_ASSET_STATUS, "in_review", "approved")).toBe(true);
    expect(canTransition(CONTENT_ASSET_STATUS, "submitted", "approved")).toBe(false);
  });

  it("审核记录按 queued → reviewing → completed 推进", () => {
    expect(canTransition(CONTENT_REVIEW_STATUS, "queued", "reviewing")).toBe(true);
    expect(canTransition(CONTENT_REVIEW_STATUS, "reviewing", "completed")).toBe(true);
    expect(canTransition(CONTENT_REVIEW_STATUS, "completed", "reviewing")).toBe(false);
  });
});

describe("报告状态机", () => {
  it("报告审批后才能批准并导出", () => {
    expect(canTransition(REPORT_STATUS, "draft", "in_review")).toBe(true);
    expect(canTransition(REPORT_STATUS, "in_review", "approved")).toBe(true);
    expect(canTransition(REPORT_STATUS, "approved", "exported")).toBe(true);
    expect(canTransition(REPORT_STATUS, "draft", "exported")).toBe(false);
  });
});

describe("工作流状态机", () => {
  it("排队 → 运行 → 等待审批 → 恢复运行", () => {
    expect(canTransition(WORKFLOW_RUN_STATUS, "queued", "running")).toBe(true);
    expect(canTransition(WORKFLOW_RUN_STATUS, "running", "waiting_for_human")).toBe(true);
    expect(canTransition(WORKFLOW_RUN_STATUS, "waiting_for_human", "running")).toBe(true);
  });

  it("失败运行保持终态，手动重试必须创建新运行", () => {
    expect(canTransition(WORKFLOW_RUN_STATUS, "failed", "queued")).toBe(false);
  });
});

describe("statusMeta", () => {
  it("返回状态机内状态的中文标签", () => {
    expect(statusMeta(CAMPAIGN_STATUS, "draft").label).toBe("草稿");
    expect(statusMeta(CAMPAIGN_STATUS, "completed").tone).toBe("success");
  });

  it("未知状态回退为原值 + neutral", () => {
    expect(statusMeta(CAMPAIGN_STATUS, "whatever")).toEqual({ label: "whatever", tone: "neutral" });
  });
});
