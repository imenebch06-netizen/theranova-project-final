import clsx from "clsx";
import { initials } from "../../lib/format";

const PALETTES = [
  "bg-teal-500 text-cream",
  "bg-sage-300 text-teal-800",
  "bg-terracotta/20 text-terracotta",
  "bg-teal-100 text-teal-700",
  "bg-gold/30 text-teal-800",
  "bg-teal-800 text-cream",
];

const SIZES = {
  xs: "h-7 w-7 text-[10px]",
  sm: "h-9 w-9 text-xs",
  md: "h-11 w-11 text-sm",
  lg: "h-14 w-14 text-base",
  xl: "h-20 w-20 text-2xl",
  "2xl": "h-28 w-28 text-3xl",
};

function paletteFor(name) {
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) {
    hash = (hash * 31 + name.charCodeAt(index)) % 997;
  }
  return PALETTES[hash % PALETTES.length];
}

export default function Avatar({ src, name = "", size = "md", className, ring = false }) {
  const sizeClass = SIZES[size] || SIZES.md;
  return (
    <span
      className={clsx(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-bold",
        sizeClass,
        !src && paletteFor(name || "TheraNova"),
        ring && "ring-2 ring-white ring-offset-2 ring-offset-cream",
        className,
      )}
      title={name}
    >
      {src ? (
        <img src={src} alt={name} className="h-full w-full object-cover" loading="lazy" />
      ) : (
        initials(name)
      )}
    </span>
  );
}
