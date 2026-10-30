import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowDownRight,
  ArrowUpRight,
  BadgeCheck,
  Check,
  CreditCard,
  Download,
  Info,
  ReceiptText,
  Search,
  Sparkles,
  Wallet,
} from "lucide-react";
import api, { extractError, getAll, unwrap } from "../../lib/api";
import { useI18n } from "../../contexts/I18nContext";
import { useToast } from "../../contexts/ToastContext";
import { Badge, StatusBadge } from "../../components/ui/Badge";
import { Button, buttonClass } from "../../components/ui/Button";
import { EmptyState, ErrorState, LoadingBlock } from "../../components/ui/Feedback";
import Modal from "../../components/ui/Modal";
import Tabs from "../../components/ui/Tabs";
import { RadioCard } from "../../components/ui/Field";
import { formatCurrency, formatDate, formatDateTime, formatNumber } from "../../lib/format";

const METHODS = [
  { value: "baridimob", fr: "BaridiMob", en: "BaridiMob", descFr: "Paiement mobile Algérie Poste", descEn: "Algérie Poste mobile payment" },
  { value: "carte", fr: "Carte Edahabia", en: "Edahabia card", descFr: "Carte de paiement Algérie Poste", descEn: "Algérie Poste payment card" },
  { value: "cib", fr: "Carte CIB", en: "CIB card", descFr: "Carte interbancaire", descEn: "Interbank card" },
  { value: "credit", fr: "Crédit TheraNova", en: "TheraNova credit", descFr: "Utiliser votre solde disponible", descEn: "Use your available balance" },
];

const TYPE_LABEL = {
  Pack: { fr: "Pack", en: "Pack" },
  Seance: { fr: "Séance", en: "Session" },
  Abonnement: { fr: "Abonnement", en: "Subscription" },
  Remboursement: { fr: "Remboursement", en: "Refund" },
};

export default function Payments() {
  const { t, lang } = useI18n();
  const { success, error: toastError } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [packs, setPacks] = useState([]);
  const [tab, setTab] = useState("overview");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [buyTarget, setBuyTarget] = useState(null);
  const [method, setMethod] = useState("baridimob");
  const [buying, setBuying] = useState(false);
  const [invoice, setInvoice] = useState(null);
  const [invoiceLoading, setInvoiceLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [walletResponse, packData, transactionList] = await Promise.all([
        api.get("/billing/wallet/"),
        api.get("/billing/packs/"),
        getAll("/billing/transactions/"),
      ]);
      setWallet(walletResponse.data);
      setPacks(unwrap(packData.data) || []);
      setTransactions(transactionList || []);
    } catch (err) {
      setError(
        extractError(
          err,
          t("Impossible de charger vos paiements.", "Unable to load your payments."),
        ),
      );
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return transactions.filter((transaction) => {
      if (typeFilter && transaction.type !== typeFilter) return false;
      if (statusFilter && transaction.statut !== statusFilter) return false;
      if (!query) return true;
      return `${transaction.reference} ${transaction.pack_nom || ""} ${
        transaction.therapeute || ""
      }`
        .toLowerCase()
        .includes(query);
    });
  }, [transactions, search, typeFilter, statusFilter]);

  const activeSubscription = wallet?.abonnements?.[0] || null;
  const spent = Number(wallet?.total_depense || 0);
  const successRate = transactions.length
    ? Math.round(
        (transactions.filter((transaction) => transaction.statut === "OK").length /
          transactions.length) *
          100,
      )
    : 0;

  async function buy() {
    if (!buyTarget) return;
    setBuying(true);
    try {
      const { data } = await api.post("/billing/purchase/", {
        pack_id: buyTarget.id,
        methode: method,
      });
      success(
        t(
          `${buyTarget.nom_pack} activé. Votre solde a été mis à jour.`,
          `${buyTarget.nom_pack} activated. Your balance has been updated.`,
        ),
        { title: t("Pack activé", "Pack activated") },
      );
      if (data.solde !== undefined) {
        setWallet((current) => (current ? { ...current, solde: data.solde } : current));
      }
      setBuyTarget(null);
      load();
    } catch (err) {
      toastError(
        extractError(
          err,
          t("Le paiement a été refusé.", "The payment was declined."),
        ),
      );
    } finally {
      setBuying(false);
    }
  }

  async function openInvoice(transaction) {
    setInvoiceLoading(true);
    setInvoice({ pending: true, transaction });
    try {
      const { data } = await api.get(`/billing/transactions/${transaction.id}/`);
      setInvoice(data);
    } catch (err) {
      toastError(extractError(err));
      setInvoice(null);
    } finally {
      setInvoiceLoading(false);
    }
  }

  if (loading) return <LoadingBlock label={t("Chargement de vos paiements…", "Loading your payments…")} />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const tabs = [
    { value: "overview", label: t("Vue d'ensemble", "Overview"), icon: Wallet },
    { value: "transactions", label: t("Transactions", "Transactions"), count: transactions.length, icon: ReceiptText },
    { value: "packs", label: t("Packs & abonnements", "Packs & plans"), icon: Sparkles },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="overline">{t("Paiements", "Payments")}</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-ink sm:text-3xl">
            {t("Votre portefeuille TheraNova", "Your TheraNova wallet")}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {t(
              "Packs, crédits et factures centralisés au même endroit.",
              "Packs, credits and invoices in one place.",
            )}
          </p>
        </div>
        <Link to="/packs" className={buttonClass({ variant: "outline", size: "sm" })}>
          <Sparkles className="h-4 w-4" />
          {t("Découvrir les packs", "Discover packs")}
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="card flex items-center gap-3 p-5">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-500/10 text-teal-600">
            <Wallet className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-muted">
              {t("Solde disponible", "Available balance")}
            </p>
            <p className="text-xl font-black text-ink">{formatCurrency(wallet?.solde, lang)}</p>
          </div>
        </div>
        <div className="card flex items-center gap-3 p-5">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gold/25 text-teal-700">
            <ArrowUpRight className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-muted">
              {t("Total dépensé", "Total spent")}
            </p>
            <p className="text-xl font-black text-ink">{formatCurrency(spent, lang)}</p>
          </div>
        </div>
        <div className="card flex items-center gap-3 p-5">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-success/10 text-success">
            <BadgeCheck className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-muted">
              {t("Paiements réussis", "Successful payments")}
            </p>
            <p className="text-xl font-black text-ink">{successRate}%</p>
          </div>
        </div>
      </div>

      <Tabs tabs={tabs} value={tab} onChange={setTab} className="w-fit" />

      {tab === "overview" && (
        <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="card p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="inline-flex items-center gap-2 text-base font-black text-ink">
                <CreditCard className="h-4 w-4 text-teal-500" />
                {t("Activité récente", "Recent activity")}
              </h2>
              <button
                type="button"
                onClick={() => setTab("transactions")}
                className="text-[11px] font-bold text-teal-600 hover:text-teal-800"
              >
                {t("Tout voir", "View all")}
              </button>
            </div>
            <div className="mt-3 space-y-2">
              {transactions.length === 0 && (
                <p className="rounded-2xl bg-sand/50 px-4 py-8 text-center text-xs text-muted">
                  {t("Aucune transaction pour le moment.", "No transactions yet.")}
                </p>
              )}
              {transactions.slice(0, 6).map((transaction) => (
                <button
                  key={transaction.id}
                  type="button"
                  onClick={() => openInvoice(transaction)}
                  className="flex w-full items-center justify-between gap-3 rounded-2xl border border-line bg-white px-3.5 py-3 text-left transition hover:border-sage-400"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className={
                        transaction.statut === "OK"
                          ? "flex h-9 w-9 items-center justify-center rounded-2xl bg-success/10 text-success"
                          : "flex h-9 w-9 items-center justify-center rounded-2xl bg-risk/10 text-risk"
                      }
                    >
                      {transaction.statut === "OK" ? (
                        <ArrowDownRight className="h-4 w-4" />
                      ) : (
                        <ArrowUpRight className="h-4 w-4" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-ink">
                        {transaction.pack_nom ||
                          t(
                            TYPE_LABEL[transaction.type]?.fr || transaction.type,
                            TYPE_LABEL[transaction.type]?.en || transaction.type,
                          )}
                      </p>
                      <p className="text-[10px] text-muted">
                        {formatDate(transaction.date_transaction, lang, "d MMM yyyy")} ·{" "}
                        {transaction.reference}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-black text-teal-600">
                      {formatCurrency(transaction.montant, lang)}
                    </p>
                    <StatusBadge status={transaction.statut} className="!px-1.5 !py-0.5 !text-[9px]" />
                  </div>
                </button>
              ))}
            </div>
          </section>

          <div className="space-y-5">
            <section className="card overflow-hidden">
              <div className="bg-teal-500 px-5 py-4 text-cream">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-sage-300">
                  {t("Abonnement actif", "Active plan")}
                </p>
                <p className="mt-1 text-lg font-black">
                  {activeSubscription?.pack?.nom_pack || t("Aucun pack actif", "No active pack")}
                </p>
              </div>
              <div className="p-5">
                {activeSubscription ? (
                  <>
                    <div className="flex items-end justify-between">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted">
                          {t("Séances restantes", "Sessions left")}
                        </p>
                        <p className="text-3xl font-black text-teal-600">
                          {activeSubscription.solde_restants}
                          <span className="text-sm text-muted">
                            /{activeSubscription.pack?.nb_sessions}
                          </span>
                        </p>
                      </div>
                      <Badge tone="success">{t("Actif", "Active")}</Badge>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-sand">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-sage-400 to-teal-500"
                        style={{ width: `${Math.min(100, Number(activeSubscription.progression) || 0)}%` }}
                      />
                    </div>
                    <p className="mt-2 text-[11px] text-muted">
                      {t("Valable jusqu'au", "Valid until")}{" "}
                      {formatDate(activeSubscription.date_fin, lang, "d MMMM yyyy")}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-xs leading-relaxed text-muted">
                      {t(
                        "Un pack vous permet de planifier plusieurs séances à tarif réduit.",
                        "A pack lets you plan several sessions at a reduced rate.",
                      )}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3 w-full"
                      onClick={() => setTab("packs")}
                    >
                      {t("Choisir un pack", "Choose a pack")}
                    </Button>
                  </>
                )}
              </div>
            </section>

            <section className="card p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-muted">
                {t("Moyens de paiement", "Payment methods")}
              </p>
              <ul className="mt-3 space-y-2 text-xs text-muted">
                {["BaridiMob", "Edahabia", "CIB", t("Crédit TheraNova", "TheraNova credit")].map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 text-success" />
                    {item}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[10px] leading-relaxed text-muted">
                {t(
                  "Démonstration académique : aucun débit réel n'est effectué et aucune donnée bancaire n'est conservée.",
                  "Academic demonstration: no real charge is made and no banking data is stored.",
                )}
              </p>
            </section>
          </div>
        </div>
      )}

      {tab === "transactions" && (
        <section className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t("Référence, pack, praticien…", "Reference, pack, practitioner…")}
                className="input pl-11"
              />
            </div>
            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
              className="input w-auto py-2.5 text-xs font-bold"
            >
              <option value="">{t("Tous les types", "All types")}</option>
              <option value="Pack">{t("Packs", "Packs")}</option>
              <option value="Seance">{t("Séances", "Sessions")}</option>
              <option value="Remboursement">{t("Remboursements", "Refunds")}</option>
            </select>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="input w-auto py-2.5 text-xs font-bold"
            >
              <option value="">{t("Tous les statuts", "All statuses")}</option>
              <option value="OK">{t("Réussies", "Successful")}</option>
              <option value="ECHEC">{t("Échouées", "Failed")}</option>
              <option value="REMBOURSEE">{t("Remboursées", "Refunded")}</option>
            </select>
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              icon={ReceiptText}
              title={t("Aucune transaction", "No transaction")}
              description={t(
                "Vos paiements et remboursements apparaîtront ici.",
                "Your payments and refunds will appear here.",
              )}
            />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>{t("Référence", "Reference")}</th>
                    <th>{t("Libellé", "Description")}</th>
                    <th>{t("Date", "Date")}</th>
                    <th>{t("Moyen", "Method")}</th>
                    <th>{t("Montant", "Amount")}</th>
                    <th>{t("Statut", "Status")}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((transaction) => (
                    <tr key={transaction.id}>
                      <td className="font-mono text-[11px] font-bold text-teal-700">
                        {transaction.reference}
                      </td>
                      <td>
                        <p className="text-xs font-bold text-ink">
                          {transaction.pack_nom ||
                            t(
                              TYPE_LABEL[transaction.type]?.fr || transaction.type,
                              TYPE_LABEL[transaction.type]?.en || transaction.type,
                            )}
                        </p>
                        {transaction.therapeute && (
                          <p className="text-[10px] text-muted">{transaction.therapeute}</p>
                        )}
                      </td>
                      <td className="whitespace-nowrap text-[11px] text-muted">
                        {formatDate(transaction.date_transaction, lang, "d MMM yyyy")}
                      </td>
                      <td className="text-[11px] text-muted">
                        {transaction.methode_display || transaction.methode}
                      </td>
                      <td className="whitespace-nowrap text-xs font-black text-teal-600">
                        {formatCurrency(transaction.montant, lang)}
                      </td>
                      <td>
                        <StatusBadge status={transaction.statut} />
                      </td>
                      <td>
                        <button
                          type="button"
                          onClick={() => openInvoice(transaction)}
                          className="text-[11px] font-bold text-teal-600 hover:text-teal-800"
                        >
                          {t("Facture", "Invoice")}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {tab === "packs" && (
        <div className="space-y-4">
          <div className="flex items-start gap-2 rounded-2xl bg-sage-50 px-4 py-3">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-teal-500" />
            <p className="text-[11px] leading-relaxed text-teal-900/75">
              {t(
                "Les séances de votre pack sont utilisables avec tout praticien du réseau. Le crédit restant est visible dans votre portefeuille.",
                "Your pack sessions can be used with any practitioner in the network. Remaining credit is visible in your wallet.",
              )}
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {packs.map((pack) => {
              const isCurrent = activeSubscription?.pack?.id === pack.id;
              return (
                <div
                  key={pack.id}
                  className={
                    pack.is_featured
                      ? "relative flex flex-col rounded-3xl border-2 border-teal-500 bg-white p-5"
                      : "relative flex flex-col rounded-3xl border border-line bg-white p-5"
                  }
                >
                  {pack.is_featured && (
                    <Badge tone="teal" className="absolute -top-2.5 left-5 bg-white">
                      {t("Populaire", "Popular")}
                    </Badge>
                  )}
                  <h3 className="text-sm font-black text-ink">{pack.nom_pack}</h3>
                  <p className="mt-1 min-h-[2rem] text-[11px] leading-relaxed text-muted">
                    {pack.description}
                  </p>
                  <p className="mt-3 text-2xl font-black text-teal-600">
                    {formatCurrency(pack.prix, lang)}
                  </p>
                  <p className="text-[10px] text-muted">
                    {pack.nb_sessions} {t("séances", "sessions")} ·{" "}
                    {formatCurrency(pack.prix_unitaire, lang)}/{t("séance", "session")}
                  </p>
                  <ul className="mt-3 flex-1 space-y-1.5 text-[11px] text-muted">
                    <li className="flex items-center gap-1.5">
                      <Check className="h-3 w-3 text-success" />
                      {t(`Validité ${pack.duree_jours} jours`, `${pack.duree_jours}-day validity`)}
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Check className="h-3 w-3 text-success" />
                      {t("Tous praticiens du réseau", "All network practitioners")}
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Check className="h-3 w-3 text-success" />
                      {t("Suivi d'humeur inclus", "Mood tracking included")}
                    </li>
                  </ul>
                  <Button
                    variant={pack.is_featured ? "primary" : "outline"}
                    className="mt-4 w-full"
                    disabled={isCurrent}
                    onClick={() => {
                      setBuyTarget(pack);
                      setMethod("baridimob");
                    }}
                  >
                    {isCurrent
                      ? t("Pack actif", "Active pack")
                      : t("Choisir ce pack", "Choose this pack")}
                  </Button>
                </div>
              );
            })}
          </div>

          {(wallet?.historique || []).length > 0 && (
            <section className="card p-5">
              <h2 className="text-sm font-black text-ink">
                {t("Historique des abonnements", "Subscription history")}
              </h2>
              <div className="mt-3 space-y-2">
                {wallet.historique.map((subscription) => (
                  <div
                    key={subscription.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-line bg-white px-3.5 py-2.5"
                  >
                    <div>
                      <p className="text-xs font-bold text-ink">{subscription.pack?.nom_pack}</p>
                      <p className="text-[10px] text-muted">
                        {formatDate(subscription.date_debut, lang, "d MMM yyyy")} →{" "}
                        {formatDate(subscription.date_fin, lang, "d MMM yyyy")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-semibold text-muted">
                        {subscription.solde_restants}/{subscription.pack?.nb_sessions}{" "}
                        {t("restantes", "left")}
                      </span>
                      <StatusBadge status={subscription.statut} />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      <Modal
        open={Boolean(buyTarget)}
        onClose={() => setBuyTarget(null)}
        title={t("Activer un pack", "Activate a pack")}
        description={
          buyTarget
            ? `${buyTarget.nom_pack} · ${buyTarget.nb_sessions} ${t("séances", "sessions")}`
            : ""
        }
        footer={
          <>
            <Button variant="outline" onClick={() => setBuyTarget(null)}>
              {t("Annuler", "Cancel")}
            </Button>
            <Button onClick={buy} loading={buying}>
              <CreditCard className="h-4 w-4" />
              {t("Payer", "Pay")} {buyTarget ? formatCurrency(buyTarget.prix, lang) : ""}
            </Button>
          </>
        }
      >
        {buyTarget && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-sage-50 p-4">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted">{t("Pack", "Pack")}</span>
                <span className="font-bold text-ink">{buyTarget.nom_pack}</span>
              </div>
              <div className="mt-1.5 flex items-center justify-between text-xs">
                <span className="text-muted">{t("Solde après achat", "Balance after purchase")}</span>
                <span className="font-bold text-ink">
                  {formatNumber(
                    Number(wallet?.solde || 0) + Number(buyTarget.nb_sessions || 0),
                    lang,
                  )}{" "}
                  {t("séances", "sessions")}
                </span>
              </div>
              <div className="mt-1.5 flex items-center justify-between text-xs">
                <span className="text-muted">{t("Total à payer", "Total to pay")}</span>
                <span className="text-base font-black text-teal-600">
                  {formatCurrency(buyTarget.prix, lang)}
                </span>
              </div>
            </div>
            <div className="space-y-2">
              {METHODS.map((item) => (
                <RadioCard
                  key={item.value}
                  selected={method === item.value}
                  onChange={() => setMethod(item.value)}
                  label={t(item.fr, item.en)}
                  description={t(item.descFr, item.descEn)}
                />
              ))}
            </div>
            <p className="text-[10px] leading-relaxed text-muted">
              {t(
                "Paiement simulé. En cas d'échec, aucun montant n'est débité et votre solde reste inchangé.",
                "Simulated payment. If it fails, no amount is charged and your balance stays unchanged.",
              )}
            </p>
          </div>
        )}
      </Modal>

      <Modal
        open={Boolean(invoice)}
        onClose={() => setInvoice(null)}
        title={t("Facture", "Invoice")}
        description={invoice?.facture?.numero || t("Chargement…", "Loading…")}
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setInvoice(null)}>
              {t("Fermer", "Close")}
            </Button>
            <Button onClick={() => window.print()} disabled={invoiceLoading || !invoice?.facture}>
              <Download className="h-4 w-4" />
              {t("Imprimer / PDF", "Print / PDF")}
            </Button>
          </>
        }
      >
        {invoiceLoading && (
          <p className="py-8 text-center text-xs text-muted">{t("Chargement de la facture…", "Loading invoice…")}</p>
        )}
        {!invoiceLoading && invoice?.facture && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-line bg-white p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-black text-teal-700">TheraNova</p>
                  <p className="text-[10px] text-muted">{invoice.facture.emetteur}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted">
                    {t("Facture", "Invoice")}
                  </p>
                  <p className="text-xs font-black text-ink">{invoice.facture.numero}</p>
                  <p className="text-[10px] text-muted">
                    {formatDate(invoice.facture.date, lang, "d MMM yyyy")}
                  </p>
                </div>
              </div>
              <div className="mt-5 rounded-2xl bg-sand/50 px-3.5 py-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted">
                  {t("Client", "Client")}
                </p>
                <p className="text-xs font-bold text-ink">{invoice.facture.client}</p>
                <p className="text-[10px] text-muted">{invoice.facture.email}</p>
              </div>
              <div className="mt-3 flex items-center justify-between border-b border-line py-2 text-xs">
                <span className="text-muted">{invoice.facture.libelle}</span>
                <span className="font-bold text-ink">
                  {formatCurrency(invoice.facture.montant, lang)}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 text-[11px] text-muted">
                <span>{t("TVA", "VAT")}</span>
                <span>{formatCurrency(invoice.facture.tva, lang)}</span>
              </div>
              <div className="flex items-center justify-between border-t border-line pt-2">
                <span className="text-sm font-black text-ink">{t("Total", "Total")}</span>
                <span className="text-base font-black text-teal-600">
                  {formatCurrency(invoice.facture.total, lang)}
                </span>
              </div>
              <p className="mt-4 text-[9px] leading-relaxed text-muted">
                {t(
                  "Document généré pour une démonstration académique. Aucune valeur fiscale.",
                  "Document generated for an academic demonstration. No fiscal value.",
                )}
              </p>
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-white px-4 py-3">
              <span className="text-[11px] text-muted">
                {formatDateTime(invoice.date_transaction, lang)}
              </span>
              <StatusBadge status={invoice.statut} />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
