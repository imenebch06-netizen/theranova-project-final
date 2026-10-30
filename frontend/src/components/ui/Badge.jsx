import clsx from "clsx";
import { useI18n } from "../../contexts/I18nContext";

const TONES = {
  neutral: "bg-sand text-teal-700 border-transparent",
  sage: "bg-sage-200/70 text-teal-800 border-transparent",
  teal: "bg-teal-500/10 text-teal-600 border-transparent",
  success: "bg-success/10 text-success border-transparent",
  warn: "bg-warn/10 text-[#96661f] border-transparent",
  danger: "bg-risk/10 text-risk border-transparent",
  gold: "bg-gold/25 text-teal-800 border-transparent",
};

export function Badge({ tone = "neutral", className, children, dot = false }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide",
        TONES[tone] || TONES.neutral,
        className,
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

const STATUS = {
  en_attente: { tone: "warn", fr: "En attente", en: "Pending" },
  acceptee: { tone: "teal", fr: "Acceptée", en: "Accepted" },
  confirmee: { tone: "success", fr: "Confirmée", en: "Confirmed" },
  refusee: { tone: "danger", fr: "Refusée", en: "Declined" },
  annulee: { tone: "danger", fr: "Annulée", en: "Cancelled" },
  expiree: { tone: "neutral", fr: "Expirée", en: "Expired" },
  prevue: { tone: "teal", fr: "Prévue", en: "Scheduled" },
  en_cours: { tone: "warn", fr: "En cours", en: "In progress" },
  terminee: { tone: "success", fr: "Terminée", en: "Completed" },
  libre: { tone: "success", fr: "Libre", en: "Available" },
  reserve: { tone: "teal", fr: "Réservé", en: "Booked" },
  bloque: { tone: "neutral", fr: "Bloqué", en: "Blocked" },
  actif: { tone: "success", fr: "Actif", en: "Active" },
  inactif: { tone: "neutral", fr: "Inactif", en: "Inactive" },
  suspendu: { tone: "danger", fr: "Suspendu", en: "Suspended" },
  invite: { tone: "warn", fr: "Invité", en: "Invited" },
  paye: { tone: "success", fr: "Payé", en: "Paid" },
  refuse: { tone: "danger", fr: "Refusé", en: "Declined" },
  ok: { tone: "success", fr: "Réussie", en: "Successful" },
  echec: { tone: "danger", fr: "Échouée", en: "Failed" },
  remboursee: { tone: "warn", fr: "Remboursée", en: "Refunded" },
  nouveau: { tone: "warn", fr: "Nouveau", en: "New" },
  resolu: { tone: "success", fr: "Résolu", en: "Resolved" },
  resolue: { tone: "success", fr: "Résolue", en: "Resolved" },
  rejetee: { tone: "danger", fr: "Rejetée", en: "Rejected" },
  basse: { tone: "neutral", fr: "Basse", en: "Low" },
  normale: { tone: "sage", fr: "Normale", en: "Normal" },
  haute: { tone: "danger", fr: "Haute", en: "High" },
  niveau_1: { tone: "neutral", fr: "Niveau 1", en: "Level 1" },
  niveau_2: { tone: "warn", fr: "Niveau 2", en: "Level 2" },
  niveau_3: { tone: "danger", fr: "Niveau 3", en: "Level 3" },
  lue: { tone: "neutral", fr: "Lue", en: "Read" },
  envoyee: { tone: "sage", fr: "Envoyée", en: "Sent" },
};

export function StatusBadge({ status, label, className }) {
  const { lang } = useI18n();
  if (!status) return null;
  const key = String(status).toLowerCase();
  const config = STATUS[key] || STATUS[String(status)] || {
    tone: "neutral",
    fr: status,
    en: status,
  };
  return (
    <Badge tone={config.tone} dot className={className}>
      {label || (lang === "en" ? config.en : config.fr)}
    </Badge>
  );
}
