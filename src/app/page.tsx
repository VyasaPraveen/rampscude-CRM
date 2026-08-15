"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  Boxes,
  BriefcaseBusiness,
  CalendarCheck,
  ChevronRight,
  ClipboardList,
  CreditCard,
  FileBarChart,
  FileText,
  Home,
  LogOut,
  Menu,
  Plus,
  ReceiptText,
  Search,
  Settings,
  Tag,
  ShieldCheck,
  Snowflake,
  UserCog,
  Users,
  Wrench,
  X
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useServiceWorker } from "@/hooks/use-service-worker";
import {
  brands as brandSeed,
  companySettings as settingsSeed,
  customers as customerSeed,
  invoices as invoiceSeed,
  leads as leadSeed,
  orders as orderSeed,
  payments as paymentSeed,
  products as productSeed,
  quotations as quotationSeed,
  services as serviceSeed,
  users as userSeed
} from "@/lib/seed-data";
import type { AttendanceRecord, Brand, CompanySettings, Customer, Invoice, Lead, LicenseRecord, Order, Payment, Product, Purchase, Quotation, ServiceRequest, User } from "@/types/crm";
import { cn } from "@/lib/utils";
import { computeTotals, rateForProduct } from "@/lib/gst";
import { syncOrdersFromCustomer, syncPaymentsFromCustomer } from "@/lib/orders";
import { evaluateLicense, licenseRecordFromKey, verifyLicenseKey, type LicenseStatus } from "@/lib/license";
import { LicenseScreen } from "@/components/license-screen";
import { downloadBackup, ensureDailyLocalBackup, lastManualBackupDay, markManualBackupToday, parseBackup } from "@/lib/backup";
import { Dashboard } from "@/components/dashboard-view";
import { useToast } from "@/components/toast";

// Each module's view is code-split so it downloads only when its tab is first
// opened. The Dashboard (default landing) stays eager to avoid a first-paint flash.
const viewLoading = () => <div className="h-40 animate-pulse rounded-lg border border-slate-200 bg-slate-100" aria-hidden />;
const SearchView = dynamic(() => import("@/components/search-view").then((m) => m.SearchView), { loading: viewLoading });
const CustomersView = dynamic(() => import("@/components/customers-view").then((m) => m.CustomersView), { loading: viewLoading });
const LeadsView = dynamic(() => import("@/components/leads-view").then((m) => m.LeadsView), { loading: viewLoading });
const InventoryView = dynamic(() => import("@/components/inventory-view").then((m) => m.InventoryView), { loading: viewLoading });
const BrandsView = dynamic(() => import("@/components/brands-view").then((m) => m.BrandsView), { loading: viewLoading });
const QuotationsView = dynamic(() => import("@/components/quotations-view").then((m) => m.QuotationsView), { loading: viewLoading });
const OrdersView = dynamic(() => import("@/components/orders-view").then((m) => m.OrdersView), { loading: viewLoading });
const InvoicesView = dynamic(() => import("@/components/invoices-view").then((m) => m.InvoicesView), { loading: viewLoading });
const ServicesView = dynamic(() => import("@/components/services-view").then((m) => m.ServicesView), { loading: viewLoading });
const AttendanceView = dynamic(() => import("@/components/attendance-view").then((m) => m.AttendanceView), { loading: viewLoading });
const PaymentsView = dynamic(() => import("@/components/payments-view").then((m) => m.PaymentsView), { loading: viewLoading });
const UsersView = dynamic(() => import("@/components/users-view").then((m) => m.UsersView), { loading: viewLoading });
const ReportsView = dynamic(() => import("@/components/reports-view").then((m) => m.ReportsView), { loading: viewLoading });
const SettingsView = dynamic(() => import("@/components/settings-view").then((m) => m.SettingsView), { loading: viewLoading });
// Modals load on user action; no skeleton is needed for the brief fetch.
const QuotationModal = dynamic(() => import("@/components/quotation-modal").then((m) => m.QuotationModal));
const CustomerModal = dynamic(() => import("@/components/customer-modal").then((m) => m.CustomerModal));
import { STORAGE_KEYS, ensureDataVersion, loadState, saveState } from "@/lib/storage";
import { upgradeStoredPasswords, verifyPassword } from "@/lib/password";
import { onSyncStatus, persist, pushDoc, subscribeWorkspace, type SyncStatus } from "@/lib/sync";
import { APP_VERSION } from "@/lib/version";

type ModuleId =
  | "dashboard"
  | "search"
  | "customers"
  | "leads"
  | "inventory"
  | "brands"
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
  { id: "brands", label: "Brands", icon: Tag, adminOnly: true },
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

/** How each sync state is presented in the header. */
const SYNC_LABELS: Record<SyncStatus, { label: string; hint: string; tone: string; dot: string }> = {
  live: {
    label: "Synced",
    hint: "Data is shared live across every device signed into this workspace.",
    tone: "border-green-200 bg-green-50 text-green-700",
    dot: "bg-green-500"
  },
  connecting: {
    label: "Connecting…",
    hint: "Contacting the sync service.",
    tone: "border-amber-200 bg-amber-50 text-amber-700",
    dot: "animate-pulse bg-amber-500"
  },
  error: {
    label: "Not synced",
    hint: "Cloud sync is unavailable — changes are saved on this device only.",
    tone: "border-red-200 bg-red-50 text-red-700",
    dot: "bg-red-500"
  },
  disabled: {
    label: "Offline",
    hint: "Cloud sync is not configured — changes are saved on this device only.",
    tone: "border-slate-200 bg-white text-slate-500",
    dot: "bg-slate-400"
  }
};

/** Enquiry types that warrant an automatic draft quotation. */
const QUOTABLE_ENQUIRIES: Lead["source"][] = ["Product Enquiry", "Price Enquiry", "Dummy Quotation"];

const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "Use at least 6 characters")
});

/** Next display sequence from a list of numbered strings — uses the max trailing number,
 *  so deleting a record never reuses an existing human-facing number. */
function nextNumber(existing: string[]): number {
  return (
    existing.reduce((max, value) => {
      const match = /(\d+)\s*$/.exec(value);
      return match ? Math.max(max, Number(match[1])) : max;
    }, 0) + 1
  );
}

export default function Page() {
  useServiceWorker();
  const toast = useToast();
  const [mounted, setMounted] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("connecting");
  const latest = useRef<Record<string, unknown>>({});
  const currentUserRef = useRef<User | null>(null);
  // Kept in a ref so the mount-only effect never needs `toast` as a dependency.
  const toastRef = useRef(toast);
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
  const [brandList, setBrandList] = useState<Brand[]>(brandSeed);
  const [settings, setSettings] = useState<CompanySettings>(settingsSeed);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  // Yearly licence gate. `licenseStatus` starts "checking" so we never flash the
  // lock screen before the stored/synced licence has been evaluated.
  const [license, setLicense] = useState<LicenseRecord | null>(null);
  const [licenseStatus, setLicenseStatus] = useState<LicenseStatus>("checking");
  const licenseResolvedRef = useRef(false);
  // Daily-backup nudge: "failed" = today's local snapshot could not be written;
  // "reminder" = no off-device copy downloaded today; null = nothing to show.
  const [backupNotice, setBackupNotice] = useState<"failed" | "reminder" | null>(null);
  // Tracks leads currently being converted, to make convert idempotent against double-clicks.
  const convertingRef = useRef<Set<string>>(new Set());
  const [editingCustomer, setEditingCustomer] = useState<Customer | null | "new">(null);
  const [editingQuotation, setEditingQuotation] = useState<Quotation | null | "new">(null);

  const isAdmin = currentUser?.role === "Admin";

  /** Save a module: local cache now, cloud in the background, and tell the user if either fails. */
  function store<T>(key: string, value: T): boolean {
    const { local, cloud } = persist(key, value);
    if (!local) toast("Could not save on this device — browser storage is full.", "info");
    void cloud.then((result) => {
      if (result === "too-large") {
        toast("This module is too large to sync. Archive or export old records.", "info");
      } else if (result === "failed") {
        toast("Saved on this device, but not synced to the cloud.", "info");
      }
    });
    return local;
  }

  // Mirror the latest lists into a ref so remote snapshots can be compared against
  // what this device currently holds without reading stale closure state.
  useEffect(() => {
    latest.current = {
      [STORAGE_KEYS.customers]: customerList,
      [STORAGE_KEYS.quotations]: quotationList,
      [STORAGE_KEYS.inventory]: inventory,
      [STORAGE_KEYS.leads]: leadList,
      [STORAGE_KEYS.invoices]: invoiceList,
      [STORAGE_KEYS.orders]: orderList,
      [STORAGE_KEYS.services]: serviceList,
      [STORAGE_KEYS.payments]: paymentList,
      [STORAGE_KEYS.brands]: brandList,
      [STORAGE_KEYS.users]: userList,
      [STORAGE_KEYS.attendance]: attendance,
      [STORAGE_KEYS.settings]: settings
    };
    currentUserRef.current = currentUser;
    toastRef.current = toast;
  });

  // Reflect the real connection state rather than assuming success.
  useEffect(() => onSyncStatus((next) => setSyncStatus(next)), []);

  // Time- and storage-dependent state must resolve on the client only, so the
  // static-exported HTML and the first client render stay in sync.
  useEffect(() => {
    setMounted(true);
    // Discard data stored by an earlier build before reading anything back.
    ensureDataVersion();
    // Local cache first so the UI paints instantly, then Firestore streams the
    // shared workspace over the top and keeps every device in step.
    const cached: Record<string, unknown> = {
      [STORAGE_KEYS.customers]: loadState(STORAGE_KEYS.customers, customerSeed),
      [STORAGE_KEYS.quotations]: loadState(STORAGE_KEYS.quotations, quotationSeed),
      [STORAGE_KEYS.inventory]: loadState(STORAGE_KEYS.inventory, productSeed),
      [STORAGE_KEYS.leads]: loadState(STORAGE_KEYS.leads, leadSeed),
      [STORAGE_KEYS.invoices]: loadState(STORAGE_KEYS.invoices, invoiceSeed),
      [STORAGE_KEYS.orders]: loadState(STORAGE_KEYS.orders, orderSeed),
      [STORAGE_KEYS.services]: loadState(STORAGE_KEYS.services, serviceSeed),
      [STORAGE_KEYS.payments]: loadState(STORAGE_KEYS.payments, paymentSeed),
      [STORAGE_KEYS.brands]: loadState(STORAGE_KEYS.brands, brandSeed),
      [STORAGE_KEYS.users]: loadState(STORAGE_KEYS.users, userSeed),
      [STORAGE_KEYS.attendance]: loadState<AttendanceRecord[]>(STORAGE_KEYS.attendance, []),
      [STORAGE_KEYS.settings]: { ...settingsSeed, ...loadState<Partial<CompanySettings>>(STORAGE_KEYS.settings, {}) },
      [STORAGE_KEYS.license]: loadState<LicenseRecord | null>(STORAGE_KEYS.license, null)
    };

    // Evaluate a licence record now and reflect it in the gate. Marks the licence
    // as resolved so the "checking" screen can give way to the app or lock screen.
    const resolveLicense = (record: LicenseRecord | null) => {
      void evaluateLicense(record, Date.now()).then((status) => {
        licenseResolvedRef.current = true;
        setLicense(record);
        setLicenseStatus(status);
      });
    };

    const users = cached[STORAGE_KEYS.users] as User[];
    setCustomerList(cached[STORAGE_KEYS.customers] as Customer[]);
    setQuotationList(cached[STORAGE_KEYS.quotations] as Quotation[]);
    setInventory(cached[STORAGE_KEYS.inventory] as Product[]);
    setLeadList(cached[STORAGE_KEYS.leads] as Lead[]);
    setInvoiceList(cached[STORAGE_KEYS.invoices] as Invoice[]);
    setOrderList(cached[STORAGE_KEYS.orders] as Order[]);
    setServiceList(cached[STORAGE_KEYS.services] as ServiceRequest[]);
    setPaymentList(cached[STORAGE_KEYS.payments] as Payment[]);
    setBrandList(cached[STORAGE_KEYS.brands] as Brand[]);
    setAttendance(cached[STORAGE_KEYS.attendance] as AttendanceRecord[]);
    setSettings(cached[STORAGE_KEYS.settings] as CompanySettings);
    setUserList(users);

    // Evaluate the cached licence immediately. If there is none cached, stay in the
    // "checking" state until the initial sync delivers it (or reports it missing),
    // so a device that will receive its licence from the server never flashes the
    // lock screen.
    const cachedLicense = cached[STORAGE_KEYS.license] as LicenseRecord | null;
    if (cachedLicense) resolveLicense(cachedLicense);

    // Automatic daily local backup + reminder. A snapshot is written once a day; if
    // that fails (storage blocked) we warn, otherwise we nudge for an off-device copy.
    const backupResult = ensureDailyLocalBackup(cached);
    if (backupResult === "failed") setBackupNotice("failed");
    else if (lastManualBackupDay() !== new Date().toISOString().slice(0, 10)) setBackupNotice("reminder");

    // Restore the session from the LIVE user record (not the stored snapshot) so a
    // removed, deactivated, or role-changed account cannot linger via localStorage.
    const session = loadState<User | null>(STORAGE_KEYS.auth, null);
    const restored = session ? users.find((user) => user.id === session.id && user.status === "Active") ?? null : null;
    setCurrentUser(restored);
    if (session) saveState(STORAGE_KEYS.auth, restored);

    // Apply a remote change: update state and refresh the offline cache, but do not
    // write back to Firestore — that would echo the change straight back out.
    const applyRemote = (key: string, value: unknown) => {
      // A remote wipe (empty list) must not destroy data this device still holds —
      // republish instead. Real deletions arrive as a non-empty list or an explicit save.
      const current = latest.current[key];
      if (Array.isArray(value) && value.length === 0 && Array.isArray(current) && current.length > 0) {
        void pushDoc(key, current);
        return;
      }
      saveState(key, value);
      switch (key) {
        case STORAGE_KEYS.customers:
          setCustomerList(value as Customer[]);
          break;
        case STORAGE_KEYS.quotations:
          setQuotationList(value as Quotation[]);
          break;
        case STORAGE_KEYS.inventory:
          setInventory(value as Product[]);
          break;
        case STORAGE_KEYS.leads:
          setLeadList(value as Lead[]);
          break;
        case STORAGE_KEYS.invoices:
          setInvoiceList(value as Invoice[]);
          break;
        case STORAGE_KEYS.orders:
          setOrderList(value as Order[]);
          break;
        case STORAGE_KEYS.services:
          setServiceList(value as ServiceRequest[]);
          break;
        case STORAGE_KEYS.payments:
          setPaymentList(value as Payment[]);
          break;
        case STORAGE_KEYS.brands:
          setBrandList(value as Brand[]);
          break;
        case STORAGE_KEYS.users: {
          const nextUsers = value as User[];
          setUserList(nextUsers);
          // An admin on another device may have deactivated or removed this account.
          const signedIn = currentUserRef.current;
          if (signedIn) {
            const live = nextUsers.find((user) => user.id === signedIn.id && user.status === "Active") ?? null;
            setCurrentUser(live);
            saveState(STORAGE_KEYS.auth, live);
            if (!live) toastRef.current("Your account was changed by an administrator. Please sign in again.", "info");
          }
          break;
        }
        case STORAGE_KEYS.attendance:
          setAttendance(value as AttendanceRecord[]);
          break;
        case STORAGE_KEYS.settings:
          setSettings({ ...settingsSeed, ...(value as Partial<CompanySettings>) });
          break;
        case STORAGE_KEYS.license:
          resolveLicense(value as LicenseRecord | null);
          break;
        default:
          break;
      }
    };

    // Replace any plaintext credentials with PBKDF2 hashes. Apply the hashes on top
    // of whatever users we currently hold — the initial sync may have added accounts
    // created on other devices since mount — and save LOCALLY ONLY. Pushing here
    // would republish this device's possibly stale/seed list (e.g. a phone sitting on
    // the login screen holds just the seed admin) and delete users created elsewhere.
    void upgradeStoredPasswords(users).then((upgraded) => {
      if (upgraded === users) return;
      const hashedById = new Map(upgraded.map((user) => [user.id, user]));
      setUserList((currentUsers) => {
        const merged = currentUsers.map((user) => hashedById.get(user.id) ?? user);
        saveState(STORAGE_KEYS.users, merged);
        return merged;
      });
    });

    const unsubscribe = subscribeWorkspace(Object.keys(cached), applyRemote, (key) => {
      // The workspace has no row for this key yet. The licence is never auto-created
      // (an unlicensed install must show the activation screen); everything else this
      // device holds is published to seed a fresh workspace.
      if (key === STORAGE_KEYS.license) {
        if (!licenseResolvedRef.current) {
          licenseResolvedRef.current = true;
          setLicenseStatus("unlicensed");
        }
        return;
      }
      void pushDoc(key, cached[key]);
    });

    // Offline / sync error: nothing will resolve the licence, so fall back to the
    // cached verdict (unlicensed when there is no cache) rather than hang on "checking".
    const licenseTimer = setTimeout(() => {
      if (!licenseResolvedRef.current) {
        licenseResolvedRef.current = true;
        setLicenseStatus((current) => (current === "checking" ? "unlicensed" : current));
      }
    }, 12_000);

    return () => {
      unsubscribe();
      clearTimeout(licenseTimer);
    };
  }, []);

  /** Authenticate against the users list: email must exist, password must match, account must be active. */
  async function handleLogin(values: z.infer<typeof loginSchema>): Promise<{ ok: boolean; error?: string }> {
    const email = values.email.trim().toLowerCase();
    // Trim the password the same way user-creation does, so a stray leading/trailing
    // space typed here never reads as a wrong password.
    const password = values.password.trim();
    const match = userList.find((user) => user.email.trim().toLowerCase() === email);
    // Split the two failure modes: a missing account is usually a typo or a not-yet-
    // synced staff record, which is far more actionable than a blanket "wrong password".
    if (!match) {
      const hint = syncStatus === "live" ? "" : " If this account was just created on another device, wait for the “Synced” indicator and try again.";
      return { ok: false, error: `No account found for this email.${hint}` };
    }
    if (match.status === "Inactive") {
      return { ok: false, error: "This account is inactive. Contact your administrator." };
    }
    if (!(await verifyPassword(match, password))) {
      return { ok: false, error: "Incorrect password. Please try again." };
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

  /** Activate or renew the licence from a vendor key. Stored (locked) in the synced
   *  workspace so it applies to every device and cannot be removed — only renewed. */
  async function activateLicense(rawKey: string): Promise<string | null> {
    const verified = await verifyLicenseKey(rawKey);
    if (!verified) return "Invalid licence key. Please check it and try again.";
    const record = licenseRecordFromKey(rawKey, verified.from, verified.until, new Date().toISOString());
    const status = await evaluateLicense(record, Date.now());
    if (status === "expired") return "This key has already expired. Please enter a current renewal key.";
    // Do not let a wrong key shorten an existing term.
    if (license && new Date(record.validUntil).getTime() < new Date(license.validUntil).getTime()) {
      return "This key ends earlier than the licence already active. Enter the latest renewal key.";
    }
    licenseResolvedRef.current = true;
    setLicense(record);
    setLicenseStatus(status);
    store(STORAGE_KEYS.license, record);
    toast("Licence activated.");
    return null;
  }

  /** Current per-module data, for a backup file. */
  function snapshotData(): Record<string, unknown> {
    return {
      [STORAGE_KEYS.customers]: customerList,
      [STORAGE_KEYS.quotations]: quotationList,
      [STORAGE_KEYS.inventory]: inventory,
      [STORAGE_KEYS.leads]: leadList,
      [STORAGE_KEYS.invoices]: invoiceList,
      [STORAGE_KEYS.orders]: orderList,
      [STORAGE_KEYS.services]: serviceList,
      [STORAGE_KEYS.payments]: paymentList,
      [STORAGE_KEYS.brands]: brandList,
      [STORAGE_KEYS.users]: userList,
      [STORAGE_KEYS.attendance]: attendance,
      [STORAGE_KEYS.settings]: settings,
      [STORAGE_KEYS.license]: license
    };
  }

  /** Download an off-device backup file and clear the daily reminder. */
  function downloadBackupNow() {
    const name = downloadBackup(snapshotData());
    markManualBackupToday();
    setBackupNotice(null);
    toast(`Backup downloaded: ${name}`);
  }

  /** Restore every module from an uploaded backup file (overwrites current data). */
  function restoreBackup(text: string): boolean {
    const modules = parseBackup(text);
    if (!modules) {
      toast("That file is not a valid Ramps Cube backup.", "info");
      return false;
    }
    const apply = <T,>(key: string, setter: (value: T) => void) => {
      if (key in modules) {
        const value = modules[key] as T;
        setter(value);
        store(key, value);
      }
    };
    apply<Customer[]>(STORAGE_KEYS.customers, setCustomerList);
    apply<Quotation[]>(STORAGE_KEYS.quotations, setQuotationList);
    apply<Product[]>(STORAGE_KEYS.inventory, setInventory);
    apply<Lead[]>(STORAGE_KEYS.leads, setLeadList);
    apply<Invoice[]>(STORAGE_KEYS.invoices, setInvoiceList);
    apply<Order[]>(STORAGE_KEYS.orders, setOrderList);
    apply<ServiceRequest[]>(STORAGE_KEYS.services, setServiceList);
    apply<Payment[]>(STORAGE_KEYS.payments, setPaymentList);
    apply<Brand[]>(STORAGE_KEYS.brands, setBrandList);
    apply<User[]>(STORAGE_KEYS.users, setUserList);
    apply<AttendanceRecord[]>(STORAGE_KEYS.attendance, setAttendance);
    apply<CompanySettings>(STORAGE_KEYS.settings, (value) => setSettings({ ...settingsSeed, ...value }));
    toast("Backup restored to this workspace.");
    return true;
  }

  function saveCustomer(customer: Customer) {
    const existed = customerList.some((item) => item.customerId === customer.customerId);
    const next = existed ? customerList.map((item) => (item.customerId === customer.customerId ? customer : item)) : [customer, ...customerList];
    setCustomerList(next);
    store(STORAGE_KEYS.customers, next);
    // A customer's purchases/payment details are mirrored into Orders and Payments so
    // they stay in sync whenever the customer is added or edited (and orphaned mirror
    // records are pruned when a purchase is removed).
    const nextOrders = syncOrdersFromCustomer(customer, orderList);
    setOrderList(nextOrders);
    store(STORAGE_KEYS.orders, nextOrders);
    const nextPayments = syncPaymentsFromCustomer(customer, paymentList);
    setPaymentList(nextPayments);
    store(STORAGE_KEYS.payments, nextPayments);
    setEditingCustomer(null);
    toast(existed ? `${customer.customerName} updated` : `${customer.customerName} added`);
  }

  function deleteCustomer(customer: Customer) {
    const next = customerList.filter((item) => item.customerId !== customer.customerId);
    setCustomerList(next);
    store(STORAGE_KEYS.customers, next);
    toast(`${customer.customerName} removed`, "info");
  }

  function deleteCustomers(ids: string[]) {
    const set = new Set(ids);
    const next = customerList.filter((item) => !set.has(item.customerId));
    const removed = customerList.length - next.length;
    setCustomerList(next);
    store(STORAGE_KEYS.customers, next);
    toast(`${removed} customer${removed === 1 ? "" : "s"} removed`, "info");
  }

  /** Undo a conversion: move a customer back into Leads (restoring the original lead
   *  if there is one, else recreating one from the customer's details). */
  function revertCustomerToLead(customer: Customer) {
    const hadLead = leadList.some((l) => l.convertedCustomerId === customer.customerId);
    const nextLeads: Lead[] = hadLead
      ? leadList.map((l) => (l.convertedCustomerId === customer.customerId ? { ...l, convertedCustomerId: undefined, status: "Follow-up" as const } : l))
      : [
          {
            leadId: `LEAD-${Date.now()}`,
            leadNumber: `RC-LEAD-2026-${String(nextNumber(leadList.map((l) => l.leadNumber))).padStart(3, "0")}`,
            name: customer.customerName,
            town: customer.city,
            phone: customer.mobile,
            source: "Product Enquiry",
            description: "",
            status: "Follow-up",
            address: customer.address,
            email: customer.email,
            productBrand: customer.productBrand,
            productModel: customer.productModel,
            productType: customer.productType,
            sourceType: customer.sourceType,
            createdAt: new Date().toISOString()
          },
          ...leadList
        ];
    setLeadList(nextLeads);
    store(STORAGE_KEYS.leads, nextLeads);

    const nextCustomers = customerList.filter((c) => c.customerId !== customer.customerId);
    setCustomerList(nextCustomers);
    store(STORAGE_KEYS.customers, nextCustomers);

    // Remove the mirror Orders/Payments this customer's purchases created; leave any
    // manually-added ones so nothing entered by hand is lost.
    const nextOrders = orderList.filter((o) => !(o.customerId === customer.customerId && o.purchaseId));
    setOrderList(nextOrders);
    store(STORAGE_KEYS.orders, nextOrders);
    const nextPayments = paymentList.filter((p) => !(p.customerId === customer.customerId && p.purchaseId));
    setPaymentList(nextPayments);
    store(STORAGE_KEYS.payments, nextPayments);

    toast(`${customer.customerName} moved back to Leads`, "info");
  }

  /** Bulk-add imported customers, skipping any whose phone already exists (no duplicates). */
  function importCustomers(rows: Customer[]) {
    const existingPhones = new Set(customerList.map((c) => c.mobile.replace(/\D/g, "")).filter(Boolean));
    const fresh: Customer[] = [];
    let skipped = 0;
    rows.forEach((row) => {
      const phone = row.mobile.replace(/\D/g, "");
      if (phone && existingPhones.has(phone)) {
        skipped += 1;
        return;
      }
      if (phone) existingPhones.add(phone);
      fresh.push(row);
    });
    if (fresh.length === 0) {
      toast(`No new customers — ${skipped} already present.`, "info");
      return;
    }
    const next = [...fresh, ...customerList];
    setCustomerList(next);
    store(STORAGE_KEYS.customers, next);
    toast(`Imported ${fresh.length} customer${fresh.length === 1 ? "" : "s"}${skipped ? ` · ${skipped} duplicate${skipped === 1 ? "" : "s"} skipped` : ""}`);
  }

  function updateInventory(next: Product[]) {
    setInventory(next);
    store(STORAGE_KEYS.inventory, next);
  }

  function updateBrands(next: Brand[]) {
    // A rename must cascade, otherwise stock/customers/leads keep pointing at the old
    // brand string and the "in use" delete guard silently stops protecting it.
    const renames = new Map<string, string>();
    next.forEach((brand) => {
      const before = brandList.find((item) => item.brandId === brand.brandId);
      if (before && before.name !== brand.name) renames.set(before.name, brand.name);
    });
    if (renames.size) {
      const remap = (value?: string) => (value && renames.has(value) ? renames.get(value) as string : value);
      const nextInventory = inventory.map((p) => ({ ...p, brand: remap(p.brand) ?? p.brand }));
      const nextCustomers = customerList.map((c) => ({ ...c, productBrand: remap(c.productBrand) ?? c.productBrand }));
      const nextLeads = leadList.map((l) => ({ ...l, productBrand: remap(l.productBrand) }));
      setInventory(nextInventory);
      store(STORAGE_KEYS.inventory, nextInventory);
      setCustomerList(nextCustomers);
      store(STORAGE_KEYS.customers, nextCustomers);
      setLeadList(nextLeads);
      store(STORAGE_KEYS.leads, nextLeads);
    }
    setBrandList(next);
    store(STORAGE_KEYS.brands, next);
  }

  function updateSettings(next: CompanySettings): boolean {
    setSettings(next);
    return store(STORAGE_KEYS.settings, next);
  }

  function updateLeads(next: Lead[]) {
    setLeadList(next);
    store(STORAGE_KEYS.leads, next);
  }

  // When a new lead is created, auto-generate a draft quotation from its interest so
  // sales can follow up immediately. Matches the lead's brand/model to inventory.
  function createQuotationFromLead(lead: Lead): Quotation | undefined {
    // Only enquiries that imply a price get an auto-quotation; a service or resale
    // enquiry should not produce a product quote.
    if (!QUOTABLE_ENQUIRIES.includes(lead.source)) return undefined;
    // Quote only what the lead actually asked about — never an arbitrary stock item.
    const product =
      inventory.find((p) => p.brand === lead.productBrand && p.model === lead.productModel) ??
      inventory.find((p) => p.brand === lead.productBrand && lead.productBrand);
    const quoted = typeof lead.quotedPrice === "number" && lead.quotedPrice > 0 ? lead.quotedPrice : undefined;
    const label = [lead.productBrand, lead.productModel].filter(Boolean).join(" ").trim();
    // Prefer a matching stock item; otherwise carry the lead's product as a labelled
    // line (needs a quoted price, since there is no stock price to fall back on).
    let line: { productId: string; quantity: number; price: number; gstRate?: number; label?: string };
    if (product) {
      line = { productId: product.productId, quantity: 1, price: quoted ?? product.price, gstRate: rateForProduct(product, brandList, settings) };
    } else if (label && quoted) {
      const brand = brandList.find((b) => b.name === lead.productBrand);
      line = { productId: `LEAD:${label}`, label, quantity: 1, price: quoted, gstRate: brand?.gstRate ?? settings.gstRate };
    } else {
      return undefined; // nothing concrete to quote yet
    }
    const { taxable, gst, total } = computeTotals([line], 0, () => line.gstRate ?? settings.gstRate);
    const quotation: Quotation = {
      quotationId: `QUO-${Date.now()}`,
      quotationNumber: `RC/QTN/2026/${String(nextNumber(quotationList.map((q) => q.quotationNumber))).padStart(3, "0")}`,
      reference: lead.leadNumber,
      leadId: lead.leadId,
      customerLabel: lead.name,
      customerId: "",
      products: [line],
      subtotal: taxable,
      discount: 0,
      gst,
      total,
      status: "Draft",
      brochureUrl: lead.brochureUrl,
      createdAt: new Date().toISOString()
    };
    const next = [quotation, ...quotationList];
    setQuotationList(next);
    store(STORAGE_KEYS.quotations, next);
    toast(`Quotation ${quotation.quotationNumber} auto-created for ${lead.name}`);
    return quotation;
  }

  // Convert a lead into a customer, carrying over all shared fields. If a customer with the
  // same phone already exists it is linked instead of duplicated. The lead's auto-quotation is
  // re-linked to the customer, an order is opened automatically, and the lead is marked converted.
  function convertLead(lead: Lead, createdQuotation?: Quotation) {
    if (lead.convertedCustomerId || convertingRef.current.has(lead.leadId)) {
      if (lead.convertedCustomerId) toast(`${lead.name} is already a customer`, "info");
      return;
    }
    convertingRef.current.add(lead.leadId);
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
      store(STORAGE_KEYS.customers, nextCustomers);
    }

    // Re-link the lead's auto-generated quotation to the new customer. A quotation created
    // earlier in this same event is passed in, since `quotationList` has not re-rendered yet.
    const leadQuotation = createdQuotation ?? quotationList.find((q) => q.leadId === lead.leadId);
    if (leadQuotation) {
      const linked: Quotation = { ...leadQuotation, customerId: customer.customerId, customerLabel: undefined };
      const inList = quotationList.some((q) => q.quotationId === leadQuotation.quotationId);
      const nextQuotations = inList
        ? quotationList.map((q) => (q.quotationId === leadQuotation.quotationId ? linked : q))
        : [linked, ...quotationList];
      setQuotationList(nextQuotations);
      store(STORAGE_KEYS.quotations, nextQuotations);
    }

    // Open an order only when there is a quotation behind it — an order with no
    // products or value is noise in the Orders module.
    let order: Order | undefined;
    if (leadQuotation) {
      const deliveryDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      // Carry the lead's product and quoted price straight onto the order — no re-entry.
      const productLabel = [lead.productBrand, lead.productModel].filter(Boolean).join(" ").trim();
      const amount = leadQuotation.total || (typeof lead.quotedPrice === "number" ? lead.quotedPrice : undefined);
      order = {
        orderId: `ORD-${Date.now()}`,
        orderNumber: `RC-ORD-2026-${String(nextNumber(orderList.map((o) => o.orderNumber))).padStart(3, "0")}`,
        quotationId: leadQuotation.quotationId,
        customerId: customer.customerId,
        deliveryDate,
        paymentStatus: "Pending",
        status: "Processing",
        productLabel: productLabel || undefined,
        amount,
        createdAt: new Date().toISOString()
      };
      const nextOrders = [order, ...orderList];
      setOrderList(nextOrders);
      store(STORAGE_KEYS.orders, nextOrders);
    }

    // Upsert using the passed lead: when convert is triggered by a status change the
    // edited lead is not in `leadList` yet, and a brand-new lead may not be there at all.
    const merged: Lead = { ...lead, convertedCustomerId: customer.customerId, status: "Order Confirmed" };
    const known = leadList.some((item) => item.leadId === lead.leadId);
    const nextLeads = known ? leadList.map((item) => (item.leadId === lead.leadId ? merged : item)) : [merged, ...leadList];
    setLeadList(nextLeads);
    store(STORAGE_KEYS.leads, nextLeads);
    toast(`${lead.name} ${existing ? "linked to existing customer" : "converted to customer"}${order ? ` · order ${order.orderNumber} created` : ""}`);
  }

  function updateInvoices(next: Invoice[]) {
    setInvoiceList(next);
    store(STORAGE_KEYS.invoices, next);
  }

  function updateOrders(next: Order[]) {
    // Orders is a first-class money entry point: an order's price/advance is written
    // onto the customer's purchase so the customer balance and the Payments module
    // stay in step — the client enters it once in Orders and it reflects everywhere.
    // An order carrying money that isn't linked to a purchase yet creates one.
    let customers = customerList;
    const affected = new Set<string>();
    let changed = false;
    const linkedOrders = next.map((order) => {
      if (!order.customerId) return order;
      const hasMoney = (order.amount ?? 0) > 0 || (order.advancePaid ?? 0) > 0;
      if (!order.purchaseId && !hasMoney) return order; // status-only order — nothing to sync
      const owner = order.purchaseId
        ? customers.find((c) => (c.purchases ?? []).some((p) => p.purchaseId === order.purchaseId))
        : undefined;
      const customer = owner ?? customers.find((c) => c.customerId === order.customerId);
      if (!customer) return order;
      const purchaseId = order.purchaseId ?? `PUR-${Date.now()}-${Math.floor(Math.random() * 1e4)}`;
      const existingPurchase = (customer.purchases ?? []).find((p) => p.purchaseId === purchaseId);
      const price = Math.max(0, order.amount ?? 0);
      const advancePaid = Math.min(price, Math.max(0, order.advancePaid ?? 0));
      const dueDate = order.deliveryDate || existingPurchase?.dueDate || undefined;
      const paymentMode = order.paymentMode ?? existingPurchase?.paymentMode;
      const same =
        existingPurchase &&
        (existingPurchase.price || 0) === price &&
        (existingPurchase.advancePaid || 0) === advancePaid &&
        (existingPurchase.dueDate ?? "") === (dueDate ?? "") &&
        (existingPurchase.paymentMode ?? "") === (paymentMode ?? "");
      if (same) return { ...order, purchaseId };
      changed = true;
      affected.add(customer.customerId);
      const merged: Purchase = {
        ...(existingPurchase ?? { purchaseId, createdAt: order.createdAt ?? new Date().toISOString() }),
        price,
        advancePaid,
        dueDate,
        paymentMode,
        // Only stamp the product identity when this order is *creating* the purchase,
        // so a money-only edit never mangles an existing brand/model on the customer.
        productModel: existingPurchase ? existingPurchase.productModel : order.productLabel || undefined
      };
      customers = customers.map((c) =>
        c.customerId === customer.customerId
          ? {
              ...c,
              purchases: existingPurchase
                ? (c.purchases ?? []).map((p) => (p.purchaseId === purchaseId ? merged : p))
                : [...(c.purchases ?? []), merged]
            }
          : c
      );
      return { ...order, purchaseId };
    });

    if (!changed) {
      setOrderList(next);
      store(STORAGE_KEYS.orders, next);
      return;
    }
    setCustomerList(customers);
    store(STORAGE_KEYS.customers, customers);
    // Re-derive Orders and the payment mirrors from the affected customers so all three
    // modules are canonical and consistent (idempotent — no oscillation).
    let orders = linkedOrders;
    let payments = paymentList;
    customers.forEach((c) => {
      if (!affected.has(c.customerId)) return;
      orders = syncOrdersFromCustomer(c, orders);
      payments = syncPaymentsFromCustomer(c, payments);
    });
    setOrderList(orders);
    store(STORAGE_KEYS.orders, orders);
    setPaymentList(payments);
    store(STORAGE_KEYS.payments, payments);
  }

  function updateServices(next: ServiceRequest[]) {
    setServiceList(next);
    store(STORAGE_KEYS.services, next);
  }

  function updatePayments(next: Payment[]) {
    // A payment recorded/updated here is written onto the customer's purchase so the
    // customer's balance, their order and the payment mirror always agree — the client
    // enters it once in Payments and it reflects everywhere. A payment that introduces
    // a purchase the customer doesn't have yet (a fresh "Record Payment") creates one.
    let customers = customerList;
    const affected = new Set<string>();
    let changed = false;
    next.forEach((pay) => {
      if (!pay.purchaseId || !pay.customerId) return;
      const owner = customers.find((c) => (c.purchases ?? []).some((p) => p.purchaseId === pay.purchaseId));
      if (owner) {
        const purchase = owner.purchases?.find((p) => p.purchaseId === pay.purchaseId);
        if (!purchase) return;
        const same =
          (purchase.price || 0) === (pay.invoiceAmount || 0) &&
          (purchase.advancePaid || 0) === (pay.paidAmount || 0) &&
          (purchase.dueDate ?? "") === (pay.dueDate ?? "") &&
          (purchase.paymentMode ?? "") === (pay.paymentMode ?? "");
        if (same) return;
        changed = true;
        affected.add(owner.customerId);
        const updated: Purchase = {
          ...purchase,
          price: pay.invoiceAmount || 0,
          advancePaid: Math.min(pay.invoiceAmount || 0, pay.paidAmount || 0),
          dueDate: pay.dueDate || undefined,
          paymentMode: pay.paymentMode
        };
        customers = customers.map((c) =>
          c.customerId === owner.customerId
            ? { ...c, purchases: (c.purchases ?? []).map((p) => (p.purchaseId === purchase.purchaseId ? updated : p)) }
            : c
        );
      } else {
        // The purchase doesn't exist yet — a payment recorded against a customer in the
        // Payments module. Attach it as a new purchase so it reflects on the customer.
        const target = customers.find((c) => c.customerId === pay.customerId);
        if (!target) return;
        changed = true;
        affected.add(target.customerId);
        const created: Purchase = {
          purchaseId: pay.purchaseId,
          productModel: pay.productLabel || undefined,
          price: pay.invoiceAmount || 0,
          advancePaid: Math.min(pay.invoiceAmount || 0, pay.paidAmount || 0),
          dueDate: pay.dueDate || undefined,
          paymentMode: pay.paymentMode,
          createdAt: pay.createdAt ?? new Date().toISOString()
        };
        customers = customers.map((c) =>
          c.customerId === target.customerId ? { ...c, purchases: [...(c.purchases ?? []), created] } : c
        );
      }
    });

    if (!changed) {
      setPaymentList(next);
      store(STORAGE_KEYS.payments, next);
      return;
    }
    setCustomerList(customers);
    store(STORAGE_KEYS.customers, customers);
    // Re-derive Orders and the payment mirrors from the affected customers so all three
    // modules are canonical and consistent (idempotent — no oscillation).
    let orders = orderList;
    let payments = next;
    customers.forEach((c) => {
      if (!affected.has(c.customerId)) return;
      orders = syncOrdersFromCustomer(c, orders);
      payments = syncPaymentsFromCustomer(c, payments);
    });
    setOrderList(orders);
    store(STORAGE_KEYS.orders, orders);
    setPaymentList(payments);
    store(STORAGE_KEYS.payments, payments);
  }

  function saveQuotation(quotation: Quotation) {
    const existed = quotationList.some((item) => item.quotationId === quotation.quotationId);
    const next = existed ? quotationList.map((item) => (item.quotationId === quotation.quotationId ? quotation : item)) : [quotation, ...quotationList];
    setQuotationList(next);
    store(STORAGE_KEYS.quotations, next);
    setEditingQuotation(null);
    toast(existed ? `${quotation.quotationNumber} updated` : `${quotation.quotationNumber} created`);
  }

  function deleteQuotation(quotation: Quotation) {
    const next = quotationList.filter((item) => item.quotationId !== quotation.quotationId);
    setQuotationList(next);
    store(STORAGE_KEYS.quotations, next);
    toast(`${quotation.quotationNumber} removed`, "info");
  }

  function deleteQuotations(ids: string[]) {
    const set = new Set(ids);
    const next = quotationList.filter((item) => !set.has(item.quotationId));
    const removed = quotationList.length - next.length;
    setQuotationList(next);
    store(STORAGE_KEYS.quotations, next);
    toast(`${removed} quotation${removed === 1 ? "" : "s"} removed`, "info");
  }

  function updateUsers(next: User[]) {
    setUserList(next);
    store(STORAGE_KEYS.users, next);

    // Keep the active session in sync when the signed-in user edits their own record.
    if (currentUser) {
      const me = next.find((user) => user.id === currentUser.id);
      setCurrentUser(me ?? null);
      saveState(STORAGE_KEYS.auth, me ?? null);
    }
  }

  function updateAttendance(next: AttendanceRecord[]) {
    setAttendance(next);
    store(STORAGE_KEYS.attendance, next);
  }

  const visibleModules = modules.filter((module) => !module.adminOnly || isAdmin);
  const selectedModule = modules.find((module) => module.id === activeModule) ?? modules[0];

  // Avoid a hydration flash before the client resolves auth state.
  if (!mounted) {
    return <main className="min-h-screen bg-[#F8FAFC]" aria-hidden />;
  }

  // Licence gate — evaluated before auth. "checking" holds a neutral screen until
  // the stored/synced licence is verified; expired/unlicensed hard-block the CRM.
  if (licenseStatus === "checking") {
    return <main className="grid min-h-screen place-items-center bg-slate-950 text-sm text-slate-400" aria-busy="true">Checking licence…</main>;
  }
  if (licenseStatus === "expired") {
    return <LicenseScreen expired validUntil={license?.validUntil} onActivate={activateLicense} />;
  }
  if (licenseStatus === "unlicensed" || licenseStatus === "invalid") {
    return <LicenseScreen expired={false} onActivate={activateLicense} />;
  }

  if (!currentUser) {
    return <LoginScreen onLogin={handleLogin} />;
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
              <h1 className="text-lg font-bold">CRM</h1>
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
              <p className="truncate text-xs text-slate-500">{currentUser.role}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-slate-300 transition hover:bg-white/10 hover:text-white"
          >
            <LogOut className="h-5 w-5" />
            Logout
          </button>
          <p className="mt-2 px-3 text-[11px] text-slate-500">Version {APP_VERSION}</p>
        </div>
      </aside>

      <div className="lg:pl-72">
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
                  placeholder={`Filter ${selectedModule.label.toLowerCase()}…`}
                  aria-label={`Filter ${selectedModule.label}`}
                />
              </div>
              <span
                title={SYNC_LABELS[syncStatus].hint}
                className={cn("inline-flex h-11 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-semibold", SYNC_LABELS[syncStatus].tone)}
              >
                <span className={cn("h-2 w-2 rounded-full", SYNC_LABELS[syncStatus].dot)} />
                {SYNC_LABELS[syncStatus].label}
              </span>
              {activeModule === "customers" && (
                <button
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white shadow-soft"
                  onClick={() => setEditingCustomer("new")}
                >
                  <Plus className="h-4 w-4" />
                  Add Customer
                </button>
              )}
            </div>
          </div>
        </header>

        <section className="p-4 lg:p-8">
          {licenseStatus === "renew-soon" && license && (
            <p className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900" role="status">
              Your CRM licence expires on <span className="font-bold">{new Date(license.validUntil).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</span>. Please renew before then to avoid interruption — the CRM locks after this date.
            </p>
          )}
          {backupNotice && (
            <div className={cn("mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm", backupNotice === "failed" ? "border-red-300 bg-red-50 text-red-800" : "border-amber-300 bg-amber-50 text-amber-900")}>
              <span className="font-medium">
                {backupNotice === "failed"
                  ? "Daily backup not done — this device could not save a local backup. Please download a backup now."
                  : "Daily backup reminder — download today's off-device backup to keep your data safe."}
              </span>
              <div className="flex items-center gap-2">
                <button type="button" onClick={downloadBackupNow} className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white">Backup now</button>
                <button type="button" onClick={() => setBackupNotice(null)} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600">Dismiss</button>
              </div>
            </div>
          )}
          {syncStatus === "connecting" && (
            <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800" role="status">
              Loading your workspace… showing this device&apos;s saved data until the cloud responds.
            </p>
          )}
          {activeModule === "dashboard" && <Dashboard customers={customerList} quotations={quotationList} leads={leadList} invoices={invoiceList} payments={paymentList} services={serviceList} />}
          {activeModule === "search" && <SearchView customers={customerList} products={inventory} leads={leadList} />}
          {activeModule === "customers" && <CustomersView customers={customerList} query={globalSearch} onEdit={(customer) => setEditingCustomer(customer)} onDelete={deleteCustomer} onDeleteMany={deleteCustomers} onRevert={revertCustomerToLead} onImport={importCustomers} />}
          {activeModule === "leads" && (
            <LeadsView leads={leadList} products={inventory} brands={brandList} settings={settings} customFields={settings.leadFields} query={globalSearch} onChange={updateLeads} onConvert={convertLead} onCreate={createQuotationFromLead} />
          )}
          {activeModule === "inventory" && <InventoryView products={inventory} brands={brandList} settings={settings} query={globalSearch} onChange={updateInventory} />}
          {activeModule === "brands" && isAdmin && <BrandsView brands={brandList} products={inventory} settings={settings} query={globalSearch} onChange={updateBrands} />}
          {activeModule === "quotations" && (
            <QuotationsView
              quotations={quotationList}
              customers={customerList}
              leads={leadList}
              settings={settings}
              products={inventory}
              query={globalSearch}
              onEdit={(quotation) => setEditingQuotation(quotation)}
              onNew={() => setEditingQuotation("new")}
              onDelete={deleteQuotation}
              onDeleteMany={deleteQuotations}
            />
          )}
          {activeModule === "orders" && <OrdersView orders={orderList} customers={customerList} products={inventory} settings={settings} query={globalSearch} onChange={updateOrders} />}
          {activeModule === "invoices" && <InvoicesView invoices={invoiceList} customers={customerList} brands={brandList} settings={settings} query={globalSearch} onChange={updateInvoices} />}
          {activeModule === "services" && <ServicesView services={serviceList} customers={customerList} brands={brandList} query={globalSearch} onChange={updateServices} />}
          {activeModule === "attendance" && <AttendanceView users={userList} records={attendance} onChange={updateAttendance} />}
          {activeModule === "payments" && <PaymentsView payments={paymentList} customers={customerList} settings={settings} query={globalSearch} onChange={updatePayments} />}
          {activeModule === "users" && isAdmin && <UsersView users={userList} currentUserId={currentUser.id} settings={settings} onChange={updateUsers} />}
          {activeModule === "reports" && <ReportsView customers={customerList} products={inventory} brands={brandList} settings={settings} quotations={quotationList} leads={leadList} invoices={invoiceList} orders={orderList} payments={paymentList} services={serviceList} />}
          {activeModule === "settings" && <SettingsView settings={settings} users={userList} onChange={updateSettings} onBackup={downloadBackupNow} onRestore={restoreBackup} lastManualBackup={lastManualBackupDay() || undefined} licenseUntil={license?.validUntil} />}
        </section>
      </div>

      {editingCustomer !== null && (
        <CustomerModal initial={editingCustomer === "new" ? null : editingCustomer} products={inventory} brands={brandList} settings={settings} customFields={settings.customerFields} onClose={() => setEditingCustomer(null)} onSave={saveCustomer} />
      )}

      {editingQuotation !== null && (
        <QuotationModal
          quotation={editingQuotation === "new" ? null : editingQuotation}
          leads={leadList}
          products={inventory}
          brands={brandList}
          settings={settings}
          existing={quotationList}
          onClose={() => setEditingQuotation(null)}
          onSave={saveQuotation}
        />
      )}
    </main>
  );
}

function LoginScreen({ onLogin }: { onLogin: (values: z.infer<typeof loginSchema>) => Promise<{ ok: boolean; error?: string }> }) {
  const [authError, setAuthError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" }
  });

  async function submit(values: z.infer<typeof loginSchema>) {
    const result = await onLogin(values);
    if (!result.ok) setAuthError(result.error ?? "Unable to sign in.");
  }

  return (
    <main className="grid min-h-screen bg-[#F8FAFC] lg:grid-cols-[1.05fr_0.95fr]">
      <section className="flex items-center justify-center px-6 py-10">
        <form
          onSubmit={handleSubmit(submit)}
          className="w-full max-w-md overflow-hidden rounded-lg border border-slate-200 bg-white shadow-soft"
        >
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
            <p className="font-semibold text-blue-700">Staff sign in</p>
            <p className="mt-1">Use the account issued to you. Additional staff accounts are created from the Users module by an administrator.</p>
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
