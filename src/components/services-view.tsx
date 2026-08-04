"use client";

import { Headphones, Mail, MessageCircle, Pencil, Phone, Plus, Save, Share2 } from "lucide-react";
import { useState } from "react";
import type { Brand, Customer, ServiceRequest, ServiceStatus } from "@/types/crm";
import { Badge, DataTable, DeleteButton, Modal, Panel } from "@/components/ui";
import { useToast } from "@/components/toast";
import { whatsappLink } from "@/lib/export";

const STATUSES: ServiceStatus[] = ["Pending", "In Progress", "Completed"];

export function ServicesView({ services, customers, brands, query, onChange }: { readonly services: ServiceRequest[]; readonly customers: Customer[]; readonly brands: Brand[]; readonly query: string; readonly onChange: (services: ServiceRequest[]) => void }) {
  const toast = useToast();
  const [editing, setEditing] = useState<ServiceRequest | null | "new">(null);
  const [shareCustomerId, setShareCustomerId] = useState("");
  const nameOf = (id: string) => {
    const c = customers.find((item) => item.customerId === id);
    return c ? c.companyName || c.customerName : id;
  };

  // Brands that have at least one service contact to share.
  const serviceBrands = brands.filter((b) => b.serviceCareNumber || b.serviceWhatsapp || b.serviceEmail);

  function shareBrand(brand: Brand) {
    const lines = [
      `*${brand.name} — Service Support*`,
      brand.serviceCareNumber ? `Customer Care: ${brand.serviceCareNumber}` : "",
      brand.serviceWhatsapp ? `WhatsApp: ${brand.serviceWhatsapp}` : "",
      brand.serviceEmail ? `Email: ${brand.serviceEmail}` : ""
    ].filter(Boolean);
    const customer = customers.find((c) => c.customerId === shareCustomerId);
    const phone = (customer?.whatsapp || customer?.mobile || "").replace(/\D/g, "");
    // With a customer chosen we target their number; otherwise wa.me opens the chooser.
    const url = phone ? whatsappLink(phone, lines.join("\n")) : `https://wa.me/?text=${encodeURIComponent(lines.join("\n"))}`;
    window.open(url, "_blank", "noopener");
  }

  const rows = services.filter((item) => `${item.serviceNumber} ${nameOf(item.customerId)} ${item.product}`.toLowerCase().includes(query.toLowerCase()));

  function save(service: ServiceRequest) {
    const exists = services.some((item) => item.serviceId === service.serviceId);
    onChange(exists ? services.map((item) => (item.serviceId === service.serviceId ? service : item)) : [service, ...services]);
    setEditing(null);
    toast(exists ? `${service.serviceNumber} updated` : `${service.serviceNumber} created`);
  }

  function remove(service: ServiceRequest) {
    onChange(services.filter((item) => item.serviceId !== service.serviceId));
    toast(`${service.serviceNumber} removed`, "info");
  }

  return (
    <div className="space-y-4">
      <Panel
        title="Brand Service Contacts"
        action={
          <label className="flex items-center gap-2 text-sm font-medium text-slate-600">
            Share to
            <select value={shareCustomerId} onChange={(e) => setShareCustomerId(e.target.value)} className="h-9 rounded-lg border border-slate-200 px-2 text-sm outline-none ring-blue-500 focus:ring-2">
              <option value="">Choose in WhatsApp</option>
              {customers.map((c) => (
                <option key={c.customerId} value={c.customerId}>{c.companyName || c.customerName}</option>
              ))}
            </select>
          </label>
        }
      >
        {serviceBrands.length === 0 ? (
          <p className="text-sm text-slate-500">
            No brand service contacts yet. Add Customer Care / WhatsApp / Email to a brand in the <span className="font-semibold text-blue-700">Brands</span> module.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {serviceBrands.map((brand) => (
              <div key={brand.brandId} className="rounded-lg border border-slate-200 p-4">
                <div className="mb-2 flex items-center gap-2 font-semibold text-slate-900">
                  <Headphones className="h-4 w-4 text-blue-600" /> {brand.name}
                </div>
                <div className="space-y-1 text-sm text-slate-600">
                  {brand.serviceCareNumber && <p className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-slate-400" /> {brand.serviceCareNumber}</p>}
                  {brand.serviceWhatsapp && <p className="flex items-center gap-2"><MessageCircle className="h-3.5 w-3.5 text-slate-400" /> {brand.serviceWhatsapp}</p>}
                  {brand.serviceEmail && <p className="flex items-center gap-2"><Mail className="h-3.5 w-3.5 text-slate-400" /> {brand.serviceEmail}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => shareBrand(brand)}
                  className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-green-200 px-3 py-2 text-sm font-semibold text-green-700 hover:border-green-300"
                >
                  <Share2 className="h-4 w-4" /> Share on WhatsApp
                </button>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <div className="flex justify-end">
        <button onClick={() => setEditing("new")} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-soft">
          <Plus className="h-4 w-4" /> New Service
        </button>
      </div>
      <DataTable
        columns={["Service", "Customer", "Product", "Complaint", "Technician", "Status", "Action"]}
        rows={rows.map((item) => [
          <span key="s" className="font-semibold text-slate-900">{item.serviceNumber}</span>,
          nameOf(item.customerId),
          item.product || "—",
          item.complaint || "—",
          item.assignedTo || "—",
          <Badge key="st" label={item.status} />,
          <div key="actions" className="flex items-center gap-2">
            <button onClick={() => setEditing(item)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:border-blue-300">
              <Pencil className="h-3.5 w-3.5" /> Edit
            </button>
            <DeleteButton resetKey={item.serviceId} onDelete={() => remove(item)} />
          </div>
        ])}
      />
      {editing !== null && <ServiceModal initial={editing === "new" ? null : editing} customers={customers} count={services.length} onClose={() => setEditing(null)} onSave={save} />}
    </div>
  );
}

function ServiceModal({ initial, customers, count, onClose, onSave }: { readonly initial: ServiceRequest | null; readonly customers: Customer[]; readonly count: number; readonly onClose: () => void; readonly onSave: (service: ServiceRequest) => void }) {
  const [customerId, setCustomerId] = useState(initial?.customerId ?? customers[0]?.customerId ?? "");
  const [product, setProduct] = useState(initial?.product ?? "");
  const [complaint, setComplaint] = useState(initial?.complaint ?? "");
  const [assignedTo, setAssignedTo] = useState(initial?.assignedTo ?? "");
  const [serviceDate, setServiceDate] = useState(initial?.serviceDate ?? new Date().toISOString().slice(0, 10));
  const [remarks, setRemarks] = useState(initial?.remarks ?? "");
  const [status, setStatus] = useState<ServiceStatus>(initial?.status ?? "Pending");
  const [error, setError] = useState("");

  function submit() {
    if (!customerId) return setError("Select a customer.");
    if (complaint.trim().length < 2) return setError("Enter the complaint / service required.");
    onSave({
      serviceId: initial?.serviceId ?? `SRV-${Date.now()}`,
      serviceNumber: initial?.serviceNumber ?? `RC-SRV-2026-${String(count + 1).padStart(3, "0")}`,
      customerId,
      product: product.trim(),
      complaint: complaint.trim(),
      assignedTo: assignedTo.trim(),
      serviceDate,
      remarks: remarks.trim(),
      status,
      createdAt: initial?.createdAt ?? new Date().toISOString()
    });
  }

  return (
    <Modal title={initial ? "Edit Service" : "New Service"} size="lg" onClose={onClose}>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-semibold text-slate-700 md:col-span-2">
            Customer
            <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 font-normal outline-none ring-blue-500 focus:ring-2">
              {customers.map((c) => (
                <option key={c.customerId} value={c.customerId}>{c.companyName || c.customerName}</option>
              ))}
            </select>
          </label>
          <Field label="Product" value={product} onChange={setProduct} />
          <Field label="Technician" value={assignedTo} onChange={setAssignedTo} />
          <Field label="Complaint" value={complaint} onChange={setComplaint} />
          <Field label="Service Date" value={serviceDate} onChange={setServiceDate} type="date" />
          <label className="text-sm font-semibold text-slate-700">
            Status
            <select value={status} onChange={(e) => setStatus(e.target.value as ServiceStatus)} className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 font-normal outline-none ring-blue-500 focus:ring-2">
              {STATUSES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-700 md:col-span-2">
            Remarks
            <input value={remarks} onChange={(e) => setRemarks(e.target.value)} className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 font-normal outline-none ring-blue-500 focus:ring-2" />
          </label>
        </div>
        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 font-semibold">Cancel</button>
          <button type="button" onClick={submit} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white"><Save className="h-4 w-4" /> Save Service</button>
        </div>
    </Modal>
  );
}

function Field({ label, value, onChange, type = "text" }: { readonly label: string; readonly value: string; readonly onChange: (value: string) => void; readonly type?: string }) {
  return (
    <label className="text-sm font-semibold text-slate-700">
      {label}
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 font-normal outline-none ring-blue-500 focus:ring-2" />
    </label>
  );
}
