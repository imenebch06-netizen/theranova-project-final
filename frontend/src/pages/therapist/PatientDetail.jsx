import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ClipboardList,
  FileText,
  FolderHeart,
  HeartPulse,
  History,
  LockKeyhole,
  MessageCircle,
  NotebookPen,
  Pencil,
  Plus,
  Save,
  Target,
  Trash2,
  TrendingUp,
  Video,
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
import api, { extractError } from "../../lib/api";
import { useI18n } from "../../contexts/I18nContext";
import { useToast } from "../../contexts/ToastContext";
import Avatar from "../../components/ui/Avatar";
import { Badge, StatusBadge } from "../../components/ui/Badge";
import { Button, buttonClass } from "../../components/ui/Button";
import { Checkbox, Input, Select, Textarea } from "../../components/ui/Field";
import { EmptyState, ErrorState, LoadingBlock } from "../../components/ui/Feedback";
import Modal from "../../components/ui/Modal";
import Tabs from "../../components/ui/Tabs";
import ChartTooltip from "../../components/ChartTooltip";
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatShortDate,
  formatTime,
} from "../../lib/format";

const NOTE_TYPES = [
  { value: "seance", fr: "Compte-rendu de séance", en: "Session report" },
  { value: "suivi", fr: "Note de suivi", en: "Follow-up note" },
  { value: "urgence", fr: "Observation urgente", en: "Urgent observation" },
];

const EVOLUTIONS = [
  { value: "amelioration", fr: "Amélioration", en: "Improvement", tone: "success" },
  { value: "stable", fr: "Stable", en: "Stable", tone: "sage" },
  { value: "degradation", fr: "Dégradation", en: "Deterioration", tone: "danger" },
];

const EMPTY_OBJECTIVE = { titre: "", statut: "en_cours", echeance: "" };

export default function PatientDetail() {
  const { id } = useParams();
  const { t, lang } = useI18n();
  const { success, error: toastError } = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("overview");

  const [dossierOpen, setDossierOpen] = useState(false);
  const [dossierForm, setDossierForm] = useState({
    motif_consultation: "",
    plan_therapeutique: "",
    statut: "actif",
    objectifs: [],
  });
  const [savingDossier, setSavingDossier] = useState(false);
  const [creating, setCreating] = useState(false);
  const [archiving, setArchiving] = useState(false);

  const [noteOpen, setNoteOpen] = useState(false);
  const [noteForm, setNoteForm] = useState({
    type: "suivi",
    contenu: "",
    prive: true,
    seance: "",
  });
  const [savingNote, setSavingNote] = useState(false);
  const [noteTarget, setNoteTarget] = useState(null);
  const [deletingNote, setDeletingNote] = useState(false);

  const [reportOpen, setReportOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState(null);
  const [reportForm, setReportForm] = useState({
    objectifs_seance: "",
    observations: "",
    evolution: "stable",
    exercices: "",
  });
  const [savingReport, setSavingReport] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data: payload } = await api.get(`/clinical/patients/${id}/`);
      setData(payload);
    } catch (err) {
      setError(
        extractError(
          err,
          t("Impossible de charger ce dossier patient.", "Unable to load this patient record."),
        ),
      );
    } finally {
      setLoading(false);
    }
  }, [id, t]);

  useEffect(() => {
    load();
  }, [load]);

  const moodSeries = useMemo(() => {
    const entries = [...(data?.humeurs || [])].sort(
      (a, b) => new Date(a.date_saisie) - new Date(b.date_saisie),
    );
    return entries.map((entry) => ({
      date: formatShortDate(entry.date_saisie, lang),
      score: entry.score,
    }));
  }, [data, lang]);

  const notes = data?.notes || [];
  const sessions = data?.seances || [];
  const dossier = data?.dossier;
  const patient = data?.patient;

  function openDossierEditor() {
    setDossierForm({
      motif_consultation: dossier?.motif_consultation || "",
      plan_therapeutique: dossier?.plan_therapeutique || "",
      statut: dossier?.statut || "actif",
      objectifs: (dossier?.objectifs || []).map((objective) => ({
        titre: objective.titre || "",
        statut: objective.statut || "en_cours",
        echeance: objective.echeance || "",
      })),
    });
    setDossierOpen(true);
  }

  async function saveDossier(event) {
    event?.preventDefault();
    const objectifs = dossierForm.objectifs
      .filter((objective) => objective.titre.trim())
      .map((objective) => ({
        titre: objective.titre.trim(),
        statut: objective.statut,
        echeance: objective.echeance || null,
      }));
    setSavingDossier(true);
    try {
      const payload = {
        motif_consultation: dossierForm.motif_consultation.trim(),
        plan_therapeutique: dossierForm.plan_therapeutique.trim(),
        objectifs,
      };
      if (dossier) {
        await api.patch(`/clinical/dossiers/${dossier.id}/`, {
          ...payload,
          statut: dossierForm.statut,
        });
      } else {
        await api.post("/clinical/dossiers/", {
          patient_id: patient.user_id,
          ...payload,
        });
      }
      success(t("Dossier mis à jour.", "Record updated."), {
        title: t("Dossier clinique", "Clinical record"),
      });
      setDossierOpen(false);
      load();
    } catch (err) {
      toastError(extractError(err, t("Enregistrement impossible.", "Unable to save.")));
    } finally {
      setSavingDossier(false);
    }
  }

  async function createDossier() {
    if (!patient) return;
    setCreating(true);
    try {
      await api.post("/clinical/dossiers/", {
        patient_id: patient.user_id,
        motif_consultation: "",
      });
      success(t("Dossier clinique ouvert.", "Clinical record opened."));
      load();
    } catch (err) {
      toastError(extractError(err, t("Le dossier n'a pas pu être ouvert.", "The record could not be opened.")));
    } finally {
      setCreating(false);
    }
  }

  async function toggleArchive() {
    if (!dossier) return;
    setArchiving(true);
    try {
      if (dossier.statut === "actif") {
        await api.post(`/clinical/dossiers/${dossier.id}/archive/`);
        success(t("Dossier archivé.", "Record archived."));
      } else {
        await api.delete(`/clinical/dossiers/${dossier.id}/archive/`);
        success(t("Dossier réactivé.", "Record reactivated."));
      }
      load();
    } catch (err) {
      toastError(extractError(err));
    } finally {
      setArchiving(false);
    }
  }

  function openNote() {
    setNoteForm({ type: "suivi", contenu: "", prive: true, seance: "" });
    setNoteOpen(true);
  }

  async function saveNote(event) {
    event?.preventDefault();
    if (!dossier) return;
    if (!noteForm.contenu.trim()) {
      toastError(t("La note ne peut pas être vide.", "The note cannot be empty."));
      return;
    }
    setSavingNote(true);
    try {
      await api.post(`/clinical/dossiers/${dossier.id}/notes/`, {
        type: noteForm.type,
        contenu: noteForm.contenu.trim(),
        prive: noteForm.prive,
        seance: noteForm.seance ? Number(noteForm.seance) : null,
      });
      success(t("Note ajoutée au dossier.", "Note added to the record."));
      setNoteOpen(false);
      load();
    } catch (err) {
      toastError(extractError(err, t("La note n'a pas pu être enregistrée.", "The note could not be saved.")));
    } finally {
      setSavingNote(false);
    }
  }

  async function deleteNote() {
    if (!noteTarget) return;
    setDeletingNote(true);
    try {
      await api.delete(`/clinical/notes/${noteTarget.id}/`);
      success(t("Note supprimée.", "Note deleted."));
      setNoteTarget(null);
      load();
    } catch (err) {
      toastError(extractError(err));
    } finally {
      setDeletingNote(false);
    }
  }

  async function openReport(session) {
    setReportTarget(session);
    setReportForm({
      objectifs_seance: "",
      observations: "",
      evolution: "stable",
      exercices: "",
    });
    setReportOpen(true);
    setReportLoading(true);
    try {
      const { data: report } = await api.get(`/clinical/sessions/${session.id}/report/`);
      setReportForm({
        objectifs_seance: report.objectifs_seance || "",
        observations: report.observations || "",
        evolution: report.evolution || "stable",
        exercices: report.exercices || "",
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
      success(
        t("Rapport de séance enregistré.", "Session report saved."),
        { title: t("Suivi clinique", "Clinical follow-up") },
      );
      setReportOpen(false);
      load();
    } catch (err) {
      toastError(extractError(err, t("Le rapport n'a pas pu être enregistré.", "The report could not be saved.")));
    } finally {
      setSavingReport(false);
    }
  }

  if (loading) return <LoadingBlock label={t("Chargement du dossier patient…", "Loading the patient record…")} />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data || !patient) return null;

  const stats = data.statistiques || {};
  const tabs = [
    { value: "overview", label: t("Vue d'ensemble", "Overview"), icon: ClipboardList },
    { value: "notes", label: t("Notes cliniques", "Clinical notes"), count: notes.length, icon: NotebookPen },
    { value: "sessions", label: t("Séances", "Sessions"), count: sessions.length, icon: Video },
  ];

  return (
    <div className="space-y-5">
      <Link
        to="/pro/patients"
        className="inline-flex items-center gap-1.5 text-xs font-bold text-muted transition hover:text-teal-600"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("Retour à mes patients", "Back to my patients")}
      </Link>

      <section className="card overflow-hidden">
        <div className="bg-teal-500 px-5 py-6 text-cream sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <Avatar
                src={patient.avatar}
                name={patient.full_name}
                size="xl"
                className="ring-4 ring-white/15"
              />
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sage-300">
                  {t("Dossier patient", "Patient record")}
                </p>
                <h1 className="mt-1 text-2xl font-black tracking-tight text-cream">
                  {patient.full_name}
                </h1>
                <p className="mt-0.5 text-xs text-cream/65">{patient.email}</p>
                <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-bold">
                  {patient.age && (
                    <span className="rounded-full bg-white/10 px-2.5 py-1">
                      {patient.age} {t("ans", "yrs")}
                    </span>
                  )}
                  {patient.sexe && patient.sexe !== "N" && (
                    <span className="rounded-full bg-white/10 px-2.5 py-1">
                      {patient.sexe === "F" ? t("Femme", "Female") : t("Homme", "Male")}
                    </span>
                  )}
                  {patient.ville && (
                    <span className="rounded-full bg-white/10 px-2.5 py-1">{patient.ville}</span>
                  )}
                  {patient.is_student && (
                    <span className="rounded-full bg-white/10 px-2.5 py-1">
                      {t("Étudiant", "Student")}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                to="/pro/messages"
                className={buttonClass({ variant: "secondary", size: "sm" })}
              >
                <MessageCircle className="h-3.5 w-3.5" />
                {t("Message", "Message")}
              </Link>
              {dossier && (
                <Button
                  variant="dark"
                  size="sm"
                  loading={archiving}
                  onClick={toggleArchive}
                >
                  <FolderHeart className="h-3.5 w-3.5" />
                  {dossier.statut === "actif"
                    ? t("Archiver", "Archive")
                    : t("Réactiver", "Reactivate")}
                </Button>
              )}
            </div>
          </div>
        </div>
        {patient.occupation || patient.university || patient.emergency_contact ? (
          <div className="grid gap-3 px-5 py-4 text-[11px] text-muted sm:grid-cols-3 sm:px-6">
            {patient.occupation && (
              <p>
                <span className="font-black text-ink">{t("Profession", "Occupation")} :</span>{" "}
                {patient.occupation}
              </p>
            )}
            {patient.university && (
              <p>
                <span className="font-black text-ink">{t("Établissement", "Institution")} :</span>{" "}
                {patient.university}
              </p>
            )}
            {patient.emergency_contact && (
              <p>
                <span className="font-black text-ink">{t("Urgence", "Emergency")} :</span>{" "}
                {patient.emergency_contact}
              </p>
            )}
          </div>
        ) : null}
      </section>

      <Tabs tabs={tabs} value={tab} onChange={setTab} className="w-fit" />

      {tab === "overview" && (
        <div className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="card p-4">
                <p className="text-[10px] font-black uppercase tracking-wider text-muted">
                  {t("Séances terminées", "Completed sessions")}
                </p>
                <p className="mt-1 text-2xl font-black text-teal-600">
                  {stats.seances_terminees || 0}
                </p>
              </div>
              <div className="card p-4">
                <p className="text-[10px] font-black uppercase tracking-wider text-muted">
                  {t("À venir", "Upcoming")}
                </p>
                <p className="mt-1 text-2xl font-black text-teal-600">
                  {stats.seances_prevues || 0}
                </p>
              </div>
              <div className="card p-4">
                <p className="text-[10px] font-black uppercase tracking-wider text-muted">
                  {t("Humeur moyenne", "Average mood")}
                </p>
                <p className="mt-1 text-2xl font-black text-teal-600">
                  {stats.humeur_moyenne ?? "—"}
                  {stats.humeur_moyenne ? <span className="text-xs text-muted">/10</span> : null}
                </p>
              </div>
              <div className="card p-4">
                <p className="text-[10px] font-black uppercase tracking-wider text-muted">
                  {t("Objectifs atteints", "Goals reached")}
                </p>
                <p className="mt-1 text-2xl font-black text-teal-600">
                  {dossier?.objectifs_atteints || 0}
                  <span className="text-xs text-muted">/{dossier?.objectifs?.length || 0}</span>
                </p>
              </div>
            </div>

            {dossier ? (
              <section className="card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="inline-flex items-center gap-2 text-base font-black text-ink">
                      <FolderHeart className="h-4 w-4 text-teal-500" />
                      {t("Dossier clinique", "Clinical record")}
                    </h2>
                    <p className="mt-0.5 text-[11px] text-muted">
                      {t("Ouvert le", "Opened on")}{" "}
                      {formatDate(dossier.date_ouverture, lang, "d MMMM yyyy")} ·{" "}
                      {dossier.statut === "actif" ? t("Actif", "Active") : t("Archivé", "Archived")}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={openDossierEditor}>
                      <Pencil className="h-3.5 w-3.5" />
                      {t("Modifier", "Edit")}
                    </Button>
                    <Button size="sm" onClick={openNote}>
                      <Plus className="h-3.5 w-3.5" />
                      {t("Note", "Note")}
                    </Button>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl bg-sage-50 p-4">
                    <p className="text-[10px] font-black uppercase tracking-wider text-teal-500">
                      {t("Motif de consultation", "Reason for consultation")}
                    </p>
                    <p className="mt-1.5 text-xs leading-relaxed text-teal-900/80">
                      {dossier.motif_consultation || t("Non renseigné.", "Not provided.")}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-sand/50 p-4">
                    <p className="text-[10px] font-black uppercase tracking-wider text-teal-500">
                      {t("Plan thérapeutique", "Treatment plan")}
                    </p>
                    <p className="mt-1.5 whitespace-pre-line text-xs leading-relaxed text-teal-900/80">
                      {dossier.plan_therapeutique || t("À construire ensemble.", "To build together.")}
                    </p>
                  </div>
                </div>

                <div className="mt-5">
                  <div className="flex items-center justify-between">
                    <h3 className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-wider text-muted">
                      <Target className="h-3.5 w-3.5 text-teal-500" />
                      {t("Objectifs thérapeutiques", "Therapeutic goals")}
                    </h3>
                    <span className="text-[11px] font-black text-teal-600">
                      {dossier.progression || 0}%
                    </span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-sand">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-sage-400 to-teal-500"
                      style={{ width: `${Math.min(100, dossier.progression || 0)}%` }}
                    />
                  </div>
                  <div className="mt-3 space-y-2">
                    {(dossier.objectifs || []).length === 0 && (
                      <p className="rounded-2xl bg-sand/50 px-3 py-3 text-center text-[11px] text-muted">
                        {t("Aucun objectif défini pour le moment.", "No goal defined yet.")}
                      </p>
                    )}
                    {(dossier.objectifs || []).map((objective, index) => (
                      <div
                        key={`${objective.titre}-${index}`}
                        className="flex items-center gap-2.5 rounded-2xl border border-line bg-white px-3 py-2"
                      >
                        <span
                          className={
                            objective.statut === "atteint"
                              ? "flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success/15 text-success"
                              : "flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sand text-muted"
                          }
                        >
                          {objective.statut === "atteint" ? (
                            <Check className="h-3 w-3" />
                          ) : (
                            <span className="h-1.5 w-1.5 rounded-full bg-current" />
                          )}
                        </span>
                        <p className="min-w-0 flex-1 truncate text-xs font-semibold text-ink">
                          {objective.titre}
                        </p>
                        {objective.echeance && (
                          <span className="shrink-0 text-[10px] text-muted">
                            {formatDate(objective.echeance, lang, "d MMM yyyy")}
                          </span>
                        )}
                        <Badge tone={objective.statut === "atteint" ? "success" : "warn"}>
                          {objective.statut === "atteint"
                            ? t("Atteint", "Reached")
                            : t("En cours", "In progress")}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            ) : (
              <section className="card p-6">
                <div className="flex flex-col items-center text-center">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sage-100 text-teal-600">
                    <FolderHeart className="h-6 w-6" />
                  </span>
                  <h2 className="mt-3 text-base font-black text-ink">
                    {t("Ouvrir un dossier clinique", "Open a clinical record")}
                  </h2>
                  <p className="mt-1 max-w-md text-xs leading-relaxed text-muted">
                    {t(
                      "Centralisez le motif de consultation, le plan thérapeutique et les notes de suivi de ce patient.",
                      "Centralise the reason for consultation, treatment plan and follow-up notes for this patient.",
                    )}
                  </p>
                  <Button className="mt-4" loading={creating} onClick={createDossier}>
                    <Plus className="h-4 w-4" />
                    {t("Créer le dossier", "Create the record")}
                  </Button>
                </div>
              </section>
            )}

            <section className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="inline-flex items-center gap-2 text-base font-black text-ink">
                    <HeartPulse className="h-4 w-4 text-teal-500" />
                    {t("Évolution de l'humeur", "Mood evolution")}
                  </h2>
                  <p className="mt-0.5 text-xs text-muted">
                    {t("30 dernières entrées partagées.", "Last 30 shared entries.")}
                  </p>
                </div>
                {stats.humeur_moyenne != null && (
                  <Badge tone="sage">{stats.humeur_moyenne}/10</Badge>
                )}
              </div>
              <div className="mt-4 h-52">
                {moodSeries.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={moodSeries} margin={{ top: 5, right: 8, left: -24, bottom: 0 }}>
                      <defs>
                        <linearGradient id="patientMood" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#1A5255" stopOpacity={0.28} />
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
                        fill="url(#patientMood)"
                        name={t("Humeur", "Mood")}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full flex-col items-center justify-center rounded-2xl bg-sand/50 text-center">
                    <HeartPulse className="h-6 w-6 text-sage-400" />
                    <p className="mt-2 text-xs font-semibold text-muted">
                      {t("Aucune donnée d'humeur partagée.", "No shared mood data.")}
                    </p>
                  </div>
                )}
              </div>
            </section>
          </div>

          <aside className="space-y-5">
            <section className="card p-5">
              <div className="flex items-center justify-between">
                <h2 className="inline-flex items-center gap-2 text-sm font-black text-ink">
                  <History className="h-4 w-4 text-teal-500" />
                  {t("Dernières notes", "Latest notes")}
                </h2>
                <button
                  type="button"
                  onClick={() => setTab("notes")}
                  className="text-[10px] font-bold text-teal-600 hover:text-teal-800"
                >
                  {t("Tout voir", "View all")}
                </button>
              </div>
              <div className="mt-3 space-y-2">
                {notes.length === 0 && (
                  <p className="rounded-2xl bg-sand/50 px-3 py-5 text-center text-[11px] text-muted">
                    {t("Aucune note clinique.", "No clinical note.")}
                  </p>
                )}
                {notes.slice(0, 4).map((note) => (
                  <div key={note.id} className="rounded-2xl border border-line bg-white p-3">
                    <div className="flex items-center justify-between gap-2">
                      <Badge tone={note.type === "urgence" ? "danger" : note.type === "seance" ? "teal" : "sage"}>
                        {note.type_display}
                      </Badge>
                      <span className="text-[9px] text-muted">
                        {formatDate(note.date_creation, lang, "d MMM")}
                      </span>
                    </div>
                    <p className="mt-1.5 line-clamp-3 whitespace-pre-line text-[11px] leading-relaxed text-muted">
                      {note.contenu}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <section className="card p-5">
              <div className="flex items-center justify-between">
                <h2 className="inline-flex items-center gap-2 text-sm font-black text-ink">
                  <TrendingUp className="h-4 w-4 text-teal-500" />
                  {t("Parcours de soin", "Care journey")}
                </h2>
                <button
                  type="button"
                  onClick={() => setTab("sessions")}
                  className="text-[10px] font-bold text-teal-600 hover:text-teal-800"
                >
                  {t("Tout voir", "View all")}
                </button>
              </div>
              <div className="mt-3 space-y-2">
                {sessions.length === 0 && (
                  <p className="rounded-2xl bg-sand/50 px-3 py-5 text-center text-[11px] text-muted">
                    {t("Aucune séance enregistrée.", "No session recorded.")}
                  </p>
                )}
                {sessions.slice(0, 4).map((session) => (
                  <div key={session.id} className="flex items-center gap-2 border-b border-line/60 pb-2 last:border-0 last:pb-0">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sage-50 text-teal-600">
                      <Video className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-bold text-ink">
                        {formatDate(session.date_debut, lang, "d MMM yyyy")} ·{" "}
                        {formatTime(session.date_debut)}
                      </p>
                      <p className="text-[9px] text-muted">
                        {session.type_session} · {formatCurrency(session.prix_final, lang)}
                      </p>
                    </div>
                    <StatusBadge status={session.statut} className="!px-1.5 !py-0.5 !text-[9px]" />
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-3xl bg-sage-50 p-5">
              <LockKeyhole className="h-5 w-5 text-teal-500" />
              <h2 className="mt-2 text-sm font-black text-teal-900">
                {t("Confidentialité clinique", "Clinical confidentiality")}
              </h2>
              <p className="mt-1 text-[11px] leading-relaxed text-teal-900/70">
                {t(
                  "Les notes marquées privées ne sont visibles que par vous. Aucune donnée clinique n'est partagée avec des tiers.",
                  "Notes marked private are visible only to you. No clinical data is shared with third parties.",
                )}
              </p>
            </section>
          </aside>
        </div>
      )}

      {tab === "notes" && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-black text-ink">{t("Notes cliniques", "Clinical notes")}</h2>
              <p className="text-[11px] text-muted">
                {t(
                  "Chaque note est horodatée et rattachée à votre suivi.",
                  "Every note is time-stamped and attached to your follow-up.",
                )}
              </p>
            </div>
            <Button size="sm" onClick={openNote} disabled={!dossier}>
              <Plus className="h-4 w-4" />
              {t("Nouvelle note", "New note")}
            </Button>
          </div>

          {!dossier ? (
            <EmptyState
              icon={FolderHeart}
              title={t("Ouvrez d'abord un dossier", "Open a record first")}
              description={t(
                "Les notes cliniques sont rattachées à un dossier patient.",
                "Clinical notes are attached to a patient record.",
              )}
              action={
                <Button loading={creating} onClick={createDossier}>
                  {t("Ouvrir le dossier", "Open the record")}
                </Button>
              }
            />
          ) : notes.length === 0 ? (
            <EmptyState
              icon={NotebookPen}
              title={t("Aucune note", "No note")}
              description={t(
                "Documentez la séance, les observations et les exercices proposés.",
                "Document the session, observations and suggested exercises.",
              )}
              action={
                <Button onClick={openNote}>
                  <Plus className="h-4 w-4" />
                  {t("Écrire une note", "Write a note")}
                </Button>
              }
            />
          ) : (
            <div className="space-y-3">
              {notes.map((note) => (
                <article key={note.id} className="card p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <span
                        className={
                          note.type === "urgence"
                            ? "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-risk/10 text-risk"
                            : note.type === "seance"
                              ? "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-teal-500/10 text-teal-600"
                              : "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-sage-100 text-teal-700"
                        }
                      >
                        {note.type === "urgence" ? (
                          <AlertTriangle className="h-5 w-5" />
                        ) : (
                          <NotebookPen className="h-5 w-5" />
                        )}
                      </span>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-black text-ink">{note.type_display}</p>
                          {note.prive && (
                            <Badge tone="neutral">
                              <LockKeyhole className="mr-1 h-2.5 w-2.5" />
                              {t("Privé", "Private")}
                            </Badge>
                          )}
                        </div>
                        <p className="mt-0.5 text-[10px] text-muted">
                          {formatDateTime(note.date_creation, lang)}
                          {note.seance_date
                            ? ` · ${t("séance du", "session of")} ${formatDate(
                                note.seance_date,
                                lang,
                                "d MMM yyyy",
                              )}`
                            : ""}
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => setNoteTarget(note)}
                      aria-label={t("Supprimer la note", "Delete note")}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-ink/80">
                    {note.contenu}
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {tab === "sessions" && (
        <section className="space-y-4">
          <div>
            <h2 className="text-base font-black text-ink">{t("Historique des séances", "Session history")}</h2>
            <p className="text-[11px] text-muted">
              {t(
                "Clôturez une séance ou complétez son rapport structuré.",
                "Complete a session or fill in its structured report.",
              )}
            </p>
          </div>
          {sessions.length === 0 ? (
            <EmptyState
              icon={Video}
              title={t("Aucune séance", "No session")}
              description={t(
                "Les séances confirmées et terminées apparaîtront ici.",
                "Confirmed and completed sessions will appear here.",
              )}
              action={
                <Link to="/pro/seances" className={buttonClass({ variant: "outline" })}>
                  {t("Voir toutes mes séances", "View all my sessions")}
                </Link>
              }
            />
          ) : (
            <div className="space-y-2">
              {sessions.map((session) => (
                <article
                  key={session.id}
                  className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center"
                >
                  <span className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-2xl bg-sage-50 text-teal-700">
                    <span className="text-[9px] font-black uppercase">
                      {formatDate(session.date_debut, lang, "MMM")}
                    </span>
                    <span className="text-sm font-black">
                      {formatDate(session.date_debut, lang, "d")}
                    </span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs font-black text-ink">
                        {formatDate(session.date_debut, lang, "EEEE d MMMM yyyy")} ·{" "}
                        {formatTime(session.date_debut)}
                      </p>
                      <StatusBadge status={session.statut} />
                    </div>
                    <p className="mt-0.5 text-[10px] text-muted">
                      {session.type_session} · {formatCurrency(session.prix_final, lang)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {session.statut === "terminee" && (
                      <Button size="sm" variant="outline" onClick={() => openReport(session)}>
                        <FileText className="h-3.5 w-3.5" />
                        {t("Rapport", "Report")}
                      </Button>
                    )}
                    <Link
                      to="/pro/seances"
                      className={buttonClass({ variant: "ghost", size: "sm" })}
                    >
                      {t("Détails", "Details")}
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      <Modal
        open={dossierOpen}
        onClose={() => setDossierOpen(false)}
        title={dossier ? t("Modifier le dossier", "Edit the record") : t("Ouvrir un dossier", "Open a record")}
        description={patient.full_name}
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setDossierOpen(false)}>
              {t("Annuler", "Cancel")}
            </Button>
            <Button onClick={saveDossier} loading={savingDossier}>
              <Save className="h-4 w-4" />
              {t("Enregistrer", "Save")}
            </Button>
          </>
        }
      >
        <form onSubmit={saveDossier} className="space-y-4">
          <Input
            label={t("Motif de consultation", "Reason for consultation")}
            name="motif_consultation"
            value={dossierForm.motif_consultation}
            onChange={(event) =>
              setDossierForm((current) => ({ ...current, motif_consultation: event.target.value }))
            }
            placeholder={t("Ex. anxiété liée aux études", "E.g. study-related anxiety")}
          />
          <Textarea
            label={t("Plan thérapeutique", "Treatment plan")}
            name="plan_therapeutique"
            rows={4}
            value={dossierForm.plan_therapeutique}
            onChange={(event) =>
              setDossierForm((current) => ({ ...current, plan_therapeutique: event.target.value }))
            }
            placeholder={t(
              "Approche, fréquence envisagée, outils…",
              "Approach, planned frequency, tools…",
            )}
          />
          {dossier && (
            <Select
              label={t("Statut du dossier", "Record status")}
              name="statut"
              value={dossierForm.statut}
              onChange={(event) =>
                setDossierForm((current) => ({ ...current, statut: event.target.value }))
              }
            >
              <option value="actif">{t("Actif", "Active")}</option>
              <option value="archive">{t("Archivé", "Archived")}</option>
            </Select>
          )}

          <div>
            <div className="flex items-center justify-between">
              <p className="label mb-0">{t("Objectifs thérapeutiques", "Therapeutic goals")}</p>
              <button
                type="button"
                onClick={() =>
                  setDossierForm((current) => ({
                    ...current,
                    objectifs: [...current.objectifs, { ...EMPTY_OBJECTIVE }],
                  }))
                }
                className="text-[11px] font-bold text-teal-600 hover:text-teal-800"
              >
                + {t("Ajouter", "Add")}
              </button>
            </div>
            <div className="mt-2 space-y-2">
              {dossierForm.objectifs.length === 0 && (
                <p className="rounded-2xl bg-sand/50 px-3 py-3 text-center text-[11px] text-muted">
                  {t("Aucun objectif pour le moment.", "No goal yet.")}
                </p>
              )}
              {dossierForm.objectifs.map((objective, index) => (
                <div key={index} className="rounded-2xl border border-line bg-white p-3">
                  <div className="flex items-start gap-2">
                    <input
                      value={objective.titre}
                      onChange={(event) =>
                        setDossierForm((current) => ({
                          ...current,
                          objectifs: current.objectifs.map((item, position) =>
                            position === index ? { ...item, titre: event.target.value } : item,
                          ),
                        }))
                      }
                      placeholder={t("Ex. réduire les crises de panique", "E.g. reduce panic attacks")}
                      className="input py-2 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setDossierForm((current) => ({
                          ...current,
                          objectifs: current.objectifs.filter((_, position) => position !== index),
                        }))
                      }
                      className="icon-btn h-9 w-9 shrink-0 text-risk"
                      aria-label={t("Retirer", "Remove")}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <select
                      value={objective.statut}
                      onChange={(event) =>
                        setDossierForm((current) => ({
                          ...current,
                          objectifs: current.objectifs.map((item, position) =>
                            position === index ? { ...item, statut: event.target.value } : item,
                          ),
                        }))
                      }
                      className="select py-2 text-xs"
                    >
                      <option value="en_cours">{t("En cours", "In progress")}</option>
                      <option value="atteint">{t("Atteint", "Reached")}</option>
                    </select>
                    <input
                      type="date"
                      value={objective.echeance || ""}
                      onChange={(event) =>
                        setDossierForm((current) => ({
                          ...current,
                          objectifs: current.objectifs.map((item, position) =>
                            position === index ? { ...item, echeance: event.target.value } : item,
                          ),
                        }))
                      }
                      className="input py-2 text-xs"
                      aria-label={t("Échéance", "Deadline")}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </form>
      </Modal>

      <Modal
        open={noteOpen}
        onClose={() => setNoteOpen(false)}
        title={t("Nouvelle note clinique", "New clinical note")}
        description={patient.full_name}
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setNoteOpen(false)}>
              {t("Annuler", "Cancel")}
            </Button>
            <Button onClick={saveNote} loading={savingNote}>
              <NotebookPen className="h-4 w-4" />
              {t("Enregistrer la note", "Save note")}
            </Button>
          </>
        }
      >
        <form onSubmit={saveNote} className="space-y-3">
          <Select
            label={t("Type de note", "Note type")}
            name="type"
            value={noteForm.type}
            onChange={(event) =>
              setNoteForm((current) => ({ ...current, type: event.target.value }))
            }
          >
            {NOTE_TYPES.map((item) => (
              <option key={item.value} value={item.value}>
                {t(item.fr, item.en)}
              </option>
            ))}
          </Select>
          {sessions.length > 0 && (
            <Select
              label={t("Rattacher à une séance (facultatif)", "Attach to a session (optional)")}
              name="seance"
              value={noteForm.seance}
              onChange={(event) =>
                setNoteForm((current) => ({ ...current, seance: event.target.value }))
              }
            >
              <option value="">{t("Aucune séance", "No session")}</option>
              {sessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {formatDate(session.date_debut, lang, "d MMM yyyy · HH:mm")} —{" "}
                  {session.type_session}
                </option>
              ))}
            </Select>
          )}
          <Textarea
            label={t("Contenu de la note", "Note content")}
            name="contenu"
            required
            rows={6}
            value={noteForm.contenu}
            onChange={(event) =>
              setNoteForm((current) => ({ ...current, contenu: event.target.value }))
            }
            placeholder={t(
              "Observations, thèmes abordés, réactions, exercices proposés…",
              "Observations, themes discussed, reactions, suggested exercises…",
            )}
          />
          <Checkbox
            label={t("Note privée", "Private note")}
            description={t(
              "Visible uniquement par vous et vos collègues autorisés.",
              "Visible only to you and authorised colleagues.",
            )}
            checked={noteForm.prive}
            onChange={(event) =>
              setNoteForm((current) => ({ ...current, prive: event.target.checked }))
            }
          />
        </form>
      </Modal>

      <Modal
        open={Boolean(noteTarget)}
        onClose={() => setNoteTarget(null)}
        title={t("Supprimer cette note ?", "Delete this note?")}
        footer={
          <>
            <Button variant="outline" onClick={() => setNoteTarget(null)}>
              {t("Conserver", "Keep")}
            </Button>
            <Button variant="danger" onClick={deleteNote} loading={deletingNote}>
              <Trash2 className="h-4 w-4" />
              {t("Supprimer", "Delete")}
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-muted">
          {t(
            "Cette action est définitive. La note ne pourra pas être restaurée.",
            "This action is permanent. The note cannot be restored.",
          )}
        </p>
      </Modal>

      <Modal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        title={t("Rapport de séance", "Session report")}
        description={
          reportTarget
            ? `${formatDateTime(reportTarget.date_debut, lang)} · ${reportTarget.type_session}`
            : ""
        }
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setReportOpen(false)}>
              {t("Annuler", "Cancel")}
            </Button>
            <Button onClick={saveReport} loading={savingReport} disabled={reportLoading}>
              <Save className="h-4 w-4" />
              {t("Enregistrer le rapport", "Save report")}
            </Button>
          </>
        }
      >
        {reportLoading ? (
          <LoadingBlock label={t("Chargement du rapport…", "Loading report…")} />
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
                "Une note de séance sera automatiquement ajoutée au dossier.",
                "A session note will automatically be added to the record.",
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
              label={t("Exercices et pistes pour la suite", "Exercises and next steps")}
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
