import { format, formatDistanceToNow, isToday, isTomorrow, parseISO } from "date-fns";
import { enUS, fr } from "date-fns/locale";

export function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  try {
    return typeof value === "string" ? parseISO(value) : new Date(value);
  } catch {
    return null;
  }
}

export function formatDate(value, lang = "fr", pattern = "d MMMM yyyy") {
  const date = toDate(value);
  if (!date || Number.isNaN(date.getTime())) return "—";
  return format(date, pattern, { locale: lang === "en" ? enUS : fr });
}

export function formatShortDate(value, lang = "fr") {
  return formatDate(value, lang, "d MMM");
}

export function formatDateTime(value, lang = "fr") {
  return formatDate(value, lang, "d MMM yyyy · HH:mm");
}

export function formatTime(value) {
  const date = toDate(value);
  if (!date || Number.isNaN(date.getTime())) return "—";
  return format(date, "HH:mm");
}

export function formatDayLabel(value, lang = "fr") {
  const date = toDate(value);
  if (!date || Number.isNaN(date.getTime())) return "—";
  if (isToday(date)) return lang === "en" ? "Today" : "Aujourd'hui";
  if (isTomorrow(date)) return lang === "en" ? "Tomorrow" : "Demain";
  return format(date, "EEEE d MMMM", { locale: lang === "en" ? enUS : fr });
}

export function formatWeekday(value, lang = "fr") {
  const date = toDate(value);
  if (!date) return "—";
  return format(date, "EEEE", { locale: lang === "en" ? enUS : fr });
}

export function fromNow(value, lang = "fr") {
  const date = toDate(value);
  if (!date) return "—";
  return formatDistanceToNow(date, {
    addSuffix: true,
    locale: lang === "en" ? enUS : fr,
  });
}

export function formatCurrency(value, lang = "fr") {
  const number = Number(value || 0);
  const formatted = new Intl.NumberFormat(lang === "en" ? "en-US" : "fr-FR", {
    maximumFractionDigits: 0,
  }).format(number);
  return `${formatted} DA`;
}

export function formatNumber(value, lang = "fr") {
  return new Intl.NumberFormat(lang === "en" ? "en-US" : "fr-FR").format(Number(value || 0));
}

export function initials(name = "") {
  return name
    .replace(/^Dr\s+/i, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function parseDateInput(value) {
  if (!value) return "";
  const date = toDate(value);
  if (!date) return "";
  return format(date, "yyyy-MM-dd");
}

export function parseDateTimeInput(value) {
  if (!value) return "";
  const date = toDate(value);
  if (!date) return "";
  return format(date, "yyyy-MM-dd'T'HH:mm");
}

export function dateKey(value) {
  const date = toDate(value);
  if (!date) return "";
  return format(date, "yyyy-MM-dd");
}

export function getErrorMessage(error, lang = "fr") {
  const detail = error?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (error?.message) return error.message;
  return lang === "en" ? "Something went wrong." : "Une erreur est survenue.";
}
