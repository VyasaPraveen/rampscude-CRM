"use client";

import { Plus, Save, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import type { Brand, CompanySettings, Lead, Product, Quotation, QuotationStatus } from "@/types/crm";
import { productLabel } from "@/types/crm";
import { currency } from "@/utils/format";
import { Modal } from "@/components/ui";
import { computeTotals, rateForProduct } from "@/lib/gst";

const STATUSES: QuotationStatus[] = ["Draft", "Sent", "Accepted", "Rejected"];

type LineItem = { productId: string; quantity: number; price: number; gstRate?: number };

function nextQuotationNumber(existing: Quotation[]): string {
  // Use the max existing sequence (not the count) so deletions never reuse a number.
  const seq =
    existing.reduce((max, q) => {
      const match = /(\d+)\s*$/.exec(q.quotationNumber);
      return match ? Math.max(max, Number(match[1])) : max;
    }, 0) + 1;
  return `RC/QTN/2026/${String(seq).padStart(3, "0")}`;
}

/**
 * Create or edit a quotation. Totals (subtotal, GST, total) recompute live from
 * the line items and discount so the figures always stay consistent.
 */
export function QuotationModal({
  quotation,
  leads,
  products,
  brands,
  settings,
  existing,
  onClose,
  onSave
}: {
  readonly quotation: Quotation | null;
  readonly leads: Lead[];
  readonly products: Product[];
  readonly brands: Brand[];
  readonly settings: CompanySettings;
  readonly existing: Quotation[];
  readonly onClose: () => void;
  readonly onSave: (quotation: Quotation) => void;
}) {
  const isEdit = Boolean(quotation);
  // Quotations are raised against a lead. An older quotation that only carries a
  // customer id is matched back to the lead it was converted from.
  const initialLeadId =
    quotation?.leadId ??
    (quotation?.customerId ? leads.find((l) => l.convertedCustomerId === quotation.customerId)?.leadId : undefined) ??
    leads[0]?.leadId ??
    "";
  const [leadId, setLeadId] = useState(initialLeadId);
  const [reference, setReference] = useState(quotation?.reference ?? "");
  const [brochureUrl, setBrochureUrl] = useState(quotation?.brochureUrl ?? "");
  const [status, setStatus] = useState<QuotationStatus>(quotation?.status ?? "Draft");
  const [discount, setDiscount] = useState<number>(quotation?.discount ?? 0);
  const [items, setItems] = useState<LineItem[]>(
    quotation?.products.length
      ? quotation.products.map((line) => ({ ...line }))
      : [
          {
            productId: products[0]?.productId ?? "",
            quantity: 1,
            price: products[0]?.price ?? 0,
            gstRate: products[0] ? rateForProduct(products[0], brands, settings) : settings.gstRate
          }
        ]
  );
  const [error, setError] = useState("");

  // Offer the admin's slabs, plus any rate already present on this quotation.
  const slabOptions = [...new Set([...(settings.gstSlabs ?? []), settings.gstRate, ...items.map((line) => line.gstRate ?? -1)])]
    .filter((rate) => typeof rate === "number" && rate >= 0)
    .sort((a, b) => a - b);

  const { gross, taxable, gst, cgst, sgst, total, effectiveDiscount, byRate } = useMemo(
    () =>
      computeTotals(items, discount, (line) => {
        if (typeof line.gstRate === "number") return line.gstRate;
        return rateForProduct(products.find((p) => p.productId === line.productId), brands, settings);
      }),
    [items, discount, products, brands, settings]
  );

  function updateItem(index: number, patch: Partial<LineItem>) {
    setItems((current) => current.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function setProduct(index: number, productId: string) {
    const product = products.find((p) => p.productId === productId);
    updateItem(index, { productId, price: product?.price ?? 0, gstRate: rateForProduct(product, brands, settings) });
  }

  function addItem() {
    const product = products[0];
    setItems((current) => [
      ...current,
      {
        productId: product?.productId ?? "",
        quantity: 1,
        price: product?.price ?? 0,
        gstRate: product ? rateForProduct(product, brands, settings) : settings.gstRate
      }
    ]);
  }

  function removeItem(index: number) {
    setItems((current) => (current.length > 1 ? current.filter((_, i) => i !== index) : current));
  }

  function submit() {
    const lead = leads.find((item) => item.leadId === leadId);
    if (!lead) {
      setError("Select a lead. Create one in the Leads module first.");
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
      leadId: lead.leadId,
      customerLabel: lead.name,
      // Once the lead has been converted, keep the customer linked too.
      customerId: lead.convertedCustomerId ?? "",
      products: items,
      subtotal: taxable,
      discount: effectiveDiscount,
      gst,
      total,
      status,
      brochureUrl: brochureUrl.trim() || undefined,
      createdAt: quotation?.createdAt ?? new Date().toISOString()
    });
  }

  return (
    <Modal title={isEdit ? "Edit Quotation" : "New Quotation"} subtitle={quotation?.quotationNumber} size="xl" onClose={onClose}>

        <div className="grid gap-4 md:grid-cols-3">
          <label className="text-sm font-semibold text-slate-700 md:col-span-2">
            Lead
            <select
              value={leadId}
              onChange={(event) => setLeadId(event.target.value)}
              className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 font-normal outline-none ring-blue-500 focus:ring-2"
            >
              <option value="">— Select a lead —</option>
              {leads.map((lead) => (
                <option key={lead.leadId} value={lead.leadId}>
                  {[lead.name, lead.town, lead.phone].filter(Boolean).join(" · ")}
                  {lead.convertedCustomerId ? " (customer)" : ""}
                </option>
              ))}
            </select>
            {leads.length === 0 && (
              <span className="mt-1 block text-xs font-normal text-amber-600">No leads yet — add one in the Leads module first.</span>
            )}
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
          <label className="text-sm font-semibold text-slate-700 md:col-span-3">
            Brochure Link
            <input
              value={brochureUrl}
              onChange={(event) => setBrochureUrl(event.target.value)}
              placeholder="https://… — shared on the PDF and the WhatsApp message"
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
              <div key={index} className="grid items-end gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-[1fr_80px_110px_96px_auto]">
                <label className="text-xs font-semibold text-slate-600">
                  Product
                  <select
                    value={item.productId}
                    onChange={(event) => setProduct(index, event.target.value)}
                    className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-2 text-sm font-normal outline-none ring-blue-500 focus:ring-2"
                  >
                    <option value="">— Select a product —</option>
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
                  Unit price (incl. GST)
                  <input
                    type="number"
                    min={0}
                    value={item.price}
                    onChange={(event) => updateItem(index, { price: Math.max(0, Number(event.target.value) || 0) })}
                    className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-2 text-sm font-normal outline-none ring-blue-500 focus:ring-2"
                  />
                </label>
                <label className="text-xs font-semibold text-slate-600">
                  GST %
                  <select
                    value={String(item.gstRate ?? rateForProduct(products.find((p) => p.productId === item.productId), brands, settings))}
                    onChange={(event) => updateItem(index, { gstRate: Number(event.target.value) })}
                    className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-2 text-sm font-normal outline-none ring-blue-500 focus:ring-2"
                  >
                    {slabOptions.map((rate) => (
                      <option key={rate} value={rate}>{rate}%</option>
                    ))}
                  </select>
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
            <Row label="Price (incl. GST)" value={currency(gross)} />
            {effectiveDiscount > 0 && <Row label="Discount" value={`- ${currency(effectiveDiscount)}`} />}
            <Row label="Net Amount" value={currency(taxable)} />
            {byRate.length > 1 ? (
              byRate.map((bucket) => (
                <Row key={bucket.rate} label={`CGST + SGST @ ${bucket.rate}%`} value={currency(bucket.tax)} />
              ))
            ) : (
              <>
                <Row label="CGST" value={currency(cgst)} />
                <Row label="SGST" value={currency(sgst)} />
              </>
            )}
            <div className="mt-2 border-t border-slate-200 pt-2">
              <Row label="Total (incl. GST)" value={currency(total)} bold />
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
    </Modal>
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
