import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BrainCircuit,
  CalendarDays,
  Check,
  ChevronLeft,
  Clock3,
  History,
  Info,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Star,
} from "lucide-react";
import api, { extractError, unwrap } from "../../lib/api";
import { useI18n } from "../../contexts/I18nContext";
import { useToast } from "../../contexts/ToastContext";
import { Button, buttonClass } from "../../components/ui/Button";
import { RadioCard, Select, Textarea } from "../../components/ui/Field";
import { Badge } from "../../components/ui/Badge";
import { EmptyState, ErrorState, LoadingBlock } from "../../components/ui/Feedback";
import Avatar from "../../components/ui/Avatar";
import { Stars } from "../../components/ui/Stars";
import { formatDate, formatDateTime, formatCurrency } from "../../lib/format";

const SENTIMENTS = {
  positif: { fr: "Positif", en: "Positive", tone: "success" },
  neutre: { fr: "Neutre", en: "Neutral", tone: "sage" },
  negatif: { fr: "Négatif", en: "Negative", tone: "warn" },
};

const RISKS = {
  faible: { fr: "Faible", en: "Low", tone: "success" },
  modere: { fr: "Modéré", en: "Moderate", tone: "warn" },
  eleve: { fr: "Élevé", en: "High", tone: "danger" },
};

const TYPES = [
  { value: "Individuel", fr: "Individuel", en: "Individual", descFr: "Un espace rien que pour vous.", descEn: "A space just for you." },
  { value: "Couple", fr: "Couple", en: "Couples", descFr: "Pour deux personnes en relation.", descEn: "For two people in a relationship." },
  { value: "Famille", fr: "Famille", en: "Family", descFr: "Pour retrouver un équilibre familial.", descEn: "To restore family balance." },
];

export default function Questionnaire() {
  const { t, lang } = useI18n();
  const { success, error: toastError } = useToast();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [categories, setCategories] = useState([]);
  const [specialties, setSpecialties] = useState([]);
  const [mode, setMode] = useState("intro");
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [typeSession, setTypeSession] = useState("Individuel");
  const [texteLibre, setTexteLibre] = useState("");
  const [budget, setBudget] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      const [questionnaire, latest, specialtyData] = await Promise.allSettled([
        api.get("/matching/questionnaire/"),
        api.get("/matching/recommendations/latest/"),
        api.get("/accounts/specialties/"),
      ]);
      if (!active) return;
      if (questionnaire.status === "fulfilled") {
        setCategories(questionnaire.value.data.categories || []);
      } else {
        setLoadError(t("Le questionnaire est momentanément indisponible.", "The questionnaire is temporarily unavailable."));
      }
      if (latest.status === "fulfilled") {
        setResult(latest.value.data);
        setMode("result");
      }
      if (specialtyData.status === "fulfilled") {
        setSpecialties(unwrap(specialtyData.value.data) || []);
      }
      setLoading(false);
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  const questions = useMemo(() => {
    const list = [];
    categories.forEach((category) => {
      (category.questions || []).forEach((question) => {
        list.push({
          ...question,
          categoryLabel: lang === "en" && category.nom_en ? category.nom_en : category.nom,
        });
      });
    });
    return list.sort((a, b) => (a.ordre || 0) - (b.ordre || 0));
  }, [categories, lang]);

  const total = questions.length;
  const current = questions[step];
  const answeredCount = questions.filter((question) => answers[question.id]).length;
  const progress = total ? Math.round(((mode === "form" ? step : total) / (total + 1)) * 100) : 0;

  function startQuestionnaire() {
    setAnswers({});
    setStep(0);
    setTexteLibre("");
    setBudget("");
    setFormError("");
    setMode("form");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function selectOption(optionId) {
    setAnswers((currentAnswers) => ({ ...currentAnswers, [current.id]: optionId }));
  }

  function next() {
    if (!answers[current.id]) return;
    if (step < total - 1) setStep((value) => value + 1);
    else setStep(total);
  }

  function previous() {
    if (step > 0) setStep((value) => value - 1);
    else setMode("intro");
  }

  async function submit() {
    setFormError("");
    if (answeredCount < total) {
      setFormError(t("Merci de répondre à toutes les questions.", "Please answer every question."));
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        answers: Object.fromEntries(
          Object.entries(answers).map(([questionId, optionId]) => [String(questionId), Number(optionId)]),
        ),
        texte_libre: texteLibre,
        type_session: typeSession,
        langue: lang,
        ...(budget ? { budget: Number(budget) } : {}),
      };
      const { data } = await api.post("/matching/questionnaire/submit/", payload);
      setResult(data);
      setMode("result");
      success(
        t("Votre analyse est prête. Découvrez les praticiens qui vous correspondent.", "Your analysis is ready. Discover the practitioners who fit you."),
        { title: t("Recommandation générée", "Recommendation ready") },
      );
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setFormError(extractError(err, t("L'analyse a échoué. Veuillez réessayer.", "The analysis failed. Please try again.")));
    } finally {
      setSubmitting(false);
    }
  }

  async function openHistory() {
    setHistoryOpen(true);
    if (history.length) return;
    setHistoryLoading(true);
    try {
      const data = await api.get("/matching/history/", { params: { page_size: 20 } });
      setHistory(unwrap(data) || []);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }

  async function viewHistoryItem(id) {
    try {
      const { data } = await api.get(`/matching/recommendations/${id}/`);
      setResult(data);
      setMode("result");
      setHistoryOpen(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      toastError(extractError(err));
    }
  }

  if (loading) return <LoadingBlock label={t("Préparation du questionnaire…", "Preparing the questionnaire…")} />;
  if (loadError) return <ErrorState message={loadError} />;

  if (mode === "intro") {
    return (
      <div className="mx-auto max-w-4xl">
        <div className="card overflow-hidden">
          <div className="relative bg-teal-500 px-6 py-10 text-cream sm:px-10">
            <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-teal-400/30 blur-2xl" />
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-sage-200">
              <BrainCircuit className="h-3.5 w-3.5" />
              {t("Recommandation assistée", "Assisted recommendation")}
            </span>
            <h1 className="mt-4 text-3xl font-black tracking-tight text-cream sm:text-4xl">
              {t("Faisons connaissance, en douceur.", "Let's get to know each other, gently.")}
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-cream/70">
              {t(
                "12 questions pour comprendre ce que vous traversez et vous proposer les praticiens les plus adaptés. Aucun diagnostic, aucun jugement.",
                "12 questions to understand what you are going through and suggest the most suitable practitioners. No diagnosis, no judgement.",
              )}
            </p>
          </div>

          <div className="grid gap-6 p-6 sm:p-10 lg:grid-cols-[1fr_0.85fr]">
            <div>
              <h2 className="text-sm font-black text-ink">{t("Quel format vous conviendrait ?", "Which format would suit you?")}</h2>
              <div className="mt-3 space-y-2.5">
                {TYPES.map((type) => (
                  <RadioCard
                    key={type.value}
                    selected={typeSession === type.value}
                    onChange={() => setTypeSession(type.value)}
                    label={t(type.fr, type.en)}
                    description={t(type.descFr, type.descEn)}
                  />
                ))}
              </div>
              <Button onClick={startQuestionnaire} size="lg" className="mt-6 w-full sm:w-auto">
                <Sparkles className="h-4 w-4" />
                {t(`Commencer · ${total || 12} questions`, `Start · ${total || 12} questions`)}
              </Button>
              <p className="mt-3 inline-flex items-center gap-1.5 text-[10px] text-muted">
                <Clock3 className="h-3.5 w-3.5" />
                {t("Environ 4 minutes · gratuit · confidentiel", "About 4 minutes · free · confidential")}
              </p>
            </div>

            <div className="rounded-3xl bg-sage-50 p-5">
              <h3 className="text-xs font-black uppercase tracking-[0.14em] text-teal-500">
                {t("Comment ça marche", "How it works")}
              </h3>
              <ol className="mt-4 space-y-4">
                {[
                  {
                    fr: "Vous décrivez votre état émotionnel et votre contexte.",
                    en: "You describe your emotional state and context.",
                  },
                  {
                    fr: "Notre moteur pondère vos réponses et votre texte libre.",
                    en: "Our engine weighs your answers and free text.",
                  },
                  {
                    fr: "Vous recevez jusqu'à 3 profils, avec les raisons du choix.",
                    en: "You receive up to 3 profiles, with the reasons behind each choice.",
                  },
                ].map((item, index) => (
                  <li key={item.fr} className="flex items-start gap-3 text-xs leading-relaxed text-muted">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-[10px] font-black text-teal-600">
                      {index + 1}
                    </span>
                    {t(item.fr, item.en)}
                  </li>
                ))}
              </ol>
              <div className="mt-5 rounded-2xl bg-white p-3.5">
                <p className="flex items-start gap-2 text-[10px] leading-relaxed text-muted">
                  <LockKeyhole className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-500" />
                  {t(
                    "Vos réponses servent uniquement à la recommandation. Elles ne sont jamais partagées avec un tiers.",
                    "Your answers are only used for matching. They are never shared with a third party.",
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>

        {result && (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-white px-5 py-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-teal-500">
                {t("Dernier questionnaire", "Latest questionnaire")}
              </p>
              <p className="mt-0.5 text-sm font-bold text-ink">
                {formatDate(result.date_creation, lang, "d MMMM yyyy")} · {result.type_session}
              </p>
            </div>
            <button type="button" onClick={() => setMode("result")} className="btn-outline btn-sm">
              {t("Voir mes recommandations", "View my recommendations")}
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    );
  }

  if (mode === "form") {
    const isFreeText = step >= total;
    if (!isFreeText && !current) {
      return (
        <div className="mx-auto max-w-3xl">
          <div className="card p-8 text-center">
            <AlertTriangle className="mx-auto h-8 w-8 text-warn" />
            <h1 className="mt-3 text-lg font-black text-ink">
              {t("Le questionnaire n'est pas disponible", "The questionnaire is unavailable")}
            </h1>
            <p className="mt-1 text-sm text-muted">
              {t(
                "Aucune question n'a pu être chargée. Réessayez dans quelques instants.",
                "No question could be loaded. Please try again shortly.",
              )}
            </p>
            <Button className="mt-4" onClick={() => setMode("intro")}>
              {t("Revenir à l'accueil", "Back to start")}
            </Button>
          </div>
        </div>
      );
    }
    return (
      <div className="mx-auto max-w-3xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={isFreeText ? () => setStep(total - 1) : previous}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-muted transition hover:text-teal-600"
          >
            <ChevronLeft className="h-4 w-4" />
            {t("Précédent", "Back")}
          </button>
          <span className="text-[11px] font-bold text-muted">
            {isFreeText ? t("Dernière étape", "Last step") : t(`Question ${step + 1} sur ${total}`, `Question ${step + 1} of ${total}`)}
          </span>
        </div>

        <div className="mb-6 h-1.5 overflow-hidden rounded-full bg-sand">
          <div
            className="h-full rounded-full bg-gradient-to-r from-sage-400 to-teal-500 transition-all duration-500"
            style={{ width: `${isFreeText ? 100 : Math.max(6, progress)}%` }}
          />
        </div>

        {isFreeText ? (
          <div className="card p-6 sm:p-8">
            <span className="chip-sage">
              <Sparkles className="h-3.5 w-3.5" />
              {t("Votre mot libre", "Your own words")}
            </span>
            <h1 className="mt-4 text-2xl font-black tracking-tight text-ink">
              {t("Souhaitez-vous préciser quelque chose ?", "Would you like to add anything?")}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              {t(
                "Facultatif. Quelques phrases sur ce que vous ressentez aident notre analyse à mieux comprendre votre contexte.",
                "Optional. A few sentences about how you feel help our analysis better understand your context.",
              )}
            </p>
            <Textarea
              className="mt-5"
              rows={6}
              value={texteLibre}
              onChange={(event) => setTexteLibre(event.target.value)}
              placeholder={t(
                "Ex. Je dors mal depuis quelques semaines, je me sens débordé(e) par les cours et je m'isole…",
                "E.g. I have been sleeping poorly for weeks, I feel overwhelmed by classes and I am isolating myself…",
              )}
              maxLength={4000}
            />
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">{t("Format de séance", "Session format")}</label>
                <select value={typeSession} onChange={(event) => setTypeSession(event.target.value)} className="select">
                  {TYPES.map((type) => (
                    <option key={type.value} value={type.value}>{t(type.fr, type.en)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">{t("Budget indicatif (DA, facultatif)", "Indicative budget (DZD, optional)")}</label>
                <input
                  type="number"
                  min={0}
                  step={100}
                  value={budget}
                  onChange={(event) => setBudget(event.target.value)}
                  placeholder="2500"
                  className="input"
                />
              </div>
            </div>

            <div className="mt-5 rounded-2xl bg-sage-50 px-4 py-3">
              <p className="flex items-start gap-2 text-[11px] leading-relaxed text-teal-800">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warn" />
                {t(
                  "Si vous traversez une crise ou pensez à vous faire du mal, ne restez pas seul(e). Contactez la Protection civile (14) ou le SAMU (115).",
                  "If you are in crisis or thinking of harming yourself, do not stay alone. Contact Civil Protection (14) or SAMU (115).",
                )}
              </p>
            </div>

            {formError && (
              <div className="mt-4 rounded-2xl border border-risk/20 bg-risk/5 px-4 py-3 text-sm font-semibold text-risk">
                {formError}
              </div>
            )}

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <p className="text-[11px] font-semibold text-muted">
                {answeredCount}/{total} {t("questions répondues", "questions answered")}
              </p>
              <Button onClick={submit} loading={submitting} size="lg">
                <Sparkles className="h-4 w-4" />
                {t("Générer ma recommandation", "Generate my recommendation")}
              </Button>
            </div>
          </div>
        ) : (
          <div className="card p-6 sm:p-8">
            <div className="flex items-center justify-between gap-3">
              <span className="chip-sage">{current.categoryLabel}</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
                {t("Sans bonne ni mauvaise réponse", "No right or wrong answer")}
              </span>
            </div>
            <h1 className="mt-5 text-xl font-black leading-snug tracking-tight text-ink sm:text-2xl">
              {lang === "en" && current.texte_en && current.texte_en !== current.texte ? current.texte_en : current.texte}
            </h1>
            <p className="mt-2 text-xs text-muted">
              {t(
                "Choisissez la réponse qui décrit le mieux les dernières semaines.",
                "Choose the answer that best describes the last few weeks.",
              )}
            </p>

            <div className="mt-6 space-y-2.5">
              {(current.reponses || []).map((option) => (
                <RadioCard
                  key={option.id}
                  selected={answers[current.id] === option.id}
                  onChange={() => selectOption(option.id)}
                  label={lang === "en" && option.texte_en && option.texte_en !== option.texte ? option.texte_en : option.texte}
                />
              ))}
            </div>

            <div className="mt-7 flex items-center justify-between gap-3">
              <span className="text-[11px] font-semibold text-muted">
                {answeredCount}/{total} {t("répondues", "answered")}
              </span>
              <Button onClick={next} disabled={!answers[current.id]} size="lg">
                {step === total - 1 ? t("Continuer", "Continue") : t("Question suivante", "Next question")}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // RESULT
  const recommendations = result?.recommandations || [];
  const scores = Object.entries(result?.scores_specialites || {})
    .map(([code, value]) => {
      const specialty = specialties.find((item) => item.code === code);
      return {
        code,
        nom: specialty ? (lang === "en" && specialty.nom_en ? specialty.nom_en : specialty.nom) : code,
        value: Number(value) || 0,
      };
    })
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);
  const maxScore = scores[0]?.value || 1;
  const sentiment = SENTIMENTS[result?.sentiment] || SENTIMENTS.neutre;
  const risk = RISKS[result?.niveau_risque] || RISKS.faible;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="overline">{t("Votre analyse personnalisée", "Your personalised analysis")}</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-ink sm:text-3xl">
            {t("Les praticiens qui vous correspondent", "Practitioners who fit you")}
          </h1>
          {result?.date_creation && (
            <p className="mt-1 text-xs text-muted">
              {t("Généré le", "Generated on")} {formatDateTime(result.date_creation, lang)} · {result.type_session}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={openHistory} className={buttonClass({ variant: "outline", size: "sm" })}>
            <History className="h-4 w-4" />
            {t("Historique", "History")}
          </button>
          <button type="button" onClick={startQuestionnaire} className={buttonClass({ variant: "primary", size: "sm" })}>
            <RefreshCw className="h-4 w-4" />
            {t("Refaire le questionnaire", "Retake questionnaire")}
          </button>
        </div>
      </div>

      {result?.niveau_risque === "eleve" && (
        <div className="rounded-3xl border-2 border-risk/30 bg-risk/5 p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0 text-risk" />
            <div>
              <p className="text-sm font-black text-risk">{t("Une attention particulière est nécessaire", "Extra attention is needed")}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted">
                {t(
                  "Certains mots que vous avez partagés évoquent une souffrance importante. Merci de contacter rapidement un professionnel ou une personne de confiance. En cas d'urgence : Protection civile (14) ou SAMU (115).",
                  "Some of the words you shared suggest significant distress. Please contact a professional or someone you trust soon. In an emergency: Civil Protection (14) or SAMU (115).",
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="card p-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={sentiment.tone}>{t("Ton", "Tone")} : {t(sentiment.fr, sentiment.en)}</Badge>
            <Badge tone={risk.tone}>{t("Niveau de vigilance", "Vigilance level")} : {t(risk.fr, risk.en)}</Badge>
            {result?.type_session && <Badge tone="neutral">{result.type_session}</Badge>}
          </div>
          <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-ink/80">
            {lang === "en" && result?.resume_en
              ? result.resume_en
              : result?.resume || t("Analyse en cours de génération.", "Analysis being generated.")}
          </p>
          <div className="mt-5 rounded-2xl bg-sage-50 p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-teal-500">
              {t("Comment lire cette recommandation", "How to read this recommendation")}
            </p>
            <p className="mt-1.5 text-[11px] leading-relaxed text-muted">
              {t(
                "Le score d'affinité croise vos réponses, votre texte libre et les spécialités des praticiens. Il ne s'agit pas d'un diagnostic médical : vous restez libre de choisir un autre profil.",
                "The affinity score combines your answers, free text and practitioners' specialties. This is not a medical diagnosis: you remain free to choose another profile.",
              )}
            </p>
          </div>
        </section>

        <section className="card p-6">
          <h2 className="inline-flex items-center gap-2 text-sm font-black text-ink">
            <BrainCircuit className="h-4 w-4 text-teal-500" />
            {t("Dimensions dominantes", "Dominant dimensions")}
          </h2>
          <div className="mt-4 space-y-3">
            {scores.length ? (
              scores.map((score) => (
                <div key={score.code}>
                  <div className="mb-1 flex items-center justify-between text-[11px] font-bold">
                    <span className="text-teal-800">{score.nom}</span>
                    <span className="text-muted">{Math.round((score.value / maxScore) * 100)}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-sand">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-sage-400 to-teal-500"
                      style={{ width: `${Math.max(8, (score.value / maxScore) * 100)}%` }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-muted">{t("Aucune dimension dominante détectée.", "No dominant dimension detected.")}</p>
            )}
          </div>
          <div className="mt-5 flex items-start gap-2 rounded-2xl bg-sand/60 p-3">
            <LockKeyhole className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-500" />
            <p className="text-[10px] leading-relaxed text-muted">
              {t(
                "Cette analyse est indicative et strictement confidentielle. Elle n'est pas partagée avec vos praticiens sans votre accord.",
                "This analysis is indicative and strictly confidential. It is not shared with your practitioners without your consent.",
              )}
            </p>
          </div>
        </section>
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-black text-ink">
            {t("Praticiens recommandés", "Recommended practitioners")}
          </h2>
          <span className="text-[11px] font-semibold text-muted">
            {recommendations.length} {t("profil(s)", "profile(s)")}
          </span>
        </div>
        {recommendations.length === 0 ? (
          <EmptyState
            icon={Sparkles}
            title={t("Aucune recommandation pour le moment", "No recommendation yet")}
            description={t(
              "Vous pouvez explorer l'annuaire en attendant, ou refaire le questionnaire.",
              "You can browse the directory in the meantime, or retake the questionnaire.",
            )}
            action={
              <Link to="/therapeutes" className={buttonClass({ variant: "primary" })}>
                {t("Explorer l'annuaire", "Browse directory")}
              </Link>
            }
          />
        ) : (
          <div className="space-y-3">
            {recommendations.map((item, index) => {
              const therapist = item.therapist;
              if (!therapist) return null;
              const name = therapist.nom_complet;
              return (
                <article key={therapist.id} className="card overflow-hidden">
                  <div className="grid gap-0 md:grid-cols-[1fr_190px]">
                    <div className="p-5 sm:p-6">
                      <div className="flex items-start gap-4">
                        <div className="relative">
                          <Avatar src={therapist.user?.avatar} name={name} size="lg" />
                          {index === 0 && (
                            <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-gold text-[9px] font-black text-teal-900">
                              1
                            </span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-base font-black text-ink">{name}</h3>
                            <Badge tone="success">{Math.round(item.affinite)}% {t("affinité", "affinity")}</Badge>
                          </div>
                          <p className="mt-0.5 text-xs text-muted">
                            {therapist.specialites?.map((specialty) => (lang === "en" && specialty.nom_en ? specialty.nom_en : specialty.nom)).join(" · ")}
                          </p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted">
                            <span className="inline-flex items-center gap-1">
                              <Star className="h-3 w-3 fill-gold text-gold" />
                              {Number(therapist.note_globale || 0).toFixed(1)} ({therapist.nombre_avis})
                            </span>
                            <span>{therapist.ville}</span>
                            <span>{therapist.annees_experience} {t("ans", "yrs")}</span>
                            <span>{formatCurrency(therapist.tarif_seance, lang)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 rounded-2xl bg-sage-50 p-4">
                        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-teal-500">
                          {t("Pourquoi ce profil", "Why this profile")}
                        </p>
                        <ul className="mt-2 space-y-1.5">
                          {(lang === "en" && item.raisons_en?.length ? item.raisons_en : item.raisons || []).slice(0, 3).map((reason) => (
                            <li key={reason} className="flex items-start gap-2 text-xs leading-relaxed text-teal-900/75">
                              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
                              {reason}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="flex flex-col justify-center gap-2 border-t border-line/70 bg-cream/60 p-5 md:border-l md:border-t-0">
                      <p className="text-center text-[10px] font-black uppercase tracking-[0.14em] text-muted">
                        {t("Prochain créneau", "Next slot")}
                      </p>
                      <p className="text-center text-xs font-bold text-ink">
                        {item.prochain_creneau
                          ? formatDateTime(item.prochain_creneau, lang)
                          : t("Voir l'agenda", "View calendar")}
                      </p>
                      <Link
                        to={`/app/reserver?therapeute=${therapist.id}`}
                        className={buttonClass({ variant: "primary", size: "sm", className: "mt-2 w-full" })}
                      >
                        <CalendarDays className="h-3.5 w-3.5" />
                        {t("Réserver", "Book")}
                      </Link>
                      <Link
                        to={`/therapeutes/${therapist.id}`}
                        className={buttonClass({ variant: "outline", size: "sm", className: "w-full" })}
                      >
                        {t("Voir le profil", "View profile")}
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {historyOpen && (
        <div className="fixed inset-0 z-[85] flex items-end justify-center sm:items-center sm:p-6">
          <button type="button" className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={() => setHistoryOpen(false)} aria-label={t("Fermer", "Close")} />
          <div className="relative z-10 max-h-[85vh] w-full max-w-2xl overflow-hidden rounded-t-3xl bg-cream shadow-lift sm:rounded-3xl">
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <div>
                <h2 className="text-base font-black text-ink">{t("Historique des questionnaires", "Questionnaire history")}</h2>
                <p className="text-[11px] text-muted">{t("Chaque analyse reste accessible.", "Every analysis remains accessible.")}</p>
              </div>
              <button type="button" onClick={() => setHistoryOpen(false)} className="icon-btn">
                <ArrowLeft className="h-5 w-5 rotate-180" />
              </button>
            </div>
            <div className="thin-scrollbar max-h-[70vh] space-y-2 overflow-y-auto p-4">
              {historyLoading && <p className="py-8 text-center text-xs text-muted">{t("Chargement…", "Loading…")}</p>}
              {!historyLoading && history.length === 0 && (
                <p className="py-8 text-center text-xs text-muted">{t("Aucun historique.", "No history.")}</p>
              )}
              {history.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => viewHistoryItem(item.id)}
                  className="flex w-full items-start justify-between gap-3 rounded-2xl border border-line bg-white p-4 text-left transition hover:border-teal-400"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-black text-ink">
                      {formatDate(item.date_creation, lang, "d MMMM yyyy")} · {item.type_session}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-muted">
                      {lang === "en" && item.resume_en ? item.resume_en : item.resume}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {item.specialite_principale && (
                        <Badge tone="sage">
                          {lang === "en" && item.specialite_principale.nom_en
                            ? item.specialite_principale.nom_en
                            : item.specialite_principale.nom}
                        </Badge>
                      )}
                      {SENTIMENTS[item.sentiment] && (
                        <Badge tone={SENTIMENTS[item.sentiment].tone}>
                          {t(SENTIMENTS[item.sentiment].fr, SENTIMENTS[item.sentiment].en)}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <span className="shrink-0 text-[10px] font-bold text-teal-600">{t("Revoir", "View")} →</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
