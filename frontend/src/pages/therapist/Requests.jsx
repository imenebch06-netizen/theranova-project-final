import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  CalendarClock,
  Check,
  CheckCircle2,
  Clock3,
  MessageCircle,
  Users,
  Wallet,
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
import { Textarea } from "../../components/ui/Field";
import { formatCurrency, formatDate, formatDateTime, formatTime, fromNow } from "../../lib/format";

const REFUSE_REASONS = [
  { fr: "Indisponibilité imprévue", en: "Unexpected unavailability" },
  { fr: "Urgence personnelle", en: "Personal emergency" },
  { fr: "Ce format ne correspond pas à votre pratique", en: "This format does not match your practice" },
  { fr: "Le créneau doit être déplacé", en: "The slot needs to be moved" },
];

export default function Requests() {
  const { t, lang } = useI18n();
  const { success, error: toastError } = useToast();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("pending");
  const [busy, setBusy] = useState(null);
  const [refuseTarget, setRefuseTarget] = useState(null);
  const [motif, setMotif] = useState("");
  const [refusing, setRefusing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const list = await getAll("/scheduling/requests/");
      setRequests(list || []);
    } catch (err) {
      setError(
        extractError(
          err,
          t("Impossible de charger les demandes.", "Unable to load requests."),
        ),
      );
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const groups = useMemo(
    () => ({
      pending: requests.filter((request) => request.statut === "en_attente"),
      active: requests.filter((request) => ["acceptee", "confirmee"].includes(request.statut)),
      history: requests.filter((request) =>
        ["refusee", "annulee", "expiree"].includes(request.statut),
      ),
    }),
    [requests],
  );

  const stats = useMemo(() => {
    const awaitingPayment = groups.active.filter((request) => request.statut === "acceptee");
    const totalToPay = awaitingPayment.reduce(
      (sum, request) => sum + Number(request.reste_a_payer || 0),
      0,
    );
    return {
      pending: groups.pending.length,
      awaitingPayment: awaitingPayment.length,
      confirmed: groups.active.filter((request) => request.statut === "confirmee").length,
      totalToPay,
    };
  }, [groups]);

  const list =
    tab === "pending" ? groups.pending : tab === "active" ? groups.active : groups.history;

  async function accept(request) {
    setBusy(`${request.id}-accept`);
    try {
      await api.post(`/scheduling/requests/${request.id}/accept/`);
      success(
        t(
          "Demande acceptée. Les participants ont été invités à régler leur part.",
          "Request accepted. Participants have been invited to pay their share.",
        ),
        { title: t("Demande acceptée", "Request accepted") },
      );
      setTab("active");
      load();
    } catch (err) {
      toastError(extractError(err, t("Action impossible.", "Action failed.")));
    } finally {
      setBusy(null);
    }
  }

  async function refuse() {
    if (!refuseTarget) return;
    setRefusing(true);
    try {
      await api.post(`/scheduling/requests/${refuseTarget.id}/refuse/`, { motif });
      success(t("Demande refusée et créneau libéré.", "Request declined and slot released."));
      setRefuseTarget(null);
      setMotif("");
      setTab("history");
      load();
    } catch (err) {
      toastError(extractError(err, t("Action impossible.", "Action failed.")));
    } finally {
      setRefusing(false);
    }
  }

  if (loading) return <LoadingBlock label={t("Chargement des demandes…", "Loading requests…")} />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const tabs = [
    { value: "pending", label: t("En attente", "Pending"), count: groups.pending.length, icon: Clock3 },
    { value: "active", label: t("Acceptées", "Accepted"), count: groups.active.length, icon: CheckCircle2 },
    { value: "history", label: t("Historique", "History"), count: groups.history.length, icon: CalendarClock },
  ];

  return (
    <div className="space-y-5">
      <div>
        <p className="overline">{t("Demandes de rendez-vous", "Appointment requests")}</p>
        <h1 className="mt-1 text-2xl font-black tracking-tight text-ink sm:text-3xl">
          {t("Répondre avec attention", "Respond with care")}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {t(
            "Acceptez, refusez et suivez le règlement des parts de chaque participant.",
            "Accept, decline and track each participant's payment.",
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
              {t("À traiter", "To review")}
            </p>
            <p className="text-lg font-black text-ink">{stats.pending}</p>
          </div>
        </div>
        <div className="card flex items-center gap-3 p-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gold/25 text-teal-700">
            <Wallet className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-muted">
              {t("En attente de paiement", "Awaiting payment")}
            </p>
            <p className="text-lg font-black text-ink">{stats.awaitingPayment}</p>
          </div>
        </div>
        <div className="card flex items-center gap-3 p-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-success/10 text-success">
            <CheckCircle2 className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-muted">
              {t("Confirmées", "Confirmed")}
            </p>
            <p className="text-lg font-black text-ink">{stats.confirmed}</p>
          </div>
        </div>
        <div className="card flex items-center gap-3 p-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sage-100 text-teal-600">
            <Users className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-muted">
              {t("Reste à percevoir", "Still to collect")}
            </p>
            <p className="text-sm font-black text-ink">{formatCurrency(stats.totalToPay, lang)}</p>
          </div>
        </div>
      </div>

      <Tabs tabs={tabs} value={tab} onChange={setTab} className="w-fit" />

      {list.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title={
            tab === "pending"
              ? t("Aucune demande en attente", "No pending request")
              : tab === "active"
                ? t("Aucune demande acceptée", "No accepted request")
                : t("Aucun historique", "No history")
          }
          description={t(
            "Les nouvelles demandes de vos patients apparaîtront ici.",
            "New requests from your patients will appear here.",
          )}
          action={
            <Link to="/pro/agenda" className={buttonClass({ variant: "outline" })}>
              {t("Voir mon agenda", "View my calendar")}
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {list.map((request) => {
            const participants = request.participants || [];
            const paid = participants.filter((item) => item.statut === "PAYE").length;
            const progress = participants.length
              ? Math.round((paid / participants.length) * 100)
              : 0;
            const isPending = request.statut === "en_attente";
            return (
              <article key={request.id} className="card overflow-hidden">
                <div className="grid gap-0 lg:grid-cols-[1fr_250px]">
                  <div className="p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <Avatar
                          src={request.patient?.avatar}
                          name={request.patient?.full_name}
                          size="md"
                        />
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-sm font-black text-ink">
                              {request.patient?.full_name}
                            </h2>
                            <StatusBadge status={request.statut} />
                            <Badge tone="sage">{request.type_session}</Badge>
                          </div>
                          <p className="mt-0.5 text-[11px] text-muted">
                            {request.patient?.email}
                          </p>
                          <p className="mt-1 inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted">
                            <span className="inline-flex items-center gap-1">
                              <CalendarClock className="h-3.5 w-3.5 text-teal-500" />
                              {formatDate(request.creneau?.date_heure_debut, lang, "EEEE d MMMM yyyy")}
                            </span>
                            <span>
                              · {formatTime(request.creneau?.date_heure_debut)} –{" "}
                              {formatTime(request.creneau?.date_heure_fin)}
                            </span>
                            <span>· {fromNow(request.creneau?.date_heure_debut, lang)}</span>
                          </p>
                        </div>
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
                          {t("part", "share")}
                        </p>
                      </div>
                    </div>

                    {request.message && (
                      <p className="mt-3 rounded-2xl bg-sand/50 px-3.5 py-2.5 text-[11px] leading-relaxed text-muted">
                        « {request.message} »
                      </p>
                    )}
                    {request.motif_refus && (
                      <p className="mt-2 text-[11px] font-semibold text-risk">
                        {t("Motif", "Reason")} : {request.motif_refus}
                      </p>
                    )}

                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      {participants.map((participant) => (
                        <div
                          key={participant.id}
                          className="flex items-center justify-between gap-2 rounded-2xl border border-line bg-white px-3 py-2"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-xs font-bold text-ink">
                              {participant.nom || participant.email}
                              {participant.est_createur && (
                                <span className="ml-1 text-[9px] font-black uppercase text-teal-500">
                                  {t("demandeur", "requester")}
                                </span>
                              )}
                            </p>
                            <p className="truncate text-[10px] text-muted">{participant.email}</p>
                          </div>
                          <div className="flex shrink-0 items-center gap-1.5">
                            <span className="text-[10px] font-black text-teal-700">
                              {formatCurrency(participant.montant, lang)}
                            </span>
                            <StatusBadge
                              status={participant.statut}
                              className="!px-1.5 !py-0.5 !text-[9px]"
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    {["acceptee", "confirmee"].includes(request.statut) && (
                      <div className="mt-4">
                        <div className="flex items-center justify-between text-[10px] font-bold text-muted">
                          <span>
                            {paid}/{participants.length} {t("parts réglées", "shares paid")}
                          </span>
                          <span>{progress}%</span>
                        </div>
                        <div className="mt-1 h-2 overflow-hidden rounded-full bg-sand">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-sage-400 to-teal-500 transition-all"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        {request.statut === "acceptee" && (
                          <p className="mt-2 text-[10px] text-muted">
                            {t(
                              `Reste ${formatCurrency(request.reste_a_payer, lang)} à percevoir avant la confirmation.`,
                              `${formatCurrency(request.reste_a_payer, lang)} still to collect before confirmation.`,
                            )}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col justify-center gap-2 border-t border-line/70 bg-cream/50 p-4 lg:border-l lg:border-t-0">
                    {isPending ? (
                      <>
                        <Button
                          onClick={() => accept(request)}
                          loading={busy === `${request.id}-accept`}
                        >
                          <Check className="h-4 w-4" />
                          {t("Accepter", "Accept")}
                        </Button>
                        <Button variant="danger" onClick={() => setRefuseTarget(request)}>
                          <X className="h-4 w-4" />
                          {t("Refuser", "Decline")}
                        </Button>
                        <p className="text-center text-[10px] leading-relaxed text-muted">
                          {t(
                            "L'acceptation ouvre le paiement des parts.",
                            "Accepting opens the payment of shares.",
                          )}
                        </p>
                      </>
                    ) : (
                      <>
                        <Link
                          to="/pro/messages"
                          className={buttonClass({ variant: "outline", size: "sm", className: "w-full" })}
                        >
                          <MessageCircle className="h-3.5 w-3.5" />
                          {t("Écrire au patient", "Message the patient")}
                        </Link>
                        <Link
                          to="/pro/seances"
                          className={buttonClass({ variant: "ghost", size: "sm", className: "w-full" })}
                        >
                          {t("Voir les séances", "View sessions")}
                        </Link>
                        <p className="text-center text-[10px] leading-relaxed text-muted">
                          {request.statut === "confirmee"
                            ? t("Séance confirmée et payée.", "Session confirmed and paid.")
                            : t("En attente du règlement des parts.", "Awaiting share payments.")}
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Modal
        open={Boolean(refuseTarget)}
        onClose={() => setRefuseTarget(null)}
        title={t("Refuser cette demande ?", "Decline this request?")}
        description={
          refuseTarget
            ? `${refuseTarget.patient?.full_name} · ${formatDateTime(
                refuseTarget.creneau?.date_heure_debut,
                lang,
              )}`
            : ""
        }
        footer={
          <>
            <Button variant="outline" onClick={() => setRefuseTarget(null)}>
              {t("Annuler", "Cancel")}
            </Button>
            <Button variant="danger" onClick={refuse} loading={refusing}>
              <X className="h-4 w-4" />
              {t("Confirmer le refus", "Confirm decline")}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {REFUSE_REASONS.map((reason) => (
              <button
                key={reason.fr}
                type="button"
                onClick={() => setMotif(t(reason.fr, reason.en))}
                className={
                  motif === t(reason.fr, reason.en)
                    ? "chip border-transparent bg-teal-500 text-cream"
                    : "chip hover:border-teal-300"
                }
              >
                {t(reason.fr, reason.en)}
              </button>
            ))}
          </div>
          <Textarea
            label={t("Motif communiqué au patient", "Reason shared with the patient")}
            name="motif"
            rows={4}
            maxLength={255}
            value={motif}
            onChange={(event) => setMotif(event.target.value)}
            placeholder={t(
              "Expliquez brièvement et proposez une alternative si possible.",
              "Explain briefly and suggest an alternative if possible.",
            )}
          />
          <p className="rounded-2xl bg-sand/60 px-3.5 py-2.5 text-[10px] leading-relaxed text-muted">
            {t(
              "Le créneau sera immédiatement remis à disposition des autres patients.",
              "The slot will immediately be made available to other patients.",
            )}
          </p>
        </div>
      </Modal>
    </div>
  );
}
