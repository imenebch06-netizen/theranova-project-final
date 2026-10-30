import { Link } from "react-router-dom";
import clsx from "clsx";

export default function Logo({ to = "/", tone = "dark", compact = false, className = "" }) {
  const light = tone === "light";

  return (
    <Link
      to={to}
      className={clsx("group inline-flex items-center gap-2.5", className)}
      aria-label="TheraNova"
    >
      <span
        className={clsx(
          "relative flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-cream transition duration-300 group-hover:-translate-y-0.5 group-hover:rotate-3",
          light ? "ring-1 ring-sage-300/25" : "ring-1 ring-teal-500/15 shadow-[0_12px_28px_-16px_rgba(26,82,85,0.65)]",
        )}
      >
        <img src="/logo.png" alt="" className="h-9 w-9 object-contain" aria-hidden="true" />
      </span>
      {!compact && (
        <span
          className={clsx(
            "font-display text-[1.35rem] font-black tracking-tight",
            light ? "text-cream" : "text-ink",
          )}
        >
          Thera<span className={light ? "text-sage-300" : "text-teal-500"}>Nova</span>
        </span>
      )}
    </Link>
  );
}
