import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BadgeCheck,
  Check,
  CreditCard,
  HelpCircle,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  Wallet,
} from "lucide-react";
import api, { unwrap } from "../lib/api";
import { useI18n } from "../contexts/I18nContext";
import { useAuth } from "../contexts/AuthContext";
import { buttonClass } from "../components/ui/Button";
import { SectionHeading } from "../components/ui/Card";
import { formatCurrency } from "../lib/format";
import { LoadingBlock } from "../components/ui/Feedback";

export default function Packs() {
  const { t, lang } = useI18n();
  const { isAuthenticated, role } = useAuth();
  const [packs, setPacks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/billing/packs/")
      .then(({ data }) => setPacks(unwrap(data) || []))
      .catch(() => setPacks([]))
      .finally(() => setLoading(false));
  }, []);

  const cta = !isAuthenticated ? "/inscription" : role === "patient" ? "/app/paiements" : "/espace";

  const faqs = [
    {
      fr: "Puis-je changer de thérapeute en cours de pack ?",
      en: "Can I change therapist during a pack?",
      answerFr:
        "Oui. Les séances restantes de votre pack sont utilisables avec tout praticien du réseau, sans frais supplémentaires.",
      answerEn:
        "Yes. Remaining sessions in your pack can be used with any practitioner in the network, at no extra cost.",
    },
    {
      fr: "Les séances sont-elles remboursables ?",
      en: "Are sessions refundable?",
      answerFr:
        "Une séance annulée au moins 24 h à l'avance est recréditée automatiquement. Passé ce délai, le praticien reste rémunéré pour le créneau réservé.",
      answerEn:
        "A session cancelled at least 24 hours in advance is automatically credited back. After that, the practitioner is still paid for the reserved slot.",
    },
    {
      fr: "Quels moyens de paiement acceptez-vous ?",
      en: "Which payment methods do you accept?",
      answerFr:
        "BaridiMob, carte Edahabia, CIB et crédit TheraNova. Les paiements sont simulés dans cette démonstration académique.",
      answerEn:
        "BaridiMob, Edahabia card, CIB and TheraNova credit. Payments are simulated in this academic demonstration.",
    },
    {
      fr: "Mes données de paiement sont-elles conservées ?",
      en: "Is my payment data stored?",
      answerFr:
        "Aucune donnée bancaire sensible n'est stockée. Seules la référence de transaction et la facture sont conservées.",
      answerEn:
        "No sensitive banking data is stored. Only the transaction reference and invoice are kept.",
    },
  ];

  return (
    <div>
      <section className="relative overflow-hidden border-b border-line/60 bg-sage-100/50">
        <div className="container-page py-14 text-center sm:py-20">
          <span className="chip-sage mx-auto">
            <Wallet className="h-3.5 w-3.5" />
            {t("Transparence tarifaire", "Transparent pricing")}
          </span>
          <h1 className="mx-auto mt-5 max-w-3xl text-4xl font-black tracking-tight text-ink sm:text-5xl">
            {t("Investir dans votre santé mentale, sans surprise.", "Invest in your mental health, without surprises.")}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
            {t(
              "Choisissez la formule qui correspond à votre rythme. Tous les packs incluent la visioconférence, le suivi d'humeur et la messagerie sécurisée.",
              "Choose the plan that fits your pace. Every pack includes video sessions, mood tracking and secure messaging.",
            )}
          </p>
        </div>
      </section>

      <section className="container-page py-14">
        {loading ? (
          <LoadingBlock label={t("Chargement des tarifs…", "Loading pricing…")} />
        ) : (
          <div className="grid gap-5 md:grid-cols-3">
            {packs.map((pack) => (
              <div
                key={pack.id}
                className={
                  pack.is_featured
                    ? "relative flex flex-col rounded-[2rem] border-2 border-teal-500 bg-white p-7 shadow-soft lg:-translate-y-2"
                    : "relative flex flex-col rounded-[2rem] border border-line bg-white p-7"
                }
              >
                {pack.is_featured && (
                  <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-teal-500 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-cream">
                    {t("Le plus choisi", "Most chosen")}
                  </span>
                )}
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-black text-ink">{pack.nom_pack}</h2>
                  {pack.is_featured && <Sparkles className="h-5 w-5 text-gold" />}
                </div>
                <p className="mt-2 min-h-[2.5rem] text-xs leading-relaxed text-muted">{pack.description}</p>
                <div className="mt-6">
                  <span className="text-4xl font-black tracking-tight text-teal-600">
                    {formatCurrency(pack.prix, lang)}
                  </span>
                  <p className="mt-1 text-xs font-semibold text-muted">
                    {pack.nb_sessions} {t("séance(s)", "session(s)")} ·{" "}
                    {formatCurrency(pack.prix_unitaire, lang)} / {t("séance", "session")}
                  </p>
                </div>
                <ul className="mt-6 flex-1 space-y-2.5 text-sm text-muted">
                  {[
                    t(`${pack.nb_sessions} séance(s) de 60 min`, `${pack.nb_sessions} session(s) of 60 min`),
                    t(`Validité ${pack.duree_jours} jours`, `${pack.duree_jours}-day validity`),
                    t("Visioconférence sécurisée", "Secure video consultation"),
                    t("Messagerie avec votre praticien", "Messaging with your practitioner"),
                    t("Journal d'humeur & analyses", "Mood journal & insights"),
                  ].map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link
                  to={cta}
                  className={buttonClass({
                    variant: pack.is_featured ? "primary" : "outline",
                    className: "mt-7 w-full",
                  })}
                >
                  {t("Choisir cette formule", "Choose this plan")}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            ))}
          </div>
        )}

        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: LockKeyhole, fr: "Paiement chiffré", en: "Encrypted payment" },
            { icon: ShieldCheck, fr: "Praticiens vérifiés", en: "Verified practitioners" },
            { icon: CreditCard, fr: "BaridiMob & Edahabia", en: "BaridiMob & Edahabia" },
            { icon: BadgeCheck, fr: "Annulation flexible", en: "Flexible cancellation" },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.fr} className="flex items-center gap-3 rounded-2xl border border-line bg-white px-4 py-3">
                <Icon className="h-4 w-4 shrink-0 text-teal-500" />
                <span className="text-xs font-bold text-teal-800">{t(item.fr, item.en)}</span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="bg-sage-100/40 py-16">
        <div className="container-page max-w-4xl">
          <SectionHeading
            overline={t("Questions fréquentes", "Frequently asked")}
            title={t("Tout ce qu'il faut savoir avant de commencer", "Everything to know before starting")}
            align="center"
          />
          <div className="mt-8 space-y-3">
            {faqs.map((faq) => (
              <details key={faq.fr} className="group rounded-2xl border border-line bg-white px-5 py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-bold text-ink">
                  <span className="flex items-center gap-2">
                    <HelpCircle className="h-4 w-4 shrink-0 text-teal-500" />
                    {t(faq.fr, faq.en)}
                  </span>
                  <span className="text-lg text-teal-500 transition group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 pl-6 text-sm leading-relaxed text-muted">{t(faq.answerFr, faq.answerEn)}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="container-page py-16">
        <div className="rounded-[2rem] bg-teal-500 px-6 py-10 text-center text-cream sm:px-12">
          <h2 className="text-2xl font-black text-cream sm:text-3xl">
            {t("Besoin d'un conseil avant de choisir ?", "Need advice before choosing?")}
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-cream/65">
            {t(
              "Notre questionnaire gratuit vous oriente vers la formule et le praticien adaptés à votre situation.",
              "Our free questionnaire guides you to the plan and practitioner suited to your situation.",
            )}
          </p>
          <Link to={isAuthenticated ? "/app/questionnaire" : "/inscription"} className={buttonClass({ variant: "secondary", size: "lg", className: "mt-6" })}>
            <Sparkles className="h-4 w-4" />
            {t("Faire le questionnaire", "Take the questionnaire")}
          </Link>
        </div>
      </section>
    </div>
  );
}
