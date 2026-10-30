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
          "relative flex h-10 w-10 items-center justify-center rounded-2xl transition duration-300 group-hover:rotate-3",
          light ? "bg-sage-300/10 ring-1 ring-sage-300/25" : "bg-teal-500",
        )}
      >
        <svg viewBox="0 0 32 32" className="h-6 w-6" aria-hidden="true">
          <path
            d="M11 9.5c-2.5 0-4.5 2-4.5 4.5 0 3.6 4.6 7.1 9.5 10.2 4.9-3.1 9.5-6.6 9.5-10.2 0-2.5-2-4.5-4.5-4.5-1.8 0-3.4 1-4.4 2.4L16 13l-.6-1.1C14.4 10.5 12.8 9.5 11 9.5Z"
            fill={light ? "#CCD5B5" : "#CCD5B5"}
          />
          <path
            d="M16 20.5v5.2M13.2 23.1h5.6"
            stroke={light ? "#CCD5B5" : "#FFFBF0"}
            strokeWidth="1.9"
            strokeLinecap="round"
          />
        </svg>
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
