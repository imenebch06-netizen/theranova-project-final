import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import {
  ArrowRight,
  Heart,
  LockKeyhole,
  Mail,
  MapPin,
  Menu,
  Phone,
  X,
} from "lucide-react";
import clsx from "clsx";
import Logo from "../Logo";
import LanguageSwitch from "../LanguageSwitch";
import { useAuth, roleHome } from "../../contexts/AuthContext";
import { useI18n } from "../../contexts/I18nContext";
import { buttonClass } from "../ui/Button";

export default function PublicLayout() {
  const { t } = useI18n();
  const { isAuthenticated, role } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setOpen(false);
    window.scrollTo(0, 0);
  }, [location.pathname]);

  const links = [
    { to: "/", label: t("Accueil", "Home"), end: true },
    { to: "/therapeutes", label: t("Thérapeutes", "Therapists") },
    { to: "/packs", label: t("Tarifs & packs", "Pricing") },
    { to: "/a-propos", label: t("À propos", "About") },
    { to: "/contact", label: t("Contact", "Contact") },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-50 border-b border-line/60 bg-cream/85 backdrop-blur-xl">
        <div className="container-page flex h-20 items-center justify-between gap-4 py-3">
          <Logo />

          <nav className="hidden items-center gap-1 lg:flex">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) =>
                  clsx(
                    "rounded-full px-4 py-2 text-sm font-bold transition",
                    isActive ? "bg-sage-200/70 text-teal-800" : "text-muted hover:bg-sand/80 hover:text-teal-600",
                  )
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>

          <div className="hidden items-center gap-2 lg:flex">
            <LanguageSwitch />
            {isAuthenticated ? (
              <Link to={roleHome(role)} className={buttonClass({ variant: "primary", size: "sm" })}>
                {t("Mon espace", "My space")}
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <>
                <Link to="/connexion" className="btn-ghost btn-sm">
                  {t("Connexion", "Sign in")}
                </Link>
                <Link to="/inscription" className={buttonClass({ variant: "primary", size: "sm" })}>
                  {t("Commencer", "Get started")}
                </Link>
              </>
            )}
          </div>

          <button
            type="button"
            className="icon-btn lg:hidden"
            onClick={() => setOpen((value) => !value)}
            aria-label={t("Menu", "Menu")}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {open && (
          <div className="border-t border-line/60 bg-cream px-4 pb-5 pt-3 lg:hidden">
            <nav className="flex flex-col gap-1">
              {links.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.end}
                  className={({ isActive }) =>
                    clsx(
                      "rounded-2xl px-4 py-3 text-sm font-bold",
                      isActive ? "bg-sage-200 text-teal-800" : "text-muted hover:bg-sand",
                    )
                  }
                >
                  {link.label}
                </NavLink>
              ))}
            </nav>
            <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-4">
              <LanguageSwitch />
              {isAuthenticated ? (
                <Link to={roleHome(role)} className={buttonClass({ variant: "primary", size: "sm" })}>
                  {t("Mon espace", "My space")}
                </Link>
              ) : (
                <div className="flex gap-2">
                  <Link to="/connexion" className="btn-outline btn-sm">
                    {t("Connexion", "Sign in")}
                  </Link>
                  <Link to="/inscription" className={buttonClass({ variant: "primary", size: "sm" })}>
                    {t("S'inscrire", "Sign up")}
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="mt-20 bg-teal-800 text-cream">
        <div className="container-page grid gap-10 py-14 md:grid-cols-2 lg:grid-cols-4">
          <div className="max-w-xs">
            <Logo tone="light" />
            <p className="mt-4 text-sm leading-relaxed text-cream/65">
              {t(
                "La thérapie accessible, intelligente et sécurisée. Un accompagnement humain, renforcé par une technologie responsable.",
                "Accessible, intelligent and secure therapy. Human care, strengthened by responsible technology.",
              )}
            </p>
            <div className="mt-5 flex items-center gap-2 text-xs text-cream/60">
              <LockKeyhole className="h-4 w-4 text-sage-300" />
              {t("Données chiffrées · Hébergement souverain", "Encrypted data · Sovereign hosting")}
            </div>
          </div>

          <div>
            <h3 className="text-xs font-black uppercase tracking-[0.18em] text-sage-300">
              {t("Plateforme", "Platform")}
            </h3>
            <ul className="mt-4 space-y-2.5 text-sm text-cream/70">
              <li><Link to="/therapeutes" className="hover:text-cream">{t("Annuaire des thérapeutes", "Therapist directory")}</Link></li>
              <li><Link to="/packs" className="hover:text-cream">{t("Packs & abonnements", "Packs & subscriptions")}</Link></li>
              <li><Link to="/inscription" className="hover:text-cream">{t("Devenir patient", "Become a patient")}</Link></li>
              <li><Link to="/inscription/therapeute" className="hover:text-cream">{t("Rejoindre comme thérapeute", "Join as a therapist")}</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-black uppercase tracking-[0.18em] text-sage-300">
              {t("Confiance", "Trust")}
            </h3>
            <ul className="mt-4 space-y-2.5 text-sm text-cream/70">
              <li><Link to="/a-propos" className="hover:text-cream">{t("Notre mission", "Our mission")}</Link></li>
              <li><Link to="/a-propos#securite" className="hover:text-cream">{t("Sécurité & confidentialité", "Security & privacy")}</Link></li>
              <li><Link to="/contact" className="hover:text-cream">{t("Aide & contact", "Help & contact")}</Link></li>
              <li><Link to="/contact" className="hover:text-cream">{t("Signaler un problème", "Report an issue")}</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-black uppercase tracking-[0.18em] text-sage-300">
              {t("Contact", "Contact")}
            </h3>
            <ul className="mt-4 space-y-3 text-sm text-cream/70">
              <li className="flex items-start gap-2.5">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-sage-300" />
                {t("ESTIN, Béjaïa — Algérie", "ESTIN, Béjaïa — Algeria")}
              </li>
              <li className="flex items-center gap-2.5">
                <Mail className="h-4 w-4 shrink-0 text-sage-300" />
                <a href="mailto:contact@theranova.dz" className="hover:text-cream">contact@theranova.dz</a>
              </li>
              <li className="flex items-center gap-2.5">
                <Phone className="h-4 w-4 shrink-0 text-sage-300" />
                +213 (0) 34 00 00 00
              </li>
            </ul>
            <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-cream/70">
              <Heart className="h-3.5 w-3.5 text-sage-300" />
              {t("Projet académique ESTIN", "ESTIN academic project")}
            </div>
          </div>
        </div>
        <div className="border-t border-white/10">
          <div className="container-page flex flex-col items-center justify-between gap-2 py-5 text-xs text-cream/45 sm:flex-row">
            <p>© {new Date().getFullYear()} TheraNova. {t("Tous droits réservés.", "All rights reserved.")}</p>
            <p>
              {t("Conçu avec soin à Béjaïa", "Crafted with care in Béjaïa")} ·{" "}
              {t("Charte #CCD5B5 · #1A5255 · #FFFBF0", "Palette #CCD5B5 · #1A5255 · #FFFBF0")}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
