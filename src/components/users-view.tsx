"use client";

import { Pencil, Save, Trash2, UserPlus } from "lucide-react";
import { useState } from "react";
import type { CompanySettings, Role, User, UserStatus } from "@/types/crm";
import { withHashedPassword } from "@/lib/password";
import { optionList } from "@/lib/options";
import { shortDate } from "@/utils/format";
import { Badge, DataTable, Modal } from "@/components/ui";
import { useToast } from "@/components/toast";
import { cn } from "@/lib/utils";

const ROLES: Role[] = ["Admin", "Staff"];

type Draft = Omit<User, "id" | "password" | "passwordHash" | "passwordSalt"> & { id?: string; newPassword: string };

function emptyDraft(): Draft {
  return { name: "", email: "", phone: "", role: "Staff", department: "Sales", status: "Active", joinedAt: new Date().toISOString().slice(0, 10), newPassword: "" };
}

/**
 * Admin-only user management: create, edit, activate/deactivate and remove staff
 * and admin accounts. Backed by the persisted users collection.
 */
export function UsersView({
  users,
  currentUserId,
  settings,
  onChange
}: {
  readonly users: User[];
  readonly currentUserId: string;
  readonly settings: CompanySettings;
  readonly onChange: (users: User[]) => void;
}) {
  const toast = useToast();
  const [editing, setEditing] = useState<Draft | null>(null);
  const departments = optionList(settings, "departments");

  const activeCount = users.filter((user) => user.status === "Active").length;
  const staffCount = users.filter((user) => user.role === "Staff").length;

  async function save(draft: Draft): Promise<string | null> {
    const email = draft.email.trim().toLowerCase();
    const clash = users.some((user) => user.email.toLowerCase() === email && user.id !== draft.id);
    if (clash) return "A user with this email already exists.";

    // Never let the signed-in admin lock themselves out.
    if (draft.id === currentUserId && (draft.status === "Inactive" || draft.role !== "Admin")) {
      return "You cannot change your own role or deactivate your own account.";
    }

    const { newPassword, ...fields } = draft;
    const existing = users.find((user) => user.id === draft.id);
    if (!existing && !newPassword.trim()) return "Set a password for the new user.";

    // Store the email already normalized (trimmed + lower-cased) so it always matches
    // what the login screen compares against — a stray space or capital never locks a
    // freshly-created account out.
    let record = { ...(existing ?? {}), ...fields, email, id: draft.id ?? `USR-${Date.now()}` } as User;
    if (newPassword.trim()) record = await withHashedPassword(record, newPassword.trim());

    onChange(existing ? users.map((user) => (user.id === record.id ? record : user)) : [record, ...users]);
    setEditing(null);
    toast(draft.id ? `${draft.name} updated` : `${draft.name} added`);
    return null;
  }

  function toggleStatus(user: User) {
    if (user.id === currentUserId) return; // guarded in UI too; never deactivate self
    const status: UserStatus = user.status === "Active" ? "Inactive" : "Active";
    onChange(users.map((item) => (item.id === user.id ? { ...item, status } : item)));
    toast(`${user.name} ${status === "Active" ? "activated" : "deactivated"}`);
  }

  function remove(user: User) {
    onChange(users.filter((item) => item.id !== user.id));
    toast(`${user.name} removed`, "info");
  }

  function removeMany(ids: string[]) {
    // Never remove the signed-in account, even if it was selected.
    const set = new Set(ids.filter((id) => id !== currentUserId));
    if (set.size === 0) {
      toast("You cannot remove your own account.", "info");
      return;
    }
    onChange(users.filter((item) => !set.has(item.id)));
    toast(`${set.size} user${set.size === 1 ? "" : "s"} removed`, "info");
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Total Users" value={users.length} />
        <Stat label="Active" value={activeCount} />
        <Stat label="Staff Members" value={staffCount} />
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => setEditing(emptyDraft())}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-soft"
        >
          <UserPlus className="h-4 w-4" /> Add User
        </button>
      </div>

      <DataTable
        columns={["Name", "Email", "Phone", "Role", "Department", "Status", "Actions"]}
        rowIds={users.map((user) => user.id)}
        onDeleteSelected={removeMany}
        onRowClick={(id) => { const user = users.find((item) => item.id === id); if (user) setEditing({ ...user, newPassword: "" }); }}
        rows={users.map((user) => [
          <span key="n" className="font-semibold text-slate-900">
            {user.name}
            {user.id === currentUserId && <span className="ml-2 text-xs font-medium text-blue-600">(you)</span>}
          </span>,
          user.email,
          user.phone,
          <Badge key="r" label={user.role} />,
          user.department,
          <Badge key="s" label={user.status} />,
          <div key="a" className="flex items-center gap-2">
            <button onClick={() => setEditing({ ...user, newPassword: "" })} className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:text-blue-600" aria-label="Edit user">
              <Pencil className="h-4 w-4" />
            </button>
            <button
              onClick={() => toggleStatus(user)}
              disabled={user.id === currentUserId}
              title={user.id === currentUserId ? "You cannot deactivate your own account" : undefined}
              className={cn(
                "rounded-lg border px-2.5 py-1 text-xs font-semibold disabled:opacity-40",
                user.status === "Active" ? "border-amber-200 text-amber-700" : "border-green-200 text-green-700"
              )}
            >
              {user.status === "Active" ? "Deactivate" : "Activate"}
            </button>
            <button
              onClick={() => remove(user)}
              disabled={user.id === currentUserId}
              className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-400 hover:text-red-600 disabled:opacity-40"
              aria-label="Remove user"
              title={user.id === currentUserId ? "You cannot remove your own account" : "Remove user"}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ])}
      />

      {editing && <UserModal draft={editing} departments={departments} onClose={() => setEditing(null)} onSave={save} />}
    </div>
  );
}

function UserModal({ draft, departments, onClose, onSave }: { readonly draft: Draft; readonly departments: string[]; readonly onClose: () => void; readonly onSave: (draft: Draft) => Promise<string | null> }) {
  const [form, setForm] = useState<Draft>(draft);
  const [error, setError] = useState("");

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function submit() {
    if (form.name.trim().length < 2) return setError("Enter the user's name.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email)) return setError("Enter a valid email.");
    if (form.phone.trim().length < 10) return setError("Enter a valid phone number.");
    if (form.newPassword.trim() && form.newPassword.trim().length < 6) return setError("Password must be at least 6 characters.");
    if (!form.id && form.newPassword.trim().length < 6) return setError("Set a password of at least 6 characters.");
    setError("");
    void onSave(form).then((message) => {
      if (message) setError(message);
    });
  }

  return (
    <Modal title={form.id ? "Edit User" : "Add User"} size="lg" onClose={onClose}>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Full Name" value={form.name} onChange={(value) => set("name", value)} />
          <Field label="Email" value={form.email} onChange={(value) => set("email", value)} type="email" />
          <Field label="Phone" value={form.phone} onChange={(value) => set("phone", value)} />
          <Field label={form.id ? "New Password (leave blank to keep current)" : "Password"} value={form.newPassword} onChange={(value) => set("newPassword", value)} type="password" />
          <label className="text-sm font-semibold text-slate-700">
            Role
            <select value={form.role} onChange={(event) => set("role", event.target.value as Role)} className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 font-normal outline-none ring-blue-500 focus:ring-2">
              {ROLES.map((role) => (
                <option key={role}>{role}</option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Department
            <select value={form.department} onChange={(event) => set("department", event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 font-normal outline-none ring-blue-500 focus:ring-2">
              {departments.map((department) => (
                <option key={department}>{department}</option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Status
            <select value={form.status} onChange={(event) => set("status", event.target.value as UserStatus)} className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 font-normal outline-none ring-blue-500 focus:ring-2">
              <option>Active</option>
              <option>Inactive</option>
            </select>
          </label>
          <Field label="Joined On" value={form.joinedAt} onChange={(value) => set("joinedAt", value)} type="date" />
        </div>

        {form.id && <p className="mt-4 text-xs text-slate-500">Joined {shortDate(form.joinedAt)}. Changes apply immediately.</p>}
        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 font-semibold">
            Cancel
          </button>
          <button type="button" onClick={submit} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white">
            <Save className="h-4 w-4" /> Save User
          </button>
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

function Stat({ label, value }: { readonly label: string; readonly value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-slate-950">{value}</p>
    </div>
  );
}
