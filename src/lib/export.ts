import type { Customer, Product, Quotation } from "@/types/crm";
import { productLabel } from "@/types/crm";
import { shortDate } from "@/utils/format";

/** Company profile used on generated documents. */
export const COMPANY = {
  name: "RAMPS CUBE",
  tagline: "Commercial Refrigeration Solutions",
  gst: "37AABCR1234Z1Z5",
  phone: "+91 98765 43210",
  email: "sales@rampscube.com",
  address: "Plot 24, Industrial Estate, Tirupati, Andhra Pradesh 517501"
} as const;

/** Rupee formatting for PDF output — jsPDF's core fonts lack the ₹ glyph, so use "Rs.". */
function inr(value: number): string {
  return `Rs. ${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value)}`;
}

function productName(products: Product[], productId: string): string {
  const product = products.find((item) => item.productId === productId);
  return product ? productLabel(product) : productId;
}

/** Build a wa.me deep link with a pre-filled message. Strips non-digits from the number. */
export function whatsappLink(phone: string, message: string): string {
  const digits = phone.replace(/\D/g, "");
  const withCountry = digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${withCountry}?text=${encodeURIComponent(message)}`;
}

/** Plain-text quotation summary suitable for WhatsApp/SMS. */
export function quotationMessage(quotation: Quotation, customer: Customer | undefined, products: Product[]): string {
  const lines = quotation.products.map(
    (item) => `• ${productName(products, item.productId)} x${item.quantity} — ₹${new Intl.NumberFormat("en-IN").format(item.price * item.quantity)}`
  );
  return [
    `*${COMPANY.name}* — Quotation ${quotation.quotationNumber}`,
    customer ? `To: ${customer.companyName || customer.customerName}` : "",
    "",
    ...lines,
    "",
    `Subtotal: ₹${new Intl.NumberFormat("en-IN").format(quotation.subtotal)}`,
    quotation.discount ? `Discount: -₹${new Intl.NumberFormat("en-IN").format(quotation.discount)}` : "",
    `GST (18%): ₹${new Intl.NumberFormat("en-IN").format(quotation.gst)}`,
    `*Total: ₹${new Intl.NumberFormat("en-IN").format(quotation.total)}*`,
    "",
    `Thank you for your enquiry. — ${COMPANY.name}`
  ]
    .filter((line) => line !== "")
    .join("\n");
}

/** Generate and download an A4 quotation PDF. jsPDF is imported lazily to keep it out of the initial bundle. */
export async function downloadQuotationPdf(quotation: Quotation, customer: Customer | undefined, products: Product[]): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 40;

  // Header band
  doc.setFillColor(37, 99, 235);
  doc.rect(0, 0, pageWidth, 90, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text(COMPANY.name, marginX, 42);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(COMPANY.tagline, marginX, 60);
  doc.text(`GST: ${COMPANY.gst}  |  ${COMPANY.phone}`, marginX, 74);

  doc.setTextColor(30, 41, 59);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("QUOTATION", pageWidth - marginX, 42, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(quotation.quotationNumber, pageWidth - marginX, 60, { align: "right" });
  doc.text(shortDate(quotation.createdAt), pageWidth - marginX, 74, { align: "right" });

  // Bill-to
  let y = 130;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Bill To", marginX, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  y += 16;
  if (customer) {
    const heading = customer.companyName || customer.customerName;
    doc.text(heading, marginX, y);
    if (customer.companyName && customer.customerName && customer.companyName !== customer.customerName) {
      doc.text(`${customer.customerName}`, marginX, (y += 14));
    }
    const locationLine = [customer.address, customer.city].filter(Boolean).join(", ");
    if (locationLine) doc.text(locationLine, marginX, (y += 14));
    doc.text(`${customer.gst ? `GST: ${customer.gst}  |  ` : ""}${customer.mobile}`, marginX, (y += 14));
  } else {
    doc.text("—", marginX, y);
  }

  // Line items
  autoTable(doc, {
    startY: y + 24,
    head: [["#", "Product", "Qty", "Unit Price", "Amount"]],
    body: quotation.products.map((item, index) => [
      String(index + 1),
      productName(products, item.productId),
      String(item.quantity),
      inr(item.price),
      inr(item.price * item.quantity)
    ]),
    styles: { fontSize: 10, cellPadding: 6 },
    headStyles: { fillColor: [37, 99, 235], textColor: 255 },
    columnStyles: { 0: { cellWidth: 30 }, 2: { halign: "center" }, 3: { halign: "right" }, 4: { halign: "right" } }
  });

  // Totals
  const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 20;
  const labelX = pageWidth - marginX - 160;
  const valueX = pageWidth - marginX;
  const rows: [string, string][] = [
    ["Subtotal", inr(quotation.subtotal)],
    ["Discount", `- ${inr(quotation.discount)}`],
    ["GST (18%)", inr(quotation.gst)]
  ];
  doc.setFontSize(10);
  rows.forEach(([label, value], index) => {
    const ry = finalY + index * 16;
    doc.setFont("helvetica", "normal");
    doc.text(label, labelX, ry);
    doc.text(value, valueX, ry, { align: "right" });
  });
  const totalY = finalY + rows.length * 16 + 6;
  doc.setDrawColor(203, 213, 225);
  doc.line(labelX, totalY - 12, valueX, totalY - 12);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Total", labelX, totalY);
  doc.text(inr(quotation.total), valueX, totalY, { align: "right" });

  // Footer
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(
    "Terms: Prices valid for 15 days. 50% advance with order. Taxes as applicable. E&OE.",
    marginX,
    doc.internal.pageSize.getHeight() - 40
  );
  doc.text(`${COMPANY.name}  |  ${COMPANY.email}`, marginX, doc.internal.pageSize.getHeight() - 26);

  doc.save(`${quotation.quotationNumber.replace(/[^\w-]+/g, "-")}.pdf`);
}

/** Trigger a client-side CSV download. First row is treated as the header. */
export function downloadCSV(filename: string, rows: (string | number)[][]): void {
  const escape = (cell: string | number) => {
    const text = String(cell ?? "");
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const csv = rows.map((row) => row.map(escape).join(",")).join("\r\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
