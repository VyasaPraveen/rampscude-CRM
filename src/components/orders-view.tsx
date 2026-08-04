"use client";

import { Pencil, Plus, Save } from "lucide-react";
import { useState } from "react";
import type { Customer, Order, OrderStatus, PaymentStatus } from "@/types/crm";
import { Badge, DataTable, DeleteButton, Modal } from "@/components/ui";
import { useToast } from "@/components/toast";
import { currency, shortDate } from "@/utils/format";

const orderBalance = (order: Order) => Math.max(0, (order.amount ?? 0) - (order.advancePaid ?? 0));

const ORDER_STATUSES: OrderStatus[] = ["Processing", "Ready", "Delivered", "Cancelled"];
const PAYMENT_STATUSES: PaymentStatus[] = ["Pending", "Partial", "Paid"];

export function OrdersView({ orders, customers, query, onChange }: { readonly orders: Order[]; readonly customers: Customer[]; readonly query: string; readonly onChange: (orders: Order[]) => void }) {
  const toast = useToast();
  const [editing, setEditing] = useState<Order | null | "new">(null);
  const nameOf = (id: string) => {
    const c = customers.find((item) => item.customerId === id);
    return c ? c.companyName || c.customerName : id;
  };

  const rows = orders.filter((item) => `${item.orderNumber} ${nameOf(item.customerId)}`.toLowerCase().includes(query.toLowerCase()));

  function save(order: Order) {
    const exists = orders.some((item) => item.orderId === order.orderId);
    onChange(exists ? orders.map((item) => (item.orderId === order.orderId ? order : item)) : [order, ...orders]);
    setEditing(null);
    toast(exists ? `${order.orderNumber} updated` : `${order.orderNumber} created`);
  }

  function remove(order: Order) {
    onChange(orders.filter((item) => item.orderId !== order.orderId));
    toast(`${order.orderNumber} removed`, "info");
  }

  function removeMany(ids: string[]) {
    const set = new Set(ids);
    onChange(orders.filter((item) => !set.has(item.orderId)));
    toast(`${ids.length} order${ids.length === 1 ? "" : "s"} removed`, "info");
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setEditing("new")} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-soft">
          <Plus className="h-4 w-4" /> New Order
        </button>
      </div>
      <DataTable
        columns={["Order", "Customer", "Product", "Amount", "Advance", "Balance", "Delivery", "Payment", "Status", "Action"]}
        rowIds={rows.map((item) => item.orderId)}
        onDeleteSelected={removeMany}
        rows={rows.map((item) => [
          <span key="o" className="font-semibold text-slate-900">{item.orderNumber}</span>,
          nameOf(item.customerId),
          item.productLabel || item.quotationId || "—",
          typeof item.amount === "number" ? currency(item.amount) : "—",
          typeof item.advancePaid === "number" ? currency(item.advancePaid) : "—",
          typeof item.amount === "number" ? currency(orderBalance(item)) : "—",
          item.deliveryDate ? shortDate(item.deliveryDate) : "—",
          <Badge key="p" label={item.paymentStatus} />,
          <Badge key="s" label={item.status} />,
          <div key="actions" className="flex items-center gap-2">
            <button onClick={() => setEditing(item)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:border-blue-300">
              <Pencil className="h-3.5 w-3.5" /> Edit
            </button>
            <DeleteButton resetKey={item.orderId} onDelete={() => remove(item)} />
          </div>
        ])}
      />
      {editing !== null && <OrderModal initial={editing === "new" ? null : editing} customers={customers} count={orders.length} onClose={() => setEditing(null)} onSave={save} />}
    </div>
  );
}

function OrderModal({ initial, customers, count, onClose, onSave }: { readonly initial: Order | null; readonly customers: Customer[]; readonly count: number; readonly onClose: () => void; readonly onSave: (order: Order) => void }) {
  const [customerId, setCustomerId] = useState(initial?.customerId ?? customers[0]?.customerId ?? "");
  const [quotationId, setQuotationId] = useState(initial?.quotationId ?? "");
  const [deliveryDate, setDeliveryDate] = useState(initial?.deliveryDate ?? new Date().toISOString().slice(0, 10));
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>(initial?.paymentStatus ?? "Pending");
  const [status, setStatus] = useState<OrderStatus>(initial?.status ?? "Processing");
  const [error, setError] = useState("");

  function submit() {
    if (!customerId) return setError("Select a customer.");
    onSave({
      orderId: initial?.orderId ?? `ORD-${Date.now()}`,
      orderNumber: initial?.orderNumber ?? `RC-ORD-2026-${String(count + 1).padStart(3, "0")}`,
      quotationId: quotationId.trim(),
      customerId,
      deliveryDate,
      paymentStatus,
      status,
      createdAt: initial?.createdAt ?? new Date().toISOString()
    });
  }

  return (
    <Modal title={initial ? "Edit Order" : "New Order"} size="lg" onClose={onClose}>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-semibold text-slate-700 md:col-span-2">
            Customer
            <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 font-normal outline-none ring-blue-500 focus:ring-2">
              {customers.map((c) => (
                <option key={c.customerId} value={c.customerId}>{c.companyName || c.customerName}</option>
              ))}
            </select>
          </label>
          <TextField label="Quotation Ref" value={quotationId} onChange={setQuotationId} />
          <TextField label="Delivery Date" value={deliveryDate} onChange={setDeliveryDate} type="date" />
          <SelectField label="Payment Status" value={paymentStatus} options={PAYMENT_STATUSES} onChange={(v) => setPaymentStatus(v as PaymentStatus)} />
          <SelectField label="Order Status" value={status} options={ORDER_STATUSES} onChange={(v) => setStatus(v as OrderStatus)} />
        </div>
        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 font-semibold">Cancel</button>
          <button type="button" onClick={submit} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white"><Save className="h-4 w-4" /> Save Order</button>
        </div>
    </Modal>
  );
}

function TextField({ label, value, onChange, type = "text" }: { readonly label: string; readonly value: string; readonly onChange: (value: string) => void; readonly type?: string }) {
  return (
    <label className="text-sm font-semibold text-slate-700">
      {label}
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 font-normal outline-none ring-blue-500 focus:ring-2" />
    </label>
  );
}

function SelectField({ label, value, options, onChange }: { readonly label: string; readonly value: string; readonly options: readonly string[]; readonly onChange: (value: string) => void }) {
  return (
    <label className="text-sm font-semibold text-slate-700">
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 font-normal outline-none ring-blue-500 focus:ring-2">
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}
