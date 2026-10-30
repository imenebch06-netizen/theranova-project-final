import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  CalendarClock,
  CheckCircle2,
  Clock3,
  FileText,
  MessageCircle,
  PlayCircle,
  Search,
  Users,
  Video,
} from "lucide-react";
import api, { extractError, getAll } from "../../lib/api";
import { useI18n } from "../../contexts/I18nContext";
import { useToast } from "../../contexts/ToastContext";
import Avatar from "../../components/ui/Avatar";
import { Badge, StatusBadge } from "../../components/ui/Badge";
import { Button, buttonClass } from "../../components/ui/Button";
import { EmptyState, ErrorState, LoadingBlock } from "../../components/ui/Feedback";
import Modal from "../../components/ui/Modal";
import Tabs from "../../components/ui/Tabs";
import { Select, Textarea } from "../../components/ui/Field";
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatTime,
  fromNow,
} from "../../lib/format";

const EVOLUTIONS = [
  { value: "amelioration", fr: "Amélioration", en: "Improvement" },
  { value: "stable", fr: "Stable", en: "Stable" },
  { value: "degradation", fr: "Dégradation", en: "Deterioration" },
];

export default function TherapistSessions() {
  const { t, lang } = useI18n();
  const { success, error: toastError } = useToast();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("upcoming");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [joining, setJoining] = useState(null);

  const [completeTarget, setCompleteTarget] = useState(null);
  const [completeNotes, setCompleteNotes] = useState("");
  const [completing, setCompleting] = useState(false);

  const [reportOpen, setReportOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState(null);
  const [reportForm, setReportForm] = useState({
    objectifs_seance: "",
    observations: "",
    evolution: "stable",
    exercices: "",
  });
  const [reportLoading, setReportLoading] = useState(false);
  const [savingReport, setSavingReport] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const list = await getAll("/scheduling/sessions/");
      setSessions(list || []);
    } catch (err) {
      setError(
        extractError(
          err,
          t("Impossible de charger vos séances.", "Unable to load your sessions."),
        ),
      );
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const now = Date.now();

  const list = useMemo(() => {
    const query = search.trim().toLowerCase();
    return sessions
      .filter((session) => {
        const upcoming = new Date(session.date_debut).getTime() >= now - 60 * 60000;
        if (tab === "upcoming" && (!upcoming || session.statut === "annulee")) return false;
        if (tab === "past" && upcoming && session.statut !== "terminee") return false;
        if (statusFilter && session.statut !== statusFilter) return false;
        if (!query) return true;
        return `${session.patient?.full_name || ""} ${session.type_session || ""}`
          .toLowerCase()
          .includes(query);
      })
      .sort((a, b) =>
        tab === "upcoming"
          ? new Date(a.date_debut) - new Date(b.date_debut)
          : new Date(b.date_debut) - new Date(a.date_debut),
      );
  }, [sessions, tab, statusFilter, search, now]);

  const stats = useMemo(() => {
    const completed = sessions.filter((session) => session.statut === "terminee");
    const upcoming = sessions.filter(
      (session) =>
        new Date(session.date_debut).getTime() >= now && session.statut !== "annulee",
    );
    return {
      completed: completed.length,
      upcoming: upcoming.length,
      revenue: completed.reduce((sum, session) => sum + Number(session.prix_final || 0), 0),
    };
  }, [sessions, now]);

  async function join(session) {
    setJoining(session.id);
    try {
      const { data } = await api.post(`/scheduling/sessions/${session.id}/join/`);
      const link = data.lien_googlemeet || data.seance?.lien_googlemeet;
      if (link) window.open(link, "_blank", "noopener,noreferrer");
      success(t("La salle s'ouvre dans un nouvel onglet.", "The room is opening in a new tab."));
      load();
    } catch (err) {
      toastError(extractError(err, t("Impossible de rejoindre la séance.", "Unable to join the session.")));
    } finally {
      setJoining(null);
    }
  }

  function openComplete(session) {
    setCompleteTarget(session);
    setCompleteNotes("");
  }

  async function complete() {
    if (!completeTarget) return;
    setCompleting(true);
    try {
      await api.post(`/scheduling/sessions/${completeTarget.id}/complete/`, {
        notes: completeNotes.trim(),
      });
      success(
        t("La séance a été clôturée.", "The session has been completed."),
        { title: t("Séance terminée", "Session completed") },
      );
      setCompleteTarget(null);
      setCompleteNotes("");
      load();
    } catch (err) {
      toastError(extractError(err, t("La clôture a échoué.", "Completion failed.")));
    } finally {
      setCompleting(false);
    }
  }

  async function openReport(session) {
    setReportTarget(session);
    setReportOpen(true);
    setReportLoading(true);
    setReportForm({
      objectifs_seance: "",
      observations: "",
      evolution: "stable",
      exercices: "",
    });
    try {
      const { data } = await api.get(`/clinical/sessions/${session.id}/report/`);
      setReportForm({
        objectifs_seance: data.objectifs_seance || "",
        observations: data.observations || "",
        evolution: data.evolution || "stable",
        exercices: data.exercices || "",
      });
    } catch {
      /* no existing report */
    } finally {
      setReportLoading(false);
    }
  }

  async function saveReport(event) {
    event?.preventDefault();
    if (!reportTarget) return;
    setSavingReport(true);
    try {
      await api.post(`/clinical/sessions/${reportTarget.id}/report/`, reportForm);
      success(t("Rapport de séance enregistré.", "Session report saved."));
      setReportOpen(false);
      load();
    } catch (err) {
      toastError(extractError(err, t("Le rapport n'a pas pu être enregistré.", "The report could not be saved.")));
    } finally {
      setSavingReport(false);
    }
  }

  if (loading) return <LoadingBlock label={t("Chargement de vos séances…", "Loading your sessions…")} />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const tabs = [
    { value: "upcoming", label: t("À venir", "Upcoming"), icon: CalendarClock },
    { value: "past", label: t("Historique", "History"), icon: CheckCircle2 },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="overline">{t("Mes séances", "My sessions")}</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-ink sm:text-3xl">
            {t("Votre pratique au quotidien", "Your daily practice")}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {t(
              "Rejoignez la salle, clôturez une séance et documentez le suivi clinique.",
              "Join the room, complete a session and document the clinical follow-up.",
            )}
          </p>
        </div>
        <Link to="/pro/agenda" className={buttonClass({ variant: "outline", size: "sm" })}>
          <CalendarClock className="h-4 w-4" />
          {t("Gérer mon agenda", "Manage my calendar")}
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="card flex items-center gap-3 p-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-teal-500/10 text-teal-600">
            <CalendarClock className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-muted">
              {t("À venir", "Upcoming")}
            </p>
            <p className="text-lg font-black text-ink">{stats.upcoming}</p>
          </div>
        </div>
        <div className="card flex items-center gap-3 p-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-success/10 text-success">
            <CheckCircle2 className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-muted">
              {t("Terminées", "Completed")}
            </p>
            <p className="text-lg font-black text-ink">{stats.completed}</p>
          </div>
        </div>
        <div className="card flex items-center gap-3 p-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gold/25 text-teal-700">
            <FileText className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-muted">
              {t("Chiffre d'affaires séances", "Session revenue")}
            </p>
            <p className="text-sm font-black text-ink">{formatCurrency(stats.revenue, lang)}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <Tabs tabs={tabs} value={tab} onChange={setTab} className="w-fit" />
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("Rechercher un patient…", "Search a patient…")}
              className="input w-full py-2.5 pl-10 text-xs sm:w-64"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="input w-auto py-2.5 text-xs font-bold"
          >
            <option value="">{t("Tous les statuts", "All statuses")}</option>
            <option value="prevue">{t("Prévues", "Scheduled")}</option>
            <option value="en_cours">{t("En cours", "In progress")}</option>
            <option value="terminee">{t("Terminées", "Completed")}</option>
            <option value="annulee">{t("Annulées", "Cancelled")}</option>
          </select>
        </div>
      </div>

      {list.length === 0 ? (
        <EmptyState
          icon={Video}
          title={
            tab === "upcoming"
              ? t("Aucune séance à venir", "No upcoming session")
              : t("Aucune séance passée", "No past session")
          }
          description={t(
            "Les séances confirmées apparaissent dès que tous les participants ont réglé leur part.",
            "Confirmed sessions appear as soon as all participants have paid their share.",
          )}
          action={
            <Link to="/pro/demandes" className={buttonClass()}>
              {t("Voir les demandes", "View requests")}
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {list.map((session) => {
            const participants = session.participants || [];
            const isUpcoming = new Date(session.date_debut).getTime() >= now;
            return (
              <article key={session.id} className="card overflow-hidden">
                <div className="grid gap-0 lg:grid-cols-[1fr_230px]">
                  <div className="p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <Avatar
                          src={session.patient?.avatar}
                          name={session.patient?.full_name}
                          size="md"
                        />
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-sm font-black text-ink">
                              {session.patient?.full_name}
                            </h2>
                            <StatusBadge status={session.statut} />
                            <Badge tone="sage">{session.type_session}</Badge>
                            {session.accessible && (
                              <Badge tone="success">{t("Salle ouverte", "Room open")}</Badge>
                            )}
                          </div>
                          <p className="mt-0.5 text-[11px] text-muted">
                            {session.patient?.email}
                          </p>
                          <p className="mt-1 inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted">
                            <Clock3 className="h-3.5 w-3.5 text-teal-500" />
                            {formatDate(session.date_debut, lang, "EEEE d MMMM yyyy")} ·{" "}
                            {formatTime(session.date_debut)} – {formatTime(session.date_fin)}
                            {isUpcoming ? ` · ${fromNow(session.date_debut, lang)}` : ""}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-black uppercase tracking-wider text-muted">
                          {t("Montant", "Amount")}
                        </p>
                        <p className="text-base font-black text-teal-600">
                          {formatCurrency(session.prix_final, lang)}
                        </p>
                      </div>
                    </div>

                    {participants.length > 1 && (
                      <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl bg-sage-50 px-3 py-2">
                        <Users className="h-3.5 w-3.5 text-teal-500" />
                        <span className="text-[10px] font-bold text-teal-800">
                          {participants.length} {t("participants", "participants")}
                        </span>
                        <span className="text-[10px] text-muted">
                          {participants.map((participant) => participant.nom).filter(Boolean).join(", ")}
                        </span>
                      </div>
                    )}

                    {session.notes && (
                      <p className="mt-3 whitespace-pre-line rounded-2xl bg-sand/50 px-3 py-2 text-[10px] leading-relaxed text-muted">
                        {session.notes}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col justify-center gap-2 border-t border-line/70 bg-cream/50 p-4 lg:border-l lg:border-t-0">
                    {session.can_join && (
                      <Button onClick={() => join(session)} loading={joining === session.id}>
                        <PlayCircle className="h-4 w-4" />
                        {t("Rejoindre", "Join")}
                      </Button>
                    )}
                    {["prevue", "en_cours"].includes(session.statut) && (
                      <Button variant="outline" onClick={() => openComplete(session)}>
                        <CheckCircle2 className="h-4 w-4" />
                        {t("Clôturer", "Complete")}
                      </Button>
                    )}
                    {session.statut === "terminee" && (
                      <Button onClick={() => openReport(session)}>
                        <FileText className="h-4 w-4" />
                        {t("Rapport de séance", "Session report")}
                      </Button>
                    )}
                    <Link
                      to="/pro/messages"
                      className={buttonClass({ variant: "ghost", size: "sm", className: "w-full" })}
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                      {t("Message", "Message")}
                    </Link>
                    <p className="text-center text-[10px] leading-relaxed text-muted">
                      {session.can_join
                        ? t("Le lien s'ouvre dans un nouvel onglet.", "The link opens in a new tab.")
                        : t(
                            "Accès 15 min avant et 30 min après le début.",
                            "Access 15 min before and 30 min after the start.",
                          )}
                    </p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Modal
        open={Boolean(completeTarget)}
        onClose={() => setCompleteTarget(null)}
        title={t("Clôturer la séance ?", "Complete the session?")}
        description={
          completeTarget
            ? `${completeTarget.patient?.full_name} · ${formatDateTime(
                completeTarget.date_debut,
                lang,
              )}`
            : ""
        }
        footer={
          <>
            <Button variant="outline" onClick={() => setCompleteTarget(null)}>
              {t("Annuler", "Cancel")}
            </Button>
            <Button onClick={complete} loading={completing}>
              <CheckCircle2 className="h-4 w-4" />
              {t("Confirmer la clôture", "Confirm completion")}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Textarea
            label={t("Notes de séance (facultatif)", "Session notes (optional)")}
            name="notes"
            rows={4}
            value={completeNotes}
            onChange={(event) => setCompleteNotes(event.target.value)}
            placeholder={t(
              "Un résumé court visible par le patient dans son historique.",
              "A short summary visible to the patient in their history.",
            )}
          />
          <p className="rounded-2xl bg-sage-50 px-3.5 py-2.5 text-[10px] leading-relaxed text-teal-900/75">
            {t(
              "La séance sera marquée comme terminée et le patient pourra laisser un avis. Pensez à compléter le rapport clinique dans le dossier.",
              "The session will be marked as completed and the patient can leave a review. Remember to complete the clinical report in the record.",
            )}
          </p>
        </div>
      </Modal>

      <Modal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        title={t("Rapport de séance", "Session report")}
        description={
          reportTarget
            ? `${reportTarget.patient?.full_name} · ${formatDateTime(
                reportTarget.date_debut,
                lang,
              )}`
            : ""
        }
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setReportOpen(false)}>
              {t("Annuler", "Cancel")}
            </Button>
            <Button onClick={saveReport} loading={savingReport} disabled={reportLoading}>
              <FileText className="h-4 w-4" />
              {t("Enregistrer", "Save")}
            </Button>
          </>
        }
      >
        {reportLoading ? (
          <LoadingBlock label={t("Chargement…", "Loading…")} />
        ) : (
          <form onSubmit={saveReport} className="space-y-3">
            <Textarea
              label={t("Objectifs de la séance", "Session goals")}
              name="objectifs_seance"
              rows={2}
              value={reportForm.objectifs_seance}
              onChange={(event) =>
                setReportForm((current) => ({ ...current, objectifs_seance: event.target.value }))
              }
            />
            <Textarea
              label={t("Observations cliniques", "Clinical observations")}
              name="observations"
              rows={5}
              value={reportForm.observations}
              onChange={(event) =>
                setReportForm((current) => ({ ...current, observations: event.target.value }))
              }
              placeholder={t(
                "Une note clinique sera automatiquement ajoutée au dossier.",
                "A clinical note will automatically be added to the record.",
              )}
            />
            <Select
              label={t("Évolution perçue", "Perceived evolution")}
              name="evolution"
              value={reportForm.evolution}
              onChange={(event) =>
                setReportForm((current) => ({ ...current, evolution: event.target.value }))
              }
            >
              {EVOLUTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {t(item.fr, item.en)}
                </option>
              ))}
            </Select>
            <Textarea
              label={t("Exercices et pistes", "Exercises and next steps")}
              name="exercices"
              rows={3}
              value={reportForm.exercices}
              onChange={(event) =>
                setReportForm((current) => ({ ...current, exercices: event.target.value }))
              }
            />
          </form>
        )}
      </Modal>
    </div>
  );
}
