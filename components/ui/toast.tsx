"use client";

import { createContext, useContext, useState, useCallback } from "react";
import { CheckCircle, XCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastType = "success" | "error";

interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  toast: (type: ToastType, message: string) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((type: ToastType, message: string) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const remove = (id: string) => setToasts((prev) => prev.filter((t) => t.id !== id));

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={cn(
              "pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-[var(--radius-lg)] shadow-[var(--shadow-elevated)] border text-sm font-medium min-w-[260px] max-w-sm animate-in slide-in-from-bottom-2 fade-in-0 duration-200",
              t.type === "success"
                ? "bg-[var(--color-success-subtle)] border-[var(--color-success)]/30 text-[var(--color-success)]"
                : "bg-[var(--color-danger-subtle)] border-[var(--color-danger)]/30 text-[var(--color-danger)]"
            )}
          >
            {t.type === "success" ? <CheckCircle size={16} /> : <XCircle size={16} />}
            <span className="flex-1 text-[var(--color-text-primary)]">{t.message}</span>
            <button
              onClick={() => remove(t.id)}
              aria-label="Fechar notificação"
              className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
