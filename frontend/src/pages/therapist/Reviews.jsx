import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  LifeBuoy,
  MessageCircle,
  Star,
  TrendingUp,
} from "lucide-react";
import api, { extractError, getAll } from "../../lib/api";
import { useAuth } from "../../contexts/AuthContext";
import { useI18n } from "../../contexts/I18nContext";
import { Badge, StatusBadge } from "../../components/ui/Badge";
import { EmptyState, ErrorState, LoadingBlock } from "../../components/ui/Feedback";
import { StatCard } from "../../components/ui/Card";
import Tabs from "../../components/ui/Tabs";
import { Stars } from "../../components/ui/Stars";
import { formatDate, formatDateTime } from "../../lib/format";

function maskName(name = "") {
  const parts = name.replace(/^Dr\s+/i, "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "—";
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

export default function Reviews() {
  const { user, therapist } = useAuth();
  const { t, lang } = useI18n();
  const [reviews, setReviews] = useState([]);
  const [summary, setSummary] = useState(null);
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("reviews");

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      const [reviewList, summaryPayload, complaintList] = await Promise.all([
        getAll("/feedback/reviews/", { therapeute: user.id }),
        therapist?.id
          ? api
              .get(`/feedback/reviews/therapist/${therapist.id}/`)
              .then((response) => response.data)
          : Promise.resolve(null),
        getAll("/feedback/complaints/"),
      ]);
      setReviews(reviewList || []);
      setSummary(summaryPayload);
      setComplaints(complaintList || []);
    } catch (err) {
      setError(
        extractError(
          err,
          t("Impossible de charger vos avis.", "Unable to load your reviews."),
        ),
      );
    } finally {
      setLoading(false);
    }
  }, [user, therapist, t]);

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(() => {
    const total = reviews.length;
    const average = total
      ? reviews.reduce((sum, review) => sum + Number(review.note || 0), 0) / total
      : 0;
    const positive = reviews.filter((review) => Number(review.note) >= 4).length;
    const open = complaints.filter(
      (complaint) => !["resolue", "rejetee"].includes(complaint.statut),
    ).length;
    return { total, average, positive, open };
  }, [reviews, complaints]);

  const distribution = useMemo(() => {
    if (summary?.distribution?.length) return summary.distribution;
    return [5, 4, 3, 2, 1].map((note) => ({
      note,
      count: reviews.filter((review) => Number(review.note) === note).length,
    }));
  }, [summary, reviews]);

  if (loading) return <LoadingBlock label={t("Chargement de vos avis…", "Loading your reviews…")} />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const tabs = [
    { value: "reviews", label: t("Avis patients", "Patient reviews"), count: reviews.length, icon: Star },
    { value: "complaints", label: t("Réclamations", "Complaints"), count: complaints.length, icon: LifeBuoy },
  ];

  return (
    <div className="space-y-5">
      <div>
        <p className="overline">{t("Avis & réclamations", "Reviews & complaints")}</p>
        <h1 className="mt-1 text-2xl font-black tracking-tight text-ink sm:text-3xl">
          {t("La confiance se construit", "Trust is built over time")}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {t(
            "Consultez les retours de vos patients et suivez les réclamations qui vous concernent.",
            "Review your patients' feedback and follow the complaints that concern you.",
          )}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Star}
          label={t("Note moyenne", "Average rating")}
          value={stats.average ? stats.average.toFixed(1) : "—"}
          hint={t(`${stats.total} avis public(s)`, `${stats.total} public review(s)`)}
          tone="gold"
        />
        <StatCard
          icon={TrendingUp}
          label={t("Avis positifs", "Positive reviews")}
          value={stats.positive}
          hint={t("Notes de 4 et 5 étoiles", "Ratings of 4 and 5 stars")}
          tone="success"
        />
        <StatCard
          icon={MessageCircle}
          label={t("Avis reçus", "Reviews received")}
          value={stats.total}
          hint={t("Publiés sur votre profil", "Published on your profile")}
          tone="sage"
        />
        <StatCard
          icon={AlertTriangle}
          label={t("Réclamations ouvertes", "Open complaints")}
          value={stats.open}
          hint={t("Traitées par l'administration", "Handled by the administration")}
          tone={stats.open ? "risk" : "teal"}
        />
      </div>

      <Tabs tabs={tabs} value={tab} onChange={setTab} className="w-fit" />

      {tab === "reviews" && (
        <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
          <section className="space-y-3">
            {reviews.length === 0 ? (
              <EmptyState
                icon={Star}
                title={t("Aucun avis pour le moment", "No review yet")}
                description={t(
                  "Les patients peuvent évaluer leur praticien après une séance terminée. Continuez votre accompagnement avec la même attention.",
                  "Patients can rate their practitioner after a completed session. Keep supporting them with the same care.",
                )}
              />
            ) : (
              reviews.map((review) => (
                <article key={review.id} className="card p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gold/25">
                        <Star className="h-5 w-5 fill-gold text-gold" />
                      </span>
                      <div>
                        <p className="text-sm font-black text-ink">{maskName(review.patient_nom)}</p>
                        <p className="text-[10px] text-muted">
                          {formatDate(review.date_creation, lang, "d MMMM yyyy")}
                          {review.seance ? ` · ${t("séance vérifiée", "verified session")}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Stars value={review.note} size="sm" />
                      <span className="text-[10px] font-black text-teal-600">{review.note}/5</span>
                    </div>
                  </div>
                  {review.commentaire ? (
                    <p className="mt-3 text-sm leading-relaxed text-ink/80">« {review.commentaire} »</p>
                  ) : (
                    <p className="mt-3 text-xs italic text-muted">
                      {t("Aucun commentaire laissé.", "No comment left.")}
                    </p>
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

          <aside className="space-y-4">
            <section className="card p-5">
              <h2 className="text-sm font-black text-ink">
                {t("Répartition des notes", "Rating distribution")}
              </h2>
              <div className="mt-4 space-y-2.5">
                {distribution.map((item) => {
                  const max = Math.max(...distribution.map((entry) => entry.count), 1);
                  return (
                    <div key={item.note} className="flex items-center gap-2.5">
                      <span className="inline-flex w-8 shrink-0 items-center gap-0.5 text-[11px] font-bold text-muted">
                        {item.note}
                        <Star className="h-3 w-3 fill-gold text-gold" />
                      </span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-sand">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-sage-400 to-teal-500"
                          style={{ width: `${(item.count / max) * 100}%` }}
                        />
                      </div>
                      <span className="w-6 shrink-0 text-right text-[11px] font-black text-ink">
                        {item.count}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="rounded-3xl bg-sage-50 p-5">
              <CheckCircle2 className="h-5 w-5 text-teal-500" />
              <h2 className="mt-2 text-sm font-black text-teal-900">
                {t("Des avis authentiques", "Authentic reviews")}
              </h2>
              <p className="mt-1 text-[11px] leading-relaxed text-teal-900/70">
                {t(
                  "Seuls les patients ayant terminé une séance avec vous peuvent publier un avis. Les commentaires sont anonymisés côté praticien.",
                  "Only patients who completed a session with you can publish a review. Comments are anonymised on the practitioner side.",
                )}
              </p>
            </section>

            <section className="card p-5">
              <h2 className="text-sm font-black text-ink">
                {t("Améliorer votre pratique", "Improving your practice")}
              </h2>
              <p className="mt-1 text-[11px] leading-relaxed text-muted">
                {t(
                  "Un avis critique est une occasion d'ajuster votre cadre thérapeutique. Répondez aux réclamations via l'administration si un échange est nécessaire.",
                  "Critical feedback is an opportunity to adjust your therapeutic frame. Reply to complaints through the administration if an exchange is needed.",
                )}
              </p>
            </section>
          </aside>
        </div>
      )}

      {tab === "complaints" && (
        <div className="space-y-3">
          <div className="flex items-start gap-2 rounded-2xl bg-sand/60 px-4 py-3">
            <LifeBuoy className="mt-0.5 h-4 w-4 shrink-0 text-teal-500" />
            <p className="text-[11px] leading-relaxed text-muted">
              {t(
                "Les réclamations sont traitées par l'équipe TheraNova. Vous pouvez suivre leur statut et la réponse apportée au patient, mais seul un administrateur peut y répondre.",
                "Complaints are handled by the TheraNova team. You can follow their status and the reply given to the patient, but only an administrator can answer them.",
              )}
            </p>
          </div>

          {complaints.length === 0 ? (
            <EmptyState
              icon={LifeBuoy}
              title={t("Aucune réclamation", "No complaint")}
              description={t(
                "Aucune réclamation ne vous concerne actuellement. C'est un bon signe pour la qualité de votre accompagnement.",
                "No complaint currently concerns you. That is a good sign for the quality of your care.",
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
                      {complaint.patient_nom ? ` · ${maskName(complaint.patient_nom)}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <StatusBadge status={complaint.statut} />
                    <StatusBadge status={complaint.priorite} />
                  </div>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-muted">{complaint.message}</p>
                {complaint.reponse ? (
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
                ) : (
                  <p className="mt-3 inline-flex items-center gap-1.5 text-[10px] font-semibold text-muted">
                    <AlertTriangle className="h-3.5 w-3.5 text-warn" />
                    {t("En attente de la réponse de l'administration.", "Awaiting the administration's reply.")}
                  </p>
                )}
                {complaint.date_resolution && (
                  <p className="mt-2 text-[10px] text-muted">
                    {t("Résolue le", "Resolved on")}{" "}
                    {formatDate(complaint.date_resolution, lang, "d MMM yyyy")}
                  </p>
                )}
              </article>
            ))
          )}
        </div>
      )}
    </div>
  );
}
