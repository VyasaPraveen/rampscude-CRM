"use client";

import { Building2, Database, DownloadCloud, ImageUp, Plus, Save, ShieldCheck, Trash2, UploadCloud } from "lucide-react";
import { useRef, useState } from "react";
import type { CompanySettings, User } from "@/types/crm";
import { Panel, SimpleRows } from "@/components/ui";
import { useToast } from "@/components/toast";
import { CustomFieldManager } from "@/components/custom-fields";
import { OPTION_LISTS, optionList } from "@/lib/options";

/** Max size for an uploaded logo / signature. Kept small — images are stored inline. */
const MAX_IMAGE_BYTES = 400_000;

type TextKey = Exclude<keyof CompanySettings, "logo" | "signature" | "gstRate" | "validityDays" | "gstSlabs" | "leadFields" | "customerFields" | "options">;

const SECTIONS: { title: string; fields: { key: TextKey; label: string; wide?: boolean }[] }[] = [
  {
    title: "Organisation",
    fields: [
      { key: "name", label: "Company Name" },
      { key: "tagline", label: "Tagline" },
      { key: "addressLine1", label: "Address Line 1", wide: true },
      { key: "addressLine2", label: "Address Line 2", wide: true },
      { key: "city", label: "City / Town" },
      { key: "pincode", label: "Pincode" },
      { key: "phone", label: "Phone" },
      { key: "altPhone", label: "Alternate Phone" },
      { key: "email", label: "Email" },
      { key: "website", label: "Website" },
      { key: "gstin", label: "GSTIN" },
      { key: "proprietor", label: "Proprietor / Signatory" }
    ]
  },
  {
    title: "Bank Details",
    fields: [
      { key: "bankName", label: "Bank Name" },
      { key: "accountNo", label: "Account No" },
      { key: "ifsc", label: "IFSC Code" },
      { key: "branch", label: "Branch" }
    ]
  },
  {
    title: "Quotation Defaults",
    fields: [
      { key: "warranty", label: "Product Warranty", wide: true },
      { key: "transport", label: "Transport Details", wide: true },
      { key: "deliveryTime", label: "Delivery Time", wide: true },
      { key: "paymentTerms", label: "Payment Terms", wide: true }
      // Brochure link moved to the Lead and Quotation forms (set per enquiry).
    ]
  }
];

/** Company information, bank details, quotation defaults and branding artwork. */
export function SettingsView({
  settings,
  users,
  onChange,
  onBackup,
  onRestore,
  lastManualBackup,
  licenseUntil
}: {
  readonly settings: CompanySettings;
  readonly users: User[];
  readonly onChange: (settings: CompanySettings) => boolean;
  readonly onBackup: () => void;
  readonly onRestore: (text: string) => boolean;
  readonly lastManualBackup?: string;
  readonly licenseUntil?: string;
}) {
  const toast = useToast();
  const [form, setForm] = useState<CompanySettings>(settings);
  const [newSlab, setNewSlab] = useState("");
  const restoreRef = useRef<HTMLInputElement>(null);
  const [confirmRestore, setConfirmRestore] = useState<string | null>(null);

  function set<K extends keyof CompanySettings>(key: K, value: CompanySettings[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function upload(key: "logo" | "signature", file: File | undefined) {
    if (!file) return;
    // Raster images only. SVG is an image type but can embed script, so it is refused.
    if (!file.type.startsWith("image/") || file.type === "image/svg+xml") {
      toast("Choose a PNG or JPG image (SVG is not allowed).", "info");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast(`Image is too large (${Math.round(file.size / 1024)} KB). Use one under ${MAX_IMAGE_BYTES / 1000} KB.`, "info");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUri = String(reader.result);
      // Base64 inflates the payload ~1.37x; guard the encoded size, which is what gets stored.
      if (dataUri.length > MAX_IMAGE_BYTES * 1.4) {
        toast("That image is too large once encoded. Please use a smaller one.", "info");
        return;
      }
      set(key, dataUri);
    };
    reader.onerror = () => toast("Could not read that image.", "info");
    reader.readAsDataURL(file);
  }

  function save() {
    const cleaned: CompanySettings = {
      ...form,
      gstRate: Math.min(100, Math.max(0, Number(form.gstRate) || 0)),
      validityDays: Math.max(0, Math.round(Number(form.validityDays) || 0))
    };
    const ok = onChange(cleaned);
    setForm(cleaned);
    toast(ok ? "Company settings saved" : "Could not save — browser storage is full. Try a smaller logo or signature.", ok ? "success" : "info");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="inline-flex items-center gap-2 text-sm text-slate-500">
          <Building2 className="h-4 w-4 text-blue-600" /> These details appear on quotations, invoices and reports.
        </p>
        <button onClick={save} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-soft">
          <Save className="h-4 w-4" /> Save Settings
        </button>
      </div>

      {SECTIONS.map((section) => (
        <Panel key={section.title} title={section.title}>
          <div className="grid gap-4 md:grid-cols-2">
            {section.fields.map((field) => (
              <label key={field.key} className={field.wide ? "text-sm font-semibold text-slate-700 md:col-span-2" : "text-sm font-semibold text-slate-700"}>
                {field.label}
                <input
                  value={form[field.key] ?? ""}
                  onChange={(event) => set(field.key, event.target.value)}
                  className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 font-normal outline-none ring-blue-500 focus:ring-2"
                />
              </label>
            ))}
            {section.title === "Quotation Defaults" && (
              <>
                <label className="text-sm font-semibold text-slate-700">
                  Default GST Slab (%)
                  <select
                    value={form.gstRate}
                    onChange={(event) => set("gstRate", Number(event.target.value))}
                    className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 font-normal outline-none ring-blue-500 focus:ring-2"
                  >
                    {(form.gstSlabs ?? []).map((rate) => (
                      <option key={rate} value={rate}>{rate}%</option>
                    ))}
                  </select>
                  <span className="mt-1 block text-xs font-normal text-slate-500">Used when a product and its brand have no slab set.</span>
                </label>
                <label className="text-sm font-semibold text-slate-700">
                  Quotation Validity (days)
                  <input
                    type="number"
                    value={form.validityDays}
                    onChange={(event) => set("validityDays", Number(event.target.value))}
                    className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 font-normal outline-none ring-blue-500 focus:ring-2"
                  />
                </label>
              </>
            )}
          </div>
        </Panel>
      ))}

      <Panel title="GST Slabs">
        <p className="mb-3 text-sm text-slate-500">
          Slabs available across Brands, Inventory and Quotations. A product uses its own slab, else its brand&apos;s, else the default above.
        </p>
        <div className="mb-3 flex flex-wrap gap-2">
          {(form.gstSlabs ?? []).map((rate) => (
            <span key={rate} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-semibold text-slate-700">
              {rate}%
              <button
                type="button"
                aria-label={`Remove ${rate}% slab`}
                onClick={() => {
                  const next = (form.gstSlabs ?? []).filter((item) => item !== rate);
                  set("gstSlabs", next.length ? next : [0]);
                  if (form.gstRate === rate) set("gstRate", next[0] ?? 0);
                }}
                className="text-slate-400 transition hover:text-red-600"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
          {!(form.gstSlabs ?? []).length && <span className="text-sm text-slate-500">No slabs yet.</span>}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm font-semibold text-slate-700">
            Add slab (%)
            <input
              type="number"
              min={0}
              max={100}
              value={newSlab}
              onChange={(event) => setNewSlab(event.target.value)}
              className="mt-2 h-11 w-40 rounded-lg border border-slate-200 px-3 font-normal outline-none ring-blue-500 focus:ring-2"
            />
          </label>
          <button
            type="button"
            onClick={() => {
              const rate = Number(newSlab);
              if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
                toast("Enter a GST percentage between 0 and 100.", "info");
                return;
              }
              if ((form.gstSlabs ?? []).includes(rate)) {
                toast(`${rate}% is already a slab.`, "info");
                return;
              }
              set("gstSlabs", [...(form.gstSlabs ?? []), rate].sort((a, b) => a - b));
              setNewSlab("");
            }}
            className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-blue-700 hover:border-blue-300"
          >
            <Plus className="h-4 w-4" /> Add Slab
          </button>
        </div>
      </Panel>

      <Panel title="Branding">
        <div className="grid gap-6 md:grid-cols-2">
          <ImageField label="Company Logo" hint="Printed at the top of every quotation." value={form.logo} onPick={(file) => upload("logo", file)} onClear={() => set("logo", "")} />
          <ImageField
            label="Proprietor Signature"
            hint="Printed above the proprietor name on quotations."
            value={form.signature}
            onPick={(file) => upload("signature", file)}
            onClear={() => set("signature", "")}
          />
        </div>
      </Panel>

      <Panel title="Master Data — Dropdown Options">
        <p className="mb-4 text-sm text-slate-500">Manage the choices used in dropdowns across every module. Changes apply everywhere those lists appear.</p>
        <div className="grid gap-5 lg:grid-cols-2">
          {OPTION_LISTS.map((list) => (
            <OptionListEditor
              key={list.id}
              label={list.label}
              values={optionList(form, list.id)}
              onChange={(values) => set("options", { ...(form.options ?? {}), [list.id]: values })}
            />
          ))}
        </div>
      </Panel>

      <Panel title="Custom Fields">
        <p className="mb-3 text-sm text-slate-500">Add your own fields to the Lead and Customer forms — text, number, date or dropdown. They appear on those forms for every record.</p>
        <div className="grid gap-4 lg:grid-cols-2">
          <CustomFieldManager title="Lead fields" defs={form.leadFields} onChange={(defs) => set("leadFields", defs)} />
          <CustomFieldManager title="Customer fields" defs={form.customerFields} onChange={(defs) => set("customerFields", defs)} />
        </div>
      </Panel>

      <Panel title="Backup & Restore">
        <p className="mb-3 inline-flex items-center gap-2 text-sm text-slate-500">
          <Database className="h-4 w-4 text-blue-600" /> A local backup is saved automatically each day. Download an off-device copy regularly, and restore from a file if needed.
        </p>
        <p className="mb-4 text-xs text-slate-500">
          {lastManualBackup ? `Last downloaded backup: ${lastManualBackup}` : "No off-device backup downloaded yet."}
        </p>
        <input
          ref={restoreRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) setConfirmRestore(await file.text());
          }}
        />
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={onBackup} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-soft">
            <DownloadCloud className="h-4 w-4" /> Download Backup
          </button>
          <button type="button" onClick={() => restoreRef.current?.click()} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-blue-300">
            <UploadCloud className="h-4 w-4" /> Restore from File
          </button>
        </div>
        {confirmRestore !== null && (
          <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4">
            <p className="text-sm font-medium text-amber-900">Restoring will overwrite all current data on this workspace with the backup file. Continue?</p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  onRestore(confirmRestore);
                  setConfirmRestore(null);
                }}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white"
              >
                Yes, restore &amp; overwrite
              </button>
              <button type="button" onClick={() => setConfirmRestore(null)} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600">
                Cancel
              </button>
            </div>
          </div>
        )}
      </Panel>

      <Panel title="Licence">
        <p className="inline-flex items-center gap-2 text-sm text-slate-600">
          <ShieldCheck className="h-4 w-4 text-green-600" />
          {licenseUntil
            ? `This CRM is licensed and active until ${new Date(licenseUntil).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}. Renewal is yearly — contact your vendor for a renewal key.`
            : "Licence status unavailable."}
        </p>
      </Panel>

      <Panel title="User Management">
        <p className="mb-3 text-sm text-slate-500">
          Manage staff and admin accounts in the <span className="font-semibold text-blue-700">Users</span> module.
        </p>
        <SimpleRows rows={users.map((user) => [user.name, user.email, `${user.role} · ${user.status}`])} />
      </Panel>
    </div>
  );
}

/** Chip editor for one admin-managed option list (add / remove choices). */
function OptionListEditor({ label, values, onChange }: { readonly label: string; readonly values: string[]; readonly onChange: (values: string[]) => void }) {
  const [draft, setDraft] = useState("");
  function add() {
    const value = draft.trim();
    if (!value || values.some((item) => item.toLowerCase() === value.toLowerCase())) {
      setDraft("");
      return;
    }
    onChange([...values, value]);
    setDraft("");
  }
  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <p className="mb-2 text-sm font-bold text-slate-700">{label}</p>
      <div className="mb-3 flex flex-wrap gap-2">
        {values.length === 0 && <span className="text-xs text-slate-400">No options — add one below.</span>}
        {values.map((value) => (
          <span key={value} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-sm font-medium text-slate-700">
            {value}
            <button type="button" aria-label={`Remove ${value}`} onClick={() => onChange(values.filter((item) => item !== value))} className="text-slate-400 transition hover:text-red-600">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              add();
            }
          }}
          placeholder="Add option…"
          className="h-10 flex-1 rounded-lg border border-slate-200 px-3 text-sm outline-none ring-blue-500 focus:ring-2"
        />
        <button type="button" onClick={add} className="inline-flex h-10 items-center gap-1 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-blue-700 hover:border-blue-300">
          <Plus className="h-4 w-4" /> Add
        </button>
      </div>
    </div>
  );
}

function ImageField({
  label,
  hint,
  value,
  onPick,
  onClear
}: {
  readonly label: string;
  readonly hint: string;
  readonly value?: string;
  readonly onPick: (file: File | undefined) => void;
  readonly onClear: () => void;
}) {
  return (
    <div>
      <p className="text-sm font-semibold text-slate-700">{label}</p>
      <p className="mb-2 text-xs text-slate-500">{hint}</p>
      <div className="flex items-center gap-4">
        <div className="grid h-24 w-40 place-items-center overflow-hidden rounded-lg border border-dashed border-slate-300 bg-slate-50">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt={label} className="max-h-full max-w-full object-contain" />
          ) : (
            <span className="text-xs text-slate-500">No image</span>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-blue-700 hover:border-blue-300">
            <ImageUp className="h-4 w-4" /> Upload
            <input type="file" accept="image/*" className="hidden" onChange={(event) => onPick(event.target.files?.[0])} />
          </label>
          {value && (
            <button type="button" onClick={onClear} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-500 hover:border-red-300 hover:text-red-600">
              <Trash2 className="h-4 w-4" /> Remove
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
