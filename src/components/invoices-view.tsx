"use client";

import { CheckCircle2, FileUp, Info, Plus, Save, Send } from "lucide-react";
import { useRef, useState } from "react";
import type { Invoice } from "@/types/crm";
import { Badge, DataTable, DeleteButton, Modal } from "@/components/ui";
import { useToast } from "@/components/toast";
import { currency, shortDate } from "@/utils/format";
import { cn } from "@/lib/utils";

/** Format a date, falling back to the raw string for non-ISO values (e.g. Tally "1-Apr-2026"). */
function safeDate(value: string): string {
  if (!value) return "—";
  return Number.isNaN(new Date(value).getTime()) ? value : shortDate(value);
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
  // Specific labels first so "Invoice Date" never captures the invoice-number
  // column and "Town Name" never captures the customer-name column.
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

/**
 * Invoices synced from Tally (or added manually), marked Created / Shared.
 * Live auto-sync connector is planned; CSV import covers Tally exports today.
 */
export function InvoicesView({ invoices, query, onChange }: { readonly invoices: Invoice[]; readonly query: string; readonly onChange: (invoices: Invoice[]) => void }) {
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const rows = invoices.filter((item) => `${item.invoiceNumber} ${item.customerName} ${item.town}`.toLowerCase().includes(query.toLowerCase()));
  const createdCount = invoices.filter((i) => i.created).length;
  const sharedCount = invoices.filter((i) => i.shared).length;

  function toggle(invoice: Invoice, key: "created" | "shared") {
    onChange(invoices.map((item) => (item.invoiceId === invoice.invoiceId ? { ...item, [key]: !item[key] } : item)));
    toast(`${invoice.invoiceNumber} ${!invoice[key] ? "marked" : "unmarked"} ${key}`, "info");
  }

  function addInvoice(invoice: Invoice) {
    onChange([invoice, ...invoices]);
    setAdding(false);
    toast(`Invoice ${invoice.invoiceNumber} added`);
  }

  function remove(invoice: Invoice) {
    onChange(invoices.filter((item) => item.invoiceId !== invoice.invoiceId));
    toast(`Invoice ${invoice.invoiceNumber} removed`, "info");
  }

  async function importFile(file: File) {
    const text = await file.text();
    const parsed = parseCSV(text);
    if (parsed.length < 2) {
      toast("No rows found in the file.", "info");
      return;
    }
    const imported = fromCSV(parsed, invoices.length);
    // Skip invoice numbers already present.
    const existing = new Set(invoices.map((i) => i.invoiceNumber));
    const fresh = imported.filter((i) => !existing.has(i.invoiceNumber));
    onChange([...fresh, ...invoices]);
    toast(`Imported ${fresh.length} invoice${fresh.length === 1 ? "" : "s"} from Tally${imported.length - fresh.length ? ` (${imported.length - fresh.length} already present)` : ""}`);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm text-slate-600">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
        <p>
          <span className="font-semibold text-blue-700">Tally Sync</span> — until automatic Tally integration is switched on, export invoices from Tally and use{" "}
          <span className="font-semibold">Import from Tally</span>, or add them manually. Mark each invoice <span className="font-semibold">Created</span> and <span className="font-semibold">Shared</span> as you process it.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Total Invoices" value={invoices.length} />
        <Stat label="Created" value={createdCount} />
        <Stat label="Shared" value={sharedCount} />
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
        <button onClick={() => setAdding(true)} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-soft">
          <Plus className="h-4 w-4" /> Add Invoice
        </button>
      </div>

      <DataTable
        columns={["Invoice", "Customer", "Town", "Date", "Amount", "Source", "Created", "Shared", "Action"]}
        rows={rows.map((item) => [
          <span key="n" className="font-semibold text-slate-900">{item.invoiceNumber}</span>,
          item.customerName,
          item.town || "—",
          safeDate(item.date),
          currency(item.amount),
          <Badge key="src" label={item.source} />,
          <MarkButton key="c" active={item.created} activeLabel="Created" idleLabel="Mark Created" icon={CheckCircle2} onClick={() => toggle(item, "created")} />,
          <MarkButton key="s" active={item.shared} activeLabel="Shared" idleLabel="Mark Shared" icon={Send} onClick={() => toggle(item, "shared")} />,
          <DeleteButton key="d" resetKey={item.invoiceId} onDelete={() => remove(item)} />
        ])}
      />
      {adding && <InvoiceModal onClose={() => setAdding(false)} onSave={addInvoice} count={invoices.length} />}
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

type Draft = { invoiceNumber: string; customerName: string; town: string; date: string; amount: string };

function InvoiceModal({ onClose, onSave, count }: { readonly onClose: () => void; readonly onSave: (invoice: Invoice) => void; readonly count: number }) {
  const [form, setForm] = useState<Draft>({ invoiceNumber: "", customerName: "", town: "", date: new Date().toISOString().slice(0, 10), amount: "" });
  const [error, setError] = useState("");

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function submit() {
    if (form.customerName.trim().length < 2) return setError("Customer name is required.");
    onSave({
      invoiceId: `INV-${Date.now()}`,
      invoiceNumber: form.invoiceNumber.trim() || `RC/INV/2026/${String(count + 1).padStart(3, "0")}`,
      customerName: form.customerName.trim(),
      town: form.town.trim(),
      date: form.date,
      amount: Math.max(0, Number(form.amount) || 0),
      source: "Manual",
      created: true,
      shared: false,
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
          <Field label="Amount (₹)" value={form.amount} onChange={(v) => set("amount", v)} type="number" />
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

function Field({ label, value, onChange, type = "text", placeholder }: { readonly label: string; readonly value: string; readonly onChange: (value: string) => void; readonly type?: string; readonly placeholder?: string }) {
  return (
    <label className="text-sm font-semibold text-slate-700">
      {label}
      <input type={type} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 font-normal outline-none ring-blue-500 focus:ring-2" />
    </label>
  );
}

function Stat({ label, value }: { readonly label: string; readonly value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-slate-950">{value}</p>
    </div>
  );
}
