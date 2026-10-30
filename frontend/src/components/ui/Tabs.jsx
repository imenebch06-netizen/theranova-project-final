import clsx from "clsx";

export default function Tabs({ tabs, value, onChange, variant = "pill", className }) {
  return (
    <div
      className={clsx(
        "no-scrollbar flex gap-1.5 overflow-x-auto",
        variant === "pill" && "rounded-full bg-sand/80 p-1.5",
        variant === "line" && "border-b border-line",
        className,
      )}
      role="tablist"
    >
      {tabs.map((tab) => {
        const active = value === tab.value;
        const Icon = tab.icon;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.value)}
            className={clsx(
              "inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition",
              variant === "pill" &&
                (active ? "bg-white text-teal-600 shadow-card" : "text-muted hover:text-teal-600"),
              variant === "line" &&
                (active
                  ? "-mb-px border-b-2 border-teal-500 pb-3 text-teal-600"
                  : "pb-3 text-muted hover:text-teal-600"),
            )}
          >
            {Icon && <Icon className="h-4 w-4" />}
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={clsx(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-black",
                  active ? "bg-sage-200 text-teal-800" : "bg-white/80 text-muted",
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
