import { useEffect, useState } from "react";
import {
  BellRing,
  Check,
  KeyRound,
  LockKeyhole,
  Save,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import api, { extractError } from "../../lib/api";
import { useAuth } from "../../contexts/AuthContext";
import { useI18n } from "../../contexts/I18nContext";
import { useToast } from "../../contexts/ToastContext";
import { Button } from "../../components/ui/Button";
import { Checkbox, Input, Select } from "../../components/ui/Field";
import { formatDate } from "../../lib/format";

export default function PatientSettings() {
  const { user, patient, updateSession } = useAuth();
  const { t, lang, setLang } = useI18n();
  const { success, error: toastError } = useToast();
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    language: "fr",
    avatar: "",
    date_naissance: "",
    sexe: "N",
    ville: "",
    is_student: false,
    university: "",
    occupation: "",
    emergency_contact: "",
    notify_email: true,
    notify_push: true,
  });
  const [saving, setSaving] = useState(false);
  const [password, setPassword] = useState({ current_password: "", new_password: "", confirm: "" });
  const [changing, setChanging] = useState(false);

  useEffect(() => {
    if (!user) return;
    setForm({
      first_name: user.first_name || "",
      last_name: user.last_name || "",
      phone: user.phone || "",
      language: user.language || "fr",
      avatar: user.avatar || "",
      date_naissance: patient?.date_naissance || "",
      sexe: patient?.sexe || "N",
      ville: patient?.ville || "",
      is_student: Boolean(patient?.is_student),
      university: patient?.university || "",
      occupation: patient?.occupation || "",
      emergency_contact: patient?.emergency_contact || "",
      notify_email: patient?.preferences?.notify_email ?? true,
      notify_push: patient?.preferences?.notify_push ?? true,
    });
  }, [user, patient]);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        phone: form.phone.trim(),
        language: form.language,
        avatar: form.avatar.trim(),
        date_naissance: form.date_naissance || null,
        sexe: form.sexe,
        ville: form.ville.trim(),
        is_student: form.is_student,
        university: form.university.trim(),
        occupation: form.occupation.trim(),
        emergency_contact: form.emergency_contact.trim(),
        preferences: {
          notify_email: form.notify_email,
          notify_push: form.notify_push,
        },
      };
      const { data } = await api.patch("/auth/me/", payload);
      updateSession(data);
      setLang(form.language);
      success(t("Votre profil a été mis à jour.", "Your profile has been updated."), {
        title: t("Modifications enregistrées", "Changes saved"),
      });
    } catch (err) {
      toastError(extractError(err, t("La mise à jour a échoué.", "The update failed.")));
    } finally {
      setSaving(false);
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

  if (!user) return null;

  return (
    <div className="space-y-5">
      <div>
        <p className="overline">{t("Paramètres", "Settings")}</p>
        <h1 className="mt-1 text-2xl font-black tracking-tight text-ink sm:text-3xl">
          {t("Mon profil", "My profile")}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {t(
            "Vos informations personnelles et vos préférences de suivi.",
            "Your personal information and care preferences.",
          )}
        </p>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
        <form onSubmit={save} className="space-y-5">
          <section className="card p-5">
            <h2 className="inline-flex items-center gap-2 text-base font-black text-ink">
              <UserRound className="h-4 w-4 text-teal-500" />
              {t("Identité", "Identity")}
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Input
                label={t("Prénom", "First name")}
                name="first_name"
                required
                value={form.first_name}
                onChange={(event) => update("first_name", event.target.value)}
              />
              <Input
                label={t("Nom", "Last name")}
                name="last_name"
                required
                value={form.last_name}
                onChange={(event) => update("last_name", event.target.value)}
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
                value={form.phone}
                onChange={(event) => update("phone", event.target.value)}
                placeholder="+213 5 00 00 00 00"
              />
              <Input
                label={t("Date de naissance", "Date of birth")}
                name="date_naissance"
                type="date"
                value={form.date_naissance || ""}
                onChange={(event) => update("date_naissance", event.target.value)}
              />
              <Select
                label={t("Sexe", "Gender")}
                name="sexe"
                value={form.sexe}
                onChange={(event) => update("sexe", event.target.value)}
              >
                <option value="N">{t("Non précisé", "Not specified")}</option>
                <option value="F">{t("Femme", "Female")}</option>
                <option value="M">{t("Homme", "Male")}</option>
              </Select>
              <Input
                label={t("Ville", "City")}
                name="ville"
                value={form.ville}
                onChange={(event) => update("ville", event.target.value)}
                placeholder={t("Béjaïa, Alger…", "Béjaïa, Algiers…")}
              />
              <Select
                label={t("Langue de l'interface", "Interface language")}
                name="language"
                value={form.language}
                onChange={(event) => update("language", event.target.value)}
              >
                <option value="fr">Français</option>
                <option value="en">English</option>
              </Select>
              <Input
                label={t("Photo de profil (URL)", "Profile picture (URL)")}
                name="avatar"
                type="url"
                value={form.avatar}
                onChange={(event) => update("avatar", event.target.value)}
                placeholder="https://…"
                hint={t("Laissez vide pour utiliser vos initiales.", "Leave empty to use your initials.")}
                className="sm:col-span-2"
              />
            </div>
          </section>

          <section className="card p-5">
            <h2 className="text-base font-black text-ink">{t("Situation", "Situation")}</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Checkbox
                  label={t("Je suis étudiant(e)", "I am a student")}
                  description={t(
                    "Cela nous aide à adapter nos contenus et nos tarifs.",
                    "This helps us adapt our content and pricing.",
                  )}
                  checked={form.is_student}
                  onChange={(event) => update("is_student", event.target.checked)}
                />
              </div>
              {form.is_student && (
                <Input
                  label={t("Université / établissement", "University / institution")}
                  name="university"
                  value={form.university}
                  onChange={(event) => update("university", event.target.value)}
                  placeholder="Université de Béjaïa"
                  className="sm:col-span-2"
                />
              )}
              <Input
                label={t("Profession / occupation", "Occupation")}
                name="occupation"
                value={form.occupation}
                onChange={(event) => update("occupation", event.target.value)}
                className="sm:col-span-2"
              />
              <Input
                label={t("Contact d'urgence", "Emergency contact")}
                name="emergency_contact"
                value={form.emergency_contact}
                onChange={(event) => update("emergency_contact", event.target.value)}
                placeholder={t("Nom et téléphone", "Name and phone")}
                hint={t(
                  "Utilisé uniquement en cas de situation urgente.",
                  "Used only in an urgent situation.",
                )}
                className="sm:col-span-2"
              />
            </div>
          </section>

          <section className="card p-5">
            <h2 className="inline-flex items-center gap-2 text-base font-black text-ink">
              <BellRing className="h-4 w-4 text-teal-500" />
              {t("Notifications", "Notifications")}
            </h2>
            <div className="mt-4 space-y-3">
              <Checkbox
                label={t("Rappels par email", "Email reminders")}
                description={t(
                  "Confirmations, rappels de séance et réponses à vos demandes.",
                  "Confirmations, session reminders and replies to your requests.",
                )}
                checked={form.notify_email}
                onChange={(event) => update("notify_email", event.target.checked)}
              />
              <Checkbox
                label={t("Notifications dans l'application", "In-app notifications")}
                description={t(
                  "Messages, alertes bien-être et nouveautés.",
                  "Messages, wellbeing alerts and news.",
                )}
                checked={form.notify_push}
                onChange={(event) => update("notify_push", event.target.checked)}
              />
            </div>
          </section>

          <div className="flex justify-end">
            <Button type="submit" loading={saving}>
              <Save className="h-4 w-4" />
              {t("Enregistrer les modifications", "Save changes")}
            </Button>
          </div>
        </form>

        <aside className="space-y-5">
          <section className="card overflow-hidden">
            <div className="bg-teal-500 px-5 py-4 text-cream">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-sage-300">
                {t("Compte", "Account")}
              </p>
              <p className="mt-1 truncate text-sm font-black text-cream">{user.email}</p>
            </div>
            <dl className="space-y-2.5 p-5 text-xs">
              <div className="flex items-center justify-between">
                <dt className="text-muted">{t("Rôle", "Role")}</dt>
                <dd className="font-bold text-ink">{t("Patient", "Patient")}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted">{t("Membre depuis", "Member since")}</dt>
                <dd className="font-bold text-ink">
                  {formatDate(user.date_joined, lang, "d MMM yyyy")}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted">{t("Statut", "Status")}</dt>
                <dd className="inline-flex items-center gap-1 font-bold text-success">
                  <Check className="h-3.5 w-3.5" />
                  {t("Actif", "Active")}
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
              {t("Vos données vous appartiennent", "Your data belongs to you")}
            </h2>
            <p className="mt-1 text-[11px] leading-relaxed text-teal-900/70">
              {t(
                "Vous pouvez demander l'accès, la rectification ou la suppression de vos données depuis la page contact. Nous répondons sous 30 jours.",
                "You can request access, correction or deletion of your data from the contact page. We reply within 30 days.",
              )}
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
