import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { CheckCircle2, Info, TriangleAlert, X } from "lucide-react";
import clsx from "clsx";

const ToastContext = createContext(null);

const TONES = {
  success: {
    icon: CheckCircle2,
    className: "border-success/20 bg-white text-ink",
    iconClass: "text-success",
  },
  error: {
    icon: TriangleAlert,
    className: "border-risk/25 bg-white text-ink",
    iconClass: "text-risk",
  },
  info: {
    icon: Info,
    className: "border-teal-500/20 bg-white text-ink",
    iconClass: "text-teal-500",
  },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const counter = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (type, message, options = {}) => {
      if (!message) return;
      counter.current += 1;
      const id = counter.current;
      const toast = {
        id,
        type,
        message,
        title: options.title,
        duration: options.duration ?? 4500,
      };
      setToasts((current) => [...current.slice(-2), toast]);
      window.setTimeout(() => dismiss(id), toast.duration);
    },
    [dismiss],
  );

  const api = useMemo(
    () => ({
      success: (message, options) => push("success", message, options),
      error: (message, options) => push("error", message, options),
      info: (message, options) => push("info", message, options),
      dismiss,
    }),
    [push, dismiss],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-5 z-[100] flex flex-col items-center gap-2 px-4 sm:bottom-auto sm:right-6 sm:top-6 sm:items-end">
        {toasts.map((toast) => {
          const tone = TONES[toast.type] || TONES.info;
          const Icon = tone.icon;
          return (
            <div
              key={toast.id}
              role="status"
              className={clsx(
                "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border p-4 shadow-soft animate-scale-in",
                tone.className,
              )}
            >
              <Icon className={clsx("mt-0.5 h-5 w-5 shrink-0", tone.iconClass)} />
              <div className="min-w-0 flex-1">
                {toast.title && <p className="text-sm font-bold">{toast.title}</p>}
                <p className="text-sm leading-snug text-muted">{toast.message}</p>
              </div>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                className="rounded-full p-1 text-muted transition hover:bg-black/5"
                aria-label="Fermer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within ToastProvider");
  return context;
}
