"use client";

import { CheckCircle2, Info, X } from "lucide-react";
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type ToastTone = "success" | "info";
type Toast = { id: number; message: string; tone: ToastTone };

const ToastContext = createContext<(message: string, tone?: ToastTone) => void>(() => undefined);

/** Fire a transient notification: `const toast = useToast(); toast("Saved")`. */
export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { readonly children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const push = useCallback((message: string, tone: ToastTone = "success") => {
    const id = (nextId.current += 1);
    setToasts((current) => [...current, { id, message, tone }]);
    setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 3200);
  }, []);

  const dismiss = (id: number) => setToasts((current) => current.filter((toast) => toast.id !== id));

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4">
        {toasts.map((toast) => {
          const Icon = toast.tone === "success" ? CheckCircle2 : Info;
          return (
            <div
              key={toast.id}
              role="status"
              className={cn(
                "pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-lg border px-4 py-3 text-sm font-medium shadow-lg",
                toast.tone === "success" ? "border-green-200 bg-white text-green-800" : "border-blue-200 bg-white text-blue-800"
              )}
            >
              <Icon className={cn("h-5 w-5 shrink-0", toast.tone === "success" ? "text-green-600" : "text-blue-600")} />
              <span className="flex-1">{toast.message}</span>
              <button onClick={() => dismiss(toast.id)} className="text-slate-400 hover:text-slate-600" aria-label="Dismiss">
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
