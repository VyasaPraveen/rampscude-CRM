import type { Brand, CompanySettings, Product, Quotation } from "@/types/crm";

/**
 * GST resolution and quotation maths — one implementation shared by the quotation
 * form, the auto-generated lead quotation, the PDF and the WhatsApp summary, so a
 * rate change can never show one figure and charge another.
 *
 * Rate precedence: line item → product → brand → company default.
 */

export function normaliseRate(rate: number | undefined): number | undefined {
  if (typeof rate !== "number" || !Number.isFinite(rate)) return undefined;
  return Math.min(100, Math.max(0, rate));
}

/** The GST slab that applies to a product, following the precedence chain. */
export function rateForProduct(product: Product | undefined, brands: Brand[], settings: CompanySettings): number {
  const own = normaliseRate(product?.gstRate);
  if (own !== undefined) return own;
  const brand = product ? brands.find((item) => item.name === product.brand) : undefined;
  const fromBrand = normaliseRate(brand?.gstRate);
  if (fromBrand !== undefined) return fromBrand;
  return normaliseRate(settings.gstRate) ?? 0;
}

export interface QuotationLine {
  productId: string;
  quantity: number;
  price: number;
  gstRate?: number;
}

export interface RateBucket {
  rate: number;
  /** Net (ex-GST) taxable value in this slab. */
  taxable: number;
  /** GST embedded in this slab. */
  tax: number;
  /** Central GST — half of `tax` (intra-state supply). */
  cgst: number;
  /** State GST — the other half of `tax`. */
  sgst: number;
}

/**
 * Totals for a set of quotation lines. Line prices are treated as GST-INCLUSIVE:
 * the price the customer pays already contains the tax. Each line is back-calculated
 * into its net (taxable) value and the embedded GST, which is split evenly into
 * CGST + SGST for an intra-state supply. The discount is a rupee amount off the
 * final (inclusive) price, spread across lines in proportion to their value.
 */
export interface QuotationTotals {
  /** Sum of GST-inclusive line totals, before discount. */
  gross: number;
  effectiveDiscount: number;
  /** Net (ex-GST) taxable value after discount. */
  taxable: number;
  /** Total GST embedded in the inclusive price. */
  gst: number;
  /** Central GST — half of `gst`. */
  cgst: number;
  /** State GST — the other half of `gst`. */
  sgst: number;
  /** Final payable = taxable + gst = gross - discount. */
  total: number;
  /** GST split by slab, so documents can show each rate's net / CGST / SGST. */
  byRate: RateBucket[];
}

export function computeTotals(lines: QuotationLine[], discount: number, rateOf: (line: QuotationLine) => number): QuotationTotals {
  const gross = lines.reduce((sum, line) => sum + line.price * line.quantity, 0);
  const effectiveDiscount = Math.min(Math.max(0, discount), gross); // never exceeds the gross

  // Group the discounted, GST-inclusive amounts by slab.
  const buckets = new Map<number, { rate: number; inclusive: number }>();
  lines.forEach((line) => {
    const lineGross = line.price * line.quantity;
    if (lineGross <= 0) return;
    const share = gross > 0 ? (lineGross / gross) * effectiveDiscount : 0;
    const inclusive = lineGross - share;
    const rate = normaliseRate(rateOf(line)) ?? 0;
    const bucket = buckets.get(rate) ?? { rate, inclusive: 0 };
    bucket.inclusive += inclusive;
    buckets.set(rate, bucket);
  });

  let taxable = 0;
  let gst = 0;
  const byRate = [...buckets.values()]
    .map(({ rate, inclusive }) => {
      // Back out the tax from the inclusive amount: net = incl / (1 + r/100).
      const tax = Math.round(inclusive - inclusive / (1 + rate / 100));
      const net = Math.round(inclusive) - tax; // keep net + tax === rounded inclusive
      const cgst = Math.round(tax / 2);
      const sgst = tax - cgst;
      taxable += net;
      gst += tax;
      return { rate, taxable: net, tax, cgst, sgst };
    })
    .sort((a, b) => a.rate - b.rate);

  const cgst = Math.round(gst / 2);
  const sgst = gst - cgst;
  return { gross, effectiveDiscount, taxable, gst, cgst, sgst, total: taxable + gst, byRate };
}

/** Recompute a saved quotation's GST split from the (inclusive) prices on its lines. */
export function totalsForQuotation(quotation: Quotation, settings: CompanySettings): QuotationTotals {
  return computeTotals(quotation.products, quotation.discount, (line) => normaliseRate(line.gstRate) ?? normaliseRate(settings.gstRate) ?? 0);
}

/** Split a single GST-inclusive amount into net + CGST + SGST at one rate. */
export function inclusiveBreakdown(amount: number, rate: number): { net: number; gst: number; cgst: number; sgst: number } {
  const r = normaliseRate(rate) ?? 0;
  const net = Math.round(amount / (1 + r / 100));
  const gst = Math.round(amount) - net;
  const cgst = Math.round(gst / 2);
  const sgst = gst - cgst;
  return { net, gst, cgst, sgst };
}

/** Label for a GST split, e.g. "GST (18%)" or "GST (5% + 18%)" for a mixed quotation. */
export function gstLabel(byRate: { rate: number }[], fallback: number): string {
  const rates = byRate.filter((bucket) => bucket.rate > 0).map((bucket) => bucket.rate);
  if (rates.length === 0) return `GST (${fallback}%)`;
  return `GST (${rates.join("% + ")}%)`;
}
