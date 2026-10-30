import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  BrainCircuit,
  CalendarCheck2,
  Check,
  CloudRain,
  Compass,
  HeartHandshake,
  HeartPulse,
  LockKeyhole,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Star,
  Stethoscope,
  Users,
  Video,
  Wallet,
} from "lucide-react";
import api, { unwrap } from "../lib/api";
import { useI18n } from "../contexts/I18nContext";
import { useAuth } from "../contexts/AuthContext";
import { buttonClass } from "../components/ui/Button";
import { SectionHeading } from "../components/ui/Card";
import TherapistCard from "../components/TherapistCard";
import Avatar from "../components/ui/Avatar";
import { Stars } from "../components/ui/Stars";
import { formatCurrency } from "../lib/format";

const ICONS = {
  "heart-pulse": HeartPulse,
  "cloud-rain": CloudRain,
  "heart-handshake": HeartHandshake,
  users: Users,
  shield: ShieldCheck,
  activity: Activity,
  compass: Compass,
  sparkles: Sparkles,
};

export default function Home() {
  const { t, lang } = useI18n();
  const { isAuthenticated, role } = useAuth();
  const [data, setData] = useState({
    therapists: [],
    count: 0,
    specialties: [],
    packs: [],
    reviews: [],
  });

  useEffect(() => {
    let active = true;
    async function load() {
      const [therapists, specialties, packs, reviews] = await Promise.allSettled([
        api.get("/accounts/therapists/", { params: { page_size: 4, ordering: "-note_globale" } }),
        api.get("/accounts/specialties/"),
        api.get("/billing/packs/"),
        api.get("/feedback/reviews/", { params: { page_size: 3 } }),
      ]);
      if (!active) return;
      setData({
        therapists: therapists.status === "fulfilled" ? unwrap(therapists.value.data) : [],
        count: therapists.status === "fulfilled" ? therapists.value.data.count || 0 : 0,
        specialties: specialties.status === "fulfilled" ? unwrap(specialties.value.data) : [],
        packs: packs.status === "fulfilled" ? unwrap(packs.value.data) : [],
        reviews: reviews.status === "fulfilled" ? unwrap(reviews.value.data) : [],
      });
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  const topTherapist = data.therapists[0];

  const steps = useMemo(
    () => [
      {
        icon: Sparkles,
        fr: "Exprimez votre ressenti",
        en: "Share how you feel",
        textFr:
          "12 questions bienveillantes et un espace libre pour décrire ce qui vous pèse. Moins de 5 minutes, sans jugement.",
        textEn:
          "12 caring questions and a free space to describe what weighs on you. Under 5 minutes, without judgement.",
      },
      {
        icon: BrainCircuit,
        fr: "Recevez une recommandation",
        en: "Get a recommendation",
        textFr:
          "Notre moteur analyse vos réponses et vous propose les praticiens les plus adaptés, avec les raisons de chaque choix.",
        textEn:
          "Our engine analyses your answers and suggests the most suitable practitioners, explaining every choice.",
      },
      {
        icon: Video,
        fr: "Échangez en toute sécurité",
        en: "Connect securely",
        textFr:
          "Réservez un créneau, réglez en ligne et rejoignez votre séance en visioconférence. Votre suivi reste confidentiel.",
        textEn:
          "Book a slot, pay online and join your video session. Your care journey stays confidential.",
      },
    ],
    [],
  );

  const featuredReviews = data.reviews.filter((review) => review.commentaire).slice(0, 3);

  return (
    <div>
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute -right-40 top-0 h-[34rem] w-[34rem] rounded-full bg-sage-200/50 blur-3xl" />
        <div className="pointer-events-none absolute -left-24 bottom-0 h-72 w-72 rounded-full bg-teal-500/5 blur-2xl" />
        <div className="container-page relative grid gap-14 py-14 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-24">
          <div className="animate-fade-up">
            <div className="inline-flex items-center gap-2 rounded-full border border-teal-500/15 bg-white/70 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-teal-700">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-sage-300/60">
                <HeartPulse className="h-2.5 w-2.5" />
              </span>
              {t("Santé mentale · Algérie", "Mental health · Algeria")}
            </div>

            <h1 className="mt-6 text-[2.65rem] font-black leading-[1.04] tracking-tight text-ink sm:text-6xl">
              {t("La thérapie qui vous ressemble,", "Therapy that fits you,")}{" "}
              <span className="relative inline-block text-teal-500">
                {t("où que vous soyez.", "wherever you are.")}
                <svg
                  viewBox="0 0 300 12"
                  className="absolute -bottom-2 left-0 w-full text-sage-400"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <path d="M2 9C60 3 120 3 180 6c40 2 80 1 118-3" stroke="currentColor" strokeWidth="5" fill="none" strokeLinecap="round" />
                </svg>
              </span>
            </h1>

            <p className="mt-6 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
              {t(
                "Trouvez le praticien qui vous comprend, réservez votre séance et avancez à votre rythme. Une plateforme pensée pour les étudiants, les familles et tous ceux qui ont besoin d'être écoutés.",
                "Find the practitioner who understands you, book your session and move forward at your own pace. A platform designed for students, families and anyone who needs to be heard.",
              )}
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link to={isAuthenticated ? `/${role === "patient" ? "app" : role === "therapist" ? "pro" : "admin"}` : "/inscription"} className={buttonClass({ variant: "primary", size: "lg" })}>
                {t("Trouver mon thérapeute", "Find my therapist")}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/therapeutes" className={buttonClass({ variant: "outline", size: "lg" })}>
                <Stethoscope className="h-4 w-4" />
                {t("Explorer l'annuaire", "Browse directory")}
              </Link>
            </div>

            <div className="mt-9 flex flex-wrap items-center gap-x-7 gap-y-3 text-xs font-semibold text-muted">
              <span className="inline-flex items-center gap-1.5">
                <LockKeyhole className="h-4 w-4 text-teal-500" />
                {t("Données confidentielles", "Confidential data")}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-teal-500" />
                {t("Praticiens vérifiés", "Verified practitioners")}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <MessageCircle className="h-4 w-4 text-teal-500" />
                {t("Support humain 7j/7", "Human support 7/7")}
              </span>
            </div>
          </div>

          {/* HERO COLLAGE */}
          <div className="relative mx-auto w-full max-w-lg animate-fade-up animate-delay-2">
            <div className="absolute inset-x-6 top-6 h-full rotate-3 rounded-[3rem] bg-sage-300/50" />
            <div className="absolute inset-x-10 top-3 h-full -rotate-2 rounded-[3rem] bg-teal-500/10" />
            <div className="relative overflow-hidden rounded-[2.75rem] border border-white/70 bg-gradient-to-br from-sage-100 via-cream to-sage-200 p-6 shadow-lift">
              <div className="flex items-center justify-between">
                <span className="chip-sage">
                  <Sparkles className="h-3.5 w-3.5" />
                  {t("Recommandation personnalisée", "Personalised match")}
                </span>
                <div className="flex h-8 items-center gap-1 rounded-full bg-white/80 px-2.5 text-[10px] font-black text-teal-700">
                  <LockKeyhole className="h-3 w-3" />
                  {t("Privé", "Private")}
                </div>
              </div>

              <div className="mt-6 rounded-3xl bg-white p-5 shadow-card">
                <div className="flex items-center gap-3">
                  <Avatar
                    src={topTherapist?.user?.avatar}
                    name={topTherapist?.nom_complet || "Dr Belghoul"}
                    size="lg"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-teal-400">
                      {t("Votre praticien idéal", "Your ideal practitioner")}
                    </p>
                    <p className="truncate text-sm font-black text-ink">
                      {topTherapist?.nom_complet || "Dr Abdeldjalil Belghoul"}
                    </p>
                    <p className="flex items-center gap-1 text-xs text-muted">
                      <Star className="h-3 w-3 fill-gold text-gold" />
                      <span className="font-bold text-ink">
                        {Number(topTherapist?.note_globale || 4.9).toFixed(1)}
                      </span>
                      · {topTherapist?.ville || "Béjaïa"}
                    </p>
                  </div>
                  <span className="rounded-full bg-sage-200 px-2.5 py-1 text-[10px] font-black text-teal-800">
                    96%
                  </span>
                </div>

                <div className="mt-4 space-y-2">
                  {[
                    { fr: "Anxiété & gestion du stress", en: "Anxiety & stress", value: 92 },
                    { fr: "Confiance & estime de soi", en: "Self-confidence", value: 78 },
                    { fr: "Sommeil & récupération", en: "Sleep & recovery", value: 64 },
                  ].map((item) => (
                    <div key={item.fr}>
                      <div className="flex items-center justify-between text-[10px] font-bold text-muted">
                        <span>{t(item.fr, item.en)}</span>
                        <span className="text-teal-600">{item.value}%</span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-sand">
                        <div className="h-full rounded-full bg-teal-500" style={{ width: `${item.value}%` }} />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex items-center gap-2 rounded-2xl bg-sage-50 px-3 py-2.5 text-[11px] leading-snug text-teal-800">
                  <Check className="h-3.5 w-3.5 shrink-0 text-success" />
                  {t(
                    "Explique pourquoi ce praticien vous correspond.",
                    "Explains why this practitioner is a good fit.",
                  )}
                </div>
              </div>

              <div className="mt-4 flex items-center gap-3 rounded-2xl bg-white/85 p-3.5 shadow-card">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-teal-500 text-cream">
                  <CalendarCheck2 className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted">
                    {t("Prochain créneau", "Next available")}
                  </p>
                  <p className="text-xs font-black text-ink">
                    {t("Aujourd'hui · 18:30", "Today · 6:30 PM")}
                  </p>
                </div>
                <span className="h-2 w-2 rounded-full bg-success pulse-soft animate-pulse-soft" />
              </div>
            </div>

            <div className="absolute -bottom-5 -left-4 hidden items-center gap-2 rounded-2xl bg-white px-4 py-3 shadow-soft sm:flex">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gold/25">
                <Star className="h-4 w-4 fill-gold text-gold" />
              </span>
              <div>
                <p className="text-xs font-black text-ink">4,9 / 5</p>
                <p className="text-[10px] text-muted">{t("Satisfaction patients", "Patient satisfaction")}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* METRICS */}
      <section className="container-page">
        <div className="grid gap-3 rounded-3xl border border-line/80 bg-white/70 p-5 backdrop-blur sm:grid-cols-2 lg:grid-cols-4">
          {[
            { value: data.count ? `${data.count}+` : "6+", fr: "Praticiens vérifiés", en: "Verified practitioners" },
            { value: data.specialties.length ? `${data.specialties.length}` : "8", fr: "Spécialités couvertes", en: "Specialties covered" },
            { value: "4,9/5", fr: "Note moyenne des patients", en: "Average patient rating" },
            { value: "< 5 min", fr: "Pour trouver un praticien", en: "To find a practitioner" },
          ].map((metric) => (
            <div key={metric.fr} className="flex flex-col items-center rounded-2xl px-3 py-4 text-center">
              <p className="text-2xl font-black tracking-tight text-teal-600">{metric.value}</p>
              <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-muted">
                {t(metric.fr, metric.en)}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="container-page py-20">
        <SectionHeading
          overline={t("Simple et humain", "Simple and human")}
          title={t("Trois étapes pour commencer", "Three steps to begin")}
          description={t(
            "De la première question à la première séance, tout est pensé pour réduire les frictions et préserver votre intimité.",
            "From the first question to the first session, everything is designed to reduce friction and protect your privacy.",
          )}
          align="center"
        />
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <div key={step.fr} className="card relative overflow-hidden p-7">
                <span className="absolute -right-3 -top-6 text-[7rem] font-black leading-none text-sage-100/80">
                  {index + 1}
                </span>
                <span className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-500 text-cream">
                  <Icon className="h-6 w-6" />
                </span>
                <h3 className="relative mt-5 text-lg font-black text-ink">{t(step.fr, step.en)}</h3>
                <p className="relative mt-2 text-sm leading-relaxed text-muted">
                  {t(step.textFr, step.textEn)}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* SPECIALTIES */}
      <section className="bg-sage-100/50 py-20">
        <div className="container-page">
          <SectionHeading
            overline={t("Un accompagnement pour chaque besoin", "Support for every need")}
            title={t("Explorez nos spécialités", "Explore our specialties")}
            description={t(
              "Des praticiens formés à des approches complémentaires, pour vous accompagner dans les moments de vie les plus variés.",
              "Practitioners trained in complementary approaches, supporting you through the many seasons of life.",
            )}
            action={
              <Link to="/therapeutes" className={buttonClass({ variant: "outline" })}>
                {t("Voir tous les praticiens", "View all practitioners")}
                <ArrowRight className="h-4 w-4" />
              </Link>
            }
          />
          <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(data.specialties.length ? data.specialties : []).map((specialty) => {
              const Icon = ICONS[specialty.icone] || Sparkles;
              return (
                <Link
                  key={specialty.id}
                  to={`/therapeutes?specialite=${specialty.id}`}
                  className="group rounded-3xl border border-transparent bg-white p-6 shadow-card transition hover:-translate-y-1 hover:border-sage-300 hover:shadow-soft"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sage-100 text-teal-600 transition group-hover:bg-teal-500 group-hover:text-cream">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 text-sm font-black leading-snug text-ink">
                    {lang === "en" && specialty.nom_en ? specialty.nom_en : specialty.nom}
                  </h3>
                  <p className="mt-1 text-[11px] font-semibold text-muted">
                    {specialty.nombre_therapeutes || 0}{" "}
                    {t("praticien(s)", "practitioner(s)")}
                  </p>
                  <ArrowRight className="mt-4 h-4 w-4 text-sage-400 transition group-hover:translate-x-1 group-hover:text-teal-500" />
                </Link>
              );
            })}
            {!data.specialties.length &&
              [1, 2, 3, 4, 5, 6, 7, 8].map((item) => (
                <div key={item} className="h-40 animate-pulse rounded-3xl bg-white/70" />
              ))}
          </div>
        </div>
      </section>

      {/* FEATURED THERAPISTS */}
      <section className="container-page py-20">
        <SectionHeading
          overline={t("Des visages, pas des algorithmes", "Faces, not algorithms")}
          title={t("Rencontrez nos praticiens", "Meet our practitioners")}
          description={t(
            "Chaque profil est vérifié par notre équipe. La technologie propose, vous choisissez toujours.",
            "Every profile is verified by our team. Technology suggests, you always choose.",
          )}
          action={
            <Link to="/therapeutes" className="link inline-flex items-center gap-1 text-sm">
              {t("Tout l'annuaire", "Full directory")}
              <ArrowRight className="h-4 w-4" />
            </Link>
          }
        />
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {data.therapists.map((therapist) => (
            <TherapistCard key={therapist.id} therapist={therapist} compact />
          ))}
          {!data.therapists.length &&
            [1, 2, 3, 4].map((item) => <div key={item} className="h-72 animate-pulse rounded-3xl bg-white/70" />)}
        </div>
      </section>

      {/* AI SECTION */}
      <section className="container-page pb-20">
        <div className="relative overflow-hidden rounded-[2.5rem] bg-teal-500 px-6 py-12 text-cream sm:px-12 lg:px-16">
          <div className="pointer-events-none absolute -right-20 -top-24 h-80 w-80 rounded-full bg-teal-400/30 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-28 left-1/3 h-72 w-72 rounded-full bg-sage-300/10 blur-2xl" />
          <div className="relative grid gap-10 lg:grid-cols-[1fr_0.9fr] lg:items-center">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-sage-200">
                <BrainCircuit className="h-3.5 w-3.5" />
                {t("Intelligence artificielle responsable", "Responsible AI")}
              </span>
              <h2 className="mt-5 max-w-lg text-3xl font-black leading-tight text-cream sm:text-4xl">
                {t(
                  "Une recommandation transparente, jamais une décision à votre place.",
                  "A transparent recommendation, never a decision made for you.",
                )}
              </h2>
              <p className="mt-4 max-w-lg text-sm leading-relaxed text-cream/70">
                {t(
                  "Notre moteur pondère vos réponses, votre texte libre et vos préférences pour classer les praticiens. Chaque suggestion est expliquée. Vous restez libre de choisir un autre profil.",
                  "Our engine weighs your answers, free text and preferences to rank practitioners. Every suggestion is explained. You remain free to choose another profile.",
                )}
              </p>
              <ul className="mt-6 space-y-3">
                {[
                  {
                    fr: "Analyse sémantique locale, sans envoi de vos données à un tiers",
                    en: "Local semantic analysis, without sending your data to a third party",
                  },
                  {
                    fr: "Détection des signaux de détresse avec orientation vers un professionnel",
                    en: "Distress signal detection with referral to a professional",
                  },
                  {
                    fr: "Un score d'affinité et des raisons lisibles, pas une boîte noire",
                    en: "An affinity score and readable reasons, not a black box",
                  },
                ].map((item) => (
                  <li key={item.fr} className="flex items-start gap-2.5 text-sm text-cream/80">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sage-300/20">
                      <Check className="h-3 w-3 text-sage-200" />
                    </span>
                    {t(item.fr, item.en)}
                  </li>
                ))}
              </ul>
              <Link to="/app/questionnaire" className={buttonClass({ variant: "secondary", className: "mt-8" })}>
                <Sparkles className="h-4 w-4" />
                {t("Faire le questionnaire", "Take the questionnaire")}
              </Link>
            </div>

            <div className="rounded-3xl bg-cream p-5 text-ink shadow-lift">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-teal-400">
                  {t("Analyse de vos réponses", "Your answers analysis")}
                </p>
                <span className="chip-sage !text-[9px]">3 min</span>
              </div>
              <div className="mt-4 space-y-3">
                {[
                  { fr: "Anxiété & stress", en: "Anxiety & stress", value: 86 },
                  { fr: "Sommeil", en: "Sleep", value: 71 },
                  { fr: "Confiance en soi", en: "Self-confidence", value: 58 },
                  { fr: "Relations", en: "Relationships", value: 42 },
                ].map((row) => (
                  <div key={row.fr}>
                    <div className="mb-1 flex items-center justify-between text-[11px] font-bold">
                      <span className="text-teal-800">{t(row.fr, row.en)}</span>
                      <span className="text-muted">{row.value}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-sand">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-sage-400 to-teal-500"
                        style={{ width: `${row.value}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-5 rounded-2xl bg-sage-100/70 p-4">
                <p className="text-[10px] font-black uppercase tracking-wider text-teal-500">
                  {t("Praticien recommandé", "Recommended practitioner")}
                </p>
                <div className="mt-2 flex items-center gap-3">
                  <Avatar name="Dr Imene Bouchareb" size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black">Dr Imene Bouchareb</p>
                    <p className="text-[11px] text-muted">
                      {t("Anxiété · 9 ans d'expérience · Alger", "Anxiety · 9 years · Algiers")}
                    </p>
                  </div>
                  <span className="rounded-full bg-teal-500 px-2 py-1 text-[10px] font-black text-cream">92%</span>
                </div>
                <p className="mt-3 text-[11px] leading-relaxed text-muted">
                  {t(
                    "« Votre besoin de comprendre et d'apaiser le stress correspond à son approche TCC. »",
                    "\"Your need to understand and soothe stress matches her CBT approach.\"",
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PACKS */}
      {data.packs.length > 0 && (
        <section className="bg-sage-100/50 py-20">
          <div className="container-page">
            <SectionHeading
              overline={t("Un budget maîtrisé", "Clear pricing")}
              title={t("Des packs pensés pour durer", "Packs built to last")}
              description={t(
                "Payez à la séance ou choisissez un pack pour ancrer votre suivi dans le temps. Paiement BaridiMob & Edahabia.",
                "Pay per session or choose a pack to anchor your care over time. BaridiMob & Edahabia payments.",
              )}
              action={
                <Link to="/packs" className={buttonClass({ variant: "outline" })}>
                  {t("Comparer les packs", "Compare packs")}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              }
            />
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {data.packs.map((pack) => (
                <div
                  key={pack.id}
                  className={
                    pack.is_featured
                      ? "relative rounded-3xl border-2 border-teal-500 bg-white p-7 shadow-soft"
                      : "rounded-3xl border border-line bg-white p-7"
                  }
                >
                  {pack.is_featured && (
                    <span className="absolute -top-3 left-6 rounded-full bg-teal-500 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-cream">
                      {t("Le plus choisi", "Most chosen")}
                    </span>
                  )}
                  <p className="text-sm font-black text-ink">{pack.nom_pack}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted">{pack.description}</p>
                  <p className="mt-5 text-3xl font-black text-teal-600">{formatCurrency(pack.prix, lang)}</p>
                  <p className="mt-1 text-xs text-muted">
                    {pack.nb_sessions} {t("séance(s)", "session(s)")} ·{" "}
                    {formatCurrency(pack.prix_unitaire, lang)} / {t("séance", "session")}
                  </p>
                  <Link
                    to={isAuthenticated ? "/app/paiements" : "/inscription"}
                    className={buttonClass({ variant: pack.is_featured ? "primary" : "outline", className: "mt-6 w-full" })}
                  >
                    {t("Choisir ce pack", "Choose this pack")}
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* REVIEWS */}
      {featuredReviews.length > 0 && (
        <section className="container-page py-20">
          <SectionHeading
            overline={t("Ils ont fait le pas", "They took the step")}
            title={t("Des parcours, pas des promesses", "Journeys, not promises")}
            align="center"
          />
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {featuredReviews.map((review) => (
              <figure key={review.id} className="card flex h-full flex-col p-6">
                <Stars value={review.note} />
                <blockquote className="mt-4 flex-1 text-sm leading-relaxed text-ink/85">
                  “{review.commentaire}”
                </blockquote>
                <figcaption className="mt-5 flex items-center gap-3 border-t border-line/70 pt-4">
                  <Avatar src={review.patient_avatar} name={review.patient_nom} size="sm" />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-black text-ink">{review.patient_nom}</p>
                    <p className="truncate text-[10px] text-muted">
                      {t("Suivi avec", "Followed by")} {review.therapeute_nom}
                    </p>
                  </div>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="container-page pb-20">
        <div className="relative overflow-hidden rounded-[2.5rem] border border-sage-300/60 bg-sage-200 px-6 py-14 text-center sm:px-12">
          <div className="pointer-events-none absolute inset-0 dot-grid opacity-30" />
          <div className="relative mx-auto max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-teal-700">
              <Sparkles className="h-3.5 w-3.5" />
              {t("Premier pas offert", "First step is free")}
            </span>
            <h2 className="mt-5 text-3xl font-black text-ink sm:text-4xl">
              {t("Prendre soin de soi n'est pas un luxe.", "Caring for yourself is not a luxury.")}
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-teal-800/70">
              {t(
                "Le questionnaire est gratuit et confidentiel. Vous ne payez que lorsque vous choisissez votre séance.",
                "The questionnaire is free and confidential. You only pay when you choose your session.",
              )}
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Link to="/inscription" className={buttonClass({ variant: "primary", size: "lg" })}>
                {t("Créer mon espace", "Create my account")}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/therapeutes" className={buttonClass({ variant: "outline", size: "lg" })}>
                {t("Voir les praticiens", "See practitioners")}
              </Link>
            </div>
            <p className="mt-5 inline-flex items-center gap-1.5 text-[11px] font-semibold text-teal-800/60">
              <Wallet className="h-3.5 w-3.5" />
              {t("BaridiMob · Edahabia · Paiement sécurisé", "BaridiMob · Edahabia · Secure payment")}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
