"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ApiPagination } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function BrandLeadPagination({
  pagination,
  page,
  pageSize,
  isFetching,
  onPageSizeChange,
  onPrev,
  onNext,
}: {
  pagination: ApiPagination | undefined;
  page: number;
  pageSize: number;
  isFetching: boolean;
  onPageSizeChange: (pageSize: number) => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-none border bg-card px-3 py-2">
      <div className="text-xs text-muted-foreground">
        第 <span className="font-medium text-foreground tabular-nums">{page}</span> 页
        {pagination?.has_more ? " · 后面还有更多品牌" : " · 已到最后一页"}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">每页</span>
        <Select value={String(pageSize)} onValueChange={(value) => onPageSizeChange(Number(value))}>
          <SelectTrigger className="w-20">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="20">20</SelectItem>
            <SelectItem value="50">50</SelectItem>
            <SelectItem value="100">100</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={onPrev} disabled={page <= 1 || isFetching}>
          <ChevronLeft className="size-4" />
          上一页
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onNext}
          disabled={!pagination?.has_more || isFetching || !pagination.next_cursor}
        >
          下一页
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
