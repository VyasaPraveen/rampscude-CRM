"use client";

import { Boxes, Pencil, Save } from "lucide-react";
import { useState } from "react";
import type { Brand, CompanySettings, Product, ProductType } from "@/types/crm";
import { Badge, DataTable, DeleteButton, Modal } from "@/components/ui";
import { useToast } from "@/components/toast";
import { PRODUCT_TYPES, uniqueSorted } from "@/lib/options";
import { currency } from "@/utils/format";

/** Inventory: purchased stock units with brand, model, serial, price and purchase invoice. */
export function InventoryView({
  products,
  brands,
  settings,
  query,
  onChange
}: {
  readonly products: Product[];
  readonly brands: Brand[];
  readonly settings: CompanySettings;
  readonly query: string;
  readonly onChange: (products: Product[]) => void;
}) {
  const toast = useToast();
  const [editing, setEditing] = useState<Product | null | "new">(null);

  const rows = products.filter((item) =>
    `${item.brand} ${item.model} ${item.serialNo} ${item.purchaseFrom} ${item.productType ?? ""}`.toLowerCase().includes(query.toLowerCase())
  );

  function save(product: Product) {
    const exists = products.some((item) => item.productId === product.productId);
    onChange(exists ? products.map((item) => (item.productId === product.productId ? product : item)) : [product, ...products]);
    setEditing(null);
    toast(exists ? `${product.brand} ${product.model} updated` : `${product.brand} ${product.model} added to inventory`);
  }

  function remove(product: Product) {
    onChange(products.filter((item) => item.productId !== product.productId));
    toast(`${product.brand} ${product.model} removed`, "info");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">{products.length} items in stock</p>
        <button onClick={() => setEditing("new")} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-soft">
          <Boxes className="h-4 w-4" /> Add Item
        </button>
      </div>
      <DataTable
        columns={["Brand", "Model", "Type", "Qty", "Purchase", "Sale", "Status", "Action"]}
        rows={rows.map((item) => [
          <span key="b" className="font-semibold text-slate-900">{item.brand}</span>,
          item.model,
          item.productType || "—",
          item.quantity ?? 1,
          typeof item.purchasePrice === "number" ? currency(item.purchasePrice) : "—",
          currency(item.price),
          item.saleDate ? <Badge key="st" label="Sold" /> : <Badge key="st" label="In Stock" />,
          <div key="actions" className="flex items-center gap-2">
            <button
              onClick={() => setEditing(item)}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:border-blue-300"
            >
              <Pencil className="h-3.5 w-3.5" /> Edit
            </button>
            <DeleteButton resetKey={item.productId} onDelete={() => remove(item)} />
          </div>
        ])}
      />
      {editing !== null && (
        <InventoryModal initial={editing === "new" ? null : editing} brands={brands} settings={settings} onClose={() => setEditing(null)} onSave={save} />
      )}
    </div>
  );
}

type Draft = {
  brand: string;
  model: string;
  serialNo: string;
  productType: string;
  gstRate: string;
  quantity: string;
  purchasePrice: string;
  cutoffPrice: string;
  price: string;
  nlc: string;
  purchaseFrom: string;
  invoiceName: string;
  invoiceDate: string;
  saleDate: string;
  saleInvoiceNo: string;
  soldToName: string;
  soldToTown: string;
  referredBy: string;
  commission: string;
};

const numOrUndefined = (value: string): number | undefined => {
  const text = value.trim();
  if (!text) return undefined;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : undefined;
};

function toDraft(product: Product | null): Draft {
  return {
    brand: product?.brand ?? "",
    model: product?.model ?? "",
    serialNo: product?.serialNo ?? "",
    productType: product?.productType ?? "",
    gstRate: typeof product?.gstRate === "number" ? String(product.gstRate) : "",
    quantity: typeof product?.quantity === "number" ? String(product.quantity) : "1",
    purchasePrice: typeof product?.purchasePrice === "number" ? String(product.purchasePrice) : "",
    cutoffPrice: typeof product?.cutoffPrice === "number" ? String(product.cutoffPrice) : "",
    price: product ? String(product.price) : "",
    nlc: typeof product?.nlc === "number" ? String(product.nlc) : "",
    purchaseFrom: product?.purchaseFrom ?? "",
    invoiceName: product?.invoiceName ?? "",
    invoiceDate: product?.invoiceDate ?? new Date().toISOString().slice(0, 10),
    saleDate: product?.saleDate ?? "",
    saleInvoiceNo: product?.saleInvoiceNo ?? "",
    soldToName: product?.soldToName ?? "",
    soldToTown: product?.soldToTown ?? "",
    referredBy: product?.referredBy ?? "",
    commission: typeof product?.commission === "number" ? String(product.commission) : ""
  };
}

function InventoryModal({
  initial,
  brands,
  settings,
  onClose,
  onSave
}: {
  readonly initial: Product | null;
  readonly brands: Brand[];
  readonly settings: CompanySettings;
  readonly onClose: () => void;
  readonly onSave: (product: Product) => void;
}) {
  const [form, setForm] = useState<Draft>(toDraft(initial));
  const [error, setError] = useState("");
  // Active brands from the Brands module, plus this item's own brand so editing never loses it.
  const brandOptions = uniqueSorted([...brands.filter((b) => b.active).map((b) => b.name), initial?.brand]);

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function submit() {
    if (form.brand.trim().length < 1) return setError("Brand is required.");
    if (form.model.trim().length < 1) return setError("Model is required.");
    onSave({
      productId: initial?.productId ?? `PROD-${Date.now()}`,
      brand: form.brand.trim(),
      model: form.model.trim(),
      serialNo: form.serialNo.trim(),
      productType: (form.productType || undefined) as ProductType | undefined,
      gstRate: form.gstRate === "" ? undefined : Number(form.gstRate),
      quantity: Math.max(1, Math.round(Number(form.quantity) || 1)),
      purchasePrice: numOrUndefined(form.purchasePrice),
      cutoffPrice: numOrUndefined(form.cutoffPrice),
      price: Math.max(0, Number(form.price) || 0),
      nlc: numOrUndefined(form.nlc),
      purchaseFrom: form.purchaseFrom.trim(),
      invoiceName: form.invoiceName.trim(),
      invoiceDate: form.invoiceDate,
      saleDate: form.saleDate || undefined,
      saleInvoiceNo: form.saleInvoiceNo.trim() || undefined,
      soldToName: form.soldToName.trim() || undefined,
      soldToTown: form.soldToTown.trim() || undefined,
      referredBy: form.referredBy.trim() || undefined,
      commission: numOrUndefined(form.commission),
      createdAt: initial?.createdAt ?? new Date().toISOString()
    });
  }

  return (
    <Modal title={initial ? "Edit Inventory Item" : "Add Inventory Item"} size="xl" onClose={onClose}>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-semibold text-slate-700">
            Brand *
            <select value={form.brand} onChange={(e) => set("brand", e.target.value)} className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 font-normal outline-none ring-blue-500 focus:ring-2">
              <option value="">— Select —</option>
              {brandOptions.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
            {brandOptions.length === 0 && (
              <span className="mt-1 block text-xs font-normal text-amber-600">No active brands — add one in the Brands module first.</span>
            )}
          </label>
          <Field label="Model *" value={form.model} onChange={(v) => set("model", v)} />
          <Field label="Serial No" value={form.serialNo} onChange={(v) => set("serialNo", v)} />
          <label className="text-sm font-semibold text-slate-700">
            Product Type
            <select value={form.productType} onChange={(e) => set("productType", e.target.value)} className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 font-normal outline-none ring-blue-500 focus:ring-2">
              <option value="">— Select —</option>
              {PRODUCT_TYPES.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-700">
            GST Slab
            <select value={form.gstRate} onChange={(e) => set("gstRate", e.target.value)} className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 font-normal outline-none ring-blue-500 focus:ring-2">
              <option value="">Use brand / company default</option>
              {(settings.gstSlabs ?? []).map((rate) => (
                <option key={rate} value={rate}>{rate}%</option>
              ))}
            </select>
          </label>
          <Field label="Quantity" value={form.quantity} onChange={(v) => set("quantity", v)} type="number" />
          <Field label="Purchase Price (₹)" value={form.purchasePrice} onChange={(v) => set("purchasePrice", v)} type="number" />
          <Field label="NLC — Net Landing Cost (₹)" value={form.nlc} onChange={(v) => set("nlc", v)} type="number" />
          <Field label="Cut-off Price (₹)" value={form.cutoffPrice} onChange={(v) => set("cutoffPrice", v)} type="number" />
          <Field label="Sale Price (₹)" value={form.price} onChange={(v) => set("price", v)} type="number" />
          <Field label="Purchased From" value={form.purchaseFrom} onChange={(v) => set("purchaseFrom", v)} />
          <Field label="Invoice Name / No" value={form.invoiceName} onChange={(v) => set("invoiceName", v)} />
          <Field label="Purchase Date" value={form.invoiceDate} onChange={(v) => set("invoiceDate", v)} type="date" />
        </div>

        <div className="mt-6">
          <h3 className="mb-1 text-sm font-bold uppercase tracking-wide text-slate-500">Sale details</h3>
          <p className="mb-3 text-xs text-slate-500">Fill these in once the unit is sold — it then appears as “Sold” in the stock report.</p>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Sale Date" value={form.saleDate} onChange={(v) => set("saleDate", v)} type="date" />
            <Field label="Sale Invoice No" value={form.saleInvoiceNo} onChange={(v) => set("saleInvoiceNo", v)} />
            <Field label="Customer Name" value={form.soldToName} onChange={(v) => set("soldToName", v)} />
            <Field label="Customer Town" value={form.soldToTown} onChange={(v) => set("soldToTown", v)} />
            <Field label="By Ref (Technician / Sub Dealer…)" value={form.referredBy} onChange={(v) => set("referredBy", v)} />
            <Field label="Commission (₹)" value={form.commission} onChange={(v) => set("commission", v)} type="number" />
          </div>
        </div>
        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 font-semibold">Cancel</button>
          <button type="button" onClick={submit} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white">
            <Save className="h-4 w-4" /> Save Item
          </button>
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
