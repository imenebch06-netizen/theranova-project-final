import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  BadgeCheck,
  CalendarDays,
  Check,
  Clock3,
  Globe2,
  GraduationCap,
  HeartHandshake,
  MapPin,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Star,
  Stethoscope,
  Video,
} from "lucide-react";
import clsx from "clsx";
import api, { unwrap } from "../lib/api";
import { useI18n } from "../contexts/I18nContext";
import { useAuth } from "../contexts/AuthContext";
import Avatar from "../components/ui/Avatar";
import { Badge } from "../components/ui/Badge";
import { Stars } from "../components/ui/Stars";
import { buttonClass } from "../components/ui/Button";
import { EmptyState, ErrorState, LoadingBlock } from "../components/ui/Feedback";
import { dateKey, formatCurrency, formatDate, formatTime } from "../lib/format";

export default function TherapistDetail() {
  const { id } = useParams();
  const { t, lang } = useI18n();
  const { isAuthenticated, role } = useAuth();
  const [params] = useSearchParams();
  const [therapist, setTherapist] = useState(null);
  const [slots, setSlots] = useState([]);
  const [reviews, setReviews] = useState(null);
  const [tab, setTab] = useState(params.get("tab") === "avis" ? "reviews" : "about");
  const [days, setDays] = useState(21);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    Promise.allSettled([
      api.get(`/accounts/therapists/${id}/`),
      api.get(`/scheduling/availability/${id}/`, { params: { days } }),
      api.get(`/feedback/reviews/therapist/${id}/`),
    ]).then(([detail, availability, reviewData]) => {
      if (!active) return;
      if (detail.status === "fulfilled") setTherapist(detail.value.data);
      else setError(t("Ce profil est introuvable ou n'est plus disponible.", "This profile cannot be found or is no longer available."));
      if (availability.status === "fulfilled") setSlots(availability.value.data.slots || []);
      if (reviewData.status === "fulfilled") setReviews(reviewData.value.data);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [id, days, t]);

  const grouped = useMemo(() => {
    const map = new Map();
    slots.forEach((slot) => {
      const key = dateKey(slot.date_heure_debut);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(slot);
    });
    return [...map.entries()].slice(0, 10);
  }, [slots]);

  const bookingPath = (slotId) =>
    `/app/reserver?therapeute=${id}${slotId ? `&creneau=${slotId}` : ""}`;

  const canBook = !isAuthenticated || role === "patient";
  const target = !isAuthenticated
    ? `/connexion?next=${encodeURIComponent(bookingPath())}`
    : role === "patient"
      ? bookingPath()
      : "/espace";

  if (loading) return <LoadingBlock label={t("Chargement du profil…", "Loading profile…")} />;
  if (error || !therapist) {
    return (
      <div className="container-page py-16">
        <ErrorState message={error || t("Profil introuvable.", "Profile not found.")} />
        <div className="mt-6 text-center">
          <Link to="/therapeutes" className="link">
            {t("Retour à l'annuaire", "Back to the directory")}
          </Link>
        </div>
      </div>
    );
  }

  const name = therapist.nom_complet || therapist.user?.full_name;
  const specialites = therapist.specialites || [];
  const rating = Number(therapist.note_globale || 0);
  const totalReviews = Number(therapist.nombre_avis || 0);

  return (
    <div>
      <div className="border-b border-line/60 bg-sage-100/40">
        <div className="container-page py-6">
          <Link to="/therapeutes" className="inline-flex items-center gap-1.5 text-xs font-bold text-muted transition hover:text-teal-600">
            <ArrowLeft className="h-3.5 w-3.5" />
            {t("Tous les thérapeutes", "All therapists")}
          </Link>
          <div className="mt-5 flex flex-col gap-6 sm:flex-row sm:items-center">
            <Avatar src={therapist.user?.avatar} name={name} size="2xl" ring />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-3xl font-black tracking-tight text-ink sm:text-4xl">{name}</h1>
                {therapist.verifie && (
                  <Badge tone="success">
                    <BadgeCheck className="h-3.5 w-3.5" />
                    {t("Vérifié", "Verified")}
                  </Badge>
                )}
                {therapist.statut === "actif" && <Badge tone="sage">{t("Accepte de nouveaux patients", "Accepting new patients")}</Badge>}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted">
                <span className="inline-flex items-center gap-1.5">
                  <Star className="h-4 w-4 fill-gold text-gold" />
                  <span className="font-black text-ink">{rating.toFixed(1)}</span>
                  <span>({totalReviews} {t("avis", "reviews")})</span>
                </span>
                {therapist.ville && (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="h-4 w-4 text-teal-500" />
                    {therapist.ville}
                    {therapist.cabinet ? ` · ${therapist.cabinet}` : ""}
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5">
                  <Stethoscope className="h-4 w-4 text-teal-500" />
                  {therapist.annees_experience} {t("ans d'expérience", "years of experience")}
                </span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {specialites.map((specialty) => (
                  <Badge key={specialty.id} tone="sage">
                    {lang === "en" && specialty.nom_en ? specialty.nom_en : specialty.nom}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container-page grid gap-8 py-10 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0">
          <div className="mb-6 flex gap-1 overflow-x-auto border-b border-line">
            {[
              { key: "about", label: t("À propos", "About") },
              { key: "availability", label: t("Disponibilités", "Availability"), count: slots.length },
              { key: "reviews", label: t("Avis patients", "Patient reviews"), count: totalReviews },
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setTab(item.key)}
                className={clsx(
                  "-mb-px inline-flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold transition",
                  tab === item.key
                    ? "border-teal-500 text-teal-600"
                    : "border-transparent text-muted hover:text-teal-600",
                )}
              >
                {item.label}
                {item.count !== undefined && (
                  <span className="rounded-full bg-sand px-1.5 py-0.5 text-[10px] font-black text-muted">
                    {item.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {tab === "about" && (
            <div className="space-y-5">
              <section className="card p-6">
                <h2 className="text-lg font-black text-ink">{t("Mon approche", "My approach")}</h2>
                <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted">
                  {therapist.bio || t("Profil en cours de complétion.", "Profile being completed.")}
                </p>
                {therapist.approche && (
                  <div className="mt-4 rounded-2xl bg-sage-50 px-4 py-3 text-sm font-semibold text-teal-800">
                    <span className="text-[10px] font-black uppercase tracking-[0.14em] text-teal-400">
                      {t("Approche principale", "Main approach")}
                    </span>
                    <p className="mt-1">{therapist.approche}</p>
                  </div>
                )}
              </section>

              <div className="grid gap-4 sm:grid-cols-2">
                <section className="card p-6">
                  <h3 className="inline-flex items-center gap-2 text-sm font-black text-ink">
                    <GraduationCap className="h-4 w-4 text-teal-500" />
                    {t("Formation & diplômes", "Training & qualifications")}
                  </h3>
                  <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted">
                    {therapist.diplomes || t("Diplômes non renseignés.", "Qualifications not provided.")}
                  </p>
                  {therapist.numero_licence && (
                    <p className="mt-3 text-[11px] font-semibold text-muted">
                      {t("N° de licence", "License no.")} : {therapist.numero_licence}
                    </p>
                  )}
                </section>

                <section className="card p-6">
                  <h3 className="inline-flex items-center gap-2 text-sm font-black text-ink">
                    <Sparkles className="h-4 w-4 text-teal-500" />
                    {t("En pratique", "In practice")}
                  </h3>
                  <ul className="mt-3 space-y-3 text-sm text-muted">
                    <li className="flex items-start gap-2">
                      <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-teal-500" />
                      {t("Séance de", "Session of")} {therapist.duree_seance || 60} min
                    </li>
                    <li className="flex items-start gap-2">
                      <Video className="mt-0.5 h-4 w-4 shrink-0 text-teal-500" />
                      {t("Téléconsultation sécurisée", "Secure teleconsultation")}
                    </li>
                    <li className="flex items-start gap-2">
                      <Globe2 className="mt-0.5 h-4 w-4 shrink-0 text-teal-500" />
                      {(therapist.langues || []).join(" · ") || t("Français", "French")}
                    </li>
                    <li className="flex items-start gap-2">
                      <HeartHandshake className="mt-0.5 h-4 w-4 shrink-0 text-teal-500" />
                      {(therapist.types_sessions || []).join(" · ") || t("Individuel", "Individual")}
                    </li>
                  </ul>
                </section>
              </div>

              <section className="rounded-3xl border border-teal-500/15 bg-teal-500 p-6 text-cream">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="h-6 w-6 shrink-0 text-sage-300" />
                  <div>
                    <h3 className="text-sm font-black text-cream">{t("Un cadre confidentiel", "A confidential setting")}</h3>
                    <p className="mt-1 text-xs leading-relaxed text-cream/70">
                      {t(
                        "Vos échanges et votre dossier clinique sont protégés. Le praticien n'accède qu'aux informations nécessaires à votre suivi, et vous gardez le contrôle de vos données.",
                        "Your conversations and clinical record are protected. The practitioner only accesses information needed for your care, and you keep control of your data.",
                      )}
                    </p>
                  </div>
                </div>
              </section>
            </div>
          )}

          {tab === "availability" && (
            <div>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted">
                  {t("Créneaux en visioconférence, heure d'Alger.", "Video slots, Algiers time.")}
                </p>
                <select value={days} onChange={(event) => setDays(Number(event.target.value))} className="input w-auto py-2.5 text-xs font-bold">
                  <option value={7}>{t("7 prochains jours", "Next 7 days")}</option>
                  <option value={14}>{t("14 prochains jours", "Next 14 days")}</option>
                  <option value={21}>{t("21 prochains jours", "Next 21 days")}</option>
                  <option value={30}>{t("30 prochains jours", "Next 30 days")}</option>
                </select>
              </div>

              {grouped.length === 0 ? (
                <EmptyState
                  icon={CalendarDays}
                  title={t("Aucun créneau pour le moment", "No slots at the moment")}
                  description={t(
                    "Ce praticien n'a pas publié de disponibilité sur cette période. Essayez une période plus large ou consultez un autre profil.",
                    "This practitioner has not published availability for this period. Try a wider range or browse another profile.",
                  )}
                />
              ) : (
                <div className="space-y-3">
                  {grouped.map(([key, daySlots]) => (
                    <div key={key} className="card p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-black capitalize text-ink">
                            {formatDate(daySlots[0].date_heure_debut, lang, "EEEE d MMMM")}
                          </p>
                          <p className="text-[11px] font-semibold text-muted">
                            {daySlots.length} {t("créneaux disponibles", "slots available")}
                          </p>
                        </div>
                        <Badge tone="sage">{daySlots[0].duree_minutes || 60} min</Badge>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {daySlots.map((slot) => (
                          <Link
                            key={slot.id}
                            to={canBook ? bookingPath(slot.id) : target}
                            className="rounded-full border border-line bg-white px-3.5 py-2 text-xs font-bold text-teal-700 transition hover:border-teal-500 hover:bg-teal-500 hover:text-cream"
                          >
                            {formatTime(slot.date_heure_debut)}
                          </Link>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === "reviews" && (
            <div className="space-y-5">
              <div className="card p-6">
                <div className="grid gap-6 sm:grid-cols-[200px_1fr]">
                  <div className="flex flex-col items-center justify-center rounded-2xl bg-sage-50 p-5 text-center">
                    <p className="text-4xl font-black text-teal-600">{rating.toFixed(1)}</p>
                    <Stars value={rating} size="lg" className="mt-2" />
                    <p className="mt-2 text-[11px] font-semibold text-muted">
                      {totalReviews} {t("avis vérifiés", "verified reviews")}
                    </p>
                  </div>
                  <div className="space-y-2">
                    {(reviews?.distribution || [
                      { note: 5, count: 0 },
                      { note: 4, count: 0 },
                      { note: 3, count: 0 },
                      { note: 2, count: 0 },
                      { note: 1, count: 0 },
                    ]).map((row) => {
                      const percent = totalReviews ? Math.round((row.count / totalReviews) * 100) : 0;
                      return (
                        <div key={row.note} className="flex items-center gap-3">
                          <span className="flex w-8 items-center gap-1 text-xs font-bold text-muted">
                            {row.note}
                            <Star className="h-3 w-3 fill-gold text-gold" />
                          </span>
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-sand">
                            <div className="h-full rounded-full bg-gold" style={{ width: `${percent}%` }} />
                          </div>
                          <span className="w-8 text-right text-[11px] font-semibold text-muted">{row.count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {(reviews?.avis || []).length === 0 ? (
                <EmptyState
                  icon={MessageCircle}
                  title={t("Pas encore d'avis", "No reviews yet")}
                  description={t(
                    "Les avis sont publiés après une séance terminée. Vous pourrez partager votre expérience en toute transparence.",
                    "Reviews are published after a completed session. You will be able to share your experience transparently.",
                  )}
                />
              ) : (
                <div className="space-y-3">
                  {reviews.avis.map((review) => (
                    <article key={review.id} className="card p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <Avatar src={review.patient_avatar} name={review.patient_nom} size="sm" />
                          <div>
                            <p className="text-sm font-black text-ink">{review.patient_nom}</p>
                            <p className="text-[10px] font-semibold text-muted">
                              {formatDate(review.date_creation, lang, "d MMMM yyyy")}
                            </p>
                          </div>
                        </div>
                        <Stars value={review.note} size="sm" />
                      </div>
                      {review.commentaire && (
                        <p className="mt-3 text-sm leading-relaxed text-ink/80">{review.commentaire}</p>
                      )}
                      {review.seance && (
                        <p className="mt-3 inline-flex items-center gap-1 text-[10px] font-semibold text-success">
                          <Check className="h-3 w-3" />
                          {t("Séance vérifiée", "Verified session")}
                        </p>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <aside>
          <div className="card sticky top-24 overflow-hidden">
            <div className="bg-teal-500 px-6 py-5 text-cream">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-sage-300">
                {t("Séance individuelle", "Individual session")}
              </p>
              <p className="mt-1 text-3xl font-black">
                {formatCurrency(therapist.tarif_seance, lang)}
              </p>
              <p className="mt-1 text-xs text-cream/60">
                {therapist.duree_seance || 60} min · {t("visioconférence", "video call")}
              </p>
            </div>
            <div className="space-y-4 p-6">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted">{t("Prochain créneau", "Next slot")}</span>
                <span className="font-bold text-ink">
                  {slots[0]
                    ? `${formatDate(slots[0].date_heure_debut, lang, "d MMM")} · ${formatTime(slots[0].date_heure_debut)}`
                    : "—"}
                </span>
              </div>
              <div className="divider" />
              <ul className="space-y-2.5 text-xs text-muted">
                <li className="flex items-center gap-2">
                  <Check className="h-3.5 w-3.5 text-success" />
                  {t("Paiement BaridiMob / Edahabia", "BaridiMob / Edahabia payment")}
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-3.5 w-3.5 text-success" />
                  {t("Lien Google Meet sécurisé", "Secure Google Meet link")}
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-3.5 w-3.5 text-success" />
                  {t("Annulation gratuite 24 h avant", "Free cancellation 24h before")}
                </li>
              </ul>
              <Link
                to={target}
                className={buttonClass({ variant: "primary", className: "w-full" })}
              >
                <CalendarDays className="h-4 w-4" />
                {t("Prendre rendez-vous", "Book a session")}
              </Link>
              {!canBook && (
                <p className="text-center text-[11px] text-muted">
                  {t("Connectez-vous avec un compte patient pour réserver.", "Sign in with a patient account to book.")}
                </p>
              )}
              <p className="text-center text-[10px] leading-relaxed text-muted">
                {t(
                  "Le premier rendez-vous est confirmé par le praticien avant paiement.",
                  "Your first appointment is confirmed by the practitioner before payment.",
                )}
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
