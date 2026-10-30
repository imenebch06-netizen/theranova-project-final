import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  Ban,
  CalendarCheck2,
  Check,
  Mail,
  MapPin,
  RotateCcw,
  Search,
  Star,
  Stethoscope,
  Trash2,
  Wallet,
} from "lucide-react";
import api, { extractError, getAll } from "../../lib/api";
import { useI18n } from "../../contexts/I18nContext";
import { useToast } from "../../contexts/ToastContext";
import Avatar from "../../components/ui/Avatar";
import { Badge, StatusBadge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { EmptyState, ErrorState, LoadingBlock } from "../../components/ui/Feedback";
import { Input, Textarea } from "../../components/ui/Field";
import Modal from "../../components/ui/Modal";
import Tabs from "../../components/ui/Tabs";
import { formatCurrency, formatDate } from "../../lib/format";

const SUSPEND_REASONS = [
  { fr: "Documents professionnels non conformes", en: "Non-compliant professional documents" },
  { fr: "Manquement à la charte TheraNova", en: "Breach of the TheraNova charter" },
  { fr: "Signalements répétés de patients", en: "Repeated patient reports" },
  { fr: "Indisponibilité prolongée", en: "Extended unavailability" },
];

export default function AdminTherapists() {
  const { t, lang } = useI18n();
  const { success, error: toastError } = useToast();
  const [therapists, setTherapists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("en_attente");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(null);
  const [suspendTarget, setSuspendTarget] = useState(null);
  const [motif, setMotif] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const list = await getAll("/accounts/admin/therapists/");
      setTherapists(list || []);
    } catch (err) {
      setError(
        extractError(
          err,
          t("Impossible de charger les praticiens.", "Unable to load practitioners."),
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
      all: therapists.length,
      en_attente: therapists.filter((item) => item.statut === "en_attente").length,
      actif: therapists.filter((item) => item.statut === "actif").length,
      suspendu: therapists.filter((item) => item.statut === "suspendu").length,
    }),
    [therapists],
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return therapists.filter((item) => {
      if (tab !== "all" && item.statut !== tab) return false;
      if (!query) return true;
      return [
        item.nom_complet,
        item.user?.email,
        item.ville,
        ...(item.specialites || []).map((specialty) => specialty.nom),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [therapists, tab, search]);

  async function moderate(therapist, action, payload = {}) {
    setBusy(`${therapist.id}-${action}`);
    try {
      await api.post(`/accounts/admin/therapists/${therapist.id}/${action}/`, payload);
      success(
        action === "validate"
          ? t("Le praticien est validé et peut recevoir des réservations.", "The practitioner is approved and can receive bookings.")
          : action === "suspend"
            ? t("Le praticien a été suspendu et prévenu par email.", "The practitioner has been suspended and notified by email.")
            : action === "reactivate"
              ? t("Le praticien a été réactivé.", "The practitioner has been reactivated.")
              : t("Le compte praticien a été supprimé.", "The practitioner account has been deleted."),
        { title: t("Modération enregistrée", "Moderation recorded") },
      );
      setSuspendTarget(null);
      setDeleteTarget(null);
      setMotif("");
      await load();
    } catch (err) {
      toastError(extractError(err, t("L'action a échoué.", "The action failed.")));
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <LoadingBlock label={t("Chargement des praticiens…", "Loading practitioners…")} />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const tabs = [
    { value: "en_attente", label: t("À valider", "To approve"), count: counts.en_attente },
    { value: "actif", label: t("Actifs", "Active"), count: counts.actif },
    { value: "suspendu", label: t("Suspendus", "Suspended"), count: counts.suspendu },
    { value: "all", label: t("Tous", "All"), count: counts.all },
  ];

  return (
    <div className="space-y-5">
      <div>
        <p className="overline">{t("Annuaire professionnel", "Professional directory")}</p>
        <h1 className="mt-1 text-2xl font-black tracking-tight text-ink sm:text-3xl">
          {t("Modération des thérapeutes", "Therapist moderation")}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {t(
            "Vérifiez les dossiers, validez les profils et suspendez ceux qui ne respectent pas la charte.",
            "Verify files, approve profiles and suspend those that do not comply with the charter.",
          )}
        </p>
      </div>

      {counts.en_attente > 0 && (
        <div className="flex items-start gap-3 rounded-3xl border-2 border-warn/30 bg-warn/5 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warn" />
          <div>
            <p className="text-sm font-black text-ink">
              {t(
                `${counts.en_attente} dossier(s) en attente de validation`,
                `${counts.en_attente} file(s) awaiting approval`,
              )}
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted">
              {t(
                "Contrôlez le numéro de licence, les diplômes et la cohérence du profil avant d'activer le compte.",
                "Check the license number, degrees and profile consistency before activating the account.",
              )}
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="card flex items-center gap-3 p-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sage-100 text-teal-700">
            <Stethoscope className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-muted">
              {t("Praticiens actifs", "Active practitioners")}
            </p>
            <p className="text-lg font-black text-ink">{counts.actif}</p>
          </div>
        </div>
        <div className="card flex items-center gap-3 p-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-warn/10 text-warn">
            <BadgeCheck className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-muted">
              {t("En attente", "Pending")}
            </p>
            <p className="text-lg font-black text-ink">{counts.en_attente}</p>
          </div>
        </div>
        <div className="card flex items-center gap-3 p-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-risk/10 text-risk">
            <Ban className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-muted">
              {t("Suspendus", "Suspended")}
            </p>
            <p className="text-lg font-black text-ink">{counts.suspendu}</p>
          </div>
        </div>
      </div>

      <Tabs tabs={tabs} value={tab} onChange={setTab} className="w-fit" />

      <Input
        label={t("Rechercher un praticien", "Search a practitioner")}
        name="search"
        icon={Search}
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder={t("Nom, email, ville, spécialité…", "Name, email, city, specialty…")}
      />

      {filtered.length === 0 ? (
        <EmptyState
          icon={Stethoscope}
          title={t("Aucun praticien dans cette vue", "No practitioner in this view")}
          description={t(
            "Changez d'onglet ou de recherche pour afficher d'autres profils.",
            "Change tabs or search to display other profiles.",
          )}
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {filtered.map((therapist) => (
            <article key={therapist.id} className="card overflow-hidden">
              <div className="p-5">
                <div className="flex items-start gap-3">
                  <Avatar src={therapist.user?.avatar} name={therapist.nom_complet} size="lg" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-sm font-black text-ink">{therapist.nom_complet}</h2>
                      <StatusBadge status={therapist.statut} />
                      {therapist.verifie && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-success">
                          <BadgeCheck className="h-3.5 w-3.5" />
                          {t("Vérifié", "Verified")}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-muted">
                      <Mail className="h-3 w-3" />
                      {therapist.user?.email}
                    </p>
                    <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-muted">
                      <MapPin className="h-3 w-3" />
                      {therapist.ville || t("Ville non renseignée", "City not provided")}
                      {therapist.cabinet ? ` · ${therapist.cabinet}` : ""}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {(therapist.specialites || []).map((specialty) => (
                    <Badge key={specialty.id} tone="sage">
                      {t(specialty.nom, specialty.nom_en || specialty.nom)}
                    </Badge>
                  ))}
                  {(therapist.types_sessions || []).map((type) => (
                    <Badge key={type} tone="neutral">
                      {type}
                    </Badge>
                  ))}
                </div>

                {therapist.bio && (
                  <p className="mt-3 line-clamp-3 text-[11px] leading-relaxed text-muted">
                    {therapist.bio}
                  </p>
                )}

                <div className="mt-3 grid grid-cols-3 gap-2 rounded-2xl bg-sand/40 p-3">
                  <div>
                    <p className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-muted">
                      <Star className="h-3 w-3 text-gold" />
                      {t("Note", "Rating")}
                    </p>
                    <p className="text-xs font-black text-ink">
                      {Number(therapist.note_globale || 0).toFixed(1)}{" "}
                      <span className="text-[9px] font-semibold text-muted">
                        ({therapist.nombre_avis})
                      </span>
                    </p>
                  </div>
                  <div>
                    <p className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-muted">
                      <Wallet className="h-3 w-3 text-teal-500" />
                      {t("Tarif", "Fee")}
                    </p>
                    <p className="text-xs font-black text-ink">
                      {formatCurrency(therapist.tarif_seance, lang)}
                    </p>
                  </div>
                  <div>
                    <p className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-muted">
                      <CalendarCheck2 className="h-3 w-3 text-teal-500" />
                      {t("Séances", "Sessions")}
                    </p>
                    <p className="text-xs font-black text-ink">
                      {therapist.seances_realisees ?? 0}
                    </p>
                  </div>
                </div>

                <div className="mt-3 space-y-1 text-[10px] text-muted">
                  <p>
                    <span className="font-bold text-ink">{t("Licence", "License")} :</span>{" "}
                    {therapist.numero_licence || "—"}
                  </p>
                  <p>
                    <span className="font-bold text-ink">{t("Expérience", "Experience")} :</span>{" "}
                    {therapist.annees_experience} {t("ans", "years")}
                  </p>
                  {therapist.date_validation && (
                    <p>
                      <span className="font-bold text-ink">{t("Validé le", "Approved on")} :</span>{" "}
                      {formatDate(therapist.date_validation, lang, "d MMM yyyy")}
                    </p>
                  )}
                  {therapist.motif_suspension && (
                    <p className="text-risk">
                      <span className="font-bold">{t("Motif de suspension", "Suspension reason")} :</span>{" "}
                      {therapist.motif_suspension}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 border-t border-line/70 bg-cream/60 px-5 py-3.5">
                {therapist.statut === "en_attente" && (
                  <Button
                    size="sm"
                    onClick={() => moderate(therapist, "validate")}
                    loading={busy === `${therapist.id}-validate`}
                  >
                    <Check className="h-3.5 w-3.5" />
                    {t("Valider le dossier", "Approve file")}
                  </Button>
                )}
                {therapist.statut === "actif" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSuspendTarget(therapist)}
                  >
                    <Ban className="h-3.5 w-3.5" />
                    {t("Suspendre", "Suspend")}
                  </Button>
                )}
                {therapist.statut === "suspendu" && (
                  <Button
                    size="sm"
                    onClick={() => moderate(therapist, "reactivate")}
                    loading={busy === `${therapist.id}-reactivate`}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    {t("Réactiver", "Reactivate")}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-auto text-risk hover:bg-risk/10"
                  onClick={() => setDeleteTarget(therapist)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {t("Supprimer", "Delete")}
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}

      <Modal
        open={Boolean(suspendTarget)}
        onClose={() => {
          setSuspendTarget(null);
          setMotif("");
        }}
        title={t("Suspendre ce praticien ?", "Suspend this practitioner?")}
        description={suspendTarget ? suspendTarget.nom_complet : ""}
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setSuspendTarget(null);
                setMotif("");
              }}
            >
              {t("Annuler", "Cancel")}
            </Button>
            <Button
              variant="danger"
              loading={busy === `${suspendTarget?.id}-suspend`}
              onClick={() => moderate(suspendTarget, "suspend", { motif })}
            >
              <Ban className="h-4 w-4" />
              {t("Confirmer la suspension", "Confirm suspension")}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {SUSPEND_REASONS.map((reason) => {
              const label = t(reason.fr, reason.en);
              return (
                <button
                  key={reason.fr}
                  type="button"
                  onClick={() => setMotif(label)}
                  className={
                    motif === label
                      ? "chip border-transparent bg-teal-500 text-cream"
                      : "chip hover:border-teal-300"
                  }
                >
                  {label}
                </button>
              );
            })}
          </div>
          <Textarea
            label={t("Motif communiqué au praticien", "Reason shared with the practitioner")}
            name="motif"
            rows={4}
            maxLength={255}
            value={motif}
            onChange={(event) => setMotif(event.target.value)}
            placeholder={t(
              "Expliquez précisément ce qui justifie la suspension.",
              "Explain precisely what justifies the suspension.",
            )}
          />
          <p className="rounded-2xl bg-sand/60 px-3.5 py-2.5 text-[10px] leading-relaxed text-muted">
            {t(
              "La disponibilité du praticien sera fermée et il ne pourra plus recevoir de réservations. Il sera notifié par email.",
              "The practitioner's availability will be closed and they can no longer receive bookings. They will be notified by email.",
            )}
          </p>
        </div>
      </Modal>

      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title={t("Supprimer définitivement ?", "Delete permanently?")}
        description={deleteTarget ? deleteTarget.nom_complet : ""}
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              {t("Annuler", "Cancel")}
            </Button>
            <Button
              variant="danger"
              loading={busy === `${deleteTarget?.id}-delete`}
              onClick={() => moderate(deleteTarget, "delete")}
            >
              <Trash2 className="h-4 w-4" />
              {t("Supprimer le compte", "Delete account")}
            </Button>
          </>
        }
      >
        <div className="flex items-start gap-3 rounded-2xl border border-risk/20 bg-risk/5 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-risk" />
          <p className="text-xs leading-relaxed text-ink/80">
            {t(
              "Le compte, le profil professionnel et les créneaux de ce praticien seront supprimés. Les séances passées peuvent être conservées pour l'historique. Cette action est irréversible.",
              "The account, professional profile and slots of this practitioner will be deleted. Past sessions may be kept for history. This action cannot be undone.",
            )}
          </p>
        </div>
      </Modal>
    </div>
  );
}
