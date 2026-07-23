import type { Brand, CompanySettings, Customer, Invoice, Lead, Order, Payment, Product, Quotation, ServiceRequest, User } from "@/types/crm";
import { MASTER_BRANDS } from "@/lib/options";

/**
 * Starting data for a fresh workspace.
 *
 * All demo/sample records have been removed — every module starts empty so the
 * client enters their own data. Only the admin login is kept so the app remains
 * accessible; staff accounts are created from the Users module.
 */

export const customers: Customer[] = [];
export const products: Product[] = [];
export const leads: Lead[] = [];
export const quotations: Quotation[] = [];
export const orders: Order[] = [];
export const invoices: Invoice[] = [];
export const services: ServiceRequest[] = [];
export const payments: Payment[] = [];

/** Brand master — the admin manages these from the Brands module. */
export const brands: Brand[] = MASTER_BRANDS.map((name, index) => ({
  brandId: `BRD-${String(index + 1).padStart(3, "0")}`,
  name,
  active: true,
  createdAt: "2026-01-01"
}));

/** Organisation profile — editable in Settings; used on quotations and reports. */
export const companySettings: CompanySettings = {
  name: "RAMPS ATELIER PVT. LTD.",
  tagline: "Commercial Refrigeration Sales & Service",
  addressLine1: "",
  addressLine2: "",
  city: "Tirupati",
  pincode: "517501",
  phone: "",
  altPhone: "",
  email: "",
  website: "",
  gstin: "",
  proprietor: "P V Ramana",
  bankName: "KOTAK MAHINDRA BANK",
  accountNo: "5945395402",
  ifsc: "KKBK0007889",
  branch: "",
  logo: "/logo.png",
  signature: "",
  gstSlabs: [0, 5, 12, 18, 28],
  gstRate: 18,
  validityDays: 7,
  warranty: "1 year comprehensive warranty on compressor and unit as per manufacturer terms.",
  transport: "Transport charges extra at actuals unless stated otherwise.",
  deliveryTime: "7-10 working days from confirmed order.",
  paymentTerms: "50% advance with PO, balance after completion of work.",
  brochureUrl: ""
};

/**
 * Bootstrap administrator. This plaintext password exists only so a brand-new
 * workspace can be signed into once — it is replaced with a PBKDF2 hash on first
 * load. CHANGE IT from the Users module before real data is entered.
 */
export const users: User[] = [
  {
    id: "USR-001",
    name: "Praveen Krishna",
    email: "admin@rampscube.com",
    phone: "9830000001",
    role: "Admin",
    department: "Management",
    status: "Active",
    joinedAt: "2025-01-05",
    password: "admin123"
  }
];
