import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  CalendarClock,
  CheckCheck,
  CreditCard,
  HeartPulse,
  MessageCircle,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import clsx from "clsx";
import api, { unwrap } from "../lib/api";
import { fromNow } from "../lib/format";
import { useI18n } from "../contexts/I18nContext";

const ICONS = {
  confirmation: CalendarClock,
  rappel: CalendarClock,
  message: MessageCircle,
  alerte: TriangleAlert,
  paiement: CreditCard,
  humeur: HeartPulse,
  questionnaire: Sparkles,
};

export default function NotificationBell() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef(null);

  const loadCount = useCallback(async () => {
    try {
      const { data } = await api.get("/messaging/unread/");
      setUnread(data.notifications || 0);
    } catch {
      /* silent */
    }
  }, []);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/messaging/notifications/", {
        params: { page_size: 8 },
      });
      setItems(unwrap(data) || []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCount();
    const interval = window.setInterval(loadCount, 45000);
    return () => window.clearInterval(interval);
  }, [loadCount]);

  useEffect(() => {
    if (!open) return undefined;
    loadItems();
    const onClick = (event) => {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open, loadItems]);

  async function markAll() {
    try {
      await api.post("/messaging/notifications/read-all/");
      setUnread(0);
      setItems((current) => current.map((item) => ({ ...item, statut: "lue" })));
    } catch {
      /* silent */
    }
  }

  async function openItem(item) {
    if (item.statut !== "lue") {
      try {
        await api.post(`/messaging/notifications/${item.id}/read/`);
        setUnread((value) => Math.max(0, value - 1));
        setItems((current) =>
          current.map((entry) => (entry.id === item.id ? { ...entry, statut: "lue" } : entry)),
        );
      } catch {
        /* silent */
      }
    }
    if (item.lien) {
      setOpen(false);
      navigate(item.lien);
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="icon-btn relative"
        aria-label={t("Notifications", "Notifications")}
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-terracotta px-1 text-[9px] font-black text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-3xl border border-line bg-cream shadow-lift animate-scale-in">
          <div className="flex items-center justify-between border-b border-line/70 px-4 py-3">
            <p className="text-sm font-black text-ink">{t("Notifications", "Notifications")}</p>
            <button
              type="button"
              onClick={markAll}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-teal-600 hover:text-teal-800"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              {t("Tout lire", "Mark all read")}
            </button>
          </div>
          <div className="thin-scrollbar max-h-96 overflow-y-auto">
            {loading && (
              <p className="px-4 py-8 text-center text-xs text-muted">{t("Chargement…", "Loading…")}</p>
            )}
            {!loading && items.length === 0 && (
              <p className="px-4 py-8 text-center text-xs text-muted">
                {t("Aucune notification pour le moment.", "No notifications yet.")}
              </p>
            )}
            {items.map((item) => {
              const Icon = ICONS[item.type] || Bell;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => openItem(item)}
                  className={clsx(
                    "flex w-full items-start gap-3 border-b border-line/50 px-4 py-3 text-left transition last:border-0 hover:bg-sand/70",
                    item.statut !== "lue" && "bg-sage-50/70",
                  )}
                >
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-sage-100 text-teal-600">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start justify-between gap-2">
                      <span className="text-xs font-bold text-ink">{item.titre}</span>
                      {item.statut !== "lue" && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-terracotta" />}
                    </span>
                    <span className="mt-0.5 block line-clamp-2 text-[11px] leading-relaxed text-muted">
                      {item.message}
                    </span>
                    <span className="mt-1 block text-[10px] font-semibold text-muted/80">
                      {fromNow(item.date_envoi, lang)}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
