import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  CalendarCheck2,
  CalendarDays,
  Clock3,
  MessageCircle,
  Stethoscope,
  TrendingUp,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import api, { extractError } from "../../lib/api";
import { useI18n } from "../../contexts/I18nContext";
import { Badge, StatusBadge } from "../../components/ui/Badge";
import { EmptyState, ErrorState, LoadingBlock } from "../../components/ui/Feedback";
import { StatCard } from "../../components/ui/Card";
import ChartTooltip from "../../components/ChartTooltip";
import { formatCurrency, formatDate, formatNumber } from "../../lib/format";

const PERIODS = [
  { value: "day", fr: "Jour", en: "Day" },
  { value: "week", fr: "Semaine", en: "Week" },
  { value: "month", fr: "Mois", en: "Month" },
  { value: "year", fr: "Année", en: "Year" },
  { value: "all", fr: "Tout", en: "All" },
];

const PIE_COLORS = ["#1A5255", "#9BB07A", "#E0A458", "#C96B4B"];

function monthLabel(value, lang) {
  if (!value) return "—";
  return formatDate(`${value}-01`, lang, "MMM yy");
}

export default function AdminDashboard() {
  const { t, lang } = useI18n();
  const [period, setPeriod] = useState("month");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data: payload } = await api.get("/dashboard/admin/", { params: { period } });
      setData(payload);
    } catch (err) {
      setError(
        extractError(
          err,
          t("Impossible de charger le tableau de bord.", "Unable to load the dashboard."),
        ),
      );
    } finally {
      setLoading(false);
    }
  }, [period, t]);

  useEffect(() => {
    load();
  }, [load]);

  const revenueSeries = useMemo(
    () =>
      (data?.series?.revenus || []).map((item) => ({
        ...item,
        label: monthLabel(item.month, lang),
      })),
    [data, lang],
  );

  const sessionSeries = useMemo(
    () =>
      (data?.series?.seances || []).map((item) => ({
        ...item,
        label: monthLabel(item.month, lang),
      })),
    [data, lang],
  );

  const revenueByType = useMemo(
    () =>
      (data?.revenus_par_type || []).map((item) => ({
        ...item,
        name:
          item.type === "Pack"
            ? t("Packs", "Packs")
            : item.type === "Seance"
              ? t("Séances", "Sessions")
              : item.type,
      })),
    [data, t],
  );

  if (loading) return <LoadingBlock label={t("Chargement du tableau de bord…", "Loading the dashboard…")} />;
  if (error || !data) return <ErrorState message={error} onRetry={load} />;

  const { kpis, top_therapeutes: topTherapists, transactions_recentes: recentTransactions, reclamations_recentes: recentComplaints } = data;
  const goal = Math.max(Number(kpis.objectif_revenus) || 0, 1);
  const progress = Math.min(Math.round((Number(kpis.revenus) / goal) * 100), 100);
  const hasAlerts = kpis.therapeutes_en_attente > 0 || kpis.reclamations_urgentes > 0 || kpis.signalements_ouverts > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="overline">{t("Administration", "Administration")}</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-ink sm:text-3xl">
            {t("Vue d'ensemble de la plateforme", "Platform overview")}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {t(
              "Activité, revenus, qualité des soins et modération en un seul endroit.",
              "Activity, revenue, quality of care and moderation in one place.",
            )}
          </p>
        </div>
        <div className="no-scrollbar flex gap-1 overflow-x-auto rounded-full bg-sand/80 p-1.5">
          {PERIODS.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setPeriod(item.value)}
              className={
                period === item.value
                  ? "shrink-0 rounded-full bg-teal-500 px-3.5 py-1.5 text-xs font-black text-cream"
                  : "shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold text-muted transition hover:text-teal-600"
              }
            >
              {t(item.fr, item.en)}
            </button>
          ))}
        </div>
      </div>

      {hasAlerts && (
        <div className="flex flex-col gap-3 rounded-3xl border-2 border-warn/30 bg-warn/5 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warn" />
            <div>
              <p className="text-sm font-black text-ink">
                {t("Points nécessitant votre attention", "Points requiring your attention")}
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted">
                {[
                  kpis.therapeutes_en_attente
                    ? t(
                        `${kpis.therapeutes_en_attente} dossier(s) praticien à valider`,
                        `${kpis.therapeutes_en_attente} practitioner file(s) to approve`,
                      )
                    : null,
                  kpis.reclamations_urgentes
                    ? t(
                        `${kpis.reclamations_urgentes} réclamation(s) urgente(s)`,
                        `${kpis.reclamations_urgentes} urgent complaint(s)`,
                      )
                    : null,
                  kpis.signalements_ouverts
                    ? t(
                        `${kpis.signalements_ouverts} signalement(s) ouvert(s)`,
                        `${kpis.signalements_ouverts} open report(s)`,
                      )
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            {kpis.therapeutes_en_attente > 0 && (
              <Link to="/admin/therapeutes" className="btn-outline btn-sm">
                {t("Valider les praticiens", "Approve practitioners")}
              </Link>
            )}
            {kpis.reclamations_urgentes > 0 && (
              <Link to="/admin/reclamations" className="btn-sm btn bg-teal-500 text-cream hover:bg-teal-600">
                {t("Traiter les urgences", "Handle urgent cases")}
              </Link>
            )}
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Wallet}
          label={t("Revenus de la période", "Period revenue")}
          value={formatCurrency(kpis.revenus, lang)}
          hint={t(
            `${progress}% de l'objectif de ${formatCurrency(goal, lang)}`,
            `${progress}% of the ${formatCurrency(goal, lang)} target`,
          )}
          tone="gold"
        />
        <StatCard
          icon={Users}
          label={t("Utilisateurs", "Users")}
          value={formatNumber(kpis.utilisateurs, lang)}
          hint={t(
            `${kpis.patients} patients · ${kpis.therapeutes} praticiens`,
            `${kpis.patients} patients · ${kpis.therapeutes} practitioners`,
          )}
          tone="teal"
        />
        <StatCard
          icon={CalendarCheck2}
          label={t("Séances terminées", "Completed sessions")}
          value={formatNumber(kpis.seances_terminees, lang)}
          hint={t(
            `${kpis.taux_completion}% de taux de complétion`,
            `${kpis.taux_completion}% completion rate`,
          )}
          tone="success"
        />
        <StatCard
          icon={MessageCircle}
          label={t("Réclamations ouvertes", "Open complaints")}
          value={kpis.reclamations_ouvertes}
          hint={t(
            `${kpis.taux_resolution}% résolues`,
            `${kpis.taux_resolution}% resolved`,
          )}
          tone={kpis.reclamations_ouvertes ? "risk" : "sage"}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="card p-4">
          <p className="text-[10px] font-black uppercase tracking-wider text-muted">
            {t("À venir", "Upcoming")}
          </p>
          <p className="mt-1 text-lg font-black text-ink">{kpis.seances_a_venir}</p>
          <p className="text-[10px] text-muted">{t("séances planifiées", "scheduled sessions")}</p>
        </div>
        <div className="card p-4">
          <p className="text-[10px] font-black uppercase tracking-wider text-muted">
            {t("Annulations", "Cancellations")}
          </p>
          <p className="mt-1 text-lg font-black text-ink">{kpis.annulations}</p>
          <p className="text-[10px] text-muted">{t("demandes annulées ou refusées", "cancelled or declined requests")}</p>
        </div>
        <div className="card p-4">
          <p className="text-[10px] font-black uppercase tracking-wider text-muted">
            {t("Nouveaux utilisateurs", "New users")}
          </p>
          <p className="mt-1 text-lg font-black text-ink">{kpis.nouveaux_utilisateurs}</p>
          <p className="text-[10px] text-muted">{t("sur la période", "during the period")}</p>
        </div>
        <div className="card p-4">
          <p className="text-[10px] font-black uppercase tracking-wider text-muted">
            {t("Note moyenne", "Average rating")}
          </p>
          <p className="mt-1 text-lg font-black text-ink">{Number(kpis.note_moyenne || 0).toFixed(1)}/5</p>
          <p className="text-[10px] text-muted">{t("avis patients", "patient reviews")}</p>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
        <section className="card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="inline-flex items-center gap-2 text-base font-black text-ink">
                <TrendingUp className="h-4 w-4 text-teal-500" />
                {t("Évolution des revenus", "Revenue trend")}
              </h2>
              <p className="mt-0.5 text-xs text-muted">
                {t("Packs et séances réglés sur 12 mois.", "Packs and paid sessions over 12 months.")}
              </p>
            </div>
            <Badge tone="gold">{formatCurrency(kpis.revenus, lang)}</Badge>
          </div>
          <div className="mt-4 h-64">
            {revenueSeries.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueSeries} margin={{ top: 5, right: 8, left: -12, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#1A5255" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#1A5255" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E8E1D1" vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10 }} width={54} />
                  <Tooltip
                    content={
                      <ChartTooltip formatter={(value) => formatCurrency(value, lang)} />
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    name={t("Revenus", "Revenue")}
                    stroke="#1A5255"
                    strokeWidth={2.5}
                    fill="url(#revenueFill)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center rounded-2xl bg-sand/50 text-xs text-muted">
                {t("Pas encore de revenus enregistrés.", "No revenue recorded yet.")}
              </div>
            )}
          </div>
        </section>

        <section className="card p-5">
          <h2 className="text-base font-black text-ink">{t("Répartition des revenus", "Revenue breakdown")}</h2>
          <p className="mt-0.5 text-xs text-muted">
            {t("Par type de prestation.", "By type of service.")}
          </p>
          <div className="mt-2 h-48">
            {revenueByType.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={revenueByType}
                    dataKey="total"
                    nameKey="name"
                    innerRadius={45}
                    outerRadius={72}
                    paddingAngle={3}
                  >
                    {revenueByType.map((entry, index) => (
                      <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={
                      <ChartTooltip formatter={(value) => formatCurrency(value, lang)} />
                    }
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center rounded-2xl bg-sand/50 text-xs text-muted">
                {t("Aucune donnée.", "No data.")}
              </div>
            )}
          </div>
          <div className="mt-2 space-y-1.5">
            {revenueByType.map((item, index) => (
              <div key={item.name} className="flex items-center justify-between text-[11px]">
                <span className="inline-flex items-center gap-1.5 font-semibold text-muted">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}
                  />
                  {item.name}
                </span>
                <span className="font-black text-ink">{formatCurrency(item.total, lang)}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="card p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="inline-flex items-center gap-2 text-base font-black text-ink">
                <CalendarDays className="h-4 w-4 text-teal-500" />
                {t("Séances terminées par mois", "Completed sessions per month")}
              </h2>
              <p className="mt-0.5 text-xs text-muted">
                {t("Volume d'activité clinique.", "Clinical activity volume.")}
              </p>
            </div>
            <Badge tone="sage">
              {kpis.seances_terminees} {t("terminées", "completed")}
            </Badge>
          </div>
          <div className="mt-4 h-52">
            {sessionSeries.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sessionSeries} margin={{ top: 5, right: 8, left: -24, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E8E1D1" vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="count" name={t("Séances", "Sessions")} fill="#9BB07A" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center rounded-2xl bg-sand/50 text-xs text-muted">
                {t("Aucune séance terminée.", "No completed session.")}
              </div>
            )}
          </div>
        </section>

        <section className="card p-5">
          <div className="flex items-center justify-between">
            <h2 className="inline-flex items-center gap-2 text-base font-black text-ink">
              <Stethoscope className="h-4 w-4 text-teal-500" />
              {t("Praticiens les plus actifs", "Most active practitioners")}
            </h2>
            <Link to="/admin/therapeutes" className="text-[11px] font-bold text-teal-600 hover:text-teal-800">
              {t("Tout voir", "View all")} →
            </Link>
          </div>
          <div className="mt-3 space-y-2.5">
            {topTherapists.length === 0 && (
              <p className="rounded-2xl bg-sand/50 px-3 py-6 text-center text-[11px] text-muted">
                {t("Aucune activité enregistrée.", "No activity recorded.")}
              </p>
            )}
            {topTherapists.map((therapist, index) => (
              <div key={therapist.id} className="flex items-center gap-2.5">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sage-100 text-[10px] font-black text-teal-700">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-ink">{therapist.nom}</p>
                  <p className="truncate text-[10px] text-muted">
                    {(therapist.specialites || []).join(" · ") || t("Praticien", "Practitioner")}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[11px] font-black text-teal-600">{therapist.seances}</p>
                  <p className="text-[9px] text-muted">{t("séances", "sessions")}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="card p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-black text-ink">{t("Transactions récentes", "Recent transactions")}</h2>
            <Link to="/admin/paiements" className="inline-flex items-center gap-1 text-[11px] font-bold text-teal-600 hover:text-teal-800">
              {t("Tous les paiements", "All payments")}
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {recentTransactions.length === 0 ? (
            <EmptyState
              icon={Wallet}
              title={t("Aucune transaction", "No transaction")}
              description={t("Les paiements apparaîtront ici.", "Payments will appear here.")}
              className="mt-3 !py-8"
            />
          ) : (
            <div className="table-wrap mt-3">
              <table className="table">
                <thead>
                  <tr>
                    <th>{t("Référence", "Reference")}</th>
                    <th>{t("Patient", "Patient")}</th>
                    <th>{t("Type", "Type")}</th>
                    <th>{t("Montant", "Amount")}</th>
                    <th>{t("Statut", "Status")}</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTransactions.map((transaction) => (
                    <tr key={transaction.id}>
                      <td>
                        <p className="text-[11px] font-black text-ink">{transaction.reference}</p>
                        <p className="text-[10px] text-muted">
                          {formatDate(transaction.date, lang, "d MMM yyyy")}
                        </p>
                      </td>
                      <td className="text-xs font-semibold text-ink">{transaction.patient}</td>
                      <td>
                        <Badge tone="sage">{transaction.type}</Badge>
                      </td>
                      <td className="text-xs font-black text-teal-600">
                        {formatCurrency(transaction.montant, lang)}
                      </td>
                      <td>
                        <StatusBadge status={transaction.statut} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="card p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-black text-ink">{t("Réclamations récentes", "Recent complaints")}</h2>
            <Link to="/admin/reclamations" className="text-[11px] font-bold text-teal-600 hover:text-teal-800">
              {t("Tout voir", "View all")} →
            </Link>
          </div>
          <div className="mt-3 space-y-2">
            {recentComplaints.length === 0 && (
              <p className="rounded-2xl bg-sand/50 px-3 py-6 text-center text-[11px] text-muted">
                {t("Aucune réclamation.", "No complaint.")}
              </p>
            )}
            {recentComplaints.map((complaint) => (
              <div key={complaint.id} className="rounded-2xl border border-line bg-white p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-ink">{complaint.categorie}</p>
                    <p className="truncate text-[10px] text-muted">
                      {complaint.patient} · {formatDate(complaint.date, lang, "d MMM")}
                    </p>
                  </div>
                  <StatusBadge status={complaint.priorite} />
                </div>
                <div className="mt-1.5 flex items-center justify-between">
                  <StatusBadge status={complaint.statut} />
                  {complaint.priorite === "haute" && (
                    <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase text-risk">
                      <Clock3 className="h-3 w-3" />
                      {t("Urgent", "Urgent")}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-2xl bg-sage-50 p-3.5">
            <div className="flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-teal-500" />
              <p className="text-[11px] font-black text-teal-900">
                {t("Communauté en croissance", "Growing community")}
              </p>
            </div>
            <p className="mt-1 text-[10px] leading-relaxed text-teal-900/70">
              {t(
                `${kpis.nouveaux_utilisateurs} nouveaux comptes sur la période, ${kpis.therapeutes_actifs} praticiens actifs.`,
                `${kpis.nouveaux_utilisateurs} new accounts during the period, ${kpis.therapeutes_actifs} active practitioners.`,
              )}
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
