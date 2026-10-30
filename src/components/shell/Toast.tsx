"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useSession } from "next-auth/react";
import { CheckCircle, Info, WarningCircle, X } from "@phosphor-icons/react";
import { recordAppNotification } from "@/lib/notifications";

type ToastTone = "info" | "success" | "error";

export type ToastOptions = {
  tone?: ToastTone;
  /** Auto-dismiss delay in ms; 0 keeps it until dismissed. Default 4000. */
  duration?: number;
  action?: { label: string; onClick: () => void };
};

type ToastItem = ToastOptions & { id: number; message: string };

type ToastApi = {
  toast: (message: string, options?: ToastOptions) => number;
  dismiss: (id: number) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

type Props = { children: ReactNode };

/** Bottom-right toasts (`.ps-toast`). Mounted once in the root layout. */
export function ToastProvider({ children }: Props) {
  const { data: session } = useSession();
  const userId = session?.user?.id;
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    const t = timers.current.get(id);
    if (t) clearTimeout(t);
    timers.current.delete(id);
    setItems((list) => list.filter((i) => i.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, options: ToastOptions = {}) => {
      const id = nextId.current++;
      setItems((list) => [...list.slice(-3), { id, message, ...options }]);
      if (userId) {
        const tone = options.tone ?? "info";
        recordAppNotification(userId, {
          id: `toast:${Date.now()}:${id}`,
          kind: "activity",
          title: tone === "success" ? "Completed" : tone === "error" ? "Needs attention" : "Update",
          body: message,
          createdAt: new Date().toISOString(),
        });
      }
      const duration = options.duration ?? 4000;
      if (duration > 0) timers.current.set(id, setTimeout(() => dismiss(id), duration));
      return id;
    },
    [dismiss, userId],
  );

  useEffect(() => {
    const map = timers.current;
    return () => map.forEach(clearTimeout);
  }, []);

  const api = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed right-6 bottom-6 left-4 z-[60] flex flex-col items-end gap-2 sm:left-auto" aria-live="polite" aria-relevant="additions">
        {items.map((item) => (
          <div key={item.id} role="status" className="ps-toast pointer-events-auto">
            <ToneIcon tone={item.tone ?? "info"} />
            <span className="min-w-0 flex-1">{item.message}</span>
            {item.action ? (
              <button
                type="button"
                className="ps-link px-1"
                onClick={() => {
                  item.action?.onClick();
                  dismiss(item.id);
                }}
              >
                {item.action.label}
              </button>
            ) : null}
            <button type="button" onClick={() => dismiss(item.id)} aria-label="Dismiss" className="ps-iconbtn ps-iconbtn-sm">
              <X size={12} weight="bold" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToneIcon({ tone }: { tone: ToastTone }) {
  if (tone === "success") return <CheckCircle size={16} weight="fill" className="shrink-0 text-[var(--ps-success)]" />;
  if (tone === "error") return <WarningCircle size={16} weight="fill" className="shrink-0 text-[var(--ps-danger)]" />;
  return <Info size={16} weight="fill" className="shrink-0 text-[var(--ps-ash)]" />;
}

/** `toast(message, { tone, duration, action })` and `dismiss(id)`. */
export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
