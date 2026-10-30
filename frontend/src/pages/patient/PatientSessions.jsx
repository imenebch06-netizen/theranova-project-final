import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  CalendarClock,
  CalendarDays,
  Check,
  Clock3,
  CreditCard,
  Info,
  MessageCircle,
  PlayCircle,
  Star,
  Users,
  Video,
  X,
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
import { RadioCard } from "../../components/ui/Field";
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatTime,
  fromNow,
} from "../../lib/format";

const METHODS = [
  { value: "baridimob", fr: "BaridiMob", en: "BaridiMob", descFr: "Paiement mobile Algérie Poste", descEn: "Algérie Poste mobile payment" },
  { value: "carte", fr: "Carte Edahabia", en: "Edahabia card", descFr: "Carte de paiement Algérie Poste", descEn: "Algérie Poste payment card" },
  { value: "cib", fr: "Carte CIB", en: "CIB card", descFr: "Carte interbancaire", descEn: "Interbank card" },
  { value: "credit", fr: "Crédit TheraNova", en: "TheraNova credit", descFr: "Utiliser votre solde disponible", descEn: "Use your available balance" },
];

export default function PatientSessions() {
  const { t, lang } = useI18n();
  const { success, error: toastError } = useToast();
  const [tab, setTab] = useState("upcoming");
  const [sessions, setSessions] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [joining, setJoining] = useState(null);
  const [payTarget, setPayTarget] = useState(null);
  const [method, setMethod] = useState("baridimob");
  const [paying, setPaying] = useState(false);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelMotif, setCancelMotif] = useState("");
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [sessionList, requestList] = await Promise.all([
        getAll("/scheduling/sessions/"),
        getAll("/scheduling/requests/"),
      ]);
      setSessions(sessionList || []);
      setRequests(requestList || []);
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
  const upcoming = useMemo(
    () =>
      sessions
        .filter(
          (session) =>
            session.statut !== "annulee" &&
            (session.statut === "en_cours" ||
              (session.statut === "prevue" && new Date(session.date_debut).getTime() >= now - 30 * 60000)),
        )
        .sort((a, b) => new Date(a.date_debut) - new Date(b.date_debut)),
    [sessions, now],
  );

  const past = useMemo(
    () =>
      sessions.filter(
        (session) =>
          session.statut === "terminee" ||
          session.statut === "annulee" ||
          (session.statut === "prevue" && new Date(session.date_debut).getTime() < now),
      ),
    [sessions, now],
  );

  const activeRequests = useMemo(
    () =>
      requests.filter((request) =>
        ["en_attente", "acceptee"].includes(request.statut),
      ),
    [requests],
  );

  const totals = useMemo(() => {
    const completed = sessions.filter((session) => session.statut === "terminee").length;
    const toPay = requests.reduce((sum, request) => sum + Number(request.reste_a_payer || 0), 0);
    return { completed, toPay, upcoming: upcoming.length };
  }, [sessions, requests, upcoming]);

  async function join(session) {
    setJoining(session.id);
    try {
      const { data } = await api.post(`/scheduling/sessions/${session.id}/join/`);
      const link = data.lien_googlemeet || data.seance?.lien_googlemeet;
      if (link) {
        window.open(link, "_blank", "noopener,noreferrer");
        success(
          t("La salle s'ouvre dans un nouvel onglet.", "The room is opening in a new tab."),
          { title: t("Visioconférence", "Video call") },
        );
      } else {
        success(
          t(
            "La salle sera accessible 15 minutes avant la séance.",
            "The room will be accessible 15 minutes before the session.",
          ),
        );
      }
      load();
    } catch (err) {
      toastError(
        extractError(
          err,
          t("Impossible de rejoindre la séance.", "Unable to join the session."),
        ),
      );
    } finally {
      setJoining(null);
    }
  }

  async function pay() {
    if (!payTarget) return;
    setPaying(true);
    try {
      const body = { methode: method };
      if (payTarget.participantId) body.participant_id = payTarget.participantId;
      const { data } = await api.post(`/scheduling/requests/${payTarget.request.id}/pay/`, body);
      if (data.demande?.statut === "confirmee") {
        success(
          t(
            "Paiement accepté. Votre séance est confirmée !",
            "Payment accepted. Your session is confirmed!",
          ),
          { title: t("Séance confirmée", "Session confirmed") },
        );
      } else {
        success(
          t(
            "Votre part est réglée. En attente des autres participants.",
            "Your share is paid. Waiting for the other participants.",
          ),
          { title: t("Paiement accepté", "Payment accepted") },
        );
      }
      setPayTarget(null);
      load();
    } catch (err) {
      toastError(extractError(err, t("Le paiement a échoué.", "The payment failed.")));
    } finally {
      setPaying(false);
    }
  }

  async function cancel() {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      await api.post(`/scheduling/requests/${cancelTarget.id}/cancel/`, { motif: cancelMotif });
      success(t("La demande a été annulée.", "The request has been cancelled."));
      setCancelTarget(null);
      setCancelMotif("");
      load();
    } catch (err) {
      toastError(extractError(err, t("Annulation impossible.", "Unable to cancel.")));
    } finally {
      setCancelling(false);
    }
  }

  async function refusePart(request) {
    try {
      await api.post(`/scheduling/requests/${request.id}/refuse-part/`);
      success(t("Vous avez refusé cette invitation.", "You declined this invitation."));
      load();
    } catch (err) {
      toastError(extractError(err));
    }
  }

  if (loading) return <LoadingBlock label={t("Chargement de vos séances…", "Loading your sessions…")} />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const tabs = [
    { value: "upcoming", label: t("À venir", "Upcoming"), count: upcoming.length, icon: CalendarClock },
    { value: "requests", label: t("Demandes & paiements", "Requests & payments"), count: activeRequests.length, icon: CreditCard },
    { value: "past", label: t("Historique", "History"), count: past.length, icon: Check },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="overline">{t("Mes séances", "My sessions")}</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-ink sm:text-3xl">
            {t("Votre parcours de soin", "Your care journey")}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {t(
              "Retrouvez vos rendez-vous, vos paiements et vos séances passées.",
              "Find your appointments, payments and past sessions.",
            )}
          </p>
        </div>
        <Link to="/app/reserver" className={buttonClass({ size: "sm" })}>
          <CalendarDays className="h-4 w-4" />
          {t("Nouvelle séance", "New session")}
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="card flex items-center gap-3 p-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sage-100 text-teal-600">
            <CalendarClock className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-muted">
              {t("À venir", "Upcoming")}
            </p>
            <p className="text-lg font-black text-ink">{totals.upcoming}</p>
          </div>
        </div>
        <div className="card flex items-center gap-3 p-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gold/25 text-teal-700">
            <CreditCard className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-muted">
              {t("Reste à régler", "Left to pay")}
            </p>
            <p className="text-lg font-black text-ink">{formatCurrency(totals.toPay, lang)}</p>
          </div>
        </div>
        <div className="card flex items-center gap-3 p-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-success/10 text-success">
            <Check className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-muted">
              {t("Séances terminées", "Completed")}
            </p>
            <p className="text-lg font-black text-ink">{totals.completed}</p>
          </div>
        </div>
      </div>

      <Tabs tabs={tabs} value={tab} onChange={setTab} className="w-fit" />

      {tab === "upcoming" && (
        <div className="space-y-3">
          {upcoming.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title={t("Aucune séance à venir", "No upcoming session")}
              description={t(
                "Réservez un créneau avec un praticien ou consultez vos demandes en attente.",
                "Book a slot with a practitioner or check your pending requests.",
              )}
              action={
                <Link to="/app/reserver" className={buttonClass()}>
                  {t("Prendre rendez-vous", "Book a session")}
                </Link>
              }
            />
          ) : (
            upcoming.map((session) => (
              <article key={session.id} className="card overflow-hidden">
                <div className="grid gap-0 md:grid-cols-[1fr_230px]">
                  <div className="p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={session.statut} />
                      <Badge tone="sage">{session.type_session}</Badge>
                      {session.accessible && (
                        <Badge tone="success">{t("Salle ouverte", "Room open")}</Badge>
                      )}
                    </div>
                    <h2 className="mt-3 text-lg font-black text-ink">
                      {formatDate(session.date_debut, lang, "EEEE d MMMM yyyy")}
                    </h2>
                    <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-muted">
                      <Clock3 className="h-4 w-4 text-teal-500" />
                      {formatTime(session.date_debut)} – {formatTime(session.date_fin)} ·{" "}
                      {fromNow(session.date_debut, lang)}
                    </p>
                    <div className="mt-4 flex items-center gap-3 rounded-2xl bg-sage-50 p-3">
                      <Avatar
                        src={session.therapeute?.avatar}
                        name={session.therapeute?.nom_complet}
                        size="sm"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-ink">
                          {session.therapeute?.nom_complet}
                        </p>
                        <p className="text-[11px] text-muted">
                          {t("Praticien · visioconférence", "Practitioner · video call")}
                        </p>
                      </div>
                      {session.participants?.length > 1 && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-muted">
                          <Users className="h-3.5 w-3.5" />
                          {session.participants.length}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col justify-center gap-2 border-t border-line/70 bg-cream/50 p-5 md:border-l md:border-t-0">
                    <Button
                      onClick={() => join(session)}
                      loading={joining === session.id}
                      disabled={!session.can_join}
                    >
                      <PlayCircle className="h-4 w-4" />
                      {session.can_join
                        ? t("Rejoindre la séance", "Join session")
                        : t("Salle fermée", "Room closed")}
                    </Button>
                    <p className="text-center text-[10px] leading-relaxed text-muted">
                      {session.can_join
                        ? t("Le lien s'ouvre dans un nouvel onglet.", "The link opens in a new tab.")
                        : t(
                            "Accessible 15 min avant et 30 min après le début.",
                            "Accessible 15 min before and 30 min after the start.",
                          )}
                    </p>
                    <Link
                      to="/app/messages"
                      className={buttonClass({ variant: "outline", size: "sm" })}
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                      {t("Message", "Message")}
                    </Link>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      )}

      {tab === "requests" && (
        <div className="space-y-3">
          {requests.length === 0 ? (
            <EmptyState
              icon={CreditCard}
              title={t("Aucune demande", "No requests")}
              description={t(
                "Vos demandes de rendez-vous apparaîtront ici.",
                "Your appointment requests will appear here.",
              )}
              action={
                <Link to="/app/reserver" className={buttonClass()}>
                  {t("Réserver", "Book")}
                </Link>
              }
            />
          ) : (
            requests.map((request) => {
              const mine = request.ma_part;
              const isCreator = mine?.est_createur;
              const canCancel = ["en_attente", "acceptee", "confirmee"].includes(request.statut);
              return (
                <article key={request.id} className="card p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge status={request.statut} />
                        <Badge tone="sage">{request.type_session}</Badge>
                        {isCreator ? (
                          <Badge tone="teal">{t("Votre demande", "Your request")}</Badge>
                        ) : (
                          <Badge tone="warn">{t("Invitation", "Invitation")}</Badge>
                        )}
                      </div>
                      <h2 className="mt-2 text-base font-black text-ink">
                        {request.therapeute?.nom_complet}
                      </h2>
                      <p className="mt-0.5 text-sm text-muted">
                        {formatDateTime(request.creneau?.date_heure_debut, lang)} ·{" "}
                        {request.creneau?.duree_minutes || 60} min
                      </p>
                      {request.message && (
                        <p className="mt-2 line-clamp-2 rounded-2xl bg-sand/50 px-3 py-2 text-[11px] leading-relaxed text-muted">
                          « {request.message} »
                        </p>
                      )}
                      {request.motif_refus && (
                        <p className="mt-2 text-[11px] font-semibold text-risk">
                          {t("Motif", "Reason")} : {request.motif_refus}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black uppercase tracking-wider text-muted">
                        {t("Total", "Total")}
                      </p>
                      <p className="text-lg font-black text-teal-600">
                        {formatCurrency(request.prix_total, lang)}
                      </p>
                      <p className="text-[10px] text-muted">
                        {formatCurrency(request.prix_par_participant, lang)} /{" "}
                        {t("personne", "person")}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {(request.participants || []).map((participant) => (
                      <div
                        key={participant.id}
                        className="flex items-center justify-between gap-2 rounded-2xl border border-line bg-white px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-xs font-bold text-ink">
                            {participant.nom || participant.email}
                          </p>
                          <p className="truncate text-[10px] text-muted">{participant.email}</p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-black text-teal-700">
                            {formatCurrency(participant.montant, lang)}
                          </span>
                          <StatusBadge status={participant.statut} className="!px-1.5 !py-0.5 !text-[9px]" />
                          {isCreator &&
                            participant.statut === "invite" &&
                            ["acceptee", "confirmee"].includes(request.statut) && (
                              <button
                                type="button"
                                onClick={() =>
                                  setPayTarget({ request, participantId: participant.id })
                                }
                                className="text-[10px] font-black text-teal-600 underline underline-offset-2 hover:text-teal-800"
                              >
                                {t("Régler", "Pay")}
                              </button>
                            )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {request.statut === "acceptee" && mine?.statut === "invite" && (
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-gold/15 px-4 py-3">
                      <p className="text-xs font-semibold text-teal-800">
                        {t(
                          `Votre part de ${formatCurrency(mine.montant, lang)} est à régler pour confirmer la séance.`,
                          `Your ${formatCurrency(mine.montant, lang)} share is due to confirm the session.`,
                        )}
                      </p>
                      <Button size="sm" onClick={() => setPayTarget({ request })}>
                        <CreditCard className="h-3.5 w-3.5" />
                        {t("Payer ma part", "Pay my share")}
                      </Button>
                    </div>
                  )}

                  {request.statut === "en_attente" && (
                    <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-sand/60 px-3 py-1 text-[10px] font-semibold text-muted">
                      <Clock3 className="h-3 w-3" />
                      {t("En attente de la réponse du praticien", "Awaiting the practitioner's reply")}
                    </p>
                  )}

                  <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                    {!isCreator && mine?.statut === "invite" && request.statut === "acceptee" && (
                      <Button variant="ghost" size="sm" onClick={() => refusePart(request)}>
                        <X className="h-3.5 w-3.5" />
                        {t("Refuser", "Decline")}
                      </Button>
                    )}
                    {canCancel && (
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => setCancelTarget(request)}
                      >
                        {t("Annuler", "Cancel")}
                      </Button>
                    )}
                  </div>
                </article>
              );
            })
          )}
        </div>
      )}

      {tab === "past" && (
        <div className="space-y-3">
          {past.length === 0 ? (
            <EmptyState
              icon={Video}
              title={t("Aucune séance passée", "No past session")}
              description={t(
                "Vos séances terminées apparaîtront ici.",
                "Your completed sessions will appear here.",
              )}
            />
          ) : (
            past.map((session) => (
              <article key={session.id} className="card flex flex-col gap-3 p-5 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sand text-teal-600">
                    <Video className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-black text-ink">
                        {formatDate(session.date_debut, lang, "d MMMM yyyy")} ·{" "}
                        {formatTime(session.date_debut)}
                      </p>
                      <StatusBadge status={session.statut} />
                    </div>
                    <p className="mt-0.5 text-xs text-muted">
                      {session.therapeute?.nom_complet} · {session.type_session} ·{" "}
                      {formatCurrency(session.prix_final, lang)}
                    </p>
                    {session.participants?.length > 1 && (
                      <p className="mt-1 inline-flex items-center gap-1 text-[10px] text-muted">
                        <Users className="h-3 w-3" />
                        {session.participants.map((participant) => participant.nom).join(", ")}
                      </p>
                    )}
                  </div>
                </div>
                {session.statut === "terminee" && (
                  <Link
                    to={`/app/retours?seance=${session.id}`}
                    className={buttonClass({ variant: "outline", size: "sm" })}
                  >
                    <Star className="h-3.5 w-3.5" />
                    {t("Laisser un avis", "Leave a review")}
                  </Link>
                )}
              </article>
            ))
          )}
        </div>
      )}

      <Modal
        open={Boolean(payTarget)}
        onClose={() => setPayTarget(null)}
        title={t("Régler ma part", "Pay my share")}
        description={
          payTarget
            ? `${payTarget.request.therapeute?.nom_complet} · ${formatDateTime(
                payTarget.request.creneau?.date_heure_debut,
                lang,
              )}`
            : ""
        }
        footer={
          <>
            <Button variant="outline" onClick={() => setPayTarget(null)}>
              {t("Annuler", "Cancel")}
            </Button>
            <Button onClick={pay} loading={paying}>
              <CreditCard className="h-4 w-4" />
              {t("Confirmer le paiement", "Confirm payment")}
            </Button>
          </>
        }
      >
        {payTarget && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-sage-50 p-4">
              <p className="text-xs text-muted">{t("Montant à régler", "Amount due")}</p>
              <p className="mt-1 text-2xl font-black text-teal-600">
                {formatCurrency(
                  payTarget.participantId
                    ? payTarget.request.participants.find(
                        (participant) => participant.id === payTarget.participantId,
                      )?.montant || 0
                    : payTarget.request.ma_part?.montant || 0,
                  lang,
                )}
              </p>
            </div>
            <div className="space-y-2">
              {METHODS.map((item) => (
                <RadioCard
                  key={item.value}
                  selected={method === item.value}
                  onChange={() => setMethod(item.value)}
                  label={t(item.fr, item.en)}
                  description={t(item.descFr, item.descEn)}
                />
              ))}
            </div>
            <div className="flex items-start gap-2 rounded-2xl bg-sand/60 px-3 py-2.5">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-500" />
              <p className="text-[10px] leading-relaxed text-muted">
                {t(
                  "Paiement simulé à des fins de démonstration académique. Aucune donnée bancaire n'est stockée.",
                  "Simulated payment for this academic demonstration. No banking data is stored.",
                )}
              </p>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={Boolean(cancelTarget)}
        onClose={() => setCancelTarget(null)}
        title={t("Annuler cette demande ?", "Cancel this request?")}
        description={t(
          "Le créneau sera libéré pour d'autres patients.",
          "The slot will be released for other patients.",
        )}
        footer={
          <>
            <Button variant="outline" onClick={() => setCancelTarget(null)}>
              {t("Garder la séance", "Keep the session")}
            </Button>
            <Button variant="danger" onClick={cancel} loading={cancelling}>
              {t("Confirmer l'annulation", "Confirm cancellation")}
            </Button>
          </>
        }
      >
        <label className="label">{t("Motif (facultatif)", "Reason (optional)")}</label>
        <textarea
          className="textarea"
          rows={3}
          value={cancelMotif}
          onChange={(event) => setCancelMotif(event.target.value)}
          placeholder={t("Ex. imprévu familial", "E.g. family emergency")}
        />
        <p className="mt-2 text-[10px] leading-relaxed text-muted">
          {t(
            "Une annulation moins de 24 h avant la séance confirmée peut être refusée.",
            "Cancellation less than 24h before a confirmed session may be refused.",
          )}
        </p>
      </Modal>
    </div>
  );
}
