"use client";

import { CheckCircle2, Download, FileText, FileUp, Plus, Save, Send, UserPlus } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import type { Brand, CompanySettings, Customer, Invoice, PaymentMode, Purchase } from "@/types/crm";
import { Badge, DataTable, DeleteButton, Modal } from "@/components/ui";
import { useToast } from "@/components/toast";
import { currency, shortDate } from "@/utils/format";
import { downloadCSV, downloadInvoicePdf } from "@/lib/export";
import { cn } from "@/lib/utils";

const PAYMENT_MODES: PaymentMode[] = ["Cash", "UPI", "Bank Transfer", "Card", "Cheque", "Finance"];

/** Format a date, falling back to the raw string for non-ISO values (e.g. Tally "1-Apr-2026"). */
function safeDate(value: string): string {
  if (!value) return "—";
  return Number.isNaN(new Date(value).getTime()) ? value : shortDate(value);
}

type RangeKey = "all" | "today" | "week" | "month" | "custom";
const RANGE_LABELS: Record<RangeKey, string> = { all: "All", today: "Today", week: "This Week", month: "This Month", custom: "Custom" };

/** Resolve a range preset into [startMs, endMsExclusive], or null for "all". */
function rangeBounds(key: RangeKey, from: string, to: string): [number, number] | null {
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  if (key === "all") return null;
  if (key === "today") return [startOfDay(now), startOfDay(now) + 86_400_000];
  if (key === "week") return [startOfDay(now) - 6 * 86_400_000, startOfDay(now) + 86_400_000];
  if (key === "month") return [new Date(now.getFullYear(), now.getMonth(), 1).getTime(), new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime()];
  const start = from ? new Date(from).getTime() : Number.NEGATIVE_INFINITY;
  const end = to ? new Date(to).getTime() + 86_400_000 : Number.POSITIVE_INFINITY;
  return [start, end];
}

function inRange(dateStr: string, bounds: [number, number] | null): boolean {
  if (!bounds) return true;
  const t = new Date(dateStr).getTime();
  if (Number.isNaN(t)) return false; // unparseable dates are excluded once a range is chosen
  return t >= bounds[0] && t < bounds[1];
}

/** GST slab for a brand: the brand's own rate, else the company default. */
function brandRate(brandName: string | undefined, brands: Brand[], settings: CompanySettings): number {
  const brand = brandName ? brands.find((b) => b.name === brandName) : undefined;
  return brand?.gstRate ?? settings.gstRate;
}

/** Parse a simple CSV (handles quoted fields with commas) into rows of cells. */
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

/** Pick a column: exact header match wins, then a substring match — most specific key first. */
function pickColumn(header: string[], keys: string[]): number {
  for (const key of keys) {
    const exact = header.indexOf(key);
    if (exact >= 0) return exact;
  }
  for (const key of keys) {
    const partial = header.findIndex((h) => h.includes(key));
    if (partial >= 0) return partial;
  }
  return -1;
}

/** Parse a money string like "Rs. 1,03,250.00" into a rounded integer. Handles credit notes ("-5000", "(5,000)"). */
function parseAmount(raw: string): number {
  const text = String(raw);
  const negative = /^\s*[-(]/.test(text) || /\)\s*$/.test(text);
  const match = text.replace(/,/g, "").match(/\d+(\.\d+)?/);
  const value = match ? Math.round(Number(match[0])) : 0;
  return negative ? -value : value;
}

/** Map header names to our fields, tolerating common Tally export column labels. */
function fromCSV(rows: string[][], startIndex: number): Invoice[] {
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const iNo = pickColumn(header, ["invoice no", "invoice number", "invoice no.", "voucher no", "bill no", "inv no"]);
  const iCustomer = pickColumn(header, ["party name", "customer name", "buyer name", "party", "customer", "buyer"]);
  const iTown = pickColumn(header, ["town name", "town", "city", "place", "location"]);
  const iDate = pickColumn(header, ["invoice date", "voucher date", "bill date", "date"]);
  const iAmount = pickColumn(header, ["invoice amount", "grand total", "total amount", "net amount", "amount", "total", "value"]);

  const seen = new Set<string>();
  return rows.slice(1).map((r, index) => {
    const cell = (i: number) => (i >= 0 ? (r[i] ?? "").trim() : "");
    let invoiceNumber = cell(iNo) || `TALLY-${startIndex + index + 1}`;
    while (seen.has(invoiceNumber)) invoiceNumber = `${invoiceNumber}-${index}`;
    seen.add(invoiceNumber);
    return {
      invoiceId: `INV-${Date.now()}-${index}`,
      invoiceNumber,
      customerName: cell(iCustomer) || "—",
      town: cell(iTown),
      date: cell(iDate) || new Date().toISOString().slice(0, 10),
      amount: parseAmount(cell(iAmount) || "0"),
      source: "Tally",
      created: true,
      shared: false,
      createdAt: new Date().toISOString()
    };
  });
}

/** Next invoice sequence from existing numbers, so deletions never reuse one. */
function nextInvoiceNumber(invoices: Invoice[]): string {
  const seq =
    invoices.reduce((max, inv) => {
      const match = /(\d+)\s*$/.exec(inv.invoiceNumber);
      return match ? Math.max(max, Number(match[1])) : max;
    }, 0) + 1;
  return `RC/INV/2026/${String(seq).padStart(3, "0")}`;
}

/** Invoices — created from a saved customer, imported from Tally, or added manually. */
export function InvoicesView({
  invoices,
  customers,
  brands,
  settings,
  query,
  onChange
}: {
  readonly invoices: Invoice[];
  readonly customers: Customer[];
  readonly brands: Brand[];
  readonly settings: CompanySettings;
  readonly query: string;
  readonly onChange: (invoices: Invoice[]) => void;
}) {
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [creating, setCreating] = useState(false);
  const [rangeKey, setRangeKey] = useState<RangeKey>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [customerFilter, setCustomerFilter] = useState("all");
  const fileRef = useRef<HTMLInputElement>(null);

  const bounds = useMemo(() => rangeBounds(rangeKey, from, to), [rangeKey, from, to]);
  const rows = invoices.filter((item) => {
    const matchesQuery = `${item.invoiceNumber} ${item.customerName} ${item.town}`.toLowerCase().includes(query.toLowerCase());
    const matchesCustomer = customerFilter === "all" || item.customerId === customerFilter || item.customerName === customerFilter;
    return matchesQuery && matchesCustomer && inRange(item.date, bounds);
  });

  function toggle(invoice: Invoice, key: "created" | "shared") {
    onChange(invoices.map((item) => (item.invoiceId === invoice.invoiceId ? { ...item, [key]: !item[key] } : item)));
    toast(`${invoice.invoiceNumber} ${!invoice[key] ? "marked" : "unmarked"} ${key}`, "info");
  }

  function addInvoice(invoice: Invoice) {
    onChange([invoice, ...invoices]);
    setAdding(false);
    setCreating(false);
    toast(`Invoice ${invoice.invoiceNumber} added`);
  }

  function remove(invoice: Invoice) {
    onChange(invoices.filter((item) => item.invoiceId !== invoice.invoiceId));
    toast(`Invoice ${invoice.invoiceNumber} removed`, "info");
  }

  function removeMany(ids: string[]) {
    const set = new Set(ids);
    onChange(invoices.filter((item) => !set.has(item.invoiceId)));
    toast(`${ids.length} invoice${ids.length === 1 ? "" : "s"} removed`, "info");
  }

  async function pdf(invoice: Invoice) {
    try {
      await downloadInvoicePdf(invoice, settings);
      toast(`PDF generated for ${invoice.invoiceNumber}`);
    } catch {
      toast("Could not generate the PDF.", "info");
    }
  }

  function exportCsv() {
    downloadCSV(`invoices-${rangeKey}.csv`, [
      ["Invoice", "Customer", "Town", "Date", "Amount", "Source", "Created", "Shared"],
      ...rows.map((i) => [i.invoiceNumber, i.customerName, i.town, i.date, i.amount, i.source, i.created ? "Yes" : "No", i.shared ? "Yes" : "No"])
    ]);
    toast(`Exported ${rows.length} invoice${rows.length === 1 ? "" : "s"}`);
  }

  async function importFile(file: File) {
    const text = await file.text();
    const parsed = parseCSV(text);
    if (parsed.length < 2) {
      toast("No rows found in the file.", "info");
      return;
    }
    const imported = fromCSV(parsed, invoices.length);
    const existing = new Set(invoices.map((i) => i.invoiceNumber));
    const fresh = imported.filter((i) => !existing.has(i.invoiceNumber));
    onChange([...fresh, ...invoices]);
    toast(`Imported ${fresh.length} invoice${fresh.length === 1 ? "" : "s"} from Tally${imported.length - fresh.length ? ` (${imported.length - fresh.length} already present)` : ""}`);
  }

  const filteredTotal = rows.reduce((sum, i) => sum + i.amount, 0);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Invoices (shown)" value={rows.length} />
        <Stat label="Value (shown)" value={currency(filteredTotal)} />
        <Stat label="Shared" value={invoices.filter((i) => i.shared).length} />
      </div>

      {/* Filters: date range + customer, for download daily / weekly / monthly / custom / customer-wise */}
      <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3">
        <div className="flex flex-wrap items-center gap-2">
          {(Object.keys(RANGE_LABELS) as RangeKey[]).map((key) => (
            <button
              key={key}
              onClick={() => setRangeKey(key)}
              className={cn("rounded-lg border px-3 py-1.5 text-sm font-semibold", rangeKey === key ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-700")}
            >
              {RANGE_LABELS[key]}
            </button>
          ))}
          {rangeKey === "custom" && (
            <div className="flex items-center gap-2">
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 rounded-lg border border-slate-200 px-2 text-sm outline-none ring-blue-500 focus:ring-2" />
              <span className="text-sm text-slate-400">to</span>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 rounded-lg border border-slate-200 px-2 text-sm outline-none ring-blue-500 focus:ring-2" />
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-600">
            Customer
            <select value={customerFilter} onChange={(e) => setCustomerFilter(e.target.value)} className="h-9 rounded-lg border border-slate-200 px-2 text-sm outline-none ring-blue-500 focus:ring-2">
              <option value="all">All customers</option>
              {customers.map((c) => (
                <option key={c.customerId} value={c.customerId}>{c.companyName || c.customerName}</option>
              ))}
            </select>
          </label>
          <button onClick={exportCsv} className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:border-blue-300">
            <Download className="h-4 w-4" /> Download CSV
          </button>
        </div>
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void importFile(file);
            event.target.value = "";
          }}
        />
        <button onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
          <FileUp className="h-4 w-4" /> Import from Tally
        </button>
        <button onClick={() => setAdding(true)} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
          <Plus className="h-4 w-4" /> Add Invoice
        </button>
        <button onClick={() => setCreating(true)} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-soft">
          <UserPlus className="h-4 w-4" /> Create from Customer
        </button>
      </div>

      <DataTable
        columns={["Invoice", "Customer", "Town", "Date", "Amount", "Source", "Created", "Shared", "PDF", "Action"]}
        rowIds={rows.map((item) => item.invoiceId)}
        onDeleteSelected={removeMany}
        rows={rows.map((item) => [
          <span key="n" className="font-semibold text-slate-900">{item.invoiceNumber}</span>,
          item.customerName,
          item.town || "—",
          safeDate(item.date),
          currency(item.amount),
          <Badge key="src" label={item.source} />,
          <MarkButton key="c" active={item.created} activeLabel="Created" idleLabel="Mark Created" icon={CheckCircle2} onClick={() => toggle(item, "created")} />,
          <MarkButton key="s" active={item.shared} activeLabel="Shared" idleLabel="Mark Shared" icon={Send} onClick={() => toggle(item, "shared")} />,
          <button key="pdf" onClick={() => pdf(item)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:border-slate-300">
            <FileText className="h-3.5 w-3.5" /> PDF
          </button>,
          <DeleteButton key="d" resetKey={item.invoiceId} onDelete={() => remove(item)} />
        ])}
      />
      {adding && <InvoiceModal onClose={() => setAdding(false)} onSave={addInvoice} nextNumber={nextInvoiceNumber(invoices)} />}
      {creating && <CreateFromCustomerModal customers={customers} brands={brands} settings={settings} nextNumber={nextInvoiceNumber(invoices)} onClose={() => setCreating(false)} onSave={addInvoice} />}
    </div>
  );
}

function MarkButton({ active, activeLabel, idleLabel, icon: Icon, onClick }: { readonly active: boolean; readonly activeLabel: string; readonly idleLabel: string; readonly icon: typeof CheckCircle2; readonly onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition",
        active ? "border-green-200 bg-green-50 text-green-700" : "border-slate-200 bg-white text-slate-500 hover:border-blue-300"
      )}
    >
      <Icon className="h-3.5 w-3.5" /> {active ? activeLabel : idleLabel}
    </button>
  );
}

/** Build an invoice from a saved customer's details and (optionally) one of their purchases. */
function CreateFromCustomerModal({
  customers,
  brands,
  settings,
  nextNumber,
  onClose,
  onSave
}: {
  readonly customers: Customer[];
  readonly brands: Brand[];
  readonly settings: CompanySettings;
  readonly nextNumber: string;
  readonly onClose: () => void;
  readonly onSave: (invoice: Invoice) => void;
}) {
  const [customerId, setCustomerId] = useState(customers[0]?.customerId ?? "");
  const customer = customers.find((c) => c.customerId === customerId);
  const purchases = customer?.purchases ?? [];
  const [purchaseIndex, setPurchaseIndex] = useState(0);
  const [invoiceNumber, setInvoiceNumber] = useState(nextNumber);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState("");
  const [gstRate, setGstRate] = useState(String(settings.gstRate));
  const [error, setError] = useState("");

  // When the picked purchase changes, prefill amount / GST from it.
  const activePurchase: Purchase | undefined = purchases[purchaseIndex];
  const prefillFrom = (p: Purchase | undefined) => {
    if (!p) return;
    setAmount(String(p.price || 0));
    setGstRate(String(brandRate(p.productBrand, brands, settings)));
  };

  function pickCustomer(id: string) {
    setCustomerId(id);
    setPurchaseIndex(0);
    const first = customers.find((c) => c.customerId === id)?.purchases?.[0];
    if (first) prefillFrom(first);
    else setAmount("");
  }

  function pickPurchase(index: number) {
    setPurchaseIndex(index);
    prefillFrom(purchases[index]);
  }

  function submit() {
    if (!customer) return setError("Select a customer.");
    const value = Math.max(0, Number(amount) || 0);
    if (value <= 0) return setError("Enter the invoice amount (GST-inclusive).");
    const label = activePurchase ? [activePurchase.productBrand, activePurchase.productModel].filter(Boolean).join(" ") : [customer.productBrand, customer.productModel].filter(Boolean).join(" ");
    onSave({
      invoiceId: `INV-${Date.now()}`,
      invoiceNumber: invoiceNumber.trim() || nextNumber,
      customerName: customer.companyName || customer.customerName,
      town: customer.city,
      date,
      amount: value,
      source: "CRM",
      created: true,
      shared: false,
      customerId: customer.customerId,
      gstRate: Math.min(100, Math.max(0, Number(gstRate) || 0)),
      productLabel: label || undefined,
      paymentMode: activePurchase?.paymentMode,
      createdAt: new Date().toISOString()
    });
  }

  return (
    <Modal title="Create Invoice from Customer" subtitle="Pre-filled from the customer's saved details." size="lg" onClose={onClose}>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-sm font-semibold text-slate-700 md:col-span-2">
          Customer
          <select value={customerId} onChange={(e) => pickCustomer(e.target.value)} className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 font-normal outline-none ring-blue-500 focus:ring-2">
            {customers.length === 0 && <option value="">No customers yet</option>}
            {customers.map((c) => (
              <option key={c.customerId} value={c.customerId}>{[c.companyName || c.customerName, c.city, c.mobile].filter(Boolean).join(" · ")}</option>
            ))}
          </select>
        </label>
        {purchases.length > 0 && (
          <label className="text-sm font-semibold text-slate-700 md:col-span-2">
            Purchase
            <select value={purchaseIndex} onChange={(e) => pickPurchase(Number(e.target.value))} className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 font-normal outline-none ring-blue-500 focus:ring-2">
              {purchases.map((p, i) => (
                <option key={p.purchaseId} value={i}>
                  {[p.productBrand, p.productModel].filter(Boolean).join(" ") || "Product"} — {currency(p.price || 0)}
                </option>
              ))}
            </select>
          </label>
        )}
        <TextField label="Invoice No" value={invoiceNumber} onChange={setInvoiceNumber} />
        <TextField label="Date" value={date} onChange={setDate} type="date" />
        <TextField label="Amount (₹, incl. GST)" value={amount} onChange={setAmount} type="number" />
        <TextField label="GST %" value={gstRate} onChange={setGstRate} type="number" />
      </div>
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      <div className="mt-6 flex justify-end gap-3">
        <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 font-semibold">Cancel</button>
        <button type="button" onClick={submit} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white">
          <Save className="h-4 w-4" /> Create Invoice
        </button>
      </div>
    </Modal>
  );
}

type Draft = { invoiceNumber: string; customerName: string; town: string; date: string; amount: string; gstRate: string };

function InvoiceModal({ onClose, onSave, nextNumber }: { readonly onClose: () => void; readonly onSave: (invoice: Invoice) => void; readonly nextNumber: string }) {
  const [form, setForm] = useState<Draft>({ invoiceNumber: "", customerName: "", town: "", date: new Date().toISOString().slice(0, 10), amount: "", gstRate: "18" });
  const [error, setError] = useState("");

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function submit() {
    if (form.customerName.trim().length < 2) return setError("Customer name is required.");
    onSave({
      invoiceId: `INV-${Date.now()}`,
      invoiceNumber: form.invoiceNumber.trim() || nextNumber,
      customerName: form.customerName.trim(),
      town: form.town.trim(),
      date: form.date,
      amount: Math.max(0, Number(form.amount) || 0),
      source: "Manual",
      created: true,
      shared: false,
      gstRate: Math.min(100, Math.max(0, Number(form.gstRate) || 0)),
      createdAt: new Date().toISOString()
    });
  }

  return (
    <Modal title="Add Invoice" size="md" onClose={onClose}>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Invoice No" value={form.invoiceNumber} onChange={(v) => set("invoiceNumber", v)} placeholder="auto" />
        <Field label="Customer *" value={form.customerName} onChange={(v) => set("customerName", v)} />
        <Field label="Town" value={form.town} onChange={(v) => set("town", v)} />
        <Field label="Date" value={form.date} onChange={(v) => set("date", v)} type="date" />
        <Field label="Amount (₹, incl. GST)" value={form.amount} onChange={(v) => set("amount", v)} type="number" />
        <Field label="GST %" value={form.gstRate} onChange={(v) => set("gstRate", v)} type="number" />
      </div>
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      <div className="mt-6 flex justify-end gap-3">
        <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 font-semibold">Cancel</button>
        <button type="button" onClick={submit} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white">
          <Save className="h-4 w-4" /> Save Invoice
        </button>
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

function Field({ label, value, onChange, type = "text", placeholder }: { readonly label: string; readonly value: string; readonly onChange: (value: string) => void; readonly type?: string; readonly placeholder?: string }) {
  return (
    <label className="text-sm font-semibold text-slate-700">
      {label}
      <input type={type} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 font-normal outline-none ring-blue-500 focus:ring-2" />
    </label>
  );
}

function Stat({ label, value }: { readonly label: string; readonly value: number | string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-slate-950">{value}</p>
    </div>
  );
}
