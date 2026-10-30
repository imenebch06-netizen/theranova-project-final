import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  MessageCircle,
  MessagesSquare,
  Plus,
  Search,
  Send,
  ShieldCheck,
} from "lucide-react";
import clsx from "clsx";
import api, { extractError, getAll, unwrap } from "../../lib/api";
import { useAuth } from "../../contexts/AuthContext";
import { useI18n } from "../../contexts/I18nContext";
import { useToast } from "../../contexts/ToastContext";
import Avatar from "../../components/ui/Avatar";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { EmptyState, ErrorState, LoadingBlock } from "../../components/ui/Feedback";
import Modal from "../../components/ui/Modal";
import { formatDate, formatTime, fromNow } from "../../lib/format";

export default function Messages() {
  const { role } = useAuth();
  const { t, lang } = useI18n();
  const { success, error: toastError } = useToast();
  const [params, setParams] = useSearchParams();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeId, setActiveId] = useState(null);
  const [thread, setThread] = useState(null);
  const [threadLoading, setThreadLoading] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [starting, setStarting] = useState(false);
  const bottomRef = useRef(null);

  const loadConversations = useCallback(async () => {
    try {
      const { data } = await api.get("/messaging/conversations/", { params: { page_size: 100 } });
      const list = unwrap(data) || [];
      setConversations(list);
      return list;
    } catch (err) {
      setError(
        extractError(
          err,
          t("Impossible de charger vos conversations.", "Unable to load your conversations."),
        ),
      );
      return [];
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadConversations().then((list) => {
      const requested = params.get("conversation");
      const target = requested
        ? list.find((item) => String(item.id) === String(requested))
        : list[0];
      if (target) setActiveId(target.id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadThread = useCallback(
    async (id, { silent = false } = {}) => {
      if (!id) return;
      if (!silent) setThreadLoading(true);
      try {
        const { data } = await api.get(`/messaging/conversations/${id}/messages/`);
        setThread(data);
        setConversations((current) =>
          current.map((item) =>
            item.id === id
              ? { ...item, dernier_message: data.messages?.[data.messages.length - 1] || item.dernier_message, non_lus: 0 }
              : item,
          ),
        );
      } catch (err) {
        if (!silent) toastError(extractError(err));
      } finally {
        if (!silent) setThreadLoading(false);
      }
    },
    [toastError],
  );

  useEffect(() => {
    if (!activeId) {
      setThread(null);
      return undefined;
    }
    loadThread(activeId);
    const interval = window.setInterval(() => loadThread(activeId, { silent: true }), 10000);
    return () => window.clearInterval(interval);
  }, [activeId, loadThread]);

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [thread?.messages?.length]);

  useEffect(() => {
    if (!activeId) return;
    setParams((current) => {
      const next = new URLSearchParams(current);
      next.set("conversation", activeId);
      return next;
    }, { replace: true });
  }, [activeId, setParams]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return conversations;
    return conversations.filter((conversation) =>
      `${conversation.interlocuteur?.nom || ""} ${conversation.dernier_message?.contenu || ""}`
        .toLowerCase()
        .includes(query),
    );
  }, [conversations, search]);

  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === activeId) || null,
    [conversations, activeId],
  );

  async function send() {
    if (!draft.trim() || !activeId) return;
    const content = draft.trim();
    setDraft("");
    setSending(true);
    try {
      const { data } = await api.post(`/messaging/conversations/${activeId}/messages/`, {
        contenu: content,
      });
      setThread((current) =>
        current ? { ...current, messages: [...(current.messages || []), data] } : current,
      );
      setConversations((current) =>
        current.map((conversation) =>
          conversation.id === activeId
            ? {
                ...conversation,
                dernier_message: { contenu: content, date_envoi: data.date_envoi, sender_id: data.sender },
              }
            : conversation,
        ),
      );
    } catch (err) {
      setDraft(content);
      toastError(extractError(err, t("Le message n'a pas pu être envoyé.", "The message could not be sent.")));
    } finally {
      setSending(false);
    }
  }

  async function openNew() {
    setNewOpen(true);
    if (contacts.length) return;
    setContactsLoading(true);
    try {
      if (role === "therapist") {
        const { data } = await api.get("/accounts/therapist/patients/", { params: { page_size: 100 } });
        const list = (unwrap(data) || []).map((profile) => ({
          id: profile.user?.id,
          nom: profile.user?.full_name || profile.email,
          avatar: profile.user?.avatar,
          hint: profile.ville || profile.email,
        }));
        setContacts(list);
      } else {
        const sessions = await getAll("/scheduling/sessions/");
        const map = new Map();
        sessions.forEach((session) => {
          if (!session.therapeute || map.has(session.therapeute.id)) return;
          map.set(session.therapeute.id, {
            id: session.therapeute.id,
            nom: session.therapeute.nom_complet,
            avatar: session.therapeute.avatar,
            hint: session.therapeute.ville || t("Praticien", "Practitioner"),
          });
        });
        setContacts([...map.values()]);
      }
    } catch {
      setContacts([]);
    } finally {
      setContactsLoading(false);
    }
  }

  async function startConversation(contact) {
    setStarting(true);
    try {
      const payload =
        role === "therapist" ? { patient_id: contact.id } : { therapeute_id: contact.id };
      const { data } = await api.post("/messaging/conversations/", payload);
      const list = await loadConversations();
      setNewOpen(false);
      setActiveId(data.id);
      if (!list.some((conversation) => conversation.id === data.id)) {
        setConversations((current) => [data, ...current]);
      }
      success(t("Conversation ouverte.", "Conversation opened."));
    } catch (err) {
      toastError(extractError(err));
    } finally {
      setStarting(false);
    }
  }

  if (loading) return <LoadingBlock label={t("Chargement de la messagerie…", "Loading messages…")} />;
  if (error) return <ErrorState message={error} onRetry={() => window.location.reload()} />;

  const showList = !activeConversation;
  const messages = thread?.messages || [];

  return (
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="overline">{t("Messagerie", "Messages")}</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-ink sm:text-3xl">
            {t("Un espace d'échange sécurisé", "A secure space to talk")}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {t(
              "La messagerie est un complément au suivi, pas un service d'urgence.",
              "Messaging complements your care; it is not an emergency service.",
            )}
          </p>
        </div>
        <Button size="sm" onClick={openNew} variant="outline">
          <Plus className="h-4 w-4" />
          {t("Nouvelle conversation", "New conversation")}
        </Button>
      </div>

      <div className="card grid h-[calc(100vh-15rem)] min-h-[520px] overflow-hidden lg:grid-cols-[320px_1fr]">
        <aside
          className={clsx(
            "flex min-h-0 flex-col border-line lg:border-r",
            showList ? "flex" : "hidden lg:flex",
          )}
        >
          <div className="border-b border-line/70 p-3">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t("Rechercher…", "Search…")}
                className="input py-2.5 pl-10 text-xs"
              />
            </div>
          </div>
          <div className="thin-scrollbar min-h-0 flex-1 overflow-y-auto">
            {filtered.length === 0 && (
              <p className="px-4 py-10 text-center text-xs text-muted">
                {t("Aucune conversation.", "No conversation.")}
              </p>
            )}
            {filtered.map((conversation) => {
              const other = conversation.interlocuteur || {};
              const last = conversation.dernier_message;
              return (
                <button
                  key={conversation.id}
                  type="button"
                  onClick={() => setActiveId(conversation.id)}
                  className={clsx(
                    "flex w-full items-start gap-3 border-b border-line/50 px-3.5 py-3 text-left transition hover:bg-sand/50",
                    activeId === conversation.id && "bg-sage-50",
                  )}
                >
                  <Avatar src={other.avatar} name={other.nom} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-xs font-black text-ink">{other.nom}</p>
                      {conversation.non_lus > 0 && (
                        <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-terracotta px-1 text-[9px] font-black text-white">
                          {conversation.non_lus}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-[11px] text-muted">
                      {last?.contenu || t("Nouvelle conversation", "New conversation")}
                    </p>
                    <p className="mt-0.5 text-[9px] font-semibold text-muted/80">
                      {last?.date_envoi
                        ? fromNow(last.date_envoi, lang)
                        : formatDate(conversation.date_creation, lang)}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        <section className={clsx("flex min-h-0 flex-col", !showList ? "flex" : "hidden lg:flex")}>
          {!activeConversation ? (
            <div className="flex flex-1 items-center justify-center p-6">
              <EmptyState
                icon={MessagesSquare}
                title={t("Sélectionnez une conversation", "Select a conversation")}
                description={t(
                  "Vos échanges avec vos praticiens apparaissent ici. La messagerie s'ouvre après votre première séance.",
                  "Your conversations with practitioners appear here. Messaging opens after your first session.",
                )}
                action={
                  <Button variant="outline" onClick={openNew}>
                    <Plus className="h-4 w-4" />
                    {t("Démarrer", "Start")}
                  </Button>
                }
              />
            </div>
          ) : (
            <>
              <header className="flex items-center gap-3 border-b border-line/70 px-4 py-3">
                <button
                  type="button"
                  onClick={() => setActiveId(null)}
                  className="icon-btn lg:hidden"
                  aria-label={t("Retour", "Back")}
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <Avatar
                  src={activeConversation.interlocuteur?.avatar}
                  name={activeConversation.interlocuteur?.nom}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black text-ink">
                    {activeConversation.interlocuteur?.nom}
                  </p>
                  <p className="text-[10px] text-muted">
                    {activeConversation.interlocuteur?.role === "therapist"
                      ? t("Praticien", "Practitioner")
                      : t("Patient", "Patient")}{" "}
                    · {t("échanges confidentiels", "confidential exchanges")}
                  </p>
                </div>
                <ShieldCheck className="h-4 w-4 text-teal-500" />
              </header>

              <div className="thin-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto bg-cream/40 p-4">
                {threadLoading && (
                  <p className="py-4 text-center text-xs text-muted">
                    {t("Chargement…", "Loading…")}
                  </p>
                )}
                {!threadLoading && messages.length === 0 && (
                  <p className="py-10 text-center text-xs text-muted">
                    {t(
                      "Écrivez le premier message pour démarrer l'échange.",
                      "Write the first message to start the conversation.",
                    )}
                  </p>
                )}
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={clsx("flex gap-2", message.mine ? "justify-end" : "justify-start")}
                  >
                    {!message.mine && (
                      <Avatar
                        src={message.sender_avatar}
                        name={message.sender_nom}
                        size="xs"
                        className="mt-auto"
                      />
                    )}
                    <div
                      className={clsx(
                        "max-w-[78%] rounded-2xl px-3.5 py-2.5",
                        message.mine
                          ? "rounded-br-md bg-teal-500 text-cream"
                          : "rounded-bl-md border border-line bg-white text-ink",
                      )}
                    >
                      {!message.mine && (
                        <p className="text-[9px] font-black uppercase tracking-wider text-teal-500">
                          {message.sender_nom}
                        </p>
                      )}
                      <p className="whitespace-pre-line text-sm leading-relaxed">
                        {message.contenu}
                      </p>
                      <p
                        className={clsx(
                          "mt-1 text-right text-[9px] font-semibold",
                          message.mine ? "text-cream/60" : "text-muted/70",
                        )}
                      >
                        {formatTime(message.date_envoi)}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>

              <div className="border-t border-line/70 bg-white/70 p-3">
                <div className="flex items-end gap-2">
                  <textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        send();
                      }
                    }}
                    rows={1}
                    maxLength={4000}
                    placeholder={t("Écrire un message…", "Write a message…")}
                    className="input max-h-32 min-h-[44px] flex-1 resize-none py-2.5"
                  />
                  <Button onClick={send} loading={sending} disabled={!draft.trim()} size="icon">
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
                <p className="mt-1.5 px-1 text-[9px] text-muted">
                  {t(
                    "Entrée pour envoyer · Maj + Entrée pour un retour à la ligne. En cas d'urgence : 14 ou 115.",
                    "Enter to send · Shift + Enter for a new line. In an emergency: 14 or 115.",
                  )}
                </p>
              </div>
            </>
          )}
        </section>
      </div>

      <div className="flex items-start gap-2 rounded-2xl bg-sage-50 px-4 py-3">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-teal-500" />
        <p className="text-[11px] leading-relaxed text-teal-900/75">
          {t(
            "Les messages ne remplacent pas une consultation. En cas de crise, contactez la Protection civile (14), le SAMU (115) ou rendez-vous aux urgences les plus proches.",
            "Messages do not replace a consultation. In a crisis, contact Civil Protection (14), SAMU (115) or go to the nearest emergency department.",
          )}
        </p>
      </div>

      <Modal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        title={t("Nouvelle conversation", "New conversation")}
        description={
          role === "therapist"
            ? t("Choisissez un patient de votre suivi.", "Choose a patient you follow.")
            : t("Choisissez un praticien avec qui vous avez déjà réservé.", "Choose a practitioner you have already booked.")
        }
        size="md"
      >
        {contactsLoading ? (
          <LoadingBlock label={t("Chargement…", "Loading…")} />
        ) : contacts.length === 0 ? (
          <EmptyState
            icon={MessageCircle}
            title={t("Aucun contact disponible", "No contact available")}
            description={t(
              "La messagerie s'ouvre après une première réservation avec un praticien.",
              "Messaging opens after a first booking with a practitioner.",
            )}
          />
        ) : (
          <div className="space-y-2">
            {contacts.map((contact) => (
              <button
                key={contact.id}
                type="button"
                disabled={starting}
                onClick={() => startConversation(contact)}
                className="flex w-full items-center gap-3 rounded-2xl border border-line bg-white p-3 text-left transition hover:border-teal-400 disabled:opacity-60"
              >
                <Avatar src={contact.avatar} name={contact.nom} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-ink">{contact.nom}</p>
                  <p className="truncate text-[10px] text-muted">{contact.hint}</p>
                </div>
                <Badge tone="sage">{t("Écrire", "Write")}</Badge>
              </button>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
