import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Bug,
  CheckCircle2,
  MessageCircle,
  Send,
  ShieldAlert,
  Star,
  LifeBuoy,
} from "lucide-react";
import api, { extractError, getAll } from "../../lib/api";
import { useI18n } from "../../contexts/I18nContext";
import { useToast } from "../../contexts/ToastContext";
import Avatar from "../../components/ui/Avatar";
import { Badge, StatusBadge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { EmptyState, ErrorState, LoadingBlock } from "../../components/ui/Feedback";
import Modal from "../../components/ui/Modal";
import Tabs from "../../components/ui/Tabs";
import { Input, Select, Textarea } from "../../components/ui/Field";
import { StarRating } from "../../components/ui/Stars";
import { formatDate, formatDateTime } from "../../lib/format";

const COMPLAINT_CATEGORIES = [
  { value: "Problème de paiement", fr: "Problème de paiement", en: "Payment issue" },
  { value: "Retard ou absence", fr: "Retard ou absence", en: "Delay or no-show" },
  { value: "Qualité de la séance", fr: "Qualité de la séance", en: "Session quality" },
  { value: "Difficulté technique", fr: "Difficulté technique", en: "Technical issue" },
  { value: "Confidentialité", fr: "Confidentialité", en: "Confidentiality" },
  { value: "Autre", fr: "Autre", en: "Other" },
];

const REPORT_TYPES = [
  { value: "bug", fr: "Bug technique", en: "Technical bug" },
  { value: "suggestion", fr: "Suggestion", en: "Suggestion" },
  { value: "clinique", fr: "Incident clinique", en: "Clinical incident" },
  { value: "paiement", fr: "Problème de paiement", en: "Payment issue" },
];

const PRIORITIES = [
  { value: "basse", fr: "Basse", en: "Low" },
  { value: "normale", fr: "Normale", en: "Normal" },
  { value: "haute", fr: "Haute", en: "High" },
];

const REPORT_PRIORITIES = [
  { value: "niveau_1", fr: "Niveau 1 · standard", en: "Level 1 · standard" },
  { value: "niveau_2", fr: "Niveau 2 · important", en: "Level 2 · important" },
  { value: "niveau_3", fr: "Niveau 3 · critique", en: "Level 3 · critical" },
];

export default function PatientFeedback() {
  const { t, lang } = useI18n();
  const { success, error: toastError } = useToast();
  const [params] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("reviews");
  const [reviews, setReviews] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [reports, setReports] = useState([]);
  const [sessions, setSessions] = useState([]);

  const [reviewTarget, setReviewTarget] = useState(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);

  const [complaintForm, setComplaintForm] = useState({
    categorie: COMPLAINT_CATEGORIES[0].value,
    message: "",
    priorite: "normale",
    therapeute: "",
  });
  const [submittingComplaint, setSubmittingComplaint] = useState(false);

  const [reportForm, setReportForm] = useState({
    type: "bug",
    sujet: "",
    message: "",
    priorite: "niveau_1",
  });
  const [submittingReport, setSubmittingReport] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [reviewList, complaintList, reportList, sessionList] = await Promise.all([
        getAll("/feedback/reviews/me/"),
        getAll("/feedback/complaints/"),
        getAll("/feedback/reports/"),
        getAll("/scheduling/sessions/", { statut: "terminee" }),
      ]);
      setReviews(reviewList || []);
      setComplaints(complaintList || []);
      setReports(reportList || []);
      setSessions(sessionList || []);
    } catch (err) {
      setError(
        extractError(
          err,
          t("Impossible de charger vos retours.", "Unable to load your feedback."),
        ),
      );
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const therapists = useMemo(() => {
    const map = new Map();
    sessions.forEach((session) => {
      const key = session.therapeute?.id;
      if (!key || map.has(key)) return;
      map.set(key, {
        profileId: key,
        nom: session.therapeute.nom_complet,
        avatar: session.therapeute.avatar,
        sessions: [],
      });
      map.get(key).sessions.push(session);
    });
    return [...map.values()];
  }, [sessions]);

  const reviewByTherapist = useMemo(() => {
    const map = new Map();
    reviews.forEach((review) => {
      if (review.therapeute_nom) map.set(review.therapeute_nom, review);
    });
    return map;
  }, [reviews]);

  const openReview = useCallback(
    async (target) => {
      const existing = reviews.find(
        (review) => review.therapeute === target.userId || review.therapeute_nom === target.nom,
      );
      setRating(existing?.note || 0);
      setComment(existing?.commentaire || "");
      setReviewTarget({ ...target, existing });
      setReviewLoading(true);
      try {
        if (!target.userId) {
          const { data } = await api.get(`/accounts/therapists/${target.profileId}/`);
          setReviewTarget((current) =>
            current && current.profileId === target.profileId
              ? { ...current, userId: data.user?.id }
              : current,
          );
        }
      } catch {
        /* the submit flow will surface the error */
      } finally {
        setReviewLoading(false);
      }
    },
    [reviews],
  );

  useEffect(() => {
    const sessionId = params.get("seance");
    if (!sessionId || !sessions.length) return;
    const session = sessions.find((item) => String(item.id) === String(sessionId));
    if (!session?.therapeute) return;
    setTab("reviews");
    openReview({
      profileId: session.therapeute.id,
      nom: session.therapeute.nom_complet,
      avatar: session.therapeute.avatar,
      sessionId: session.id,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions, params]);

  async function submitReview() {
    if (!reviewTarget) return;
    if (!rating) {
      toastError(t("Choisissez une note.", "Please choose a rating."));
      return;
    }
    setSubmittingReview(true);
    try {
      let userId = reviewTarget.userId;
      if (!userId) {
        const { data } = await api.get(`/accounts/therapists/${reviewTarget.profileId}/`);
        userId = data.user?.id;
      }
      await api.post("/feedback/reviews/create/", {
        therapeute_id: userId,
        note: rating,
        commentaire: comment.trim(),
        seance_id: reviewTarget.sessionId || null,
      });
      success(
        t("Merci, votre avis a bien été enregistré.", "Thank you, your review has been saved."),
        { title: t("Avis publié", "Review published") },
      );
      setReviewTarget(null);
      const updated = await getAll("/feedback/reviews/me/");
      setReviews(updated || []);
    } catch (err) {
      toastError(extractError(err, t("L'avis n'a pas pu être envoyé.", "The review could not be sent.")));
    } finally {
      setSubmittingReview(false);
    }
  }

  async function submitComplaint(event) {
    event.preventDefault();
    if (!complaintForm.message.trim()) {
      toastError(t("Décrivez votre réclamation.", "Please describe your complaint."));
      return;
    }
    setSubmittingComplaint(true);
    try {
      const payload = {
        categorie: complaintForm.categorie,
        message: complaintForm.message.trim(),
        priorite: complaintForm.priorite,
      };
      if (complaintForm.therapeute) payload.therapeute = Number(complaintForm.therapeute);
      await api.post("/feedback/complaints/", payload);
      success(
        t(
          "Votre réclamation a été transmise à l'équipe TheraNova.",
          "Your complaint has been sent to the TheraNova team.",
        ),
        { title: t("Réclamation envoyée", "Complaint sent") },
      );
      setComplaintForm({
        categorie: COMPLAINT_CATEGORIES[0].value,
        message: "",
        priorite: "normale",
        therapeute: "",
      });
      const updated = await getAll("/feedback/complaints/");
      setComplaints(updated || []);
    } catch (err) {
      toastError(extractError(err, t("L'envoi a échoué.", "Sending failed.")));
    } finally {
      setSubmittingComplaint(false);
    }
  }

  async function submitReport(event) {
    event.preventDefault();
    if (!reportForm.sujet.trim() || !reportForm.message.trim()) {
      toastError(t("Renseignez un sujet et un message.", "Please provide a subject and a message."));
      return;
    }
    setSubmittingReport(true);
    try {
      await api.post("/feedback/reports/", {
        type: reportForm.type,
        sujet: reportForm.sujet.trim(),
        message: reportForm.message.trim(),
        priorite: reportForm.priorite,
      });
      success(
        t("Votre signalement a été enregistré.", "Your report has been saved."),
        { title: t("Signalement envoyé", "Report sent") },
      );
      setReportForm({ type: "bug", sujet: "", message: "", priorite: "niveau_1" });
      const updated = await getAll("/feedback/reports/");
      setReports(updated || []);
    } catch (err) {
      toastError(extractError(err, t("L'envoi a échoué.", "Sending failed.")));
    } finally {
      setSubmittingReport(false);
    }
  }

  if (loading) return <LoadingBlock label={t("Chargement de vos retours…", "Loading your feedback…")} />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const tabs = [
    { value: "reviews", label: t("Mes avis", "My reviews"), count: reviews.length, icon: Star },
    { value: "complaints", label: t("Réclamations", "Complaints"), count: complaints.length, icon: LifeBuoy },
    { value: "reports", label: t("Signalements", "Reports"), count: reports.length, icon: Bug },
  ];

  const pendingReviews = therapists.filter(
    (therapist) => !reviewByTherapist.has(therapist.nom),
  );
  const activeComplaints = complaints.filter(
    (complaint) => !["resolue", "rejetee"].includes(complaint.statut),
  );

  return (
    <div className="space-y-5">
      <div>
        <p className="overline">{t("Avis & support", "Reviews & support")}</p>
        <h1 className="mt-1 text-2xl font-black tracking-tight text-ink sm:text-3xl">
          {t("Votre voix compte", "Your voice matters")}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {t(
            "Partagez votre expérience, signalez un problème et suivez nos réponses.",
            "Share your experience, report an issue and follow our replies.",
          )}
        </p>
      </div>

      <Tabs tabs={tabs} value={tab} onChange={setTab} className="w-fit" />

      {tab === "reviews" && (
        <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
          <section className="space-y-3">
            {reviews.length === 0 ? (
              <EmptyState
                icon={Star}
                title={t("Aucun avis pour le moment", "No review yet")}
                description={t(
                  "Après une séance terminée, vous pourrez évaluer votre praticien en toute transparence.",
                  "After a completed session, you can rate your practitioner transparently.",
                )}
              />
            ) : (
              reviews.map((review) => (
                <article key={review.id} className="card p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gold/25 text-teal-700">
                        <Star className="h-5 w-5 fill-gold text-gold" />
                      </div>
                      <div>
                        <p className="text-sm font-black text-ink">{review.therapeute_nom}</p>
                        <p className="text-[10px] text-muted">
                          {formatDate(review.date_creation, lang, "d MMMM yyyy")}
                        </p>
                      </div>
                    </div>
                    <StarRating
                      value={review.note}
                      onChange={() => {}}
                      size="sm"
                      className="pointer-events-none"
                    />
                  </div>
                  {review.commentaire && (
                    <p className="mt-3 text-sm leading-relaxed text-ink/80">{review.commentaire}</p>
                  )}
                  <div className="mt-3 flex items-center gap-2">
                    <Badge tone={review.visible ? "success" : "neutral"}>
                      {review.visible ? t("Publié", "Published") : t("En modération", "In moderation")}
                    </Badge>
                  </div>
                </article>
              ))
            )}
          </section>

          <aside className="space-y-3">
            <section className="card p-5">
              <h2 className="text-sm font-black text-ink">
                {t("Laisser un avis", "Leave a review")}
              </h2>
              <p className="mt-1 text-[11px] leading-relaxed text-muted">
                {t(
                  "Seuls les praticiens avec qui vous avez terminé une séance sont éligibles.",
                  "Only practitioners you have completed a session with are eligible.",
                )}
              </p>
              <div className="mt-3 space-y-2">
                {pendingReviews.length === 0 && (
                  <p className="rounded-2xl bg-sand/50 px-3 py-4 text-center text-[11px] text-muted">
                    {t("Aucun avis en attente.", "No pending review.")}
                  </p>
                )}
                {pendingReviews.map((therapist) => (
                  <button
                    key={therapist.profileId}
                    type="button"
                    onClick={() =>
                      openReview({
                        profileId: therapist.profileId,
                        nom: therapist.nom,
                        avatar: therapist.avatar,
                        sessionId: therapist.sessions[0]?.id,
                      })
                    }
                    className="flex w-full items-center gap-3 rounded-2xl border border-line bg-white p-3 text-left transition hover:border-teal-400"
                  >
                    <Avatar src={therapist.avatar} name={therapist.nom} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold text-ink">{therapist.nom}</p>
                      <p className="text-[10px] text-muted">
                        {therapist.sessions.length} {t("séance(s)", "session(s)")}
                      </p>
                    </div>
                    <Star className="h-4 w-4 text-gold" />
                  </button>
                ))}
              </div>
            </section>

            {therapists.length > 0 && (
              <section className="card p-5">
                <h2 className="text-sm font-black text-ink">
                  {t("Modifier un avis", "Edit a review")}
                </h2>
                <div className="mt-3 space-y-2">
                  {therapists.map((therapist) => {
                    const existing = reviews.find(
                      (review) => review.therapeute_nom === therapist.nom,
                    );
                    if (!existing) return null;
                    return (
                      <button
                        key={therapist.profileId}
                        type="button"
                        onClick={() =>
                          openReview({
                            profileId: therapist.profileId,
                            nom: therapist.nom,
                            avatar: therapist.avatar,
                            sessionId: therapist.sessions[0]?.id,
                          })
                        }
                        className="flex w-full items-center justify-between rounded-2xl bg-sand/50 px-3 py-2 text-left transition hover:bg-sand"
                      >
                        <span className="truncate text-[11px] font-bold text-teal-800">
                          {therapist.nom}
                        </span>
                        <span className="text-[10px] font-black text-teal-600">
                          {existing.note}/5
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}
          </aside>
        </div>
      )}

      {tab === "complaints" && (
        <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <section className="card p-5">
            <h2 className="inline-flex items-center gap-2 text-base font-black text-ink">
              <LifeBuoy className="h-4 w-4 text-teal-500" />
              {t("Nouvelle réclamation", "New complaint")}
            </h2>
            <form onSubmit={submitComplaint} className="mt-4 space-y-3">
              <Select
                label={t("Catégorie", "Category")}
                name="categorie"
                value={complaintForm.categorie}
                onChange={(event) =>
                  setComplaintForm((current) => ({ ...current, categorie: event.target.value }))
                }
              >
                {COMPLAINT_CATEGORIES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {t(item.fr, item.en)}
                  </option>
                ))}
              </Select>
              <Select
                label={t("Praticien concerné (facultatif)", "Practitioner concerned (optional)")}
                name="therapeute"
                value={complaintForm.therapeute}
                onChange={(event) =>
                  setComplaintForm((current) => ({ ...current, therapeute: event.target.value }))
                }
              >
                <option value="">{t("Aucun en particulier", "None in particular")}</option>
                {therapists.map((therapist) => (
                  <option key={therapist.profileId} value={therapist.profileId}>
                    {therapist.nom}
                  </option>
                ))}
              </Select>
              <Select
                label={t("Priorité", "Priority")}
                name="priorite"
                value={complaintForm.priorite}
                onChange={(event) =>
                  setComplaintForm((current) => ({ ...current, priorite: event.target.value }))
                }
              >
                {PRIORITIES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {t(item.fr, item.en)}
                  </option>
                ))}
              </Select>
              <Textarea
                label={t("Votre message", "Your message")}
                name="message"
                required
                rows={5}
                maxLength={4000}
                value={complaintForm.message}
                onChange={(event) =>
                  setComplaintForm((current) => ({ ...current, message: event.target.value }))
                }
                placeholder={t(
                  "Décrivez les faits, la date et ce que vous attendez de notre équipe.",
                  "Describe the facts, the date and what you expect from our team.",
                )}
              />
              <Button type="submit" loading={submittingComplaint} className="w-full">
                <Send className="h-4 w-4" />
                {t("Envoyer ma réclamation", "Send my complaint")}
              </Button>
              <p className="text-center text-[10px] text-muted">
                {t(
                  "Nous répondons sous 48 h ouvrées.",
                  "We reply within 48 business hours.",
                )}
              </p>
            </form>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-black text-ink">
                {t("Mes réclamations", "My complaints")}
              </h2>
              <Badge tone="warn">
                {activeComplaints.length} {t("en cours", "open")}
              </Badge>
            </div>
            {complaints.length === 0 ? (
              <EmptyState
                icon={LifeBuoy}
                title={t("Aucune réclamation", "No complaint")}
                description={t(
                  "Si quelque chose ne s'est pas bien passé, nous sommes là pour l'entendre.",
                  "If something did not go well, we are here to listen.",
                )}
              />
            ) : (
              complaints.map((complaint) => (
                <article key={complaint.id} className="card p-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-black text-ink">{complaint.categorie}</p>
                      <p className="mt-0.5 text-[10px] text-muted">
                        {formatDateTime(complaint.date_creation, lang)}
                        {complaint.therapeute_nom ? ` · ${complaint.therapeute_nom}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <StatusBadge status={complaint.statut} />
                      <StatusBadge status={complaint.priorite} />
                    </div>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-muted">{complaint.message}</p>
                  {complaint.reponse && (
                    <div className="mt-3 rounded-2xl bg-sage-50 p-3.5">
                      <p className="text-[10px] font-black uppercase tracking-wider text-teal-500">
                        {t("Réponse de l'équipe", "Team reply")}
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-teal-900/80">
                        {complaint.reponse}
                      </p>
                      {complaint.traite_par_nom && (
                        <p className="mt-1.5 text-[10px] font-semibold text-muted">
                          — {complaint.traite_par_nom}
                        </p>
                      )}
                    </div>
                  )}
                </article>
              ))
            )}
          </section>
        </div>
      )}

      {tab === "reports" && (
        <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <section className="card p-5">
            <h2 className="inline-flex items-center gap-2 text-base font-black text-ink">
              <Bug className="h-4 w-4 text-teal-500" />
              {t("Nouveau signalement", "New report")}
            </h2>
            <p className="mt-1 text-[11px] leading-relaxed text-muted">
              {t(
                "Bug, suggestion ou incident : votre signalement est transmis directement à l'administration.",
                "Bug, suggestion or incident: your report goes straight to the administration.",
              )}
            </p>
            <form onSubmit={submitReport} className="mt-4 space-y-3">
              <Select
                label={t("Type", "Type")}
                name="type"
                value={reportForm.type}
                onChange={(event) =>
                  setReportForm((current) => ({ ...current, type: event.target.value }))
                }
              >
                {REPORT_TYPES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {t(item.fr, item.en)}
                  </option>
                ))}
              </Select>
              <Input
                label={t("Sujet", "Subject")}
                name="sujet"
                required
                maxLength={200}
                value={reportForm.sujet}
                onChange={(event) =>
                  setReportForm((current) => ({ ...current, sujet: event.target.value }))
                }
                placeholder={t("En une phrase", "In one sentence")}
              />
              <Select
                label={t("Priorité", "Priority")}
                name="priorite"
                value={reportForm.priorite}
                onChange={(event) =>
                  setReportForm((current) => ({ ...current, priorite: event.target.value }))
                }
              >
                {REPORT_PRIORITIES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {t(item.fr, item.en)}
                  </option>
                ))}
              </Select>
              <Textarea
                label={t("Description", "Description")}
                name="message"
                required
                rows={5}
                value={reportForm.message}
                onChange={(event) =>
                  setReportForm((current) => ({ ...current, message: event.target.value }))
                }
                placeholder={t(
                  "Décrivez ce qui s'est passé, l'écran concerné, le message d'erreur…",
                  "Describe what happened, the screen involved, the error message…",
                )}
              />
              <Button type="submit" loading={submittingReport} className="w-full">
                <ShieldAlert className="h-4 w-4" />
                {t("Envoyer le signalement", "Send report")}
              </Button>
            </form>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-black text-ink">{t("Mes signalements", "My reports")}</h2>
            {reports.length === 0 ? (
              <EmptyState
                icon={Bug}
                title={t("Aucun signalement", "No report")}
                description={t(
                  "Vos signalements et leurs suivis apparaîtront ici.",
                  "Your reports and their follow-up will appear here.",
                )}
              />
            ) : (
              reports.map((report) => (
                <article key={report.id} className="card p-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-black text-ink">{report.sujet}</p>
                      <p className="mt-0.5 text-[10px] text-muted">
                        {report.type_display} · {formatDate(report.date_creation, lang, "d MMM yyyy")}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <StatusBadge status={report.statut} />
                      <StatusBadge status={report.priorite} />
                    </div>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-muted">{report.message}</p>
                  {report.reponse && (
                    <div className="mt-3 flex items-start gap-2 rounded-2xl bg-sage-50 p-3">
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
                      <p className="text-[11px] leading-relaxed text-teal-900/80">{report.reponse}</p>
                    </div>
                  )}
                </article>
              ))
            )}
          </section>
        </div>
      )}

      <Modal
        open={Boolean(reviewTarget)}
        onClose={() => setReviewTarget(null)}
        title={reviewTarget?.existing ? t("Modifier mon avis", "Edit my review") : t("Laisser un avis", "Leave a review")}
        description={reviewTarget?.nom}
        footer={
          <>
            <Button variant="outline" onClick={() => setReviewTarget(null)}>
              {t("Annuler", "Cancel")}
            </Button>
            <Button onClick={submitReview} loading={submittingReview} disabled={reviewLoading}>
              <Star className="h-4 w-4" />
              {reviewTarget?.existing ? t("Mettre à jour", "Update") : t("Publier", "Publish")}
            </Button>
          </>
        }
      >
        {reviewTarget && (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-2 rounded-2xl bg-sage-50 p-5">
              <Avatar src={reviewTarget.avatar} name={reviewTarget.nom} size="lg" />
              <p className="text-sm font-black text-ink">{reviewTarget.nom}</p>
              <StarRating value={rating} onChange={setRating} size="xl" />
              <p className="text-[11px] text-muted">
                {rating
                  ? [
                      t("Très insatisfait", "Very dissatisfied"),
                      t("Insatisfait", "Dissatisfied"),
                      t("Correct", "Okay"),
                      t("Satisfait", "Satisfied"),
                      t("Excellent", "Excellent"),
                    ][rating - 1]
                  : t("Sélectionnez une note", "Select a rating")}
              </p>
            </div>
            <Textarea
              label={t("Votre commentaire (facultatif)", "Your comment (optional)")}
              name="commentaire"
              rows={5}
              maxLength={2000}
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder={t(
                "Qu'est-ce qui vous a aidé ? Que pourrait-on améliorer ?",
                "What helped you? What could be improved?",
              )}
            />
            <div className="flex items-start gap-2 rounded-2xl bg-sand/60 px-3 py-2.5">
              <MessageCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-500" />
              <p className="text-[10px] leading-relaxed text-muted">
                {t(
                  "Les avis sont publics mais anonymisés côté praticien. Restez respectueux et évitez les données médicales sensibles.",
                  "Reviews are public but anonymised on the practitioner side. Stay respectful and avoid sensitive medical data.",
                )}
              </p>
            </div>
            {reviewLoading && (
              <p className="text-center text-[10px] text-muted">
                {t("Vérification du praticien…", "Verifying the practitioner…")}
              </p>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
