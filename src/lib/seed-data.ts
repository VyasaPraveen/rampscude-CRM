import type {
  AttendanceRecord,
  AttendanceStatus,
  Customer,
  Enquiry,
  EnquiryStatus,
  Order,
  OrderStatus,
  Payment,
  PaymentStatus,
  Product,
  Quotation,
  QuotationStatus,
  ServiceRequest,
  ServiceStatus,
  User
} from "@/types/crm";

const companies = [
  "Sri Balaji Foods",
  "Andhra Fresh Mart",
  "ColdLine Kitchens",
  "Tirumala Dairy",
  "Vijaya Ice Factory",
  "Sree Annapurna Hotels",
  "Kaveri Super Bazaar",
  "Ravi Marine Exports",
  "Nandini Bakers",
  "Blue Star Caterers",
  "Metro Meat House",
  "Crisp Cart Retail",
  "Harsha Pharma Stores",
  "Sunrise Agro Foods",
  "Royal Banquet Hall",
  "Green Basket Mart",
  "Prime Dairy Parlour",
  "Coastal Fish Point",
  "Hotel Vasantham",
  "Elite Cloud Kitchen"
];

const names = [
  "K. Srinivas",
  "M. Lakshmi",
  "P. Raghavendra",
  "S. Kavitha",
  "A. Naveen",
  "D. Prasad",
  "B. Harini",
  "V. Mahesh",
  "R. Deepika",
  "T. Lokesh",
  "G. Sanjana",
  "N. Krishna",
  "L. Madhavi",
  "C. Farooq",
  "J. Suresh",
  "Y. Manasa",
  "E. Joseph",
  "I. Rahman",
  "O. Venkatesh",
  "U. Divya"
];

const cities = ["Tirupati", "Chittoor", "Nellore", "Kadapa", "Anantapur", "Vijayawada", "Kurnool"];

export const customers: Customer[] = companies.map((companyName, index) => ({
  customerId: `CUST-${String(index + 1).padStart(3, "0")}`,
  customerName: names[index],
  companyName,
  mobile: `9${830000000 + index * 37921}`,
  whatsapp: `9${840000000 + index * 41817}`,
  email: `${companyName.toLowerCase().replaceAll(" ", ".")}@example.com`,
  gst: `37AABCR${1200 + index}Z${(index % 9) + 1}`,
  address: `${24 + index}, Main Market Road`,
  city: cities[index % cities.length],
  customerType: index % 3 === 0 ? "Dealer" : index % 3 === 1 ? "Business" : "Retail",
  remarks: index % 2 === 0 ? "Prefers WhatsApp updates and quick delivery." : "Requires GST quotation before approval.",
  createdAt: `2026-0${(index % 6) + 1}-${String((index % 24) + 1).padStart(2, "0")}`
}));

const productNames = [
  "Vertical Freezer",
  "Visi Cooler",
  "Deep Freezer",
  "Back Bar Chiller",
  "Under Counter Chiller",
  "Cold Room Panel",
  "Blast Freezer",
  "Display Counter",
  "Water Cooler",
  "Milk Chiller"
];

export const products: Product[] = Array.from({ length: 30 }, (_, index) => {
  const name = productNames[index % productNames.length];
  return {
    productId: `PROD-${String(index + 1).padStart(3, "0")}`,
    productName: `${name} ${index % 2 === 0 ? "Premium" : "Economy"}`,
    category: ["Commercial Freezer", "Retail Cooling", "Kitchen Refrigeration", "Cold Storage"][index % 4],
    modelNumber: `RC-${name.split(" ").map((part) => part[0]).join("")}-${300 + index * 15}`,
    price: 42000 + index * 8500,
    warranty: index % 3 === 0 ? "24 months" : "12 months",
    description: `Energy efficient ${name.toLowerCase()} for commercial refrigeration use.`,
    image: "/icons/icon.svg",
    createdAt: `2026-0${(index % 6) + 1}-${String((index % 25) + 1).padStart(2, "0")}`
  };
});

const enquiryStatuses: EnquiryStatus[] = ["New", "Follow-up", "Quotation Sent", "Order Confirmed", "Closed"];
export const enquiries: Enquiry[] = Array.from({ length: 25 }, (_, index) => ({
  enquiryId: `ENQ-${String(index + 1).padStart(3, "0")}`,
  enquiryNumber: `RC-ENQ-2026-${String(index + 1).padStart(3, "0")}`,
  customerId: customers[index % customers.length].customerId,
  product: products[index % products.length].productName,
  source: ["Phone", "Walk-in", "WhatsApp", "Website", "Referral"][index % 5] as Enquiry["source"],
  assignedTo: ["Admin", "Priya", "Rahul", "Kiran"][index % 4],
  followupDate: `2026-07-${String((index % 20) + 2).padStart(2, "0")}`,
  remarks: index % 2 === 0 ? "Asked for dealer pricing." : "Needs installation support.",
  status: enquiryStatuses[index % enquiryStatuses.length],
  createdAt: `2026-06-${String((index % 25) + 1).padStart(2, "0")}`
}));

const quotationStatuses: QuotationStatus[] = ["Draft", "Sent", "Accepted", "Rejected"];
export const quotations: Quotation[] = Array.from({ length: 15 }, (_, index) => {
  const product = products[index];
  const quantity = (index % 4) + 1;
  const subtotal = product.price * quantity;
  const discount = index % 3 === 0 ? 5000 : 2500;
  const gst = Math.round((subtotal - discount) * 0.18);
  return {
    quotationId: `QUO-${String(index + 1).padStart(3, "0")}`,
    quotationNumber: `RC/QTN/2026/${String(index + 1).padStart(3, "0")}`,
    customerId: customers[index % customers.length].customerId,
    products: [{ productId: product.productId, quantity, price: product.price }],
    subtotal,
    discount,
    gst,
    total: subtotal - discount + gst,
    status: quotationStatuses[index % quotationStatuses.length],
    createdAt: `2026-06-${String((index % 25) + 1).padStart(2, "0")}`
  };
});

const orderStatuses: OrderStatus[] = ["Processing", "Ready", "Delivered", "Cancelled"];
const paymentStatuses: PaymentStatus[] = ["Pending", "Partial", "Paid"];
export const orders: Order[] = Array.from({ length: 10 }, (_, index) => ({
  orderId: `ORD-${String(index + 1).padStart(3, "0")}`,
  orderNumber: `RC-ORD-2026-${String(index + 1).padStart(3, "0")}`,
  quotationId: quotations[index % quotations.length].quotationId,
  customerId: customers[index % customers.length].customerId,
  deliveryDate: `2026-07-${String((index % 18) + 8).padStart(2, "0")}`,
  paymentStatus: paymentStatuses[index % paymentStatuses.length],
  status: orderStatuses[index % orderStatuses.length],
  createdAt: `2026-06-${String((index % 20) + 6).padStart(2, "0")}`
}));

const serviceStatuses: ServiceStatus[] = ["Pending", "In Progress", "Completed"];
export const services: ServiceRequest[] = Array.from({ length: 12 }, (_, index) => ({
  serviceId: `SRV-${String(index + 1).padStart(3, "0")}`,
  serviceNumber: `RC-SRV-2026-${String(index + 1).padStart(3, "0")}`,
  customerId: customers[index % customers.length].customerId,
  product: products[(index + 4) % products.length].productName,
  complaint: ["Temperature fluctuation", "Compressor noise", "Door gasket leakage", "Regular maintenance"][index % 4],
  assignedTo: ["Suresh", "Kiran", "Mahesh"][index % 3],
  serviceDate: `2026-07-${String((index % 22) + 3).padStart(2, "0")}`,
  remarks: index % 2 === 0 ? "Technician visit scheduled." : "Spare availability to be checked.",
  status: serviceStatuses[index % serviceStatuses.length],
  createdAt: `2026-06-${String((index % 21) + 4).padStart(2, "0")}`
}));

export const payments: Payment[] = Array.from({ length: 8 }, (_, index) => {
  const invoiceAmount = quotations[index].total;
  const paidAmount = index % 3 === 2 ? invoiceAmount : index % 3 === 1 ? Math.round(invoiceAmount * 0.45) : 0;
  return {
    paymentId: `PAY-${String(index + 1).padStart(3, "0")}`,
    customerId: customers[index % customers.length].customerId,
    invoiceNumber: `RC/INV/2026/${String(index + 1).padStart(3, "0")}`,
    invoiceAmount,
    paidAmount,
    balanceAmount: invoiceAmount - paidAmount,
    dueDate: `2026-07-${String((index % 18) + 6).padStart(2, "0")}`,
    status: paymentStatuses[index % paymentStatuses.length],
    createdAt: `2026-06-${String((index % 18) + 7).padStart(2, "0")}`
  };
});

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
  },
  {
    id: "USR-002",
    name: "Priya Sharma",
    email: "priya@rampscube.com",
    phone: "9830000002",
    role: "Staff",
    department: "Sales",
    status: "Active",
    joinedAt: "2025-03-12",
    password: "staff123"
  },
  {
    id: "USR-003",
    name: "Rahul Verma",
    email: "rahul@rampscube.com",
    phone: "9830000003",
    role: "Staff",
    department: "Service",
    status: "Active",
    joinedAt: "2025-04-01",
    password: "staff123"
  },
  {
    id: "USR-004",
    name: "Kiran Rao",
    email: "kiran@rampscube.com",
    phone: "9830000004",
    role: "Staff",
    department: "Service",
    status: "Active",
    joinedAt: "2025-06-20",
    password: "staff123"
  },
  {
    id: "USR-005",
    name: "Suresh Nair",
    email: "suresh@rampscube.com",
    phone: "9830000005",
    role: "Staff",
    department: "Logistics",
    status: "Inactive",
    joinedAt: "2024-11-10",
    password: "staff123"
  }
];

/**
 * Deterministically generate the current month's attendance up to `now` for the
 * given staff. Pure (no Math.random / no build-time Date) so it is safe to run
 * on the client after mount without hydration drift.
 */
export function generateAttendance(staff: User[], now: Date): AttendanceRecord[] {
  const year = now.getFullYear();
  const month = now.getMonth();
  const today = now.getDate();
  const records: AttendanceRecord[] = [];

  staff.forEach((user, staffIndex) => {
    for (let day = 1; day <= today; day += 1) {
      const dow = new Date(year, month, day).getDay();
      const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const seed = (day * 7 + staffIndex * 3) % 10;

      let status: AttendanceStatus;
      if (dow === 0) {
        status = "Week Off";
      } else if (seed === 0) {
        status = "Absent";
      } else if (seed === 1) {
        status = "Leave";
      } else if (seed === 2) {
        status = "Half Day";
      } else {
        status = "Present";
      }

      const working = status === "Present" || status === "Half Day";
      records.push({
        id: `${user.id}_${iso}`,
        userId: user.id,
        date: iso,
        status,
        checkIn: working ? `09:${String(10 + (seed % 40)).padStart(2, "0")}` : undefined,
        checkOut: status === "Present" ? "18:30" : status === "Half Day" ? "13:30" : undefined
      });
    }
  });

  return records;
}
