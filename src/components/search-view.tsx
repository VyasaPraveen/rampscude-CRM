"use client";

import { Search } from "lucide-react";
import { useState } from "react";
import type { Customer, Lead, Product } from "@/types/crm";
import { Badge, DataTable, Panel } from "@/components/ui";

/** Overall search across customers, inventory and leads by name, town, phone, brand and model. */
export function SearchView({ customers, products, leads }: { readonly customers: Customer[]; readonly products: Product[]; readonly leads: Lead[] }) {
  const [term, setTerm] = useState("");
  const q = term.trim().toLowerCase();

  const customerHits = q
    ? customers.filter((c) => `${c.customerName} ${c.city} ${c.mobile} ${c.productBrand} ${c.productModel} ${c.companyName ?? ""}`.toLowerCase().includes(q))
    : [];
  const inventoryHits = q ? products.filter((p) => `${p.brand} ${p.model} ${p.serialNo}`.toLowerCase().includes(q)) : [];
  const leadHits = q ? leads.filter((l) => `${l.name} ${l.town} ${l.phone} ${l.source} ${l.productBrand ?? ""} ${l.productModel ?? ""}`.toLowerCase().includes(q)) : [];

  const total = customerHits.length + inventoryHits.length + leadHits.length;

  return (
    <div className="space-y-6">
      <div className="relative max-w-2xl">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
        <input
          autoFocus
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Search by customer name, town, phone, brand or model…"
          className="h-12 w-full rounded-lg border border-slate-200 bg-white pl-11 pr-3 text-sm outline-none ring-blue-500 transition focus:ring-2"
        />
      </div>

      {!q && <p className="text-sm text-slate-500">Type to search across customers, inventory and leads.</p>}

      {q && (
        <p className="text-sm text-slate-500">
          {total} result{total === 1 ? "" : "s"} for “{term}”
        </p>
      )}

      {customerHits.length > 0 && (
        <Panel title={`Customers (${customerHits.length})`}>
          <DataTable
            columns={["Name", "Town", "Phone", "Brand", "Model", "Company"]}
            rows={customerHits.map((c) => [c.customerName, c.city || "—", c.mobile || "—", c.productBrand || "—", c.productModel || "—", c.companyName || "—"])}
          />
        </Panel>
      )}

      {inventoryHits.length > 0 && (
        <Panel title={`Inventory (${inventoryHits.length})`}>
          <DataTable
            columns={["Brand", "Model", "Serial No", "Purchased From"]}
            rows={inventoryHits.map((p) => [p.brand, p.model, p.serialNo || "—", p.purchaseFrom || "—"])}
          />
        </Panel>
      )}

      {leadHits.length > 0 && (
        <Panel title={`Leads (${leadHits.length})`}>
          <DataTable
            columns={["Name", "Town", "Phone", "Brand", "Model", "Nature of Enquiry", "Status"]}
            rows={leadHits.map((l) => [l.name, l.town || "—", l.phone || "—", l.productBrand || "—", l.productModel || "—", l.source, <Badge key={l.leadId} label={l.status} />])}
          />
        </Panel>
      )}

      {q && total === 0 && <p className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-soft">No matches found.</p>}
    </div>
  );
}
