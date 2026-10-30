import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const I18nContext = createContext(null);
const STORAGE_KEY = "theranova.lang";

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "en" || stored === "fr") return stored;
    return navigator.language?.toLowerCase().startsWith("en") ? "en" : "fr";
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, lang);
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((value) => {
    if (value === "fr" || value === "en") setLangState(value);
  }, []);

  const toggleLang = useCallback(() => {
    setLangState((current) => (current === "fr" ? "en" : "fr"));
  }, []);

  /** t("Texte français", "English text") */
  const t = useCallback((fr, en) => (lang === "en" ? en ?? fr : fr), [lang]);
  const locale = lang === "en" ? "en-US" : "fr-FR";

  const value = useMemo(
    () => ({ lang, setLang, toggleLang, t, locale, isFrench: lang === "fr" }),
    [lang, setLang, toggleLang, t, locale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) throw new Error("useI18n must be used within I18nProvider");
  return context;
}
