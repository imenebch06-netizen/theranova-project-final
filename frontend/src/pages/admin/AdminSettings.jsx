import { useState } from "react";
import {
  CreditCard,
  Globe2,
  KeyRound,
  LockKeyhole,
  Megaphone,
  Save,
  Send,
  ShieldCheck,
  Sparkles,
  UserRound,
  Users,
  Video,
} from "lucide-react";
import api, { extractError } from "../../lib/api";
import { useAuth } from "../../contexts/AuthContext";
import { useI18n } from "../../contexts/I18nContext";
import { useToast } from "../../contexts/ToastContext";
import Avatar from "../../components/ui/Avatar";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Input, Select, Textarea } from "../../components/ui/Field";
import { formatDate } from "../../lib/format";

const AUDIENCES = [
  { value: "", fr: "Tous les utilisateurs", en: "All users" },
  { value: "patient", fr: "Patients uniquement", en: "Patients only" },
  { value: "therapist", fr: "Thérapeutes uniquement", en: "Therapists only" },
  { value: "admin", fr: "Administrateurs uniquement", en: "Administrators only" },
];

export default function AdminSettings() {
  const { user, updateSession } = useAuth();
  const { t, lang, setLang } = useI18n();
  const { success, error: toastError } = useToast();
  const [profile, setProfile] = useState({
    first_name: user?.first_name || "",
    last_name: user?.last_name || "",
    phone: user?.phone || "",
    language: user?.language || "fr",
    avatar: user?.avatar || "",
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [password, setPassword] = useState({ current_password: "", new_password: "", confirm: "" });
  const [changing, setChanging] = useState(false);
  const [broadcast, setBroadcast] = useState({ titre: "", message: "", role: "" });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(null);

  function updateProfile(field, value) {
    setProfile((current) => ({ ...current, [field]: value }));
  }

  async function saveProfile(event) {
    event.preventDefault();
    setSavingProfile(true);
    try {
      const { data } = await api.patch("/auth/me/", {
        first_name: profile.first_name.trim(),
        last_name: profile.last_name.trim(),
        phone: profile.phone.trim(),
        language: profile.language,
        avatar: profile.avatar.trim(),
      });
      updateSession(data);
      setLang(profile.language);
      success(t("Votre profil administrateur a été mis à jour.", "Your administrator profile has been updated."));
    } catch (err) {
      toastError(extractError(err, t("La mise à jour a échoué.", "The update failed.")));
    } finally {
      setSavingProfile(false);
    }
  }

  async function changePassword(event) {
    event.preventDefault();
    if (password.new_password.length < 8) {
      toastError(
        t(
          "Le nouveau mot de passe doit contenir au moins 8 caractères.",
          "The new password must be at least 8 characters.",
        ),
      );
      return;
    }
    if (password.new_password !== password.confirm) {
      toastError(t("Les deux mots de passe ne correspondent pas.", "The passwords do not match."));
      return;
    }
    setChanging(true);
    try {
      await api.post("/auth/password/", {
        current_password: password.current_password,
        new_password: password.new_password,
      });
      setPassword({ current_password: "", new_password: "", confirm: "" });
      success(t("Votre mot de passe a été modifié.", "Your password has been changed."));
    } catch (err) {
      toastError(extractError(err, t("Le changement a échoué.", "The change failed.")));
    } finally {
      setChanging(false);
    }
  }

  async function sendBroadcast(event) {
    event.preventDefault();
    if (!broadcast.titre.trim() || !broadcast.message.trim()) {
      toastError(t("Le titre et le message sont requis.", "The title and message are required."));
      return;
    }
    setSending(true);
    setSent(null);
    try {
      const { data } = await api.post("/messaging/broadcast/", {
        titre: broadcast.titre.trim(),
        message: broadcast.message.trim(),
        role: broadcast.role,
      });
      setSent(data.sent ?? null);
      setBroadcast({ titre: "", message: "", role: broadcast.role });
      success(
        t(
          `Notification envoyée à ${data.sent} utilisateur(s).`,
          `Notification sent to ${data.sent} user(s).`,
        ),
        { title: t("Diffusion effectuée", "Broadcast completed") },
      );
    } catch (err) {
      toastError(extractError(err, t("La diffusion a échoué.", "The broadcast failed.")));
    } finally {
      setSending(false);
    }
  }

  if (!user) return null;

  const displayName = user.full_name || `${profile.first_name} ${profile.last_name}`.trim();

  return (
    <div className="space-y-5">
      <div>
        <p className="overline">{t("Configuration", "Configuration")}</p>
        <h1 className="mt-1 text-2xl font-black tracking-tight text-ink sm:text-3xl">
          {t("Paramètres de la plateforme", "Platform settings")}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {t(
            "Gérez votre compte administrateur, la diffusion d'annonces et consultez la configuration technique.",
            "Manage your administrator account, broadcast announcements and review the technical configuration.",
          )}
        </p>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <section className="card p-5">
            <h2 className="inline-flex items-center gap-2 text-base font-black text-ink">
              <Megaphone className="h-4 w-4 text-teal-500" />
              {t("Annonce à la communauté", "Community announcement")}
            </h2>
            <p className="mt-1 text-xs text-muted">
              {t(
                "La notification apparaît immédiatement dans l'espace des utilisateurs concernés.",
                "The notification appears immediately in the space of the targeted users.",
              )}
            </p>
            <form onSubmit={sendBroadcast} className="mt-4 space-y-3">
              <Input
                label={t("Titre de l'annonce", "Announcement title")}
                name="titre"
                required
                maxLength={150}
                value={broadcast.titre}
                onChange={(event) =>
                  setBroadcast((current) => ({ ...current, titre: event.target.value }))
                }
                placeholder={t("Maintenance planifiée, nouvelle fonctionnalité…", "Scheduled maintenance, new feature…")}
              />
              <Textarea
                label={t("Message", "Message")}
                name="message"
                rows={5}
                required
                maxLength={2000}
                value={broadcast.message}
                onChange={(event) =>
                  setBroadcast((current) => ({ ...current, message: event.target.value }))
                }
                placeholder={t(
                  "Soyez clair, concis et indiquez les dates utiles.",
                  "Be clear, concise and include relevant dates.",
                )}
              />
              <Select
                label={t("Destinataires", "Recipients")}
                name="role"
                value={broadcast.role}
                onChange={(event) =>
                  setBroadcast((current) => ({ ...current, role: event.target.value }))
                }
              >
                {AUDIENCES.map((audience) => (
                  <option key={audience.value} value={audience.value}>
                    {t(audience.fr, audience.en)}
                  </option>
                ))}
              </Select>
              <div className="flex flex-wrap items-center justify-between gap-3">
                {sent !== null ? (
                  <Badge tone="success" dot>
                    {t(`${sent} destinataire(s) notifié(s)`, `${sent} recipient(s) notified`)}
                  </Badge>
                ) : (
                  <p className="text-[10px] text-muted">
                    {t(
                      "Utilisez cette fonction avec parcimonie.",
                      "Use this feature sparingly.",
                    )}
                  </p>
                )}
                <Button type="submit" loading={sending}>
                  <Send className="h-4 w-4" />
                  {t("Diffuser l'annonce", "Broadcast announcement")}
                </Button>
              </div>
            </form>
          </section>

          <section className="card p-5">
            <h2 className="inline-flex items-center gap-2 text-base font-black text-ink">
              <UserRound className="h-4 w-4 text-teal-500" />
              {t("Compte administrateur", "Administrator account")}
            </h2>
            <form onSubmit={saveProfile} className="mt-4 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  label={t("Prénom", "First name")}
                  name="first_name"
                  required
                  value={profile.first_name}
                  onChange={(event) => updateProfile("first_name", event.target.value)}
                />
                <Input
                  label={t("Nom", "Last name")}
                  name="last_name"
                  required
                  value={profile.last_name}
                  onChange={(event) => updateProfile("last_name", event.target.value)}
                />
                <Input
                  label={t("Email", "Email")}
                  name="email"
                  value={user.email}
                  disabled
                  hint={t("L'email de connexion ne peut pas être modifié.", "The sign-in email cannot be changed.")}
                />
                <Input
                  label={t("Téléphone", "Phone")}
                  name="phone"
                  type="tel"
                  value={profile.phone}
                  onChange={(event) => updateProfile("phone", event.target.value)}
                  placeholder="+213 5 00 00 00 00"
                />
                <Select
                  label={t("Langue de l'interface", "Interface language")}
                  name="language"
                  value={profile.language}
                  onChange={(event) => updateProfile("language", event.target.value)}
                >
                  <option value="fr">Français</option>
                  <option value="en">English</option>
                </Select>
                <Input
                  label={t("Photo de profil (URL)", "Profile picture (URL)")}
                  name="avatar"
                  type="url"
                  value={profile.avatar}
                  onChange={(event) => updateProfile("avatar", event.target.value)}
                  placeholder="https://…"
                />
              </div>
              <div className="flex justify-end">
                <Button type="submit" loading={savingProfile}>
                  <Save className="h-4 w-4" />
                  {t("Enregistrer", "Save")}
                </Button>
              </div>
            </form>
          </section>

          <section className="card p-5">
            <h2 className="inline-flex items-center gap-2 text-base font-black text-ink">
              <Globe2 className="h-4 w-4 text-teal-500" />
              {t("Configuration de la plateforme", "Platform configuration")}
            </h2>
            <p className="mt-1 text-xs text-muted">
              {t(
                "Vue d'ensemble des services intégrés. Les secrets et clés d'API restent gérés côté serveur.",
                "Overview of integrated services. Secrets and API keys remain managed server-side.",
              )}
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-line bg-white p-4">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sage-100 text-teal-600">
                  <CreditCard className="h-4 w-4" />
                </span>
                <p className="mt-2 text-xs font-black text-ink">
                  {t("Paiements simulés", "Simulated payments")}
                </p>
                <p className="mt-0.5 text-[10px] leading-relaxed text-muted">
                  {t(
                    "BaridiMob, carte Edahabia et CIB sont simulés en environnement de démonstration. Aucun débit réel n'est effectué.",
                    "BaridiMob, Edahabia card and CIB are simulated in the demo environment. No real charge is made.",
                  )}
                </p>
              </div>
              <div className="rounded-2xl border border-line bg-white p-4">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sage-100 text-teal-600">
                  <Video className="h-4 w-4" />
                </span>
                <p className="mt-2 text-xs font-black text-ink">
                  {t("Téléconsultation", "Teleconsultation")}
                </p>
                <p className="mt-0.5 text-[10px] leading-relaxed text-muted">
                  {t(
                    "Liens Google Meet de démonstration, ouverts 15 minutes avant la séance. Un vrai client OAuth peut être branché en production.",
                    "Demo Google Meet links, opened 15 minutes before the session. A real OAuth client can be connected in production.",
                  )}
                </p>
              </div>
              <div className="rounded-2xl border border-line bg-white p-4">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sage-100 text-teal-600">
                  <Sparkles className="h-4 w-4" />
                </span>
                <p className="mt-2 text-xs font-black text-ink">
                  {t("Recommandation IA", "AI recommendation")}
                </p>
                <p className="mt-0.5 text-[10px] leading-relaxed text-muted">
                  {t(
                    "Moteur local basé sur des règles, sans envoi de données à un tiers. Remplaçable par un service d'IA certifié.",
                    "Local rule-based engine, with no data sent to a third party. Replaceable by a certified AI service.",
                  )}
                </p>
              </div>
              <div className="rounded-2xl border border-line bg-white p-4">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sage-100 text-teal-600">
                  <Users className="h-4 w-4" />
                </span>
                <p className="mt-2 text-xs font-black text-ink">
                  {t("Contrôle d'accès", "Access control")}
                </p>
                <p className="mt-0.5 text-[10px] leading-relaxed text-muted">
                  {t(
                    "Trois rôles étanches : patient, thérapeute, administrateur. Chaque API vérifie les permissions côté serveur.",
                    "Three strict roles: patient, therapist, administrator. Each API checks permissions server-side.",
                  )}
                </p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Badge tone="sage">FR / EN</Badge>
              <Badge tone="teal">MySQL / SQLite</Badge>
              <Badge tone="gold">Django REST</Badge>
              <Badge tone="neutral">React</Badge>
            </div>
          </section>
        </div>

        <aside className="space-y-5">
          <section className="card overflow-hidden">
            <div className="bg-teal-500 px-5 py-5 text-cream">
              <div className="flex items-center gap-3">
                <Avatar src={profile.avatar} name={displayName} size="lg" ring />
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-cream">{displayName}</p>
                  <p className="truncate text-[10px] text-cream/70">{user.email}</p>
                  <Badge tone="sage" className="mt-1.5">
                    {t("Administrateur", "Administrator")}
                  </Badge>
                </div>
              </div>
            </div>
            <dl className="space-y-2.5 p-5 text-xs">
              <div className="flex items-center justify-between">
                <dt className="text-muted">{t("Membre depuis", "Member since")}</dt>
                <dd className="font-bold text-ink">
                  {formatDate(user.date_joined, lang, "d MMM yyyy")}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted">{t("Dernière connexion", "Last sign-in")}</dt>
                <dd className="font-bold text-ink">
                  {user.last_login ? formatDate(user.last_login, lang, "d MMM yyyy") : "—"}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted">{t("Statut", "Status")}</dt>
                <dd className="inline-flex items-center gap-1 font-bold text-success">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  {t("Compte actif", "Active account")}
                </dd>
              </div>
            </dl>
          </section>

          <section className="card p-5">
            <h2 className="inline-flex items-center gap-2 text-sm font-black text-ink">
              <KeyRound className="h-4 w-4 text-teal-500" />
              {t("Sécurité", "Security")}
            </h2>
            <form onSubmit={changePassword} className="mt-3 space-y-3">
              <Input
                label={t("Mot de passe actuel", "Current password")}
                name="current_password"
                type="password"
                required
                value={password.current_password}
                onChange={(event) =>
                  setPassword((current) => ({ ...current, current_password: event.target.value }))
                }
              />
              <Input
                label={t("Nouveau mot de passe", "New password")}
                name="new_password"
                type="password"
                required
                minLength={8}
                value={password.new_password}
                onChange={(event) =>
                  setPassword((current) => ({ ...current, new_password: event.target.value }))
                }
                hint={t("8 caractères minimum.", "At least 8 characters.")}
              />
              <Input
                label={t("Confirmer", "Confirm")}
                name="confirm"
                type="password"
                required
                value={password.confirm}
                onChange={(event) =>
                  setPassword((current) => ({ ...current, confirm: event.target.value }))
                }
              />
              <Button type="submit" variant="outline" loading={changing} className="w-full">
                <LockKeyhole className="h-4 w-4" />
                {t("Mettre à jour", "Update")}
              </Button>
            </form>
          </section>

          <section className="rounded-3xl bg-sage-50 p-5">
            <ShieldCheck className="h-5 w-5 text-teal-500" />
            <h2 className="mt-2 text-sm font-black text-teal-900">
              {t("Traçabilité des actions", "Action traceability")}
            </h2>
            <p className="mt-1 text-[11px] leading-relaxed text-teal-900/70">
              {t(
                "Chaque validation, suspension, suppression et diffusion est journalisée côté serveur avec l'identité de l'administrateur.",
                "Every approval, suspension, deletion and broadcast is logged server-side with the administrator's identity.",
              )}
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
