import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Eye, EyeOff, LogIn, ShieldCheck } from "lucide-react";
import AuthShell from "../components/AuthShell";
import { Input } from "../components/ui/Field";
import { buttonClass, Button } from "../components/ui/Button";
import { useAuth, roleHome } from "../contexts/AuthContext";
import { useI18n } from "../contexts/I18nContext";
import { useToast } from "../contexts/ToastContext";
import { extractError } from "../lib/api";

const DEMO = [
  { roleKey: "patient", email: "patient@theranova.dz", password: "Patient123!", fr: "Patient", en: "Patient" },
  { roleKey: "therapist", email: "therapist@theranova.dz", password: "Therapist123!", fr: "Thérapeute", en: "Therapist" },
  { roleKey: "admin", email: "admin@theranova.dz", password: "Admin123!", fr: "Admin", en: "Admin" },
];

export default function Login() {
  const { t, lang } = useI18n();
  const { login, loginWithGoogle, isAuthenticated, role, loading: authLoading } = useAuth();
  const { success, error: toastError } = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next");
  const [values, setValues] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate(next && next.startsWith("/") ? next : roleHome(role), { replace: true });
    }
  }, [authLoading, isAuthenticated, role, next, navigate]);

  function targetFor(nextRole) {
    return next && next.startsWith("/") ? next : roleHome(nextRole);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const session = await login(values.email.trim(), values.password);
      success(t("Ravi de vous revoir.", "Welcome back."), {
        title: t("Connexion réussie", "Signed in"),
      });
      navigate(targetFor(session?.user?.role), { replace: true });
    } catch (err) {
      setError(extractError(err, t("Identifiants invalides.", "Invalid credentials.")));
    } finally {
      setLoading(false);
    }
  }

  async function quickLogin(account) {
    setError("");
    setLoading(true);
    try {
      const session = await login(account.email, account.password);
      success(t(`Connecté en tant que ${account.fr}.`, `Signed in as ${account.en}.`), {
        title: t("Mode démo", "Demo mode"),
      });
      navigate(targetFor(session?.user?.role), { replace: true });
    } catch (err) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  }

  async function googleDemo() {
    setError("");
    setLoading(true);
    try {
      const session = await loginWithGoogle({
        credential: "demo.google@theranova.dz",
        email: "demo.google@theranova.dz",
        first_name: "Sami",
        last_name: "Démo",
      });
      success(t("Connexion Google simulée avec succès.", "Google sign-in simulated successfully."));
      navigate(targetFor(session?.user?.role || "patient"), { replace: true });
    } catch (err) {
      setError(extractError(err, t("La connexion Google a échoué.", "Google sign-in failed.")));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title={t("Heureux de vous revoir", "Good to see you again")}
      subtitle={t(
        "Connectez-vous pour retrouver votre suivi, vos séances et vos messages.",
        "Sign in to find your care journey, sessions and messages.",
      )}
      footer={
        <>
          {t("Pas encore de compte ?", "No account yet?")}{" "}
          <Link to="/inscription" className="link">
            {t("Créer un espace patient", "Create a patient account")}
          </Link>
        </>
      }
      aside={
        <div className="mt-8 rounded-2xl border border-line bg-white/60 p-4">
          <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.14em] text-teal-500">
            <ShieldCheck className="h-4 w-4" />
            {t("Comptes de démonstration", "Demo accounts")}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {DEMO.map((account) => (
              <button
                key={account.roleKey}
                type="button"
                disabled={loading}
                onClick={() => quickLogin(account)}
                className="rounded-2xl border border-line bg-white px-2 py-2.5 text-[11px] font-bold text-teal-700 transition hover:border-teal-400 hover:bg-sage-50"
              >
                {t(account.fr, account.en)}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[10px] leading-relaxed text-muted">
            {t(
              "Un clic vous connecte directement au rôle choisi, avec les données de démonstration.",
              "One click signs you in to the chosen role with demo data.",
            )}
          </p>
        </div>
      }
    >
      {error && (
        <div className="mb-4 rounded-2xl border border-risk/20 bg-risk/5 px-4 py-3 text-sm font-semibold text-risk">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label={t("Adresse email", "Email address")}
          name="email"
          type="email"
          autoComplete="email"
          required
          value={values.email}
          onChange={(event) => setValues((current) => ({ ...current, email: event.target.value }))}
          placeholder="vous@exemple.dz"
        />
        <div className="relative">
          <Input
            label={t("Mot de passe", "Password")}
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            value={values.password}
            onChange={(event) => setValues((current) => ({ ...current, password: event.target.value }))}
            placeholder="••••••••"
            className="pr-12"
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            className="absolute bottom-3 right-3 rounded-full p-1.5 text-muted transition hover:bg-sand hover:text-teal-600"
            aria-label={showPassword ? t("Masquer", "Hide") : t("Afficher", "Show")}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>

        <div className="flex items-center justify-between text-xs">
          <label className="flex cursor-pointer items-center gap-2 font-semibold text-muted">
            <input type="checkbox" className="h-3.5 w-3.5 rounded border-line text-teal-500 focus:ring-teal-500/40" />
            {t("Se souvenir de moi", "Remember me")}
          </label>
          <Link to="/contact" className="font-bold text-teal-600 hover:text-teal-800">
            {t("Mot de passe oublié ?", "Forgot password?")}
          </Link>
        </div>

        <Button type="submit" loading={loading} className="w-full" size="lg">
          <LogIn className="h-4 w-4" />
          {t("Se connecter", "Sign in")}
        </Button>
      </form>

      <div className="my-5 flex items-center gap-3">
        <span className="h-px flex-1 bg-line" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
          {t("ou", "or")}
        </span>
        <span className="h-px flex-1 bg-line" />
      </div>

      <button type="button" onClick={googleDemo} className={buttonClass({ variant: "outline", className: "w-full" })}>
        <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
          <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8Z" />
          <path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1C3.4 21.4 7.4 24 12 24Z" />
          <path fill="#FBBC05" d="M5.4 14.4c-.2-.7-.4-1.5-.4-2.4s.1-1.7.4-2.4V6.5H1.4C.5 8.2 0 10 0 12s.5 3.8 1.4 5.5l4-3.1Z" />
          <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.5 1.8l3.4-3.4C17.9 1.2 15.2 0 12 0 7.4 0 3.4 2.6 1.4 6.5l4 3.1C6.3 6.9 8.9 4.8 12 4.8Z" />
        </svg>
        {t("Continuer avec Google", "Continue with Google")}
        <span className="rounded-full bg-sage-100 px-1.5 py-0.5 text-[9px] font-black uppercase text-teal-600">
          {t("démo", "demo")}
        </span>
      </button>

      <p className="mt-5 text-center text-[10px] leading-relaxed text-muted">
        {t(
          "En vous connectant, vous acceptez nos conditions d'utilisation et notre politique de confidentialité.",
          "By signing in, you accept our terms of use and privacy policy.",
        )}
      </p>
    </AuthShell>
  );
}
