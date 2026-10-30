import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  CalendarClock,
  FolderHeart,
  HeartPulse,
  Search,
  Stethoscope,
  UserRound,
  Users,
} from "lucide-react";
import api, { extractError, getAll } from "../../lib/api";
import { useI18n } from "../../contexts/I18nContext";
import { useToast } from "../../contexts/ToastContext";
import Avatar from "../../components/ui/Avatar";
import { Badge } from "../../components/ui/Badge";
import { Button, buttonClass } from "../../components/ui/Button";
import { EmptyState, ErrorState, LoadingBlock } from "../../components/ui/Feedback";
import { formatDate } from "../../lib/format";

export default function TherapistPatients() {
  const { t, lang } = useI18n();
  const { success, error: toastError } = useToast();
  const [patients, setPatients] = useState([]);
  const [dossiers, setDossiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [patientList, dossierList] = await Promise.all([
        getAll("/accounts/therapist/patients/"),
        getAll("/clinical/dossiers/"),
      ]);
      setPatients(patientList || []);
      setDossiers(dossierList || []);
    } catch (err) {
      setError(
        extractError(
          err,
          t("Impossible de charger vos patients.", "Unable to load your patients."),
        ),
      );
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const byPatient = useMemo(() => {
    const map = new Map();
    dossiers.forEach((dossier) => {
      const key = dossier.patient?.user_id;
      if (key) map.set(key, dossier);
    });
    return map;
  }, [dossiers]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return patients.filter((patient) => {
      const dossier = byPatient.get(patient.user?.id);
      if (filter === "with" && !dossier) return false;
      if (filter === "without" && dossier) return false;
      if (!query) return true;
      return `${patient.user?.full_name || ""} ${patient.email || ""} ${patient.ville || ""} ${
        patient.user?.first_name || ""
      } ${patient.user?.last_name || ""}`
        .toLowerCase()
        .includes(query);
    });
  }, [patients, byPatient, filter, search]);

  const stats = useMemo(() => {
    const withDossier = patients.filter((patient) => byPatient.get(patient.user?.id)).length;
    const moods = dossiers
      .map((dossier) => Number(dossier.humeur_moyenne))
      .filter((value) => !Number.isNaN(value) && value > 0);
    return {
      total: patients.length,
      withDossier,
      withoutDossier: patients.length - withDossier,
      mood: moods.length
        ? (moods.reduce((sum, value) => sum + value, 0) / moods.length).toFixed(1)
        : null,
    };
  }, [patients, dossiers, byPatient]);

  async function openDossier(patient) {
    setBusy(patient.user.id);
    try {
      await api.post("/clinical/dossiers/", {
        patient_id: patient.user.id,
        motif_consultation: "",
      });
      success(t("Dossier patient ouvert.", "Patient record opened."), {
        title: t("Dossier créé", "Record created"),
      });
      load();
    } catch (err) {
      toastError(extractError(err, t("Le dossier n'a pas pu être ouvert.", "The record could not be opened.")));
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <LoadingBlock label={t("Chargement de vos patients…", "Loading your patients…")} />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="overline">{t("Mes patients", "My patients")}</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-ink sm:text-3xl">
            {t("Votre file active", "Your active caseload")}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {t(
              "Retrouvez les personnes que vous accompagnez, leurs dossiers et leurs signaux de bien-être.",
              "Find the people you support, their records and their wellbeing signals.",
            )}
          </p>
        </div>
        <Link to="/pro/seances" className={buttonClass({ variant: "outline", size: "sm" })}>
          <CalendarClock className="h-4 w-4" />
          {t("Voir mes séances", "View my sessions")}
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="card flex items-center gap-3 p-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-teal-500/10 text-teal-600">
            <Users className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-muted">
              {t("Patients suivis", "Patients followed")}
            </p>
            <p className="text-lg font-black text-ink">{stats.total}</p>
          </div>
        </div>
        <div className="card flex items-center gap-3 p-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sage-100 text-teal-700">
            <FolderHeart className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-muted">
              {t("Dossiers ouverts", "Open records")}
            </p>
            <p className="text-lg font-black text-ink">{stats.withDossier}</p>
          </div>
        </div>
        <div className="card flex items-center gap-3 p-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-warn/10 text-warn">
            <Stethoscope className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-muted">
              {t("Sans dossier", "Without record")}
            </p>
            <p className="text-lg font-black text-ink">{stats.withoutDossier}</p>
          </div>
        </div>
        <div className="card flex items-center gap-3 p-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gold/25 text-teal-700">
            <HeartPulse className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-muted">
              {t("Humeur moyenne", "Average mood")}
            </p>
            <p className="text-lg font-black text-ink">
              {stats.mood ? `${stats.mood}/10` : "—"}
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("Nom, email, ville…", "Name, email, city…")}
            className="input pl-11"
          />
        </div>
        <select
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          className="input w-auto py-2.5 text-xs font-bold"
        >
          <option value="all">{t("Tous les patients", "All patients")}</option>
          <option value="with">{t("Avec dossier", "With a record")}</option>
          <option value="without">{t("Sans dossier", "Without a record")}</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={UserRound}
          title={t("Aucun patient trouvé", "No patient found")}
          description={t(
            "Vos patients apparaissent après une première séance ou demande confirmée.",
            "Your patients appear after a first session or a confirmed request.",
          )}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((patient) => {
            const dossier = byPatient.get(patient.user?.id);
            const name = patient.user?.full_name || patient.email;
            return (
              <article key={patient.id} className="card flex flex-col p-5">
                <div className="flex items-start gap-3">
                  <Avatar src={patient.user?.avatar} name={name} size="md" />
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-sm font-black text-ink">{name}</h2>
                    <p className="truncate text-[11px] text-muted">{patient.email}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {patient.age && <Badge tone="neutral">{patient.age} {t("ans", "yrs")}</Badge>}
                      {patient.ville && <Badge tone="sage">{patient.ville}</Badge>}
                      {patient.is_student && <Badge tone="teal">{t("Étudiant", "Student")}</Badge>}
                    </div>
                  </div>
                </div>

                {dossier ? (
                  <div className="mt-4 flex-1 space-y-2.5">
                    <div className="flex items-center justify-between rounded-2xl bg-sage-50 px-3 py-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
                        {t("Dossier", "Record")}
                      </span>
                      <Badge tone={dossier.statut === "actif" ? "success" : "neutral"}>
                        {dossier.statut === "actif" ? t("Actif", "Active") : t("Archivé", "Archived")}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-2xl bg-sand/60 px-2 py-2">
                        <p className="text-[9px] font-bold uppercase text-muted">
                          {t("Séances", "Sessions")}
                        </p>
                        <p className="text-sm font-black text-teal-700">
                          {dossier.seances_count || 0}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-sand/60 px-2 py-2">
                        <p className="text-[9px] font-bold uppercase text-muted">
                          {t("Humeur", "Mood")}
                        </p>
                        <p className="text-sm font-black text-teal-700">
                          {dossier.humeur_moyenne ?? "—"}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-sand/60 px-2 py-2">
                        <p className="text-[9px] font-bold uppercase text-muted">
                          {t("Objectifs", "Goals")}
                        </p>
                        <p className="text-sm font-black text-teal-700">
                          {dossier.progression || 0}%
                        </p>
                      </div>
                    </div>
                    {dossier.derniere_note?.extrait && (
                      <p className="line-clamp-2 rounded-2xl bg-white px-3 py-2 text-[10px] leading-relaxed text-muted ring-1 ring-line">
                        « {dossier.derniere_note.extrait} »
                      </p>
                    )}
                    {dossier.prochaine_seance && (
                      <p className="inline-flex items-center gap-1 text-[10px] font-semibold text-teal-600">
                        <CalendarClock className="h-3 w-3" />
                        {t("Prochaine séance", "Next session")}{" "}
                        {formatDate(dossier.prochaine_seance, lang, "d MMM · HH:mm")}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="mt-4 flex-1 rounded-2xl border border-dashed border-line bg-cream/50 px-3 py-4 text-center">
                    <FolderHeart className="mx-auto h-5 w-5 text-sage-400" />
                    <p className="mt-1 text-[10px] leading-relaxed text-muted">
                      {t(
                        "Aucun dossier clinique ouvert pour ce patient.",
                        "No clinical record opened for this patient.",
                      )}
                    </p>
                  </div>
                )}

                <div className="mt-4 flex gap-2">
                  <Link
                    to={`/pro/patients/${patient.user?.id}`}
                    className={buttonClass({ variant: "primary", size: "sm", className: "flex-1" })}
                  >
                    {t("Ouvrir le dossier", "Open record")}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                  {!dossier && (
                    <Button
                      variant="outline"
                      size="sm"
                      loading={busy === patient.user?.id}
                      onClick={() => openDossier(patient)}
                    >
                      {t("Créer", "Create")}
                    </Button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
