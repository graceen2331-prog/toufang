import { describe, expect, it } from "vitest";
import { buildKnowledgeSearchSql } from "./knowledge.repository";

describe("知识检索 SQL", () => {
  it("在 SQL 内强制租户、可见性、删除态和 ready 状态过滤", () => {
    const sql = buildKnowledgeSearchSql(
      { orgId: "tenant-a", userId: "user-a" },
      Array.from({ length: 1536 }, () => 0.1),
      { limit: 5, brandId: "brand-a", campaignId: "campaign-a", documentTypes: ["report"] },
    );
    const text = sql.sql.replace(/\s+/g, " ");

    expect(text).toContain("kc.tenant_id =");
    expect(text).toContain("kd.tenant_id =");
    expect(text).toContain("kd.deleted_at IS NULL");
    expect(text).toContain("kd.status = 'ready'");
    expect(text).toContain("kd.visibility IN ('workspace', 'team')");
    expect(text).toContain("kd.visibility = 'private' AND kd.created_by =");
    expect(text).toContain("kd.brand_id =");
    expect(text).toContain("kd.campaign_id =");
    expect(text).toContain("kd.type IN");
  });
});
