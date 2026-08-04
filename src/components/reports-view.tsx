"use client";

import { Download, FileBarChart } from "lucide-react";
import { useState } from "react";
import type { Brand, CompanySettings, Customer, Invoice, Lead, Order, Payment, Product, Quotation, ServiceRequest } from "@/types/crm";
import { useToast } from "@/components/toast";
import { uniqueSorted } from "@/lib/options";
import { downloadCSV } from "@/lib/export";
import { cn } from "@/lib/utils";

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
  if (Number.isNaN(t)) return false;
  return t >= bounds[0] && t < bounds[1];
}

export function ReportsView(props: { customers: Customer[]; products: Product[]; brands: Brand[]; settings: CompanySettings; quotations: Quotation[]; leads: Lead[]; invoices: Invoice[]; orders: Order[]; payments: Payment[]; services: ServiceRequest[] }) {
  const toast = useToast();
  const { settings, brands } = props;
  const allCustomers = props.customers;

  const [rangeKey, setRangeKey] = useState<RangeKey>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [brandFilter, setBrandFilter] = useState("all");

  const bounds = rangeBounds(rangeKey, from, to);
  const inR = (d: string) => inRange(d, bounds);
  const brandMatch = (b?: string) => brandFilter === "all" || b === brandFilter;
  const brandChoices = uniqueSorted([...props.brands.map((b) => b.name), ...props.products.map((p) => p.brand)]);

  // Date range narrows the transactional reports; the brand filter narrows the
  // stock / sales reports. Builders below read these filtered datasets.
  const customers = props.customers.filter((c) => inR(c.createdAt));
  const leads = props.leads.filter((l) => inR(l.createdAt));
  const quotations = props.quotations.filter((q) => inR(q.createdAt));
  const orders = props.orders.filter((o) => inR(o.createdAt));
  const invoices = props.invoices.filter((i) => inR(i.date));
  const payments = props.payments.filter((p) => inR(p.createdAt));
  const services = props.services.filter((s) => inR(s.createdAt));
  const products = props.products.filter((p) => brandMatch(p.brand));

  const nameOf = (customerId: string) => {
    const c = allCustomers.find((item) => item.customerId === customerId);
    return c ? c.companyName || c.customerName : customerId;
  };
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const quotationLabel = (q: Quotation) =>
    allCustomers.some((c) => c.customerId === q.customerId) ? nameOf(q.customerId) : q.customerLabel ?? nameOf(q.customerId);

  // Stock helpers: quantity defaults to 1, cost falls back purchasePrice → NLC → 0.
  const qtyOf = (p: Product) => p.quantity ?? 1;
  const costOf = (p: Product) => p.purchasePrice ?? p.nlc ?? 0;

  const reports: { title: string; description: string; build: () => (string | number)[][] }[] = [
    {
      title: "Customer Report",
      description: "All customers with contact, product and customer-type details.",
      build: () => [
        ["Name", "Phone", "Town", "Address", "Product Type", "Brand", "Model", "Type of Customer", "Mail"],
        ...customers.map((c) => [c.customerName, c.mobile, c.city, c.address, c.productType ?? "", c.productBrand, c.productModel, c.sourceType ?? "", c.email])
      ]
    },
    {
      title: "Stock Report",
      description: "Stock sheet in the company format — purchase, NLC, sale and referral details per unit.",
      build: () => [
        [
          "Brand Name",
          "Model Name",
          "SERIAL NO.",
          "PUR-DATE",
          "INVOICE NO",
          "NLC",
          "SALE DATE",
          "SALE PRICE",
          "INVOICE NO.",
          "CUSTOMER Details",
          "Qnty",
          "By Ref:",
          "Commision"
        ],
        ...products.map((p) => [
          p.brand,
          p.model,
          p.serialNo,
          p.invoiceDate ?? "",
          p.invoiceName ?? "",
          typeof p.nlc === "number" ? p.nlc : "",
          p.saleDate ?? "",
          p.saleDate ? p.price : "",
          p.saleInvoiceNo ?? "",
          [p.soldToName, p.soldToTown].filter(Boolean).join(" , "),
          qtyOf(p),
          p.referredBy ?? "",
          typeof p.commission === "number" ? p.commission : ""
        ])
      ]
    },
    {
      title: "Sales Report (Brand × Month)",
      description: "Brand-wise quantity, amount and profit for every month of the year, with totals and margin.",
      build: () => {
        const year = new Date().getFullYear();
        const saleMonth = (p: Product) => {
          const d = new Date(p.saleDate as string);
          return Number.isNaN(d.getTime()) || d.getFullYear() !== year ? -1 : d.getMonth();
        };
        // Only units sold in the reported year, with a parseable sale date.
        const sold = products.filter((p) => p.saleDate && saleMonth(p) >= 0);
        // One row per brand in the brand master, plus any brand that only exists in stock.
        const brandNames = uniqueSorted([...brands.map((b) => b.name), ...products.map((p) => p.brand)]);
        const brandOf = (p: Product) => p.brand?.trim() || "(No brand)";

        const blank = () => ({ qty: 0, amount: 0, profit: 0 });
        const cell = (list: Product[]) =>
          list.reduce(
            (acc, p) => {
              const q = qtyOf(p);
              acc.qty += q;
              acc.amount += q * p.price;
              acc.profit += q * (p.price - costOf(p));
              return acc;
            },
            blank()
          );

        // Margin % per month (profit ÷ amount), shown in the header like the reference sheet.
        const marginPct = (list: Product[]) => {
          const c = cell(list);
          return c.amount ? `${((c.profit / c.amount) * 100).toFixed(2)}%` : "";
        };
        const header1: (string | number)[] = [`${year} Jan-Dec`];
        monthNames.forEach((m, month) => header1.push(m, "", marginPct(sold.filter((p) => saleMonth(p) === month))));
        header1.push("Total", "", marginPct(sold), "Margin %");

        const header2: (string | number)[] = ["Sales code"];
        monthNames.forEach(() => header2.push("Quantity", "Amount", "Profit/Loss"));
        header2.push("Quantity", "Amount", "Profit/Loss", "");

        const rowFor = (label: string, list: Product[]): (string | number)[] => {
          const row: (string | number)[] = [label];
          monthNames.forEach((_, month) => {
            const c = cell(list.filter((p) => saleMonth(p) === month));
            row.push(c.qty, c.amount, c.profit);
          });
          const t = cell(list);
          row.push(t.qty, t.amount, t.profit, t.amount ? Number(((t.profit / t.amount) * 100).toFixed(2)) : 0);
          return row;
        };

        return [
          [settings.city || settings.name],
          header1,
          header2,
          rowFor("Total", sold),
          ...brandNames.map((name) => rowFor(name.toUpperCase(), sold.filter((p) => brandOf(p) === name))),
          ...(sold.some((p) => brandOf(p) === "(No brand)") ? [rowFor("(NO BRAND)", sold.filter((p) => brandOf(p) === "(No brand)"))] : [])
        ];
      }
    },
    {
      title: "Stock Balance (Brand & Model)",
      description: "In-stock quantity and value plus sold quantity and value, per brand and model.",
      build: () => {
        const map = new Map<string, { brand: string; model: string; inQty: number; inVal: number; soldQty: number; soldVal: number }>();
        products.forEach((p) => {
          const key = `${p.brand}||${p.model}`;
          const g = map.get(key) ?? { brand: p.brand, model: p.model, inQty: 0, inVal: 0, soldQty: 0, soldVal: 0 };
          const q = qtyOf(p);
          const value = q * p.price;
          if (p.saleDate) {
            g.soldQty += q;
            g.soldVal += value;
          } else {
            g.inQty += q;
            g.inVal += value;
          }
          map.set(key, g);
        });
        const rows = [...map.values()].sort((a, b) => a.brand.localeCompare(b.brand) || a.model.localeCompare(b.model));
        const totals = rows.reduce((t, r) => ({ inQty: t.inQty + r.inQty, inVal: t.inVal + r.inVal, soldQty: t.soldQty + r.soldQty, soldVal: t.soldVal + r.soldVal }), { inQty: 0, inVal: 0, soldQty: 0, soldVal: 0 });
        return [
          ["Brand", "Model", "In-Stock Qty", "Stock Value (INR)", "Sold Qty", "Sold Value (INR)"],
          ...rows.map((r) => [r.brand, r.model, r.inQty, r.inVal, r.soldQty, r.soldVal] as (string | number)[]),
          ["TOTAL", "", totals.inQty, totals.inVal, totals.soldQty, totals.soldVal]
        ];
      }
    },
    {
      title: "Brand-wise Summary",
      description: "Stock and sales rolled up by brand — items, quantities and values.",
      build: () => {
        const map = new Map<string, { brand: string; items: number; inQty: number; inVal: number; soldQty: number; soldVal: number }>();
        products.forEach((p) => {
          const g = map.get(p.brand) ?? { brand: p.brand, items: 0, inQty: 0, inVal: 0, soldQty: 0, soldVal: 0 };
          const q = qtyOf(p);
          const value = q * p.price;
          g.items += 1;
          if (p.saleDate) {
            g.soldQty += q;
            g.soldVal += value;
          } else {
            g.inQty += q;
            g.inVal += value;
          }
          map.set(p.brand, g);
        });
        const rows = [...map.values()].sort((a, b) => a.brand.localeCompare(b.brand));
        return [
          ["Brand", "Line Items", "In-Stock Qty", "Stock Value (INR)", "Sold Qty", "Sold Value (INR)"],
          ...rows.map((r) => [r.brand, r.items, r.inQty, r.inVal, r.soldQty, r.soldVal] as (string | number)[])
        ];
      }
    },
    {
      title: "Monthly Sales & Profit (Detail)",
      description: "This year’s sold items by month, brand and model with sale value, cost and profit.",
      build: () => {
        const map = new Map<string, { month: number; brand: string; model: string; units: number; sale: number; cost: number }>();
        products
          .filter((p) => p.saleDate)
          .forEach((p) => {
            const d = new Date(p.saleDate as string);
            if (Number.isNaN(d.getTime()) || d.getFullYear() !== new Date().getFullYear()) return;
            const month = d.getMonth();
            const key = `${month}||${p.brand}||${p.model}`;
            const g = map.get(key) ?? { month, brand: p.brand, model: p.model, units: 0, sale: 0, cost: 0 };
            const q = qtyOf(p);
            g.units += q;
            g.sale += q * p.price;
            g.cost += q * costOf(p);
            map.set(key, g);
          });
        const rows = [...map.values()].sort((a, b) => a.month - b.month || a.brand.localeCompare(b.brand) || a.model.localeCompare(b.model));
        const totals = rows.reduce((t, r) => ({ units: t.units + r.units, sale: t.sale + r.sale, cost: t.cost + r.cost }), { units: 0, sale: 0, cost: 0 });
        return [
          ["Month", "Brand", "Model", "Units Sold", "Sale Value (INR)", "Cost (INR)", "Profit (INR)"],
          ...rows.map((r) => [monthNames[r.month], r.brand, r.model, r.units, r.sale, r.cost, r.sale - r.cost] as (string | number)[]),
          ["TOTAL", "", "", totals.units, totals.sale, totals.cost, totals.sale - totals.cost]
        ];
      }
    },
    {
      title: "Leads Report",
      description: "Leads with contact, product, source, interest and status.",
      build: () => [
        ["Lead", "Name", "Town", "Phone", "Mail", "Product Type", "Brand", "Model", "Type of Customer", "Nature of Enquiry", "Quoted Price", "Status", "Converted"],
        ...leads.map((l) => [l.leadNumber, l.name, l.town, l.phone, l.email ?? "", l.productType ?? "", l.productBrand ?? "", l.productModel ?? "", l.sourceType ?? "", l.source, l.quotedPrice ?? "", l.status, l.convertedCustomerId ? "Yes" : "No"])
      ]
    },
    {
      title: "Invoice Report",
      description: "Invoices with source and Created / Shared state.",
      build: () => [["Invoice", "Customer", "Town", "Date", "Amount", "Source", "Created", "Shared"], ...invoices.map((i) => [i.invoiceNumber, i.customerName, i.town, i.date, i.amount, i.source, i.created ? "Yes" : "No", i.shared ? "Yes" : "No"])]
    },
    {
      title: "Quotation Report",
      description: "Quotations with values, discount and GST.",
      build: () => [["Quotation", "Reference", "Customer", "Subtotal", "Discount", "GST", "Total", "Status"], ...quotations.map((q) => [q.quotationNumber, q.reference ?? "", quotationLabel(q), q.subtotal, q.discount, q.gst, q.total, q.status])]
    },
    {
      title: "Order Report",
      description: "Orders with delivery and payment status.",
      build: () => [["Order", "Customer", "Delivery", "Payment", "Status"], ...orders.map((o) => [o.orderNumber, nameOf(o.customerId), o.deliveryDate, o.paymentStatus, o.status])]
    },
    {
      title: "Pending Payments",
      description: "Invoices with an outstanding balance.",
      build: () => [["Invoice", "Customer", "Amount", "Paid", "Balance", "Status"], ...payments.filter((p) => p.status !== "Paid").map((p) => [p.invoiceNumber, nameOf(p.customerId), p.invoiceAmount, p.paidAmount, p.balanceAmount, p.status])]
    },
    {
      title: "Service Report",
      description: "Service requests with technician and status.",
      build: () => [["Service", "Customer", "Product", "Complaint", "Technician", "Status"], ...services.map((s) => [s.serviceNumber, nameOf(s.customerId), s.product, s.complaint, s.assignedTo, s.status])]
    },
    {
      title: "Monthly Sales Summary",
      description: "Quotation count and value by month.",
      build: () => [
        ["Month", "Quotations", "Total Value (INR)"],
        ...monthNames
          .map((name, month) => {
            const monthly = quotations.filter((q) => new Date(q.createdAt).getMonth() === month);
            return [name, monthly.length, monthly.reduce((sum, q) => sum + q.total, 0)] as (string | number)[];
          })
          .filter((row) => (row[1] as number) > 0)
      ]
    }
  ];

  function exportReport(report: (typeof reports)[number]) {
    downloadCSV(`${report.title.replace(/\s+/g, "-")}.csv`, report.build());
    toast(`${report.title} exported`);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3">
        <div className="flex flex-wrap items-center gap-2">
          {(Object.keys(RANGE_LABELS) as RangeKey[]).map((key) => (
            <button
              key={key}
              type="button"
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
          <label className="ml-auto flex items-center gap-2 text-sm font-medium text-slate-600">
            Brand
            <select value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)} className="h-9 rounded-lg border border-slate-200 px-2 text-sm outline-none ring-blue-500 focus:ring-2">
              <option value="all">All brands</option>
              {brandChoices.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </label>
        </div>
        <p className="text-xs text-slate-500">
          Date range applies to Customers, Leads, Quotations, Orders, Invoices, Payments &amp; Services. Brand applies to the Stock &amp; Sales reports.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {reports.map((report) => (
        <div key={report.title} className="flex flex-col rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
          <FileBarChart className="mb-4 h-8 w-8 text-blue-600" />
          <h3 className="font-bold text-slate-950">{report.title}</h3>
          <p className="mt-2 flex-1 text-sm text-slate-500">{report.description}</p>
          <button
            onClick={() => exportReport(report)}
            className="mt-5 inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
          >
            <Download className="h-4 w-4" /> Export CSV
          </button>
        </div>
      ))}
      </div>
    </div>
  );
}
