"use client";

import { KeyRound, ShieldAlert, ShieldCheck } from "lucide-react";
import { useState } from "react";

/**
 * Full-screen licence gate. Shown when the install is unlicensed or the term has
 * expired (hard block). The admin pastes the vendor-issued key to activate or
 * renew. There is no way to remove an active key from here — renewal only.
 */
export function LicenseScreen({
  expired,
  validUntil,
  onActivate
}: {
  readonly expired: boolean;
  readonly validUntil?: string;
  readonly onActivate: (key: string) => Promise<string | null>;
}) {
  const [key, setKey] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (busy) return;
    setError("");
    setBusy(true);
    const message = await onActivate(key);
    setBusy(false);
    if (message) setError(message);
  }

  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 p-4 text-slate-100">
      <div className="w-full max-w-md rounded-2xl bg-slate-900 p-8 shadow-2xl ring-1 ring-slate-800">
        <div className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl ${expired ? "bg-red-500/15 text-red-400" : "bg-blue-500/15 text-blue-400"}`}>
          {expired ? <ShieldAlert className="h-6 w-6" /> : <ShieldCheck className="h-6 w-6" />}
        </div>
        <h1 className="text-xl font-bold">{expired ? "Licence expired" : "Activate Ramps Cube CRM"}</h1>
        <p className="mt-2 text-sm text-slate-400">
          {expired
            ? `This CRM's licence${validUntil ? ` expired on ${validUntil}` : " has expired"}. Enter a renewal key to continue — the CRM is locked until it is renewed.`
            : "This is a licensed yearly subscription. Enter the licence key provided with your agreement to activate this install."}
        </p>

        <label className="mt-6 block text-sm font-semibold text-slate-300">
          Licence Key
          <div className="mt-2 flex items-center gap-2 rounded-lg bg-slate-800 px-3 ring-1 ring-slate-700 focus-within:ring-blue-500">
            <KeyRound className="h-4 w-4 text-slate-500" />
            <input
              value={key}
              onChange={(event) => setKey(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && void submit()}
              placeholder="RCUBE-XXXXXXXX-XXXXXXXX-XXXXXXXX"
              spellCheck={false}
              autoComplete="off"
              className="h-11 w-full bg-transparent font-mono text-sm tracking-wide text-slate-100 outline-none placeholder:text-slate-600"
            />
          </div>
        </label>
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

        <button
          type="button"
          onClick={() => void submit()}
          disabled={busy || key.trim().length < 8}
          className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 font-semibold text-white transition hover:bg-blue-500 disabled:opacity-50"
        >
          {busy ? "Verifying…" : expired ? "Renew licence" : "Activate"}
        </button>

        <p className="mt-6 text-center text-xs text-slate-500">Ramps Cube CRM · yearly subscription · contact your vendor to renew.</p>
      </div>
    </main>
  );
}
