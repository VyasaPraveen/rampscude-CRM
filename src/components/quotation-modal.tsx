"use client";

import { Plus, Save, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { Customer, Product, Quotation, QuotationStatus } from "@/types/crm";
import { productLabel } from "@/types/crm";
import { currency } from "@/utils/format";

const STATUSES: QuotationStatus[] = ["Draft", "Sent", "Accepted", "Rejected"];
const GST_RATE = 0.18;

type LineItem = { productId: string; quantity: number; price: number };

function nextQuotationNumber(existing: Quotation[]): string {
  const seq = existing.length + 1;
  return `RC/QTN/2026/${String(seq).padStart(3, "0")}`;
}

/**
 * Create or edit a quotation. Totals (subtotal, GST, total) recompute live from
 * the line items and discount so the figures always stay consistent.
 */
export function QuotationModal({
  quotation,
  customers,
  products,
  existing,
  onClose,
  onSave
}: {
  readonly quotation: Quotation | null;
  readonly customers: Customer[];
  readonly products: Product[];
  readonly existing: Quotation[];
  readonly onClose: () => void;
  readonly onSave: (quotation: Quotation) => void;
}) {
  const isEdit = Boolean(quotation);
  const [customerId, setCustomerId] = useState(quotation?.customerId ?? customers[0]?.customerId ?? "");
  const [reference, setReference] = useState(quotation?.reference ?? "");
  const [status, setStatus] = useState<QuotationStatus>(quotation?.status ?? "Draft");
  const [discount, setDiscount] = useState<number>(quotation?.discount ?? 0);
  const [items, setItems] = useState<LineItem[]>(
    quotation?.products.length
      ? quotation.products.map((line) => ({ ...line }))
      : [{ productId: products[0]?.productId ?? "", quantity: 1, price: products[0]?.price ?? 0 }]
  );
  const [error, setError] = useState("");

  const { subtotal, gst, total, effectiveDiscount } = useMemo(() => {
    const sub = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const capped = Math.min(discount, sub); // a discount can never exceed the subtotal
    const taxable = sub - capped;
    const tax = Math.round(taxable * GST_RATE);
    return { subtotal: sub, gst: tax, total: taxable + tax, effectiveDiscount: capped };
  }, [items, discount]);

  function updateItem(index: number, patch: Partial<LineItem>) {
    setItems((current) => current.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function setProduct(index: number, productId: string) {
    const product = products.find((p) => p.productId === productId);
    updateItem(index, { productId, price: product?.price ?? 0 });
  }

  function addItem() {
    const product = products[0];
    setItems((current) => [...current, { productId: product?.productId ?? "", quantity: 1, price: product?.price ?? 0 }]);
  }

  function removeItem(index: number) {
    setItems((current) => (current.length > 1 ? current.filter((_, i) => i !== index) : current));
  }

  function submit() {
    if (!customerId) {
      setError("Select a customer.");
      return;
    }
    if (items.some((item) => !item.productId || item.quantity < 1)) {
      setError("Every line item needs a product and quantity of at least 1.");
      return;
    }
    onSave({
      quotationId: quotation?.quotationId ?? `QUO-${Date.now()}`,
      quotationNumber: quotation?.quotationNumber ?? nextQuotationNumber(existing),
      reference: reference.trim() || undefined,
      customerId,
      products: items,
      subtotal,
      discount: effectiveDiscount,
      gst,
      total,
      status,
      createdAt: quotation?.createdAt ?? new Date().toISOString()
    });
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-auto rounded-lg bg-white p-6 shadow-2xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">{isEdit ? "Edit Quotation" : "New Quotation"}</h2>
            {quotation && <p className="text-sm text-slate-500">{quotation.quotationNumber}</p>}
          </div>
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 p-2" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <label className="text-sm font-semibold text-slate-700 md:col-span-2">
            Customer
            <select
              value={customerId}
              onChange={(event) => setCustomerId(event.target.value)}
              className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 font-normal outline-none ring-blue-500 focus:ring-2"
            >
              {customers.map((customer) => (
                <option key={customer.customerId} value={customer.customerId}>
                  {customer.companyName || customer.customerName}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Status
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as QuotationStatus)}
              className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 font-normal outline-none ring-blue-500 focus:ring-2"
            >
              {STATUSES.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-700 md:col-span-3">
            Quotation Reference No.
            <input
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              placeholder="e.g. PO number, enquiry ref or Tally voucher"
              className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 font-normal outline-none ring-blue-500 focus:ring-2"
            />
          </label>
        </div>

        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Line Items</h3>
            <button type="button" onClick={addItem} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-blue-700">
              <Plus className="h-4 w-4" /> Add item
            </button>
          </div>
          <div className="space-y-3">
            {items.map((item, index) => (
              <div key={index} className="grid items-end gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-[1fr_90px_120px_auto]">
                <label className="text-xs font-semibold text-slate-600">
                  Product
                  <select
                    value={item.productId}
                    onChange={(event) => setProduct(index, event.target.value)}
                    className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-2 text-sm font-normal outline-none ring-blue-500 focus:ring-2"
                  >
                    {products.map((product) => (
                      <option key={product.productId} value={product.productId}>
                        {productLabel(product)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-semibold text-slate-600">
                  Qty
                  <input
                    type="number"
                    min={1}
                    value={item.quantity}
                    onChange={(event) => updateItem(index, { quantity: Math.max(1, Number(event.target.value) || 1) })}
                    className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-2 text-sm font-normal outline-none ring-blue-500 focus:ring-2"
                  />
                </label>
                <label className="text-xs font-semibold text-slate-600">
                  Unit price
                  <input
                    type="number"
                    min={0}
                    value={item.price}
                    onChange={(event) => updateItem(index, { price: Math.max(0, Number(event.target.value) || 0) })}
                    className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-2 text-sm font-normal outline-none ring-blue-500 focus:ring-2"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  className="grid h-10 w-10 place-items-center rounded-lg border border-slate-200 text-slate-400 transition hover:text-red-600 disabled:opacity-40"
                  disabled={items.length === 1}
                  aria-label="Remove item"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-[1fr_260px]">
          <label className="text-sm font-semibold text-slate-700">
            Discount (₹)
            <input
              type="number"
              min={0}
              value={discount}
              onChange={(event) => setDiscount(Math.max(0, Number(event.target.value) || 0))}
              className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 font-normal outline-none ring-blue-500 focus:ring-2"
            />
          </label>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
            <Row label="Subtotal" value={currency(subtotal)} />
            <Row label="Discount" value={`- ${currency(effectiveDiscount)}`} />
            <Row label={`GST (${Math.round(GST_RATE * 100)}%)`} value={currency(gst)} />
            <div className="mt-2 border-t border-slate-200 pt-2">
              <Row label="Total" value={currency(total)} bold />
            </div>
          </div>
        </div>

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 font-semibold">
            Cancel
          </button>
          <button type="button" onClick={submit} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white">
            <Save className="h-4 w-4" /> {isEdit ? "Save changes" : "Create quotation"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { readonly label: string; readonly value: string; readonly bold?: boolean }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className={bold ? "font-bold text-slate-950" : "text-slate-500"}>{label}</span>
      <span className={bold ? "font-bold text-slate-950" : "font-medium text-slate-700"}>{value}</span>
    </div>
  );
}
