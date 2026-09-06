import "server-only";
import { ApiError } from "@/server/api/envelope";
import type { Pagination } from "@/server/api/envelope";

export interface ListQuery {
  limit: number;
  cursor: string | null;
  sort: string;
  order: "asc" | "desc";
  q: string | null;
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

/**
 * 解析列表通用查询参数（游标分页 + 排序白名单 + 关键词）。
 * id 使用 UUIDv7（时间有序），游标即上一页最后一条的 id。
 */
export function parseListQuery(
  searchParams: URLSearchParams,
  options: { sortable?: string[]; defaultSort?: string } = {},
): ListQuery {
  const sortable = options.sortable ?? ["created_at"];
  const defaultSort = options.defaultSort ?? sortable[0] ?? "created_at";

  const rawLimit = Number(searchParams.get("limit") ?? DEFAULT_LIMIT);
  if (Number.isNaN(rawLimit) || rawLimit < 1) {
    throw new ApiError("VALIDATION_FAILED", "limit 必须是正整数");
  }
  const limit = Math.min(rawLimit, MAX_LIMIT);

  const sort = searchParams.get("sort") ?? defaultSort;
  if (!sortable.includes(sort)) {
    throw new ApiError("VALIDATION_FAILED", `不支持按 ${sort} 排序`, { sortable });
  }
  const order = searchParams.get("order") === "asc" ? "asc" : "desc";

  return {
    limit,
    cursor: searchParams.get("cursor"),
    sort,
    order,
    q: searchParams.get("q"),
  };
}

/** 取 limit+1 条后调用：切片并生成分页信息 */
export function paginate<T extends { id: string }>(
  rows: T[],
  limit: number,
): { items: T[]; pagination: Pagination } {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  return {
    items,
    pagination: {
      limit,
      next_cursor: hasMore ? (items[items.length - 1]?.id ?? null) : null,
      has_more: hasMore,
    },
  };
}
