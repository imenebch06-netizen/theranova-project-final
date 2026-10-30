import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CalendarPlus,
  Check,
  Clock3,
  HeartPulse,
  PlayCircle,
  Star,
  TrendingUp,
  Users,
  Video,
  Wallet,
  X,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import api, { extractError } from "../../lib/api";
import { useAuth } from "../../contexts/AuthContext";
import { useI18n } from "../../contexts/I18nContext";
import { useToast } from "../../contexts/ToastContext";
import Avatar from "../../components/ui/Avatar";
import { Badge, StatusBadge } from "../../components/ui/Badge";
import { Button, buttonClass } from "../../components/ui/Button";
import { EmptyState, ErrorState, LoadingBlock } from "../../components/ui/Feedback";
import { StatCard } from "../../components/ui/Card";
import ChartTooltip from "../../components/ChartTooltip";
import { formatCurrency, formatDate, formatTime, fromNow } from "../../lib/format";

export default function TherapistDashboard() {
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const { success, error: toastError } = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [joining, setJoining] = useState(null);
  const [acting, setActing] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data: payload } = await api.get("/dashboard/therapist/");
      setData(payload);
    } catch (err) {
      setError(
        extractError(
          err,
          t("Impossible de charger votre tableau de bord.", "Unable to load your dashboard."),
        ),
      );
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const series = useMemo(
    () =>
      (data?.series || []).map((item) => ({
        month: item.month,
        count: item.count,
      })),
    [data],
  );

  async function join(session) {
    setJoining(session.id);
    try {
      const { data: payload } = await api.post(`/scheduling/sessions/${session.id}/join/`);
      const link = payload.lien_googlemeet || payload.seance?.lien_googlemeet;
      if (link) window.open(link, "_blank", "noopener,noreferrer");
      success(t("La salle s'ouvre dans un nouvel onglet.", "The room is opening in a new tab."));
      load();
    } catch (err) {
      toastError(extractError(err, t("Impossible de rejoindre la séance.", "Unable to join the session.")));
    } finally {
      setJoining(null);
    }
  }

  async function decide(request, action) {
    setActing(`${request.id}-${action}`);
    try {
      await api.post(`/scheduling/requests/${request.id}/${action}/`, {});
      success(
        action === "accept"
          ? t("Demande acceptée. Les participants peuvent régler leur part.", "Request accepted. Participants can now pay their share.")
          : t("Demande refusée et créneau libéré.", "Request declined and slot released."),
      );
      load();
    } catch (err) {
      toastError(extractError(err));
    } finally {
      setActing(null);
    }
  }

  if (loading) return <LoadingBlock label={t("Chargement de votre espace praticien…", "Loading your practitioner space…")} />;
  if (error || !data) return <ErrorState message={error} onRetry={load} />;

  const { kpis, agenda_du_jour: today, prochaines_seances: upcoming, demandes, humeurs_recentes: moods, alertes } = data;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="overline">{formatDate(new Date(), lang, "EEEE d MMMM yyyy")}</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-ink sm:text-3xl">
            {t("Bonjour", "Hello")}, {user?.first_name || t("docteur", "doctor")} 👋
          </h1>
          <p className="mt-1 text-sm text-muted">
            {kpis.seances_aujourdhui > 0
              ? t(
                  `${kpis.seances_aujourdhui} séance(s) aujourd'hui, ${kpis.demandes_en_attente} demande(s) en attente.`,
                  `${kpis.seances_aujourdhui} session(s) today, ${kpis.demandes_en_attente} pending request(s).`,
                )
              : t("Aucune séance aujourd'hui. Profitez-en pour préparer votre semaine.", "No session today. Use the time to prepare your week.")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/pro/agenda" className={buttonClass({ variant: "outline", size: "sm" })}>
            <CalendarPlus className="h-4 w-4" />
            {t("Ouvrir un créneau", "Open a slot")}
          </Link>
          <Link to="/pro/demandes" className={buttonClass({ size: "sm" })}>
            <Clock3 className="h-4 w-4" />
            {t("Demandes", "Requests")}
            {kpis.demandes_en_attente > 0 && (
              <span className="rounded-full bg-cream/25 px-1.5 text-[10px] font-black">
                {kpis.demandes_en_attente}
              </span>
            )}
          </Link>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={CalendarDays}
          label={t("Séances aujourd'hui", "Sessions today")}
          value={kpis.seances_aujourdhui}
          hint={t(`${kpis.seances_semaine} cette semaine`, `${kpis.seances_semaine} this week`)}
        />
        <StatCard
          icon={Users}
          label={t("Patients actifs", "Active patients")}
          value={kpis.patients_actifs}
          hint={t(`${kpis.seances_terminees} séances terminées`, `${kpis.seances_terminees} completed sessions`)}
          tone="sage"
        />
        <StatCard
          icon={Wallet}
          label={t("Revenus du mois", "Monthly revenue")}
          value={formatCurrency(kpis.revenus_mois, lang)}
          hint={t("Séances réglées", "Paid sessions")}
          tone="gold"
        />
        <StatCard
          icon={Star}
          label={t("Note moyenne", "Average rating")}
          value={Number(kpis.note_globale || 0).toFixed(1)}
          hint={t(`${kpis.nombre_avis} avis patients`, `${kpis.nombre_avis} patient reviews`)}
          tone="success"
        />
      </div>

      {kpis.alertes_bien_etre > 0 && (
        <div className="rounded-3xl border-2 border-warn/40 bg-warn/5 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warn" />
            <div>
              <p className="text-sm font-black text-ink">
                {t(
                  `${kpis.alertes_bien_etre} alerte(s) bien-être sur les 14 derniers jours`,
                  `${kpis.alertes_bien_etre} wellbeing alert(s) in the last 14 days`,
                )}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                {t(
                  "Ces signaux proviennent du journal d'humeur de vos patients. Prenez contact avec bienveillance.",
                  "These signals come from your patients' mood journals. Reach out with care.",
                )}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {(alertes || []).map((alert) => (
                  <span key={`${alert.patient}-${alert.date}`} className="chip-sage">
                    {alert.patient} · {alert.score}/10
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[1.3fr_0.7fr]">
        <div className="space-y-5">
          <section className="card p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="inline-flex items-center gap-2 text-base font-black text-ink">
                  <Video className="h-4 w-4 text-teal-500" />
                  {t("Agenda du jour", "Today's agenda")}
                </h2>
                <p className="mt-0.5 text-xs text-muted">
                  {formatDate(new Date(), lang, "EEEE d MMMM yyyy")}
                </p>
              </div>
              <Link to="/pro/agenda" className="text-[11px] font-bold text-teal-600 hover:text-teal-800">
                {t("Gérer mon agenda", "Manage my calendar")} →
              </Link>
            </div>

            <div className="mt-4 space-y-2">
              {today.length === 0 && (
                <div className="rounded-2xl bg-sand/50 px-4 py-8 text-center">
                  <CalendarDays className="mx-auto h-6 w-6 text-sage-400" />
                  <p className="mt-2 text-xs font-semibold text-muted">
                    {t("Aucune séance aujourd'hui.", "No session today.")}
                  </p>
                </div>
              )}
              {today.map((session) => (
                <div
                  key={session.id}
                  className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-white p-3"
                >
                  <div className="flex h-12 w-16 shrink-0 flex-col items-center justify-center rounded-xl bg-sage-50">
                    <span className="text-sm font-black text-teal-700">
                      {formatTime(session.heure)}
                    </span>
                    <span className="text-[9px] font-semibold text-muted">
                      {session.type_session}
                    </span>
                  </div>
                  <Avatar src={session.patient_avatar} name={session.patient} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-ink">{session.patient}</p>
                    <div className="mt-0.5">
                      <StatusBadge status={session.statut} />
                    </div>
                  </div>
                  {session.can_join ? (
                    <Button size="sm" onClick={() => join(session)} loading={joining === session.id}>
                      <PlayCircle className="h-3.5 w-3.5" />
                      {t("Rejoindre", "Join")}
                    </Button>
                  ) : (
                    <Link
                      to="/pro/seances"
                      className={buttonClass({ variant: "outline", size: "sm" })}
                    >
                      {t("Détails", "Details")}
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section className="card p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="inline-flex items-center gap-2 text-base font-black text-ink">
                  <Clock3 className="h-4 w-4 text-teal-500" />
                  {t("Demandes en attente", "Pending requests")}
                </h2>
                <p className="mt-0.5 text-xs text-muted">
                  {t("Répondez rapidement pour confirmer les créneaux.", "Reply quickly to confirm slots.")}
                </p>
              </div>
              <Link to="/pro/demandes" className="text-[11px] font-bold text-teal-600 hover:text-teal-800">
                {t("Tout voir", "View all")} →
              </Link>
            </div>
            <div className="mt-3 space-y-2">
              {(demandes || []).length === 0 && (
                <p className="rounded-2xl bg-sand/50 px-4 py-6 text-center text-xs text-muted">
                  {t("Aucune demande en attente.", "No pending request.")}
                </p>
              )}
              {(demandes || []).map((request) => (
                <div
                  key={request.id}
                  className="rounded-2xl border border-line bg-white p-3.5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <Avatar src={request.avatar} name={request.patient} size="sm" />
                      <div>
                        <p className="text-xs font-black text-ink">{request.patient}</p>
                        <p className="text-[10px] text-muted">
                          {formatDate(request.date_debut, lang, "d MMM")} ·{" "}
                          {formatTime(request.date_debut)} · {request.type_session}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      <Button
                        size="sm"
                        onClick={() => decide(request, "accept")}
                        loading={acting === `${request.id}-accept`}
                      >
                        <Check className="h-3.5 w-3.5" />
                        {t("Accepter", "Accept")}
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => decide(request, "refuse")}
                        loading={acting === `${request.id}-refuse`}
                      >
                        <X className="h-3.5 w-3.5" />
                        {t("Refuser", "Decline")}
                      </Button>
                    </div>
                  </div>
                  {request.message && (
                    <p className="mt-2 line-clamp-2 rounded-xl bg-sand/50 px-2.5 py-2 text-[10px] leading-relaxed text-muted">
                      « {request.message} »
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section className="card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="inline-flex items-center gap-2 text-base font-black text-ink">
                  <TrendingUp className="h-4 w-4 text-teal-500" />
                  {t("Activité des 6 derniers mois", "Activity over the last 6 months")}
                </h2>
                <p className="mt-0.5 text-xs text-muted">
                  {t("Nombre de séances enregistrées par mois.", "Number of sessions recorded per month.")}
                </p>
              </div>
              <Badge tone="sage">
                {kpis.seances_terminees} {t("terminées", "completed")}
              </Badge>
            </div>
            <div className="mt-4 h-52">
              {series.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={series} margin={{ top: 5, right: 8, left: -24, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E8E1D1" vertical={false} />
                    <XAxis dataKey="month" tickLine={false} axisLine={false} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="count" fill="#1A5255" radius={[8, 8, 0, 0]} name={t("Séances", "Sessions")} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center rounded-2xl bg-sand/50 text-xs text-muted">
                  {t("Pas encore d'activité.", "No activity yet.")}
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="space-y-5">
          <section className="card p-5">
            <div className="flex items-center justify-between">
              <h2 className="inline-flex items-center gap-2 text-sm font-black text-ink">
                <CalendarDays className="h-4 w-4 text-teal-500" />
                {t("Prochaines séances", "Upcoming sessions")}
              </h2>
              <Link to="/pro/seances" className="text-[10px] font-bold text-teal-600 hover:text-teal-800">
                {t("Tout voir", "View all")}
              </Link>
            </div>
            <div className="mt-3 space-y-2.5">
              {(upcoming || []).length === 0 && (
                <p className="rounded-2xl bg-sand/50 px-3 py-4 text-center text-[11px] text-muted">
                  {t("Aucune séance à venir.", "No upcoming session.")}
                </p>
              )}
              {(upcoming || []).map((session) => (
                <div key={session.id} className="flex items-center gap-2.5 border-b border-line/60 pb-2.5 last:border-0 last:pb-0">
                  <Avatar src={session.avatar} name={session.patient} size="xs" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-ink">{session.patient}</p>
                    <p className="text-[10px] text-muted">
                      {formatDate(session.date_debut, lang, "d MMM")} · {formatTime(session.date_debut)}
                    </p>
                  </div>
                  <span className="shrink-0 text-[9px] font-semibold text-muted">
                    {fromNow(session.date_debut, lang)}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="card p-5">
            <div className="flex items-center justify-between">
              <h2 className="inline-flex items-center gap-2 text-sm font-black text-ink">
                <HeartPulse className="h-4 w-4 text-teal-500" />
                {t("Humeur des patients", "Patient moods")}
              </h2>
              <span className="text-[10px] font-semibold text-muted">
                {kpis.humeur_moyenne_patients ? `${kpis.humeur_moyenne_patients}/10` : "—"}
              </span>
            </div>
            <div className="mt-3 space-y-2">
              {(moods || []).length === 0 && (
                <p className="rounded-2xl bg-sand/50 px-3 py-4 text-center text-[11px] text-muted">
                  {t("Aucune donnée d'humeur.", "No mood data.")}
                </p>
              )}
              {(moods || []).map((mood, index) => (
                <div key={`${mood.patient}-${mood.date}-${index}`} className="flex items-center gap-2.5">
                  <span
                    className={
                      mood.alerte
                        ? "h-2 w-2 shrink-0 rounded-full bg-risk"
                        : "h-2 w-2 shrink-0 rounded-full bg-sage-400"
                    }
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-bold text-ink">{mood.patient}</p>
                    <p className="text-[9px] text-muted">
                      {formatDate(mood.date, lang, "d MMM")} · {mood.emotion}
                    </p>
                  </div>
                  <span className="text-[11px] font-black text-teal-600">{mood.score}/10</span>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-3xl bg-teal-500 p-5 text-cream">
            <Star className="h-5 w-5 text-sage-300" />
            <h2 className="mt-2 text-sm font-black text-cream">
              {t("Votre réputation clinique", "Your clinical reputation")}
            </h2>
            <p className="mt-1 text-[11px] leading-relaxed text-cream/65">
              {t(
                "Une note de qualité et des avis transparents renforcent la confiance des patients.",
                "A quality rating and transparent reviews build patient trust.",
              )}
            </p>
            <Link to="/pro/avis" className={buttonClass({ variant: "secondary", size: "sm", className: "mt-3 w-full" })}>
              {t("Voir mes avis", "View my reviews")}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </section>
        </div>
      </div>
    </div>
  );
}
