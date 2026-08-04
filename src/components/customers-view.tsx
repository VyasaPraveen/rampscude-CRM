"use client";

import { MessageCircle, Pencil, Phone } from "lucide-react";
import type { Customer } from "@/types/crm";
import { DataTable, DeleteButton } from "@/components/ui";
import { cn } from "@/lib/utils";
import { whatsappLink } from "@/lib/export";
import { customerBalance } from "@/lib/orders";
import { currency } from "@/utils/format";

export function CustomersView({ customers, query, onEdit, onDelete }: { customers: Customer[]; query: string; onEdit: (customer: Customer) => void; onDelete: (customer: Customer) => void }) {
  const rows = customers.filter((customer) => {
    const haystack = `${customer.customerName} ${customer.companyName ?? ""} ${customer.mobile} ${customer.city} ${customer.productBrand} ${customer.productModel} ${customer.productType ?? ""}`.toLowerCase();
    return haystack.includes(query.toLowerCase());
  });

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-500">{customers.length} customers</p>
      <DataTable
        columns={["Name", "Phone", "Town", "Product Type", "Brand", "Model", "Balance", "Contact", "Actions"]}
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
              <DeleteButton resetKey={item.customerId} onDelete={() => onDelete(item)} />
            </div>
          ];
        })}
      />
    </div>
  );
}
