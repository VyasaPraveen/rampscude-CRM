"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Shared status → pill styling used across every module. */
export const statusTone: Record<string, string> = {
  New: "bg-blue-50 text-blue-700 ring-blue-200",
  "Follow-up": "bg-orange-50 text-orange-700 ring-orange-200",
  "Quotation Sent": "bg-indigo-50 text-indigo-700 ring-indigo-200",
  "Order Confirmed": "bg-green-50 text-green-700 ring-green-200",
  Closed: "bg-slate-100 text-slate-700 ring-slate-200",
  Draft: "bg-slate-100 text-slate-700 ring-slate-200",
  Sent: "bg-blue-50 text-blue-700 ring-blue-200",
  Accepted: "bg-green-50 text-green-700 ring-green-200",
  Rejected: "bg-red-50 text-red-700 ring-red-200",
  Processing: "bg-orange-50 text-orange-700 ring-orange-200",
  Ready: "bg-blue-50 text-blue-700 ring-blue-200",
  Delivered: "bg-green-50 text-green-700 ring-green-200",
  Cancelled: "bg-red-50 text-red-700 ring-red-200",
  Pending: "bg-orange-50 text-orange-700 ring-orange-200",
  Partial: "bg-yellow-50 text-yellow-700 ring-yellow-200",
  Paid: "bg-green-50 text-green-700 ring-green-200",
  "In Progress": "bg-blue-50 text-blue-700 ring-blue-200",
  Completed: "bg-green-50 text-green-700 ring-green-200",
  Dealer: "bg-cyan-50 text-cyan-700 ring-cyan-200",
  Business: "bg-violet-50 text-violet-700 ring-violet-200",
  Retail: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  // Users
  Active: "bg-green-50 text-green-700 ring-green-200",
  Inactive: "bg-slate-100 text-slate-500 ring-slate-200",
  Admin: "bg-blue-50 text-blue-700 ring-blue-200",
  Staff: "bg-violet-50 text-violet-700 ring-violet-200",
  // Attendance
  Present: "bg-green-50 text-green-700 ring-green-200",
  Absent: "bg-red-50 text-red-700 ring-red-200",
  "Half Day": "bg-yellow-50 text-yellow-700 ring-yellow-200",
  Leave: "bg-orange-50 text-orange-700 ring-orange-200",
  "Week Off": "bg-slate-100 text-slate-500 ring-slate-200"
};

export function Badge({ label }: { readonly label: string }) {
  return (
    <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-bold ring-1", statusTone[label] ?? "bg-slate-100 text-slate-700 ring-slate-200")}>
      {label}
    </span>
  );
}

export function Panel({ title, action, children }: { readonly title: string; readonly action?: ReactNode; readonly children: ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-lg font-bold text-slate-950">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

export function DataTable({ columns, rows }: { readonly columns: string[]; readonly rows: ReactNode[][] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-soft">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              {columns.map((column) => (
                <th key={column} className="whitespace-nowrap px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length ? (
              rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="hover:bg-blue-50/50">
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex} className="whitespace-nowrap px-4 py-4 text-sm text-slate-700">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-4 py-10 text-center text-sm text-slate-500" colSpan={columns.length}>
                  No records found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function SimpleRows({ rows }: { readonly rows: string[][] }) {
  return (
    <div className="divide-y divide-slate-100">
      {rows.map((row, index) => (
        <div key={index} className="grid gap-2 py-3 text-sm sm:grid-cols-3">
          {row.map((cell) => (
            <span key={cell} className="text-slate-700">
              {cell}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

export function Chart({ title, values, labels }: { readonly title: string; readonly values: number[]; readonly labels?: string[] }) {
  const max = Math.max(...values, 1);
  const labelList = labels ?? ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
  return (
    <Panel title={title}>
      <div className="flex h-64 items-end gap-3">
        {values.map((value, index) => (
          <div key={`${title}-${index}`} className="flex flex-1 flex-col items-center gap-2">
            <span className="text-xs font-semibold text-slate-600">{value}</span>
            <div className="w-full rounded-t-lg bg-blue-600" style={{ height: `${(value / max) * 170}px` }} />
            <span className="text-center text-xs font-semibold text-slate-500">{labelList[index]}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}
