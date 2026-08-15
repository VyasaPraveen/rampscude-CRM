"use client";

import { Pencil, Plus, Printer, Save } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import type { CompanySettings, Customer, Order, OrderStatus, PaymentMode, PaymentStatus, Product } from "@/types/crm";
import { Badge, DataTable, DeleteButton, Modal } from "@/components/ui";
import { useToast } from "@/components/toast";
import { downloadOrderPdf } from "@/lib/export";
import { optionList } from "@/lib/options";
import { currency, shortDate } from "@/utils/format";

const orderBalance = (order: Order) => Math.max(0, (order.amount ?? 0) - (order.advancePaid ?? 0));

/** Sentinel value for the "type it myself" option in the product dropdown. */
const CUSTOM_PRODUCT = "__custom_product__";

const ORDER_STATUSES: OrderStatus[] = ["Processing", "Ready", "Delivered", "Cancelled"];
const PAYMENT_STATUSES: PaymentStatus[] = ["Pending", "Partial", "Paid"];

export function OrdersView({ orders, customers, products, settings, query, onChange }: { readonly orders: Order[]; readonly customers: Customer[]; readonly products: Product[]; readonly settings: CompanySettings; readonly query: string; readonly onChange: (orders: Order[]) => void }) {
  const toast = useToast();
  const [editing, setEditing] = useState<Order | null | "new">(null);
  const nameOf = (id: string) => {
    const c = customers.find((item) => item.customerId === id);
    return c ? c.companyName || c.customerName : id;
  };

  async function printOrder(order: Order) {
    try {
      await downloadOrderPdf(order, customers.find((c) => c.customerId === order.customerId), settings);
      toast(`Order sheet generated for ${order.orderNumber}`);
    } catch {
      toast("Could not generate the order sheet.", "info");
    }
  }

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
        columns={["Order", "Customer", "Product", "Amount", "Advance", "Balance", "Delivery", "Payment", "Mode", "Status", "Action"]}
        rowIds={rows.map((item) => item.orderId)}
        onDeleteSelected={removeMany}
        onRowClick={(id) => setEditing(orders.find((item) => item.orderId === id) ?? null)}
        rows={rows.map((item) => [
          <span key="o" className="font-semibold text-slate-900">{item.orderNumber}</span>,
          nameOf(item.customerId),
          item.productLabel || item.quotationId || "—",
          typeof item.amount === "number" ? currency(item.amount) : "—",
          typeof item.advancePaid === "number" ? currency(item.advancePaid) : "—",
          typeof item.amount === "number" ? currency(orderBalance(item)) : "—",
          item.deliveryDate ? shortDate(item.deliveryDate) : "—",
          <Badge key="p" label={item.paymentStatus} />,
          item.paymentMode || "—",
          <Badge key="s" label={item.status} />,
          <div key="actions" className="flex items-center gap-2">
            <button onClick={() => setEditing(item)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:border-blue-300">
              <Pencil className="h-3.5 w-3.5" /> Edit
            </button>
            <button onClick={() => printOrder(item)} title="Print A5 order sheet" className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:border-slate-300">
              <Printer className="h-3.5 w-3.5" /> Print
            </button>
            <DeleteButton resetKey={item.orderId} onDelete={() => remove(item)} />
          </div>
        ])}
      />
      {editing !== null && <OrderModal initial={editing === "new" ? null : editing} customers={customers} products={products} count={orders.length} paymentModes={optionList(settings, "paymentModes")} onClose={() => setEditing(null)} onSave={save} />}
    </div>
  );
}

function OrderModal({ initial, customers, products, count, paymentModes, onClose, onSave }: { readonly initial: Order | null; readonly customers: Customer[]; readonly products: Product[]; readonly count: number; readonly paymentModes: string[]; readonly onClose: () => void; readonly onSave: (order: Order) => void }) {
  // Inventory-backed product picker: unique "Brand Model" labels with their sale price,
  // so New Order suggests real stock and can auto-fill the price on an exact match.
  const catalog = useMemo(() => {
    const map = new Map<string, number>();
    products.forEach((p) => {
      const label = `${p.brand} ${p.model}`.trim();
      if (label && !map.has(label)) map.set(label, p.price || 0);
    });
    return map;
  }, [products]);
  const catalogLabels = useMemo(() => [...catalog.keys()].sort((a, b) => a.localeCompare(b)), [catalog]);
  // Pre-fill the product AND price from the customer's saved details so nothing is
  // re-typed. Price comes from the customer's purchase (the same source auto-generated
  // orders use); the label falls back to the customer's product fields carried from the lead.
  const customerDefaults = (id: string): { label: string; price: string } => {
    const c = customers.find((item) => item.customerId === id);
    if (!c) return { label: "", price: "" };
    const purchase = (c.purchases ?? [])[0];
    const label =
      [purchase?.productBrand, purchase?.productModel].filter(Boolean).join(" ").trim() ||
      [c.productBrand, c.productModel].filter(Boolean).join(" ").trim();
    return { label, price: purchase?.price ? String(purchase.price) : "" };
  };
  const seed = initial ? { label: "", price: "" } : customerDefaults(customers[0]?.customerId ?? "");
  const [customerId, setCustomerId] = useState(initial?.customerId ?? customers[0]?.customerId ?? "");
  const [productLabel, setProductLabel] = useState(initial?.productLabel ?? seed.label);
  const [amount, setAmount] = useState(typeof initial?.amount === "number" ? String(initial.amount) : seed.price);
  // Remember the last auto-applied values so switching customers refreshes fields the
  // user hasn't hand-edited, without clobbering anything they typed themselves.
  const autoRef = useRef(seed);
  // "Other (type manually)" is forced on when the user explicitly picks it; it also
  // turns on automatically whenever the current label isn't one of the stock items.
  const [forceCustom, setForceCustom] = useState(false);
  const [advancePaid, setAdvancePaid] = useState(typeof initial?.advancePaid === "number" ? String(initial.advancePaid) : "");
  const [paymentMode, setPaymentMode] = useState<PaymentMode | "">(initial?.paymentMode ?? "");
  const [quotationId, setQuotationId] = useState(initial?.quotationId ?? "");
  const [deliveryDate, setDeliveryDate] = useState(initial?.deliveryDate ?? new Date().toISOString().slice(0, 10));
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>(initial?.paymentStatus ?? "Pending");
  const [status, setStatus] = useState<OrderStatus>(initial?.status ?? "Processing");
  const [error, setError] = useState("");
  // Money on a purchase-linked order is owned by the customer/payment — edit it there.
  const linked = Boolean(initial?.purchaseId);
  // Show the free-text box when the user chose "Other", or when the current label is a
  // one-off that isn't in the stock catalog (so an existing custom order still edits).
  const showCustomProduct = forceCustom || (productLabel.trim() !== "" && !catalog.has(productLabel.trim()));

  function pickCustomer(id: string) {
    setCustomerId(id);
    if (initial) return;
    const next = customerDefaults(id);
    // Replace only fields still holding the previous customer's auto value.
    setProductLabel((cur) => (cur === autoRef.current.label ? next.label : cur));
    setAmount((cur) => (cur === autoRef.current.price ? next.price : cur));
    autoRef.current = next;
  }

  // Choosing a stock item from the catalog fills the price when it is still blank
  // (or holds an earlier auto value), without ever clobbering a hand-typed price.
  function pickProduct(label: string) {
    setProductLabel(label);
    const price = catalog.get(label.trim());
    if (price == null) return;
    const priceText = String(price);
    setAmount((cur) => (cur === "" || cur === autoRef.current.price ? priceText : cur));
    autoRef.current = { ...autoRef.current, price: priceText };
  }

  function submit() {
    if (!customerId) return setError("Select a customer.");
    const amt = Math.max(0, Number(amount) || 0);
    const adv = Math.min(amt, Math.max(0, Number(advancePaid) || 0));
    onSave({
      orderId: initial?.orderId ?? `ORD-${Date.now()}`,
      orderNumber: initial?.orderNumber ?? `RC-ORD-2026-${String(count + 1).padStart(3, "0")}`,
      quotationId: quotationId.trim(),
      customerId,
      deliveryDate,
      paymentStatus,
      status,
      purchaseId: initial?.purchaseId,
      productLabel: productLabel.trim() || undefined,
      amount: amt || undefined,
      advancePaid: adv || undefined,
      paymentMode: paymentMode || undefined,
      createdAt: initial?.createdAt ?? new Date().toISOString()
    });
  }

  return (
    <Modal title={initial ? "Edit Order" : "New Order"} size="lg" onClose={onClose}>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-semibold text-slate-700 md:col-span-2">
            Customer
            <select value={customerId} onChange={(e) => pickCustomer(e.target.value)} className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 font-normal outline-none ring-blue-500 focus:ring-2">
              {customers.map((c) => (
                <option key={c.customerId} value={c.customerId}>{c.companyName || c.customerName}</option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Product / Model
            {catalogLabels.length > 0 && (
              <select
                value={showCustomProduct ? CUSTOM_PRODUCT : productLabel}
                onChange={(event) => {
                  const value = event.target.value;
                  if (value === CUSTOM_PRODUCT) {
                    setForceCustom(true);
                  } else {
                    setForceCustom(false);
                    pickProduct(value);
                  }
                }}
                className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 font-normal outline-none ring-blue-500 focus:ring-2"
              >
                <option value="">— Select product —</option>
                {catalogLabels.map((label) => (
                  <option key={label} value={label}>{label}</option>
                ))}
                <option value={CUSTOM_PRODUCT}>✏️ Other (type manually)</option>
              </select>
            )}
            {(showCustomProduct || catalogLabels.length === 0) && (
              <input
                value={productLabel}
                onChange={(event) => setProductLabel(event.target.value)}
                placeholder="Type the product / model"
                className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 font-normal outline-none ring-blue-500 focus:ring-2"
              />
            )}
          </label>
          <TextField label="Price (₹, incl. GST)" value={amount} onChange={setAmount} type="number" />
          <TextField label="Advance Paid (₹)" value={advancePaid} onChange={setAdvancePaid} type="number" />
          <SelectField label="Payment Mode" value={paymentMode} options={["", ...paymentModes]} onChange={(v) => setPaymentMode(v as PaymentMode | "")} />
          {linked && <p className="md:col-span-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700">This order mirrors a customer purchase — its price/advance are best edited on the customer or in Payments.</p>}
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
