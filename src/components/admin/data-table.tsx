"use client";

import { useEffect, useId, useMemo, useState } from "react";
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronsUpDown, Search } from "lucide-react";

import { EmptyState } from "@/components/admin/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TableSkeleton } from "@/components/ui/table-skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  pagination: { page: number; pageSize: number; total: number };
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  searchPlaceholder?: string;
  onSearch?: (query: string) => void;
  isLoading?: boolean;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
  idPrefix?: string;
}

export function DataTable<T>({
  columns,
  data,
  pagination,
  onPageChange,
  onPageSizeChange,
  searchPlaceholder = "Search...",
  onSearch,
  isLoading = false,
  emptyMessage = "No records found.",
  onRowClick,
  idPrefix,
}: DataTableProps<T>) {
  const generatedId = useId().replace(/:/g, "");
  const tableId = idPrefix ?? `admin-data-table-${generatedId}`;
  const [sorting, setSorting] = useState<SortingState>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const totalPages = Math.max(1, Math.ceil(pagination.total / pagination.pageSize));
  const start = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.pageSize + 1;
  const end = Math.min(pagination.page * pagination.pageSize, pagination.total);

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualPagination: true,
    pageCount: totalPages,
  });

  const tableColumnCount = useMemo(() => Math.max(columns.length, 1), [columns.length]);

  useEffect(() => {
    if (!onSearch) {
      return;
    }

    const timeout = window.setTimeout(() => {
      onSearch(searchQuery);
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [onSearch, searchQuery]);

  return (
    <div className="overflow-hidden rounded-lg border border-border/80 bg-card">
      {onSearch ? (
        <div className="border-b border-border/80 p-3">
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id={`${tableId}-search`}
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={searchPlaceholder}
              className="pl-9"
            />
          </div>
        </div>
      ) : null}

      {isLoading ? (
        <TableSkeleton rows={pagination.pageSize > 10 ? 10 : pagination.pageSize} cols={tableColumnCount} />
      ) : data.length === 0 ? (
        <div className="p-4">
          <EmptyState title="No data" description={emptyMessage} />
        </div>
      ) : (
        <Table>
          <TableHeader className="bg-secondary shadow-[var(--opslin-elevation-1)]">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="h-10 hover:bg-transparent">
                {headerGroup.headers.map((header) => {
                  const sortState = header.column.getIsSorted();
                  const SortIcon =
                    sortState === "asc" ? ArrowUp : sortState === "desc" ? ArrowDown : ChevronsUpDown;

                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder ? null : header.column.getCanSort() ? (
                        <Button
                          id={`${tableId}-sort-${header.id}`}
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="-ml-2 h-8 px-2 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground hover:text-foreground"
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          <SortIcon className="size-3.5" />
                        </Button>
                      ) : (
                        <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                        </span>
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                data-state={selectedRowId === row.id ? "selected" : undefined}
                className={cn("h-11 hover:bg-secondary/50", onRowClick && "cursor-pointer")}
                onClick={() => {
                  setSelectedRowId(row.id);
                  onRowClick?.(row.original);
                }}
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
      )}

      <div className="flex flex-col gap-3 border-t border-border/80 px-4 py-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>
          Showing {start}-{end} of {pagination.total}
        </p>
        <div className="flex items-center gap-2">
          {onPageSizeChange ? (
            <Select
              value={String(pagination.pageSize)}
              onValueChange={(nextSize) => onPageSizeChange(Number(nextSize))}
            >
              <SelectTrigger id={`${tableId}-page-size`} size="sm" className="w-[92px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[25, 50, 100].map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          <Button
            id={`${tableId}-previous`}
            type="button"
            variant="outline"
            size="sm"
            disabled={pagination.page <= 1}
            onClick={() => onPageChange(pagination.page - 1)}
          >
            Previous
          </Button>
          <Button
            id={`${tableId}-next`}
            type="button"
            variant="outline"
            size="sm"
            disabled={pagination.page >= totalPages}
            onClick={() => onPageChange(pagination.page + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
