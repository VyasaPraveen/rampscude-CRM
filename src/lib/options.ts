import type { CompanySettings, CustomerSourceType, LeadSource, ProductType } from "@/types/crm";

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

/** Departments available for staff accounts. */
export const DEPARTMENTS = ["Management", "Sales", "Service", "Logistics", "Accounts"];

/** Payment modes offered across Customers, Payments, Orders and Invoices. */
export const PAYMENT_MODES = ["Cash", "UPI", "Bank Transfer", "Card", "Cheque", "Finance"];

/** Admin-editable option lists, surfaced in Settings › Master Data. Each id maps a
 *  dropdown used across the app to its built-in defaults; a saved override wins. */
export const OPTION_LISTS: { id: string; label: string; defaults: string[] }[] = [
  { id: "productTypes", label: "Product Types", defaults: PRODUCT_TYPES },
  { id: "enquiryNatures", label: "Nature of Enquiry", defaults: ENQUIRY_NATURES },
  { id: "customerTypes", label: "Type of Customer", defaults: CUSTOMER_SOURCE_TYPES },
  { id: "paymentModes", label: "Payment Modes", defaults: PAYMENT_MODES },
  { id: "departments", label: "Departments", defaults: DEPARTMENTS }
];

const OPTION_DEFAULTS: Record<string, string[]> = Object.fromEntries(OPTION_LISTS.map((list) => [list.id, list.defaults]));

/** Resolve an option list: the admin's saved override if present and non-empty, else the built-in default. */
export function optionList(settings: Pick<CompanySettings, "options"> | undefined, id: string): string[] {
  const override = settings?.options?.[id];
  return override && override.length ? override : OPTION_DEFAULTS[id] ?? [];
}

/** Brands the Brands module starts with. Admin can add / edit / delete from there. */
export const MASTER_BRANDS = ["Icemake", "Blue Star", "Voltas", "Daikin", "Western", "Rockwell", "Elanpro", "Rinac"];

/** Unique, sorted, non-empty values — used to build brand / model dropdowns from inventory. */
export function uniqueSorted(values: (string | undefined | null)[]): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value && value.trim())))].sort((a, b) => a.localeCompare(b));
}
