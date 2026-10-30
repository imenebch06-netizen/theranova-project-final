import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  HeartPulse,
  Leaf,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Minus,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import api, { extractError, unwrap } from "../../lib/api";
import { useI18n } from "../../contexts/I18nContext";
import { useToast } from "../../contexts/ToastContext";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { ErrorState, LoadingBlock } from "../../components/ui/Feedback";
import ChartTooltip from "../../components/ChartTooltip";
import { dateKey, formatDate, formatDateTime, formatShortDate } from "../../lib/format";

const EMOTIONS = [
  { value: "joyeux", emoji: "😄", fr: "Joyeux", en: "Happy" },
  { value: "calme", emoji: "😌", fr: "Calme", en: "Calm" },
  { value: "neutre", emoji: "😐", fr: "Neutre", en: "Neutral" },
  { value: "anxieux", emoji: "😟", fr: "Anxieux", en: "Anxious" },
  { value: "triste", emoji: "😔", fr: "Triste", en: "Sad" },
  { value: "en_colere", emoji: "😠", fr: "En colère", en: "Angry" },
  { value: "fatigue", emoji: "😴", fr: "Fatigué", en: "Tired" },
];

const TAGS = [
  { value: "sommeil", fr: "Sommeil", en: "Sleep" },
  { value: "travail", fr: "Travail", en: "Work" },
  { value: "etudes", fr: "Études", en: "Studies" },
  { value: "famille", fr: "Famille", en: "Family" },
  { value: "amis", fr: "Amis", en: "Friends" },
  { value: "sport", fr: "Sport", en: "Sport" },
  { value: "sante", fr: "Santé", en: "Health" },
];

const MOOD_COLORS = ["#B4573F", "#C98560", "#D9B36B", "#CCD5B5", "#8FB0A0", "#1A5255"];

function scoreTone(score) {
  if (score <= 3) return "risk";
  if (score <= 5) return "warn";
  if (score <= 7) return "sage";
  return "success";
}

export default function Mood() {
  const { t, lang } = useI18n();
  const { success, error: toastError } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [entries, setEntries] = useState([]);
  const [stats, setStats] = useState(null);
  const [period, setPeriod] = useState(30);
  const [score, setScore] = useState(6);
  const [emotion, setEmotion] = useState("neutre");
  const [note, setNote] = useState("");
  const [tags, setTags] = useState([]);
  const [saving, setSaving] = useState(false);
  const [aiMessage, setAiMessage] = useState("");
  const [alert, setAlert] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [moodData, statsData] = await Promise.all([
        api.get("/wellbeing/mood/", { params: { days: 365, page_size: 366 } }),
        api.get("/wellbeing/mood/stats/", { params: { days: period } }),
      ]);
      const list = unwrap(moodData.data) || [];
      setEntries(list);
      setStats(statsData.data);
      const today = dateKey(new Date());
      const todayEntry = list.find((entry) => entry.date_saisie === today);
      if (todayEntry) {
        setScore(todayEntry.score);
        setEmotion(todayEntry.emotion);
        setNote(todayEntry.note || "");
        setTags(todayEntry.tags || []);
        setAiMessage(todayEntry.message_ia || "");
        setAlert(Boolean(todayEntry.alerte));
      }
    } catch (err) {
      setError(
        extractError(
          err,
          t("Impossible de charger votre journal d'humeur.", "Unable to load your mood journal."),
        ),
      );
    } finally {
      setLoading(false);
    }
  }, [period, t]);

  useEffect(() => {
    load();
  }, [load]);

  const chartData = useMemo(
    () =>
      (stats?.serie || []).map((entry) => ({
        date: formatShortDate(entry.date, lang),
        score: entry.score,
        emotion: entry.emotion,
      })),
    [stats, lang],
  );

  const distribution = useMemo(
    () =>
      (stats?.distribution || []).map((item) => ({
        label: item.label,
        count: item.count,
      })),
    [stats],
  );

  const emotionData = useMemo(
    () =>
      (stats?.emotions || []).slice(0, 6).map((item) => {
        const config = EMOTIONS.find((emotionItem) => emotionItem.value === item.emotion);
        return {
          label: config ? t(config.fr, config.en) : item.emotion,
          count: item.count,
        };
      }),
    [stats, t],
  );

  function toggleTag(value) {
    setTags((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value],
    );
  }

  async function save() {
    setSaving(true);
    try {
      const { data } = await api.post("/wellbeing/mood/save/", {
        score,
        emotion,
        note: note.trim(),
        tags,
      });
      setAiMessage(data.message_ia || "");
      setAlert(Boolean(data.alerte));
      success(
        t("Votre humeur du jour est enregistrée.", "Today's mood has been saved."),
        { title: t("Journal mis à jour", "Journal updated") },
      );
      const refreshed = await api.get("/wellbeing/mood/stats/", { params: { days: period } });
      setStats(refreshed.data);
      const listResponse = await api.get("/wellbeing/mood/", {
        params: { days: 365, page_size: 366 },
      });
      setEntries(unwrap(listResponse.data) || []);
    } catch (err) {
      toastError(extractError(err, t("L'enregistrement a échoué.", "Saving failed.")));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingBlock label={t("Chargement de votre journal…", "Loading your journal…")} />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const trend = stats?.tendance || "stable";
  const TrendIcon = trend === "hausse" ? TrendingUp : trend === "baisse" ? TrendingDown : Minus;
  const trendLabel =
    trend === "hausse"
      ? t("En amélioration", "Improving")
      : trend === "baisse"
        ? t("En baisse", "Declining")
        : t("Stable", "Stable");

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="overline">{t("Journal d'humeur", "Mood journal")}</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-ink sm:text-3xl">
            {t("Comment allez-vous aujourd'hui ?", "How are you today?")}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {t(
              "Un rituel de quelques secondes pour comprendre vos tendances et partager l'essentiel avec votre praticien.",
              "A few-second ritual to understand your patterns and share what matters with your practitioner.",
            )}
          </p>
        </div>
        <select
          value={period}
          onChange={(event) => setPeriod(Number(event.target.value))}
          className="input w-auto py-2.5 text-xs font-bold"
        >
          <option value={7}>{t("7 derniers jours", "Last 7 days")}</option>
          <option value={30}>{t("30 derniers jours", "Last 30 days")}</option>
          <option value={90}>{t("90 derniers jours", "Last 90 days")}</option>
        </select>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <section className="card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/70 bg-sage-50 px-5 py-4">
              <div className="inline-flex items-center gap-2">
                <HeartPulse className="h-4 w-4 text-teal-500" />
                <h2 className="text-sm font-black text-ink">
                  {t("Mon check-in du jour", "Today's check-in")}
                </h2>
              </div>
              <span className="text-[11px] font-semibold text-muted">
                {formatDate(new Date(), lang, "EEEE d MMMM yyyy")}
              </span>
            </div>
            <div className="p-5">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted">
                    {t("Niveau d'énergie", "Energy level")}
                  </p>
                  <p className="mt-1 text-5xl font-black tracking-tight text-teal-600">{score}<span className="text-lg text-muted">/10</span></p>
                </div>
                <span className="rounded-full bg-sage-100 px-3 py-1 text-[11px] font-bold text-teal-700">
                  {score <= 3
                    ? t("Difficile", "Hard")
                    : score <= 5
                      ? t("En dessous de la moyenne", "Below average")
                      : score <= 7
                        ? t("Correct", "Okay")
                        : t("Belle énergie", "Great energy")}
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={10}
                step={1}
                value={score}
                onChange={(event) => setScore(Number(event.target.value))}
                className="mt-4 h-2 w-full cursor-pointer appearance-none rounded-full accent-teal-500"
                style={{
                  background: `linear-gradient(to right, #1A5255 0%, #1A5255 ${(score - 1) * 11.1}%, #E8E1D1 ${(score - 1) * 11.1}%, #E8E1D1 100%)`,
                }}
              />
              <div className="mt-1 flex justify-between text-[10px] font-semibold text-muted">
                <span>{t("1 · très mal", "1 · very low")}</span>
                <span>{t("10 · excellent", "10 · excellent")}</span>
              </div>

              <p className="mt-5 text-xs font-bold uppercase tracking-wider text-muted">
                {t("Émotion dominante", "Dominant emotion")}
              </p>
              <div className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-7">
                {EMOTIONS.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setEmotion(item.value)}
                    className={
                      emotion === item.value
                        ? "rounded-2xl border-2 border-teal-400 bg-sage-50 px-1 py-3 text-center"
                        : "rounded-2xl border border-line bg-white px-1 py-3 text-center transition hover:border-sage-400 hover:bg-sage-50"
                    }
                  >
                    <span className="block text-xl">{item.emoji}</span>
                    <span className="mt-1 block text-[9px] font-bold text-muted">
                      {t(item.fr, item.en)}
                    </span>
                  </button>
                ))}
              </div>

              <p className="mt-5 text-xs font-bold uppercase tracking-wider text-muted">
                {t("Contexte (facultatif)", "Context (optional)")}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {TAGS.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => toggleTag(item.value)}
                    className={
                      tags.includes(item.value)
                        ? "chip border-transparent bg-teal-500 text-cream"
                        : "chip hover:border-sage-400"
                    }
                  >
                    {t(item.fr, item.en)}
                  </button>
                ))}
              </div>

              <label className="label mt-5" htmlFor="mood-note">
                {t("Un mot sur votre journée", "A word about your day")}
              </label>
              <textarea
                id="mood-note"
                rows={3}
                value={note}
                maxLength={2000}
                onChange={(event) => setNote(event.target.value)}
                className="textarea"
                placeholder={t(
                  "Ex. J'ai mieux dormi, mais la journée au travail était dense…",
                  "E.g. I slept better, but the workday was intense…",
                )}
              />

              {alert && (
                <div className="mt-4 rounded-2xl border-2 border-risk/30 bg-risk/5 p-4">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-risk" />
                    <div>
                      <p className="text-sm font-black text-risk">
                        {t("Votre sécurité est prioritaire", "Your safety comes first")}
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-muted">
                        {t(
                          "Si vous êtes en détresse, contactez la Protection civile (14) ou le SAMU (115), ou parlez à une personne de confiance.",
                          "If you are in distress, contact Civil Protection (14) or SAMU (115), or talk to someone you trust.",
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {aiMessage && !alert && (
                <div className="mt-4 rounded-2xl bg-sage-50 p-4">
                  <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-teal-500">
                    <Sparkles className="h-3.5 w-3.5" />
                    {t("Message de votre espace bien-être", "Message from your wellbeing space")}
                  </p>
                  <p className="mt-1.5 text-sm leading-relaxed text-teal-900/80">{aiMessage}</p>
                </div>
              )}

              <Button onClick={save} loading={saving} className="mt-4 w-full">
                <Leaf className="h-4 w-4" />
                {t("Enregistrer mon humeur", "Save my mood")}
              </Button>
            </div>
          </section>

          <section className="card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="inline-flex items-center gap-2 text-base font-black text-ink">
                  <TrendingUp className="h-4 w-4 text-teal-500" />
                  {t("Courbe d'humeur", "Mood trend")}
                </h2>
                <p className="mt-0.5 text-xs text-muted">
                  {stats?.entrees || 0} {t("entrée(s) sur la période", "entry(ies) in the period")}
                </p>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-sage-100 px-2.5 py-1 text-[10px] font-black text-teal-700">
                <TrendIcon className="h-3.5 w-3.5" />
                {trendLabel}
                {stats?.variation ? ` (${stats.variation > 0 ? "+" : ""}${stats.variation})` : ""}
              </span>
            </div>
            <div className="mt-4 h-56">
              {chartData.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 5, right: 8, left: -22, bottom: 0 }}>
                    <defs>
                      <linearGradient id="moodGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#1A5255" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#1A5255" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E8E1D1" vertical={false} />
                    <XAxis dataKey="date" tickLine={false} axisLine={false} />
                    <YAxis domain={[0, 10]} ticks={[0, 5, 10]} tickLine={false} axisLine={false} />
                    <Tooltip content={<ChartTooltip suffix="/10" />} />
                    <Area
                      type="monotone"
                      dataKey="score"
                      stroke="#1A5255"
                      strokeWidth={2.5}
                      fill="url(#moodGradient)"
                      name={t("Humeur", "Mood")}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full flex-col items-center justify-center rounded-2xl bg-sand/50 text-center">
                  <HeartPulse className="h-7 w-7 text-sage-400" />
                  <p className="mt-2 text-xs font-semibold text-muted">
                    {t("Enregistrez une humeur pour voir la courbe.", "Log a mood to see the trend.")}
                  </p>
                </div>
              )}
            </div>
          </section>

          <section className="card p-5">
            <h2 className="text-base font-black text-ink">
              {t("Dernières entrées", "Latest entries")}
            </h2>
            <div className="mt-3 space-y-2">
              {entries.length === 0 && (
                <p className="rounded-2xl bg-sand/50 px-4 py-6 text-center text-xs text-muted">
                  {t("Aucune entrée pour le moment.", "No entries yet.")}
                </p>
              )}
              {entries.slice(0, 12).map((entry) => {
                const config = EMOTIONS.find((item) => item.value === entry.emotion);
                return (
                  <article
                    key={entry.id}
                    className="rounded-2xl border border-line bg-white p-3.5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{config?.emoji || "🙂"}</span>
                        <div>
                          <p className="text-xs font-black text-ink">
                            {formatDate(entry.date_saisie, lang, "EEEE d MMMM yyyy")}
                          </p>
                          <p className="text-[10px] text-muted">
                            {config ? t(config.fr, config.en) : entry.emotion} ·{" "}
                            {formatDateTime(entry.date_modification || entry.date_creation, lang)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {entry.alerte && <AlertTriangle className="h-3.5 w-3.5 text-risk" />}
                        <Badge tone={scoreTone(entry.score)}>{entry.score}/10</Badge>
                      </div>
                    </div>
                    {entry.note && (
                      <p className="mt-2 text-[11px] leading-relaxed text-muted">{entry.note}</p>
                    )}
                    {entry.tags?.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {entry.tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full bg-sand px-2 py-0.5 text-[9px] font-bold text-teal-700"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        </div>

        <aside className="space-y-5">
          <section className="card p-5">
            <h2 className="text-sm font-black text-ink">{t("Vos repères", "Your markers")}</h2>
            <div className="mt-3 grid grid-cols-2 gap-2.5">
              {[
                { label: t("Moyenne", "Average"), value: stats?.moyenne ?? "—", suffix: "/10" },
                { label: t("Meilleur", "Best"), value: stats?.meilleur ?? "—", suffix: "/10" },
                { label: t("Plus bas", "Lowest"), value: stats?.pire ?? "—", suffix: "/10" },
                { label: t("Série", "Streak"), value: stats?.serie_actuelle ?? 0, suffix: t(" j", "d") },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl bg-sand/60 px-3 py-3 text-center">
                  <p className="text-[9px] font-black uppercase tracking-wider text-muted">
                    {item.label}
                  </p>
                  <p className="mt-1 text-lg font-black text-teal-700">
                    {item.value}
                    <span className="text-[10px] font-semibold text-muted">{item.suffix}</span>
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-2xl bg-sage-50 p-3.5">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-teal-500">
                {t("Lecture", "Reading")}
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-teal-900/75">
                {stats?.message_global ||
                  t(
                    "Vos données restent privées. Votre praticien ne voit que ce que vous partagez en séance.",
                    "Your data stays private. Your practitioner only sees what you share in session.",
                  )}
              </p>
            </div>
          </section>

          <section className="card p-5">
            <h2 className="text-sm font-black text-ink">{t("Répartition des scores", "Score distribution")}</h2>
            <div className="mt-3 h-40">
              {distribution.some((item) => item.count > 0) ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={distribution} margin={{ top: 5, right: 5, left: -28, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E8E1D1" vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="count" radius={[8, 8, 0, 0]} name={t("Entrées", "Entries")}>
                      {distribution.map((item, index) => (
                        <Cell key={item.label} fill={MOOD_COLORS[index % MOOD_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center rounded-2xl bg-sand/50 text-xs text-muted">
                  {t("Pas encore de données.", "No data yet.")}
                </div>
              )}
            </div>
          </section>

          <section className="card p-5">
            <h2 className="text-sm font-black text-ink">{t("Émotions fréquentes", "Frequent emotions")}</h2>
            <div className="mt-3 space-y-2.5">
              {emotionData.length === 0 && (
                <p className="text-xs text-muted">{t("Aucune donnée.", "No data.")}</p>
              )}
              {emotionData.map((item) => {
                const maximum = emotionData[0]?.count || 1;
                return (
                  <div key={item.label}>
                    <div className="mb-1 flex items-center justify-between text-[11px] font-bold">
                      <span className="text-teal-800">{item.label}</span>
                      <span className="text-muted">{item.count}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-sand">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-sage-400 to-teal-500"
                        style={{ width: `${Math.max(6, (item.count / maximum) * 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-3xl bg-teal-500 p-5 text-cream">
            <CalendarDays className="h-5 w-5 text-sage-300" />
            <h2 className="mt-2 text-sm font-black text-cream">
              {t("Un lien avec vos séances ?", "A link with your sessions?")}
            </h2>
            <p className="mt-1 text-[11px] leading-relaxed text-cream/65">
              {t(
                "Partagez vos tendances en séance pour donner plus de relief à votre accompagnement.",
                "Share your trends in session to give your care more depth.",
              )}
            </p>
            <a href="/app/seances" className="mt-3 inline-flex text-[11px] font-black text-sage-200 underline underline-offset-2">
              {t("Voir mes séances", "View my sessions")} →
            </a>
          </section>
        </aside>
      </div>
    </div>
  );
}
