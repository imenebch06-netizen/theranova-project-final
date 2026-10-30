import { Link } from "react-router-dom";
import { ArrowLeft, Compass } from "lucide-react";
import { useI18n } from "../contexts/I18nContext";
import Logo from "../components/Logo";
import { buttonClass } from "../components/ui/Button";

export default function NotFound() {
  const { t } = useI18n();
  return (
    <div className="container-page flex min-h-[65vh] flex-col items-center justify-center py-20 text-center">
      <Logo className="mb-10" />
      <span className="flex h-20 w-20 items-center justify-center rounded-3xl bg-sage-200 text-teal-600">
        <Compass className="h-9 w-9" />
      </span>
      <p className="overline mt-6">404</p>
      <h1 className="mt-2 text-4xl font-black text-ink">
        {t("Cette page s'est égarée.", "This page has wandered off.")}
      </h1>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-muted">
        {t(
          "Le lien est peut-être obsolète, ou la page a été déplacée. Revenons ensemble sur un chemin connu.",
          "The link may be outdated, or the page has moved. Let's get you back on a familiar path.",
        )}
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link to="/" className={buttonClass({ variant: "primary" })}>
          <ArrowLeft className="h-4 w-4" />
          {t("Retour à l'accueil", "Back home")}
        </Link>
        <Link to="/therapeutes" className={buttonClass({ variant: "outline" })}>
          {t("Explorer les thérapeutes", "Browse therapists")}
        </Link>
      </div>
    </div>
  );
}
