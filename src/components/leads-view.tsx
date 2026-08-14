"use client";

import { Link as LinkIcon, Pencil, Save, UserCheck, UserPlus } from "lucide-react";
import { useState } from "react";
import type { Brand, CustomFieldDef, CustomerSourceType, Lead, LeadSource, LeadStatus, Product, ProductType, Quotation } from "@/types/crm";
import { Badge, DataTable, DeleteButton, Modal } from "@/components/ui";
import { useToast } from "@/components/toast";
import { CustomFieldInputs } from "@/components/custom-fields";
import { whatsappLink } from "@/lib/export";
import { CUSTOMER_SOURCE_TYPES, ENQUIRY_NATURES, PRODUCT_TYPES, uniqueSorted } from "@/lib/options";
import { currency, shortDate } from "@/utils/format";
import { cn } from "@/lib/utils";

const SOURCES: LeadSource[] = ENQUIRY_NATURES;
const STATUSES: LeadStatus[] = ["New", "Follow-up", "Quotation Sent", "Order Confirmed", "Closed"];

/** Next lead sequence from the max existing number, so deletions never reuse one. */
function nextLeadSequence(numbers: string[]): number {
  return (
    numbers.reduce((max, value) => {
      const match = /(\d+)\s*$/.exec(value);
      return match ? Math.max(max, Number(match[1])) : max;
    }, 0) + 1
  );
}

/** Leads from walk-ins, online and social media. Carries full customer fields so a lead can be converted. */
export function LeadsView({
  leads,
  products,
  brands,
  customFields,
  query,
  onChange,
  onConvert,
  onCreate
}: {
  readonly leads: Lead[];
  readonly products: Product[];
  readonly brands: Brand[];
  readonly customFields?: CustomFieldDef[];
  readonly query: string;
  readonly onChange: (leads: Lead[]) => void;
  readonly onConvert: (lead: Lead, createdQuotation?: Quotation) => void;
  readonly onCreate: (lead: Lead) => Quotation | undefined;
}) {
  const toast = useToast();
  const [editing, setEditing] = useState<Lead | null | "new">(null);
  const [source, setSource] = useState<LeadSource | "All">("All");

  // Converted leads move into Customers — keep them out of the active Leads list
  // (they're still retained in data so their quotations stay linked).
  const rows = leads.filter((item) => {
    if (item.convertedCustomerId) return false;
    const haystack = `${item.name} ${item.town} ${item.phone} ${item.productBrand ?? ""} ${item.productModel ?? ""}`.toLowerCase();
    return haystack.includes(query.toLowerCase()) && (source === "All" || item.source === source);
  });

  function save(lead: Lead) {
    const exists = leads.some((item) => item.leadId === lead.leadId);
    onChange(exists ? leads.map((item) => (item.leadId === lead.leadId ? lead : item)) : [lead, ...leads]);
    setEditing(null);
    toast(exists ? `Lead updated: ${lead.name}` : `Lead added: ${lead.name}`);
    const created = exists ? undefined : onCreate(lead); // auto-quotation for brand-new leads
    // Confirming the order converts the lead into a customer straight away.
    if (lead.status === "Order Confirmed" && !lead.convertedCustomerId) onConvert(lead, created);
  }

  function remove(lead: Lead) {
    onChange(leads.filter((item) => item.leadId !== lead.leadId));
    toast(`Lead removed: ${lead.name}`, "info");
  }

  function removeMany(ids: string[]) {
    const set = new Set(ids);
    onChange(leads.filter((item) => !set.has(item.leadId)));
    toast(`${ids.length} lead${ids.length === 1 ? "" : "s"} removed`, "info");
  }

  function shareBrochure(lead: Lead) {
    if (!lead.brochureUrl) {
      toast("Add a brochure link on this lead first.", "info");
      return;
    }
    const phone = (lead.phone ?? "").replace(/\D/g, "");
    if (!phone) {
      toast("This lead has no phone number.", "info");
      return;
    }
    window.open(whatsappLink(phone, `Product brochure: ${lead.brochureUrl}`), "_blank", "noopener");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {(["All", ...SOURCES] as const).map((item) => (
            <button
              key={item}
              onClick={() => setSource(item)}
              className={cn("rounded-lg border px-3 py-1.5 text-sm font-semibold", source === item ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-700")}
            >
              {item}
            </button>
          ))}
        </div>
        <button onClick={() => setEditing("new")} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-soft">
          <UserPlus className="h-4 w-4" /> Add Lead
        </button>
      </div>
      <DataTable
        columns={["Name", "Town", "Phone", "Nature of Enquiry", "Quoted Price", "Status", "Added", "Action"]}
        rowIds={rows.map((item) => item.leadId)}
        onDeleteSelected={removeMany}
        rows={rows.map((item) => [
          <span key="n" className="font-semibold text-slate-900">{item.name}</span>,
          item.town || "—",
          item.phone || "—",
          item.source,
          typeof item.quotedPrice === "number" ? currency(item.quotedPrice) : "—",
          <Badge key="s" label={item.convertedCustomerId ? "Order Confirmed" : item.status} />,
          shortDate(item.createdAt),
          <div key="actions" className="flex items-center gap-2">
            <button
              onClick={() => setEditing(item)}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:border-blue-300"
            >
              <Pencil className="h-3.5 w-3.5" /> Edit
            </button>
            <button
              onClick={() => onConvert(item)}
              disabled={Boolean(item.convertedCustomerId)}
              title={item.convertedCustomerId ? "Already converted to a customer" : "Convert this lead into a customer"}
              className="inline-flex items-center gap-1 rounded-lg border border-green-200 px-2.5 py-1.5 text-xs font-semibold text-green-700 transition hover:border-green-300 disabled:opacity-40"
            >
              <UserCheck className="h-3.5 w-3.5" /> {item.convertedCustomerId ? "Converted" : "Convert"}
            </button>
            <button
              onClick={() => shareBrochure(item)}
              title="Share the brochure link on WhatsApp"
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300"
            >
              <LinkIcon className="h-3.5 w-3.5" /> Brochure
            </button>
            <DeleteButton resetKey={item.leadId} onDelete={() => remove(item)} />
          </div>
        ])}
      />
      {editing !== null && (
        <LeadModal initial={editing === "new" ? null : editing} products={products} brands={brands} customFields={customFields} onClose={() => setEditing(null)} onSave={save} existingNumbers={leads.map((l) => l.leadNumber)} />
      )}
    </div>
  );
}

type Draft = {
  name: string;
  town: string;
  phone: string;
  address: string;
  email: string;
  productBrand: string;
  productModel: string;
  productType: string;
  sourceType: string;
  source: LeadSource;
  quotedPrice: string;
  brochureUrl: string;
  description: string;
  status: LeadStatus;
  date: string;
};

function toDraft(lead: Lead | null): Draft {
  return {
    name: lead?.name ?? "",
    town: lead?.town ?? "",
    phone: lead?.phone ?? "",
    address: lead?.address ?? "",
    email: lead?.email ?? "",
    productBrand: lead?.productBrand ?? "",
    productModel: lead?.productModel ?? "",
    productType: lead?.productType ?? "",
    sourceType: lead?.sourceType ?? "",
    source: lead?.source ?? "Product Enquiry",
    quotedPrice: typeof lead?.quotedPrice === "number" ? String(lead.quotedPrice) : "",
    brochureUrl: lead?.brochureUrl ?? "",
    description: lead?.description ?? "",
    status: lead?.status ?? "New",
    date: (lead?.createdAt ?? new Date().toISOString()).slice(0, 10)
  };
}

function LeadModal({
  initial,
  products,
  brands,
  customFields,
  onClose,
  onSave,
  existingNumbers
}: {
  readonly initial: Lead | null;
  readonly products: Product[];
  readonly brands: Brand[];
  readonly customFields?: CustomFieldDef[];
  readonly onClose: () => void;
  readonly onSave: (lead: Lead) => void;
  readonly existingNumbers: string[];
}) {
  const [form, setForm] = useState<Draft>(toDraft(initial));
  const [custom, setCustom] = useState<Record<string, string>>(initial?.custom ?? {});
  const [error, setError] = useState("");

  const brandOptions = uniqueSorted([...brands.filter((b) => b.active).map((b) => b.name), initial?.productBrand]);
  const modelOptions = uniqueSorted([...products.map((p) => p.model), initial?.productModel]);

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function submit() {
    if (form.name.trim().length < 2) return setError("Name is required.");
    if (form.phone.trim().length < 10) return setError("A valid phone number is required.");
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return setError("Enter a valid email or leave it blank.");
    onSave({
      leadId: initial?.leadId ?? `LEAD-${Date.now()}`,
      leadNumber: initial?.leadNumber ?? `RC-LEAD-2026-${String(nextLeadSequence(existingNumbers)).padStart(3, "0")}`,
      name: form.name.trim(),
      town: form.town.trim(),
      phone: form.phone.trim(),
      address: form.address.trim(),
      email: form.email.trim(),
      productBrand: form.productBrand,
      productModel: form.productModel,
      productType: (form.productType || undefined) as ProductType | undefined,
      sourceType: (form.sourceType || undefined) as CustomerSourceType | undefined,
      source: form.source,
      quotedPrice: form.quotedPrice.trim() ? Math.max(0, Number(form.quotedPrice) || 0) : undefined,
      brochureUrl: form.brochureUrl.trim() || undefined,
      interestedIn: initial?.interestedIn,
      description: form.description.trim(),
      status: form.status,
      convertedCustomerId: initial?.convertedCustomerId,
      custom: Object.keys(custom).length ? custom : undefined,
      // Editable date: keep the original timestamp when the day is unchanged, else set it.
      createdAt:
        initial?.createdAt && initial.createdAt.slice(0, 10) === form.date
          ? initial.createdAt
          : new Date(`${form.date || new Date().toISOString().slice(0, 10)}T00:00:00`).toISOString()
    });
  }

  return (
    <Modal title={initial ? "Edit Lead" : "Add Lead"} size="xl" onClose={onClose}>
        <p className="mb-4 text-sm text-slate-500">Only Name and Phone are required. These fields carry over when the lead is converted into a customer.</p>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Name *" value={form.name} onChange={(v) => set("name", v)} />
          <Field label="Phone Number *" value={form.phone} onChange={(v) => set("phone", v)} />
          <Field label="Town" value={form.town} onChange={(v) => set("town", v)} />
          <Field label="Address" value={form.address} onChange={(v) => set("address", v)} />
          <label className="text-sm font-semibold text-slate-700">
            Product Brand
            <select value={form.productBrand} onChange={(e) => set("productBrand", e.target.value)} className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 font-normal outline-none ring-blue-500 focus:ring-2">
              <option value="">— Select —</option>
              {brandOptions.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Product Model
            <select value={form.productModel} onChange={(e) => set("productModel", e.target.value)} className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 font-normal outline-none ring-blue-500 focus:ring-2">
              <option value="">— Select —</option>
              {modelOptions.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Product Type
            <select value={form.productType} onChange={(e) => set("productType", e.target.value)} className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 font-normal outline-none ring-blue-500 focus:ring-2">
              <option value="">— Select —</option>
              {PRODUCT_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </label>
          <Field label="Mail ID" value={form.email} onChange={(v) => set("email", v)} />
          <label className="text-sm font-semibold text-slate-700">
            Type of Customer
            <select value={form.sourceType} onChange={(e) => set("sourceType", e.target.value)} className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 font-normal outline-none ring-blue-500 focus:ring-2">
              <option value="">— Select —</option>
              {CUSTOMER_SOURCE_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Nature of Enquiry
            <select value={form.source} onChange={(e) => set("source", e.target.value as LeadSource)} className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 font-normal outline-none ring-blue-500 focus:ring-2">
              {SOURCES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <Field label="Quoted Price (₹, incl. GST)" value={form.quotedPrice} onChange={(v) => set("quotedPrice", v)} type="number" />
          <Field label="Date" value={form.date} onChange={(v) => set("date", v)} type="date" />
          <Field label="Brochure Link" value={form.brochureUrl} onChange={(v) => set("brochureUrl", v)} />
          <CustomFieldInputs defs={customFields} values={custom} onChange={(id, value) => setCustom((c) => ({ ...c, [id]: value }))} />
          <label className="text-sm font-semibold text-slate-700">
            Status
            <select value={form.status} onChange={(e) => set("status", e.target.value as LeadStatus)} className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 font-normal outline-none ring-blue-500 focus:ring-2">
              {STATUSES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-700 md:col-span-2">
            Description
            <textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={3} className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 font-normal outline-none ring-blue-500 focus:ring-2" />
          </label>
        </div>
        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 font-semibold">Cancel</button>
          <button type="button" onClick={submit} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white">
            <Save className="h-4 w-4" /> Save Lead
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
