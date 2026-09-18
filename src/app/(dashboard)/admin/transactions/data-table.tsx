"use client";

import * as React from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
}

export function DataTable<TData, TValue>({
  columns,
  data,
}: DataTableProps<TData, TValue>) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden shadow-xs">
      <Table className="w-full text-left text-xs">
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="border-b border-neutral-200 bg-neutral-50 hover:bg-neutral-50 text-neutral-900 uppercase tracking-wider font-bold">
              {headerGroup.headers.map((header) => {
                return (
                  <TableHead key={header.id} className="px-5 py-3.5 h-auto text-neutral-900 font-bold uppercase">
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody className="divide-y divide-neutral-100 font-medium">
          {table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() && "selected"}
                className={`hover:bg-neutral-50/60 transition-colors ${(row.original as any).status === "cancelled" || (row.original as any).status === "declined" ? "opacity-60" : ""}`}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} className="px-5 py-4 align-top">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-32 text-center text-neutral-500 text-xs">
                No transactions found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
