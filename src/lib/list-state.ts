"use client";

import { useCallback, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * URL 驱动的列表筛选状态：筛选条件放 searchParams（可分享、刷新不丢），
 * 变更筛选时自动清除游标。
 */
export function useUrlFilters<T extends Record<string, string>>(defaults: T) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filters = useMemo(() => {
    const result = { ...defaults };
    for (const key of Object.keys(defaults) as Array<keyof T>) {
      const value = searchParams.get(key as string);
      if (value !== null) result[key] = value as T[keyof T];
    }
    return result;
  }, [searchParams, defaults]);

  const setFilter = useCallback(
    (key: keyof T, value: string) => {
      const next = new URLSearchParams(searchParams.toString());
      if (value === "" || value === defaults[key]) {
        next.delete(key as string);
      } else {
        next.set(key as string, value);
      }
      router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
    },
    [router, pathname, searchParams, defaults],
  );

  const reset = useCallback(() => {
    router.replace(pathname, { scroll: false });
  }, [router, pathname]);

  const isFiltered = useMemo(
    () => (Object.keys(defaults) as Array<keyof T>).some((k) => filters[k] !== defaults[k]),
    [filters, defaults],
  );

  return { filters, setFilter, reset, isFiltered };
}

/**
 * 游标分页状态：维护游标栈支持上一页/下一页。
 * 与 useQuery 搭配：query key 里带 cursor，翻页即换 key。
 */
export function useCursorPagination() {
  const [stack, setStack] = useState<string[]>([]);
  const cursor = stack[stack.length - 1] ?? null;

  return {
    cursor,
    page: stack.length + 1,
    hasPrev: stack.length > 0,
    next: (nextCursor: string) => setStack((s) => [...s, nextCursor]),
    prev: () => setStack((s) => s.slice(0, -1)),
    resetPages: () => setStack([]),
  };
}
