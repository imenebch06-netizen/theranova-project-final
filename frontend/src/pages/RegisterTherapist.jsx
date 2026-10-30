import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, BadgeCheck, BriefcaseMedical, Check } from "lucide-react";
import AuthShell from "../components/AuthShell";
import { Checkbox, Input, Select, Textarea } from "../components/ui/Field";
import { Button } from "../components/ui/Button";
import { useAuth, roleHome } from "../contexts/AuthContext";
import { useI18n } from "../contexts/I18nContext";
import { useToast } from "../contexts/ToastContext";
import api, { extractError, unwrap } from "../lib/api";

const LANGS = ["Français", "English", "العربية", "Tamazight"];
const TYPES = ["Individuel", "Couple", "Famille"];

export default function RegisterTherapist() {
  const { t, lang } = useI18n();
  const { registerTherapist, isAuthenticated, role, loading: authLoading } = useAuth();
  const { success } = useToast();
  const navigate = useNavigate();
  const [specialties, setSpecialties] = useState([]);
  const [values, setValues] = useState({
    first_name: "",
    last_name: "",
    email: "",
    password: "",
    confirm: "",
    phone: "",
    numero_licence: "",
    annees_experience: 3,
    tarif_seance: 2500,
    ville: "Béjaïa",
    cabinet: "",
    bio: "",
    approche: "",
    diplomes: "",
    langues: ["Français"],
    types_sessions: ["Individuel"],
    specialite_ids: [],
    accept_terms: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!authLoading && isAuthenticated) navigate(roleHome(role), { replace: true });
  }, [authLoading, isAuthenticated, role, navigate]);

  useEffect(() => {
    api
      .get("/accounts/specialties/")
      .then(({ data }) => setSpecialties(unwrap(data) || []))
      .catch(() => setSpecialties([]));
  }, []);

  function update(field, value) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function toggleList(field, value) {
    setValues((current) => {
      const list = current[field];
      return {
        ...current,
        [field]: list.includes(value) ? list.filter((item) => item !== value) : [...list, value],
      };
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    if (values.password.length < 8) {
      setError(t("Le mot de passe doit contenir au moins 8 caractères.", "Password must be at least 8 characters."));
      return;
    }
    if (values.password !== values.confirm) {
      setError(t("Les deux mots de passe ne correspondent pas.", "Passwords do not match."));
      return;
    }
    if (!values.specialite_ids.length) {
      setError(t("Sélectionnez au moins une spécialité.", "Select at least one specialty."));
      return;
    }
    if (!values.accept_terms) {
      setError(t("Merci d'accepter le cadre déontologique.", "Please accept the code of conduct."));
      return;
    }
    setLoading(true);
    try {
      await registerTherapist({
        first_name: values.first_name.trim(),
        last_name: values.last_name.trim(),
        email: values.email.trim(),
        password: values.password,
        phone: values.phone,
        language: lang,
        numero_licence: values.numero_licence,
        annees_experience: Number(values.annees_experience) || 0,
        tarif_seance: Number(values.tarif_seance) || 2500,
        ville: values.ville,
        cabinet: values.cabinet,
        bio: values.bio,
        approche: values.approche,
        diplomes: values.diplomes,
        langues: values.langues,
        types_sessions: values.types_sessions,
        specialite_ids: values.specialite_ids,
        accept_terms: true,
      });
      success(
        t(
          "Votre dossier est en cours de vérification. Vous serez notifié dès sa validation.",
          "Your application is being reviewed. You will be notified once validated.",
        ),
        { title: t("Bienvenue dans le réseau", "Welcome to the network"), duration: 7000 },
      );
      navigate("/pro", { replace: true });
    } catch (err) {
      setError(extractError(err, t("L'inscription a échoué.", "Registration failed.")));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      wide
      title={t("Rejoindre TheraNova en tant que thérapeute", "Join TheraNova as a therapist")}
      subtitle={t(
        "Développez votre pratique, gérez votre agenda et accompagnez vos patients dans un cadre sécurisé.",
        "Grow your practice, manage your calendar and support your patients in a secure setting.",
      )}
      footer={
        <>
          {t("Déjà inscrit ?", "Already registered?")}{" "}
          <Link to="/connexion" className="link">{t("Se connecter", "Sign in")}</Link>
          <span className="mx-2 text-line">·</span>
          <Link to="/inscription" className="link">{t("Espace patient", "Patient sign-up")}</Link>
        </>
      }
    >
      <div className="mb-5 flex items-start gap-3 rounded-2xl border border-teal-500/15 bg-sage-100/60 p-4">
        <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-teal-500" />
        <p className="text-xs leading-relaxed text-teal-800">
          {t(
            "Chaque candidature est examinée par notre équipe clinique. La validation prend généralement 24 à 48 heures.",
            "Every application is reviewed by our clinical team. Validation usually takes 24 to 48 hours.",
          )}
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-2xl border border-risk/20 bg-risk/5 px-4 py-3 text-sm font-semibold text-risk">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <section className="card p-5">
          <h3 className="mb-4 inline-flex items-center gap-2 text-sm font-black text-ink">
            <BriefcaseMedical className="h-4 w-4 text-teal-500" />
            {t("Identité professionnelle", "Professional identity")}
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label={t("Prénom", "First name")}
              required
              value={values.first_name}
              onChange={(event) => update("first_name", event.target.value)}
              autoComplete="given-name"
            />
            <Input
              label={t("Nom", "Last name")}
              required
              value={values.last_name}
              onChange={(event) => update("last_name", event.target.value)}
              autoComplete="family-name"
            />
            <Input
              label={t("Email professionnel", "Professional email")}
              type="email"
              required
              value={values.email}
              onChange={(event) => update("email", event.target.value)}
              placeholder="dr.nom@exemple.dz"
              autoComplete="email"
            />
            <Input
              label={t("Téléphone", "Phone")}
              value={values.phone}
              onChange={(event) => update("phone", event.target.value)}
              placeholder="+213 5 55 00 00 00"
              autoComplete="tel"
            />
            <Input
              label={t("N° de licence / agrément", "License / registration no.")}
              value={values.numero_licence}
              onChange={(event) => update("numero_licence", event.target.value)}
              placeholder="DZ-PSY-2024-000"
            />
            <Input
              label={t("Années d'expérience", "Years of experience")}
              type="number"
              min={0}
              max={60}
              value={values.annees_experience}
              onChange={(event) => update("annees_experience", event.target.value)}
            />
          </div>
        </section>

        <section className="card p-5">
          <h3 className="mb-4 text-sm font-black text-ink">{t("Spécialités", "Specialties")}</h3>
          <div className="flex flex-wrap gap-2">
            {specialties.map((specialty) => {
              const selected = values.specialite_ids.includes(specialty.id);
              return (
                <button
                  key={specialty.id}
                  type="button"
                  onClick={() => toggleList("specialite_ids", specialty.id)}
                  className={
                    selected
                      ? "inline-flex items-center gap-1.5 rounded-full bg-teal-500 px-3.5 py-2 text-xs font-bold text-cream"
                      : "inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3.5 py-2 text-xs font-bold text-muted transition hover:border-teal-400 hover:text-teal-600"
                  }
                >
                  {selected && <Check className="h-3.5 w-3.5" />}
                  {lang === "en" && specialty.nom_en ? specialty.nom_en : specialty.nom}
                </button>
              );
            })}
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Select
              label={t("Format de séance", "Session format")}
              value={values.types_sessions[0] || "Individuel"}
              onChange={(event) => update("types_sessions", [event.target.value])}
            >
              {TYPES.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </Select>
            <Input
              label={t("Tarif par séance (DA)", "Fee per session (DZD)")}
              type="number"
              min={1000}
              step={100}
              value={values.tarif_seance}
              onChange={(event) => update("tarif_seance", event.target.value)}
            />
          </div>

          <div className="mt-4">
            <p className="label">{t("Langues de consultation", "Consultation languages")}</p>
            <div className="flex flex-wrap gap-2">
              {LANGS.map((language) => {
                const selected = values.langues.includes(language);
                return (
                  <button
                    key={language}
                    type="button"
                    onClick={() => toggleList("langues", language)}
                    className={
                      selected
                        ? "rounded-full bg-sage-300 px-3 py-1.5 text-xs font-bold text-teal-800"
                        : "rounded-full border border-line px-3 py-1.5 text-xs font-bold text-muted hover:border-sage-400"
                    }
                  >
                    {language}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <section className="card p-5">
          <h3 className="mb-4 text-sm font-black text-ink">{t("Cabinet & présentation", "Practice & profile")}</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label={t("Ville", "City")}
              value={values.ville}
              onChange={(event) => update("ville", event.target.value)}
            />
            <Input
              label={t("Nom du cabinet", "Practice name")}
              value={values.cabinet}
              onChange={(event) => update("cabinet", event.target.value)}
              placeholder={t("Cabinet TheraNova", "TheraNova practice")}
            />
          </div>
          <Textarea
            className="mt-4"
            label={t("Approche thérapeutique", "Therapeutic approach")}
            value={values.approche}
            onChange={(event) => update("approche", event.target.value)}
            placeholder={t("TCC, thérapie systémique, EMDR…", "CBT, systemic therapy, EMDR…")}
            rows={2}
          />
          <Textarea
            className="mt-4"
            label={t("Biographie professionnelle", "Professional biography")}
            value={values.bio}
            onChange={(event) => update("bio", event.target.value)}
            placeholder={t(
              "Décrivez votre parcours, votre philosophie de soin et les patients que vous accompagnez.",
              "Describe your background, care philosophy and the patients you support.",
            )}
          />
          <Textarea
            className="mt-4"
            label={t("Diplômes & formations", "Qualifications & training")}
            value={values.diplomes}
            onChange={(event) => update("diplomes", event.target.value)}
            placeholder={t("Master en psychologie clinique, formation TCC…", "Master's in clinical psychology, CBT training…")}
            rows={2}
          />
        </section>

        <section className="card p-5">
          <h3 className="mb-4 text-sm font-black text-ink">{t("Sécurité du compte", "Account security")}</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label={t("Mot de passe", "Password")}
              type="password"
              required
              value={values.password}
              onChange={(event) => update("password", event.target.value)}
              autoComplete="new-password"
            />
            <Input
              label={t("Confirmer", "Confirm")}
              type="password"
              required
              value={values.confirm}
              onChange={(event) => update("confirm", event.target.value)}
              autoComplete="new-password"
            />
          </div>
        </section>

        <Checkbox
          label={t(
            "Je certifie l'exactitude de mes informations et j'accepte le cadre déontologique de TheraNova.",
            "I certify the accuracy of my information and accept TheraNova's code of conduct.",
          )}
          checked={values.accept_terms}
          onChange={(event) => update("accept_terms", event.target.checked)}
        />

        <Button type="submit" loading={loading} className="w-full" size="lg">
          {t("Envoyer ma candidature", "Submit my application")}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </form>
    </AuthShell>
  );
}
