export type Role = "Admin" | "Staff";
export type CustomerType = "Dealer" | "Business" | "Retail";
/** How the customer reached us — replaces the old GST field on the entry form. */
export type CustomerSourceType =
  | "Walk-in"
  | "Just Dial"
  | "India Mart"
  | "Amazon"
  | "Reference"
  | "FB"
  | "Insta"
  | "Whatsapp"
  | "Google"
  | "BBB"
  | "Technician"
  | "Sub Dealer"
  | "Existing Customer";
/** Product category — sourced from inventory product types. */
export type ProductType =
  | "Deep Freezer"
  | "Visi Cooler"
  | "Storage Water Cooler"
  | "Water Dispenser"
  | "Glass Top"
  | "FOW / Glycol Freezer"
  | "Super Cooldrink Box"
  | "SS Customized"
  | "Loose Milk Cooler"
  | "Cold Room";
export type LeadStatus = "New" | "Follow-up" | "Quotation Sent" | "Order Confirmed" | "Closed";
/** Nature of enquiry recorded against a lead. */
export type LeadSource = "Product Enquiry" | "Price Enquiry" | "Resale Enquiry" | "Service Enquiry" | "Dummy Quotation";
export type QuotationStatus = "Draft" | "Sent" | "Accepted" | "Rejected";
export type OrderStatus = "Processing" | "Ready" | "Delivered" | "Cancelled";
export type ServiceStatus = "Pending" | "In Progress" | "Completed";
export type PaymentStatus = "Pending" | "Partial" | "Paid";
export type PaymentMode = "Cash" | "UPI" | "Bank Transfer" | "Card" | "Cheque" | "Finance";

/** A single product purchase by a customer, with its payment tracking. One purchase
 *  maps to one Order, so a customer can buy repeatedly without duplicate records. */
export interface Purchase {
  purchaseId: string;
  productBrand?: string;
  productModel?: string;
  productType?: ProductType;
  /** Sale price (GST-inclusive). */
  price: number;
  /** Advance already received. Balance = price - advancePaid. */
  advancePaid: number;
  advanceDate?: string;
  dueDate?: string;
  paymentMode?: PaymentMode;
  createdAt: string;
}

export interface Customer {
  customerId: string;
  /** Name — required. */
  customerName: string;
  /** Phone number — required. */
  mobile: string;
  /** Town name. */
  city: string;
  address: string;
  productModel: string;
  productBrand: string;
  /** Product category (replaces Company Name on the entry form). */
  productType?: ProductType;
  /** Type of customer / lead source (replaces GST on the entry form). */
  sourceType?: CustomerSourceType;
  email: string;
  /** Legacy fields — kept for older records and display fallback; no longer captured on the form. */
  companyName?: string;
  gst?: string;
  /** Retained for backward-compatible badges/filtering; not part of the entry form. */
  customerType?: CustomerType;
  /** Optional; WhatsApp share falls back to `mobile` when empty. */
  whatsapp?: string;
  remarks?: string;
  /** Purchases with payment tracking — repeat buys live here, no duplicate customer. */
  purchases?: Purchase[];
  /** Values for admin-defined custom fields, keyed by field id. */
  custom?: Record<string, string>;
  createdAt: string;
}

/** Inventory item — a purchased stock unit, tracked from purchase through sale. */
export interface Product {
  productId: string;
  brand: string;
  model: string;
  serialNo: string;
  /** Sale price of the unit. */
  price: number;
  purchaseFrom: string;
  invoiceName: string;
  /** Purchase invoice date — used as the purchase date in the stock report. */
  invoiceDate: string;
  productType?: ProductType;
  /** GST slab (%) for this item. Overrides the brand and company defaults. */
  gstRate?: number;
  /** Units held / handled in this stock line. Defaults to 1 when unset. */
  quantity?: number;
  /** Purchase price (cost we bought the unit at). */
  purchasePrice?: number;
  /** Cut-off price — the minimum acceptable selling price. */
  cutoffPrice?: number;
  /** Net Landing Cost. */
  nlc?: number;
  /** Sale date — presence marks the unit as sold out. */
  saleDate?: string;
  /** Sale invoice number raised for this unit. */
  saleInvoiceNo?: string;
  /** "By Ref" — who referred the sale (Technician, Sub Dealer, …). */
  referredBy?: string;
  /** Buyer name recorded at sale. */
  soldToName?: string;
  /** Buyer town recorded at sale. */
  soldToTown?: string;
  /** Commission paid to the mediator / referrer for this sale. */
  commission?: number;
  createdAt: string;
}

/** Lead / enquiry captured from walk-ins, online, or social media.
 *  Carries the same customer fields so a lead can be converted into a customer. */
export interface Lead {
  leadId: string;
  leadNumber: string;
  name: string;
  town: string;
  phone: string;
  /** Nature of enquiry. */
  source: LeadSource;
  /** Price quoted to the lead (GST-inclusive). */
  quotedPrice?: number;
  /** Optional brochure link to share with this lead. */
  brochureUrl?: string;
  /** Legacy free-text interest — no longer captured on the form. */
  interestedIn?: string;
  description: string;
  status: LeadStatus;
  // Customer-parity fields (all optional on a lead until captured).
  address?: string;
  email?: string;
  productBrand?: string;
  productModel?: string;
  productType?: ProductType;
  /** Type of customer / acquisition channel. */
  sourceType?: CustomerSourceType;
  /** Set once the lead has been converted into a customer. */
  convertedCustomerId?: string;
  /** Values for admin-defined custom fields, keyed by field id. */
  custom?: Record<string, string>;
  createdAt: string;
}

export interface Quotation {
  quotationId: string;
  quotationNumber: string;
  /** Optional external / manual quotation reference number. */
  reference?: string;
  /** Set when the quotation was auto-generated from a lead (before a customer exists). */
  leadId?: string;
  /** Display name to use when there is no linked customer yet (lead-generated quotations). */
  customerLabel?: string;
  customerId: string;
  products: { productId: string; quantity: number; price: number; gstRate?: number; label?: string }[];
  /** Net (ex-GST) taxable value. Line prices are GST-inclusive. */
  subtotal: number;
  discount: number;
  gst: number;
  /** Final payable (GST-inclusive) = subtotal + gst. */
  total: number;
  status: QuotationStatus;
  /** Optional brochure link shared with this quotation (overrides the lead's). */
  brochureUrl?: string;
  createdAt: string;
}

export interface Order {
  orderId: string;
  orderNumber: string;
  quotationId: string;
  customerId: string;
  deliveryDate: string;
  paymentStatus: PaymentStatus;
  status: OrderStatus;
  /** Set when this order was generated from a customer purchase (keeps them in sync). */
  purchaseId?: string;
  /** Purchase snapshot mirrored from the customer, so Orders shows the money detail. */
  productLabel?: string;
  amount?: number;
  advancePaid?: number;
  paymentMode?: PaymentMode;
  createdAt: string;
}

/** Invoice — created from a customer's saved details, imported from Tally, or added
 *  manually; marked Created / Shared. `amount` is GST-inclusive. */
export interface Invoice {
  invoiceId: string;
  invoiceNumber: string;
  customerName: string;
  town: string;
  date: string;
  /** GST-inclusive total. */
  amount: number;
  /** Where the record originated. */
  source: "Tally" | "Manual" | "CRM";
  /** Marked once the invoice has been raised. */
  created: boolean;
  /** Marked once the invoice has been shared with the customer. */
  shared: boolean;
  /** Set when created from a saved customer. */
  customerId?: string;
  /** GST slab (%) applied — drives the Net / CGST / SGST split on the PDF. */
  gstRate?: number;
  /** Products billed (for the PDF / description). */
  productLabel?: string;
  paymentMode?: PaymentMode;
  createdAt: string;
}

export interface ServiceRequest {
  serviceId: string;
  serviceNumber: string;
  customerId: string;
  product: string;
  complaint: string;
  assignedTo: string;
  serviceDate: string;
  remarks: string;
  status: ServiceStatus;
  createdAt: string;
}

export interface Payment {
  paymentId: string;
  customerId: string;
  invoiceNumber: string;
  invoiceAmount: number;
  paidAmount: number;
  balanceAmount: number;
  dueDate: string;
  status: PaymentStatus;
  createdAt: string;
}

export type UserStatus = "Active" | "Inactive";

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: Role;
  department: string;
  status: UserStatus;
  joinedAt: string;
  /** PBKDF2-SHA256 hash of the password, with its per-user salt. */
  passwordHash?: string;
  passwordSalt?: string;
  /** Legacy plaintext credential — upgraded to a hash on first load, then removed. */
  password?: string;
}

export type AttendanceStatus = "Present" | "Absent" | "Half Day" | "Leave" | "Casual Leave" | "Holiday";

export interface AttendanceRecord {
  /** Stable composite id: `${userId}_${date}`. */
  id: string;
  userId: string;
  /** ISO calendar day, YYYY-MM-DD. */
  date: string;
  status: AttendanceStatus;
  checkIn?: string;
  checkOut?: string;
  note?: string;
}

/** A product brand the business deals in — managed by the admin in the Brands module. */
export interface Brand {
  brandId: string;
  name: string;
  /** Default GST slab (%) for this brand. Falls back to the company default when unset. */
  gstRate?: number;
  /** Optional notes, e.g. distributor or contact. */
  remarks?: string;
  /** Brand service-support contacts, shared with customers from the Services module. */
  serviceCareNumber?: string;
  serviceWhatsapp?: string;
  serviceEmail?: string;
  active: boolean;
  createdAt: string;
}

/** An admin-defined extra field on a Lead or Customer. */
export type CustomFieldType = "text" | "number" | "date" | "select";
export interface CustomFieldDef {
  id: string;
  label: string;
  type: CustomFieldType;
  /** Choices for a "select" field. */
  options?: string[];
}

/** Organisation profile used across quotations, invoices and reports. */
export interface CompanySettings {
  name: string;
  tagline: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  pincode: string;
  phone: string;
  altPhone: string;
  email: string;
  website: string;
  gstin: string;
  /** Proprietor / signatory printed above the signature. */
  proprietor: string;
  bankName: string;
  accountNo: string;
  ifsc: string;
  branch: string;
  /** Data-URI images uploaded in Settings. */
  logo?: string;
  signature?: string;
  // Quotation defaults
  /** Selectable GST slabs (%) the admin maintains, e.g. 0, 5, 12, 18, 28. */
  gstSlabs: number[];
  /** Company default GST slab (%), used when a product and its brand have none. */
  gstRate: number;
  validityDays: number;
  warranty: string;
  transport: string;
  deliveryTime: string;
  paymentTerms: string;
  /** Brochure link shared with leads / on quotations. */
  brochureUrl: string;
  /** Admin-defined custom fields shown on the Lead and Customer forms. */
  leadFields?: CustomFieldDef[];
  customerFields?: CustomFieldDef[];
}

/** Display label for an inventory item. */
export function productLabel(product: Pick<Product, "brand" | "model">): string {
  return `${product.brand} ${product.model}`.trim();
}
