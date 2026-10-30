import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  CalendarDays,
  CalendarPlus,
  ChartNoAxesCombined,
  CreditCard,
  HeartPulse,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircle,
  MessagesSquare,
  Settings,
  Sparkles,
  Star,
  Stethoscope,
  Users,
  Video,
  Wallet,
  X,
} from "lucide-react";
import clsx from "clsx";
import Logo from "../Logo";
import LanguageSwitch from "../LanguageSwitch";
import NotificationBell from "../NotificationBell";
import Avatar from "../ui/Avatar";
import { useAuth } from "../../contexts/AuthContext";
import { useI18n } from "../../contexts/I18nContext";

const NAV = {
  patient: [
    { to: "/app", end: true, icon: LayoutDashboard, fr: "Vue d'ensemble", en: "Overview" },
    { to: "/app/questionnaire", icon: Sparkles, fr: "Recommandation IA", en: "AI recommendation" },
    { to: "/app/reserver", icon: CalendarPlus, fr: "Prendre rendez-vous", en: "Book a session" },
    { to: "/app/seances", icon: Video, fr: "Mes séances", en: "My sessions" },
    { to: "/app/humeur", icon: HeartPulse, fr: "Journal d'humeur", en: "Mood journal" },
    { to: "/app/paiements", icon: Wallet, fr: "Paiements", en: "Payments" },
    { to: "/app/messages", icon: MessageCircle, fr: "Messages", en: "Messages" },
    { to: "/app/retours", icon: Star, fr: "Avis & support", en: "Reviews & support" },
    { to: "/app/parametres", icon: Settings, fr: "Paramètres", en: "Settings" },
  ],
  therapist: [
    { to: "/pro", end: true, icon: LayoutDashboard, fr: "Tableau de bord", en: "Dashboard" },
    { to: "/pro/agenda", icon: CalendarDays, fr: "Mon agenda", en: "My calendar" },
    { to: "/pro/demandes", icon: CalendarPlus, fr: "Demandes", en: "Requests" },
    { to: "/pro/patients", icon: Users, fr: "Mes patients", en: "My patients" },
    { to: "/pro/seances", icon: Video, fr: "Séances", en: "Sessions" },
    { to: "/pro/messages", icon: MessagesSquare, fr: "Messages", en: "Messages" },
    { to: "/pro/avis", icon: Star, fr: "Avis & réclamations", en: "Reviews & complaints" },
    { to: "/pro/parametres", icon: Settings, fr: "Paramètres", en: "Settings" },
  ],
  admin: [
    { to: "/admin", end: true, icon: ChartNoAxesCombined, fr: "Tableau de bord", en: "Dashboard" },
    { to: "/admin/utilisateurs", icon: Users, fr: "Utilisateurs", en: "Users" },
    { to: "/admin/therapeutes", icon: Stethoscope, fr: "Thérapeutes", en: "Therapists" },
    { to: "/admin/seances", icon: CalendarDays, fr: "Séances", en: "Sessions" },
    { to: "/admin/paiements", icon: CreditCard, fr: "Paiements", en: "Payments" },
    { to: "/admin/reclamations", icon: MessageCircle, fr: "Réclamations", en: "Complaints" },
    { to: "/admin/parametres", icon: Settings, fr: "Paramètres", en: "Settings" },
  ],
};

const ROLE_LABEL = {
  patient: { fr: "Espace patient", en: "Patient space" },
  therapist: { fr: "Espace praticien", en: "Therapist space" },
  admin: { fr: "Administration", en: "Administration" },
};

export default function DashboardLayout() {
  const { user, role, logout, displayName } = useAuth();
  const { t, lang } = useI18n();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const items = NAV[role] || NAV.patient;
  const current = [...items]
    .sort((a, b) => b.to.length - a.to.length)
    .find((item) => location.pathname === item.to || (!item.end && location.pathname.startsWith(item.to)));
  const roleLabel = ROLE_LABEL[role] || ROLE_LABEL.patient;

  useEffect(() => {
    setMobileOpen(false);
    window.scrollTo(0, 0);
  }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  async function handleLogout() {
    setLoggingOut(true);
    await logout();
    navigate("/");
  }

  return (
    <div className="min-h-screen bg-cream">
      {mobileOpen && (
        <button
          type="button"
          aria-label="Fermer le menu"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-ink/40 backdrop-blur-sm lg:hidden"
        />
      )}

      <aside
        className={clsx(
          "fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-gradient-to-b from-teal-500 via-teal-600 to-teal-800 text-cream transition-transform duration-300 lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="pointer-events-none absolute inset-0 opacity-[0.07] dot-grid" />
        <div className="relative flex h-20 items-center justify-between px-5">
          <Logo tone="light" />
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="rounded-full p-2 text-cream/70 hover:bg-white/10 lg:hidden"
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="relative mx-4 mb-4 rounded-2xl border border-white/10 bg-white/5 px-3.5 py-2.5">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sage-300">
            {t(roleLabel.fr, roleLabel.en)}
          </p>
          <p className="mt-0.5 truncate text-sm font-bold text-cream">{displayName}</p>
        </div>

        <nav className="thin-scrollbar relative flex-1 space-y-1 overflow-y-auto px-3 pb-4">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  clsx(
                    "group flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-sm font-semibold transition",
                    isActive
                      ? "bg-cream text-teal-700 shadow-[0_10px_30px_-16px_rgba(0,0,0,0.6)]"
                      : "text-cream/70 hover:bg-white/10 hover:text-cream",
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon className={clsx("h-[18px] w-[18px] shrink-0", isActive ? "text-teal-500" : "text-sage-300/80")} />
                    <span className="truncate">{t(item.fr, item.en)}</span>
                    {isActive && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-terracotta" />}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        <div className="relative border-t border-white/10 p-3">
          <div className="flex items-center gap-3 rounded-2xl bg-white/5 p-3">
            <Avatar src={user?.avatar} name={displayName} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-cream">{displayName}</p>
              <p className="truncate text-[10px] text-cream/50">{user?.email}</p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className="rounded-full p-2 text-cream/60 transition hover:bg-white/10 hover:text-cream"
              aria-label={t("Se déconnecter", "Sign out")}
              title={t("Se déconnecter", "Sign out")}
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-30 border-b border-line/60 bg-cream/85 backdrop-blur-xl">
          <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-2">
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="icon-btn lg:hidden"
                aria-label="Ouvrir le menu"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-ink">
                  {current ? t(current.fr, current.en) : t("Mon espace", "My space")}
                </p>
                <p className="hidden text-[11px] text-muted sm:block">
                  {t(roleLabel.fr, roleLabel.en)} · TheraNova
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <LanguageSwitch className="hidden sm:inline-flex" />
              <NotificationBell />
              <Link to={`/${role === "admin" ? "admin" : role === "therapist" ? "pro" : "app"}/parametres`}>
                <Avatar src={user?.avatar} name={displayName} size="sm" className="ml-1 ring-2 ring-sage-200" />
              </Link>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>

        <footer className="mx-auto flex w-full max-w-[1440px] flex-col items-center justify-between gap-1 px-4 pb-6 text-[11px] text-muted sm:flex-row sm:px-6 lg:px-8">
          <p>© {new Date().getFullYear()} TheraNova</p>
          <p>{t("Un accompagnement humain, une technologie responsable.", "Human care, responsible technology.")}</p>
        </footer>
      </div>
    </div>
  );
}
