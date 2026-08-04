import type { CompanySettings, Customer, Lead, Product, Quotation } from "@/types/crm";
import { productLabel } from "@/types/crm";
import { gstLabel, totalsForQuotation } from "@/lib/gst";

/** Rupee formatting for PDF output — jsPDF's core fonts lack the ₹ glyph, so use plain digits. */
function inr(value: number): string {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value);
}

/** Amount with the currency marker — jsPDF's core fonts have no rupee glyph. */
function rs(value: number): string {
  return `Rs. ${inr(value)}`;
}

function productName(products: Product[], productId: string): string {
  const product = products.find((item) => item.productId === productId);
  return product ? productLabel(product) : productId;
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
    (item) => `• ${productName(products, item.productId)} x${item.quantity} — ₹${inr(item.price * item.quantity)}`
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

  const first = quotation.products[0] ? productName(products, quotation.products[0].productId) : "your requirement";
  const subject = quotation.products.length > 1 ? `${first} and others` : first;
  doc.setFont("helvetica", "bold");
  doc.text(`Sub:- Quotation for ${subject}.`, marginX, (y += 22));

  // ---- Line items -------------------------------------------------------
  autoTable(doc, {
    startY: y + 14,
    head: [["SL.NO.", "Description", "QTY", "RATE", "GST %", "TOTAL"]],
    body: quotation.products.map((item, index) => [
      String(index + 1).padStart(2, "0"),
      productName(products, item.productId),
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
