export default function ChartTooltip({ active, payload, label, formatter, labelFormatter, suffix = "" }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-2xl border border-line bg-cream/95 px-4 py-3 shadow-soft backdrop-blur">
      {label !== undefined && label !== null && (
        <p className="mb-1 text-xs font-bold text-ink">
          {labelFormatter ? labelFormatter(label) : label}
        </p>
      )}
      {payload.map((item, index) => (
        <p key={index} className="flex items-center gap-2 text-xs text-muted">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: item.color || item.payload?.fill || "#1A5255" }}
          />
          <span className="font-semibold text-ink">
            {formatter ? formatter(item.value, item.name) : item.value}
            {suffix}
          </span>
          {item.name && <span>{item.name}</span>}
        </p>
      ))}
    </div>
  );
}
