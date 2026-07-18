import type { CustomerSourceType, ProductType } from "@/types/crm";

/** Type-of-customer options (replaces the old GST field). */
export const CUSTOMER_SOURCE_TYPES: CustomerSourceType[] = [
  "Walk-in",
  "Social Media",
  "Just Dial",
  "India Mart",
  "Amazon",
  "Reference"
];

/** Product-type options (replaces the old Company Name field). */
export const PRODUCT_TYPES: ProductType[] = [
  "Deep Freezer",
  "Visi Cooler",
  "Storage Water Cooler",
  "Water Dispenser",
  "Glass Top",
  "FOW / Glycol Freezer",
  "Super Cooldrink Box",
  "SS Customized",
  "Loose Milk Cooler",
  "Cold Room"
];

/** Unique, sorted, non-empty values — used to build brand / model dropdowns from inventory. */
export function uniqueSorted(values: (string | undefined | null)[]): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value && value.trim())))].sort((a, b) => a.localeCompare(b));
}
