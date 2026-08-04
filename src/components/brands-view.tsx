"use client";

import { Pencil, Plus, Save, Tag } from "lucide-react";
import { useState } from "react";
import type { Brand, CompanySettings, Product } from "@/types/crm";
import { Badge, DataTable, DeleteButton, Modal } from "@/components/ui";
import { useToast } from "@/components/toast";

/** Brand master. Admin adds / edits / removes the brands the business deals in. */
export function BrandsView({
  brands,
  products,
  settings,
  query,
  onChange
}: {
  readonly brands: Brand[];
  readonly products: Product[];
  readonly settings: CompanySettings;
  readonly query: string;
  readonly onChange: (brands: Brand[]) => void;
}) {
  const toast = useToast();
  const [editing, setEditing] = useState<Brand | null | "new">(null);

  const rows = brands.filter((item) => `${item.name} ${item.remarks ?? ""}`.toLowerCase().includes(query.toLowerCase()));
  const stockCount = (name: string) => products.filter((p) => p.brand === name).length;

  function save(brand: Brand) {
    const exists = brands.some((item) => item.brandId === brand.brandId);
    const clash = brands.some((item) => item.brandId !== brand.brandId && item.name.trim().toLowerCase() === brand.name.trim().toLowerCase());
    if (clash) {
      toast(`${brand.name} already exists`, "info");
      return;
    }
    onChange(exists ? brands.map((item) => (item.brandId === brand.brandId ? brand : item)) : [...brands, brand]);
    setEditing(null);
    toast(exists ? `${brand.name} updated` : `${brand.name} added`);
  }

  function remove(brand: Brand) {
    const used = stockCount(brand.name);
    if (used > 0) {
      toast(`${brand.name} is used by ${used} inventory item${used === 1 ? "" : "s"} — remove those first.`, "info");
      return;
    }
    onChange(brands.filter((item) => item.brandId !== brand.brandId));
    toast(`${brand.name} removed`, "info");
  }

  function toggle(brand: Brand) {
    onChange(brands.map((item) => (item.brandId === brand.brandId ? { ...item, active: !item.active } : item)));
    toast(`${brand.name} ${brand.active ? "deactivated" : "activated"}`);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          {brands.length} brand{brands.length === 1 ? "" : "s"} · only active brands appear in Inventory, Customers and Leads
        </p>
        <button onClick={() => setEditing("new")} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-soft">
          <Plus className="h-4 w-4" /> Add Brand
        </button>
      </div>
      <DataTable
        columns={["Brand", "GST %", "Remarks", "In Stock", "Status", "Action"]}
        rows={rows.map((item) => [
          <span key="n" className="inline-flex items-center gap-2 font-semibold text-slate-900">
            <Tag className="h-4 w-4 text-blue-600" /> {item.name}
          </span>,
          typeof item.gstRate === "number" ? `${item.gstRate}%` : `${settings.gstRate}% (default)`,
          item.remarks || "—",
          stockCount(item.name),
          <Badge key="s" label={item.active ? "Active" : "Inactive"} />,
          <div key="actions" className="flex items-center gap-2">
            <button
              onClick={() => setEditing(item)}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:border-blue-300"
            >
              <Pencil className="h-3.5 w-3.5" /> Edit
            </button>
            <button
              onClick={() => toggle(item)}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:border-slate-300"
            >
              {item.active ? "Deactivate" : "Activate"}
            </button>
            <DeleteButton resetKey={item.brandId} onDelete={() => remove(item)} />
          </div>
        ])}
      />
      {editing !== null && <BrandModal initial={editing === "new" ? null : editing} settings={settings} onClose={() => setEditing(null)} onSave={save} />}
    </div>
  );
}

function BrandModal({ initial, settings, onClose, onSave }: { readonly initial: Brand | null; readonly settings: CompanySettings; readonly onClose: () => void; readonly onSave: (brand: Brand) => void }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [gstRate, setGstRate] = useState<string>(typeof initial?.gstRate === "number" ? String(initial.gstRate) : "");
  const [remarks, setRemarks] = useState(initial?.remarks ?? "");
  const [careNumber, setCareNumber] = useState(initial?.serviceCareNumber ?? "");
  const [whatsapp, setWhatsapp] = useState(initial?.serviceWhatsapp ?? "");
  const [serviceEmail, setServiceEmail] = useState(initial?.serviceEmail ?? "");
  const [active, setActive] = useState(initial?.active ?? true);
  const [error, setError] = useState("");

  function submit() {
    if (name.trim().length < 2) return setError("Brand name is required.");
    onSave({
      brandId: initial?.brandId ?? `BRD-${Date.now()}`,
      name: name.trim(),
      gstRate: gstRate === "" ? undefined : Number(gstRate),
      remarks: remarks.trim() || undefined,
      serviceCareNumber: careNumber.trim() || undefined,
      serviceWhatsapp: whatsapp.trim() || undefined,
      serviceEmail: serviceEmail.trim() || undefined,
      active,
      createdAt: initial?.createdAt ?? new Date().toISOString()
    });
  }

  return (
    <Modal title={initial ? "Edit Brand" : "Add Brand"} size="md" onClose={onClose}>
        <div className="grid gap-4">
          <label className="text-sm font-semibold text-slate-700">
            Brand Name *
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 font-normal outline-none ring-blue-500 focus:ring-2"
            />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            GST Slab
            <select
              value={gstRate}
              onChange={(event) => setGstRate(event.target.value)}
              className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 font-normal outline-none ring-blue-500 focus:ring-2"
            >
              <option value="">Use company default ({settings.gstRate}%)</option>
              {(settings.gstSlabs ?? []).map((rate) => (
                <option key={rate} value={rate}>{rate}%</option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Remarks
            <input
              value={remarks}
              onChange={(event) => setRemarks(event.target.value)}
              placeholder="Distributor, contact or notes"
              className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 font-normal outline-none ring-blue-500 focus:ring-2"
            />
          </label>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Service Contacts (shared with customers)</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="text-xs font-semibold text-slate-600">
                Customer Care No.
                <input value={careNumber} onChange={(e) => setCareNumber(e.target.value)} className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-2 text-sm font-normal outline-none ring-blue-500 focus:ring-2" />
              </label>
              <label className="text-xs font-semibold text-slate-600">
                WhatsApp No.
                <input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-2 text-sm font-normal outline-none ring-blue-500 focus:ring-2" />
              </label>
              <label className="text-xs font-semibold text-slate-600">
                Email ID
                <input value={serviceEmail} onChange={(e) => setServiceEmail(e.target.value)} className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-2 text-sm font-normal outline-none ring-blue-500 focus:ring-2" />
              </label>
            </div>
          </div>
          <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
            <input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} className="h-4 w-4 rounded border-slate-300" />
            Active
          </label>
        </div>
        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 font-semibold">Cancel</button>
          <button type="button" onClick={submit} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white">
            <Save className="h-4 w-4" /> Save Brand
          </button>
        </div>
    </Modal>
  );
}
