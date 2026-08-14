"use client";

import { Pencil, Plus, Save } from "lucide-react";
import { useMemo, useState } from "react";
import type { CompanySettings, Customer, Payment, PaymentMode, PaymentStatus, Purchase } from "@/types/crm";
import { Badge, DataTable, DeleteButton, Modal } from "@/components/ui";
import { useToast } from "@/components/toast";
import { optionList } from "@/lib/options";
import { purchasePaymentId } from "@/lib/orders";
import { currency } from "@/utils/format";

function statusFor(invoiceAmount: number, paidAmount: number): PaymentStatus {
  if (paidAmount >= invoiceAmount && invoiceAmount > 0) return "Paid";
  if (paidAmount > 0) return "Partial";
  return "Pending";
}

export function PaymentsView({ payments, customers, settings, query, onChange }: { readonly payments: Payment[]; readonly customers: Customer[]; readonly settings: CompanySettings; readonly query: string; readonly onChange: (payments: Payment[]) => void }) {
  const toast = useToast();
  const [editing, setEditing] = useState<Payment | null | "new">(null);
  const nameOf = (id: string) => {
    const c = customers.find((item) => item.customerId === id);
    return c ? c.companyName || c.customerName : id;
  };

  const rows = payments.filter((item) => `${item.invoiceNumber} ${nameOf(item.customerId)}`.toLowerCase().includes(query.toLowerCase()));
  const outstanding = payments.reduce((sum, item) => sum + item.balanceAmount, 0);

  function save(payment: Payment) {
    // The row being edited may change its id (e.g. a general payment re-linked to a
    // purchase), so drop the original row and any existing entry with the new id,
    // then add the payment. onChange (updatePayments) syncs it onto the customer.
    const editingId = editing && editing !== "new" ? editing.paymentId : null;
    const existed = payments.some((item) => item.paymentId === payment.paymentId || item.paymentId === editingId);
    const rest = payments.filter((item) => item.paymentId !== payment.paymentId && item.paymentId !== editingId);
    onChange([payment, ...rest]);
    setEditing(null);
    toast(existed ? `Payment updated for ${payment.invoiceNumber}` : `Payment recorded for ${payment.invoiceNumber}`);
  }

  function remove(payment: Payment) {
    onChange(payments.filter((item) => item.paymentId !== payment.paymentId));
    toast(`Payment ${payment.invoiceNumber} removed`, "info");
  }

  function removeMany(ids: string[]) {
    const set = new Set(ids);
    onChange(payments.filter((item) => !set.has(item.paymentId)));
    toast(`${ids.length} payment${ids.length === 1 ? "" : "s"} removed`, "info");
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
        rowIds={rows.map((item) => item.paymentId)}
        onDeleteSelected={removeMany}
        onRowClick={(id) => setEditing(payments.find((item) => item.paymentId === id) ?? null)}
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
      {editing !== null && <PaymentModal initial={editing === "new" ? null : editing} customers={customers} count={payments.length} paymentModes={optionList(settings, "paymentModes")} onClose={() => setEditing(null)} onSave={save} />}
    </div>
  );
}

const NEW_PURCHASE = "__new__";
const purchaseLabelOf = (p: Purchase) => [p.productBrand, p.productModel].filter(Boolean).join(" ").trim() || "Purchase";

function PaymentModal({ initial, customers, count, paymentModes, onClose, onSave }: { readonly initial: Payment | null; readonly customers: Customer[]; readonly count: number; readonly paymentModes: string[]; readonly onClose: () => void; readonly onSave: (payment: Payment) => void }) {
  // A payment mirrored from a customer purchase is bound to that customer & purchase.
  const linked = Boolean(initial?.purchaseId);
  const [customerId, setCustomerId] = useState(initial?.customerId ?? customers[0]?.customerId ?? "");
  const customer = customers.find((c) => c.customerId === customerId);
  const purchases = customer?.purchases ?? [];
  // For a fresh payment, default to (and prefill from) the customer's first purchase.
  const seedPurchase = initial ? undefined : purchases[0];
  // Which purchase this payment applies to — an existing purchase id, or a new one.
  const [purchaseChoice, setPurchaseChoice] = useState<string>(initial?.purchaseId ?? seedPurchase?.purchaseId ?? NEW_PURCHASE);
  const [invoiceNumber, setInvoiceNumber] = useState(initial?.invoiceNumber ?? "");
  const [invoiceAmount, setInvoiceAmount] = useState(initial ? String(initial.invoiceAmount) : seedPurchase ? String(seedPurchase.price || 0) : "");
  const [paidAmount, setPaidAmount] = useState(initial ? String(initial.paidAmount) : seedPurchase ? String(seedPurchase.advancePaid || 0) : "");
  const [dueDate, setDueDate] = useState(initial?.dueDate ?? seedPurchase?.dueDate ?? new Date().toISOString().slice(0, 10));
  const [paymentMode, setPaymentMode] = useState<PaymentMode | "">(initial?.paymentMode ?? seedPurchase?.paymentMode ?? "");
  const [error, setError] = useState("");

  const { balance, status } = useMemo(() => {
    const inv = Math.max(0, Number(invoiceAmount) || 0);
    const paid = Math.max(0, Number(paidAmount) || 0);
    return { balance: inv - paid, status: statusFor(inv, paid) };
  }, [invoiceAmount, paidAmount]);

  // Prefill the money fields from a chosen purchase (only when recording a new payment;
  // when editing we keep whatever is already entered).
  function choosePurchase(list: Purchase[], pid: string, prefill: boolean) {
    setPurchaseChoice(pid);
    if (!prefill) return;
    const p = list.find((x) => x.purchaseId === pid);
    setInvoiceAmount(p ? String(p.price || 0) : "");
    setPaidAmount(p ? String(p.advancePaid || 0) : "");
    setDueDate(p?.dueDate ?? new Date().toISOString().slice(0, 10));
    setPaymentMode(p?.paymentMode ?? "");
  }

  function pickCustomer(id: string) {
    setCustomerId(id);
    const list = customers.find((x) => x.customerId === id)?.purchases ?? [];
    choosePurchase(list, list[0]?.purchaseId ?? NEW_PURCHASE, !initial);
  }

  function submit() {
    if (!customerId) return setError("Select a customer.");
    const inv = Math.max(0, Number(invoiceAmount) || 0);
    if (inv <= 0) return setError("Enter the invoice amount.");
    const paid = Math.min(inv, Math.max(0, Number(paidAmount) || 0));
    // Bind the payment to a customer purchase (existing or a fresh one) so Customers,
    // Orders and Payments all stay in step — the client never re-enters this anywhere.
    const useExisting = purchaseChoice !== NEW_PURCHASE && purchases.some((p) => p.purchaseId === purchaseChoice);
    const purchaseId = useExisting ? purchaseChoice : initial?.purchaseId ?? `PUR-${Date.now()}-${Math.floor(Math.random() * 1e4)}`;
    const chosen = purchases.find((p) => p.purchaseId === purchaseId);
    onSave({
      paymentId: purchasePaymentId(purchaseId),
      customerId,
      invoiceNumber: invoiceNumber.trim() || `RC/INV/2026/${String(count + 1).padStart(3, "0")}`,
      invoiceAmount: inv,
      paidAmount: paid,
      balanceAmount: inv - paid,
      dueDate,
      status: statusFor(inv, paid),
      purchaseId,
      productLabel: chosen ? purchaseLabelOf(chosen) : initial?.productLabel,
      paymentMode: paymentMode || undefined,
      createdAt: initial?.createdAt ?? new Date().toISOString()
    });
  }

  return (
    <Modal title={initial ? "Update Payment" : "Record Payment"} size="lg" onClose={onClose}>
        <div className="grid gap-4 md:grid-cols-2">
          <p className="md:col-span-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700">
            This payment is saved on the customer, so it updates the customer&apos;s balance and their order automatically — no need to re-enter it anywhere.
          </p>
          <label className="text-sm font-semibold text-slate-700">
            Customer
            <select value={customerId} disabled={linked} onChange={(e) => pickCustomer(e.target.value)} className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 font-normal outline-none ring-blue-500 focus:ring-2 disabled:bg-slate-100 disabled:text-slate-500">
              {customers.map((c) => (
                <option key={c.customerId} value={c.customerId}>{c.companyName || c.customerName}</option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Against
            <select value={purchaseChoice} disabled={linked} onChange={(e) => choosePurchase(purchases, e.target.value, !initial)} className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 font-normal outline-none ring-blue-500 focus:ring-2 disabled:bg-slate-100 disabled:text-slate-500">
              {purchases.map((p) => (
                <option key={p.purchaseId} value={p.purchaseId}>{purchaseLabelOf(p)} — bal {currency(Math.max(0, (p.price || 0) - (p.advancePaid || 0)))}</option>
              ))}
              <option value={NEW_PURCHASE}>➕ New purchase / general payment</option>
            </select>
          </label>
          <Field label="Invoice No" value={invoiceNumber} onChange={setInvoiceNumber} />
          <Field label="Due Date" value={dueDate} onChange={setDueDate} type="date" />
          <Field label="Invoice Amount (₹)" value={invoiceAmount} onChange={setInvoiceAmount} type="number" />
          <Field label="Paid Amount (₹)" value={paidAmount} onChange={setPaidAmount} type="number" />
          <label className="text-sm font-semibold text-slate-700">
            Payment Mode
            <select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value as PaymentMode | "")} className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 font-normal outline-none ring-blue-500 focus:ring-2">
              <option value="">— Select —</option>
              {paymentModes.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </label>
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
    </Modal>
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
