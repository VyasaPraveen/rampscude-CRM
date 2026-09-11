import type { CompanySettings, Customer, Invoice, Lead, Order, Payment, Product, Quotation } from "@/types/crm";
import { productLabel } from "@/types/crm";
import { gstLabel, inclusiveBreakdown, totalsForQuotation } from "@/lib/gst";
import { purchaseLabel } from "@/lib/orders";

/** Rupee formatting for PDF output — jsPDF's core fonts lack the ₹ glyph, so use plain digits. */
function inr(value: number): string {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value);
}

/** Amount with the currency marker — jsPDF's core fonts have no rupee glyph. */
function rs(value: number): string {
  return `Rs. ${inr(value)}`;
}

function productName(products: Product[], line: { productId: string; label?: string }): string {
  const product = products.find((item) => item.productId === line.productId);
  return product ? productLabel(product) : line.label || line.productId;
}

/** Who a quotation is addressed to — built from either a lead or a customer. */
export interface QuotationRecipient {
  name: string;
  addressLines: string[];
  contactName?: string;
  phone?: string;
}

export function recipientFromCustomer(customer: Customer): QuotationRecipient {
  return {
    name: (customer.companyName || customer.customerName || "").toUpperCase(),
    addressLines: [customer.address, customer.city].filter(Boolean) as string[],
    contactName: customer.customerName,
    phone: customer.mobile
  };
}

export function recipientFromLead(lead: Lead): QuotationRecipient {
  return {
    name: (lead.name || "").toUpperCase(),
    addressLines: [lead.address, lead.town].filter(Boolean) as string[],
    contactName: lead.name,
    phone: lead.phone
  };
}

/** Build a wa.me deep link with a pre-filled message. Strips non-digits from the number. */
export function whatsappLink(phone: string, message: string): string {
  const digits = phone.replace(/\D/g, "");
  const withCountry = digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${withCountry}?text=${encodeURIComponent(message)}`;
}

/** Plain-text quotation summary suitable for WhatsApp/SMS. */
export function quotationMessage(
  quotation: Quotation,
  recipient: QuotationRecipient | undefined,
  products: Product[],
  settings: CompanySettings
): string {
  const lines = quotation.products.map(
    (item) => `• ${productName(products, item)} x${item.quantity} — ₹${inr(item.price * item.quantity)}`
  );
  const split = totalsForQuotation(quotation, settings);
  const brochure = quotation.brochureUrl || settings.brochureUrl;
  return [
    `*${settings.name}* — Quotation ${quotation.quotationNumber}`,
    recipient ? `To: ${recipient.name}` : "",
    "",
    ...lines,
    "",
    split.effectiveDiscount ? `Price (incl. GST): ₹${inr(split.gross)}` : "",
    split.effectiveDiscount ? `Discount: -₹${inr(split.effectiveDiscount)}` : "",
    `Net Amount: ₹${inr(split.taxable)}`,
    `CGST: ₹${inr(split.cgst)}`,
    `SGST: ₹${inr(split.sgst)}`,
    `*Total (incl. GST): ₹${inr(split.total)}*`,
    brochure ? `\nBrochure: ${brochure}` : "",
    "",
    `Thank you for your enquiry. — ${settings.name}`
  ]
    .filter((line) => line !== "")
    .join("\n");
}

/** Load an image (data URI or same-origin path) as a data URL for embedding in the PDF. */
async function loadImage(src: string): Promise<string | undefined> {
  if (!src) return undefined;
  if (src.startsWith("data:")) return src;
  try {
    const response = await fetch(src);
    if (!response.ok) return undefined;
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return undefined;
  }
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return `${String(date.getDate()).padStart(2, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${date.getFullYear()}`;
}

/**
 * Generate and download an A4 quotation PDF laid out to match the company's
 * existing quotation format. jsPDF is imported lazily to keep it out of the
 * initial bundle.
 */
export async function downloadQuotationPdf(
  quotation: Quotation,
  recipient: QuotationRecipient | undefined,
  products: Product[],
  settings: CompanySettings
): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 40;
  let y = 44;

  // ---- Letterhead -------------------------------------------------------
  const logo = await loadImage(settings.logo ?? "");
  let drewLogo = false;
  if (logo) {
    try {
      const props = doc.getImageProperties(logo);
      const width = 190;
      const height = (props.height / props.width) * width;
      doc.addImage(logo, "PNG", marginX, y - 12, width, height);
      y += height - 4;
      drewLogo = true;
    } catch {
      // Unreadable image — fall back to the text letterhead below.
    }
  }
  if (!drewLogo) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(17);
    doc.setTextColor(17, 24, 39);
    doc.text(settings.name, marginX, y);
    y += 16;
    if (settings.tagline) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text(settings.tagline, marginX, y);
      y += 12;
    }
  }

  // Company contact line + date
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  const contactBits = [
    [settings.addressLine1, settings.addressLine2].filter(Boolean).join(", "),
    [settings.city, settings.pincode].filter(Boolean).join(" - "),
    [settings.phone, settings.altPhone].filter(Boolean).join(" / "),
    settings.email,
    settings.gstin ? `GSTIN: ${settings.gstin}` : ""
  ].filter(Boolean);
  contactBits.forEach((line) => {
    doc.text(line, marginX, (y += 11));
  });

  doc.setTextColor(17, 24, 39);
  doc.setFontSize(10);
  doc.text(formatDate(quotation.createdAt), pageWidth - marginX, 52, { align: "right" });
  doc.text(quotation.quotationNumber, pageWidth - marginX, 66, { align: "right" });
  if (quotation.reference) doc.text(`Ref: ${quotation.reference}`, pageWidth - marginX, 80, { align: "right" });

  doc.setDrawColor(203, 213, 225);
  doc.line(marginX, (y += 10), pageWidth - marginX, y);

  // ---- Addressee --------------------------------------------------------
  y += 22;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.text("To,", marginX, y);
  if (recipient) {
    doc.setFont("helvetica", "bold");
    doc.text(recipient.name, marginX, (y += 14));
    doc.setFont("helvetica", "normal");
    recipient.addressLines.forEach((line) => doc.text(line, marginX, (y += 13)));
    if (recipient.contactName || recipient.phone) {
      doc.text(`Contact :- ${[recipient.contactName, recipient.phone].filter(Boolean).join(" , ")}.`, marginX, (y += 13));
    }
  } else {
    doc.text("—", marginX, (y += 14));
  }

  y += 26;
  doc.text("Dear sir/Madam", marginX, y);

  const first = quotation.products[0] ? productName(products, quotation.products[0]) : "your requirement";
  const subject = quotation.products.length > 1 ? `${first} and others` : first;
  doc.setFont("helvetica", "bold");
  doc.text(`Sub:- Quotation for ${subject}.`, marginX, (y += 22));

  // ---- Line items -------------------------------------------------------
  autoTable(doc, {
    startY: y + 14,
    head: [["SL.NO.", "Description", "QTY", "RATE", "GST %", "TOTAL"]],
    body: quotation.products.map((item, index) => [
      String(index + 1).padStart(2, "0"),
      productName(products, item),
      String(item.quantity),
      rs(item.price),
      `${item.gstRate ?? settings.gstRate}%`,
      rs(item.price * item.quantity)
    ]),
    styles: { fontSize: 9.5, cellPadding: 6, lineColor: [148, 163, 184], lineWidth: 0.5, textColor: [17, 24, 39] },
    headStyles: { fillColor: [241, 245, 249], textColor: [17, 24, 39], fontStyle: "bold", halign: "center" },
    columnStyles: {
      0: { cellWidth: 42, halign: "center" },
      2: { cellWidth: 38, halign: "center" },
      3: { cellWidth: 74, halign: "right" },
      4: { cellWidth: 46, halign: "center" },
      5: { cellWidth: 78, halign: "right" }
    },
    margin: { left: marginX, right: marginX }
  });

  // ---- Totals -----------------------------------------------------------
  let cursor = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 16;
  /** Start a new page when `need` points of content would run past the bottom margin. */
  const ensureRoom = (need: number) => {
    if (cursor + need > pageHeight - 48) {
      doc.addPage();
      cursor = 56;
    }
  };
  ensureRoom(90);
  const labelX = pageWidth - marginX - 170;
  const valueX = pageWidth - marginX;
  // Line prices are GST-inclusive, so the totals block breaks the tax back out:
  // Net Amount + CGST + SGST reconciles to the inclusive Total.
  const split = totalsForQuotation(quotation, settings);
  const totals: [string, string][] = [];
  if (split.effectiveDiscount > 0) {
    totals.push(["Price (incl. GST)", rs(split.gross)]);
    totals.push(["Discount", `- ${rs(split.effectiveDiscount)}`]);
  }
  totals.push(["Net Amount", rs(split.taxable)]);
  if (split.byRate.length > 1) {
    split.byRate.forEach((bucket) => {
      totals.push([`CGST @ ${bucket.rate / 2}%`, rs(bucket.cgst)]);
      totals.push([`SGST @ ${bucket.rate / 2}%`, rs(bucket.sgst)]);
    });
  } else {
    const rate = split.byRate[0]?.rate ?? settings.gstRate;
    totals.push([`CGST @ ${rate / 2}%`, rs(split.cgst)]);
    totals.push([`SGST @ ${rate / 2}%`, rs(split.sgst)]);
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  totals.forEach(([label, value]) => {
    doc.text(label, labelX, cursor);
    doc.text(value, valueX, cursor, { align: "right" });
    cursor += 15;
  });
  doc.setDrawColor(148, 163, 184);
  doc.line(labelX, cursor - 9, valueX, cursor - 9);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11.5);
  doc.text("Total", labelX, cursor + 4);
  doc.text(rs(quotation.total), valueX, cursor + 4, { align: "right" });
  cursor += 30;

  // ---- Terms ------------------------------------------------------------
  ensureRoom(60);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.text("TERMS AND CONDITIONS", marginX, cursor);
  cursor += 16;

  const issued = new Date(quotation.createdAt);
  const validUntil = Number.isNaN(issued.getTime()) ? null : new Date(issued.getTime() + settings.validityDays * 86_400_000);
  const terms = [
    `${gstLabel(split.byRate, settings.gstRate).replace(/^GST \(/, "GST ").replace(/\)$/, "")} is applicable if you need the Bill.`,
    validUntil ? `Quotation validity up to ${formatDate(validUntil.toISOString())}.` : "",
    settings.paymentTerms,
    settings.warranty ? `Warranty: ${settings.warranty}` : "",
    settings.transport ? `Transport: ${settings.transport}` : "",
    settings.deliveryTime ? `Delivery: ${settings.deliveryTime}` : "",
    settings.brochureUrl ? `Product brochure: ${settings.brochureUrl}` : ""
  ].filter(Boolean);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  terms.forEach((term, index) => {
    const wrapped = doc.splitTextToSize(`${index + 1}. ${term}`, pageWidth - marginX * 2 - 40) as string[];
    wrapped.forEach((line) => {
      ensureRoom(14);
      doc.text(line, marginX + 8, cursor);
      cursor += 12;
    });
  });

  // ---- Signature + bank -------------------------------------------------
  // The signature and bank blocks need ~120pt; start a fresh page rather than overlap the terms.
  ensureRoom(130);
  const signBlockY = cursor + 24;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Yours truly,", marginX + 8, signBlockY);
  doc.setFont("helvetica", "bold");
  doc.text(`For ${settings.name}`, marginX, signBlockY + 15);

  let nameY = signBlockY + 70;
  const signature = await loadImage(settings.signature ?? "");
  if (signature) {
    try {
      const props = doc.getImageProperties(signature);
      const width = 110;
      const height = Math.min(46, (props.height / props.width) * width);
      doc.addImage(signature, "PNG", marginX + 6, signBlockY + 20, width, height);
      nameY = signBlockY + 24 + height + 14;
    } catch {
      // Ignore an unreadable signature image.
    }
  }
  doc.setFont("helvetica", "normal");
  doc.text(`( ${settings.proprietor} )`, marginX + 6, nameY);

  // Bank details, bottom-right like the reference quotation.
  const bankX = pageWidth - marginX;
  let bankY = signBlockY + 24;
  doc.setFontSize(9.5);
  const bankLines = [
    settings.bankName ? `Our Bank : ${settings.bankName}` : "",
    settings.accountNo ? `A/C No. ${settings.accountNo},` : "",
    settings.ifsc ? `IFSC Code ${settings.ifsc}` : "",
    settings.branch ? `Branch: ${settings.branch}` : ""
  ].filter(Boolean);
  bankLines.forEach((line) => {
    doc.text(line, bankX, bankY, { align: "right" });
    bankY += 13;
  });

  doc.save(`${quotation.quotationNumber.replace(/[^\w-]+/g, "-")}.pdf`);
}

/**
 * Generate and download a GST tax-invoice PDF from a saved invoice. The amount is
 * GST-inclusive, so the body shows Net + CGST + SGST reconciling to the total.
 */
export async function downloadInvoicePdf(invoice: Invoice, settings: CompanySettings): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 40;
  let y = 44;

  // Letterhead
  const logo = await loadImage(settings.logo ?? "");
  let drewLogo = false;
  if (logo) {
    try {
      const props = doc.getImageProperties(logo);
      const width = 190;
      const height = (props.height / props.width) * width;
      doc.addImage(logo, "PNG", marginX, y - 12, width, height);
      y += height - 4;
      drewLogo = true;
    } catch {
      // fall back to text
    }
  }
  if (!drewLogo) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(17);
    doc.setTextColor(17, 24, 39);
    doc.text(settings.name, marginX, y);
    y += 16;
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  [
    [settings.addressLine1, settings.addressLine2].filter(Boolean).join(", "),
    [settings.city, settings.pincode].filter(Boolean).join(" - "),
    [settings.phone, settings.altPhone].filter(Boolean).join(" / "),
    settings.gstin ? `GSTIN: ${settings.gstin}` : ""
  ]
    .filter(Boolean)
    .forEach((line) => doc.text(line, marginX, (y += 11)));

  doc.setTextColor(17, 24, 39);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("TAX INVOICE", pageWidth - marginX, 50, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(invoice.invoiceNumber, pageWidth - marginX, 68, { align: "right" });
  doc.text(formatDate(invoice.date), pageWidth - marginX, 82, { align: "right" });

  doc.setDrawColor(203, 213, 225);
  doc.line(marginX, (y += 12), pageWidth - marginX, y);

  // Bill to
  y += 20;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.text("Bill To,", marginX, y);
  doc.setFont("helvetica", "bold");
  doc.text(invoice.customerName || "—", marginX, (y += 14));
  doc.setFont("helvetica", "normal");
  if (invoice.town) doc.text(invoice.town, marginX, (y += 13));

  const { net, cgst, sgst } = inclusiveBreakdown(invoice.amount, invoice.gstRate ?? settings.gstRate);
  const rate = invoice.gstRate ?? settings.gstRate;

  autoTable(doc, {
    startY: y + 18,
    head: [["Description", "Taxable Value", `CGST @ ${rate / 2}%`, `SGST @ ${rate / 2}%`, "Total"]],
    body: [[invoice.productLabel || "Goods / Services", rs(net), rs(cgst), rs(sgst), rs(invoice.amount)]],
    styles: { fontSize: 9.5, cellPadding: 6, lineColor: [148, 163, 184], lineWidth: 0.5, textColor: [17, 24, 39] },
    headStyles: { fillColor: [241, 245, 249], textColor: [17, 24, 39], fontStyle: "bold", halign: "center" },
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" } },
    margin: { left: marginX, right: marginX }
  });

  let cursor = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 16;
  const labelX = pageWidth - marginX - 170;
  const valueX = pageWidth - marginX;
  ([
    ["Net Amount", rs(net)],
    [`CGST @ ${rate / 2}%`, rs(cgst)],
    [`SGST @ ${rate / 2}%`, rs(sgst)]
  ] as [string, string][]).forEach(([label, value]) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(label, labelX, cursor);
    doc.text(value, valueX, cursor, { align: "right" });
    cursor += 15;
  });
  doc.setDrawColor(148, 163, 184);
  doc.line(labelX, cursor - 9, valueX, cursor - 9);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11.5);
  doc.text("Total (incl. GST)", labelX, cursor + 4);
  doc.text(rs(invoice.amount), valueX, cursor + 4, { align: "right" });

  // Bank + signatory
  cursor += 44;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  [
    settings.bankName ? `Our Bank : ${settings.bankName}` : "",
    settings.accountNo ? `A/C No. ${settings.accountNo}` : "",
    settings.ifsc ? `IFSC Code ${settings.ifsc}` : "",
    settings.branch ? `Branch: ${settings.branch}` : ""
  ]
    .filter(Boolean)
    .forEach((line) => doc.text(line, marginX, (cursor += 13)));
  doc.setFont("helvetica", "bold");
  doc.text(`For ${settings.name}`, valueX, cursor - 26, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.text(`( ${settings.proprietor} )`, valueX, cursor, { align: "right" });

  doc.save(`${invoice.invoiceNumber.replace(/[^\w-]+/g, "-")}.pdf`);
}

/**
 * Generate and download an A5 order sheet — a compact confirmation the shop can
 * print and hand over. Shows the product, money split, delivery and payment.
 */
export async function downloadOrderPdf(order: Order, customer: Customer | undefined, settings: CompanySettings): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const doc = new jsPDF({ unit: "pt", format: "a5" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 32;
  let y = 40;

  // Letterhead (logo if set, else the company name).
  const logo = await loadImage(settings.logo ?? "");
  let drewLogo = false;
  if (logo) {
    try {
      const props = doc.getImageProperties(logo);
      const width = 140;
      const height = (props.height / props.width) * width;
      doc.addImage(logo, "PNG", marginX, y - 12, width, height);
      y += height - 6;
      drewLogo = true;
    } catch {
      // fall back to text
    }
  }
  if (!drewLogo) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(17, 24, 39);
    doc.text(settings.name, marginX, y);
    y += 14;
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  [
    [settings.addressLine1, settings.addressLine2].filter(Boolean).join(", "),
    [settings.city, settings.pincode].filter(Boolean).join(" - "),
    [settings.phone, settings.altPhone].filter(Boolean).join(" / ")
  ]
    .filter(Boolean)
    .forEach((line) => doc.text(line, marginX, (y += 10)));

  doc.setTextColor(17, 24, 39);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("ORDER", pageWidth - marginX, 44, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(order.orderNumber, pageWidth - marginX, 60, { align: "right" });
  doc.text(formatDate(order.createdAt), pageWidth - marginX, 72, { align: "right" });

  doc.setDrawColor(203, 213, 225);
  doc.line(marginX, (y += 10), pageWidth - marginX, y);

  // Customer block.
  y += 16;
  doc.setFontSize(9);
  doc.text("Customer:", marginX, y);
  doc.setFont("helvetica", "bold");
  doc.text(customer ? customer.companyName || customer.customerName : "—", marginX + 58, y);
  doc.setFont("helvetica", "normal");
  if (customer?.city) doc.text(customer.city, marginX + 58, (y += 12));
  if (customer?.mobile) doc.text(customer.mobile, marginX + 58, (y += 12));

  // Product + money.
  const amount = order.amount ?? 0;
  const advance = order.advancePaid ?? 0;
  const balance = Math.max(0, amount - advance);
  autoTable(doc, {
    startY: y + 16,
    head: [["Product / Model", "Amount", "Advance", "Balance"]],
    body: [[order.productLabel || order.quotationId || "—", rs(amount), rs(advance), rs(balance)]],
    styles: { fontSize: 8.5, cellPadding: 5, lineColor: [148, 163, 184], lineWidth: 0.5, textColor: [17, 24, 39] },
    headStyles: { fillColor: [241, 245, 249], textColor: [17, 24, 39], fontStyle: "bold", halign: "center" },
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" } },
    margin: { left: marginX, right: marginX }
  });

  let cursor = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 16;
  doc.setFontSize(9);
  ([
    ["Delivery Date", order.deliveryDate ? formatDate(order.deliveryDate) : "—"],
    ["Payment", order.paymentStatus],
    ["Payment Mode", order.paymentMode || "—"],
    ["Order Status", order.status]
  ] as [string, string][]).forEach(([label, value]) => {
    doc.setFont("helvetica", "normal");
    doc.text(`${label}:`, marginX, cursor);
    doc.setFont("helvetica", "bold");
    doc.text(value, marginX + 92, cursor);
    cursor += 14;
  });

  cursor += 24;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`For ${settings.name}`, pageWidth - marginX, cursor, { align: "right" });
  doc.text(`( ${settings.proprietor} )`, pageWidth - marginX, cursor + 40, { align: "right" });

  doc.save(`${order.orderNumber.replace(/[^\w-]+/g, "-")}.pdf`);
}

/** Trigger a client-side CSV download. First row is treated as the header. */
export function downloadCSV(filename: string, rows: (string | number)[][]): void {
  const escape = (cell: string | number) => {
    // Numbers are safe as-is (keeps negatives numeric for analysis).
    if (typeof cell === "number") return String(cell);
    const text = String(cell ?? "");
    // Neutralise spreadsheet formula injection: a text cell starting with = + - @
    // (or a leading tab / CR) is prefixed with ' so Excel/Sheets treat it as text,
    // never executing it as a formula on whoever opens the export.
    const guarded = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
    return /[",\n]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded;
  };
  const csv = rows.map((row) => row.map(escape).join(",")).join("\r\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  // The anchor must be in the document for Firefox to honour the click, and the
  // object URL must outlive the click — revoking synchronously can cancel the
  // download before the browser has started reading the blob.
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/* ------------------------------------------------------------------ *
 * Shared document plumbing for the receipt and report PDFs.
 * The existing quotation / invoice / order builders above are left as
 * they are — they are in production and lay themselves out by hand.
 * ------------------------------------------------------------------ */

/** How a generated PDF is delivered. */
export type PdfMode = "save" | "print";

/** What actually happened, so the caller can tell the user the truth. */
export type PdfResult = "saved" | "printed" | "print-blocked";

type Pdf = import("jspdf").jsPDF;

/**
 * Deliver a finished document.
 *
 * "print" opens the PDF in a new tab with the browser's print dialog already
 * armed. Pop-up blockers can veto that, so it falls back to a normal download
 * and reports which one happened — never claim "sent to printer" when the
 * browser silently blocked the window.
 */
function emitPdf(doc: Pdf, filename: string, mode: PdfMode): PdfResult {
  if (mode === "print") {
    doc.autoPrint();
    const url = doc.output("bloburl") as unknown as string;
    const win = window.open(url, "_blank");
    if (win) {
      // The new tab needs the blob to still exist while it loads and prints, but the
      // URL must not be held forever — every print would otherwise leak a whole PDF.
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      return "printed";
    }
    URL.revokeObjectURL(url);
    doc.save(filename);          // pop-up blocked — at least give them the file
    return "print-blocked";
  }
  doc.save(filename);
  return "saved";
}

/** Safe filename stem from a document title / number. */
function fileStem(value: string): string {
  return value.replace(/[^\w-]+/g, "-").replace(/^-+|-+$/g, "") || "document";
}

/**
 * Draw the company letterhead (logo or name, address, contact) and the document
 * title block on the right. Returns the y cursor below the rule.
 */
async function drawLetterhead(
  doc: Pdf,
  settings: CompanySettings,
  options: { title: string; reference?: string; date?: string; marginX: number; logoWidth: number; compact?: boolean }
): Promise<number> {
  const { title, reference, date, marginX, logoWidth, compact } = options;
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = compact ? 40 : 44;

  const logo = await loadImage(settings.logo ?? "");
  let drewLogo = false;
  if (logo) {
    try {
      const props = doc.getImageProperties(logo);
      const height = (props.height / props.width) * logoWidth;
      doc.addImage(logo, "PNG", marginX, y - 12, logoWidth, height);
      y += height - 6;
      drewLogo = true;
    } catch {
      // Unreadable image — fall through to the text letterhead.
    }
  }
  if (!drewLogo) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(compact ? 14 : 17);
    doc.setTextColor(17, 24, 39);
    doc.text(settings.name, marginX, y);
    y += compact ? 14 : 16;
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(compact ? 7.5 : 8.5);
  doc.setTextColor(100, 116, 139);
  [
    [settings.addressLine1, settings.addressLine2].filter(Boolean).join(", "),
    [settings.city, settings.pincode].filter(Boolean).join(" - "),
    [settings.phone, settings.altPhone].filter(Boolean).join(" / "),
    settings.gstin ? `GSTIN: ${settings.gstin}` : ""
  ]
    .filter(Boolean)
    .forEach((line) => doc.text(line, marginX, (y += compact ? 10 : 11)));

  doc.setTextColor(17, 24, 39);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(compact ? 12 : 13);
  doc.text(title, pageWidth - marginX, compact ? 44 : 50, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(compact ? 9 : 10);
  if (reference) doc.text(reference, pageWidth - marginX, compact ? 60 : 68, { align: "right" });
  if (date) doc.text(date, pageWidth - marginX, compact ? 72 : 82, { align: "right" });

  doc.setDrawColor(203, 213, 225);
  doc.line(marginX, (y += compact ? 10 : 12), pageWidth - marginX, y);
  return y;
}

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve",
  "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function twoDigits(n: number): string {
  if (n < 20) return ONES[n];
  const rest = n % 10;
  return `${TENS[Math.floor(n / 10)]}${rest ? ` ${ONES[rest]}` : ""}`;
}

/**
 * Rupees in words using the Indian numbering system (crore / lakh / thousand),
 * as expected on an Indian payment receipt. Paise are ignored — every amount in
 * this CRM is whole rupees.
 */
export function amountInWords(value: number): string {
  const amount = Math.max(0, Math.round(value));
  if (amount === 0) return "Zero Rupees Only";
  const parts: string[] = [];
  const push = (n: number, label: string) => {
    if (n > 0) parts.push(`${twoDigits(n)} ${label}`);
  };
  push(Math.floor(amount / 10000000), "Crore");
  push(Math.floor((amount % 10000000) / 100000), "Lakh");
  push(Math.floor((amount % 100000) / 1000), "Thousand");
  push(Math.floor((amount % 1000) / 100), "Hundred");
  const last = amount % 100;
  if (last > 0) parts.push(twoDigits(last));
  return `${parts.join(" ")} Rupees Only`;
}

/**
 * A5 payment receipt — the slip handed to (or sent to) the customer when money
 * is taken. Shows what the payment was against, the money split, and the running
 * balance, so the customer can see exactly what is still outstanding.
 */
export async function downloadPaymentReceiptPdf(
  payment: Payment,
  customer: Customer | undefined,
  settings: CompanySettings,
  mode: PdfMode = "save"
): Promise<PdfResult> {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const doc = new jsPDF({ unit: "pt", format: "a5" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 32;

  let y = await drawLetterhead(doc, settings, {
    title: "PAYMENT RECEIPT",
    reference: payment.invoiceNumber,
    date: formatDate(payment.createdAt),
    marginX,
    logoWidth: 140,
    compact: true
  });

  // Received-from block.
  y += 16;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Received from:", marginX, y);
  doc.setFont("helvetica", "bold");
  doc.text(customer ? customer.companyName || customer.customerName : "—", marginX + 74, y);
  doc.setFont("helvetica", "normal");
  if (customer?.city) doc.text(customer.city, marginX + 74, (y += 12));
  if (customer?.mobile) doc.text(customer.mobile, marginX + 74, (y += 12));

  const invoiceAmount = payment.invoiceAmount || 0;
  const paid = payment.paidAmount || 0;
  const balance = Math.max(0, payment.balanceAmount ?? invoiceAmount - paid);

  autoTable(doc, {
    startY: y + 16,
    head: [["Towards", "Invoice Amount", "Paid", "Balance"]],
    body: [[payment.productLabel || payment.invoiceNumber || "—", rs(invoiceAmount), rs(paid), rs(balance)]],
    styles: { fontSize: 8.5, cellPadding: 5, lineColor: [148, 163, 184], lineWidth: 0.5, textColor: [17, 24, 39] },
    headStyles: { fillColor: [241, 245, 249], textColor: [17, 24, 39], fontStyle: "bold", halign: "center" },
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" } },
    margin: { left: marginX, right: marginX }
  });

  let cursor = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 16;

  // Amount in words — expected on an Indian receipt.
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Amount in words:", marginX, cursor);
  doc.setFont("helvetica", "bold");
  const words = doc.splitTextToSize(amountInWords(paid), pageWidth - marginX * 2 - 92) as string[];
  words.forEach((line, index) => doc.text(line, marginX + 92, cursor + index * 12));
  cursor += Math.max(1, words.length) * 12 + 6;

  ([
    ["Payment Mode", payment.paymentMode || "—"],
    ["Due Date", payment.dueDate ? formatDate(payment.dueDate) : "—"],
    ["Status", payment.status]
  ] as [string, string][]).forEach(([label, value]) => {
    doc.setFont("helvetica", "normal");
    doc.text(`${label}:`, marginX, cursor);
    doc.setFont("helvetica", "bold");
    doc.text(value, marginX + 92, cursor);
    cursor += 14;
  });

  cursor += 20;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text("This is a computer-generated receipt.", marginX, cursor);

  doc.setTextColor(17, 24, 39);
  doc.setFontSize(9);
  doc.text(`For ${settings.name}`, pageWidth - marginX, cursor, { align: "right" });
  doc.text(`( ${settings.proprietor} )`, pageWidth - marginX, cursor + 36, { align: "right" });

  return emitPdf(doc, `receipt-${fileStem(payment.invoiceNumber)}.pdf`, mode);
}

/**
 * Generic tabular report PDF. Reports vary wildly in width (the Sales grid is 40+
 * columns), so the page is landscape and the column widths are left to autoTable,
 * with the font stepped down as the column count grows. The first row of `rows`
 * is the header, matching the CSV export exactly — the same numbers either way.
 */
export async function downloadReportPdf(
  title: string,
  rows: (string | number)[][],
  settings: CompanySettings,
  meta: { range?: string; brand?: string; headerRows?: number } = {},
  mode: PdfMode = "save"
): Promise<PdfResult> {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const source = rows.length ? rows : [["No data"]];
  // Some reports carry a banner plus a two-tier column header (the Brand x Month
  // sales grid), and those rows are narrower than the data. Size the table by the
  // WIDEST row and pad the rest, or the whole report collapses to one column.
  const headerRows = Math.max(1, Math.min(meta.headerRows ?? 1, source.length));
  const columns = Math.max(...source.map((row) => row.length));
  const pad = (row: (string | number)[]) => [...row, ...Array(Math.max(0, columns - row.length)).fill("")];
  const head = source.slice(0, headerRows).map(pad);
  const body = source.slice(headerRows).map(pad);
  // Keep wide reports legible instead of letting autoTable shrink to nothing.
  const format = columns > 12 ? "a3" : "a4";
  const fontSize = columns > 24 ? 5 : columns > 16 ? 6 : columns > 10 ? 7 : 8;

  const doc = new jsPDF({ unit: "pt", format, orientation: "landscape" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 32;

  const y = await drawLetterhead(doc, settings, {
    title: title.toUpperCase(),
    reference: meta.range ? `Range: ${meta.range}` : undefined,
    date: formatDate(new Date().toISOString()),
    marginX,
    logoWidth: 150,
    compact: true
  });

  if (meta.brand && meta.brand !== "all") {
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`Brand: ${meta.brand}`, marginX, y + 12);
    doc.setTextColor(17, 24, 39);
  }

  autoTable(doc, {
    startY: y + (meta.brand && meta.brand !== "all" ? 22 : 14),
    head: head.map((row) => row.map((cell) => String(cell ?? ""))),
    body: body.map((row) => row.map((cell) => (typeof cell === "number" ? inr(cell) : String(cell ?? "")))),
    styles: { fontSize, cellPadding: 3, lineColor: [203, 213, 225], lineWidth: 0.4, textColor: [17, 24, 39], overflow: "linebreak" },
    headStyles: { fillColor: [241, 245, 249], textColor: [17, 24, 39], fontStyle: "bold" },
    // Right-align any column whose data is numeric, so money lines up.
    columnStyles: Object.fromEntries(
      Array.from({ length: columns }, (_, index) => [
        index,
        { halign: body.some((row) => typeof row[index] === "number") ? "right" : "left" }
      ])
    ),
    margin: { left: marginX, right: marginX },
    didDrawPage: () => {
      const page = doc.getCurrentPageInfo().pageNumber;
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text(`${settings.name} · ${title}`, marginX, doc.internal.pageSize.getHeight() - 16);
      doc.text(`Page ${page}`, pageWidth - marginX, doc.internal.pageSize.getHeight() - 16, { align: "right" });
      doc.setTextColor(17, 24, 39);
    }
  });

  return emitPdf(doc, `${fileStem(title)}.pdf`, mode);
}

/**
 * A4 customer statement — the customer's whole account on one page: every purchase,
 * what was paid against it, and the balance still outstanding.
 *
 * Receipts cover a single payment; this is what you hand (or send) someone when they
 * ask "what do I still owe you?", and what the shop uses when chasing a balance.
 */
export async function downloadCustomerStatementPdf(
  customer: Customer,
  settings: CompanySettings,
  mode: PdfMode = "save"
): Promise<PdfResult> {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 40;

  let y = await drawLetterhead(doc, settings, {
    title: "STATEMENT OF ACCOUNT",
    reference: customer.customerName,
    date: formatDate(new Date().toISOString()),
    marginX,
    logoWidth: 190
  });

  // Who the statement is for.
  y += 18;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Statement for:", marginX, y);
  doc.setFont("helvetica", "bold");
  doc.text(customer.companyName || customer.customerName || "-", marginX + 78, y);
  doc.setFont("helvetica", "normal");
  [customer.address, customer.city, customer.mobile].filter(Boolean).forEach((line) => {
    doc.text(String(line), marginX + 78, (y += 13));
  });

  const purchases = customer.purchases ?? [];
  const totals = purchases.reduce(
    (acc, p) => {
      acc.price += p.price || 0;
      acc.paid += Math.min(p.price || 0, p.advancePaid || 0);
      return acc;
    },
    { price: 0, paid: 0 }
  );
  const outstanding = Math.max(0, totals.price - totals.paid);

  autoTable(doc, {
    startY: y + 18,
    head: [["#", "Product", "Date", "Amount", "Paid", "Balance", "Mode"]],
    body: purchases.length
      ? purchases.map((p, index) => {
          const amount = p.price || 0;
          const paid = Math.min(amount, p.advancePaid || 0);
          return [
            String(index + 1),
            purchaseLabel(p),
            p.advanceDate ? formatDate(p.advanceDate) : p.createdAt ? formatDate(p.createdAt) : "-",
            rs(amount),
            rs(paid),
            rs(Math.max(0, amount - paid)),
            p.paymentMode || "-"
          ];
        })
      : [["", "No purchases recorded", "", "", "", "", ""]],
    foot: purchases.length ? [["", "TOTAL", "", rs(totals.price), rs(totals.paid), rs(outstanding), ""]] : undefined,
    styles: { fontSize: 9, cellPadding: 6, lineColor: [148, 163, 184], lineWidth: 0.5, textColor: [17, 24, 39] },
    headStyles: { fillColor: [241, 245, 249], textColor: [17, 24, 39], fontStyle: "bold" },
    footStyles: { fillColor: [241, 245, 249], textColor: [17, 24, 39], fontStyle: "bold" },
    columnStyles: { 0: { halign: "center", cellWidth: 26 }, 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" } },
    margin: { left: marginX, right: marginX }
  });

  let cursor = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 22;

  // The number the customer actually cares about.
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(outstanding > 0 ? "Balance Outstanding:" : "Account Settled:", marginX, cursor);
  doc.setFontSize(13);
  doc.text(rs(outstanding), pageWidth - marginX, cursor, { align: "right" });

  if (outstanding > 0) {
    cursor += 16;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    const words = doc.splitTextToSize(`In words: ${amountInWords(outstanding)}`, pageWidth - marginX * 2) as string[];
    words.forEach((line) => doc.text(line, marginX, (cursor += 11)));
    doc.setTextColor(17, 24, 39);
  }

  cursor += 30;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text("This is a computer-generated statement.", marginX, cursor);
  doc.setTextColor(17, 24, 39);
  doc.setFontSize(9);
  doc.text(`For ${settings.name}`, pageWidth - marginX, cursor, { align: "right" });
  doc.text(`( ${settings.proprietor} )`, pageWidth - marginX, cursor + 40, { align: "right" });

  return emitPdf(doc, `statement-${fileStem(customer.customerName || customer.customerId)}.pdf`, mode);
}

/** Plain-text account summary for WhatsApp — the same figures as the statement PDF. */
export function statementMessage(customer: Customer, settings: CompanySettings): string {
  const purchases = customer.purchases ?? [];
  const totals = purchases.reduce(
    (acc, p) => {
      acc.price += p.price || 0;
      acc.paid += Math.min(p.price || 0, p.advancePaid || 0);
      return acc;
    },
    { price: 0, paid: 0 }
  );
  const outstanding = Math.max(0, totals.price - totals.paid);
  return [
    `*${settings.name}* — Account Statement`,
    `${customer.companyName || customer.customerName}`,
    "",
    ...purchases.map((p) => {
      const amount = p.price || 0;
      const paid = Math.min(amount, p.advancePaid || 0);
      return `• ${purchaseLabel(p)} — ₹${inr(amount)} paid ₹${inr(paid)}, balance ₹${inr(Math.max(0, amount - paid))}`;
    }),
    purchases.length ? "" : "No purchases recorded.",
    `Total: ₹${inr(totals.price)}`,
    `Paid: ₹${inr(totals.paid)}`,
    outstanding > 0 ? `*Balance due: ₹${inr(outstanding)}*` : "*Account settled — thank you.*",
    "",
    settings.phone ? `For any query: ${settings.phone}` : ""
  ]
    .filter((line) => line !== "")
    .join("\n");
}
