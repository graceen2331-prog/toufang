import { describe, expect, it } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { isSerializationConflict } from "./brand-lead.repository";

describe("品牌线索转换串行化冲突识别", () => {
  it("识别 Prisma 事务冲突 P2034", () => {
    const error = new Prisma.PrismaClientKnownRequestError("事务写入冲突", {
      code: "P2034",
      clientVersion: "7.8.0",
    });

    expect(isSerializationConflict(error)).toBe(true);
  });

  it("识别原始 SQL 包装的 PostgreSQL 40001", () => {
    const error = new Prisma.PrismaClientKnownRequestError("Raw query failed", {
      code: "P2010",
      clientVersion: "7.8.0",
      meta: { code: "40001", message: "could not serialize access due to concurrent update" },
    });

    expect(isSerializationConflict(error)).toBe(true);
  });

  it("不重试普通数据库错误", () => {
    const error = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
      code: "P2002",
      clientVersion: "7.8.0",
    });

    expect(isSerializationConflict(error)).toBe(false);
  });
});
