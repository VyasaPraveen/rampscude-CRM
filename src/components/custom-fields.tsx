"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import type { CustomFieldDef, CustomFieldType } from "@/types/crm";

const FIELD_TYPES: { value: CustomFieldType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "select", label: "Dropdown" }
];

const inputClass = "mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 font-normal outline-none ring-blue-500 focus:ring-2";

/** Render inputs for a set of admin-defined custom fields inside a form grid. */
export function CustomFieldInputs({ defs, values, onChange }: { readonly defs?: CustomFieldDef[]; readonly values?: Record<string, string>; readonly onChange: (id: string, value: string) => void }) {
  if (!defs || defs.length === 0) return null;
  return (
    <>
      {defs.map((def) => (
        <label key={def.id} className="text-sm font-semibold text-slate-700">
          {def.label}
          {def.type === "select" ? (
            <select value={values?.[def.id] ?? ""} onChange={(e) => onChange(def.id, e.target.value)} className={inputClass}>
              <option value="">— Select —</option>
              {(def.options ?? []).map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          ) : (
            <input
              type={def.type === "number" ? "number" : def.type === "date" ? "date" : "text"}
              value={values?.[def.id] ?? ""}
              onChange={(e) => onChange(def.id, e.target.value)}
              className={inputClass}
            />
          )}
        </label>
      ))}
    </>
  );
}

/** Admin editor (in Settings) to add / remove custom fields for a record type. */
export function CustomFieldManager({ title, defs, onChange }: { readonly title: string; readonly defs?: CustomFieldDef[]; readonly onChange: (defs: CustomFieldDef[]) => void }) {
  const list = defs ?? [];
  const [label, setLabel] = useState("");
  const [type, setType] = useState<CustomFieldType>("text");
  const [options, setOptions] = useState("");

  function add() {
    if (label.trim().length < 1) return;
    const def: CustomFieldDef = {
      id: `CF-${Date.now()}`,
      label: label.trim(),
      type,
      options: type === "select" ? options.split(",").map((s) => s.trim()).filter(Boolean) : undefined
    };
    onChange([...list, def]);
    setLabel("");
    setOptions("");
    setType("text");
  }

  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <p className="mb-2 text-sm font-bold text-slate-700">{title}</p>
      {list.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {list.map((def) => (
            <span key={def.id} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-semibold text-slate-700">
              {def.label}
              <span className="text-xs font-normal text-slate-400">{def.type}{def.type === "select" && def.options?.length ? ` (${def.options.length})` : ""}</span>
              <button type="button" aria-label={`Remove ${def.label}`} onClick={() => onChange(list.filter((d) => d.id !== def.id))} className="text-slate-400 transition hover:text-red-600">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="grid gap-2 sm:grid-cols-[1fr_130px_1fr_auto]">
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Field label" className="h-10 rounded-lg border border-slate-200 px-2 text-sm outline-none ring-blue-500 focus:ring-2" />
        <select value={type} onChange={(e) => setType(e.target.value as CustomFieldType)} className="h-10 rounded-lg border border-slate-200 px-2 text-sm outline-none ring-blue-500 focus:ring-2">
          {FIELD_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <input
          value={options}
          onChange={(e) => setOptions(e.target.value)}
          placeholder={type === "select" ? "Options, comma-separated" : "—"}
          disabled={type !== "select"}
          className="h-10 rounded-lg border border-slate-200 px-2 text-sm outline-none ring-blue-500 focus:ring-2 disabled:bg-slate-50 disabled:text-slate-300"
        />
        <button type="button" onClick={add} className="inline-flex h-10 items-center gap-1 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-blue-700 hover:border-blue-300">
          <Plus className="h-4 w-4" /> Add
        </button>
      </div>
    </div>
  );
}
