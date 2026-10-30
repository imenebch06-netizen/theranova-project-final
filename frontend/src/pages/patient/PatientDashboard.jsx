import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Bell,
  CalendarDays,
  CheckCircle2,
  Clock3,
  HeartPulse,
  Leaf,
  PlayCircle,
  Sparkles,
  TrendingUp,
  Video,
  Wallet,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import api, { extractError, unwrap } from "../../lib/api";
import { useAuth } from "../../contexts/AuthContext";
import { useI18n } from "../../contexts/I18nContext";
import { useToast } from "../../contexts/ToastContext";
import { StatCard } from "../../components/ui/Card";
import { buttonClass } from "../../components/ui/Button";
import { EmptyState, ErrorState, LoadingBlock } from "../../components/ui/Feedback";
import Avatar from "../../components/ui/Avatar";
import { StatusBadge } from "../../components/ui/Badge";
import ChartTooltip from "../../components/ChartTooltip";
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatShortDate,
  formatTime,
} from "../../lib/format";

const QUICK_MOODS = [
  { emotion: "joyeux", score: 9, emoji: "😄", fr: "Joyeux", en: "Happy" },
  { emotion: "calme", score: 8, emoji: "😌", fr: "Calme", en: "Calm" },
  { emotion: "neutre", score: 6, emoji: "😐", fr: "Neutre", en: "Neutral" },
  { emotion: "anxieux", score: 4, emoji: "😟", fr: "Anxieux", en: "Anxious" },
  { emotion: "triste", score: 3, emoji: "😔", fr: "Triste", en: "Sad" },
];

function greeting(lang) {
  const hour = new Date().getHours();
  if (lang === "en") {
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  }
  if (hour < 12) return "Bonjour";
  if (hour < 18) return "Bon après-midi";
  return "Bonsoir";
}

export default function PatientDashboard() {
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const { success, error: toastError, info } = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [joining, setJoining] = useState(false);
  const [savingMood, setSavingMood] = useState(null);
  const [moodMessage, setMoodMessage] = useState("");
  const [now, setNow] = useState(() => new Date());

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data: payload } = await api.get("/dashboard/patient/");
      setData(payload);
    } catch (err) {
      setError(extractError(err, t("Impossible de charger votre tableau de bord.", "Unable to load your dashboard.")));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(interval);
  }, []);

  const moodSeries = useMemo(() => {
    const serie = data?.humeur?.serie || [];
    return serie.slice(-14).map((entry) => ({
      date: formatShortDate(entry.date, lang),
      score: entry.score,
      emotion: entry.emotion,
    }));
  }, [data, lang]);

  async function joinSession() {
    if (!data?.prochaine_seance) return;
    setJoining(true);
    try {
      const { data: payload } = await api.post(`/scheduling/sessions/${data.prochaine_seance.id}/join/`);
      const link = payload.lien_googlemeet || payload.seance?.lien_googlemeet;
      if (link) {
        window.open(link, "_blank", "noopener,noreferrer");
        success(t("La salle de visioconférence s'ouvre dans un nouvel onglet.", "The video room is opening in a new tab."));
      } else {
        info(t("Le lien sera disponible 15 minutes avant la séance.", "The link will be available 15 minutes before the session."));
      }
    } catch (err) {
      toastError(extractError(err, t("Impossible de rejoindre la séance.", "Unable to join the session.")));
    } finally {
      setJoining(false);
    }
  }

  async function quickMood(entry) {
    setSavingMood(entry.emotion);
    try {
      const { data: payload } = await api.post("/wellbeing/mood/save/", {
        score: entry.score,
        emotion: entry.emotion,
        note: "",
        tags: [],
      });
      setMoodMessage(payload.message_ia);
      setData((current) =>
        current
          ? {
              ...current,
              kpis: { ...current.kpis, humeur_aujourdhui: entry.score, humeur_moyenne: payload.score },
            }
          : current,
      );
      success(t("Humeur enregistrée pour aujourd'hui.", "Mood saved for today."));
      load();
    } catch (err) {
      toastError(extractError(err));
    } finally {
      setSavingMood(null);
    }
  }

  if (loading) return <LoadingBlock label={t("Chargement de votre espace…", "Loading your space…")} />;
  if (error || !data) return <ErrorState message={error} onRetry={load} />;

  const { kpis, prochaine_seance: next, recommandation, transactions, notifications, humeur } = data;
  const nextDate = next ? new Date(next.date_debut) : null;
  const diffMinutes = nextDate ? Math.round((nextDate.getTime() - now.getTime()) / 60000) : null;
  const countdown =
    diffMinutes === null
      ? ""
      : diffMinutes <= 0
        ? t("C'est l'heure", "It's time")
        : diffMinutes < 60
          ? t(`dans ${diffMinutes} min`, `in ${diffMinutes} min`)
          : diffMinutes < 1440
            ? t(`dans ${Math.round(diffMinutes / 60)} h`, `in ${Math.round(diffMinutes / 60)} h`)
            : t(`dans ${Math.round(diffMinutes / 1440)} j`, `in ${Math.round(diffMinutes / 1440)} days`);

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="overline">{formatDate(new Date(), lang, "EEEE d MMMM yyyy")}</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-ink sm:text-3xl">
            {greeting(lang)}, {user?.first_name || t("bienvenue", "welcome")} 👋
          </h1>
          <p className="mt-1 text-sm text-muted">
            {t("Voici un aperçu de votre parcours de soin.", "Here is an overview of your care journey.")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/app/humeur" className={buttonClass({ variant: "outline", size: "sm" })}>
            <HeartPulse className="h-4 w-4" />
            {t("Noter mon humeur", "Log my mood")}
          </Link>
          <Link to="/app/reserver" className={buttonClass({ variant: "primary", size: "sm" })}>
            <CalendarDays className="h-4 w-4" />
            {t("Réserver", "Book")}
          </Link>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={CalendarDays}
          label={t("Prochaine séance", "Next session")}
          value={next ? formatDate(next.date_debut, lang, "d MMM") : t("Aucune", "None")}
          hint={next ? formatTime(next.date_debut) + " · " + next.therapeute : t("Réservez votre premier créneau", "Book your first slot")}
          tone="teal"
        />
        <StatCard
          icon={HeartPulse}
          label={t("Humeur moyenne · 30 j", "Average mood · 30d")}
          value={kpis.humeur_moyenne ? `${kpis.humeur_moyenne}/10` : "—"}
          hint={t(`${kpis.serie_humeur} jour(s) d'affilée`, `${kpis.serie_humeur}-day streak`)}
          tone="sage"
          trend={humeur?.tendance === "hausse" ? "up" : humeur?.tendance === "baisse" ? "down" : undefined}
        />
        <StatCard
          icon={CheckCircle2}
          label={t("Séances terminées", "Completed sessions")}
          value={kpis.seances_terminees}
          hint={t("Votre régularité porte ses fruits", "Consistency pays off")}
          tone="success"
        />
        <StatCard
          icon={Wallet}
          label={t("Crédit TheraNova", "TheraNova credit")}
          value={formatCurrency(kpis.solde, lang)}
          hint={kpis.abonnement || t("Aucun pack actif", "No active pack")}
          tone="gold"
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="space-y-5">
          {next ? (
            <section className="relative overflow-hidden rounded-3xl bg-teal-500 p-6 text-cream">
              <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-teal-400/30 blur-2xl" />
              <div className="relative flex flex-wrap items-start justify-between gap-4">
                <div>
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-sage-200">
                    <Video className="h-3.5 w-3.5" />
                    {t("Prochaine séance", "Next session")}
                  </span>
                  <p className="mt-4 text-2xl font-black tracking-tight text-cream">
                    {formatDate(next.date_debut, lang, "EEEE d MMMM")}
                  </p>
                  <p className="mt-1 text-sm text-cream/70">
                    {formatTime(next.date_debut)} – {formatTime(next.date_fin)} · {next.type_session}
                  </p>
                  <div className="mt-4 flex items-center gap-3">
                    <Avatar src={next.therapeute_avatar} name={next.therapeute} size="sm" />
                    <div>
                      <p className="text-sm font-bold text-cream">{next.therapeute}</p>
                      <p className="text-[11px] text-cream/55">{t("Votre praticien", "Your practitioner")}</p>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-sage-300 px-3 py-1.5 text-[11px] font-black text-teal-800">
                    <Clock3 className="h-3.5 w-3.5" />
                    {countdown}
                  </span>
                  <div className="mt-4 flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={joinSession}
                      disabled={joining}
                      className={buttonClass({ variant: "secondary", className: "w-full" })}
                    >
                      <PlayCircle className="h-4 w-4" />
                      {next.can_join ? t("Rejoindre la séance", "Join session") : t("Ouvrir la salle", "Open room")}
                    </button>
                    <Link to="/app/seances" className="text-center text-[11px] font-bold text-cream/65 underline underline-offset-2 hover:text-cream">
                      {t("Toutes mes séances", "All my sessions")}
                    </Link>
                  </div>
                </div>
              </div>
            </section>
          ) : (
            <EmptyState
              icon={CalendarDays}
              title={t("Aucune séance programmée", "No session scheduled")}
              description={t(
                "Commencez par le questionnaire de recommandation ou parcourez l'annuaire pour trouver votre praticien.",
                "Start with the recommendation questionnaire or browse the directory to find your practitioner.",
              )}
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <Link to="/app/reserver" className={buttonClass({ variant: "primary" })}>
                    {t("Prendre rendez-vous", "Book a session")}
                  </Link>
                  <Link to="/therapeutes" className={buttonClass({ variant: "outline" })}>
                    {t("Voir les praticiens", "See practitioners")}
                  </Link>
                </div>
              }
            />
          )}

          <section className="card p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="inline-flex items-center gap-2 text-base font-black text-ink">
                  <Leaf className="h-4 w-4 text-teal-500" />
                  {t("Comment vous sentez-vous aujourd'hui ?", "How are you feeling today?")}
                </h2>
                <p className="mt-1 text-sm text-muted">
                  {t("Un geste de 10 secondes pour mieux comprendre vos tendances.", "A 10-second check-in to better understand your patterns.")}
                </p>
              </div>
              <Link to="/app/humeur" className="text-xs font-bold text-teal-600 hover:text-teal-800">
                {t("Ouvrir le journal", "Open journal")} →
              </Link>
            </div>
            <div className="mt-4 grid grid-cols-5 gap-2">
              {QUICK_MOODS.map((entry) => (
                <button
                  key={entry.emotion}
                  type="button"
                  disabled={Boolean(savingMood)}
                  onClick={() => quickMood(entry)}
                  className={
                    kpis.humeur_aujourdhui === entry.score
                      ? "rounded-2xl border-2 border-teal-400 bg-sage-50 px-2 py-3 text-center"
                      : "rounded-2xl border border-line bg-white px-2 py-3 text-center transition hover:border-sage-400 hover:bg-sage-50 disabled:opacity-50"
                  }
                >
                  <span className="text-2xl">{entry.emoji}</span>
                  <span className="mt-1 block text-[10px] font-bold text-muted">{t(entry.fr, entry.en)}</span>
                </button>
              ))}
            </div>
            {moodMessage && (
              <div className="mt-4 rounded-2xl bg-sage-50 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-teal-500">
                  {t("Message de votre espace bien-être", "Message from your wellbeing space")}
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-teal-900/80">{moodMessage}</p>
              </div>
            )}
          </section>

          <section className="card p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="inline-flex items-center gap-2 text-base font-black text-ink">
                  <TrendingUp className="h-4 w-4 text-teal-500" />
                  {t("Votre humeur ces 14 derniers jours", "Your mood over the last 14 days")}
                </h2>
                <p className="mt-1 text-sm text-muted">
                  {humeur?.entrees || 0} {t("entrées enregistrées sur 30 jours", "entries recorded over 30 days")}
                </p>
              </div>
              <Link to="/app/humeur" className="text-xs font-bold text-teal-600 hover:text-teal-800">
                {t("Détails", "Details")} →
              </Link>
            </div>
            <div className="mt-4 h-52">
              {moodSeries.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={moodSeries} margin={{ top: 5, right: 8, left: -22, bottom: 0 }}>
                    <defs>
                      <linearGradient id="moodFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#1A5255" stopOpacity={0.28} />
                        <stop offset="100%" stopColor="#1A5255" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E8E1D1" vertical={false} />
                    <XAxis dataKey="date" tickLine={false} axisLine={false} />
                    <YAxis domain={[0, 10]} tickLine={false} axisLine={false} ticks={[0, 5, 10]} />
                    <Tooltip content={<ChartTooltip suffix="/10" />} />
                    <Area type="monotone" dataKey="score" stroke="#1A5255" strokeWidth={2.5} fill="url(#moodFill)" name={t("Humeur", "Mood")} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full flex-col items-center justify-center rounded-2xl bg-sand/60 text-center">
                  <HeartPulse className="h-7 w-7 text-sage-400" />
                  <p className="mt-2 text-sm font-semibold text-muted">
                    {t("Enregistrez votre humeur pour voir apparaître la courbe.", "Log your mood to see your trend.")}
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="space-y-5">
          <section className="card p-5">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-sage-100 text-teal-600">
                <Sparkles className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <h2 className="text-sm font-black text-ink">
                  {recommandation ? t("Votre recommandation", "Your recommendation") : t("Trouver mon praticien", "Find my practitioner")}
                </h2>
                <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-muted">
                  {recommandation?.resume ||
                    t(
                      "12 questions pour comprendre vos besoins et recevoir une recommandation expliquée.",
                      "12 questions to understand your needs and receive an explained recommendation.",
                    )}
                </p>
                {recommandation && (
                  <p className="mt-2 text-[10px] font-semibold text-muted">
                    {t("Mis à jour le", "Updated")} {formatDate(recommandation.date, lang, "d MMM yyyy")}
                    {recommandation.top ? ` · ${t("affinité", "affinity")} ${recommandation.top}%` : ""}
                  </p>
                )}
                <Link to="/app/questionnaire" className={buttonClass({ variant: "outline", size: "sm", className: "mt-3 w-full" })}>
                  {recommandation ? t("Revoir mes recommandations", "View my recommendations") : t("Faire le questionnaire", "Take the questionnaire")}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </section>

          <section className="card p-5">
            <div className="flex items-center justify-between">
              <h2 className="inline-flex items-center gap-2 text-sm font-black text-ink">
                <Bell className="h-4 w-4 text-teal-500" />
                {t("Notifications", "Notifications")}
              </h2>
              <span className="rounded-full bg-sage-100 px-2 py-0.5 text-[10px] font-black text-teal-700">
                {kpis.notifications}
              </span>
            </div>
            <div className="mt-3 space-y-3">
              {(notifications || []).length === 0 && (
                <p className="rounded-2xl bg-sand/60 px-3 py-4 text-center text-xs text-muted">
                  {t("Aucune notification non lue.", "No unread notifications.")}
                </p>
              )}
              {(notifications || []).slice(0, 4).map((item) => (
                <div key={item.id} className="flex items-start gap-2.5 border-b border-line/60 pb-3 last:border-0 last:pb-0">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-terracotta" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-ink">{item.titre}</p>
                    <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-muted">{item.message}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="card p-5">
            <div className="flex items-center justify-between">
              <h2 className="inline-flex items-center gap-2 text-sm font-black text-ink">
                <Wallet className="h-4 w-4 text-teal-500" />
                {t("Derniers paiements", "Recent payments")}
              </h2>
              <Link to="/app/paiements" className="text-[10px] font-bold text-teal-600 hover:text-teal-800">
                {t("Tout voir", "View all")}
              </Link>
            </div>
            <div className="mt-3 space-y-2.5">
              {(transactions || []).length === 0 && (
                <p className="rounded-2xl bg-sand/60 px-3 py-4 text-center text-xs text-muted">
                  {t("Aucun paiement pour le moment.", "No payments yet.")}
                </p>
              )}
              {(transactions || []).map((transaction) => (
                <div key={transaction.id} className="flex items-center justify-between gap-2 rounded-2xl bg-sand/50 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-ink">{transaction.pack || transaction.type}</p>
                    <p className="text-[10px] text-muted">{formatDate(transaction.date, lang, "d MMM yyyy")}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-black text-teal-600">{formatCurrency(transaction.montant, lang)}</p>
                    <StatusBadge status={transaction.statut} className="!px-1.5 !py-0.5 !text-[9px]" />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="card p-5">
            <h2 className="text-sm font-black text-ink">{t("Votre pack", "Your pack")}</h2>
            {kpis.abonnement ? (
              <>
                <p className="mt-2 text-lg font-black text-teal-600">{kpis.abonnement}</p>
                <p className="mt-1 text-[11px] text-muted">
                  {t("Valable jusqu'au", "Valid until")} {formatDate(kpis.abonnement_fin, lang, "d MMMM yyyy")}
                </p>
                <Link to="/app/paiements" className={buttonClass({ variant: "outline", size: "sm", className: "mt-3 w-full" })}>
                  {t("Gérer mon pack", "Manage my pack")}
                </Link>
              </>
            ) : (
              <>
                <p className="mt-2 text-xs leading-relaxed text-muted">
                  {t(
                    "Aucun abonnement actif. Les packs permettent de réduire le coût par séance et d'ancrer votre suivi.",
                    "No active subscription. Packs reduce the cost per session and anchor your care.",
                  )}
                </p>
                <Link to="/packs" className={buttonClass({ variant: "primary", size: "sm", className: "mt-3 w-full" })}>
                  {t("Découvrir les packs", "Discover packs")}
                </Link>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
