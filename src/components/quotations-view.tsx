"use client";

import { Link as LinkIcon, MessageCircle, Pencil, Plus, FileText } from "lucide-react";
import type { CompanySettings, Customer, Lead, Product, Quotation } from "@/types/crm";
import { Badge, DataTable, DeleteButton } from "@/components/ui";
import { useToast } from "@/components/toast";
import { currency } from "@/utils/format";
import {
  downloadQuotationPdf,
  quotationMessage,
  recipientFromCustomer,
  recipientFromLead,
  whatsappLink,
  type QuotationRecipient
} from "@/lib/export";

export function QuotationsView({
  quotations,
  customers,
  leads,
  products,
  settings,
  query,
  onEdit,
  onNew,
  onDelete
}: {
  quotations: Quotation[];
  customers: Customer[];
  leads: Lead[];
  products: Product[];
  settings: CompanySettings;
  query: string;
  onEdit: (quotation: Quotation) => void;
  onNew: () => void;
  onDelete: (quotation: Quotation) => void;
}) {
  const toast = useToast();
  const customerOf = (customerId: string) => customers.find((item) => item.customerId === customerId);
  const leadOf = (leadId?: string) => (leadId ? leads.find((item) => item.leadId === leadId) : undefined);
  const nameOf = (customerId: string) => {
    const c = customerOf(customerId);
    return c ? c.companyName || c.customerName : customerId;
  };
  // A quotation is addressed to its customer once linked, otherwise to the originating lead.
  const recipientOf = (item: Quotation): QuotationRecipient | undefined => {
    const customer = customerOf(item.customerId);
    if (customer) return recipientFromCustomer(customer);
    const lead = leadOf(item.leadId);
    return lead ? recipientFromLead(lead) : undefined;
  };
  const phoneOf = (item: Quotation) => {
    const customer = customerOf(item.customerId);
    if (customer) return (customer.whatsapp || customer.mobile || "").replace(/\D/g, "");
    return (leadOf(item.leadId)?.phone ?? "").replace(/\D/g, "");
  };
  const labelFor = (item: Quotation) => recipientOf(item)?.name || item.customerLabel || nameOf(item.customerId);
  const rows = quotations.filter((item) => `${item.quotationNumber} ${item.reference ?? ""} ${labelFor(item)}`.toLowerCase().includes(query.toLowerCase()));

  async function handlePdf(quotation: Quotation) {
    try {
      await downloadQuotationPdf(quotation, recipientOf(quotation), products, settings);
      toast(`PDF generated for ${quotation.quotationNumber}`);
    } catch {
      toast("Could not generate the PDF.", "info");
    }
  }

  function handleWhatsapp(quotation: Quotation) {
    const phone = phoneOf(quotation);
    if (!phone) {
      toast("No phone number on the linked lead or customer.", "info");
      return;
    }
    const message = quotationMessage(quotation, recipientOf(quotation), products, settings);
    window.open(whatsappLink(phone, message), "_blank", "noopener");
  }

  function handleBrochure(quotation: Quotation) {
    if (!settings.brochureUrl) {
      toast("Add a brochure link in Settings → Quotation Defaults.", "info");
      return;
    }
    const phone = phoneOf(quotation);
    if (!phone) {
      toast("No phone number on the linked lead or customer.", "info");
      return;
    }
    window.open(whatsappLink(phone, `${settings.name} — product brochure: ${settings.brochureUrl}`), "_blank", "noopener");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-end gap-2">
        <button onClick={onNew} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white"><Plus className="h-4 w-4" /> New Quotation</button>
      </div>
      <DataTable
        columns={["Quotation", "Reference", "Lead / Customer", "Subtotal", "GST", "Total", "Status", "Actions"]}
        rows={rows.map((item) => [
          item.quotationNumber,
          item.reference || "—",
          labelFor(item),
          currency(item.subtotal),
          currency(item.gst),
          currency(item.total),
          <Badge key={item.quotationId} label={item.status} />,
          <div key={`${item.quotationId}-actions`} className="flex items-center gap-2">
            <button
              onClick={() => onEdit(item)}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:border-blue-300"
            >
              <Pencil className="h-3.5 w-3.5" /> Edit
            </button>
            <button
              onClick={() => handlePdf(item)}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:border-slate-300"
            >
              <FileText className="h-3.5 w-3.5" /> PDF
            </button>
            <button
              onClick={() => handleWhatsapp(item)}
              className="inline-flex items-center gap-1 rounded-lg border border-green-200 px-2.5 py-1.5 text-xs font-semibold text-green-700 hover:border-green-300"
            >
              <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
            </button>
            <button
              onClick={() => handleBrochure(item)}
              title="Send the product brochure link"
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:border-slate-300"
            >
              <LinkIcon className="h-3.5 w-3.5" /> Brochure
            </button>
            <DeleteButton resetKey={item.quotationId} onDelete={() => onDelete(item)} />
          </div>
        ])}
      />
    </div>
  );
}
