import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  Filter,
  MapPin,
  Search,
  SlidersHorizontal,
  Sparkles,
  X,
} from "lucide-react";
import clsx from "clsx";
import api, { unwrap } from "../lib/api";
import { useI18n } from "../contexts/I18nContext";
import TherapistCard from "../components/TherapistCard";
import { EmptyState, SkeletonCard } from "../components/ui/Feedback";
import Pagination from "../components/ui/Pagination";
import { buttonClass } from "../components/ui/Button";
import { Select } from "../components/ui/Field";

const CITIES = ["Béjaïa", "Alger", "Oran", "Constantine", "Sétif", "Tizi Ouzou", "Annaba"];
const LANGUAGES = [
  { value: "Français", label: "Français" },
  { value: "English", label: "English" },
  { value: "العربية", label: "العربية" },
];

export default function Therapists() {
  const { t, lang } = useI18n();
  const [params, setParams] = useSearchParams();
  const [specialties, setSpecialties] = useState([]);
  const [results, setResults] = useState([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [mobileFilters, setMobileFilters] = useState(false);

  const [search, setSearch] = useState(params.get("search") || "");
  const [debounced, setDebounced] = useState(search);
  const [specialite, setSpecialite] = useState(params.get("specialite") || "");
  const [ville, setVille] = useState("");
  const [type, setType] = useState("");
  const [langue, setLangue] = useState("");
  const [maxPrice, setMaxPrice] = useState(5000);
  const [disponible, setDisponible] = useState(true);
  const [ordering, setOrdering] = useState("-note_globale");

  useEffect(() => {
    api
      .get("/accounts/specialties/")
      .then(({ data }) => setSpecialties(unwrap(data) || []))
      .catch(() => setSpecialties([]));
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(search), 350);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debounced, specialite, ville, type, langue, maxPrice, disponible, ordering]);

  useEffect(() => {
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (specialite) next.set("specialite", specialite);
      else next.delete("specialite");
      return next;
    }, { replace: true });
  }, [specialite, setParams]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api
      .get("/accounts/therapists/", {
        params: {
          search: debounced || undefined,
          specialite: specialite || undefined,
          ville: ville || undefined,
          type: type || undefined,
          langue: langue || undefined,
          max_price: maxPrice < 5000 ? maxPrice : undefined,
          disponible: disponible ? "true" : undefined,
          ordering,
          page,
          page_size: 9,
        },
      })
      .then(({ data }) => {
        if (!active) return;
        setResults(unwrap(data) || []);
        setCount(data.count ?? (Array.isArray(data) ? data.length : 0));
      })
      .catch(() => {
        if (active) {
          setResults([]);
          setCount(0);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [debounced, specialite, ville, type, langue, maxPrice, disponible, ordering, page]);

  const activeFilters = useMemo(() => {
    const list = [];
    if (specialite) {
      const found = specialties.find((item) => String(item.id) === String(specialite));
      list.push({
        key: "specialite",
        label: found ? (lang === "en" && found.nom_en ? found.nom_en : found.nom) : t("Spécialité", "Specialty"),
        clear: () => setSpecialite(""),
      });
    }
    if (ville) list.push({ key: "ville", label: ville, clear: () => setVille("") });
    if (type) list.push({ key: "type", label: type, clear: () => setType("") });
    if (langue) list.push({ key: "langue", label: langue, clear: () => setLangue("") });
    if (maxPrice < 5000)
      list.push({
        key: "price",
        label: t("≤ ", "≤ ") + `${maxPrice} DA`,
        clear: () => setMaxPrice(5000),
      });
    if (!disponible)
      list.push({ key: "dispo", label: t("Toutes disponibilités", "All availabilities"), clear: () => setDisponible(true) });
    return list;
  }, [specialite, ville, type, langue, maxPrice, disponible, specialties, lang, t]);

  function reset() {
    setSearch("");
    setSpecialite("");
    setVille("");
    setType("");
    setLangue("");
    setMaxPrice(5000);
    setDisponible(true);
    setOrdering("-note_globale");
  }

  const filterPanel = (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="inline-flex items-center gap-2 text-sm font-black text-ink">
          <SlidersHorizontal className="h-4 w-4 text-teal-500" />
          {t("Filtres", "Filters")}
        </h2>
        <button type="button" onClick={reset} className="text-[11px] font-bold text-teal-600 hover:text-teal-800">
          {t("Réinitialiser", "Reset")}
        </button>
      </div>

      <div>
        <label className="label">{t("Recherche", "Search")}</label>
        <div className="relative">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("Nom, approche, ville…", "Name, approach, city…")}
            className="input pl-11"
          />
        </div>
      </div>

      <div>
        <label className="label">{t("Spécialité", "Specialty")}</label>
        <select value={specialite} onChange={(event) => setSpecialite(event.target.value)} className="select">
          <option value="">{t("Toutes les spécialités", "All specialties")}</option>
          {specialties.map((item) => (
            <option key={item.id} value={item.id}>
              {lang === "en" && item.nom_en ? item.nom_en : item.nom}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="label">{t("Ville", "City")}</label>
        <select value={ville} onChange={(event) => setVille(event.target.value)} className="select">
          <option value="">{t("Toutes les villes", "All cities")}</option>
          {CITIES.map((city) => (
            <option key={city} value={city}>{city}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="label">{t("Type de thérapie", "Therapy type")}</label>
        <select value={type} onChange={(event) => setType(event.target.value)} className="select">
          <option value="">{t("Tous les formats", "All formats")}</option>
          <option value="Individuel">{t("Individuel", "Individual")}</option>
          <option value="Couple">{t("Couple", "Couples")}</option>
          <option value="Famille">{t("Famille", "Family")}</option>
        </select>
      </div>

      <div>
        <label className="label">{t("Langue", "Language")}</label>
        <select value={langue} onChange={(event) => setLangue(event.target.value)} className="select">
          <option value="">{t("Toutes les langues", "All languages")}</option>
          {LANGUAGES.map((item) => (
            <option key={item.value} value={item.value}>{item.label}</option>
          ))}
        </select>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="label !mb-0">{t("Budget maximum", "Maximum budget")}</label>
          <span className="text-xs font-black text-teal-600">
            {maxPrice >= 5000 ? t("Tous", "Any") : `${maxPrice} DA`}
          </span>
        </div>
        <input
          type="range"
          min={2000}
          max={5000}
          step={250}
          value={maxPrice}
          onChange={(event) => setMaxPrice(Number(event.target.value))}
          className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-sage-200 accent-teal-500"
        />
        <div className="mt-1 flex justify-between text-[10px] font-semibold text-muted">
          <span>2 000 DA</span>
          <span>5 000 DA</span>
        </div>
      </div>

      <label className="flex cursor-pointer items-center justify-between rounded-2xl bg-sage-50 px-4 py-3">
        <span className="text-xs font-bold text-teal-800">
          {t("Disponibles uniquement", "Available only")}
        </span>
        <input
          type="checkbox"
          checked={disponible}
          onChange={(event) => setDisponible(event.target.checked)}
          className="h-4 w-4 rounded border-line text-teal-500 focus:ring-teal-500/40"
        />
      </label>

      <div className="rounded-2xl bg-teal-500 p-4 text-cream">
        <Sparkles className="h-5 w-5 text-sage-300" />
        <p className="mt-2 text-xs font-black leading-snug">
          {t("Vous ne savez pas qui choisir ?", "Not sure who to choose?")}
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-cream/65">
          {t(
            "Laissez notre questionnaire vous orienter en 3 minutes.",
            "Let our questionnaire guide you in 3 minutes.",
          )}
        </p>
        <Link to="/app/questionnaire" className={buttonClass({ variant: "secondary", size: "sm", className: "mt-3 w-full" })}>
          {t("Être guidé", "Get guidance")}
        </Link>
      </div>
    </div>
  );

  return (
    <div>
      <section className="border-b border-line/60 bg-sage-100/40">
        <div className="container-page py-10 sm:py-14">
          <p className="overline">{t("Annuaire vérifié", "Verified directory")}</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-ink sm:text-4xl">
            {t("Trouvez le praticien qui vous correspond", "Find the practitioner who fits you")}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            {t(
              "Filtrez par spécialité, ville, budget ou langue. Tous les profils sont validés par notre équipe clinique.",
              "Filter by specialty, city, budget or language. Every profile is reviewed by our clinical team.",
            )}
          </p>
        </div>
      </section>

      <div className="container-page py-8">
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <aside className="hidden lg:block">
            <div className="card sticky top-24 p-5">{filterPanel}</div>
          </aside>

          <div className="min-w-0">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMobileFilters(true)}
                  className="btn-outline btn-sm lg:hidden"
                >
                  <Filter className="h-4 w-4" />
                  {t("Filtres", "Filters")}
                  {activeFilters.length > 0 && (
                    <span className="rounded-full bg-teal-500 px-1.5 text-[10px] font-black text-cream">
                      {activeFilters.length}
                    </span>
                  )}
                </button>
                <p className="text-sm text-muted">
                  <span className="font-black text-ink">{count}</span>{" "}
                  {t("praticien(s) trouvé(s)", "practitioner(s) found")}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="hidden text-xs font-semibold text-muted sm:inline">
                  {t("Trier par", "Sort by")}
                </span>
                <select
                  value={ordering}
                  onChange={(event) => setOrdering(event.target.value)}
                  className="input w-auto py-2.5 text-xs font-bold"
                >
                  <option value="-note_globale">{t("Meilleures notes", "Top rated")}</option>
                  <option value="tarif_seance">{t("Prix croissant", "Price: low to high")}</option>
                  <option value="-tarif_seance">{t("Prix décroissant", "Price: high to low")}</option>
                  <option value="-annees_experience">{t("Expérience", "Experience")}</option>
                  <option value="-nombre_avis">{t("Plus d'avis", "Most reviewed")}</option>
                </select>
              </div>
            </div>

            {activeFilters.length > 0 && (
              <div className="mb-4 flex flex-wrap items-center gap-2">
                {activeFilters.map((filter) => (
                  <button
                    key={filter.key}
                    type="button"
                    onClick={filter.clear}
                    className="chip gap-1.5 transition hover:border-risk/30 hover:text-risk"
                  >
                    {filter.label}
                    <X className="h-3 w-3" />
                  </button>
                ))}
                <button type="button" onClick={reset} className="text-[11px] font-bold text-muted underline underline-offset-2 hover:text-teal-600">
                  {t("Tout effacer", "Clear all")}
                </button>
              </div>
            )}

            {loading ? (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {[1, 2, 3, 4, 5, 6].map((item) => <SkeletonCard key={item} />)}
              </div>
            ) : results.length ? (
              <>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {results.map((therapist) => (
                    <TherapistCard key={therapist.id} therapist={therapist} />
                  ))}
                </div>
                <Pagination page={page} count={count} pageSize={9} onChange={setPage} className="mt-8" />
              </>
            ) : (
              <EmptyState
                icon={Search}
                title={t("Aucun praticien ne correspond", "No practitioner matches")}
                description={t(
                  "Essayez d'élargir votre budget, de retirer un filtre ou d'explorer une autre spécialité.",
                  "Try widening your budget, removing a filter or exploring another specialty.",
                )}
                action={
                  <button type="button" onClick={reset} className={buttonClass({ variant: "primary" })}>
                    {t("Réinitialiser les filtres", "Reset filters")}
                  </button>
                }
              />
            )}
          </div>
        </div>
      </div>

      {mobileFilters && (
        <div className="fixed inset-0 z-[80] lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
            onClick={() => setMobileFilters(false)}
            aria-label={t("Fermer", "Close")}
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-3xl bg-cream p-5 shadow-lift animate-scale-in">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-black text-ink">{t("Filtres", "Filters")}</p>
              <button type="button" onClick={() => setMobileFilters(false)} className="icon-btn">
                <X className="h-5 w-5" />
              </button>
            </div>
            {filterPanel}
            <button type="button" onClick={() => setMobileFilters(false)} className={buttonClass({ className: "mt-5 w-full" })}>
              {t("Voir les résultats", "Show results")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
