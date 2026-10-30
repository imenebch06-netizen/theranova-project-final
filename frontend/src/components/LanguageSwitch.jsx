import { Globe2 } from "lucide-react";
import clsx from "clsx";
import { useI18n } from "../contexts/I18nContext";

export default function LanguageSwitch({ tone = "dark", className }) {
  const { lang, setLang } = useI18n();
  const light = tone === "light";
  return (
    <div
      className={clsx(
        "inline-flex items-center gap-1 rounded-full border p-1",
        light ? "border-cream/20 bg-white/10" : "border-line bg-white/70",
        className,
      )}
    >
      <Globe2 className={clsx("ml-1.5 h-3.5 w-3.5", light ? "text-sage-200" : "text-muted")} />
      {["fr", "en"].map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => setLang(code)}
          aria-pressed={lang === code}
          className={clsx(
            "rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-wide transition",
            lang === code
              ? light
                ? "bg-sage-300 text-teal-800"
                : "bg-teal-500 text-cream"
              : light
                ? "text-cream/70 hover:text-cream"
                : "text-muted hover:text-teal-600",
          )}
        >
          {code}
        </button>
      ))}
    </div>
  );
}
