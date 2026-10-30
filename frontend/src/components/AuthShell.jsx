import { Link } from "react-router-dom";
import { ArrowLeft, Check, HeartPulse, LockKeyhole, ShieldCheck, Sparkles, Star } from "lucide-react";
import Logo from "./Logo";
import LanguageSwitch from "./LanguageSwitch";
import { useI18n } from "../contexts/I18nContext";
import { buttonClass } from "./ui/Button";

export default function AuthShell({ title, subtitle, children, footer, wide = false, aside }) {
  const { t } = useI18n();
  return (
    <div className="grid min-h-screen bg-cream lg:grid-cols-[0.95fr_1.05fr]">
      <aside className="relative hidden overflow-hidden bg-teal-500 p-10 text-cream lg:flex lg:flex-col">
        <div className="pointer-events-none absolute inset-0 dot-grid opacity-[0.08]" />
        <div className="pointer-events-none absolute -right-24 top-1/4 h-80 w-80 rounded-full bg-sage-300/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-teal-300/20 blur-3xl" />
        <div className="relative flex items-center justify-between">
          <Logo tone="light" />
          <LanguageSwitch tone="light" />
        </div>

        <div className="relative my-auto py-12">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-sage-200">
            <Sparkles className="h-3.5 w-3.5" />
            {t("La thérapie, autrement", "Therapy, reimagined")}
          </span>
          <h1 className="mt-6 max-w-md text-4xl font-black leading-[1.08] tracking-tight text-cream xl:text-5xl">
            {t("Un espace pour aller mieux, à votre rythme.", "A space to feel better, at your own pace.")}
          </h1>
          <p className="mt-5 max-w-md text-sm leading-relaxed text-cream/65">
            {t(
              "Des praticiens vérifiés, une recommandation transparente et un suivi confidentiel. TheraNova vous accompagne du premier doute à la première séance.",
              "Verified practitioners, transparent recommendations and confidential follow-up. TheraNova supports you from the first doubt to the first session.",
            )}
          </p>

          <ul className="mt-8 space-y-4">
            {[
              {
                icon: ShieldCheck,
                fr: "Dossiers protégés et accès strictement encadré",
                en: "Protected records with strictly controlled access",
              },
              {
                icon: HeartPulse,
                fr: "Suivi de l'humeur et messages bienveillants",
                en: "Mood tracking and caring messages",
              },
              {
                icon: LockKeyhole,
                fr: "Paiement sécurisé BaridiMob & Edahabia",
                en: "Secure BaridiMob & Edahabia payment",
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.fr} className="flex items-start gap-3 text-sm text-cream/80">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/10">
                    <Icon className="h-4 w-4 text-sage-300" />
                  </span>
                  {t(item.fr, item.en)}
                </li>
              );
            })}
          </ul>

          <div className="mt-10 max-w-sm rounded-3xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star key={star} className="h-3.5 w-3.5 fill-gold text-gold" />
              ))}
            </div>
            <p className="mt-2 text-sm leading-relaxed text-cream/80">
              {t(
                "« J'ai trouvé une praticienne qui m'a comprise dès la première séance. Le questionnaire m'a aidée à mettre des mots sur ce que je ressentais. »",
                "\"I found a practitioner who understood me from the very first session. The questionnaire helped me put words to what I was feeling.\"",
              )}
            </p>
            <p className="mt-3 text-[11px] font-bold text-sage-300">Lina, 23 ans · Béjaïa</p>
          </div>
        </div>

        <div className="relative flex items-center gap-2 text-[11px] text-cream/40">
          <LockKeyhole className="h-3.5 w-3.5" />
          {t("Conforme au secret médical · Données hébergées en Algérie", "Medical confidentiality · Data hosted in Algeria")}
        </div>
      </aside>

      <main className="flex min-h-screen flex-col">
        <div className="flex items-center justify-between px-4 py-5 lg:px-8">
          <Link to="/" className="inline-flex items-center gap-2 text-xs font-bold text-muted transition hover:text-teal-600">
            <ArrowLeft className="h-4 w-4" />
            {t("Retour au site", "Back to site")}
          </Link>
          <div className="flex items-center gap-3 lg:hidden">
            <Logo compact />
            <LanguageSwitch />
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center px-4 pb-12 pt-4 sm:px-8">
          <div className={wide ? "w-full max-w-2xl" : "w-full max-w-md"}>
            <div className="mb-7">
              <h2 className="text-3xl font-black tracking-tight text-ink">{title}</h2>
              {subtitle && <p className="mt-2 text-sm leading-relaxed text-muted">{subtitle}</p>}
            </div>
            {children}
            {footer && <div className="mt-6 text-center text-sm text-muted">{footer}</div>}
            {aside}
          </div>
        </div>

        <div className="px-4 pb-6 text-center text-[10px] text-muted">
          © {new Date().getFullYear()} TheraNova ·{" "}
          {t("Un accompagnement humain, une technologie responsable.", "Human care, responsible technology.")}
        </div>
      </main>
    </div>
  );
}
