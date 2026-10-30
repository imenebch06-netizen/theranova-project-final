import clsx from "clsx";
import { Loader2 } from "lucide-react";

const VARIANTS = {
  primary: "btn-primary",
  secondary: "btn-secondary",
  outline: "btn-outline",
  ghost: "btn-ghost",
  danger: "btn-danger",
  dark: "btn bg-ink text-cream hover:bg-teal-800",
};

const SIZES = {
  sm: "btn-sm",
  md: "",
  lg: "btn-lg",
  icon: "h-10 w-10 !p-0",
};

export function buttonClass({ variant = "primary", size = "md", className = "" } = {}) {
  return clsx(VARIANTS[variant] || VARIANTS.primary, SIZES[size] || "", className);
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  loading = false,
  disabled,
  children,
  type = "button",
  ...props
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={buttonClass({ variant, size, className })}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

export function IconButton({ label, className, children, ...props }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={clsx("icon-btn", className)}
      {...props}
    >
      {children}
    </button>
  );
}
