export type Role = "Admin" | "Staff";
export type CustomerType = "Dealer" | "Business" | "Retail";
/** How the customer reached us — replaces the old GST field on the entry form. */
export type CustomerSourceType = "Walk-in" | "Social Media" | "Just Dial" | "India Mart" | "Amazon" | "Reference";
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
export type LeadSource = "Walk-in" | "Online" | "Social Media" | "Phone" | "Referral";
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
  /** Net Landing Cost. */
  nlc?: number;
  /** Sale date — presence marks the unit as sold out. */
  saleDate?: string;
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
  /** Interested in what. */
  interestedIn: string;
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
  customerId: string;
  products: { productId: string; quantity: number; price: number }[];
  subtotal: number;
  discount: number;
  gst: number;
  total: number;
  status: QuotationStatus;
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
  /** Demo-only credential. Not a real auth secret. */
  password: string;
}

export type AttendanceStatus = "Present" | "Absent" | "Half Day" | "Leave" | "Week Off";

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

/** Display label for an inventory item. */
export function productLabel(product: Pick<Product, "brand" | "model">): string {
  return `${product.brand} ${product.model}`.trim();
}
