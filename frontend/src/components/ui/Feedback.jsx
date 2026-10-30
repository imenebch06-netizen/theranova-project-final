import clsx from "clsx";
import { Loader2, SearchX, TriangleAlert } from "lucide-react";
import Logo from "../Logo";

export function Spinner({ className = "h-5 w-5" }) {
  return <Loader2 className={clsx("animate-spin text-teal-500", className)} />;
}

export function LoadingBlock({ label = "Chargement…", className }) {
  return (
    <div className={clsx("flex flex-col items-center justify-center gap-3 py-16", className)}>
      <Spinner className="h-7 w-7" />
      <p className="text-sm font-semibold text-muted">{label}</p>
    </div>
  );
}

export function LoadingScreen({ label = "Chargement de votre espace…" }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-cream">
      <Logo />
      <div className="flex flex-col items-center gap-3">
        <Spinner className="h-8 w-8" />
        <p className="text-sm font-semibold text-muted">{label}</p>
      </div>
    </div>
  );
}

export function EmptyState({ icon: Icon = SearchX, title, description, action, className }) {
  return (
    <div
      className={clsx(
        "flex flex-col items-center justify-center rounded-3xl border border-dashed border-line bg-white/50 px-6 py-14 text-center",
        className,
      )}
    >
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sage-100 text-teal-500">
        <Icon className="h-6 w-6" />
      </span>
      <h3 className="mt-4 text-base font-bold text-ink">{title}</h3>
      {description && <p className="mt-1.5 max-w-md text-sm leading-relaxed text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry, className }) {
  return (
    <div
      className={clsx(
        "flex flex-col items-center justify-center rounded-3xl border border-risk/20 bg-risk/5 px-6 py-10 text-center",
        className,
      )}
    >
      <TriangleAlert className="h-8 w-8 text-risk" />
      <p className="mt-3 max-w-md text-sm font-semibold text-ink">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="btn-outline btn-sm mt-4">
          Réessayer
        </button>
      )}
    </div>
  );
}

export function Skeleton({ className }) {
  return <div className={clsx("animate-pulse rounded-2xl bg-sand/90", className)} />;
}

export function SkeletonCard() {
  return (
    <div className="card space-y-4 p-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-14 w-14 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      </div>
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-4/5" />
    </div>
  );
}
