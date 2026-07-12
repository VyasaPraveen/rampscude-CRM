"use client";

import { Clock, Lock, Snowflake } from "lucide-react";
import type { DemoStatus } from "@/lib/demo";
import { DEMO_DURATION_DAYS, formatRemaining } from "@/lib/demo";
import { shortDate } from "@/utils/format";
import { cn } from "@/lib/utils";

/**
 * Full-screen lock shown once the demo window has passed. Rendered instead of
 * the login/app so there is no way to reach the CRM after expiry.
 */
export function DemoExpiredScreen({ status }: { status: DemoStatus }) {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 px-6 py-10 text-white">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-900/80 p-8 text-center shadow-2xl">
        <div className="mx-auto mb-6 grid h-16 w-16 place-items-center rounded-2xl bg-red-500/15 text-red-400">
          <Lock className="h-8 w-8" />
        </div>
        <div className="mb-2 inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-blue-300">
          <Snowflake className="h-4 w-4" /> RAMPS CUBE CRM
        </div>
        <h1 className="text-3xl font-bold">Demo access expired</h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-300">
          Your {DEMO_DURATION_DAYS}-day evaluation of the RAMPS CUBE CRM ended on{" "}
          <span className="font-semibold text-white">{shortDate(status.expiresAt.toISOString())}</span>. Thank you for
          trying it out. To continue with full access, please reach out to activate a licensed workspace.
        </p>
        <a
          href="mailto:sales@rampscube.com?subject=RAMPS%20CUBE%20CRM%20-%20Activate%20full%20access"
          className="mt-8 inline-flex h-12 items-center justify-center rounded-lg bg-blue-600 px-6 font-semibold text-white shadow-lg transition hover:bg-blue-500"
        >
          Contact us to continue
        </a>
        <p className="mt-4 text-xs text-slate-500">Extending the demo? Deploy a new build with an updated demo period.</p>
      </div>
    </main>
  );
}

/**
 * Slim banner surfacing the remaining demo time. Turns amber in the final day.
 */
export function DemoBanner({ status, className }: { status: DemoStatus; className?: string }) {
  const urgent = status.daysLeft <= 1;
  return (
    <div
      className={cn(
        "flex items-center justify-center gap-2 px-4 py-2 text-center text-xs font-semibold",
        urgent ? "bg-amber-500/15 text-amber-700" : "bg-blue-600/10 text-blue-700",
        className
      )}
    >
      <Clock className="h-3.5 w-3.5" />
      <span>
        Demo access · {formatRemaining(status)} · ends {shortDate(status.expiresAt.toISOString())}
      </span>
    </div>
  );
}
