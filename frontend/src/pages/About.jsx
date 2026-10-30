import { Link } from "react-router-dom";
import {
  ArrowRight,
  BrainCircuit,
  HeartHandshake,
  HeartPulse,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  Users,
  Video,
} from "lucide-react";
import { useI18n } from "../contexts/I18nContext";
import { buttonClass } from "../components/ui/Button";
import { SectionHeading } from "../components/ui/Card";
import Logo from "../components/Logo";

export default function About() {
  const { t } = useI18n();

  const values = [
    {
      icon: HeartHandshake,
      fr: "L'humain d'abord",
      en: "People first",
      textFr:
        "La technologie ne remplace jamais la relation thérapeutique. Elle réduit les obstacles entre vous et le professionnel qui peut vous aider.",
      textEn:
        "Technology never replaces the therapeutic relationship. It removes barriers between you and the professional who can help.",
    },
    {
      icon: ShieldCheck,
      fr: "Confidentialité radicale",
      en: "Radical confidentiality",
      textFr:
        "Vos données de santé sont sensibles. Accès minimal, chiffrement, traçabilité : chaque choix technique est guidé par cette exigence.",
      textEn:
        "Your health data is sensitive. Minimal access, encryption, audit trails: every technical decision is guided by this requirement.",
    },
    {
      icon: Sparkles,
      fr: "Transparence algorithmique",
      en: "Algorithmic transparency",
      textFr:
        "Chaque recommandation explique ses critères. Aucun profil n'est relégué dans l'ombre, aucun choix ne vous est imposé.",
      textEn:
        "Every recommendation explains its criteria. No profile is hidden, no choice is imposed on you.",
    },
    {
      icon: Users,
      fr: "Accessibilité réelle",
      en: "Real accessibility",
      textFr:
        "Des tarifs lisibles, des packs flexibles et une interface bilingue pensée pour les étudiants et les familles algériennes.",
      textEn:
        "Clear pricing, flexible packs and a bilingual interface designed for Algerian students and families.",
    },
  ];

  const timeline = [
    {
      year: "2023",
      fr: "Une observation de terrain",
      en: "A field observation",
      textFr:
        "À Béjaïa, les étudiants attendent des mois pour un rendez-vous. La stigmatisation et le coût restent les premiers freins.",
      textEn:
        "In Béjaïa, students wait months for an appointment. Stigma and cost remain the first barriers.",
    },
    {
      year: "2024",
      fr: "La conception TheraNova",
      en: "Designing TheraNova",
      textFr:
        "Une équipe d'étudiants ESTIN imagine une plateforme qui relie recommandation intelligente, téléconsultation et suivi continu.",
      textEn:
        "A team of ESTIN students imagines a platform linking intelligent matching, teleconsultation and continuous care.",
    },
    {
      year: "2025",
      fr: "Un prototype complet",
      en: "A complete prototype",
      textFr:
        "Questionnaire de 12 dimensions, espace praticien, dossier clinique, paiements locaux : l'ensemble du parcours prend vie.",
      textEn:
        "A 12-dimension questionnaire, practitioner workspace, clinical record and local payments: the whole journey comes to life.",
    },
    {
      year: "2026",
      fr: "Vers la mise en service",
      en: "Toward launch",
      textFr:
        "Partenariats cliniques, conformité et déploiement progressif afin d'accompagner durablement la santé mentale en Algérie.",
      textEn:
        "Clinical partnerships, compliance and a gradual rollout to support mental health in Algeria over the long term.",
    },
  ];

  return (
    <div>
      <section className="relative overflow-hidden border-b border-line/60 bg-sage-100/40">
        <div className="pointer-events-none absolute -right-32 -top-20 h-96 w-96 rounded-full bg-sage-300/40 blur-3xl" />
        <div className="container-page relative grid gap-10 py-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:py-24">
          <div>
            <p className="overline">{t("Notre mission", "Our mission")}</p>
            <h1 className="mt-3 max-w-2xl text-4xl font-black leading-tight tracking-tight text-ink sm:text-5xl">
              {t(
                "Rendre la santé mentale accessible, sans compromis sur la qualité.",
                "Make mental health accessible, without compromising on quality.",
              )}
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted">
              {t(
                "TheraNova est née d'un constat simple : trop de personnes renoncent à consulter faute d'information, de temps ou de moyens. Nous construisons un pont fiable entre les patients et des praticiens qualifiés, en Algérie.",
                "TheraNova was born from a simple observation: too many people give up on consulting for lack of information, time or means. We are building a reliable bridge between patients and qualified practitioners in Algeria.",
              )}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/therapeutes" className={buttonClass({ variant: "primary" })}>
                {t("Rencontrer nos praticiens", "Meet our practitioners")}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/contact" className={buttonClass({ variant: "outline" })}>
                {t("Nous contacter", "Contact us")}
              </Link>
            </div>
          </div>
          <div className="relative">
            <div className="absolute inset-0 rotate-3 rounded-[3rem] bg-sage-300/50" />
            <div className="relative grid grid-cols-2 gap-3 rounded-[2.5rem] border border-white bg-white/80 p-5 shadow-soft backdrop-blur">
              {[
                { value: "8", fr: "spécialités cliniques", en: "clinical specialties" },
                { value: "12", fr: "dimensions évaluées", en: "dimensions assessed" },
                { value: "4,9/5", fr: "satisfaction patient", en: "patient satisfaction" },
                { value: "100%", fr: "profils vérifiés", en: "verified profiles" },
              ].map((item) => (
                <div key={item.fr} className="rounded-3xl bg-cream p-5">
                  <p className="text-3xl font-black text-teal-600">{item.value}</p>
                  <p className="mt-1 text-[11px] font-bold uppercase tracking-wider text-muted">
                    {t(item.fr, item.en)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="container-page py-20">
        <SectionHeading
          overline={t("Ce qui nous guide", "What guides us")}
          title={t("Quatre convictions, une plateforme", "Four convictions, one platform")}
          align="center"
        />
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {values.map((value) => {
            const Icon = value.icon;
            return (
              <div key={value.fr} className="card p-6">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sage-100 text-teal-600">
                  <Icon className="h-6 w-6" />
                </span>
                <h3 className="mt-4 text-base font-black text-ink">{t(value.fr, value.en)}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{t(value.textFr, value.textEn)}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="bg-sage-100/40 py-20">
        <div className="container-page grid gap-12 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="overline">{t("Notre histoire", "Our story")}</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-ink sm:text-4xl">
              {t("Un projet né à Béjaïa", "A project born in Béjaïa")}
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-muted">
              {t(
                "TheraNova est un projet académique développé à l'ESTIN, l'École Supérieure en Technologies de l'Information et du Numérique de Béjaïa. Il réunit psychologie clinique, ingénierie logicielle et design centré sur l'humain.",
                "TheraNova is an academic project developed at ESTIN, the Higher School of Information and Digital Technologies in Béjaïa. It brings together clinical psychology, software engineering and human-centred design.",
              )}
            </p>
            <div className="mt-6 rounded-3xl bg-teal-500 p-6 text-cream">
              <Logo tone="light" compact />
              <p className="mt-4 text-sm font-bold leading-relaxed text-cream/85">
                {t(
                  "« Nous voulons que demander de l'aide devienne aussi naturel que prendre rendez-vous chez un médecin. »",
                  "\"We want asking for help to become as natural as booking a doctor's appointment.\"",
                )}
              </p>
              <p className="mt-3 text-[11px] text-sage-300">
                {t("L'équipe TheraNova · ESTIN Béjaïa", "The TheraNova team · ESTIN Béjaïa")}
              </p>
            </div>
          </div>

          <div className="relative space-y-4 border-l border-sage-300 pl-8">
            {timeline.map((item) => (
              <div key={item.year} className="relative card p-5">
                <span className="absolute -left-[2.65rem] top-6 flex h-6 w-6 items-center justify-center rounded-full border-4 border-sage-100 bg-teal-500" />
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-black text-ink">{t(item.fr, item.en)}</h3>
                  <span className="rounded-full bg-sage-100 px-2.5 py-1 text-[10px] font-black text-teal-700">{item.year}</span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-muted">{t(item.textFr, item.textEn)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="securite" className="container-page py-20">
        <div className="grid gap-8 lg:grid-cols-2">
          <div>
            <p className="overline">{t("Sécurité & confidentialité", "Security & privacy")}</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-ink">
              {t("Votre intimité n'est pas une option.", "Your privacy is not optional.")}
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-muted">
              {t(
                "Un dossier de santé mental révèle des fragilités intimes. Nous appliquons le principe du moindre privilège : chaque acteur n'accède qu'à ce qui est strictement nécessaire à votre accompagnement.",
                "A mental health record reveals intimate vulnerabilities. We apply the principle of least privilege: each actor only accesses what is strictly necessary for your care.",
              )}
            </p>
            <ul className="mt-6 space-y-4">
              {[
                {
                  fr: "Authentification JWT avec rotation des jetons et déconnexion révoquée",
                  en: "JWT authentication with token rotation and revoked logout",
                },
                {
                  fr: "Contrôle d'accès par rôle : patient, thérapeute, administrateur",
                  en: "Role-based access control: patient, therapist, administrator",
                },
                {
                  fr: "Notes cliniques privées, visibles uniquement par le praticien",
                  en: "Private clinical notes, visible only to the practitioner",
                },
                {
                  fr: "Journal d'audit des actions sensibles et des accès",
                  en: "Audit log of sensitive actions and access",
                },
              ].map((item) => (
                <li key={item.fr} className="flex items-start gap-3 text-sm text-muted">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sage-200">
                    <LockKeyhole className="h-3.5 w-3.5 text-teal-700" />
                  </span>
                  {t(item.fr, item.en)}
                </li>
              ))}
            </ul>
          </div>

          <div className="card overflow-hidden">
            <div className="bg-teal-500 p-7 text-cream">
              <BrainCircuit className="h-8 w-8 text-sage-300" />
              <h3 className="mt-3 text-lg font-black text-cream">{t("Une IA locale et explicable", "Local, explainable AI")}</h3>
              <p className="mt-2 text-xs leading-relaxed text-cream/65">
                {t(
                  "Nos analyses de texte et de scores sont exécutées sur nos serveurs, sans dépendance à un modèle externe. Aucune donnée identifiable n'est envoyée à un tiers.",
                  "Our text and score analyses run on our servers, without relying on an external model. No identifiable data is sent to a third party.",
                )}
              </p>
            </div>
            <div className="grid gap-3 p-6 sm:grid-cols-2">
              {[
                { fr: "Moteur de règles pondéré", en: "Weighted rule engine" },
                { fr: "Détection de signaux de détresse", en: "Distress signal detection" },
                { fr: "Recommandations traçables", en: "Traceable recommendations" },
                { fr: "Aucun diagnostic automatique", en: "No automated diagnosis" },
              ].map((item) => (
                <div key={item.fr} className="rounded-2xl bg-sage-50 px-4 py-3 text-xs font-bold text-teal-800">
                  {t(item.fr, item.en)}
                </div>
              ))}
            </div>
            <div className="border-t border-line bg-sand/60 px-6 py-4">
              <p className="text-[10px] leading-relaxed text-muted">
                {t(
                  "TheraNova ne remplace pas une consultation d'urgence. En cas de danger immédiat, contactez la Protection civile (14) ou le SAMU (115).",
                  "TheraNova does not replace emergency care. In case of immediate danger, contact Civil Protection (14) or SAMU (115).",
                )}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="container-page pb-20">
        <div className="rounded-[2.5rem] bg-teal-800 px-6 py-12 text-center text-cream sm:px-12">
          <HeartPulse className="mx-auto h-8 w-8 text-sage-300" />
          <h2 className="mt-4 text-3xl font-black text-cream">
            {t("Construisons ensemble un accompagnement plus humain.", "Let's build more human care together.")}
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-cream/65">
            {t(
              "Vous êtes praticien, étudiant, institution ou simplement curieux ? Écrivez-nous.",
              "Are you a practitioner, student, institution or simply curious? Write to us.",
            )}
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link to="/contact" className={buttonClass({ variant: "secondary" })}>
              {t("Prendre contact", "Get in touch")}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/inscription/therapeute" className={buttonClass({ variant: "outline", className: "!border-cream/20 !bg-white/10 !text-cream hover:!bg-white/15" })}>
              <Video className="h-4 w-4" />
              {t("Rejoindre le réseau", "Join the network")}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
