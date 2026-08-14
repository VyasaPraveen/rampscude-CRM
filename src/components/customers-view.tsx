"use client";

import { Download, FileUp, MessageCircle, Pencil, Phone, Undo2 } from "lucide-react";
import { useRef } from "react";
import type { Customer, CustomerSourceType, ProductType } from "@/types/crm";
import { DataTable, DeleteButton } from "@/components/ui";
import { useToast } from "@/components/toast";
import { cn } from "@/lib/utils";
import { downloadCSV, whatsappLink } from "@/lib/export";
import { customerBalance } from "@/lib/orders";
import { parseCSV, pickColumn } from "@/lib/csv";
import { currency } from "@/utils/format";

const IMPORT_HEADER = ["Name", "Phone", "Town", "Address", "Brand", "Model", "Product Type", "Email", "Type of Customer"];

/** Map imported CSV rows to customers, tolerating common column-label variations. */
function customersFromCSV(rows: string[][]): Customer[] {
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const iName = pickColumn(header, ["name", "customer name", "party name"]);
  const iPhone = pickColumn(header, ["phone", "mobile", "phone number", "contact"]);
  const iTown = pickColumn(header, ["town", "city", "place"]);
  const iAddress = pickColumn(header, ["address"]);
  const iBrand = pickColumn(header, ["brand", "product brand"]);
  const iModel = pickColumn(header, ["model", "product model"]);
  const iType = pickColumn(header, ["product type"]);
  const iEmail = pickColumn(header, ["email", "mail id", "mail"]);
  const iSource = pickColumn(header, ["type of customer", "customer type", "source"]);
  return rows
    .slice(1)
    .map((r, index) => {
      const cell = (i: number) => (i >= 0 ? (r[i] ?? "").trim() : "");
      return {
        customerId: `CUST-${Date.now()}-${index}`,
        customerName: cell(iName),
        mobile: cell(iPhone),
        city: cell(iTown),
        address: cell(iAddress),
        productBrand: cell(iBrand),
        productModel: cell(iModel),
        productType: (cell(iType) || undefined) as ProductType | undefined,
        email: cell(iEmail),
        sourceType: (cell(iSource) || undefined) as CustomerSourceType | undefined,
        createdAt: new Date().toISOString()
      } as Customer;
    })
    .filter((c) => c.customerName || c.mobile);
}

export function CustomersView({ customers, query, onEdit, onDelete, onDeleteMany, onRevert, onImport }: { customers: Customer[]; query: string; onEdit: (customer: Customer) => void; onDelete: (customer: Customer) => void; onDeleteMany: (ids: string[]) => void; onRevert: (customer: Customer) => void; onImport: (rows: Customer[]) => void }) {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  async function importFile(file: File) {
    const parsed = parseCSV(await file.text());
    if (parsed.length < 2) {
      toast("No rows found in the file.", "info");
      return;
    }
    const imported = customersFromCSV(parsed);
    if (imported.length === 0) {
      toast("No customers found — check the column headers against the template.", "info");
      return;
    }
    onImport(imported);
  }

  function downloadTemplate() {
    downloadCSV("customer-import-template.csv", [IMPORT_HEADER, ["Ramesh Traders", "9876543210", "Tirupati", "Main Road", "Icemake", "GF-300", "Deep Freezer", "ramesh@example.com", "Existing Customer"]]);
  }

  const rows = customers.filter((customer) => {
    const haystack = `${customer.customerName} ${customer.companyName ?? ""} ${customer.mobile} ${customer.city} ${customer.productBrand} ${customer.productModel} ${customer.productType ?? ""}`.toLowerCase();
    return haystack.includes(query.toLowerCase());
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">{customers.length} customers</p>
        <div className="flex flex-wrap gap-2">
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
          <button type="button" onClick={downloadTemplate} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-blue-300">
            <Download className="h-4 w-4" /> Template
          </button>
          <button type="button" onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-soft">
            <FileUp className="h-4 w-4" /> Import CSV
          </button>
        </div>
      </div>
      <DataTable
        columns={["Name", "Phone", "Town", "Product Type", "Brand", "Model", "Balance", "Contact", "Actions"]}
        rowIds={rows.map((item) => item.customerId)}
        onDeleteSelected={onDeleteMany}
        rows={rows.map((item) => {
          const phone = item.mobile.replace(/\D/g, "");
          const waNumber = (item.whatsapp || item.mobile).replace(/\D/g, "");
          const balance = customerBalance(item);
          return [
            <span key="n" className="font-semibold text-slate-900">{item.customerName}</span>,
            item.mobile || "—",
            item.city || "—",
            item.productType || "—",
            item.productBrand || "—",
            item.productModel || "—",
            <span key="bal" className={cn("font-semibold", balance > 0 ? "text-red-600" : "text-slate-400")}>{balance > 0 ? currency(balance) : "—"}</span>,
            <div key="contact" className="flex items-center gap-2">
              <a
                href={`tel:${phone}`}
                className={cn("inline-flex items-center gap-1 rounded-lg border border-blue-200 px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:border-blue-300", !phone && "pointer-events-none opacity-40")}
                title="Call"
              >
                <Phone className="h-3.5 w-3.5" /> Call
              </a>
              <a
                href={waNumber ? whatsappLink(waNumber, `Hello ${item.customerName}, `) : undefined}
                target="_blank"
                rel="noopener noreferrer"
                className={cn("inline-flex items-center gap-1 rounded-lg border border-green-200 px-2.5 py-1.5 text-xs font-semibold text-green-700 hover:border-green-300", !waNumber && "pointer-events-none opacity-40")}
                title="WhatsApp"
              >
                <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
              </a>
            </div>,
            <div key="actions" className="flex items-center gap-2">
              <button onClick={() => onEdit(item)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:border-blue-300">
                <Pencil className="h-3.5 w-3.5" /> Edit
              </button>
              <button onClick={() => onRevert(item)} title="Move this customer back to Leads" className="inline-flex items-center gap-1 rounded-lg border border-amber-200 px-2.5 py-1.5 text-xs font-semibold text-amber-700 hover:border-amber-300">
                <Undo2 className="h-3.5 w-3.5" /> To Lead
              </button>
              <DeleteButton resetKey={item.customerId} onDelete={() => onDelete(item)} />
            </div>
          ];
        })}
      />
    </div>
  );
}
