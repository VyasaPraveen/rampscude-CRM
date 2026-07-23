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

export interface QuotationTotals {
  subtotal: number;
  effectiveDiscount: number;
  gst: number;
  total: number;
  /** GST split by slab, so documents can show "GST 18%: x / GST 5%: y". */
  byRate: { rate: number; taxable: number; tax: number }[];
}

/**
 * Totals for a set of quotation lines. The discount is spread across lines in
 * proportion to their value, then each line is taxed at its own slab.
 */
export function computeTotals(lines: QuotationLine[], discount: number, rateOf: (line: QuotationLine) => number): QuotationTotals {
  const subtotal = lines.reduce((sum, line) => sum + line.price * line.quantity, 0);
  const effectiveDiscount = Math.min(Math.max(0, discount), subtotal); // never exceeds the subtotal

  const buckets = new Map<number, { rate: number; taxable: number; tax: number }>();
  lines.forEach((line) => {
    const lineTotal = line.price * line.quantity;
    if (lineTotal <= 0) return;
    const share = subtotal > 0 ? (lineTotal / subtotal) * effectiveDiscount : 0;
    const taxable = lineTotal - share;
    const rate = normaliseRate(rateOf(line)) ?? 0;
    const bucket = buckets.get(rate) ?? { rate, taxable: 0, tax: 0 };
    bucket.taxable += taxable;
    buckets.set(rate, bucket);
  });

  let gst = 0;
  const byRate = [...buckets.values()]
    .map((bucket) => {
      const tax = Math.round((bucket.taxable * bucket.rate) / 100);
      gst += tax;
      return { ...bucket, taxable: Math.round(bucket.taxable), tax };
    })
    .sort((a, b) => a.rate - b.rate);

  return { subtotal, effectiveDiscount, gst, total: subtotal - effectiveDiscount + gst, byRate };
}

/** Recompute a saved quotation's GST split from the rates stored on its lines. */
export function totalsForQuotation(quotation: Quotation, settings: CompanySettings): QuotationTotals {
  return computeTotals(quotation.products, quotation.discount, (line) => normaliseRate(line.gstRate) ?? normaliseRate(settings.gstRate) ?? 0);
}

/** Label for a GST split, e.g. "GST (18%)" or "GST (5% + 18%)" for a mixed quotation. */
export function gstLabel(byRate: { rate: number }[], fallback: number): string {
  const rates = byRate.filter((bucket) => bucket.rate > 0).map((bucket) => bucket.rate);
  if (rates.length === 0) return `GST (${fallback}%)`;
  return `GST (${rates.join("% + ")}%)`;
}
