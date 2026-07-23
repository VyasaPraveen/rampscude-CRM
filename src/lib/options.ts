import type { CustomerSourceType, LeadSource, ProductType } from "@/types/crm";

/** Type-of-customer options (replaces the old GST field). */
export const CUSTOMER_SOURCE_TYPES: CustomerSourceType[] = [
  "Walk-in",
  "Just Dial",
  "India Mart",
  "Amazon",
  "Reference",
  "FB",
  "Insta",
  "Whatsapp",
  "Google",
  "BBB",
  "Technician",
  "Sub Dealer",
  "Existing Customer"
];

/** Nature-of-enquiry options for leads. */
export const ENQUIRY_NATURES: LeadSource[] = [
  "Product Enquiry",
  "Price Enquiry",
  "Resale Enquiry",
  "Service Enquiry",
  "Dummy Quotation"
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

/** Brands the Brands module starts with. Admin can add / edit / delete from there. */
export const MASTER_BRANDS = ["Icemake", "Blue Star", "Voltas", "Daikin", "Western", "Rockwell", "Elanpro", "Rinac"];

/** Unique, sorted, non-empty values — used to build brand / model dropdowns from inventory. */
export function uniqueSorted(values: (string | undefined | null)[]): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value && value.trim())))].sort((a, b) => a.localeCompare(b));
}
