"use client";

import { Trash2, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const MODAL_WIDTHS = { md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-3xl" } as const;

/**
 * Accessible dialog: labelled, focus-trapped, closes on Escape or backdrop click,
 * and returns focus to whatever opened it. Page scroll is locked while open.
 */
export function Modal({
  title,
  subtitle,
  size = "lg",
  onClose,
  children
}: {
  readonly title: string;
  readonly subtitle?: string;
  readonly size?: keyof typeof MODAL_WIDTHS;
  readonly onClose: () => void;
  readonly children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    const focusable = () =>
      Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        ) ?? []
      ).filter((element) => element.offsetParent !== null);

    focusable()[0]?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = overflow;
      opener?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn("max-h-[92vh] w-full overflow-auto rounded-lg bg-white p-6 shadow-2xl", MODAL_WIDTHS[size])}
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 id={titleId} className="text-xl font-bold">
              {title}
            </h2>
            {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:border-slate-300" aria-label="Close dialog">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Delete button with a two-step inline confirm (arms on first click, auto-disarms after 3s). */
export function DeleteButton({ onDelete, disabled, title, resetKey }: { readonly onDelete: () => void; readonly disabled?: boolean; readonly title?: string; readonly resetKey?: string | number }) {
  const [armed, setArmed] = useState(false);

  // Disarm if the underlying row changes (e.g. list re-filtered while armed), so a
  // confirm can never delete a different record than the one the user armed.
  useEffect(() => {
    setArmed(false);
  }, [resetKey]);

  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(timer);
  }, [armed]);

  return (
    <button
      type="button"
      disabled={disabled}
      title={title}
      onClick={() => {
        if (armed) {
          onDelete();
          setArmed(false);
        } else {
          setArmed(true);
        }
      }}
      className={cn(
        "inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition disabled:opacity-40",
        armed ? "border-red-300 bg-red-50 text-red-700" : "border-slate-200 text-slate-500 hover:border-red-300 hover:text-red-600"
      )}
    >
      <Trash2 className="h-3.5 w-3.5" /> {armed ? "Confirm?" : "Delete"}
    </button>
  );
}

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
  "Casual Leave": "bg-purple-50 text-purple-700 ring-purple-200",
  "Holiday": "bg-slate-100 text-slate-500 ring-slate-200",
  // Invoice source
  Tally: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  Manual: "bg-slate-100 text-slate-600 ring-slate-200",
  // Stock
  Sold: "bg-green-50 text-green-700 ring-green-200",
  "In Stock": "bg-blue-50 text-blue-700 ring-blue-200"
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

const PAGE_SIZE = 25;

export function DataTable({ columns, rows }: { readonly columns: string[]; readonly rows: ReactNode[][] }) {
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  // Filtering can shrink the list below the current page — fall back to the last page.
  const current = Math.min(page, pageCount - 1);
  const visible = rows.length > PAGE_SIZE ? rows.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE) : rows;

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
            {visible.length ? (
              visible.map((row, rowIndex) => (
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
      {rows.length > PAGE_SIZE && (
        <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-sm">
          <span className="text-slate-600">
            {current * PAGE_SIZE + 1}–{Math.min(rows.length, (current + 1) * PAGE_SIZE)} of {rows.length}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage(Math.max(0, current - 1))}
              disabled={current === 0}
              className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold text-slate-700 disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-slate-600">
              Page {current + 1} of {pageCount}
            </span>
            <button
              type="button"
              onClick={() => setPage(Math.min(pageCount - 1, current + 1))}
              disabled={current >= pageCount - 1}
              className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold text-slate-700 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function SimpleRows({ rows }: { readonly rows: string[][] }) {
  return (
    <div className="divide-y divide-slate-100">
      {rows.map((row, index) => (
        <div key={index} className="grid gap-2 py-3 text-sm sm:grid-cols-3">
          {row.map((cell, cellIndex) => (
            <span key={cellIndex} className="text-slate-700">
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
