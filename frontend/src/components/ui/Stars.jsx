import { useState } from "react";
import clsx from "clsx";
import { Star } from "lucide-react";

const SIZES = {
  sm: "h-3.5 w-3.5",
  md: "h-4 w-4",
  lg: "h-5 w-5",
  xl: "h-7 w-7",
};

export function Stars({ value = 0, size = "md", className, showValue = false }) {
  const rounded = Math.round(Number(value) || 0);
  return (
    <span className={clsx("inline-flex items-center gap-1", className)}>
      <span className="inline-flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={clsx(
              SIZES[size] || SIZES.md,
              star <= rounded ? "fill-gold text-gold" : "fill-transparent text-line",
            )}
          />
        ))}
      </span>
      {showValue && (
        <span className="ml-1 text-xs font-bold text-teal-700">{(Number(value) || 0).toFixed(1)}</span>
      )}
    </span>
  );
}

export function StarRating({ value = 0, onChange, size = "lg", className }) {
  const [hover, setHover] = useState(0);
  return (
    <div className={clsx("inline-flex items-center gap-1", className)} role="radiogroup">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={value === star}
          aria-label={`${star} / 5`}
          onMouseEnter={() => setHover(star)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange?.(star)}
          className="rounded-full p-0.5 transition hover:scale-110"
        >
          <Star
            className={clsx(
              SIZES[size] || SIZES.lg,
              star <= (hover || value) ? "fill-gold text-gold" : "fill-transparent text-line",
            )}
          />
        </button>
      ))}
    </div>
  );
}
