import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Clock3,
  LifeBuoy,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Send,
  ShieldAlert,
} from "lucide-react";
import api, { extractError } from "../lib/api";
import { useI18n } from "../contexts/I18nContext";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { Button } from "../components/ui/Button";
import { Input, Select, Textarea } from "../components/ui/Field";

export default function Contact() {
  const { t } = useI18n();
  const { isAuthenticated } = useAuth();
  const { success } = useToast();
  const navigate = useNavigate();
  const [values, setValues] = useState({
    type: "suggestion",
    sujet: "",
    message: "",
    priorite: "niveau_1",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    if (!isAuthenticated) {
      navigate("/connexion?next=%2Fcontact");
      return;
    }
    setLoading(true);
    try {
      await api.post("/feedback/reports/", values);
      success(
        t(
          "Votre message a été transmis. Notre équipe vous répondra dans les meilleurs délais.",
          "Your message has been sent. Our team will reply as soon as possible.",
        ),
        { title: t("Message envoyé", "Message sent") },
      );
      setValues({ type: "suggestion", sujet: "", message: "", priorite: "niveau_1" });
    } catch (err) {
      setError(extractError(err, t("L'envoi a échoué.", "Sending failed.")));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <section className="border-b border-line/60 bg-sage-100/40">
        <div className="container-page py-14">
          <p className="overline">{t("Nous sommes là", "We are here")}</p>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-ink">
            {t("Une question, un doute, un besoin ?", "A question, a doubt, a need?")}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
            {t(
              "Notre équipe support et notre équipe clinique vous répondent du lundi au samedi. Pour les urgences, utilisez les numéros dédiés ci-dessous.",
              "Our support and clinical teams answer from Monday to Saturday. For emergencies, use the dedicated numbers below.",
            )}
          </p>
        </div>
      </section>

      <div className="container-page grid gap-8 py-12 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="space-y-4">
          {[
            {
              icon: Mail,
              fr: "Email",
              en: "Email",
              value: "contact@theranova.dz",
              hintFr: "Réponse sous 24 h ouvrées",
              hintEn: "Reply within 24 business hours",
            },
            {
              icon: Phone,
              fr: "Téléphone",
              en: "Phone",
              value: "+213 (0) 34 00 00 00",
              hintFr: "Lun–Sam · 9 h – 18 h",
              hintEn: "Mon–Sat · 9 am – 6 pm",
            },
            {
              icon: MapPin,
              fr: "Adresse",
              en: "Address",
              value: "ESTIN, Béjaïa — Algérie",
              hintFr: "Sur rendez-vous uniquement",
              hintEn: "By appointment only",
            },
            {
              icon: Clock3,
              fr: "Support clinique",
              en: "Clinical support",
              value: "support.clinique@theranova.dz",
              hintFr: "Pour les praticiens et les situations sensibles",
              hintEn: "For practitioners and sensitive situations",
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.fr} className="card flex items-start gap-4 p-5">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sage-100 text-teal-600">
                  <Icon className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-muted">{t(item.fr, item.en)}</p>
                  <p className="mt-0.5 text-sm font-black text-ink">{item.value}</p>
                  <p className="mt-0.5 text-[11px] text-muted">{t(item.hintFr, item.hintEn)}</p>
                </div>
              </div>
            );
          })}

          <div className="rounded-3xl border border-risk/20 bg-risk/5 p-5">
            <div className="flex items-start gap-3">
              <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-risk" />
              <div>
                <p className="text-sm font-black text-risk">{t("Urgence immédiate", "Immediate emergency")}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted">
                  {t(
                    "TheraNova n'est pas un service d'urgence. En cas de danger pour vous ou autrui, appelez la Protection civile (14) ou le SAMU (115), ou rendez-vous aux urgences les plus proches.",
                    "TheraNova is not an emergency service. If you or someone else is in danger, call Civil Protection (14) or SAMU (115), or go to the nearest emergency department.",
                  )}
                </p>
              </div>
            </div>
          </div>

          <div className="card flex items-start gap-4 p-5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-teal-500 text-cream">
              <LifeBuoy className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-black text-ink">{t("Besoin d'aide pour utiliser la plateforme ?", "Need help using the platform?")}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                {t(
                  "Consultez notre guide de démarrage ou écrivez-nous : nous vous accompagnons pas à pas.",
                  "Read our getting-started guide or write to us: we will guide you step by step.",
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="card p-6 sm:p-8">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sage-100 text-teal-600">
              <MessageSquare className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-black text-ink">{t("Écrivez-nous", "Write to us")}</h2>
              <p className="mt-1 text-sm text-muted">
                {t(
                  "Votre message est transmis à l'équipe concernée et suivi dans votre espace.",
                  "Your message is sent to the relevant team and tracked in your space.",
                )}
              </p>
            </div>
          </div>

          {!isAuthenticated && (
            <div className="mt-5 rounded-2xl bg-sage-100/70 px-4 py-3 text-xs leading-relaxed text-teal-800">
              {t(
                "Vous devez être connecté pour envoyer un message depuis la plateforme. Vous pouvez aussi nous écrire directement par email.",
                "You need to be signed in to send a message from the platform. You can also email us directly.",
              )}
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-2xl border border-risk/20 bg-risk/5 px-4 py-3 text-sm font-semibold text-risk">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Select
                label={t("Type de demande", "Request type")}
                value={values.type}
                onChange={(event) => setValues((current) => ({ ...current, type: event.target.value }))}
              >
                <option value="suggestion">{t("Suggestion", "Suggestion")}</option>
                <option value="bug">{t("Problème technique", "Technical issue")}</option>
                <option value="paiement">{t("Problème de paiement", "Payment issue")}</option>
                <option value="clinique">{t("Question clinique", "Clinical question")}</option>
              </Select>
              <Select
                label={t("Priorité", "Priority")}
                value={values.priorite}
                onChange={(event) => setValues((current) => ({ ...current, priorite: event.target.value }))}
              >
                <option value="niveau_1">{t("Standard", "Standard")}</option>
                <option value="niveau_2">{t("Important", "Important")}</option>
                <option value="niveau_3">{t("Critique", "Critical")}</option>
              </Select>
            </div>
            <Input
              label={t("Sujet", "Subject")}
              required
              value={values.sujet}
              onChange={(event) => setValues((current) => ({ ...current, sujet: event.target.value }))}
              placeholder={t("En quelques mots…", "In a few words…")}
            />
            <Textarea
              label={t("Message", "Message")}
              required
              rows={6}
              value={values.message}
              onChange={(event) => setValues((current) => ({ ...current, message: event.target.value }))}
              placeholder={t(
                "Décrivez votre demande avec le plus de détails possible…",
                "Describe your request in as much detail as possible…",
              )}
            />
            <Button type="submit" loading={loading} className="w-full sm:w-auto">
              <Send className="h-4 w-4" />
              {isAuthenticated ? t("Envoyer le message", "Send message") : t("Se connecter pour envoyer", "Sign in to send")}
            </Button>
            <p className="text-[10px] leading-relaxed text-muted">
              {t(
                "Ne partagez pas d'informations médicales sensibles dans ce formulaire. Utilisez la messagerie sécurisée de votre espace patient.",
                "Do not share sensitive medical information in this form. Use the secure messaging in your patient space.",
              )}
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
