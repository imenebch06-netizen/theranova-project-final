import { forwardRef } from "react";
import clsx from "clsx";
import { AlertCircle } from "lucide-react";

export function Field({ label, hint, error, required, htmlFor, className, children }) {
  return (
    <div className={clsx("w-full", className)}>
      {label && (
        <label className="label" htmlFor={htmlFor}>
          {label}
          {required && <span className="ml-1 text-terracotta">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-risk">
          <AlertCircle className="h-3.5 w-3.5" />
          {error}
        </p>
      ) : (
        hint && <p className="mt-1.5 text-xs text-muted">{hint}</p>
      )}
    </div>
  );
}

export const Input = forwardRef(function Input(
  { label, hint, error, required, className, id, icon: Icon, ...props },
  ref,
) {
  const inputId = id || props.name;
  return (
    <Field label={label} hint={hint} error={error} required={required} htmlFor={inputId}>
      <div className="relative">
        {Icon && (
          <Icon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        )}
        <input
          ref={ref}
          id={inputId}
          className={clsx("input", Icon && "pl-11", error && "border-risk/60", className)}
          {...props}
        />
      </div>
    </Field>
  );
});

export const Textarea = forwardRef(function Textarea(
  { label, hint, error, required, className, id, rows = 4, ...props },
  ref,
) {
  const inputId = id || props.name;
  return (
    <Field label={label} hint={hint} error={error} required={required} htmlFor={inputId}>
      <textarea
        ref={ref}
        id={inputId}
        rows={rows}
        className={clsx("textarea", error && "border-risk/60", className)}
        {...props}
      />
    </Field>
  );
});

export const Select = forwardRef(function Select(
  { label, hint, error, required, className, id, children, ...props },
  ref,
) {
  const inputId = id || props.name;
  return (
    <Field label={label} hint={hint} error={error} required={required} htmlFor={inputId}>
      <select
        ref={ref}
        id={inputId}
        className={clsx("select", error && "border-risk/60", className)}
        {...props}
      >
        {children}
      </select>
    </Field>
  );
});

export function Checkbox({ label, description, className, ...props }) {
  return (
    <label className={clsx("flex cursor-pointer items-start gap-3", className)}>
      <input
        type="checkbox"
        className="mt-0.5 h-4 w-4 rounded border-line text-teal-500 focus:ring-teal-500/40"
        {...props}
      />
      <span>
        <span className="block text-sm font-semibold text-ink">{label}</span>
        {description && <span className="mt-0.5 block text-xs text-muted">{description}</span>}
      </span>
    </label>
  );
}

export function RadioCard({ selected, label, description, className, ...props }) {
  return (
    <label
      className={clsx(
        "flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition",
        selected
          ? "border-teal-400 bg-sage-50 ring-2 ring-teal-500/15"
          : "border-line bg-white hover:border-sage-400",
        className,
      )}
    >
      <input type="radio" className="sr-only" checked={selected} {...props} />
      <span
        className={clsx(
          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2",
          selected ? "border-teal-500" : "border-line",
        )}
      >
        {selected && <span className="h-2.5 w-2.5 rounded-full bg-teal-500" />}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-ink">{label}</span>
        {description && <span className="mt-0.5 block text-xs leading-relaxed text-muted">{description}</span>}
      </span>
    </label>
  );
}
