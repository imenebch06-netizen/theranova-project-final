import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Search,
  ShieldCheck,
  Stethoscope,
  Trash2,
  UserRound,
  Users as UsersIcon,
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
import { formatCurrency, formatDate } from "../../lib/format";

const PAGE_SIZE = 12;

const ROLE_META = {
  patient: { fr: "Patient", en: "Patient", tone: "sage", icon: UserRound },
  therapist: { fr: "Thérapeute", en: "Therapist", tone: "teal", icon: Stethoscope },
  admin: { fr: "Administrateur", en: "Administrator", tone: "gold", icon: ShieldCheck },
};

export default function Users() {
  const { t, lang } = useI18n();
  const { success, error: toastError } = useToast();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("all");
  const [state, setState] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [target, setTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const list = await getAll("/accounts/admin/users/");
      setUsers(list || []);
    } catch (err) {
      setError(
        extractError(
          err,
          t("Impossible de charger les utilisateurs.", "Unable to load users."),
        ),
      );
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(() => {
    return {
      all: users.length,
      patient: users.filter((user) => user.role === "patient").length,
      therapist: users.filter((user) => user.role === "therapist").length,
      admin: users.filter((user) => user.role === "admin").length,
    };
  }, [users]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return users.filter((user) => {
      if (tab !== "all" && user.role !== tab) return false;
      if (state === "active" && !user.is_active) return false;
      if (state === "inactive" && user.is_active) return false;
      if (!query) return true;
      return [user.full_name, user.email, user.phone]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [users, tab, state, search]);

  useEffect(() => {
    setPage(1);
  }, [tab, state, search]);

  const visible = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page],
  );

  async function remove() {
    if (!target) return;
    setDeleting(true);
    try {
      await api.delete(`/accounts/admin/users/${target.id}/`);
      success(
        target.role === "therapist"
          ? t("Le compte praticien a été supprimé.", "The practitioner account has been deleted.")
          : t("Le compte a été désactivé.", "The account has been deactivated."),
        { title: t("Compte traité", "Account processed") },
      );
      setTarget(null);
      await load();
    } catch (err) {
      toastError(extractError(err, t("L'action a échoué.", "The action failed.")));
    } finally {
      setDeleting(false);
    }
  }

  if (loading) return <LoadingBlock label={t("Chargement des utilisateurs…", "Loading users…")} />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const tabs = [
    { value: "all", label: t("Tous", "All"), count: counts.all, icon: UsersIcon },
    { value: "patient", label: t("Patients", "Patients"), count: counts.patient, icon: UserRound },
    { value: "therapist", label: t("Thérapeutes", "Therapists"), count: counts.therapist, icon: Stethoscope },
    { value: "admin", label: t("Admins", "Admins"), count: counts.admin, icon: ShieldCheck },
  ];

  return (
    <div className="space-y-5">
      <div>
        <p className="overline">{t("Gestion des comptes", "Account management")}</p>
        <h1 className="mt-1 text-2xl font-black tracking-tight text-ink sm:text-3xl">
          {t("Utilisateurs de la plateforme", "Platform users")}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {t(
            "Recherchez, filtrez et gérez les comptes patients, praticiens et administrateurs.",
            "Search, filter and manage patient, practitioner and administrator accounts.",
          )}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="card flex items-center gap-3 p-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-teal-500/10 text-teal-600">
            <UsersIcon className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-muted">
              {t("Comptes", "Accounts")}
            </p>
            <p className="text-lg font-black text-ink">{counts.all}</p>
          </div>
        </div>
        <div className="card flex items-center gap-3 p-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sage-100 text-teal-700">
            <UserRound className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-muted">
              {t("Patients", "Patients")}
            </p>
            <p className="text-lg font-black text-ink">{counts.patient}</p>
          </div>
        </div>
        <div className="card flex items-center gap-3 p-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gold/25 text-teal-800">
            <Stethoscope className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-muted">
              {t("Praticiens", "Practitioners")}
            </p>
            <p className="text-lg font-black text-ink">{counts.therapist}</p>
          </div>
        </div>
        <div className="card flex items-center gap-3 p-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-risk/10 text-risk">
            <AlertTriangle className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-muted">
              {t("Inactifs", "Inactive")}
            </p>
            <p className="text-lg font-black text-ink">
              {users.filter((user) => !user.is_active).length}
            </p>
          </div>
        </div>
      </div>

      <Tabs tabs={tabs} value={tab} onChange={setTab} className="w-fit" />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Input
            label={t("Rechercher", "Search")}
            name="search"
            icon={Search}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("Nom, email ou téléphone…", "Name, email or phone…")}
          />
        </div>
        <Select
          label={t("Statut", "Status")}
          name="state"
          value={state}
          onChange={(event) => setState(event.target.value)}
          className="sm:w-48"
        >
          <option value="all">{t("Tous les statuts", "All statuses")}</option>
          <option value="active">{t("Actifs", "Active")}</option>
          <option value="inactive">{t("Inactifs", "Inactive")}</option>
        </Select>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={UsersIcon}
          title={t("Aucun utilisateur trouvé", "No user found")}
          description={t(
            "Ajustez votre recherche ou vos filtres pour afficher d'autres comptes.",
            "Adjust your search or filters to display other accounts.",
          )}
        />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t("Utilisateur", "User")}</th>
                <th>{t("Rôle", "Role")}</th>
                <th>{t("Profil", "Profile")}</th>
                <th>{t("Séances", "Sessions")}</th>
                <th>{t("Inscription", "Joined")}</th>
                <th className="text-right">{t("Actions", "Actions")}</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((user) => {
                const role = ROLE_META[user.role] || ROLE_META.patient;
                return (
                  <tr key={user.id}>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <Avatar name={user.full_name} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate text-xs font-black text-ink">{user.full_name}</p>
                          <p className="truncate text-[10px] text-muted">{user.email}</p>
                          {user.phone && <p className="text-[10px] text-muted">{user.phone}</p>}
                        </div>
                      </div>
                    </td>
                    <td>
                      <Badge tone={role.tone}>{t(role.fr, role.en)}</Badge>
                    </td>
                    <td>
                      {user.role === "patient" && user.patient ? (
                        <div>
                          <p className="text-[11px] font-bold text-ink">
                            {formatCurrency(user.patient.solde, lang)}
                          </p>
                          <p className="text-[10px] text-muted">
                            {user.patient.ville || t("Ville non renseignée", "City not provided")}
                            {user.patient.is_student ? ` · ${t("étudiant", "student")}` : ""}
                          </p>
                        </div>
                      ) : user.role === "therapist" && user.therapist ? (
                        <div>
                          <StatusBadge status={user.therapist.statut} />
                          <p className="mt-1 text-[10px] text-muted">
                            {user.therapist.specialites?.join(" · ") || t("Non renseigné", "Not provided")}
                          </p>
                        </div>
                      ) : (
                        <span className="text-[10px] text-muted">—</span>
                      )}
                    </td>
                    <td className="text-xs font-bold text-ink">{user.seances ?? 0}</td>
                    <td>
                      <p className="text-[11px] font-semibold text-ink">
                        {formatDate(user.date_joined, lang, "d MMM yyyy")}
                      </p>
                      <p className="text-[10px] text-muted">
                        {user.last_login
                          ? `${t("Vu", "Seen")} ${formatDate(user.last_login, lang, "d MMM")}`
                          : t("Jamais connecté", "Never signed in")}
                      </p>
                    </td>
                    <td>
                      <div className="flex items-center justify-end gap-2">
                        <Badge tone={user.is_active ? "success" : "neutral"} dot>
                          {user.is_active ? t("Actif", "Active") : t("Inactif", "Inactive")}
                        </Badge>
                        <button
                          type="button"
                          onClick={() => setTarget(user)}
                          className="icon-btn text-risk hover:bg-risk/10"
                          aria-label={t("Supprimer ou désactiver", "Delete or deactivate")}
                          title={t("Supprimer ou désactiver", "Delete or deactivate")}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Pagination
        page={page}
        count={filtered.length}
        pageSize={PAGE_SIZE}
        onChange={setPage}
      />

      <Modal
        open={Boolean(target)}
        onClose={() => setTarget(null)}
        title={
          target?.role === "therapist"
            ? t("Supprimer ce praticien ?", "Delete this practitioner?")
            : t("Désactiver ce compte ?", "Deactivate this account?")
        }
        description={target ? `${target.full_name} · ${target.email}` : ""}
        footer={
          <>
            <Button variant="outline" onClick={() => setTarget(null)}>
              {t("Annuler", "Cancel")}
            </Button>
            <Button variant="danger" onClick={remove} loading={deleting}>
              <Trash2 className="h-4 w-4" />
              {target?.role === "therapist"
                ? t("Supprimer définitivement", "Delete permanently")
                : t("Désactiver le compte", "Deactivate account")}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="flex items-start gap-3 rounded-2xl border border-risk/20 bg-risk/5 p-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-risk" />
            <p className="text-xs leading-relaxed text-ink/80">
              {target?.role === "therapist"
                ? t(
                    "Le compte praticien et ses données associées seront définitivement supprimés. Cette action est irréversible.",
                    "The practitioner account and its related data will be permanently deleted. This action cannot be undone.",
                  )
                : t(
                    "Le compte sera désactivé : la personne ne pourra plus se connecter, mais ses données seront conservées pour l'historique clinique et comptable.",
                    "The account will be deactivated: the person can no longer sign in, but their data is kept for clinical and accounting history.",
                  )}
            </p>
          </div>
          {target?.role === "patient" && target?.patient && (
            <div className="rounded-2xl bg-sand/50 p-3 text-[11px] text-muted">
              {t("Solde actuel", "Current balance")} :{" "}
              <span className="font-black text-teal-700">
                {formatCurrency(target.patient.solde, lang)}
              </span>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
