import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bug,
  CheckCircle2,
  Clock3,
  LifeBuoy,
  MessageCircle,
  Search,
  Send,
  ShieldAlert,
} from "lucide-react";
import api, { extractError, getAll } from "../../lib/api";
import { useI18n } from "../../contexts/I18nContext";
import { useToast } from "../../contexts/ToastContext";
import { Badge, StatusBadge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { EmptyState, ErrorState, LoadingBlock } from "../../components/ui/Feedback";
import { Input, Select, Textarea } from "../../components/ui/Field";
import Modal from "../../components/ui/Modal";
import Tabs from "../../components/ui/Tabs";
import { formatDate, formatDateTime } from "../../lib/format";

const PRIORITIES = [
  { value: "basse", fr: "Basse", en: "Low" },
  { value: "normale", fr: "Normale", en: "Normal" },
  { value: "haute", fr: "Haute", en: "High" },
];

const COMPLAINT_STATUSES = [
  { value: "en_cours", fr: "En cours de traitement", en: "In progress" },
  { value: "resolue", fr: "Résolue", en: "Resolved" },
  { value: "rejetee", fr: "Rejetée", en: "Rejected" },
];

const REPORT_STATUSES = [
  { value: "en_cours", fr: "En cours de traitement", en: "In progress" },
  { value: "resolu", fr: "Résolu", en: "Resolved" },
];

const REPORT_TYPES = [
  { value: "bug", fr: "Bug technique", en: "Technical bug" },
  { value: "suggestion", fr: "Suggestion", en: "Suggestion" },
  { value: "clinique", fr: "Incident clinique", en: "Clinical incident" },
  { value: "paiement", fr: "Problème de paiement", en: "Payment issue" },
];

function typeLabel(value, t) {
  const found = REPORT_TYPES.find((item) => item.value === value);
  return found ? t(found.fr, found.en) : value;
}

export default function Complaints() {
  const { t, lang } = useI18n();
  const { success, error: toastError } = useToast();
  const [complaints, setComplaints] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("complaints");
  const [complaintStatus, setComplaintStatus] = useState("all");
  const [reportStatus, setReportStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [target, setTarget] = useState(null);
  const [kind, setKind] = useState("complaint");
  const [form, setForm] = useState({ reponse: "", statut: "en_cours", priorite: "normale" });
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [complaintList, reportList] = await Promise.all([
        getAll("/feedback/complaints/"),
        getAll("/feedback/reports/"),
      ]);
      setComplaints(complaintList || []);
      setReports(reportList || []);
    } catch (err) {
      setError(
        extractError(
          err,
          t("Impossible de charger les réclamations.", "Unable to load complaints."),
        ),
      );
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(() => {
    const openComplaints = complaints.filter(
      (item) => !["resolue", "rejetee"].includes(item.statut),
    );
    return {
      openComplaints: openComplaints.length,
      urgentComplaints: openComplaints.filter((item) => item.priorite === "haute").length,
      openReports: reports.filter((item) => item.statut !== "resolu").length,
      resolved: complaints.filter((item) => item.statut === "resolue").length,
    };
  }, [complaints, reports]);

  const complaintCounts = useMemo(() => {
    const base = { all: complaints.length };
    ["en_attente", "en_cours", "resolue", "rejetee"].forEach((status) => {
      base[status] = complaints.filter((item) => item.statut === status).length;
    });
    return base;
  }, [complaints]);

  const reportCounts = useMemo(() => {
    const base = { all: reports.length };
    ["nouveau", "en_cours", "resolu"].forEach((status) => {
      base[status] = reports.filter((item) => item.statut === status).length;
    });
    return base;
  }, [reports]);

  const filteredComplaints = useMemo(() => {
    const query = search.trim().toLowerCase();
    return complaints.filter((item) => {
      if (complaintStatus !== "all" && item.statut !== complaintStatus) return false;
      if (!query) return true;
      return [item.categorie, item.message, item.patient_nom, item.patient_email, item.therapeute_nom]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [complaints, complaintStatus, search]);

  const filteredReports = useMemo(() => {
    const query = search.trim().toLowerCase();
    return reports.filter((item) => {
      if (reportStatus !== "all" && item.statut !== reportStatus) return false;
      if (!query) return true;
      return [item.sujet, item.message, item.auteur_nom, item.type_display]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [reports, reportStatus, search]);

  function openResponse(item, responseKind) {
    setKind(responseKind);
    setTarget(item);
    setForm({
      reponse: item.reponse || "",
      statut:
        responseKind === "complaint"
          ? item.statut === "en_attente"
            ? "en_cours"
            : item.statut
          : item.statut === "nouveau"
            ? "en_cours"
            : item.statut,
      priorite: item.priorite || "normale",
    });
  }

  async function submitResponse() {
    if (!target) return;
    if (!form.reponse.trim()) {
      toastError(t("La réponse est obligatoire.", "A reply is required."));
      return;
    }
    setSending(true);
    try {
      if (kind === "complaint") {
        await api.post(`/feedback/complaints/${target.id}/respond/`, {
          reponse: form.reponse.trim(),
          statut: form.statut,
          priorite: form.priorite,
        });
      } else {
        await api.post(`/feedback/reports/${target.id}/respond/`, {
          reponse: form.reponse.trim(),
          statut: form.statut,
        });
      }
      success(
        t(
          "La réponse a été envoyée et la personne a été notifiée.",
          "The reply has been sent and the person has been notified.",
        ),
        { title: t("Réponse enregistrée", "Reply saved") },
      );
      setTarget(null);
      await load();
    } catch (err) {
      toastError(extractError(err, t("L'envoi a échoué.", "Sending failed.")));
    } finally {
      setSending(false);
    }
  }

  if (loading) return <LoadingBlock label={t("Chargement des réclamations…", "Loading complaints…")} />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const tabs = [
    {
      value: "complaints",
      label: t("Réclamations", "Complaints"),
      count: complaints.length,
      icon: LifeBuoy,
    },
    {
      value: "reports",
      label: t("Signalements", "Reports"),
      count: reports.length,
      icon: Bug,
    },
  ];

  const complaintTabs = [
    { value: "all", label: t("Toutes", "All"), count: complaintCounts.all },
    { value: "en_attente", label: t("En attente", "Pending"), count: complaintCounts.en_attente },
    { value: "en_cours", label: t("En cours", "In progress"), count: complaintCounts.en_cours },
    { value: "resolue", label: t("Résolues", "Resolved"), count: complaintCounts.resolue },
    { value: "rejetee", label: t("Rejetées", "Rejected"), count: complaintCounts.rejetee },
  ];

  const reportTabs = [
    { value: "all", label: t("Tous", "All"), count: reportCounts.all },
    { value: "nouveau", label: t("Nouveaux", "New"), count: reportCounts.nouveau },
    { value: "en_cours", label: t("En cours", "In progress"), count: reportCounts.en_cours },
    { value: "resolu", label: t("Résolus", "Resolved"), count: reportCounts.resolu },
  ];

  return (
    <div className="space-y-5">
      <div>
        <p className="overline">{t("Qualité & confiance", "Quality & trust")}</p>
        <h1 className="mt-1 text-2xl font-black tracking-tight text-ink sm:text-3xl">
          {t("Réclamations et signalements", "Complaints and reports")}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {t(
            "Écoutez les patients, répondez avec transparence et suivez les incidents de la plateforme.",
            "Listen to patients, reply transparently and track platform incidents.",
          )}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="card flex items-center gap-3 p-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-warn/10 text-warn">
            <Clock3 className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-muted">
              {t("Réclamations ouvertes", "Open complaints")}
            </p>
            <p className="text-lg font-black text-ink">{stats.openComplaints}</p>
          </div>
        </div>
        <div className="card flex items-center gap-3 p-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-risk/10 text-risk">
            <AlertTriangle className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-muted">
              {t("Urgences", "Urgent")}
            </p>
            <p className="text-lg font-black text-ink">{stats.urgentComplaints}</p>
          </div>
        </div>
        <div className="card flex items-center gap-3 p-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-teal-500/10 text-teal-600">
            <Bug className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-muted">
              {t("Signalements ouverts", "Open reports")}
            </p>
            <p className="text-lg font-black text-ink">{stats.openReports}</p>
          </div>
        </div>
        <div className="card flex items-center gap-3 p-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-success/10 text-success">
            <CheckCircle2 className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-muted">
              {t("Réclamations résolues", "Resolved complaints")}
            </p>
            <p className="text-lg font-black text-ink">{stats.resolved}</p>
          </div>
        </div>
      </div>

      {stats.urgentComplaints > 0 && (
        <div className="flex items-start gap-3 rounded-3xl border-2 border-risk/25 bg-risk/5 p-4">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-risk" />
          <div>
            <p className="text-sm font-black text-ink">
              {t(
                `${stats.urgentComplaints} réclamation(s) de priorité haute`,
                `${stats.urgentComplaints} high-priority complaint(s)`,
              )}
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted">
              {t(
                "Traitez ces dossiers en priorité et documentez clairement votre réponse.",
                "Handle these cases first and clearly document your reply.",
              )}
            </p>
          </div>
        </div>
      )}

      <Tabs tabs={tabs} value={tab} onChange={setTab} className="w-fit" />

      <Input
        label={t("Rechercher", "Search")}
        name="search"
        icon={Search}
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder={
          tab === "complaints"
            ? t("Patient, catégorie, message…", "Patient, category, message…")
            : t("Auteur, sujet, description…", "Author, subject, description…")
        }
      />

      {tab === "complaints" && (
        <>
          <Tabs tabs={complaintTabs} value={complaintStatus} onChange={setComplaintStatus} className="w-fit" />
          {filteredComplaints.length === 0 ? (
            <EmptyState
              icon={LifeBuoy}
              title={t("Aucune réclamation", "No complaint")}
              description={t(
                "Aucune réclamation ne correspond à cette vue.",
                "No complaint matches this view.",
              )}
            />
          ) : (
            <div className="space-y-3">
              {filteredComplaints.map((complaint) => (
                <article key={complaint.id} className="card p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-sm font-black text-ink">{complaint.categorie}</h2>
                        <StatusBadge status={complaint.statut} />
                        <StatusBadge status={complaint.priorite} />
                      </div>
                      <p className="mt-1 text-[11px] text-muted">
                        {complaint.patient_nom} · {complaint.patient_email}
                        {complaint.therapeute_nom ? ` · ${complaint.therapeute_nom}` : ""}
                      </p>
                      <p className="text-[10px] text-muted">
                        {formatDateTime(complaint.date_creation, lang)}
                      </p>
                    </div>
                    <Button size="sm" onClick={() => openResponse(complaint, "complaint")}>
                      <Send className="h-3.5 w-3.5" />
                      {complaint.reponse ? t("Modifier la réponse", "Edit reply") : t("Répondre", "Reply")}
                    </Button>
                  </div>

                  <p className="mt-3 rounded-2xl bg-sand/50 px-3.5 py-2.5 text-xs leading-relaxed text-ink/80">
                    {complaint.message}
                  </p>

                  {complaint.reponse ? (
                    <div className="mt-3 rounded-2xl bg-sage-50 p-3.5">
                      <p className="text-[10px] font-black uppercase tracking-wider text-teal-500">
                        {t("Réponse envoyée", "Reply sent")}
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-teal-900/80">
                        {complaint.reponse}
                      </p>
                      <p className="mt-1.5 text-[10px] font-semibold text-muted">
                        {complaint.traite_par_nom ? `— ${complaint.traite_par_nom}` : ""}
                        {complaint.date_resolution
                          ? ` · ${formatDate(complaint.date_resolution, lang, "d MMM yyyy")}`
                          : ""}
                      </p>
                    </div>
                  ) : (
                    <p className="mt-3 inline-flex items-center gap-1.5 text-[10px] font-semibold text-warn">
                      <Clock3 className="h-3.5 w-3.5" />
                      {t("En attente de réponse.", "Awaiting reply.")}
                    </p>
                  )}
                </article>
              ))}
            </div>
          )}
        </>
      )}

      {tab === "reports" && (
        <>
          <Tabs tabs={reportTabs} value={reportStatus} onChange={setReportStatus} className="w-fit" />
          {filteredReports.length === 0 ? (
            <EmptyState
              icon={Bug}
              title={t("Aucun signalement", "No report")}
              description={t(
                "Aucun signalement ne correspond à cette vue.",
                "No report matches this view.",
              )}
            />
          ) : (
            <div className="space-y-3">
              {filteredReports.map((report) => (
                <article key={report.id} className="card p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-sm font-black text-ink">{report.sujet}</h2>
                        <StatusBadge status={report.statut} />
                        <StatusBadge status={report.priorite} />
                        <Badge tone="sage">{typeLabel(report.type, t)}</Badge>
                      </div>
                      <p className="mt-1 text-[11px] text-muted">
                        {report.auteur_nom} · {formatDateTime(report.date_creation, lang)}
                      </p>
                    </div>
                    <Button size="sm" onClick={() => openResponse(report, "report")}>
                      <Send className="h-3.5 w-3.5" />
                      {report.reponse ? t("Modifier la réponse", "Edit reply") : t("Traiter", "Handle")}
                    </Button>
                  </div>

                  <p className="mt-3 rounded-2xl bg-sand/50 px-3.5 py-2.5 text-xs leading-relaxed text-ink/80">
                    {report.message}
                  </p>

                  {report.reponse ? (
                    <div className="mt-3 flex items-start gap-2 rounded-2xl bg-sage-50 p-3">
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
                      <p className="text-[11px] leading-relaxed text-teal-900/80">{report.reponse}</p>
                    </div>
                  ) : (
                    <p className="mt-3 inline-flex items-center gap-1.5 text-[10px] font-semibold text-warn">
                      <Clock3 className="h-3.5 w-3.5" />
                      {t("Aucune réponse pour le moment.", "No reply yet.")}
                    </p>
                  )}
                </article>
              ))}
            </div>
          )}
        </>
      )}

      <Modal
        open={Boolean(target)}
        onClose={() => setTarget(null)}
        title={
          kind === "complaint"
            ? t("Répondre à la réclamation", "Reply to the complaint")
            : t("Traiter le signalement", "Handle the report")
        }
        description={
          target
            ? kind === "complaint"
              ? `${target.patient_nom} · ${target.categorie}`
              : `${target.auteur_nom} · ${target.sujet}`
            : ""
        }
        footer={
          <>
            <Button variant="outline" onClick={() => setTarget(null)}>
              {t("Annuler", "Cancel")}
            </Button>
            <Button onClick={submitResponse} loading={sending}>
              <Send className="h-4 w-4" />
              {t("Envoyer la réponse", "Send reply")}
            </Button>
          </>
        }
      >
        {target && (
          <div className="space-y-3">
            <div className="rounded-2xl bg-sand/50 px-3.5 py-2.5 text-[11px] leading-relaxed text-muted">
              {kind === "complaint" ? target.message : target.message}
            </div>
            <Textarea
              label={t("Votre réponse", "Your reply")}
              name="reponse"
              rows={5}
              required
              value={form.reponse}
              onChange={(event) => setForm((current) => ({ ...current, reponse: event.target.value }))}
              placeholder={t(
                "Expliquez les mesures prises, le suivi proposé et restez bienveillant.",
                "Explain the measures taken, the follow-up offered and stay considerate.",
              )}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <Select
                label={t("Statut", "Status")}
                name="statut"
                value={form.statut}
                onChange={(event) => setForm((current) => ({ ...current, statut: event.target.value }))}
              >
                {(kind === "complaint" ? COMPLAINT_STATUSES : REPORT_STATUSES).map((item) => (
                  <option key={item.value} value={item.value}>
                    {t(item.fr, item.en)}
                  </option>
                ))}
              </Select>
              {kind === "complaint" && (
                <Select
                  label={t("Priorité", "Priority")}
                  name="priorite"
                  value={form.priorite}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, priorite: event.target.value }))
                  }
                >
                  {PRIORITIES.map((item) => (
                    <option key={item.value} value={item.value}>
                      {t(item.fr, item.en)}
                    </option>
                  ))}
                </Select>
              )}
            </div>
            <p className="inline-flex items-center gap-1.5 rounded-2xl bg-sage-50 px-3 py-2 text-[10px] text-teal-900/70">
              <MessageCircle className="h-3.5 w-3.5" />
              {t(
                "Une notification sera envoyée à la personne concernée.",
                "A notification will be sent to the person concerned.",
              )}
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}
