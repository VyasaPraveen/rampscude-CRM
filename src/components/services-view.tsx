"use client";

import { Pencil, Plus, Save } from "lucide-react";
import { useState } from "react";
import type { Customer, ServiceRequest, ServiceStatus } from "@/types/crm";
import { Badge, DataTable, DeleteButton, Modal } from "@/components/ui";
import { useToast } from "@/components/toast";

const STATUSES: ServiceStatus[] = ["Pending", "In Progress", "Completed"];

export function ServicesView({ services, customers, query, onChange }: { readonly services: ServiceRequest[]; readonly customers: Customer[]; readonly query: string; readonly onChange: (services: ServiceRequest[]) => void }) {
  const toast = useToast();
  const [editing, setEditing] = useState<ServiceRequest | null | "new">(null);
  const nameOf = (id: string) => {
    const c = customers.find((item) => item.customerId === id);
    return c ? c.companyName || c.customerName : id;
  };

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
