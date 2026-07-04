"use client";

import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { ApiPagination } from "@/lib/api";

interface DataTableProps<TData> {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  onRowClick?: (row: TData) => void;
  /** 游标分页控件（与 useCursorPagination 搭配） */
  pagination?: {
    info: ApiPagination | undefined;
    page: number;
    hasPrev: boolean;
    onNext: () => void;
    onPrev: () => void;
  };
}

/** 通用数据表：TanStack Table 核心 + 游标分页页脚 */
export function DataTable<TData>({ columns, data, onRowClick, pagination }: DataTableProps<TData>) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="space-y-3">
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                className={cn(onRowClick && "cursor-pointer")}
                onClick={() => onRowClick?.(row.original)}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {pagination && (pagination.hasPrev || pagination.info?.has_more) && (
        <div className="flex items-center justify-end gap-2">
          <span className="text-sm text-muted-foreground">第 {pagination.page} 页</span>
          <Button
            variant="outline"
            size="sm"
            disabled={!pagination.hasPrev}
            onClick={pagination.onPrev}
          >
            <ChevronLeft className="size-4" />
            上一页
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!pagination.info?.has_more}
            onClick={pagination.onNext}
          >
            下一页
            <ChevronRight className="size-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
