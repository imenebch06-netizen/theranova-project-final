import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  CalendarDays,
  Check,
  CreditCard,
  Info,
  Mail,
  MapPin,
  Search,
  Sparkles,
  Star,
  Trash2,
  UserPlus,
  Users,
  Video,
  Wallet,
} from "lucide-react";
import clsx from "clsx";
import api, { extractError, getAll } from "../../lib/api";
import { useI18n } from "../../contexts/I18nContext";
import { useToast } from "../../contexts/ToastContext";
import Avatar from "../../components/ui/Avatar";
import { Badge } from "../../components/ui/Badge";
import { Button, buttonClass } from "../../components/ui/Button";
import { EmptyState, ErrorState, LoadingBlock } from "../../components/ui/Feedback";
import { Input, RadioCard, Textarea } from "../../components/ui/Field";
import {
  dateKey,
  formatCurrency,
  formatDate,
  formatDayLabel,
  formatTime,
} from "../../lib/format";

const TYPES = [
  {
    value: "Individuel",
    fr: "Individuel",
    en: "Individual",
    capacity: 1,
    factor: 1,
    descFr: "Un face-à-face confidentiel avec votre praticien.",
    descEn: "A confidential one-to-one session with your practitioner.",
  },
  {
    value: "Couple",
    fr: "Couple",
    en: "Couples",
    capacity: 2,
    factor: 1.6,
    descFr: "Deux personnes, un espace pour dialoguer.",
    descEn: "Two people, a space to talk things through.",
  },
  {
    value: "Famille",
    fr: "Famille",
    en: "Family",
    capacity: 5,
    factor: 2.2,
    descFr: "Jusqu'à cinq personnes d'une même famille.",
    descEn: "Up to five people from the same family.",
  },
];

function money(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

export default function Book() {
  const { t, lang } = useI18n();
  const { success, error: toastError } = useToast();
  const [params, setParams] = useSearchParams();
  const therapistParam = params.get("therapeute");
  const slotParam = params.get("creneau");

  const [therapists, setTherapists] = useState([]);
  const [directoryLoading, setDirectoryLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [therapist, setTherapist] = useState(null);
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(Boolean(therapistParam));
  const [error, setError] = useState("");

  const [activeDay, setActiveDay] = useState("");
  const [slotId, setSlotId] = useState(slotParam ? Number(slotParam) : null);
  const [type, setType] = useState("Individuel");
  const [invites, setInvites] = useState([{ email: "", nom: "" }]);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [result, setResult] = useState(null);

  const loadDirectory = useCallback(async () => {
    setDirectoryLoading(true);
    try {
      const list = await getAll("/accounts/therapists/", { ordering: "-note_globale" });
      setTherapists(list || []);
    } catch {
      setTherapists([]);
    } finally {
      setDirectoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!therapistParam) loadDirectory();
  }, [therapistParam, loadDirectory]);

  useEffect(() => {
    if (!therapistParam) {
      setTherapist(null);
      setSlots([]);
      return undefined;
    }
    let active = true;
    setLoading(true);
    setError("");
    Promise.allSettled([
      api.get(`/accounts/therapists/${therapistParam}/`),
      api.get(`/scheduling/availability/${therapistParam}/`, { params: { days: 30 } }),
    ]).then(([detail, availability]) => {
      if (!active) return;
      if (detail.status === "fulfilled") setTherapist(detail.value.data);
      else {
        setError(t("Ce praticien est introuvable.", "This practitioner cannot be found."));
        setLoading(false);
        return;
      }
      if (availability.status === "fulfilled") {
        const nextSlots = availability.value.data.slots || [];
        setSlots(nextSlots);
        const preselected = nextSlots.find((slot) => String(slot.id) === String(slotParam));
        const first = preselected || nextSlots[0];
        if (first) {
          setActiveDay(dateKey(first.date_heure_debut));
          setSlotId((current) => current || first.id);
        }
      }
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [therapistParam, slotParam, t]);

  useEffect(() => {
    setSlotId(slotParam ? Number(slotParam) : null);
    setType("Individuel");
    setInvites([{ email: "", nom: "" }]);
    setMessage("");
    setFormError("");
    setResult(null);
  }, [therapistParam, slotParam]);

  const grouped = useMemo(() => {
    const map = new Map();
    slots.forEach((slot) => {
      const key = dateKey(slot.date_heure_debut);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(slot);
    });
    return [...map.entries()];
  }, [slots]);

  const activeSlots = useMemo(
    () => grouped.find(([key]) => key === activeDay)?.[1] || [],
    [grouped, activeDay],
  );

  const selectedSlot = useMemo(
    () => slots.find((slot) => slot.id === slotId) || null,
    [slots, slotId],
  );

  const typeConfig = TYPES.find((item) => item.value === type) || TYPES[0];
  const basePrice = Number(therapist?.tarif_seance || 0);
  const total = money(basePrice * typeConfig.factor);
  const invitedCount = typeConfig.capacity === 1 ? 0 : invites.length;
  const participantsCount = 1 + invitedCount;
  const share = participantsCount ? money(total / participantsCount) : total;

  const filteredTherapists = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return therapists;
    return therapists.filter((item) => {
      const specialties = (item.specialites || [])
        .map((specialty) => `${specialty.nom} ${specialty.nom_en || ""}`)
        .join(" ");
      return `${item.nom_complet} ${item.ville || ""} ${specialties}`.toLowerCase().includes(query);
    });
  }, [therapists, search]);

  function setTherapistParam(id) {
    const next = new URLSearchParams();
    if (id) next.set("therapeute", id);
    setParams(next, { replace: true });
  }

  function chooseType(value) {
    setType(value);
    setFormError("");
    const config = TYPES.find((item) => item.value === value);
    if (config && config.capacity > 1) {
      setInvites((current) => (current.length ? current : [{ email: "", nom: "" }]));
    } else {
      setInvites([]);
    }
  }

  function updateInvite(index, field, value) {
    setInvites((current) =>
      current.map((invite, position) =>
        position === index ? { ...invite, [field]: value } : invite,
      ),
    );
  }

  function addInvite() {
    const maximum = typeConfig.capacity - 1;
    if (invites.length >= maximum) return;
    setInvites((current) => [...current, { email: "", nom: "" }]);
  }

  function removeInvite(index) {
    setInvites((current) => current.filter((_, position) => position !== index));
  }

  function validate() {
    if (!selectedSlot) return t("Choisissez d'abord un créneau.", "Please choose a slot first.");
    if (type !== "Individuel") {
      if (invites.length < 1) {
        return t(
          "Ajoutez au moins un participant pour ce format de séance.",
          "Add at least one participant for this session format.",
        );
      }
      const emails = invites.map((invite) => invite.email.trim().toLowerCase());
      if (emails.some((email) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
        return t("Chaque participant doit avoir un email valide.", "Every participant needs a valid email.");
      }
      if (new Set(emails).size !== emails.length) {
        return t("Chaque participant doit avoir un email unique.", "Every participant needs a unique email.");
      }
    }
    return "";
  }

  async function submit() {
    const invalid = validate();
    if (invalid) {
      setFormError(invalid);
      return;
    }
    setSubmitting(true);
    setFormError("");
    try {
      const payload = {
        creneau: selectedSlot.id,
        type_session: type,
        message: message.trim(),
        participants:
          type === "Individuel"
            ? []
            : invites.map((invite) => ({
                email: invite.email.trim().toLowerCase(),
                nom: invite.nom.trim(),
              })),
      };
      const { data } = await api.post("/scheduling/requests/", payload);
      setResult(data);
      success(
        t(
          "Votre demande a été transmise au praticien.",
          "Your request has been sent to the practitioner.",
        ),
        { title: t("Demande envoyée", "Request sent") },
      );
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      const text = extractError(
        err,
        t("La demande n'a pas pu être envoyée.", "The request could not be sent."),
      );
      setFormError(text);
      toastError(text);
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    const participants = result.participants || [];
    return (
      <div className="mx-auto max-w-3xl space-y-5">
        <div className="card overflow-hidden">
          <div className="relative bg-teal-500 px-6 py-10 text-center text-cream sm:px-10">
            <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-teal-400/30 blur-2xl" />
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-cream text-teal-600">
              <Check className="h-7 w-7" />
            </span>
            <h1 className="mt-4 text-2xl font-black text-cream sm:text-3xl">
              {t("Demande envoyée !", "Request sent!")}
            </h1>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-cream/70">
              {t(
                "Le praticien dispose de 48 heures pour accepter votre demande. Vous recevrez une notification dès sa réponse.",
                "The practitioner has 48 hours to accept your request. You will be notified as soon as they reply.",
              )}
            </p>
          </div>
          <div className="space-y-4 p-6">
            <div className="flex items-center gap-3 rounded-2xl bg-sage-50 p-4">
              <Avatar
                src={result.therapeute?.avatar}
                name={result.therapeute?.nom_complet}
                size="md"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-black text-ink">{result.therapeute?.nom_complet}</p>
                <p className="text-xs text-muted">
                  {formatDate(result.creneau?.date_heure_debut, lang, "EEEE d MMMM yyyy")} ·{" "}
                  {formatTime(result.creneau?.date_heure_debut)}
                </p>
              </div>
              <Badge tone="warn">{t("En attente", "Pending")}</Badge>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-line bg-white px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-wider text-muted">
                  {t("Format", "Format")}
                </p>
                <p className="mt-1 text-sm font-bold text-ink">{result.type_session}</p>
              </div>
              <div className="rounded-2xl border border-line bg-white px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-wider text-muted">
                  {t("Total", "Total")}
                </p>
                <p className="mt-1 text-sm font-bold text-ink">
                  {formatCurrency(result.prix_total, lang)}
                </p>
              </div>
              <div className="rounded-2xl border border-line bg-white px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-wider text-muted">
                  {t("Part par personne", "Share per person")}
                </p>
                <p className="mt-1 text-sm font-bold text-ink">
                  {formatCurrency(result.prix_par_participant, lang)}
                </p>
              </div>
            </div>

            <div>
              <p className="text-xs font-black uppercase tracking-wider text-muted">
                {t("Participants", "Participants")}
              </p>
              <div className="mt-2 space-y-2">
                {participants.map((participant) => (
                  <div
                    key={participant.id}
                    className="flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-ink">
                        {participant.nom || participant.email}
                        {participant.est_createur && (
                          <span className="ml-2 text-[10px] font-semibold text-teal-500">
                            {t("vous", "you")}
                          </span>
                        )}
                      </p>
                      <p className="truncate text-[10px] text-muted">{participant.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-teal-600">
                        {formatCurrency(participant.montant, lang)}
                      </span>
                      <Badge tone={participant.statut === "PAYE" ? "success" : "warn"}>
                        {participant.statut === "PAYE" ? t("Payé", "Paid") : t("À régler", "To pay")}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl bg-sand/60 p-4">
              <p className="flex items-start gap-2 text-[11px] leading-relaxed text-muted">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-500" />
                {t(
                  "Le paiement n'est demandé qu'après l'acceptation du praticien. Chaque participant règle sa part depuis son espace.",
                  "Payment is only requested after the practitioner accepts. Each participant pays their share from their own space.",
                )}
              </p>
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              <Link to="/app/seances" className={buttonClass({ variant: "outline" })}>
                {t("Mes demandes", "My requests")}
              </Link>
              <Link to="/app" className={buttonClass({ variant: "primary" })}>
                {t("Retour au tableau de bord", "Back to dashboard")}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!therapistParam) {
    return (
      <div className="space-y-5">
        <div>
          <p className="overline">{t("Prendre rendez-vous", "Book a session")}</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-ink sm:text-3xl">
            {t("Avec qui souhaitez-vous échanger ?", "Who would you like to talk to?")}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {t(
              "Choisissez un praticien pour voir ses disponibilités et réserver votre séance.",
              "Choose a practitioner to see their availability and book your session.",
            )}
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("Nom, spécialité, ville…", "Name, specialty, city…")}
              className="input pl-11"
            />
          </div>
          <Link to="/app/questionnaire" className={buttonClass({ variant: "outline" })}>
            <Sparkles className="h-4 w-4" />
            {t("Être guidé", "Get guidance")}
          </Link>
        </div>

        {directoryLoading ? (
          <LoadingBlock label={t("Chargement des praticiens…", "Loading practitioners…")} />
        ) : filteredTherapists.length === 0 ? (
          <EmptyState
            icon={Users}
            title={t("Aucun praticien trouvé", "No practitioner found")}
            description={t(
              "Modifiez votre recherche ou explorez l'annuaire complet.",
              "Change your search or browse the full directory.",
            )}
            action={
              <Link to="/therapeutes" className={buttonClass()}>
                {t("Voir l'annuaire", "Browse directory")}
              </Link>
            }
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {filteredTherapists.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTherapistParam(item.id)}
                className="card flex items-center gap-4 p-4 text-left transition hover:-translate-y-0.5 hover:shadow-soft"
              >
                <Avatar src={item.user?.avatar} name={item.nom_complet} size="lg" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black text-ink">{item.nom_complet}</p>
                  <p className="mt-0.5 truncate text-[11px] text-muted">
                    {(item.specialites || [])
                      .map((specialty) =>
                        lang === "en" && specialty.nom_en ? specialty.nom_en : specialty.nom,
                      )
                      .join(" · ")}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted">
                    <span className="inline-flex items-center gap-1">
                      <Star className="h-3 w-3 fill-gold text-gold" />
                      {Number(item.note_globale || 0).toFixed(1)}
                    </span>
                    {item.ville && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {item.ville}
                      </span>
                    )}
                    <span className="font-bold text-teal-600">
                      {formatCurrency(item.tarif_seance, lang)}
                    </span>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-teal-500" />
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (loading) return <LoadingBlock label={t("Chargement des disponibilités…", "Loading availability…")} />;
  if (error || !therapist) return <ErrorState message={error} />;

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="overline">{t("Réservation", "Booking")}</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-ink sm:text-3xl">
            {t("Réservez votre séance", "Book your session")}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {t(
              "Le praticien confirme la demande avant tout paiement.",
              "The practitioner confirms the request before any payment.",
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setTherapistParam(null)}
          className="text-xs font-bold text-teal-600 hover:text-teal-800"
        >
          {t("Changer de praticien", "Change practitioner")}
        </button>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          <section className="card p-5">
            <div className="flex items-center gap-4">
              <Avatar
                src={therapist.user?.avatar}
                name={therapist.nom_complet}
                size="lg"
                ring
              />
              <div className="min-w-0 flex-1">
                <p className="text-base font-black text-ink">{therapist.nom_complet}</p>
                <p className="mt-0.5 text-xs text-muted">
                  {(therapist.specialites || [])
                    .map((specialty) =>
                      lang === "en" && specialty.nom_en ? specialty.nom_en : specialty.nom,
                    )
                    .join(" · ")}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted">
                  <span className="inline-flex items-center gap-1">
                    <Star className="h-3 w-3 fill-gold text-gold" />
                    {Number(therapist.note_globale || 0).toFixed(1)} ({therapist.nombre_avis || 0})
                  </span>
                  {therapist.ville && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {therapist.ville}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1">
                    <Video className="h-3 w-3" />
                    {therapist.duree_seance || 60} min
                  </span>
                </div>
              </div>
              <Link
                to={`/therapeutes/${therapist.id}`}
                className="hidden text-[11px] font-bold text-teal-600 hover:text-teal-800 sm:inline"
              >
                {t("Voir le profil", "View profile")}
              </Link>
            </div>
          </section>

          <section className="card p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="inline-flex items-center gap-2 text-base font-black text-ink">
                  <CalendarDays className="h-4 w-4 text-teal-500" />
                  {t("Choisissez un créneau", "Choose a slot")}
                </h2>
                <p className="mt-1 text-xs text-muted">
                  {t("Heure d'Alger · visioconférence sécurisée", "Algiers time · secure video call")}
                </p>
              </div>
              <Badge tone="sage">
                {slots.length} {t("libres", "available")}
              </Badge>
            </div>

            {grouped.length === 0 ? (
              <div className="mt-4">
                <EmptyState
                  icon={CalendarDays}
                  title={t("Aucun créneau disponible", "No slots available")}
                  description={t(
                    "Ce praticien n'a pas publié de disponibilité dans les 30 prochains jours. Essayez un autre profil.",
                    "This practitioner has no availability in the next 30 days. Try another profile.",
                  )}
                  action={
                    <button
                      type="button"
                      onClick={() => setTherapistParam(null)}
                      className={buttonClass({ variant: "outline" })}
                    >
                      {t("Voir d'autres praticiens", "See other practitioners")}
                    </button>
                  }
                />
              </div>
            ) : (
              <>
                <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto pb-1">
                  {grouped.slice(0, 20).map(([key, daySlots]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setActiveDay(key);
                        setSlotId(daySlots[0].id);
                      }}
                      className={clsx(
                        "min-w-[92px] shrink-0 rounded-2xl border px-3 py-2.5 text-center transition",
                        activeDay === key
                          ? "border-teal-500 bg-teal-500 text-cream"
                          : "border-line bg-white text-teal-700 hover:border-sage-400",
                      )}
                    >
                      <span className="block text-[10px] font-black uppercase tracking-wider opacity-70">
                        {formatDayLabel(daySlots[0].date_heure_debut, lang)}
                      </span>
                      <span className="mt-0.5 block text-xs font-black">
                        {formatDate(daySlots[0].date_heure_debut, lang, "d MMMM")}
                      </span>
                      <span className="mt-0.5 block text-[10px] font-semibold opacity-70">
                        {daySlots.length} {t("créneaux", "slots")}
                      </span>
                    </button>
                  ))}
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-5">
                  {activeSlots.map((slot) => (
                    <button
                      key={slot.id}
                      type="button"
                      onClick={() => setSlotId(slot.id)}
                      className={clsx(
                        "rounded-2xl border px-3 py-2.5 text-sm font-bold transition",
                        slotId === slot.id
                          ? "border-teal-500 bg-sage-50 text-teal-700 ring-2 ring-teal-500/15"
                          : "border-line bg-white text-ink hover:border-sage-400",
                      )}
                    >
                      {formatTime(slot.date_heure_debut)}
                      <span className="mt-0.5 block text-[10px] font-semibold text-muted">
                        {slot.duree_minutes || 60} min
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </section>

          <section className="card p-5">
            <h2 className="inline-flex items-center gap-2 text-base font-black text-ink">
              <Users className="h-4 w-4 text-teal-500" />
              {t("Format de la séance", "Session format")}
            </h2>
            <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
              {TYPES.map((item) => (
                <RadioCard
                  key={item.value}
                  selected={type === item.value}
                  onChange={() => chooseType(item.value)}
                  label={t(item.fr, item.en)}
                  description={t(item.descFr, item.descEn)}
                />
              ))}
            </div>

            {type !== "Individuel" && (
              <div className="mt-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-ink">
                      {t("Participants invités", "Invited participants")}
                    </p>
                    <p className="text-[11px] text-muted">
                      {t(
                        `Vous + ${invites.length} invité(s) · ${participantsCount}/${typeConfig.capacity} places`,
                        `You + ${invites.length} guest(s) · ${participantsCount}/${typeConfig.capacity} seats`,
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addInvite}
                    disabled={invites.length >= typeConfig.capacity - 1}
                    className="btn-outline btn-sm disabled:opacity-40"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    {t("Ajouter", "Add")}
                  </button>
                </div>

                <div className="mt-3 space-y-2">
                  {invites.map((invite, index) => (
                    <div
                      key={index}
                      className="grid gap-2 rounded-2xl border border-line bg-white p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
                    >
                      <Input
                        label={t("Nom", "Name")}
                        name={`invite-name-${index}`}
                        value={invite.nom}
                        onChange={(event) => updateInvite(index, "nom", event.target.value)}
                        placeholder={t("Prénom du participant", "Participant's name")}
                      />
                      <Input
                        label={t("Email", "Email")}
                        name={`invite-email-${index}`}
                        type="email"
                        required
                        value={invite.email}
                        onChange={(event) => updateInvite(index, "email", event.target.value)}
                        placeholder="participant@email.dz"
                        icon={Mail}
                      />
                      {invites.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeInvite(index)}
                          className="icon-btn mb-1 text-risk"
                          aria-label={t("Retirer", "Remove")}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-[10px] text-muted">
                  {t(
                    "Chaque invité reçoit sa propre part à régler. Un email déjà inscrit est automatiquement rattaché à son compte.",
                    "Each guest pays their own share. An email already registered is automatically linked to their account.",
                  )}
                </p>
              </div>
            )}
          </section>

          <section className="card p-5">
            <Textarea
              label={t("Message au praticien (facultatif)", "Message to the practitioner (optional)")}
              name="message"
              rows={4}
              value={message}
              maxLength={2000}
              onChange={(event) => setMessage(event.target.value)}
              placeholder={t(
                "Quelques mots sur ce qui vous amène, sans entrer dans les détails sensibles.",
                "A few words about what brings you here, without sensitive details.",
              )}
            />
            <p className="mt-1.5 text-[10px] text-muted">
              {message.length}/2000
            </p>
          </section>

          {formError && (
            <div className="rounded-2xl border border-risk/20 bg-risk/5 px-4 py-3 text-sm font-semibold text-risk">
              {formError}
            </div>
          )}
        </div>

        <aside>
          <div className="card sticky top-24 overflow-hidden">
            <div className="bg-teal-500 px-5 py-5 text-cream">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-sage-300">
                {t("Récapitulatif", "Summary")}
              </p>
              <p className="mt-2 text-2xl font-black">{formatCurrency(total, lang)}</p>
              <p className="mt-1 text-[11px] text-cream/65">
                {t("Prix total de la séance", "Total session price")}
              </p>
            </div>
            <div className="space-y-3 p-5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted">{t("Praticien", "Practitioner")}</span>
                <span className="font-bold text-ink">{therapist.nom_complet}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted">{t("Créneau", "Slot")}</span>
                <span className="font-bold text-ink">
                  {selectedSlot
                    ? `${formatDate(selectedSlot.date_heure_debut, lang, "d MMM")} · ${formatTime(
                        selectedSlot.date_heure_debut,
                      )}`
                    : t("À choisir", "To choose")}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted">{t("Format", "Format")}</span>
                <span className="font-bold text-ink">{t(typeConfig.fr, typeConfig.en)}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted">{t("Participants", "Participants")}</span>
                <span className="font-bold text-ink">{participantsCount}</span>
              </div>
              <div className="divider" />
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted">{t("Votre part", "Your share")}</span>
                <span className="text-base font-black text-teal-600">{formatCurrency(share, lang)}</span>
              </div>
              <div className="flex items-start gap-2 rounded-2xl bg-sand/60 px-3 py-2.5">
                <Wallet className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-500" />
                <p className="text-[10px] leading-relaxed text-muted">
                  {t(
                    "Aucun débit maintenant. Vous réglerez après acceptation, par BaridiMob, Edahabia, CIB ou crédit.",
                    "No charge now. You will pay after acceptance via BaridiMob, Edahabia, CIB or credit.",
                  )}
                </p>
              </div>
              <Button
                onClick={submit}
                loading={submitting}
                disabled={!selectedSlot}
                className="w-full"
              >
                <CreditCard className="h-4 w-4" />
                {t("Envoyer ma demande", "Send my request")}
              </Button>
              <p className="text-center text-[10px] leading-relaxed text-muted">
                {t(
                  "Annulation gratuite jusqu'à 24 h avant la séance.",
                  "Free cancellation up to 24h before the session.",
                )}
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
