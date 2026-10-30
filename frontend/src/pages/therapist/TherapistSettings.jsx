import { useEffect, useState } from "react";
import {
  BadgeCheck,
  CalendarClock,
  Check,
  GraduationCap,
  KeyRound,
  Languages,
  LockKeyhole,
  Save,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  UserRound,
  Wallet,
} from "lucide-react";
import api, { extractError } from "../../lib/api";
import { useAuth } from "../../contexts/AuthContext";
import { useI18n } from "../../contexts/I18nContext";
import { useToast } from "../../contexts/ToastContext";
import Avatar from "../../components/ui/Avatar";
import { Badge, StatusBadge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Checkbox, Input, Select, Textarea } from "../../components/ui/Field";
import { Stars } from "../../components/ui/Stars";
import { formatCurrency, formatDate } from "../../lib/format";

const LANGUAGES = [
  { value: "Français", fr: "Français", en: "French" },
  { value: "English", fr: "Anglais", en: "English" },
  { value: "العربية", fr: "Arabe", en: "Arabic" },
];

const SESSION_TYPES = [
  { value: "Individuel", fr: "Individuel", en: "Individual" },
  { value: "Couple", fr: "Couple", en: "Couple" },
  { value: "Famille", fr: "Famille", en: "Family" },
];

const EMPTY_FORM = {
  first_name: "",
  last_name: "",
  phone: "",
  language: "fr",
  avatar: "",
  bio: "",
  approche: "",
  annees_experience: 0,
  diplomes: "",
  langues: [],
  types_sessions: [],
  tarif_seance: 2500,
  duree_seance: 50,
  pause_entre_seances: 10,
  ville: "",
  cabinet: "",
  numero_licence: "",
  disponibilite_active: true,
  specialite_ids: [],
};

export default function TherapistSettings() {
  const { user, therapist, updateSession } = useAuth();
  const { t, lang, setLang } = useI18n();
  const { success, error: toastError } = useToast();
  const [form, setForm] = useState(EMPTY_FORM);
  const [specialties, setSpecialties] = useState([]);
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
      bio: therapist?.bio || "",
      approche: therapist?.approche || "",
      annees_experience: therapist?.annees_experience ?? 0,
      diplomes: therapist?.diplomes || "",
      langues: Array.isArray(therapist?.langues) ? therapist.langues : [],
      types_sessions: Array.isArray(therapist?.types_sessions) ? therapist.types_sessions : [],
      tarif_seance: therapist?.tarif_seance ?? 2500,
      duree_seance: therapist?.duree_seance ?? 50,
      pause_entre_seances: therapist?.pause_entre_seances ?? 10,
      ville: therapist?.ville || "",
      cabinet: therapist?.cabinet || "",
      numero_licence: therapist?.numero_licence || "",
      disponibilite_active: Boolean(therapist?.disponibilite_active),
      specialite_ids: Array.isArray(therapist?.specialites)
        ? therapist.specialites.map((item) => item.id)
        : [],
    });
  }, [user, therapist]);

  useEffect(() => {
    let active = true;
    api
      .get("/accounts/specialties/")
      .then(({ data }) => {
        if (!active) return;
        setSpecialties(Array.isArray(data) ? data : data?.results || []);
      })
      .catch(() => {
        if (active) setSpecialties([]);
      });
    return () => {
      active = false;
    };
  }, []);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function toggleIn(field, value) {
    setForm((current) => ({
      ...current,
      [field]: current[field].includes(value)
        ? current[field].filter((item) => item !== value)
        : [...current[field], value],
    }));
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
        bio: form.bio.trim(),
        approche: form.approche.trim(),
        annees_experience: Number(form.annees_experience) || 0,
        diplomes: form.diplomes.trim(),
        langues: form.langues,
        types_sessions: form.types_sessions,
        tarif_seance: Number(form.tarif_seance) || 0,
        duree_seance: Number(form.duree_seance) || 50,
        pause_entre_seances: Number(form.pause_entre_seances) || 0,
        ville: form.ville.trim(),
        cabinet: form.cabinet.trim(),
        numero_licence: form.numero_licence.trim(),
        disponibilite_active: form.disponibilite_active,
        specialite_ids: form.specialite_ids,
      };
      const { data } = await api.patch("/auth/me/", payload);
      updateSession(data);
      setLang(form.language);
      success(t("Votre profil professionnel a été mis à jour.", "Your professional profile has been updated."), {
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

  const displayName = user.full_name || `${form.first_name} ${form.last_name}`.trim();

  return (
    <div className="space-y-5">
      <div>
        <p className="overline">{t("Paramètres", "Settings")}</p>
        <h1 className="mt-1 text-2xl font-black tracking-tight text-ink sm:text-3xl">
          {t("Mon profil praticien", "My practitioner profile")}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {t(
            "Ces informations sont visibles dans l'annuaire public et aident les patients à choisir le praticien qui leur convient.",
            "This information is visible in the public directory and helps patients choose the right practitioner.",
          )}
        </p>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
        <form onSubmit={save} className="space-y-5">
          <section className="card p-5">
            <h2 className="inline-flex items-center gap-2 text-base font-black text-ink">
              <UserRound className="h-4 w-4 text-teal-500" />
              {t("Identité professionnelle", "Professional identity")}
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
                label={t("Ville", "City")}
                name="ville"
                value={form.ville}
                onChange={(event) => update("ville", event.target.value)}
                placeholder={t("Béjaïa, Alger…", "Béjaïa, Algiers…")}
              />
              <Input
                label={t("Cabinet", "Practice")}
                name="cabinet"
                value={form.cabinet}
                onChange={(event) => update("cabinet", event.target.value)}
                placeholder={t("Nom du cabinet ou adresse", "Practice name or address")}
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
                label={t("Numéro de licence", "License number")}
                name="numero_licence"
                value={form.numero_licence}
                onChange={(event) => update("numero_licence", event.target.value)}
                placeholder="DZ-PSY-0000"
              />
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
            <h2 className="inline-flex items-center gap-2 text-base font-black text-ink">
              <Stethoscope className="h-4 w-4 text-teal-500" />
              {t("Présentation clinique", "Clinical presentation")}
            </h2>
            <div className="mt-4 space-y-3">
              <Textarea
                label={t("Biographie", "Biography")}
                name="bio"
                rows={5}
                maxLength={4000}
                value={form.bio}
                onChange={(event) => update("bio", event.target.value)}
                placeholder={t(
                  "Présentez votre parcours, votre cadre et ce que les patients peuvent attendre de vous.",
                  "Introduce your background, your frame and what patients can expect from you.",
                )}
                hint={t(
                  "Un texte chaleureux et concret inspire confiance.",
                  "A warm and concrete text builds trust.",
                )}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  label={t("Approche thérapeutique", "Therapeutic approach")}
                  name="approche"
                  maxLength={200}
                  value={form.approche}
                  onChange={(event) => update("approche", event.target.value)}
                  placeholder={t("TCC, EMDR, systémique…", "CBT, EMDR, systemic…")}
                />
                <Input
                  label={t("Années d'expérience", "Years of experience")}
                  name="annees_experience"
                  type="number"
                  min={0}
                  max={60}
                  value={form.annees_experience}
                  onChange={(event) => update("annees_experience", event.target.value)}
                />
                <Textarea
                  label={t("Diplômes et formations", "Degrees and training")}
                  name="diplomes"
                  rows={3}
                  value={form.diplomes}
                  onChange={(event) => update("diplomes", event.target.value)}
                  placeholder={t(
                    "Master de psychologie clinique, formation EMDR…",
                    "Master's in clinical psychology, EMDR training…",
                  )}
                  className="sm:col-span-2"
                />
              </div>
            </div>
          </section>

          <section className="card p-5">
            <h2 className="inline-flex items-center gap-2 text-base font-black text-ink">
              <Languages className="h-4 w-4 text-teal-500" />
              {t("Langues et formats de séance", "Languages and session formats")}
            </h2>
            <p className="mt-1 text-xs text-muted">
              {t(
                "Indiquez les langues dans lesquelles vous pouvez accompagner et les formats que vous acceptez.",
                "Indicate the languages you can support and the formats you accept.",
              )}
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="label">{t("Langues parlées", "Spoken languages")}</p>
                <div className="flex flex-wrap gap-1.5">
                  {LANGUAGES.map((item) => {
                    const active = form.langues.includes(item.value);
                    return (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => toggleIn("langues", item.value)}
                        className={
                          active
                            ? "chip border-transparent bg-teal-500 text-cream"
                            : "chip hover:border-teal-300"
                        }
                      >
                        {t(item.fr, item.en)}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <p className="label">{t("Formats proposés", "Offered formats")}</p>
                <div className="flex flex-wrap gap-1.5">
                  {SESSION_TYPES.map((item) => {
                    const active = form.types_sessions.includes(item.value);
                    return (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => toggleIn("types_sessions", item.value)}
                        className={
                          active
                            ? "chip border-transparent bg-teal-500 text-cream"
                            : "chip hover:border-teal-300"
                        }
                      >
                        {t(item.fr, item.en)}
                      </button>
                    );
                  })}
                </div>
                {form.types_sessions.length === 0 && (
                  <p className="mt-2 text-[10px] font-semibold text-risk">
                    {t(
                      "Sélectionnez au moins un format pour rester réservable.",
                      "Select at least one format to remain bookable.",
                    )}
                  </p>
                )}
              </div>
            </div>
          </section>

          <section className="card p-5">
            <h2 className="inline-flex items-center gap-2 text-base font-black text-ink">
              <Sparkles className="h-4 w-4 text-teal-500" />
              {t("Spécialités", "Specialties")}
            </h2>
            <p className="mt-1 text-xs text-muted">
              {t(
                "Elles permettent de vous recommander aux patients dont les besoins correspondent.",
                "They help recommend you to patients whose needs match.",
              )}
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {specialties.length === 0 && (
                <p className="rounded-2xl bg-sand/50 px-3 py-4 text-center text-[11px] text-muted sm:col-span-2">
                  {t("Chargement des spécialités…", "Loading specialties…")}
                </p>
              )}
              {specialties.map((specialty) => (
                <Checkbox
                  key={specialty.id}
                  label={t(specialty.nom, specialty.nom_en || specialty.nom)}
                  description={
                    specialty.nombre_therapeutes
                      ? t(
                          `${specialty.nombre_therapeutes} praticien(s)`,
                          `${specialty.nombre_therapeutes} practitioner(s)`,
                        )
                      : specialty.description
                  }
                  checked={form.specialite_ids.includes(specialty.id)}
                  onChange={() => toggleIn("specialite_ids", specialty.id)}
                />
              ))}
            </div>
          </section>

          <section className="card p-5">
            <h2 className="inline-flex items-center gap-2 text-base font-black text-ink">
              <CalendarClock className="h-4 w-4 text-teal-500" />
              {t("Tarifs et disponibilité", "Pricing and availability")}
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <Input
                label={t("Tarif par séance (DA)", "Fee per session (DA)")}
                name="tarif_seance"
                type="number"
                min={0}
                step={100}
                value={form.tarif_seance}
                onChange={(event) => update("tarif_seance", event.target.value)}
                hint={t(
                  "Le tarif appliqué aux nouveaux rendez-vous.",
                  "The fee applied to new appointments.",
                )}
              />
              <Input
                label={t("Durée d'une séance (min)", "Session length (min)")}
                name="duree_seance"
                type="number"
                min={30}
                max={120}
                step={5}
                value={form.duree_seance}
                onChange={(event) => update("duree_seance", event.target.value)}
                hint={t("Entre 30 et 120 minutes.", "Between 30 and 120 minutes.")}
              />
              <Input
                label={t("Pause entre séances (min)", "Break between sessions (min)")}
                name="pause_entre_seances"
                type="number"
                min={0}
                max={60}
                step={5}
                value={form.pause_entre_seances}
                onChange={(event) => update("pause_entre_seances", event.target.value)}
                hint={t(
                  "Repos nécessaire pour préparer la séance suivante.",
                  "Rest needed to prepare for the next session.",
                )}
              />
            </div>
            <div className="mt-4 rounded-2xl border border-line bg-white p-4">
              <Checkbox
                label={t("Ma disponibilité est ouverte", "My availability is open")}
                description={t(
                  "Lorsqu'elle est désactivée, votre profil reste visible mais les patients ne peuvent plus réserver de créneau.",
                  "When disabled, your profile stays visible but patients can no longer book a slot.",
                )}
                checked={form.disponibilite_active}
                onChange={(event) => update("disponibilite_active", event.target.checked)}
              />
              {therapist?.statut !== "active" && (
                <p className="mt-2 text-[10px] font-semibold text-warn">
                  {t(
                    "Votre compte doit être validé par l'administration avant de recevoir des réservations.",
                    "Your account must be approved by the administration before receiving bookings.",
                  )}
                </p>
              )}
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
            <div className="bg-teal-500 px-5 py-5 text-cream">
              <div className="flex items-center gap-3">
                <Avatar src={form.avatar} name={displayName} size="lg" ring />
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-cream">
                    {displayName || t("Praticien", "Practitioner")}
                  </p>
                  <p className="truncate text-[10px] text-cream/70">{user.email}</p>
                  <div className="mt-1.5">
                    <StatusBadge status={therapist?.statut || "en_attente"} />
                  </div>
                </div>
              </div>
            </div>
            <dl className="space-y-2.5 p-5 text-xs">
              <div className="flex items-center justify-between">
                <dt className="inline-flex items-center gap-1.5 text-muted">
                  <Wallet className="h-3.5 w-3.5" />
                  {t("Tarif", "Fee")}
                </dt>
                <dd className="font-bold text-ink">{formatCurrency(form.tarif_seance, lang)}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="inline-flex items-center gap-1.5 text-muted">
                  <GraduationCap className="h-3.5 w-3.5" />
                  {t("Expérience", "Experience")}
                </dt>
                <dd className="font-bold text-ink">
                  {form.annees_experience} {t("ans", "years")}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="inline-flex items-center gap-1.5 text-muted">
                  <BadgeCheck className="h-3.5 w-3.5" />
                  {t("Vérifié", "Verified")}
                </dt>
                <dd className="inline-flex items-center gap-1 font-bold text-success">
                  {therapist?.verifie ? (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      {t("Oui", "Yes")}
                    </>
                  ) : (
                    <span className="text-muted">{t("En attente", "Pending")}</span>
                  )}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted">{t("Membre depuis", "Member since")}</dt>
                <dd className="font-bold text-ink">
                  {formatDate(user.date_joined, lang, "d MMM yyyy")}
                </dd>
              </div>
            </dl>
            <div className="border-t border-line/70 px-5 py-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-muted">
                  {t("Réputation", "Reputation")}
                </span>
                <Stars value={therapist?.note_globale || 0} size="sm" showValue />
              </div>
              <p className="mt-1 text-[10px] text-muted">
                {t(
                  `${therapist?.nombre_avis || 0} avis patient(s)`,
                  `${therapist?.nombre_avis || 0} patient review(s)`,
                )}
              </p>
            </div>
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
              {t("Un cadre professionnel clair", "A clear professional frame")}
            </h2>
            <p className="mt-1 text-[11px] leading-relaxed text-teal-900/70">
              {t(
                "Vos informations professionnelles engagent votre responsabilité. L'administration vérifie les diplômes et peut suspendre un profil en cas de manquement.",
                "Your professional information is your responsibility. The administration verifies degrees and may suspend a profile in case of misconduct.",
              )}
            </p>
            <Badge tone="sage" className="mt-3">
              {t("Charte TheraNova", "TheraNova Charter")}
            </Badge>
          </section>
        </aside>
      </div>
    </div>
  );
}
