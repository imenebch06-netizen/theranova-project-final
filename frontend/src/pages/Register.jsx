import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Check, UserPlus } from "lucide-react";
import AuthShell from "../components/AuthShell";
import { Checkbox, Input, Select } from "../components/ui/Field";
import { Button } from "../components/ui/Button";
import { useAuth, roleHome } from "../contexts/AuthContext";
import { useI18n } from "../contexts/I18nContext";
import { useToast } from "../contexts/ToastContext";
import { extractError } from "../lib/api";

export default function Register() {
  const { t, lang } = useI18n();
  const { registerPatient, isAuthenticated, role, loading: authLoading } = useAuth();
  const { success } = useToast();
  const navigate = useNavigate();
  const [values, setValues] = useState({
    first_name: "",
    last_name: "",
    email: "",
    password: "",
    confirm: "",
    phone: "",
    date_naissance: "",
    sexe: "F",
    ville: "",
    is_student: true,
    university: "",
    accept_terms: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!authLoading && isAuthenticated) navigate(roleHome(role), { replace: true });
  }, [authLoading, isAuthenticated, role, navigate]);

  function update(field, value) {
    setValues((current) => ({ ...current, [field]: value }));
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
    if (!values.accept_terms) {
      setError(t("Merci d'accepter les conditions d'utilisation.", "Please accept the terms of use."));
      return;
    }
    setLoading(true);
    try {
      await registerPatient({
        first_name: values.first_name.trim(),
        last_name: values.last_name.trim(),
        email: values.email.trim(),
        password: values.password,
        phone: values.phone,
        date_naissance: values.date_naissance || null,
        sexe: values.sexe,
        ville: values.ville,
        is_student: values.is_student,
        university: values.is_student ? values.university : "",
        language: lang,
        accept_terms: true,
      });
      success(
        t("Votre espace est prêt. Commençons par faire connaissance.", "Your space is ready. Let's start by getting to know you."),
        { title: t("Bienvenue sur TheraNova", "Welcome to TheraNova") },
      );
      navigate("/app/questionnaire", { replace: true });
    } catch (err) {
      setError(extractError(err, t("L'inscription a échoué.", "Registration failed.")));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title={t("Créer votre espace patient", "Create your patient account")}
      subtitle={t(
        "Gratuit, confidentiel et sans engagement. Quelques informations suffisent pour commencer.",
        "Free, confidential and without commitment. A few details are all you need to start.",
      )}
      footer={
        <>
          {t("Vous avez déjà un compte ?", "Already have an account?")}{" "}
          <Link to="/connexion" className="link">{t("Se connecter", "Sign in")}</Link>
        </>
      }
      aside={
        <div className="mt-6 rounded-2xl bg-sage-100/70 p-4">
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-teal-500">
            {t("Vous êtes thérapeute ?", "Are you a therapist?")}
          </p>
          <Link to="/inscription/therapeute" className="mt-2 inline-flex items-center gap-1.5 text-sm font-bold text-teal-700 hover:text-teal-800">
            {t("Rejoindre le réseau professionnel", "Join the professional network")}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      }
    >
      {error && (
        <div className="mb-4 rounded-2xl border border-risk/20 bg-risk/5 px-4 py-3 text-sm font-semibold text-risk">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label={t("Prénom", "First name")}
            required
            value={values.first_name}
            onChange={(event) => update("first_name", event.target.value)}
            placeholder={t("Yasmine", "Yasmine")}
            autoComplete="given-name"
          />
          <Input
            label={t("Nom", "Last name")}
            required
            value={values.last_name}
            onChange={(event) => update("last_name", event.target.value)}
            placeholder={t("Benali", "Benali")}
            autoComplete="family-name"
          />
        </div>

        <Input
          label={t("Adresse email", "Email address")}
          type="email"
          required
          value={values.email}
          onChange={(event) => update("email", event.target.value)}
          placeholder="vous@exemple.dz"
          autoComplete="email"
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label={t("Mot de passe", "Password")}
            type="password"
            required
            value={values.password}
            onChange={(event) => update("password", event.target.value)}
            placeholder="8 caractères minimum"
            autoComplete="new-password"
          />
          <Input
            label={t("Confirmer", "Confirm")}
            type="password"
            required
            value={values.confirm}
            onChange={(event) => update("confirm", event.target.value)}
            placeholder="••••••••"
            autoComplete="new-password"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label={t("Téléphone", "Phone")}
            value={values.phone}
            onChange={(event) => update("phone", event.target.value)}
            placeholder="+213 5 55 00 00 00"
            autoComplete="tel"
          />
          <Input
            label={t("Date de naissance", "Date of birth")}
            type="date"
            value={values.date_naissance}
            onChange={(event) => update("date_naissance", event.target.value)}
            max={new Date().toISOString().split("T")[0]}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label={t("Sexe", "Gender")}
            value={values.sexe}
            onChange={(event) => update("sexe", event.target.value)}
          >
            <option value="F">{t("Femme", "Female")}</option>
            <option value="M">{t("Homme", "Male")}</option>
            <option value="N">{t("Non précisé", "Prefer not to say")}</option>
          </Select>
          <Input
            label={t("Ville", "City")}
            value={values.ville}
            onChange={(event) => update("ville", event.target.value)}
            placeholder={t("Béjaïa", "Béjaïa")}
            autoComplete="address-level2"
          />
        </div>

        <div className="rounded-2xl border border-line bg-white/70 p-4">
          <Checkbox
            label={t("Je suis étudiant(e)", "I am a student")}
            description={t(
              "Cela nous aide à adapter les recommandations et les tarifs.",
              "This helps us tailor recommendations and pricing.",
            )}
            checked={values.is_student}
            onChange={(event) => update("is_student", event.target.checked)}
          />
          {values.is_student && (
            <Input
              className="mt-3"
              label={t("Établissement", "University")}
              value={values.university}
              onChange={(event) => update("university", event.target.value)}
              placeholder={t("Université de Béjaïa", "University of Béjaïa")}
            />
          )}
        </div>

        <Checkbox
          label={
            <span>
              {t("J'accepte les", "I accept the")}{" "}
              <Link to="/a-propos" className="text-teal-600 underline underline-offset-2">
                {t("conditions d'utilisation", "terms of use")}
              </Link>{" "}
              {t("et la politique de confidentialité.", "and privacy policy.")}
            </span>
          }
          checked={values.accept_terms}
          onChange={(event) => update("accept_terms", event.target.checked)}
        />

        <Button type="submit" loading={loading} className="w-full" size="lg">
          <UserPlus className="h-4 w-4" />
          {t("Créer mon espace", "Create my account")}
        </Button>

        <p className="flex items-start gap-1.5 text-[10px] leading-relaxed text-muted">
          <Check className="mt-0.5 h-3 w-3 shrink-0 text-success" />
          {t(
            "Vos données de santé ne sont jamais revendues ni utilisées à des fins publicitaires.",
            "Your health data is never sold or used for advertising.",
          )}
        </p>
      </form>
    </AuthShell>
  );
}
