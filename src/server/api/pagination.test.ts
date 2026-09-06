import { describe, expect, it } from "vitest";
import { parseListQuery, paginate } from "./pagination";
import { ApiError } from "./envelope";

function sp(query: string): URLSearchParams {
  return new URLSearchParams(query);
}

describe("parseListQuery", () => {
  it("默认 limit 50，最大 100", () => {
    expect(parseListQuery(sp("")).limit).toBe(50);
    expect(parseListQuery(sp("limit=20")).limit).toBe(20);
    expect(parseListQuery(sp("limit=500")).limit).toBe(100);
  });

  it("非法 limit 抛 VALIDATION_FAILED", () => {
    expect(() => parseListQuery(sp("limit=abc"))).toThrow(ApiError);
    expect(() => parseListQuery(sp("limit=0"))).toThrow(ApiError);
  });

  it("排序字段必须在白名单内", () => {
    expect(parseListQuery(sp("sort=created_at")).sort).toBe("created_at");
    expect(() => parseListQuery(sp("sort=password"))).toThrow(ApiError);
    expect(
      parseListQuery(sp("sort=name"), { sortable: ["created_at", "name"] }).sort,
    ).toBe("name");
  });

  it("order 只接受 asc，其余回退 desc", () => {
    expect(parseListQuery(sp("order=asc")).order).toBe("asc");
    expect(parseListQuery(sp("order=whatever")).order).toBe("desc");
  });
});

describe("paginate", () => {
  const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `id-${i}` }));

  it("行数不足 limit 时没有下一页", () => {
    const { items, pagination } = paginate(rows(3), 5);
    expect(items).toHaveLength(3);
    expect(pagination.has_more).toBe(false);
    expect(pagination.next_cursor).toBeNull();
  });

  it("行数为 limit+1 时切片并给出游标", () => {
    const { items, pagination } = paginate(rows(6), 5);
    expect(items).toHaveLength(5);
    expect(pagination.has_more).toBe(true);
    expect(pagination.next_cursor).toBe("id-4");
  });
});
