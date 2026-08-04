"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2, UserPlus } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { Brand, CustomFieldDef, Customer, PaymentMode, Product, Purchase } from "@/types/crm";
import { Modal } from "@/components/ui";
import { CustomFieldInputs } from "@/components/custom-fields";
import { CUSTOMER_SOURCE_TYPES, PRODUCT_TYPES, uniqueSorted } from "@/lib/options";
import { purchaseBalance } from "@/lib/orders";
import { currency } from "@/utils/format";

const PAYMENT_MODES: PaymentMode[] = ["Cash", "UPI", "Bank Transfer", "Card", "Cheque", "Finance"];

// Only Name and Phone are mandatory; every other customer field is optional.
export const customerSchema = z.object({
  customerName: z.string().min(2, "Name is required"),
  mobile: z.string().min(10, "A valid phone number is required"),
  city: z.string().optional(),
  address: z.string().optional(),
  productModel: z.string().optional(),
  productBrand: z.string().optional(),
  productType: z.string().optional(),
  email: z.string().email("Enter a valid email").optional().or(z.literal("")),
  sourceType: z.string().optional()
});

export type CustomerForm = z.infer<typeof customerSchema>;

export function CustomerModal({ initial, products, brands, customFields, onClose, onSave }: { initial: Customer | null; products: Product[]; brands: Brand[]; customFields?: CustomFieldDef[]; onClose: () => void; onSave: (customer: Customer) => void }) {
  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<CustomerForm>({
    resolver: zodResolver(customerSchema),
    defaultValues: initial
      ? {
          customerName: initial.customerName,
          mobile: initial.mobile,
          city: initial.city,
          address: initial.address,
          productBrand: initial.productBrand,
          productModel: initial.productModel,
          productType: initial.productType ?? "",
          email: initial.email,
          sourceType: initial.sourceType ?? ""
        }
      : undefined
  });

  // Brand / model dropdowns are built from the inventory; the current record's own value
  // is merged in so editing an item whose brand/model is no longer in stock still shows it.
  const brandOptions = uniqueSorted([...brands.filter((b) => b.active).map((b) => b.name), ...products.map((p) => p.brand), initial?.productBrand]);
  const modelOptions = uniqueSorted([...products.map((p) => p.model), initial?.productModel]);

  const [purchases, setPurchases] = useState<Purchase[]>(initial?.purchases ?? []);
  const [custom, setCustom] = useState<Record<string, string>>(initial?.custom ?? {});

  function addPurchase() {
    setPurchases((current) => [
      ...current,
      {
        purchaseId: `PUR-${Date.now()}-${current.length}`,
        productBrand: initial?.productBrand ?? "",
        productModel: initial?.productModel ?? "",
        price: 0,
        advancePaid: 0,
        createdAt: new Date().toISOString()
      }
    ]);
  }

  function updatePurchase(index: number, patch: Partial<Purchase>) {
    setPurchases((current) => current.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function removePurchase(index: number) {
    setPurchases((current) => current.filter((_, i) => i !== index));
  }

  function submit(values: CustomerForm) {
    onSave({
      customerId: initial?.customerId ?? `CUST-${Date.now()}`,
      createdAt: initial?.createdAt ?? new Date().toISOString(),
      whatsapp: initial?.whatsapp,
      companyName: initial?.companyName,
      gst: initial?.gst,
      customerType: initial?.customerType,
      remarks: initial?.remarks,
      customerName: values.customerName,
      mobile: values.mobile,
      city: values.city ?? "",
      address: values.address ?? "",
      productModel: values.productModel ?? "",
      productBrand: values.productBrand ?? "",
      productType: (values.productType || undefined) as Customer["productType"],
      email: values.email ?? "",
      sourceType: (values.sourceType || undefined) as Customer["sourceType"],
      // Drop blank rows (no price and no advance) so an empty line is never saved.
      purchases: purchases.filter((p) => (p.price || 0) > 0 || (p.advancePaid || 0) > 0),
      custom: Object.keys(custom).length ? custom : undefined
    });
  }

  return (
    <Modal title={initial ? "Edit Customer" : "Add Customer"} subtitle="Only Name and Phone are required." size="xl" onClose={onClose}>
      <form onSubmit={handleSubmit(submit)}>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-semibold text-slate-700">
            Name *
            <input className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 font-normal outline-none ring-blue-500 focus:ring-2" {...register("customerName")} />
            {errors.customerName && <span className="mt-1 block text-xs text-red-600">{errors.customerName.message}</span>}
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Phone Number *
            <input className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 font-normal outline-none ring-blue-500 focus:ring-2" {...register("mobile")} />
            {errors.mobile && <span className="mt-1 block text-xs text-red-600">{errors.mobile.message}</span>}
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Town
            <input className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 font-normal outline-none ring-blue-500 focus:ring-2" {...register("city")} />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Address
            <input className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 font-normal outline-none ring-blue-500 focus:ring-2" {...register("address")} />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Product Brand
            <select className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 font-normal outline-none ring-blue-500 focus:ring-2" {...register("productBrand")}>
              <option value="">— Select —</option>
              {brandOptions.map((brand) => (
                <option key={brand} value={brand}>{brand}</option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Product Model
            <select className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 font-normal outline-none ring-blue-500 focus:ring-2" {...register("productModel")}>
              <option value="">— Select —</option>
              {modelOptions.map((model) => (
                <option key={model} value={model}>{model}</option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Product Type
            <select className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 font-normal outline-none ring-blue-500 focus:ring-2" {...register("productType")}>
              <option value="">— Select —</option>
              {PRODUCT_TYPES.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Mail ID
            <input className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 font-normal outline-none ring-blue-500 focus:ring-2" {...register("email")} />
            {errors.email && <span className="mt-1 block text-xs text-red-600">{errors.email.message}</span>}
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Type of Customer
            <select className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 font-normal outline-none ring-blue-500 focus:ring-2" {...register("sourceType")}>
              <option value="">— Select —</option>
              {CUSTOMER_SOURCE_TYPES.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </label>
          <CustomFieldInputs defs={customFields} values={custom} onChange={(id, value) => setCustom((c) => ({ ...c, [id]: value }))} />
        </div>

        <div className="mt-8">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Purchases &amp; Payments</h3>
              <p className="text-xs text-slate-500">Each purchase creates/updates an Order. Add another line for a repeat purchase — no duplicate customer.</p>
            </div>
            <button type="button" onClick={addPurchase} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-blue-700 hover:border-blue-300">
              <Plus className="h-4 w-4" /> Add Purchase
            </button>
          </div>
          {purchases.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
              No purchases recorded. Add one to track product price, advance and balance.
            </p>
          ) : (
            <div className="space-y-3">
              {purchases.map((purchase, index) => (
                <div key={purchase.purchaseId} className="rounded-lg border border-slate-200 p-3">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <label className="text-xs font-semibold text-slate-600">
                      Brand
                      <select value={purchase.productBrand ?? ""} onChange={(e) => updatePurchase(index, { productBrand: e.target.value })} className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-2 text-sm font-normal outline-none ring-blue-500 focus:ring-2">
                        <option value="">— Select —</option>
                        {brandOptions.map((b) => <option key={b} value={b}>{b}</option>)}
                      </select>
                    </label>
                    <label className="text-xs font-semibold text-slate-600">
                      Model
                      <input list={`models-${purchase.purchaseId}`} value={purchase.productModel ?? ""} onChange={(e) => updatePurchase(index, { productModel: e.target.value })} className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-2 text-sm font-normal outline-none ring-blue-500 focus:ring-2" />
                      <datalist id={`models-${purchase.purchaseId}`}>{modelOptions.map((m) => <option key={m} value={m} />)}</datalist>
                    </label>
                    <label className="text-xs font-semibold text-slate-600">
                      Product Price (incl. GST)
                      <input type="number" min={0} value={purchase.price || ""} onChange={(e) => updatePurchase(index, { price: Math.max(0, Number(e.target.value) || 0) })} className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-2 text-sm font-normal outline-none ring-blue-500 focus:ring-2" />
                    </label>
                    <label className="text-xs font-semibold text-slate-600">
                      Advance Paid
                      <input type="number" min={0} value={purchase.advancePaid || ""} onChange={(e) => updatePurchase(index, { advancePaid: Math.max(0, Number(e.target.value) || 0) })} className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-2 text-sm font-normal outline-none ring-blue-500 focus:ring-2" />
                    </label>
                    <label className="text-xs font-semibold text-slate-600">
                      Advance Date
                      <input type="date" value={purchase.advanceDate ?? ""} onChange={(e) => updatePurchase(index, { advanceDate: e.target.value || undefined })} className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-2 text-sm font-normal outline-none ring-blue-500 focus:ring-2" />
                    </label>
                    <label className="text-xs font-semibold text-slate-600">
                      Due Date
                      <input type="date" value={purchase.dueDate ?? ""} onChange={(e) => updatePurchase(index, { dueDate: e.target.value || undefined })} className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-2 text-sm font-normal outline-none ring-blue-500 focus:ring-2" />
                    </label>
                    <label className="text-xs font-semibold text-slate-600">
                      Payment Mode
                      <select value={purchase.paymentMode ?? ""} onChange={(e) => updatePurchase(index, { paymentMode: (e.target.value || undefined) as PaymentMode | undefined })} className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-2 text-sm font-normal outline-none ring-blue-500 focus:ring-2">
                        <option value="">— Select —</option>
                        {PAYMENT_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </label>
                    <div className="text-xs font-semibold text-slate-600">
                      Balance
                      <div className="mt-1 flex h-10 items-center rounded-lg border border-slate-200 bg-slate-50 px-2 text-sm font-bold text-slate-900">{currency(purchaseBalance(purchase))}</div>
                    </div>
                    <div className="flex items-end justify-end">
                      <button type="button" onClick={() => removePurchase(index)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-semibold text-slate-500 hover:border-red-300 hover:text-red-600">
                        <Trash2 className="h-4 w-4" /> Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 font-semibold">Cancel</button>
          <button className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white"><UserPlus className="h-4 w-4" /> Save Customer</button>
        </div>
      </form>
    </Modal>
  );
}
