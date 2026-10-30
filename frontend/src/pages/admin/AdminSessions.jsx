import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  Eye,
  PlayCircle,
  Search,
  Users,
  Video,
  Wallet,
  XCircle,
} from "lucide-react";
import api, { extractError, getAll } from "../../lib/api";
import { useI18n } from "../../contexts/I18nContext";
import { useToast } from "../../contexts/ToastContext";
import Avatar from "../../components/ui/Avatar";
import { Badge, StatusBadge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { EmptyState, ErrorState, LoadingBlock } from "../../components/ui/Feedback";
import { Input, Select } from "../../components/ui/Field";
import Modal from "../../components/ui/Modal";
import Pagination from "../../components/ui/Pagination";
import Tabs from "../../components/ui/Tabs";
import { formatCurrency, formatDate, formatDateTime, formatTime, toDate } from "../../lib/format";

const PAGE_SIZE = 15;

const TYPE_OPTIONS = [
  { value: "", fr: "Tous les formats", en: "All formats" },
  { value: "Individuel", fr: "Individuel", en: "Individual" },
  { value: "Couple", fr: "Couple", en: "Couple" },
  { value: "Famille", fr: "Famille", en: "Family" },
];

export default function AdminSessions() {
  const { t, lang } = useI18n();
  const { success, error: toastError } = useToast();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("all");
  const [type, setType] = useState("");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [joining, setJoining] = useState(false);

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
          t("Impossible de charger les séances.", "Unable to load sessions."),
        ),
      );
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(
    () => ({
      all: sessions.length,
      prevue: sessions.filter((item) => item.statut === "prevue").length,
      en_cours: sessions.filter((item) => item.statut === "en_cours").length,
      terminee: sessions.filter((item) => item.statut === "terminee").length,
      annulee: sessions.filter((item) => item.statut === "annulee").length,
    }),
    [sessions],
  );

  const stats = useMemo(() => {
    const now = new Date();
    return {
      upcoming: sessions.filter(
        (item) => toDate(item.date_debut) > now && item.statut !== "annulee",
      ).length,
      completed: counts.terminee,
      cancelled: counts.annulee,
      revenue: sessions
        .filter((item) => item.statut === "terminee")
        .reduce((sum, item) => sum + Number(item.prix_final || 0), 0),
    };
  }, [sessions, counts]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return sessions.filter((session) => {
      if (tab !== "all" && session.statut !== tab) return false;
      if (type && session.type_session !== type) return false;
      const start = toDate(session.date_debut);
      if (dateFrom && start && start < new Date(`${dateFrom}T00:00:00`)) return false;
      if (dateTo && start && start > new Date(`${dateTo}T23:59:59`)) return false;
      if (!query) return true;
      return [
        session.patient?.full_name,
        session.patient?.email,
        session.therapeute?.nom_complet,
        session.therapeute?.email,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [sessions, tab, type, dateFrom, dateTo, search]);

  useEffect(() => {
    setPage(1);
  }, [tab, type, dateFrom, dateTo, search]);

  const visible = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page],
  );

  async function join(session) {
    setJoining(true);
    try {
      const { data } = await api.post(`/scheduling/sessions/${session.id}/join/`);
      const link = data.lien_googlemeet || data.seance?.lien_googlemeet;
      if (link) window.open(link, "_blank", "noopener,noreferrer");
      success(t("La salle s'ouvre dans un nouvel onglet.", "The room is opening in a new tab."));
      await load();
    } catch (err) {
      toastError(extractError(err, t("Impossible de rejoindre la séance.", "Unable to join the session.")));
    } finally {
      setJoining(false);
    }
  }

  if (loading) return <LoadingBlock label={t("Chargement des séances…", "Loading sessions…")} />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const tabs = [
    { value: "all", label: t("Toutes", "All"), count: counts.all },
    { value: "prevue", label: t("Prévues", "Scheduled"), count: counts.prevue },
    { value: "en_cours", label: t("En cours", "In progress"), count: counts.en_cours },
    { value: "terminee", label: t("Terminées", "Completed"), count: counts.terminee },
    { value: "annulee", label: t("Annulées", "Cancelled"), count: counts.annulee },
  ];

  return (
    <div className="space-y-5">
      <div>
        <p className="overline">{t("Suivi clinique", "Clinical oversight")}</p>
        <h1 className="mt-1 text-2xl font-black tracking-tight text-ink sm:text-3xl">
          {t("Toutes les séances", "All sessions")}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {t(
            "Supervisez l'activité des praticiens, les formats de séance et les montants facturés.",
            "Monitor practitioner activity, session formats and billed amounts.",
          )}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="card flex items-center gap-3 p-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-teal-500/10 text-teal-600">
            <CalendarDays className="h-5 w-5" />
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
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-risk/10 text-risk">
            <XCircle className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-muted">
              {t("Annulées", "Cancelled")}
            </p>
            <p className="text-lg font-black text-ink">{stats.cancelled}</p>
          </div>
        </div>
        <div className="card flex items-center gap-3 p-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gold/25 text-teal-800">
            <Wallet className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-muted">
              {t("Valeur réalisée", "Realised value")}
            </p>
            <p className="text-sm font-black text-ink">{formatCurrency(stats.revenue, lang)}</p>
          </div>
        </div>
      </div>

      <Tabs tabs={tabs} value={tab} onChange={setTab} className="w-fit" />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Input
          label={t("Rechercher", "Search")}
          name="search"
          icon={Search}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t("Patient ou praticien…", "Patient or practitioner…")}
          className="sm:col-span-2"
        />
        <Select
          label={t("Format", "Format")}
          name="type"
          value={type}
          onChange={(event) => setType(event.target.value)}
        >
          {TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {t(option.fr, option.en)}
            </option>
          ))}
        </Select>
        <div className="grid grid-cols-2 gap-2">
          <Input
            label={t("Du", "From")}
            name="date_from"
            type="date"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
          />
          <Input
            label={t("Au", "To")}
            name="date_to"
            type="date"
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
          />
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={Video}
          title={t("Aucune séance trouvée", "No session found")}
          description={t(
            "Ajustez les filtres ou la recherche pour afficher d'autres séances.",
            "Adjust the filters or search to display other sessions.",
          )}
        />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t("Date", "Date")}</th>
                <th>{t("Patient", "Patient")}</th>
                <th>{t("Praticien", "Practitioner")}</th>
                <th>{t("Format", "Format")}</th>
                <th>{t("Participants", "Participants")}</th>
                <th>{t("Montant", "Amount")}</th>
                <th>{t("Statut", "Status")}</th>
                <th className="text-right">{t("Détails", "Details")}</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((session) => (
                <tr key={session.id}>
                  <td>
                    <p className="text-[11px] font-black text-ink">
                      {formatDate(session.date_debut, lang, "d MMM yyyy")}
                    </p>
                    <p className="text-[10px] text-muted">
                      {formatTime(session.date_debut)} – {formatTime(session.date_fin)}
                    </p>
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <Avatar src={session.patient?.avatar} name={session.patient?.full_name} size="xs" />
                      <div className="min-w-0">
                        <p className="truncate text-[11px] font-bold text-ink">
                          {session.patient?.full_name}
                        </p>
                        <p className="truncate text-[9px] text-muted">{session.patient?.email}</p>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <Avatar
                        src={session.therapeute?.avatar}
                        name={session.therapeute?.nom_complet}
                        size="xs"
                      />
                      <p className="truncate text-[11px] font-semibold text-ink">
                        {session.therapeute?.nom_complet}
                      </p>
                    </div>
                  </td>
                  <td>
                    <Badge tone="sage">{session.type_session}</Badge>
                  </td>
                  <td className="text-xs font-bold text-ink">
                    {(session.participants || []).length || 1}
                  </td>
                  <td className="text-xs font-black text-teal-600">
                    {formatCurrency(session.prix_final, lang)}
                  </td>
                  <td>
                    <StatusBadge status={session.statut} />
                  </td>
                  <td>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => setSelected(session)}
                        className="icon-btn"
                        aria-label={t("Voir le détail", "View details")}
                        title={t("Voir le détail", "View details")}
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination page={page} count={filtered.length} pageSize={PAGE_SIZE} onChange={setPage} />

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        size="lg"
        title={t("Détail de la séance", "Session details")}
        description={selected ? `${selected.patient?.full_name} · ${selected.therapeute?.nom_complet}` : ""}
        footer={
          <>
            <Button variant="outline" onClick={() => setSelected(null)}>
              {t("Fermer", "Close")}
            </Button>
            {selected?.can_join && (
              <Button onClick={() => join(selected)} loading={joining}>
                <PlayCircle className="h-4 w-4" />
                {t("Rejoindre la salle", "Join the room")}
              </Button>
            )}
          </>
        }
      >
        {selected && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={selected.statut} />
              <Badge tone="sage">{selected.type_session}</Badge>
              <Badge tone="neutral">{selected.fournisseur || "demo"}</Badge>
              {selected.a_note && (
                <Badge tone="success">{t("Note clinique", "Clinical note")}</Badge>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-sand/50 p-3.5">
                <p className="text-[10px] font-black uppercase tracking-wider text-muted">
                  {t("Date et horaire", "Date and time")}
                </p>
                <p className="mt-1 text-xs font-bold text-ink">
                  {formatDateTime(selected.date_debut, lang)}
                </p>
                <p className="text-[10px] text-muted">
                  {formatTime(selected.date_debut)} – {formatTime(selected.date_fin)}
                </p>
              </div>
              <div className="rounded-2xl bg-sand/50 p-3.5">
                <p className="text-[10px] font-black uppercase tracking-wider text-muted">
                  {t("Montant", "Amount")}
                </p>
                <p className="mt-1 text-xs font-black text-teal-600">
                  {formatCurrency(selected.prix_final, lang)}
                </p>
                <p className="text-[10px] text-muted">
                  {t("Référence séance", "Session reference")} #{selected.id}
                </p>
              </div>
            </div>

            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-muted">
                {t("Participants", "Participants")}
              </p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {(selected.participants || []).length === 0 && (
                  <p className="rounded-2xl bg-sand/50 px-3 py-3 text-[11px] text-muted">
                    {t("Aucun participant enregistré.", "No participant recorded.")}
                  </p>
                )}
                {(selected.participants || []).map((participant) => (
                  <div
                    key={participant.id}
                    className="flex items-center justify-between gap-2 rounded-2xl border border-line bg-white px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[11px] font-bold text-ink">
                        {participant.nom || participant.email}
                      </p>
                      <p className="truncate text-[9px] text-muted">{participant.email}</p>
                    </div>
                    <StatusBadge
                      status={participant.statut}
                      className="!px-1.5 !py-0.5 !text-[9px]"
                    />
                  </div>
                ))}
              </div>
            </div>

            {!selected.can_join && selected.statut === "prevue" && (
              <p className="inline-flex items-center gap-1.5 rounded-2xl bg-sand/60 px-3 py-2 text-[10px] text-muted">
                <Clock3 className="h-3.5 w-3.5" />
                {t(
                  "La salle s'ouvre 15 minutes avant le début de la séance.",
                  "The room opens 15 minutes before the session starts.",
                )}
              </p>
            )}

            {selected.notes && (
              <div className="rounded-2xl bg-sage-50 p-3.5">
                <p className="text-[10px] font-black uppercase tracking-wider text-teal-500">
                  {t("Notes de séance", "Session notes")}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-teal-900/80">{selected.notes}</p>
              </div>
            )}

            {selected.lien_googlemeet && (
              <p className="break-all rounded-2xl bg-white px-3 py-2 text-[10px] text-muted">
                <span className="font-bold text-ink">Google Meet :</span>{" "}
                {selected.lien_googlemeet}
              </p>
            )}

            <div className="flex items-center justify-between rounded-2xl border border-line bg-white px-3 py-2 text-[10px] text-muted">
              <span className="inline-flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-teal-500" />
                {t("Créée le", "Created on")} {formatDate(selected.date_creation, lang, "d MMM yyyy")}
              </span>
              <span className="font-bold text-ink">
                {(selected.participants || []).length || 1} {t("participant(s)", "participant(s)")}
              </span>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
