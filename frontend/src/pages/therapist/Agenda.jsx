import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Ban,
  CalendarDays,
  CalendarPlus,
  CalendarRange,
  Clock3,
  Info,
  Lock,
  Plus,
  Trash2,
  Unlock,
  Wand2,
} from "lucide-react";
import api, { extractError, getAll } from "../../lib/api";
import { useI18n } from "../../contexts/I18nContext";
import { useToast } from "../../contexts/ToastContext";
import { Badge, StatusBadge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Input, Select } from "../../components/ui/Field";
import { EmptyState, ErrorState, LoadingBlock } from "../../components/ui/Feedback";
import Modal from "../../components/ui/Modal";
import Tabs from "../../components/ui/Tabs";
import { dateKey, formatDate, formatDayLabel, formatTime } from "../../lib/format";

const WEEKDAYS = [
  { value: 0, fr: "Lundi", en: "Monday", shortFr: "Lun", shortEn: "Mon" },
  { value: 1, fr: "Mardi", en: "Tuesday", shortFr: "Mar", shortEn: "Tue" },
  { value: 2, fr: "Mercredi", en: "Wednesday", shortFr: "Mer", shortEn: "Wed" },
  { value: 3, fr: "Jeudi", en: "Thursday", shortFr: "Jeu", shortEn: "Thu" },
  { value: 4, fr: "Vendredi", en: "Friday", shortFr: "Ven", shortEn: "Fri" },
  { value: 5, fr: "Samedi", en: "Saturday", shortFr: "Sam", shortEn: "Sat" },
  { value: 6, fr: "Dimanche", en: "Sunday", shortFr: "Dim", shortEn: "Sun" },
];

function pad(value) {
  return String(value).padStart(2, "0");
}

function isoFromLocal(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}:00`;
}

function addDays(value, days) {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + days);
  return dateKey(date);
}

export default function Agenda() {
  const { t, lang } = useI18n();
  const { success, error: toastError } = useToast();
  const [slots, setSlots] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("upcoming");
  const [statusFilter, setStatusFilter] = useState("");
  const [busy, setBusy] = useState(null);

  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkForm, setBulkForm] = useState(() => ({
    date_debut: dateKey(new Date()),
    date_fin: addDays(dateKey(new Date()), 30),
    heure_debut: "09:00",
    duree: 60,
    pause: 10,
    jours: [0, 1, 2, 3, 4],
  }));

  const [slotOpen, setSlotOpen] = useState(false);
  const [slotSaving, setSlotSaving] = useState(false);
  const [slotForm, setSlotForm] = useState(() => ({
    date: addDays(dateKey(new Date()), 1),
    heure: "09:00",
    duree: 60,
  }));

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [slotList, profileResponse] = await Promise.all([
        getAll("/scheduling/slots/"),
        api.get("/accounts/therapist/me/").catch(() => ({ data: null })),
      ]);
      setSlots(slotList || []);
      setProfile(profileResponse.data);
    } catch (err) {
      setError(
        extractError(
          err,
          t("Impossible de charger votre agenda.", "Unable to load your calendar."),
        ),
      );
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!profile) return;
    setBulkForm((current) => ({
      ...current,
      duree: profile.duree_seance || current.duree,
      pause: profile.pause_entre_seances ?? current.pause,
    }));
    setSlotForm((current) => ({ ...current, duree: profile.duree_seance || current.duree }));
  }, [profile]);

  const now = Date.now();

  const grouped = useMemo(() => {
    const relevant = slots
      .filter((slot) => {
        const end = new Date(slot.date_heure_fin).getTime();
        if (tab === "upcoming" ? end < now : end >= now) return false;
        if (statusFilter && slot.statut !== statusFilter) return false;
        return true;
      })
      .sort((a, b) =>
        tab === "upcoming"
          ? new Date(a.date_heure_debut) - new Date(b.date_heure_debut)
          : new Date(b.date_heure_debut) - new Date(a.date_heure_debut),
      );

    const map = new Map();
    relevant.forEach((slot) => {
      const key = dateKey(slot.date_heure_debut);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(slot);
    });
    return [...map.entries()];
  }, [slots, tab, statusFilter, now]);

  const stats = useMemo(() => {
    const future = slots.filter((slot) => new Date(slot.date_heure_fin).getTime() >= now);
    return {
      libres: future.filter((slot) => slot.statut === "libre").length,
      reserves: future.filter((slot) => ["reserve", "en_attente"].includes(slot.statut)).length,
      bloques: future.filter((slot) => slot.statut === "bloque").length,
    };
  }, [slots, now]);

  const previewDays = useMemo(() => {
    if (!bulkForm.date_debut || !bulkForm.date_fin) return 0;
    const start = new Date(`${bulkForm.date_debut}T12:00:00`);
    const end = new Date(`${bulkForm.date_fin}T12:00:00`);
    if (end < start) return 0;
    let count = 0;
    const cursor = new Date(start);
    while (cursor <= end) {
      const weekday = (cursor.getDay() + 6) % 7;
      if (bulkForm.jours.includes(weekday)) count += 1;
      cursor.setDate(cursor.getDate() + 1);
    }
    return count;
  }, [bulkForm.date_debut, bulkForm.date_fin, bulkForm.jours]);

  function toggleDay(value) {
    setBulkForm((current) => ({
      ...current,
      jours: current.jours.includes(value)
        ? current.jours.filter((day) => day !== value)
        : [...current.jours, value].sort(),
    }));
  }

  async function submitBulk(event) {
    event.preventDefault();
    if (!bulkForm.jours.length) {
      toastError(t("Sélectionnez au moins un jour.", "Select at least one day."));
      return;
    }
    setBulkSaving(true);
    try {
      const { data } = await api.post("/scheduling/slots/bulk/", {
        date_debut: bulkForm.date_debut,
        date_fin: bulkForm.date_fin,
        heure_debut: bulkForm.heure_debut,
        duree: Number(bulkForm.duree),
        pause: Number(bulkForm.pause),
        jours: bulkForm.jours,
      });
      success(
        t(
          `${data.created} créneau(x) créé(s), ${data.skipped} ignoré(s).`,
          `${data.created} slot(s) created, ${data.skipped} skipped.`,
        ),
        { title: t("Agenda mis à jour", "Calendar updated") },
      );
      setBulkOpen(false);
      setTab("upcoming");
      load();
    } catch (err) {
      toastError(extractError(err, t("La génération a échoué.", "Generation failed.")));
    } finally {
      setBulkSaving(false);
    }
  }

  function slotBounds() {
    const start = new Date(`${slotForm.date}T${slotForm.heure}:00`);
    const end = new Date(start.getTime() + Number(slotForm.duree) * 60000);
    return { start, end };
  }

  async function submitSlot(event) {
    event.preventDefault();
    const { start, end } = slotBounds();
    if (Number.isNaN(start.getTime()) || end <= start) {
      toastError(t("Vérifiez la date et l'heure.", "Check the date and time."));
      return;
    }
    setSlotSaving(true);
    try {
      await api.post("/scheduling/slots/create/", {
        date_heure_debut: isoFromLocal(start),
        date_heure_fin: isoFromLocal(end),
      });
      success(t("Créneau ajouté.", "Slot added."), {
        title: t("Agenda mis à jour", "Calendar updated"),
      });
      setSlotOpen(false);
      setTab("upcoming");
      load();
    } catch (err) {
      toastError(extractError(err, t("Le créneau n'a pas pu être créé.", "The slot could not be created.")));
    } finally {
      setSlotSaving(false);
    }
  }

  async function toggleBlock(slot) {
    const action = slot.statut === "bloque" ? "unblock" : "block";
    setBusy(`${slot.id}-${action}`);
    try {
      await api.post(`/scheduling/slots/${slot.id}/${action}/`);
      success(
        action === "block"
          ? t("Créneau bloqué.", "Slot blocked.")
          : t("Créneau de nouveau disponible.", "Slot available again."),
      );
      load();
    } catch (err) {
      toastError(extractError(err));
    } finally {
      setBusy(null);
    }
  }

  async function removeSlot() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/scheduling/slots/${deleteTarget.id}/`);
      success(t("Créneau supprimé.", "Slot deleted."));
      setDeleteTarget(null);
      load();
    } catch (err) {
      toastError(extractError(err, t("Suppression impossible.", "Unable to delete.")));
    } finally {
      setDeleting(false);
    }
  }

  if (loading) return <LoadingBlock label={t("Chargement de votre agenda…", "Loading your calendar…")} />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const tabs = [
    { value: "upcoming", label: t("À venir", "Upcoming"), icon: CalendarDays },
    { value: "past", label: t("Historique", "History"), icon: CalendarRange },
  ];
  const previewEnd = slotBounds().end;

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="overline">{t("Mon agenda", "My calendar")}</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-ink sm:text-3xl">
            {t("Vos disponibilités", "Your availability")}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {t(
              "Ouvrez des créneaux, bloquez une pause et gardez la main sur votre semaine.",
              "Open slots, block a break and stay in control of your week.",
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setSlotOpen(true)}>
            <Plus className="h-4 w-4" />
            {t("Un créneau", "Single slot")}
          </Button>
          <Button size="sm" onClick={() => setBulkOpen(true)}>
            <Wand2 className="h-4 w-4" />
            {t("Générer mes créneaux", "Generate slots")}
          </Button>
        </div>
      </div>

      {profile && profile.statut !== "actif" && (
        <div className="flex items-start gap-2 rounded-2xl border border-warn/40 bg-warn/5 px-4 py-3">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-warn" />
          <p className="text-[11px] leading-relaxed text-muted">
            {t(
              "Votre compte professionnel n'est pas encore validé : la création de créneaux sera disponible après validation par l'administration.",
              "Your professional account is not validated yet: slot creation will be available after the administration validates it.",
            )}
          </p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="card flex items-center gap-3 p-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-success/10 text-success">
            <Unlock className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-muted">
              {t("Créneaux libres", "Open slots")}
            </p>
            <p className="text-lg font-black text-ink">{stats.libres}</p>
          </div>
        </div>
        <div className="card flex items-center gap-3 p-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-teal-500/10 text-teal-600">
            <CalendarDays className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-muted">
              {t("Engagés", "Committed")}
            </p>
            <p className="text-lg font-black text-ink">{stats.reserves}</p>
          </div>
        </div>
        <div className="card flex items-center gap-3 p-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sand text-teal-600">
            <Lock className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-muted">
              {t("Bloqués", "Blocked")}
            </p>
            <p className="text-lg font-black text-ink">{stats.bloques}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs tabs={tabs} value={tab} onChange={setTab} className="w-fit" />
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="input w-auto py-2.5 text-xs font-bold"
        >
          <option value="">{t("Tous les statuts", "All statuses")}</option>
          <option value="libre">{t("Libres", "Open")}</option>
          <option value="en_attente">{t("En attente", "Pending")}</option>
          <option value="reserve">{t("Réservés", "Booked")}</option>
          <option value="bloque">{t("Bloqués", "Blocked")}</option>
        </select>
      </div>

      {grouped.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title={
            tab === "upcoming"
              ? t("Aucun créneau à venir", "No upcoming slot")
              : t("Aucun créneau passé", "No past slot")
          }
          description={t(
            "Générez votre planning en quelques secondes ou ajoutez un créneau à la main.",
            "Generate your schedule in seconds or add a slot manually.",
          )}
          action={
            tab === "upcoming" ? (
              <Button onClick={() => setBulkOpen(true)}>
                <Wand2 className="h-4 w-4" />
                {t("Générer mes créneaux", "Generate slots")}
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="space-y-5">
          {grouped.map(([day, daySlots]) => (
            <section key={day} className="card overflow-hidden">
              <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line/70 bg-sage-50 px-5 py-3.5">
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-teal-500" />
                  <h2 className="text-sm font-black capitalize text-ink">
                    {formatDayLabel(daySlots[0].date_heure_debut, lang)}
                  </h2>
                  <span className="text-[10px] font-semibold text-muted">
                    {formatDate(daySlots[0].date_heure_debut, lang, "d MMMM yyyy")}
                  </span>
                </div>
                <Badge tone="sage">
                  {daySlots.length} {t("créneau(x)", "slot(s)")}
                </Badge>
              </header>
              <div className="divide-y divide-line/60">
                {daySlots.map((slot) => {
                  const editable = ["libre", "bloque"].includes(slot.statut);
                  return (
                    <div
                      key={slot.id}
                      className="flex flex-wrap items-center gap-3 px-4 py-3 transition hover:bg-sand/30"
                    >
                      <span className="flex h-11 w-20 shrink-0 flex-col items-center justify-center rounded-xl bg-white ring-1 ring-line">
                        <span className="text-sm font-black text-teal-700">
                          {formatTime(slot.date_heure_debut)}
                        </span>
                        <span className="text-[9px] font-semibold text-muted">
                          {formatTime(slot.date_heure_fin)}
                        </span>
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusBadge status={slot.statut} />
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-muted">
                            <Clock3 className="h-3 w-3" />
                            {slot.duree_minutes} min
                          </span>
                        </div>
                        <p className="mt-1 text-[10px] text-muted">
                          {slot.est_passe
                            ? t("Créneau passé", "Past slot")
                            : t("Prêt à être réservé", "Ready to be booked")}
                        </p>
                      </div>
                      {editable ? (
                        <div className="flex items-center gap-1.5">
                          <Button
                            size="sm"
                            variant={slot.statut === "bloque" ? "outline" : "ghost"}
                            loading={busy === `${slot.id}-block` || busy === `${slot.id}-unblock`}
                            onClick={() => toggleBlock(slot)}
                          >
                            {slot.statut === "bloque" ? (
                              <>
                                <Unlock className="h-3.5 w-3.5" />
                                {t("Débloquer", "Unblock")}
                              </>
                            ) : (
                              <>
                                <Ban className="h-3.5 w-3.5" />
                                {t("Bloquer", "Block")}
                              </>
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => setDeleteTarget(slot)}
                            aria-label={t("Supprimer", "Delete")}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <span className="text-[10px] font-semibold text-muted">
                          {slot.statut === "en_attente"
                            ? t("Demande en cours", "Request pending")
                            : t("Séance programmée", "Session scheduled")}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      <Modal
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        title={t("Générer mes créneaux", "Generate slots")}
        description={t(
          "Choisissez une période et vos jours de consultation. Les créneaux existants sont conservés.",
          "Choose a period and your consultation days. Existing slots are kept.",
        )}
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setBulkOpen(false)}>
              {t("Annuler", "Cancel")}
            </Button>
            <Button onClick={submitBulk} loading={bulkSaving}>
              <Wand2 className="h-4 w-4" />
              {t("Générer", "Generate")}
            </Button>
          </>
        }
      >
        <form onSubmit={submitBulk} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label={t("Du", "From")}
              name="date_debut"
              type="date"
              required
              value={bulkForm.date_debut}
              min={dateKey(new Date())}
              onChange={(event) =>
                setBulkForm((current) => ({ ...current, date_debut: event.target.value }))
              }
            />
            <Input
              label={t("Au", "To")}
              name="date_fin"
              type="date"
              required
              value={bulkForm.date_fin}
              min={bulkForm.date_debut}
              onChange={(event) =>
                setBulkForm((current) => ({ ...current, date_fin: event.target.value }))
              }
            />
            <Input
              label={t("Heure de début", "Start time")}
              name="heure_debut"
              type="time"
              required
              value={bulkForm.heure_debut}
              onChange={(event) =>
                setBulkForm((current) => ({ ...current, heure_debut: event.target.value }))
              }
            />
            <Select
              label={t("Durée d'une séance", "Session duration")}
              name="duree"
              value={bulkForm.duree}
              onChange={(event) =>
                setBulkForm((current) => ({ ...current, duree: Number(event.target.value) }))
              }
            >
              {[30, 45, 60, 75, 90, 120].map((value) => (
                <option key={value} value={value}>
                  {value} min
                </option>
              ))}
            </Select>
            <Select
              label={t("Pause entre deux séances", "Break between sessions")}
              name="pause"
              value={bulkForm.pause}
              onChange={(event) =>
                setBulkForm((current) => ({ ...current, pause: Number(event.target.value) }))
              }
              className="sm:col-span-2"
            >
              {[0, 5, 10, 15, 20, 30].map((value) => (
                <option key={value} value={value}>
                  {value} min
                </option>
              ))}
            </Select>
          </div>

          <div>
            <p className="label">{t("Jours de consultation", "Consultation days")}</p>
            <div className="flex flex-wrap gap-2">
              {WEEKDAYS.map((day) => {
                const active = bulkForm.jours.includes(day.value);
                return (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => toggleDay(day.value)}
                    className={
                      active
                        ? "rounded-full bg-teal-500 px-3.5 py-2 text-[11px] font-black text-cream"
                        : "rounded-full border border-line bg-white px-3.5 py-2 text-[11px] font-bold text-muted transition hover:border-teal-300 hover:text-teal-600"
                    }
                  >
                    {t(day.shortFr, day.shortEn)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-start gap-2 rounded-2xl bg-sage-50 px-4 py-3">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-teal-500" />
            <p className="text-[11px] leading-relaxed text-teal-900/75">
              {t(
                `${previewDays} jour(s) sélectionné(s). Les créneaux sont générés jusqu'à 19h00 et les créneaux passés sont ignorés.`,
                `${previewDays} day(s) selected. Slots are generated until 7:00 pm and past slots are skipped.`,
              )}
            </p>
          </div>
        </form>
      </Modal>

      <Modal
        open={slotOpen}
        onClose={() => setSlotOpen(false)}
        title={t("Ajouter un créneau", "Add a slot")}
        description={t(
          "Le créneau doit être dans le futur et ne pas chevaucher une disponibilité existante.",
          "The slot must be in the future and must not overlap an existing availability.",
        )}
        footer={
          <>
            <Button variant="outline" onClick={() => setSlotOpen(false)}>
              {t("Annuler", "Cancel")}
            </Button>
            <Button onClick={submitSlot} loading={slotSaving}>
              <CalendarPlus className="h-4 w-4" />
              {t("Ajouter", "Add")}
            </Button>
          </>
        }
      >
        <form onSubmit={submitSlot} className="space-y-3">
          <Input
            label={t("Date", "Date")}
            name="date"
            type="date"
            required
            min={dateKey(new Date())}
            value={slotForm.date}
            onChange={(event) => setSlotForm((current) => ({ ...current, date: event.target.value }))}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label={t("Heure", "Time")}
              name="heure"
              type="time"
              required
              value={slotForm.heure}
              onChange={(event) =>
                setSlotForm((current) => ({ ...current, heure: event.target.value }))
              }
            />
            <Select
              label={t("Durée", "Duration")}
              name="duree"
              value={slotForm.duree}
              onChange={(event) =>
                setSlotForm((current) => ({ ...current, duree: Number(event.target.value) }))
              }
            >
              {[30, 45, 60, 75, 90, 120].map((value) => (
                <option key={value} value={value}>
                  {value} min
                </option>
              ))}
            </Select>
          </div>
          <p className="rounded-2xl bg-sand/60 px-4 py-3 text-[11px] font-semibold text-muted">
            {t("Fin du créneau", "Slot end")} : {formatTime(previewEnd)}
          </p>
        </form>
      </Modal>

      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title={t("Supprimer ce créneau ?", "Delete this slot?")}
        description={
          deleteTarget
            ? `${formatDate(deleteTarget.date_heure_debut, lang, "EEEE d MMMM yyyy")} · ${formatTime(
                deleteTarget.date_heure_debut,
              )}`
            : ""
        }
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              {t("Conserver", "Keep")}
            </Button>
            <Button variant="danger" onClick={removeSlot} loading={deleting}>
              <Trash2 className="h-4 w-4" />
              {t("Supprimer", "Delete")}
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-muted">
          {t(
            "Le créneau sera définitivement retiré de votre agenda. Les patients ne pourront plus le réserver.",
            "The slot will be permanently removed from your calendar. Patients will no longer be able to book it.",
          )}
        </p>
      </Modal>
    </div>
  );
}
