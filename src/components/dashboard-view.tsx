"use client";

import { CalendarClock, ClipboardList, CreditCard, FileText, ReceiptText, Users, Wrench } from "lucide-react";
import type { Customer, Invoice, Lead, Payment, Quotation, ServiceRequest } from "@/types/crm";
import { Chart, Panel, SimpleRows } from "@/components/ui";
import { currency } from "@/utils/format";

export function Dashboard({ customers, quotations, leads, invoices, payments, services }: { customers: Customer[]; quotations: Quotation[]; leads: Lead[]; invoices: Invoice[]; payments: Payment[]; services: ServiceRequest[] }) {
  const nameOf = (customerId: string) => {
    const c = customers.find((item) => item.customerId === customerId);
    return c ? c.companyName || c.customerName : customerId;
  };
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthsToShow = new Date().getMonth() + 1; // Jan through the current month
  const customerMonthLabels = monthNames.slice(0, monthsToShow);
  const customersByMonth = customerMonthLabels.map((_, month) => customers.filter((item) => new Date(item.createdAt).getMonth() === month).length);
  const quotationStatusLabels = ["Draft", "Sent", "Accepted", "Rejected"];
  const quotationsByStatus = quotationStatusLabels.map((status) => quotations.filter((item) => item.status === status).length);
  const stats = [
    { label: "Total Customers", value: customers.length, icon: Users },
    { label: "New Leads", value: leads.filter((item) => item.status === "New").length, icon: ClipboardList },
    { label: "Pending Follow-ups", value: leads.filter((item) => item.status === "Follow-up").length, icon: CalendarClock },
    { label: "Quotations Sent", value: quotations.filter((item) => item.status === "Sent").length, icon: FileText },
    { label: "Invoices Pending Share", value: invoices.filter((item) => !item.shared).length, icon: ReceiptText },
    { label: "Pending Payments", value: payments.filter((item) => item.status !== "Paid").length, icon: CreditCard },
    { label: "Open Service Requests", value: services.filter((item) => item.status !== "Completed").length, icon: Wrench }
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">{stat.label}</p>
                  <p className="mt-2 text-3xl font-bold text-slate-950">{stat.value}</p>
                </div>
                <div className="grid h-11 w-11 place-items-center rounded-lg bg-blue-50 text-blue-600">
                  <Icon className="h-5 w-5" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Chart title="New Customers (Monthly)" values={customersByMonth} labels={customerMonthLabels} />
        <Chart title="Quotations by Status" values={quotationsByStatus} labels={quotationStatusLabels} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Latest Customers">
          <SimpleRows rows={customers.slice(0, 5).map((item) => [item.customerName, item.city || "—", item.mobile])} />
        </Panel>
        <Panel title="Recent Leads">
          <SimpleRows rows={leads.slice(0, 5).map((item) => [item.name, item.town || "—", typeof item.quotedPrice === "number" ? currency(item.quotedPrice) : item.source])} />
        </Panel>
        <Panel title="Recent Quotations">
          <SimpleRows rows={quotations.slice(0, 5).map((item) => [item.quotationNumber, nameOf(item.customerId), currency(item.total)])} />
        </Panel>
        <Panel title="Recent Invoices">
          <SimpleRows rows={invoices.slice(0, 5).map((item) => [item.invoiceNumber, item.customerName, item.shared ? "Shared" : "Pending"])} />
        </Panel>
      </div>
    </div>
  );
}
