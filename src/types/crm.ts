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
  products: { productId: string; quantity: number; price: number; gstRate?: number }[];
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
  createdAt: string;
}

/** Invoice — created in Tally, synced into the CRM and marked Created / Shared. */
export interface Invoice {
  invoiceId: string;
  invoiceNumber: string;
  customerName: string;
  town: string;
  date: string;
  amount: number;
  /** Where the record originated. */
  source: "Tally" | "Manual";
  /** Marked once the invoice has been raised. */
  created: boolean;
  /** Marked once the invoice has been shared with the customer. */
  shared: boolean;
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
  active: boolean;
  createdAt: string;
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
}

/** Display label for an inventory item. */
export function productLabel(product: Pick<Product, "brand" | "model">): string {
  return `${product.brand} ${product.model}`.trim();
}
