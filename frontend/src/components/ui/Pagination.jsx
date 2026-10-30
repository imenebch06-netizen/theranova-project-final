import { ChevronLeft, ChevronRight } from "lucide-react";
import { useI18n } from "../../contexts/I18nContext";

export default function Pagination({ page, count, pageSize = 20, onChange, className = "" }) {
  const { t } = useI18n();
  const totalPages = Math.max(1, Math.ceil(count / pageSize));
  if (totalPages <= 1) return null;

  const pages = [];
  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
  const end = Math.min(totalPages, start + 4);
  for (let index = start; index <= end; index += 1) pages.push(index);

  return (
    <div className={`flex items-center justify-between gap-3 ${className}`}>
      <p className="text-xs font-semibold text-muted">
        {t(`Page ${page} sur ${totalPages}`, `Page ${page} of ${totalPages}`)} · {count}{" "}
        {t("résultats", "results")}
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          className="icon-btn h-9 w-9 disabled:opacity-30"
          aria-label={t("Page précédente", "Previous page")}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        {pages.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => onChange(item)}
            className={
              item === page
                ? "h-9 min-w-9 rounded-full bg-teal-500 px-2 text-xs font-black text-cream"
                : "h-9 min-w-9 rounded-full px-2 text-xs font-bold text-muted transition hover:bg-sand"
            }
          >
            {item}
          </button>
        ))}
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
          className="icon-btn h-9 w-9 disabled:opacity-30"
          aria-label={t("Page suivante", "Next page")}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
