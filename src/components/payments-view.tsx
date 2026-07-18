"use client";

import { IndianRupee, Pencil, Plus, Save, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { Customer, Payment, PaymentStatus } from "@/types/crm";
import { Badge, DataTable, DeleteButton } from "@/components/ui";
import { useToast } from "@/components/toast";
import { currency } from "@/utils/format";

function statusFor(invoiceAmount: number, paidAmount: number): PaymentStatus {
  if (paidAmount >= invoiceAmount && invoiceAmount > 0) return "Paid";
  if (paidAmount > 0) return "Partial";
  return "Pending";
}

export function PaymentsView({ payments, customers, query, onChange }: { readonly payments: Payment[]; readonly customers: Customer[]; readonly query: string; readonly onChange: (payments: Payment[]) => void }) {
  const toast = useToast();
  const [editing, setEditing] = useState<Payment | null | "new">(null);
  const nameOf = (id: string) => {
    const c = customers.find((item) => item.customerId === id);
    return c ? c.companyName || c.customerName : id;
  };

  const rows = payments.filter((item) => `${item.invoiceNumber} ${nameOf(item.customerId)}`.toLowerCase().includes(query.toLowerCase()));
  const outstanding = payments.reduce((sum, item) => sum + item.balanceAmount, 0);

  function save(payment: Payment) {
    const exists = payments.some((item) => item.paymentId === payment.paymentId);
    onChange(exists ? payments.map((item) => (item.paymentId === payment.paymentId ? payment : item)) : [payment, ...payments]);
    setEditing(null);
    toast(exists ? `Payment updated for ${payment.invoiceNumber}` : `Payment recorded for ${payment.invoiceNumber}`);
  }

  function remove(payment: Payment) {
    onChange(payments.filter((item) => item.paymentId !== payment.paymentId));
    toast(`Payment ${payment.invoiceNumber} removed`, "info");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">Outstanding balance: <span className="font-semibold text-slate-900">{currency(outstanding)}</span></p>
        <button onClick={() => setEditing("new")} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-soft">
          <Plus className="h-4 w-4" /> Record Payment
        </button>
      </div>
      <DataTable
        columns={["Invoice", "Customer", "Amount", "Paid", "Balance", "Status", "Action"]}
        rows={rows.map((item) => [
          <span key="i" className="font-semibold text-slate-900">{item.invoiceNumber}</span>,
          nameOf(item.customerId),
          currency(item.invoiceAmount),
          currency(item.paidAmount),
          currency(item.balanceAmount),
          <Badge key="s" label={item.status} />,
          <div key="actions" className="flex items-center gap-2">
            <button onClick={() => setEditing(item)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:border-blue-300">
              <Pencil className="h-3.5 w-3.5" /> Update
            </button>
            <DeleteButton resetKey={item.paymentId} onDelete={() => remove(item)} />
          </div>
        ])}
      />
      {editing !== null && <PaymentModal initial={editing === "new" ? null : editing} customers={customers} count={payments.length} onClose={() => setEditing(null)} onSave={save} />}
    </div>
  );
}

function PaymentModal({ initial, customers, count, onClose, onSave }: { readonly initial: Payment | null; readonly customers: Customer[]; readonly count: number; readonly onClose: () => void; readonly onSave: (payment: Payment) => void }) {
  const [customerId, setCustomerId] = useState(initial?.customerId ?? customers[0]?.customerId ?? "");
  const [invoiceNumber, setInvoiceNumber] = useState(initial?.invoiceNumber ?? "");
  const [invoiceAmount, setInvoiceAmount] = useState(initial ? String(initial.invoiceAmount) : "");
  const [paidAmount, setPaidAmount] = useState(initial ? String(initial.paidAmount) : "");
  const [dueDate, setDueDate] = useState(initial?.dueDate ?? new Date().toISOString().slice(0, 10));
  const [error, setError] = useState("");

  const { balance, status } = useMemo(() => {
    const inv = Math.max(0, Number(invoiceAmount) || 0);
    const paid = Math.max(0, Number(paidAmount) || 0);
    return { balance: inv - paid, status: statusFor(inv, paid) };
  }, [invoiceAmount, paidAmount]);

  function submit() {
    if (!customerId) return setError("Select a customer.");
    const inv = Math.max(0, Number(invoiceAmount) || 0);
    if (inv <= 0) return setError("Enter the invoice amount.");
    const paid = Math.min(inv, Math.max(0, Number(paidAmount) || 0));
    onSave({
      paymentId: initial?.paymentId ?? `PAY-${Date.now()}`,
      customerId,
      invoiceNumber: invoiceNumber.trim() || `RC/INV/2026/${String(count + 1).padStart(3, "0")}`,
      invoiceAmount: inv,
      paidAmount: paid,
      balanceAmount: inv - paid,
      dueDate,
      status: statusFor(inv, paid),
      createdAt: initial?.createdAt ?? new Date().toISOString()
    });
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4">
      <div className="w-full max-w-2xl overflow-auto rounded-lg bg-white p-6 shadow-2xl">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="inline-flex items-center gap-2 text-xl font-bold"><IndianRupee className="h-5 w-5 text-blue-600" /> {initial ? "Update Payment" : "Record Payment"}</h2>
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 p-2" aria-label="Close"><X className="h-5 w-5" /></button>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-semibold text-slate-700 md:col-span-2">
            Customer
            <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 font-normal outline-none ring-blue-500 focus:ring-2">
              {customers.map((c) => (
                <option key={c.customerId} value={c.customerId}>{c.companyName || c.customerName}</option>
              ))}
            </select>
          </label>
          <Field label="Invoice No" value={invoiceNumber} onChange={setInvoiceNumber} />
          <Field label="Due Date" value={dueDate} onChange={setDueDate} type="date" />
          <Field label="Invoice Amount (₹)" value={invoiceAmount} onChange={setInvoiceAmount} type="number" />
          <Field label="Paid Amount (₹)" value={paidAmount} onChange={setPaidAmount} type="number" />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
          <span className="text-slate-500">Balance: <span className="font-bold text-slate-900">{currency(Math.max(0, balance))}</span></span>
          <span className="text-slate-500">Status: <Badge label={status} /></span>
        </div>
        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 font-semibold">Cancel</button>
          <button type="button" onClick={submit} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white"><Save className="h-4 w-4" /> Save Payment</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }: { readonly label: string; readonly value: string; readonly onChange: (value: string) => void; readonly type?: string }) {
  return (
    <label className="text-sm font-semibold text-slate-700">
      {label}
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 font-normal outline-none ring-blue-500 focus:ring-2" />
    </label>
  );
}
