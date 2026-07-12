export type Role = "Admin" | "Staff";
export type CustomerType = "Dealer" | "Business" | "Retail";
export type EnquiryStatus = "New" | "Follow-up" | "Quotation Sent" | "Order Confirmed" | "Closed";
export type QuotationStatus = "Draft" | "Sent" | "Accepted" | "Rejected";
export type OrderStatus = "Processing" | "Ready" | "Delivered" | "Cancelled";
export type ServiceStatus = "Pending" | "In Progress" | "Completed";
export type PaymentStatus = "Pending" | "Partial" | "Paid";

export interface Customer {
  customerId: string;
  customerName: string;
  companyName: string;
  mobile: string;
  whatsapp: string;
  email: string;
  gst: string;
  address: string;
  city: string;
  customerType: CustomerType;
  remarks: string;
  createdAt: string;
}

export interface Product {
  productId: string;
  productName: string;
  category: string;
  modelNumber: string;
  price: number;
  warranty: string;
  description: string;
  image: string;
  createdAt: string;
}

export interface Enquiry {
  enquiryId: string;
  enquiryNumber: string;
  customerId: string;
  product: string;
  source: "Phone" | "Walk-in" | "WhatsApp" | "Website" | "Referral";
  assignedTo: string;
  followupDate: string;
  remarks: string;
  status: EnquiryStatus;
  createdAt: string;
}

export interface Quotation {
  quotationId: string;
  quotationNumber: string;
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
