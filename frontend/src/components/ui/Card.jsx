import clsx from "clsx";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

export function Card({ className, children, ...props }) {
  return (
    <div className={clsx("card", className)} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action, className, icon: Icon }) {
  return (
    <div className={clsx("flex items-start justify-between gap-4", className)}>
      <div className="flex items-start gap-3">
        {Icon && (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-sage-100 text-teal-600">
            <Icon className="h-5 w-5" />
          </span>
        )}
        <div>
          <h3 className="text-base font-bold text-ink">{title}</h3>
          {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

const TONES = {
  teal: "bg-teal-500/10 text-teal-600",
  sage: "bg-sage-200 text-teal-700",
  terracotta: "bg-terracotta/10 text-terracotta",
  gold: "bg-gold/25 text-teal-800",
  risk: "bg-risk/10 text-risk",
  success: "bg-success/10 text-success",
};

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "teal",
  trend,
  className,
}) {
  const TrendIcon = trend === "up" ? ArrowUpRight : trend === "down" ? ArrowDownRight : Minus;
  return (
    <div className={clsx("card flex items-start gap-4 p-5", className)}>
      {Icon && (
        <span className={clsx("flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl", TONES[tone])}>
          <Icon className="h-5 w-5" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted">{label}</p>
        <p className="mt-1 truncate text-2xl font-black tracking-tight text-ink">{value}</p>
        {(hint || trend) && (
          <p className="mt-1 flex items-center gap-1 text-xs text-muted">
            {trend && (
              <TrendIcon
                className={clsx(
                  "h-3.5 w-3.5",
                  trend === "up" && "text-success",
                  trend === "down" && "text-risk",
                )}
              />
            )}
            {hint}
          </p>
        )}
      </div>
    </div>
  );
}

export function SectionHeading({ overline, title, description, action, align = "left", className }) {
  return (
    <div
      className={clsx(
        "flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
        align === "center" && "sm:flex-col sm:items-center sm:text-center",
        className,
      )}
    >
      <div className={clsx("max-w-2xl", align === "center" && "mx-auto text-center")}>
        {overline && <p className="overline mb-2">{overline}</p>}
        <h2 className="text-3xl font-black tracking-tight text-ink sm:text-4xl">{title}</h2>
        {description && <p className="mt-3 text-base leading-relaxed text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}
