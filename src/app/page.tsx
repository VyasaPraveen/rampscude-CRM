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
  Plus,
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
  enquiries,
  generateAttendance,
  orders,
  payments,
  products,
  quotations as quotationSeed,
  services,
  users as userSeed
} from "@/lib/seed-data";
import type { AttendanceRecord, Customer, CustomerType, Product, Quotation, User } from "@/types/crm";
import { cn } from "@/lib/utils";
import { currency, shortDate } from "@/utils/format";
import { formatRemaining, getDemoStatus, type DemoStatus } from "@/lib/demo";
import { DemoBanner, DemoExpiredScreen } from "@/components/demo-gate";
import { Badge, Chart, DataTable, Panel, SimpleRows } from "@/components/ui";
import { QuotationModal } from "@/components/quotation-modal";
import { UsersView } from "@/components/users-view";
import { AttendanceView } from "@/components/attendance-view";
import { useToast } from "@/components/toast";
import { STORAGE_KEYS, loadState, saveState } from "@/lib/storage";
import { downloadCSV, downloadQuotationPdf, quotationMessage, whatsappLink } from "@/lib/export";

type ModuleId =
  | "dashboard"
  | "customers"
  | "enquiries"
  | "products"
  | "quotations"
  | "orders"
  | "services"
  | "attendance"
  | "payments"
  | "users"
  | "reports"
  | "settings";

type ModuleDef = { readonly id: ModuleId; readonly label: string; readonly icon: LucideIcon; readonly adminOnly?: boolean };

const modules: readonly ModuleDef[] = [
  { id: "dashboard", label: "Dashboard", icon: Home },
  { id: "customers", label: "Customers", icon: Users },
  { id: "enquiries", label: "Enquiries", icon: ClipboardList },
  { id: "products", label: "Products", icon: Boxes },
  { id: "quotations", label: "Quotations", icon: FileText },
  { id: "orders", label: "Orders", icon: BriefcaseBusiness },
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

const customerSchema = z.object({
  customerName: z.string().min(2, "Customer name is required"),
  companyName: z.string().min(2, "Company name is required"),
  mobile: z.string().min(10, "Mobile number is required"),
  whatsapp: z.string().min(10, "WhatsApp number is required"),
  email: z.string().email("Enter a valid email"),
  gst: z.string().min(8, "GST number is required"),
  address: z.string().min(4, "Address is required"),
  city: z.string().min(2, "City is required"),
  customerType: z.enum(["Dealer", "Business", "Retail"]),
  remarks: z.string().optional()
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
  const [userList, setUserList] = useState<User[]>(userSeed);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [editingQuotation, setEditingQuotation] = useState<Quotation | null | "new">(null);

  const isAdmin = currentUser?.role === "Admin";

  // Time- and storage-dependent state must resolve on the client only, so the
  // static-exported HTML and the first client render stay in sync.
  useEffect(() => {
    setMounted(true);
    setDemo(getDemoStatus());
    setCustomerList(loadState(STORAGE_KEYS.customers, customerSeed));
    setQuotationList(loadState(STORAGE_KEYS.quotations, quotationSeed));

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

  function addCustomer(customer: Customer) {
    setCustomerList((current) => {
      const next = [customer, ...current];
      saveState(STORAGE_KEYS.customers, next);
      return next;
    });
    setShowCustomerForm(false);
    toast(`${customer.companyName} added`);
  }

  function saveQuotation(quotation: Quotation) {
    const existed = quotationList.some((item) => item.quotationId === quotation.quotationId);
    setQuotationList((current) => {
      const next = existed ? current.map((item) => (item.quotationId === quotation.quotationId ? quotation : item)) : [quotation, ...current];
      saveState(STORAGE_KEYS.quotations, next);
      return next;
    });
    setEditingQuotation(null);
    toast(existed ? `${quotation.quotationNumber} updated` : `${quotation.quotationNumber} created`);
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
                onClick={() => setShowCustomerForm(true)}
              >
                <Plus className="h-4 w-4" />
                Add Customer
              </button>
            </div>
          </div>
        </header>

        <section className="p-4 lg:p-8">
          {activeModule === "dashboard" && <Dashboard customers={customerList} quotations={quotationList} />}
          {activeModule === "customers" && <CustomersView customers={customerList} query={globalSearch} />}
          {activeModule === "enquiries" && <EnquiriesView query={globalSearch} />}
          {activeModule === "products" && <ProductsView query={globalSearch} />}
          {activeModule === "quotations" && (
            <QuotationsView
              quotations={quotationList}
              customers={customerList}
              products={products}
              query={globalSearch}
              onEdit={(quotation) => setEditingQuotation(quotation)}
              onNew={() => setEditingQuotation("new")}
            />
          )}
          {activeModule === "orders" && <OrdersView query={globalSearch} />}
          {activeModule === "services" && <ServicesView query={globalSearch} />}
          {activeModule === "attendance" && <AttendanceView users={userList} records={attendance} onChange={updateAttendance} />}
          {activeModule === "payments" && <PaymentsView query={globalSearch} />}
          {activeModule === "users" && isAdmin && <UsersView users={userList} currentUserId={currentUser.id} onChange={updateUsers} />}
          {activeModule === "reports" && <ReportsView customers={customerList} quotations={quotationList} />}
          {activeModule === "settings" && <SettingsView users={userList} />}
        </section>
      </div>

      {showCustomerForm && (
        <CustomerModal onClose={() => setShowCustomerForm(false)} onCreate={addCustomer} />
      )}

      {editingQuotation !== null && (
        <QuotationModal
          quotation={editingQuotation === "new" ? null : editingQuotation}
          customers={customerList}
          products={products}
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

function Dashboard({ customers, quotations }: { customers: Customer[]; quotations: Quotation[] }) {
  const nameOf = (customerId: string) => customers.find((item) => item.customerId === customerId)?.companyName ?? customerName(customerId);
  const customersByMonth = [0, 1, 2, 3, 4, 5].map((month) => customers.filter((item) => new Date(item.createdAt).getMonth() === month).length);
  const quotationStatusLabels = ["Draft", "Sent", "Accepted", "Rejected"];
  const quotationsByStatus = quotationStatusLabels.map((status) => quotations.filter((item) => item.status === status).length);
  const stats = [
    { label: "Total Customers", value: customers.length, icon: Users },
    { label: "New Enquiries", value: enquiries.filter((item) => item.status === "New").length, icon: ClipboardList },
    { label: "Pending Follow-ups", value: enquiries.filter((item) => item.status === "Follow-up").length, icon: CalendarClock },
    { label: "Quotations Sent", value: quotations.filter((item) => item.status === "Sent").length, icon: FileText },
    { label: "Orders Received", value: orders.length, icon: BriefcaseBusiness },
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
        <Chart title="New Customers (Monthly)" values={customersByMonth} />
        <Chart title="Quotations by Status" values={quotationsByStatus} labels={quotationStatusLabels} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Latest Customers">
          <SimpleRows rows={customers.slice(0, 5).map((item) => [item.companyName, item.city, item.customerType])} />
        </Panel>
        <Panel title="Upcoming Follow-ups">
          <SimpleRows rows={enquiries.slice(0, 5).map((item) => [customerName(item.customerId), item.product, shortDate(item.followupDate)])} />
        </Panel>
        <Panel title="Recent Quotations">
          <SimpleRows rows={quotations.slice(0, 5).map((item) => [item.quotationNumber, nameOf(item.customerId), currency(item.total)])} />
        </Panel>
        <Panel title="Recent Services">
          <SimpleRows rows={services.slice(0, 5).map((item) => [item.serviceNumber, item.complaint, item.status])} />
        </Panel>
      </div>
    </div>
  );
}

function CustomersView({ customers, query }: { customers: Customer[]; query: string }) {
  const [type, setType] = useState<CustomerType | "All">("All");
  const rows = customers.filter((customer) => {
    const haystack = `${customer.customerName} ${customer.companyName} ${customer.mobile} ${customer.city}`.toLowerCase();
    return haystack.includes(query.toLowerCase()) && (type === "All" || customer.customerType === type);
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {(["All", "Dealer", "Business", "Retail"] as const).map((item) => (
          <button
            key={item}
            onClick={() => setType(item)}
            className={cn("rounded-lg border px-4 py-2 text-sm font-semibold", type === item ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-700")}
          >
            {item}
          </button>
        ))}
      </div>
      <DataTable
        columns={["Customer", "Company", "Mobile", "City", "Type", "Created"]}
        rows={rows.map((item) => [
          item.customerName,
          item.companyName,
          item.mobile,
          item.city,
          <Badge key={item.customerId} label={item.customerType} />,
          shortDate(item.createdAt)
        ])}
      />
    </div>
  );
}

function EnquiriesView({ query }: { query: string }) {
  const rows = enquiries.filter((item) => `${item.enquiryNumber} ${customerName(item.customerId)} ${item.product}`.toLowerCase().includes(query.toLowerCase()));
  return <DataTable columns={["Enquiry", "Customer", "Product", "Source", "Follow-up", "Status"]} rows={rows.map((item) => [item.enquiryNumber, customerName(item.customerId), item.product, item.source, shortDate(item.followupDate), <Badge key={item.enquiryId} label={item.status} />])} />;
}

function ProductsView({ query }: { query: string }) {
  const rows = products.filter((item) => `${item.productName} ${item.category} ${item.modelNumber}`.toLowerCase().includes(query.toLowerCase()));
  return <DataTable columns={["Product", "Category", "Model", "Price", "Warranty"]} rows={rows.map((item) => [item.productName, item.category, item.modelNumber, currency(item.price), item.warranty])} />;
}

function QuotationsView({
  quotations,
  customers,
  products,
  query,
  onEdit,
  onNew
}: {
  quotations: Quotation[];
  customers: Customer[];
  products: Product[];
  query: string;
  onEdit: (quotation: Quotation) => void;
  onNew: () => void;
}) {
  const toast = useToast();
  const customerOf = (customerId: string) => customers.find((item) => item.customerId === customerId);
  const nameOf = (customerId: string) => customerOf(customerId)?.companyName ?? customerName(customerId);
  const rows = quotations.filter((item) => `${item.quotationNumber} ${nameOf(item.customerId)}`.toLowerCase().includes(query.toLowerCase()));

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
        columns={["Quotation", "Customer", "Subtotal", "GST", "Total", "Status", "Actions"]}
        rows={rows.map((item) => [
          item.quotationNumber,
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
          </div>
        ])}
      />
    </div>
  );
}

function OrdersView({ query }: { query: string }) {
  const rows = orders.filter((item) => `${item.orderNumber} ${customerName(item.customerId)}`.toLowerCase().includes(query.toLowerCase()));
  return <DataTable columns={["Order", "Customer", "Quotation", "Delivery", "Payment", "Status"]} rows={rows.map((item) => [item.orderNumber, customerName(item.customerId), item.quotationId, shortDate(item.deliveryDate), <Badge key={`${item.orderId}-pay`} label={item.paymentStatus} />, <Badge key={item.orderId} label={item.status} />])} />;
}

function ServicesView({ query }: { query: string }) {
  const rows = services.filter((item) => `${item.serviceNumber} ${customerName(item.customerId)} ${item.product}`.toLowerCase().includes(query.toLowerCase()));
  return <DataTable columns={["Service", "Customer", "Product", "Complaint", "Technician", "Status"]} rows={rows.map((item) => [item.serviceNumber, customerName(item.customerId), item.product, item.complaint, item.assignedTo, <Badge key={item.serviceId} label={item.status} />])} />;
}

function PaymentsView({ query }: { query: string }) {
  const rows = payments.filter((item) => `${item.invoiceNumber} ${customerName(item.customerId)}`.toLowerCase().includes(query.toLowerCase()));
  return <DataTable columns={["Invoice", "Customer", "Amount", "Paid", "Balance", "Status"]} rows={rows.map((item) => [item.invoiceNumber, customerName(item.customerId), currency(item.invoiceAmount), currency(item.paidAmount), currency(item.balanceAmount), <Badge key={item.paymentId} label={item.status} />])} />;
}

function ReportsView({ customers, quotations }: { customers: Customer[]; quotations: Quotation[] }) {
  const toast = useToast();
  const nameOf = (customerId: string) => customers.find((item) => item.customerId === customerId)?.companyName ?? customerName(customerId);
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const reports: { title: string; description: string; build: () => (string | number)[][] }[] = [
    {
      title: "Customer Report",
      description: "All customers with contact and GST details.",
      build: () => [["Company", "Contact", "Mobile", "City", "Type", "GST"], ...customers.map((c) => [c.companyName, c.customerName, c.mobile, c.city, c.customerType, c.gst])]
    },
    {
      title: "Enquiry Report",
      description: "Enquiries with source, follow-up and status.",
      build: () => [["Enquiry", "Customer", "Product", "Source", "Follow-up", "Status"], ...enquiries.map((e) => [e.enquiryNumber, nameOf(e.customerId), e.product, e.source, e.followupDate, e.status])]
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

function CustomerModal({ onClose, onCreate }: { onClose: () => void; onCreate: (customer: Customer) => void }) {
  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<CustomerForm>({
    resolver: zodResolver(customerSchema),
    defaultValues: { customerType: "Business" }
  });

  function submit(values: CustomerForm) {
    onCreate({
      customerId: `CUST-${Date.now()}`,
      createdAt: new Date().toISOString(),
      remarks: values.remarks ?? "",
      ...values
    });
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4">
      <form onSubmit={handleSubmit(submit)} className="max-h-[92vh] w-full max-w-3xl overflow-auto rounded-lg bg-white p-6 shadow-2xl">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold">Add Customer</h2>
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 p-2"><X className="h-5 w-5" /></button>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {([
            ["customerName", "Customer Name"],
            ["companyName", "Company Name"],
            ["mobile", "Mobile Number"],
            ["whatsapp", "WhatsApp Number"],
            ["email", "Email"],
            ["gst", "GST Number"],
            ["address", "Address"],
            ["city", "City"]
          ] as const).map(([name, label]) => (
            <label key={name} className="text-sm font-semibold text-slate-700">
              {label}
              <input className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 font-normal outline-none ring-blue-500 focus:ring-2" {...register(name)} />
              {errors[name] && <span className="mt-1 block text-xs text-red-600">{errors[name]?.message}</span>}
            </label>
          ))}
          <label className="text-sm font-semibold text-slate-700">
            Customer Type
            <select className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 font-normal outline-none ring-blue-500 focus:ring-2" {...register("customerType")}>
              <option>Dealer</option>
              <option>Business</option>
              <option>Retail</option>
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Remarks
            <input className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 font-normal outline-none ring-blue-500 focus:ring-2" {...register("remarks")} />
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
  return customer ? customer.companyName : customerId;
}
