import { Link } from "react-router-dom";
import { ArrowUpRight, CalendarCheck2, Clock3, MapPin, ShieldCheck, Star } from "lucide-react";
import Avatar from "./ui/Avatar";
import { Badge } from "./ui/Badge";
import { formatCurrency, formatDateTime } from "../lib/format";
import { useI18n } from "../contexts/I18nContext";

export default function TherapistCard({ therapist, compact = false }) {
  const { lang, t } = useI18n();
  if (!therapist) return null;
  const name = therapist.nom_complet || therapist.user?.full_name || "Thérapeute";
  const specialites = therapist.specialites || [];
  const rating = Number(therapist.note_globale || 0);

  return (
    <article className="card card-hover group relative flex h-full flex-col overflow-hidden p-5">
      <div className="absolute right-0 top-0 h-24 w-24 rounded-bl-[4rem] bg-sage-100/60 transition group-hover:bg-sage-200/60" />
      <div className="relative flex items-start gap-4">
        <Avatar src={therapist.user?.avatar} name={name} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="truncate text-base font-black text-ink">
              <Link to={`/therapeutes/${therapist.id}`} className="hover:text-teal-600">
                {name}
              </Link>
            </h3>
            {therapist.verifie && (
              <ShieldCheck className="h-4 w-4 shrink-0 text-teal-500" aria-label="Vérifié" />
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
            <span className="inline-flex items-center gap-1">
              <Star className="h-3.5 w-3.5 fill-gold text-gold" />
              <span className="font-bold text-ink">{rating.toFixed(1)}</span>
              <span>({therapist.nombre_avis || 0})</span>
            </span>
            {therapist.ville && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {therapist.ville}
              </span>
            )}
            {therapist.annees_experience > 0 && (
              <span>{therapist.annees_experience} {t("ans", "yrs")}</span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {specialites.slice(0, compact ? 2 : 3).map((specialty) => (
          <Badge key={specialty.id || specialty.nom} tone="sage">
            {lang === "en" && specialty.nom_en ? specialty.nom_en : specialty.nom}
          </Badge>
        ))}
        {specialites.length > 3 && !compact && (
          <Badge tone="neutral">+{specialites.length - 3}</Badge>
        )}
      </div>

      {!compact && therapist.bio && (
        <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-muted">{therapist.bio}</p>
      )}

      <div className="mt-auto flex items-end justify-between gap-3 pt-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted">
            {t("À partir de", "From")}
          </p>
          <p className="text-lg font-black text-teal-600">
            {formatCurrency(therapist.tarif_seance, lang)}
            <span className="text-xs font-semibold text-muted"> / {t("séance", "session")}</span>
          </p>
          {therapist.prochain_creneau ? (
            <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-success">
              <CalendarCheck2 className="h-3.5 w-3.5" />
              {formatDateTime(therapist.prochain_creneau, lang)}
            </p>
          ) : (
            <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted">
              <Clock3 className="h-3.5 w-3.5" />
              {t("Voir les disponibilités", "Check availability")}
            </p>
          )}
        </div>
        <Link
          to={`/therapeutes/${therapist.id}`}
          className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-teal-500 text-cream transition group-hover:bg-teal-600"
          aria-label={t("Voir le profil", "View profile")}
        >
          <ArrowUpRight className="h-5 w-5" />
        </Link>
      </div>
    </article>
  );
}
