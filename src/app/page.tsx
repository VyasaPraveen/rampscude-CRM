"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  Bell,
  Boxes,
  BriefcaseBusiness,
  CalendarCheck,
  CalendarClock,
  ChevronRight,
  ClipboardList,
  CreditCard,
  Download,
  FileBarChart,
  FileText,
  Home,
  LogOut,
  Menu,
  MessageCircle,
  Pencil,
  Phone,
  Plus,
  ReceiptText,
  Search,
  Settings,
  ShieldCheck,
  Snowflake,
  UserCog,
  UserPlus,
  Users,
  Wrench,
  X
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useServiceWorker } from "@/hooks/use-service-worker";
import {
  customers as customerSeed,
  generateAttendance,
  invoices as invoiceSeed,
  leads as leadSeed,
  orders as orderSeed,
  payments as paymentSeed,
  products as productSeed,
  quotations as quotationSeed,
  services as serviceSeed,
  users as userSeed
} from "@/lib/seed-data";
import type { AttendanceRecord, Customer, Invoice, Lead, Order, Payment, Product, Quotation, ServiceRequest, User } from "@/types/crm";
import { cn } from "@/lib/utils";
import { CUSTOMER_SOURCE_TYPES, PRODUCT_TYPES, uniqueSorted } from "@/lib/options";
import { currency } from "@/utils/format";
import { formatRemaining, getDemoStatus, type DemoStatus } from "@/lib/demo";
import { DemoBanner, DemoExpiredScreen } from "@/components/demo-gate";
import { Badge, Chart, DataTable, DeleteButton, Panel, SimpleRows } from "@/components/ui";
import { QuotationModal } from "@/components/quotation-modal";
import { UsersView } from "@/components/users-view";
import { AttendanceView } from "@/components/attendance-view";
import { InventoryView } from "@/components/inventory-view";
import { LeadsView } from "@/components/leads-view";
import { InvoicesView } from "@/components/invoices-view";
import { OrdersView } from "@/components/orders-view";
import { ServicesView } from "@/components/services-view";
import { PaymentsView } from "@/components/payments-view";
import { SearchView } from "@/components/search-view";
import { useToast } from "@/components/toast";
import { STORAGE_KEYS, loadState, saveState } from "@/lib/storage";
import { downloadCSV, downloadQuotationPdf, quotationMessage, whatsappLink } from "@/lib/export";

type ModuleId =
  | "dashboard"
  | "search"
  | "customers"
  | "leads"
  | "inventory"
  | "quotations"
  | "orders"
  | "invoices"
  | "services"
  | "attendance"
  | "payments"
  | "users"
  | "reports"
  | "settings";

type ModuleDef = { readonly id: ModuleId; readonly label: string; readonly icon: LucideIcon; readonly adminOnly?: boolean };

const modules: readonly ModuleDef[] = [
  { id: "dashboard", label: "Dashboard", icon: Home },
  { id: "search", label: "Search", icon: Search },
  { id: "customers", label: "Customers", icon: Users },
  { id: "leads", label: "Leads", icon: ClipboardList },
  { id: "inventory", label: "Inventory", icon: Boxes },
  { id: "quotations", label: "Quotations", icon: FileText },
  { id: "orders", label: "Orders", icon: BriefcaseBusiness },
  { id: "invoices", label: "Invoices", icon: ReceiptText },
  { id: "services", label: "Services", icon: Wrench },
  { id: "attendance", label: "Attendance", icon: CalendarCheck },
  { id: "payments", label: "Payments", icon: CreditCard },
  { id: "users", label: "Users", icon: UserCog, adminOnly: true },
  { id: "reports", label: "Reports", icon: FileBarChart },
  { id: "settings", label: "Settings", icon: Settings }
];

const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "Use at least 6 characters")
});

// Only Name and Phone are mandatory; every other customer field is optional.
const customerSchema = z.object({
  customerName: z.string().min(2, "Name is required"),
  mobile: z.string().min(10, "A valid phone number is required"),
  city: z.string().optional(),
  address: z.string().optional(),
  productModel: z.string().optional(),
  productBrand: z.string().optional(),
  productType: z.string().optional(),
  email: z.string().email("Enter a valid email").optional().or(z.literal("")),
  sourceType: z.string().optional()
});

type CustomerForm = z.infer<typeof customerSchema>;

export default function Page() {
  useServiceWorker();
  const toast = useToast();
  const [mounted, setMounted] = useState(false);
  const [demo, setDemo] = useState<DemoStatus | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeModule, setActiveModule] = useState<ModuleId>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState("");
  const [customerList, setCustomerList] = useState<Customer[]>(customerSeed);
  const [quotationList, setQuotationList] = useState<Quotation[]>(quotationSeed);
  const [inventory, setInventory] = useState<Product[]>(productSeed);
  const [leadList, setLeadList] = useState<Lead[]>(leadSeed);
  const [invoiceList, setInvoiceList] = useState<Invoice[]>(invoiceSeed);
  const [orderList, setOrderList] = useState<Order[]>(orderSeed);
  const [serviceList, setServiceList] = useState<ServiceRequest[]>(serviceSeed);
  const [paymentList, setPaymentList] = useState<Payment[]>(paymentSeed);
  const [userList, setUserList] = useState<User[]>(userSeed);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null | "new">(null);
  const [editingQuotation, setEditingQuotation] = useState<Quotation | null | "new">(null);

  const isAdmin = currentUser?.role === "Admin";

  // Time- and storage-dependent state must resolve on the client only, so the
  // static-exported HTML and the first client render stay in sync.
  useEffect(() => {
    setMounted(true);
    setDemo(getDemoStatus());
    setCustomerList(loadState(STORAGE_KEYS.customers, customerSeed));
    setQuotationList(loadState(STORAGE_KEYS.quotations, quotationSeed));
    setInventory(loadState(STORAGE_KEYS.inventory, productSeed));
    setLeadList(loadState(STORAGE_KEYS.leads, leadSeed));
    setInvoiceList(loadState(STORAGE_KEYS.invoices, invoiceSeed));
    setOrderList(loadState(STORAGE_KEYS.orders, orderSeed));
    setServiceList(loadState(STORAGE_KEYS.services, serviceSeed));
    setPaymentList(loadState(STORAGE_KEYS.payments, paymentSeed));

    const users = loadState(STORAGE_KEYS.users, userSeed);
    setUserList(users);

    // Restore the session from the LIVE user record (not the stored snapshot) so a
    // removed, deactivated, or role-changed account cannot linger via localStorage.
    const session = loadState<User | null>(STORAGE_KEYS.auth, null);
    const restored = session ? users.find((user) => user.id === session.id && user.status === "Active") ?? null : null;
    setCurrentUser(restored);
    if (session) saveState(STORAGE_KEYS.auth, restored);

    // Seed the current month's attendance on first run so the module is not empty.
    const staff = users.filter((user) => user.role === "Staff");
    setAttendance(loadState(STORAGE_KEYS.attendance, generateAttendance(staff, new Date())));

    // Re-check the demo window periodically so an open session locks the moment
    // it lapses, without a manual refresh.
    const timer = setInterval(() => setDemo(getDemoStatus()), 60_000);
    return () => clearInterval(timer);
  }, []);

  /** Authenticate against the users list: email must exist, password must match, account must be active. */
  function handleLogin(values: z.infer<typeof loginSchema>): { ok: boolean; error?: string } {
    const email = values.email.trim().toLowerCase();
    const match = userList.find((user) => user.email.toLowerCase() === email);
    if (!match || match.password !== values.password) {
      return { ok: false, error: "Invalid email or password." };
    }
    if (match.status === "Inactive") {
      return { ok: false, error: "This account is inactive. Contact your administrator." };
    }
    setCurrentUser(match);
    saveState(STORAGE_KEYS.auth, match);
    return { ok: true };
  }

  function handleLogout() {
    saveState(STORAGE_KEYS.auth, null);
    setCurrentUser(null);
    setActiveModule("dashboard");
  }

  function saveCustomer(customer: Customer) {
    const existed = customerList.some((item) => item.customerId === customer.customerId);
    const next = existed ? customerList.map((item) => (item.customerId === customer.customerId ? customer : item)) : [customer, ...customerList];
    setCustomerList(next);
    saveState(STORAGE_KEYS.customers, next);
    setEditingCustomer(null);
    toast(existed ? `${customer.customerName} updated` : `${customer.customerName} added`);
  }

  function deleteCustomer(customer: Customer) {
    const next = customerList.filter((item) => item.customerId !== customer.customerId);
    setCustomerList(next);
    saveState(STORAGE_KEYS.customers, next);
    toast(`${customer.customerName} removed`, "info");
  }

  function updateInventory(next: Product[]) {
    setInventory(next);
    saveState(STORAGE_KEYS.inventory, next);
  }

  function updateLeads(next: Lead[]) {
    setLeadList(next);
    saveState(STORAGE_KEYS.leads, next);
  }

  // Convert a lead into a customer, carrying over all shared fields. If a customer with the
  // same phone already exists it is linked instead of duplicated. The lead is then marked converted.
  function convertLead(lead: Lead) {
    if (lead.convertedCustomerId) {
      toast(`${lead.name} is already a customer`, "info");
      return;
    }
    const leadPhone = lead.phone.replace(/\D/g, "");
    const existing = leadPhone ? customerList.find((c) => c.mobile.replace(/\D/g, "") === leadPhone) : undefined;
    const customer: Customer =
      existing ?? {
        customerId: `CUST-${Date.now()}`,
        customerName: lead.name,
        mobile: lead.phone,
        city: lead.town ?? "",
        address: lead.address ?? "",
        productModel: lead.productModel ?? "",
        productBrand: lead.productBrand ?? "",
        productType: lead.productType,
        email: lead.email ?? "",
        sourceType: lead.sourceType,
        createdAt: new Date().toISOString()
      };
    if (!existing) {
      const nextCustomers = [customer, ...customerList];
      setCustomerList(nextCustomers);
      saveState(STORAGE_KEYS.customers, nextCustomers);
    }
    const nextLeads = leadList.map((item) =>
      item.leadId === lead.leadId ? { ...item, convertedCustomerId: customer.customerId, status: "Order Confirmed" as Lead["status"] } : item
    );
    setLeadList(nextLeads);
    saveState(STORAGE_KEYS.leads, nextLeads);
    toast(existing ? `${lead.name} linked to existing customer` : `${lead.name} converted to customer`);
  }

  function updateInvoices(next: Invoice[]) {
    setInvoiceList(next);
    saveState(STORAGE_KEYS.invoices, next);
  }

  function updateOrders(next: Order[]) {
    setOrderList(next);
    saveState(STORAGE_KEYS.orders, next);
  }

  function updateServices(next: ServiceRequest[]) {
    setServiceList(next);
    saveState(STORAGE_KEYS.services, next);
  }

  function updatePayments(next: Payment[]) {
    setPaymentList(next);
    saveState(STORAGE_KEYS.payments, next);
  }

  function saveQuotation(quotation: Quotation) {
    const existed = quotationList.some((item) => item.quotationId === quotation.quotationId);
    const next = existed ? quotationList.map((item) => (item.quotationId === quotation.quotationId ? quotation : item)) : [quotation, ...quotationList];
    setQuotationList(next);
    saveState(STORAGE_KEYS.quotations, next);
    setEditingQuotation(null);
    toast(existed ? `${quotation.quotationNumber} updated` : `${quotation.quotationNumber} created`);
  }

  function deleteQuotation(quotation: Quotation) {
    const next = quotationList.filter((item) => item.quotationId !== quotation.quotationId);
    setQuotationList(next);
    saveState(STORAGE_KEYS.quotations, next);
    toast(`${quotation.quotationNumber} removed`, "info");
  }

  function updateUsers(next: User[]) {
    setUserList(next);
    saveState(STORAGE_KEYS.users, next);

    // Keep the active session in sync when the signed-in user edits their own record.
    if (currentUser) {
      const me = next.find((user) => user.id === currentUser.id);
      setCurrentUser(me ?? null);
      saveState(STORAGE_KEYS.auth, me ?? null);
    }
  }

  function updateAttendance(next: AttendanceRecord[]) {
    setAttendance(next);
    saveState(STORAGE_KEYS.attendance, next);
  }

  const visibleModules = modules.filter((module) => !module.adminOnly || isAdmin);
  const selectedModule = modules.find((module) => module.id === activeModule) ?? modules[0];

  // Avoid a hydration flash before the client resolves demo/auth state.
  if (!mounted || !demo) {
    return <main className="min-h-screen bg-[#F8FAFC]" aria-hidden />;
  }

  if (demo.expired) {
    return <DemoExpiredScreen status={demo} />;
  }

  if (!currentUser) {
    return <LoginScreen demo={demo} onLogin={handleLogin} />;
  }

  return (
    <main className="min-h-screen bg-[#F8FAFC] text-slate-950">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-72 flex-col bg-slate-950 px-4 py-5 text-white shadow-2xl transition-transform lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-lg bg-blue-600">
              <Snowflake className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-blue-200">RAMPS CUBE</p>
              <h1 className="text-lg font-bold">CRM MVP</h1>
            </div>
          </div>
          <button className="rounded-lg p-2 lg:hidden" onClick={() => setSidebarOpen(false)} aria-label="Close menu">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="mt-8 flex-1 space-y-1 overflow-y-auto">
          {visibleModules.map((module) => {
            const Icon = module.icon;
            return (
              <button
                key={module.id}
                onClick={() => {
                  setActiveModule(module.id);
                  setSidebarOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-medium text-slate-300 transition hover:bg-white/10 hover:text-white",
                  activeModule === module.id && "bg-blue-600 text-white shadow-lg shadow-blue-950/40"
                )}
              >
                <Icon className="h-5 w-5" />
                {module.label}
              </button>
            );
          })}
        </nav>

        <div className="mt-4 border-t border-white/10 pt-4">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-blue-600 text-sm font-bold uppercase">
              {currentUser.name.charAt(0)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{currentUser.name}</p>
              <p className="truncate text-xs text-slate-400">{currentUser.role}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-slate-300 transition hover:bg-white/10 hover:text-white"
          >
            <LogOut className="h-5 w-5" />
            Logout
          </button>
        </div>
      </aside>

      <div className="lg:pl-72">
        <DemoBanner status={demo} />
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-4 py-4 backdrop-blur lg:px-8">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center gap-3">
              <button
                className="rounded-lg border border-slate-200 bg-white p-2 lg:hidden"
                onClick={() => setSidebarOpen(true)}
                aria-label="Open menu"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div>
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  CRM <ChevronRight className="h-4 w-4" /> {selectedModule.label}
                </div>
                <h2 className="text-2xl font-bold tracking-tight text-slate-950">{selectedModule.label}</h2>
              </div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative min-w-0 sm:w-80">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={globalSearch}
                  onChange={(event) => setGlobalSearch(event.target.value)}
                  className="h-11 w-full rounded-lg border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm outline-none ring-blue-500 transition focus:bg-white focus:ring-2"
                  placeholder="Global search"
                />
              </div>
              <button className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700">
                <Bell className="h-4 w-4" />
                7 alerts
              </button>
              <button
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white shadow-soft"
                onClick={() => setEditingCustomer("new")}
              >
                <Plus className="h-4 w-4" />
                Add Customer
              </button>
            </div>
          </div>
        </header>

        <section className="p-4 lg:p-8">
          {activeModule === "dashboard" && <Dashboard customers={customerList} quotations={quotationList} leads={leadList} invoices={invoiceList} payments={paymentList} services={serviceList} />}
          {activeModule === "search" && <SearchView customers={customerList} products={inventory} leads={leadList} />}
          {activeModule === "customers" && <CustomersView customers={customerList} query={globalSearch} onEdit={(customer) => setEditingCustomer(customer)} onDelete={deleteCustomer} />}
          {activeModule === "leads" && <LeadsView leads={leadList} products={inventory} query={globalSearch} onChange={updateLeads} onConvert={convertLead} />}
          {activeModule === "inventory" && <InventoryView products={inventory} query={globalSearch} onChange={updateInventory} />}
          {activeModule === "quotations" && (
            <QuotationsView
              quotations={quotationList}
              customers={customerList}
              products={inventory}
              query={globalSearch}
              onEdit={(quotation) => setEditingQuotation(quotation)}
              onNew={() => setEditingQuotation("new")}
              onDelete={deleteQuotation}
            />
          )}
          {activeModule === "orders" && <OrdersView orders={orderList} customers={customerList} query={globalSearch} onChange={updateOrders} />}
          {activeModule === "invoices" && <InvoicesView invoices={invoiceList} query={globalSearch} onChange={updateInvoices} />}
          {activeModule === "services" && <ServicesView services={serviceList} customers={customerList} query={globalSearch} onChange={updateServices} />}
          {activeModule === "attendance" && <AttendanceView users={userList} records={attendance} onChange={updateAttendance} />}
          {activeModule === "payments" && <PaymentsView payments={paymentList} customers={customerList} query={globalSearch} onChange={updatePayments} />}
          {activeModule === "users" && isAdmin && <UsersView users={userList} currentUserId={currentUser.id} onChange={updateUsers} />}
          {activeModule === "reports" && <ReportsView customers={customerList} products={inventory} quotations={quotationList} leads={leadList} invoices={invoiceList} orders={orderList} payments={paymentList} services={serviceList} />}
          {activeModule === "settings" && <SettingsView users={userList} />}
        </section>
      </div>

      {editingCustomer !== null && (
        <CustomerModal initial={editingCustomer === "new" ? null : editingCustomer} products={inventory} onClose={() => setEditingCustomer(null)} onSave={saveCustomer} />
      )}

      {editingQuotation !== null && (
        <QuotationModal
          quotation={editingQuotation === "new" ? null : editingQuotation}
          customers={customerList}
          products={inventory}
          existing={quotationList}
          onClose={() => setEditingQuotation(null)}
          onSave={saveQuotation}
        />
      )}
    </main>
  );
}

function LoginScreen({ demo, onLogin }: { demo: DemoStatus; onLogin: (values: z.infer<typeof loginSchema>) => { ok: boolean; error?: string } }) {
  const [authError, setAuthError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "admin@rampscube.com", password: "admin123" }
  });

  function submit(values: z.infer<typeof loginSchema>) {
    const result = onLogin(values);
    if (!result.ok) setAuthError(result.error ?? "Unable to sign in.");
  }

  return (
    <main className="grid min-h-screen bg-[#F8FAFC] lg:grid-cols-[1.05fr_0.95fr]">
      <section className="flex items-center justify-center px-6 py-10">
        <form
          onSubmit={handleSubmit(submit)}
          className="w-full max-w-md overflow-hidden rounded-lg border border-slate-200 bg-white shadow-soft"
        >
          <DemoBanner status={demo} />
          <div className="p-8">
          <div className="mb-8 flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-lg bg-blue-600 text-white">
              <Snowflake className="h-7 w-7" />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">RAMPS CUBE</p>
              <h1 className="text-2xl font-bold text-slate-950">CRM Login</h1>
            </div>
          </div>
          <label className="mb-2 block text-sm font-semibold text-slate-700">Email</label>
          <input className="mb-2 h-11 w-full rounded-lg border border-slate-200 px-3 outline-none ring-blue-500 focus:ring-2" {...register("email")} />
          {errors.email && <p className="mb-3 text-sm text-red-600">{errors.email.message}</p>}
          <label className="mb-2 block text-sm font-semibold text-slate-700">Password</label>
          <input type="password" className="mb-2 h-11 w-full rounded-lg border border-slate-200 px-3 outline-none ring-blue-500 focus:ring-2" {...register("password")} />
          {errors.password && <p className="mb-3 text-sm text-red-600">{errors.password.message}</p>}
          {authError && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{authError}</p>}
          <button className="mt-4 h-12 w-full rounded-lg bg-blue-600 font-semibold text-white shadow-soft">Sign in</button>
          <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm text-slate-600">
            <p className="font-semibold text-blue-700">Demo logins</p>
            <p className="mt-1">
              Admin — <span className="font-medium">admin@rampscube.com</span> / <span className="font-medium">admin123</span>
            </p>
            <p className="mt-0.5">
              Staff — <span className="font-medium">priya@rampscube.com</span> / <span className="font-medium">staff123</span>
            </p>
            <p className="mt-1 text-xs text-slate-500">Full evaluation access · {formatRemaining(demo)}.</p>
          </div>
          </div>
        </form>
      </section>
      <section className="hidden bg-slate-950 p-10 text-white lg:flex lg:flex-col lg:justify-between">
        <div>
          <div className="mb-10 inline-flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-sm text-blue-100">
            <ShieldCheck className="h-4 w-4" />
            Authenticated CRM PWA
          </div>
          <h2 className="max-w-xl text-5xl font-bold leading-tight">Commercial refrigeration sales, service, and payments in one clean workspace.</h2>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {["Customers", "Quotations", "Services"].map((item) => (
            <div key={item} className="rounded-lg border border-white/10 bg-white/5 p-5">
              <p className="text-sm text-blue-100">{item}</p>
              <p className="mt-2 text-3xl font-bold">Live</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

function Dashboard({ customers, quotations, leads, invoices, payments, services }: { customers: Customer[]; quotations: Quotation[]; leads: Lead[]; invoices: Invoice[]; payments: Payment[]; services: ServiceRequest[] }) {
  const nameOf = (customerId: string) => {
    const c = customers.find((item) => item.customerId === customerId);
    return c ? c.companyName || c.customerName : customerName(customerId);
  };
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthsToShow = new Date().getMonth() + 1; // Jan through the current month
  const customerMonthLabels = monthNames.slice(0, monthsToShow);
  const customersByMonth = customerMonthLabels.map((_, month) => customers.filter((item) => new Date(item.createdAt).getMonth() === month).length);
  const quotationStatusLabels = ["Draft", "Sent", "Accepted", "Rejected"];
  const quotationsByStatus = quotationStatusLabels.map((status) => quotations.filter((item) => item.status === status).length);
  const stats = [
    { label: "Total Customers", value: customers.length, icon: Users },
    { label: "New Leads", value: leads.filter((item) => item.status === "New").length, icon: ClipboardList },
    { label: "Pending Follow-ups", value: leads.filter((item) => item.status === "Follow-up").length, icon: CalendarClock },
    { label: "Quotations Sent", value: quotations.filter((item) => item.status === "Sent").length, icon: FileText },
    { label: "Invoices Pending Share", value: invoices.filter((item) => !item.shared).length, icon: ReceiptText },
    { label: "Pending Payments", value: payments.filter((item) => item.status !== "Paid").length, icon: CreditCard },
    { label: "Open Service Requests", value: services.filter((item) => item.status !== "Completed").length, icon: Wrench }
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">{stat.label}</p>
                  <p className="mt-2 text-3xl font-bold text-slate-950">{stat.value}</p>
                </div>
                <div className="grid h-11 w-11 place-items-center rounded-lg bg-blue-50 text-blue-600">
                  <Icon className="h-5 w-5" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Chart title="New Customers (Monthly)" values={customersByMonth} labels={customerMonthLabels} />
        <Chart title="Quotations by Status" values={quotationsByStatus} labels={quotationStatusLabels} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Latest Customers">
          <SimpleRows rows={customers.slice(0, 5).map((item) => [item.customerName, item.city || "—", item.mobile])} />
        </Panel>
        <Panel title="Recent Leads">
          <SimpleRows rows={leads.slice(0, 5).map((item) => [item.name, item.town || "—", item.interestedIn || item.source])} />
        </Panel>
        <Panel title="Recent Quotations">
          <SimpleRows rows={quotations.slice(0, 5).map((item) => [item.quotationNumber, nameOf(item.customerId), currency(item.total)])} />
        </Panel>
        <Panel title="Recent Invoices">
          <SimpleRows rows={invoices.slice(0, 5).map((item) => [item.invoiceNumber, item.customerName, item.shared ? "Shared" : "Pending"])} />
        </Panel>
      </div>
    </div>
  );
}

function CustomersView({ customers, query, onEdit, onDelete }: { customers: Customer[]; query: string; onEdit: (customer: Customer) => void; onDelete: (customer: Customer) => void }) {
  const rows = customers.filter((customer) => {
    const haystack = `${customer.customerName} ${customer.companyName ?? ""} ${customer.mobile} ${customer.city} ${customer.productBrand} ${customer.productModel} ${customer.productType ?? ""}`.toLowerCase();
    return haystack.includes(query.toLowerCase());
  });

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-500">{customers.length} customers</p>
      <DataTable
        columns={["Name", "Phone", "Town", "Product Type", "Brand", "Model", "Contact", "Actions"]}
        rows={rows.map((item) => {
          const phone = item.mobile.replace(/\D/g, "");
          const waNumber = (item.whatsapp || item.mobile).replace(/\D/g, "");
          return [
            <span key="n" className="font-semibold text-slate-900">{item.customerName}</span>,
            item.mobile || "—",
            item.city || "—",
            item.productType || "—",
            item.productBrand || "—",
            item.productModel || "—",
            <div key="contact" className="flex items-center gap-2">
              <a
                href={`tel:${phone}`}
                className={cn("inline-flex items-center gap-1 rounded-lg border border-blue-200 px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:border-blue-300", !phone && "pointer-events-none opacity-40")}
                title="Call"
              >
                <Phone className="h-3.5 w-3.5" /> Call
              </a>
              <a
                href={waNumber ? whatsappLink(waNumber, `Hello ${item.customerName}, `) : undefined}
                target="_blank"
                rel="noopener noreferrer"
                className={cn("inline-flex items-center gap-1 rounded-lg border border-green-200 px-2.5 py-1.5 text-xs font-semibold text-green-700 hover:border-green-300", !waNumber && "pointer-events-none opacity-40")}
                title="WhatsApp"
              >
                <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
              </a>
            </div>,
            <div key="actions" className="flex items-center gap-2">
              <button onClick={() => onEdit(item)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:border-blue-300">
                <Pencil className="h-3.5 w-3.5" /> Edit
              </button>
              <DeleteButton resetKey={item.customerId} onDelete={() => onDelete(item)} />
            </div>
          ];
        })}
      />
    </div>
  );
}

function QuotationsView({
  quotations,
  customers,
  products,
  query,
  onEdit,
  onNew,
  onDelete
}: {
  quotations: Quotation[];
  customers: Customer[];
  products: Product[];
  query: string;
  onEdit: (quotation: Quotation) => void;
  onNew: () => void;
  onDelete: (quotation: Quotation) => void;
}) {
  const toast = useToast();
  const customerOf = (customerId: string) => customers.find((item) => item.customerId === customerId);
  const nameOf = (customerId: string) => {
    const c = customerOf(customerId);
    return c ? c.companyName || c.customerName : customerName(customerId);
  };
  const rows = quotations.filter((item) => `${item.quotationNumber} ${item.reference ?? ""} ${nameOf(item.customerId)}`.toLowerCase().includes(query.toLowerCase()));

  async function handlePdf(quotation: Quotation) {
    try {
      await downloadQuotationPdf(quotation, customerOf(quotation.customerId), products);
      toast(`PDF generated for ${quotation.quotationNumber}`);
    } catch {
      toast("Could not generate the PDF.", "info");
    }
  }

  function handleWhatsapp(quotation: Quotation) {
    const customer = customerOf(quotation.customerId);
    const message = quotationMessage(quotation, customer, products);
    window.open(whatsappLink(customer?.whatsapp ?? customer?.mobile ?? "", message), "_blank", "noopener");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-end gap-2">
        <button onClick={onNew} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white"><Plus className="h-4 w-4" /> New Quotation</button>
      </div>
      <DataTable
        columns={["Quotation", "Reference", "Customer", "Subtotal", "GST", "Total", "Status", "Actions"]}
        rows={rows.map((item) => [
          item.quotationNumber,
          item.reference || "—",
          nameOf(item.customerId),
          currency(item.subtotal),
          currency(item.gst),
          currency(item.total),
          <Badge key={item.quotationId} label={item.status} />,
          <div key={`${item.quotationId}-actions`} className="flex items-center gap-2">
            <button
              onClick={() => onEdit(item)}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:border-blue-300"
            >
              <Pencil className="h-3.5 w-3.5" /> Edit
            </button>
            <button
              onClick={() => handlePdf(item)}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:border-slate-300"
            >
              <FileText className="h-3.5 w-3.5" /> PDF
            </button>
            <button
              onClick={() => handleWhatsapp(item)}
              className="inline-flex items-center gap-1 rounded-lg border border-green-200 px-2.5 py-1.5 text-xs font-semibold text-green-700 hover:border-green-300"
            >
              <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
            </button>
            <DeleteButton resetKey={item.quotationId} onDelete={() => onDelete(item)} />
          </div>
        ])}
      />
    </div>
  );
}

function ReportsView({ customers, products, quotations, leads, invoices, orders, payments, services }: { customers: Customer[]; products: Product[]; quotations: Quotation[]; leads: Lead[]; invoices: Invoice[]; orders: Order[]; payments: Payment[]; services: ServiceRequest[] }) {
  const toast = useToast();
  const nameOf = (customerId: string) => {
    const c = customers.find((item) => item.customerId === customerId);
    return c ? c.companyName || c.customerName : customerName(customerId);
  };
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const reports: { title: string; description: string; build: () => (string | number)[][] }[] = [
    {
      title: "Customer Report",
      description: "All customers with contact, product and customer-type details.",
      build: () => [
        ["Name", "Phone", "Town", "Address", "Product Type", "Brand", "Model", "Type of Customer", "Mail"],
        ...customers.map((c) => [c.customerName, c.mobile, c.city, c.address, c.productType ?? "", c.productBrand, c.productModel, c.sourceType ?? "", c.email])
      ]
    },
    {
      title: "Stock Report",
      description: "Inventory with purchase, NLC, sale price and sold-out details.",
      build: () => [
        ["Brand", "Model", "Serial No", "Product Type", "Purchase Date", "NLC", "Sale Price", "Sale Date", "Customer Town", "Customer Name", "Commission", "Status"],
        ...products.map((p) => [
          p.brand,
          p.model,
          p.serialNo,
          p.productType ?? "",
          p.invoiceDate,
          typeof p.nlc === "number" ? p.nlc : "",
          p.price,
          p.saleDate ?? "",
          p.soldToTown ?? "",
          p.soldToName ?? "",
          typeof p.commission === "number" ? p.commission : "",
          p.saleDate ? "Sold" : "In Stock"
        ])
      ]
    },
    {
      title: "Leads Report",
      description: "Leads with contact, product, source, interest and status.",
      build: () => [
        ["Lead", "Name", "Town", "Phone", "Mail", "Product Type", "Brand", "Model", "Type of Customer", "Nature", "Interested In", "Status", "Converted"],
        ...leads.map((l) => [l.leadNumber, l.name, l.town, l.phone, l.email ?? "", l.productType ?? "", l.productBrand ?? "", l.productModel ?? "", l.sourceType ?? "", l.source, l.interestedIn, l.status, l.convertedCustomerId ? "Yes" : "No"])
      ]
    },
    {
      title: "Invoice Report",
      description: "Invoices with source and Created / Shared state.",
      build: () => [["Invoice", "Customer", "Town", "Date", "Amount", "Source", "Created", "Shared"], ...invoices.map((i) => [i.invoiceNumber, i.customerName, i.town, i.date, i.amount, i.source, i.created ? "Yes" : "No", i.shared ? "Yes" : "No"])]
    },
    {
      title: "Quotation Report",
      description: "Quotations with values, discount and GST.",
      build: () => [["Quotation", "Customer", "Subtotal", "Discount", "GST", "Total", "Status"], ...quotations.map((q) => [q.quotationNumber, nameOf(q.customerId), q.subtotal, q.discount, q.gst, q.total, q.status])]
    },
    {
      title: "Order Report",
      description: "Orders with delivery and payment status.",
      build: () => [["Order", "Customer", "Delivery", "Payment", "Status"], ...orders.map((o) => [o.orderNumber, nameOf(o.customerId), o.deliveryDate, o.paymentStatus, o.status])]
    },
    {
      title: "Pending Payments",
      description: "Invoices with an outstanding balance.",
      build: () => [["Invoice", "Customer", "Amount", "Paid", "Balance", "Status"], ...payments.filter((p) => p.status !== "Paid").map((p) => [p.invoiceNumber, nameOf(p.customerId), p.invoiceAmount, p.paidAmount, p.balanceAmount, p.status])]
    },
    {
      title: "Service Report",
      description: "Service requests with technician and status.",
      build: () => [["Service", "Customer", "Product", "Complaint", "Technician", "Status"], ...services.map((s) => [s.serviceNumber, nameOf(s.customerId), s.product, s.complaint, s.assignedTo, s.status])]
    },
    {
      title: "Monthly Sales Summary",
      description: "Quotation count and value by month.",
      build: () => [
        ["Month", "Quotations", "Total Value (INR)"],
        ...monthNames
          .map((name, month) => {
            const monthly = quotations.filter((q) => new Date(q.createdAt).getMonth() === month);
            return [name, monthly.length, monthly.reduce((sum, q) => sum + q.total, 0)] as (string | number)[];
          })
          .filter((row) => (row[1] as number) > 0)
      ]
    }
  ];

  function exportReport(report: (typeof reports)[number]) {
    downloadCSV(`${report.title.replace(/\s+/g, "-")}.csv`, report.build());
    toast(`${report.title} exported`);
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {reports.map((report) => (
        <div key={report.title} className="flex flex-col rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
          <FileBarChart className="mb-4 h-8 w-8 text-blue-600" />
          <h3 className="font-bold text-slate-950">{report.title}</h3>
          <p className="mt-2 flex-1 text-sm text-slate-500">{report.description}</p>
          <button
            onClick={() => exportReport(report)}
            className="mt-5 inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
          >
            <Download className="h-4 w-4" /> Export CSV
          </button>
        </div>
      ))}
    </div>
  );
}

function SettingsView({ users }: { users: User[] }) {
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_0.8fr]">
      <Panel title="Company Information">
        <div className="grid gap-4 sm:grid-cols-2">
          {["Company Name", "GST Number", "Phone", "Address", "Quotation Footer", "Terms & Conditions"].map((label) => (
            <label key={label} className="block text-sm font-semibold text-slate-700">
              {label}
              <input className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 font-normal outline-none ring-blue-500 focus:ring-2" defaultValue={label === "Company Name" ? "RAMPS CUBE" : ""} />
            </label>
          ))}
        </div>
      </Panel>
      <Panel title="User Management">
        <p className="mb-3 text-sm text-slate-500">Manage staff and admin accounts in the <span className="font-semibold text-blue-700">Users</span> module.</p>
        <SimpleRows rows={users.map((user) => [user.name, user.email, `${user.role} · ${user.status}`])} />
      </Panel>
    </div>
  );
}

function CustomerModal({ initial, products, onClose, onSave }: { initial: Customer | null; products: Product[]; onClose: () => void; onSave: (customer: Customer) => void }) {
  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<CustomerForm>({
    resolver: zodResolver(customerSchema),
    defaultValues: initial
      ? {
          customerName: initial.customerName,
          mobile: initial.mobile,
          city: initial.city,
          address: initial.address,
          productBrand: initial.productBrand,
          productModel: initial.productModel,
          productType: initial.productType ?? "",
          email: initial.email,
          sourceType: initial.sourceType ?? ""
        }
      : undefined
  });

  // Brand / model dropdowns are built from the inventory; the current record's own value
  // is merged in so editing an item whose brand/model is no longer in stock still shows it.
  const brandOptions = uniqueSorted([...products.map((p) => p.brand), initial?.productBrand]);
  const modelOptions = uniqueSorted([...products.map((p) => p.model), initial?.productModel]);

  function submit(values: CustomerForm) {
    onSave({
      customerId: initial?.customerId ?? `CUST-${Date.now()}`,
      createdAt: initial?.createdAt ?? new Date().toISOString(),
      whatsapp: initial?.whatsapp,
      companyName: initial?.companyName,
      gst: initial?.gst,
      customerType: initial?.customerType,
      remarks: initial?.remarks,
      customerName: values.customerName,
      mobile: values.mobile,
      city: values.city ?? "",
      address: values.address ?? "",
      productModel: values.productModel ?? "",
      productBrand: values.productBrand ?? "",
      productType: (values.productType || undefined) as Customer["productType"],
      email: values.email ?? "",
      sourceType: (values.sourceType || undefined) as Customer["sourceType"]
    });
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4">
      <form onSubmit={handleSubmit(submit)} className="max-h-[92vh] w-full max-w-3xl overflow-auto rounded-lg bg-white p-6 shadow-2xl">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-xl font-bold">{initial ? "Edit Customer" : "Add Customer"}</h2>
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 p-2" aria-label="Close"><X className="h-5 w-5" /></button>
        </div>
        <p className="mb-6 text-sm text-slate-500">Only Name and Phone are required.</p>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-semibold text-slate-700">
            Name *
            <input className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 font-normal outline-none ring-blue-500 focus:ring-2" {...register("customerName")} />
            {errors.customerName && <span className="mt-1 block text-xs text-red-600">{errors.customerName.message}</span>}
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Phone Number *
            <input className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 font-normal outline-none ring-blue-500 focus:ring-2" {...register("mobile")} />
            {errors.mobile && <span className="mt-1 block text-xs text-red-600">{errors.mobile.message}</span>}
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Town
            <input className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 font-normal outline-none ring-blue-500 focus:ring-2" {...register("city")} />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Address
            <input className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 font-normal outline-none ring-blue-500 focus:ring-2" {...register("address")} />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Product Brand
            <select className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 font-normal outline-none ring-blue-500 focus:ring-2" {...register("productBrand")}>
              <option value="">— Select —</option>
              {brandOptions.map((brand) => (
                <option key={brand} value={brand}>{brand}</option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Product Model
            <select className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 font-normal outline-none ring-blue-500 focus:ring-2" {...register("productModel")}>
              <option value="">— Select —</option>
              {modelOptions.map((model) => (
                <option key={model} value={model}>{model}</option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Product Type
            <select className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 font-normal outline-none ring-blue-500 focus:ring-2" {...register("productType")}>
              <option value="">— Select —</option>
              {PRODUCT_TYPES.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Mail ID
            <input className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 font-normal outline-none ring-blue-500 focus:ring-2" {...register("email")} />
            {errors.email && <span className="mt-1 block text-xs text-red-600">{errors.email.message}</span>}
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Type of Customer
            <select className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 font-normal outline-none ring-blue-500 focus:ring-2" {...register("sourceType")}>
              <option value="">— Select —</option>
              {CUSTOMER_SOURCE_TYPES.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 font-semibold">Cancel</button>
          <button className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white"><UserPlus className="h-4 w-4" /> Save Customer</button>
        </div>
      </form>
    </div>
  );
}

function customerName(customerId: string) {
  const customer = customerSeed.find((item) => item.customerId === customerId);
  return customer?.companyName || customer?.customerName || customerId;
}
