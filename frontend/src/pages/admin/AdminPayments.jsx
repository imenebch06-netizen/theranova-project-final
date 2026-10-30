import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CreditCard,
  Eye,
  FileText,
  Receipt,
  RotateCcw,
  Search,
  TrendingUp,
  Wallet,
  XCircle,
} from "lucide-react";
import api, { extractError, getAll } from "../../lib/api";
import { useI18n } from "../../contexts/I18nContext";
import { useToast } from "../../contexts/ToastContext";
import { Badge, StatusBadge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { EmptyState, ErrorState, LoadingBlock, Skeleton } from "../../components/ui/Feedback";
import { Input, Select } from "../../components/ui/Field";
import Modal from "../../components/ui/Modal";
import Pagination from "../../components/ui/Pagination";
import Tabs from "../../components/ui/Tabs";
import { formatCurrency, formatDate, formatDateTime, toDate } from "../../lib/format";

const PAGE_SIZE = 15;

const TYPE_TABS = [
  { value: "all", fr: "Toutes", en: "All" },
  { value: "Pack", fr: "Packs", en: "Packs" },
  { value: "Seance", fr: "Séances", en: "Sessions" },
  { value: "Abonnement", fr: "Abonnements", en: "Subscriptions" },
  { value: "Remboursement", fr: "Remboursements", en: "Refunds" },
];

const METHOD_LABEL = {
  carte: { fr: "Carte Edahabia", en: "Edahabia card" },
  baridimob: { fr: "BaridiMob", en: "BaridiMob" },
  cib: { fr: "CIB", en: "CIB" },
  credit: { fr: "Crédit TheraNova", en: "TheraNova credit" },
  simule: { fr: "Paiement simulé", en: "Simulated payment" },
};

function transactionTypeLabel(type, t) {
  if (type === "Pack") return t("Pack", "Pack");
  if (type === "Seance") return t("Séance", "Session");
  if (type === "Abonnement") return t("Abonnement", "Subscription");
  if (type === "Remboursement") return t("Remboursement", "Refund");
  return type;
}

export default function AdminPayments() {
  const { t, lang } = useI18n();
  const { error: toastError } = useToast();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("all");
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [invoice, setInvoice] = useState(null);
  const [invoiceLoading, setInvoiceLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const list = await getAll("/billing/admin/transactions/");
      setTransactions(list || []);
    } catch (err) {
      setError(
        extractError(
          err,
          t("Impossible de charger les transactions.", "Unable to load transactions."),
        ),
      );
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(() => {
    const successful = transactions.filter((item) => item.statut === "OK");
    return {
      revenue: successful
        .filter((item) => ["Pack", "Seance"].includes(item.type))
        .reduce((sum, item) => sum + Number(item.montant || 0), 0),
      refunds: transactions
        .filter((item) => item.type === "Remboursement" || item.statut === "REMBOURSEE")
        .reduce((sum, item) => sum + Number(item.montant || 0), 0),
      failed: transactions.filter((item) => item.statut === "ECHEC").length,
      count: successful.length,
    };
  }, [transactions]);

  const counts = useMemo(() => {
    const base = { all: transactions.length };
    TYPE_TABS.slice(1).forEach((item) => {
      base[item.value] = transactions.filter((transaction) => transaction.type === item.value).length;
    });
    return base;
  }, [transactions]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return transactions.filter((transaction) => {
      if (tab !== "all" && transaction.type !== tab) return false;
      if (status !== "all" && transaction.statut !== status) return false;
      const date = toDate(transaction.date_transaction);
      if (dateFrom && date && date < new Date(`${dateFrom}T00:00:00`)) return false;
      if (dateTo && date && date > new Date(`${dateTo}T23:59:59`)) return false;
      if (!query) return true;
      return [
        transaction.reference,
        transaction.facture_numero,
        transaction.patient_nom,
        transaction.patient_email,
        transaction.pack_nom,
        transaction.therapeute,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [transactions, tab, status, dateFrom, dateTo, search]);

  useEffect(() => {
    setPage(1);
  }, [tab, status, dateFrom, dateTo, search]);

  const visible = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page],
  );

  const tabs = TYPE_TABS.map((item) => ({
    value: item.value,
    label: t(item.fr, item.en),
    count: counts[item.value] ?? 0,
  }));

  async function openDetail(transaction) {
    setSelected(transaction);
    setInvoice(null);
    setInvoiceLoading(true);
    try {
      const { data } = await api.get(`/billing/transactions/${transaction.id}/`);
      setInvoice(data.facture || null);
    } catch (err) {
      toastError(extractError(err, t("La facture n'a pas pu être chargée.", "The invoice could not be loaded.")));
    } finally {
      setInvoiceLoading(false);
    }
  }

  if (loading) return <LoadingBlock label={t("Chargement des paiements…", "Loading payments…")} />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="space-y-5">
      <div>
        <p className="overline">{t("Suivi financier", "Financial oversight")}</p>
        <h1 className="mt-1 text-2xl font-black tracking-tight text-ink sm:text-3xl">
          {t("Paiements et transactions", "Payments and transactions")}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {t(
            "Suivez les encaissements, les méthodes de paiement et les remboursements de la plateforme.",
            "Track collections, payment methods and platform refunds.",
          )}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="card flex items-center gap-3 p-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gold/25 text-teal-800">
            <Wallet className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-muted">
              {t("Encaissements", "Collections")}
            </p>
            <p className="text-sm font-black text-ink">{formatCurrency(stats.revenue, lang)}</p>
          </div>
        </div>
        <div className="card flex items-center gap-3 p-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-success/10 text-success">
            <TrendingUp className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-muted">
              {t("Transactions réussies", "Successful transactions")}
            </p>
            <p className="text-lg font-black text-ink">{stats.count}</p>
          </div>
        </div>
        <div className="card flex items-center gap-3 p-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-warn/10 text-warn">
            <RotateCcw className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-muted">
              {t("Remboursements", "Refunds")}
            </p>
            <p className="text-sm font-black text-ink">{formatCurrency(stats.refunds, lang)}</p>
          </div>
        </div>
        <div className="card flex items-center gap-3 p-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-risk/10 text-risk">
            <XCircle className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-muted">
              {t("Échecs", "Failures")}
            </p>
            <p className="text-lg font-black text-ink">{stats.failed}</p>
          </div>
        </div>
      </div>

      <Tabs tabs={tabs} value={tab} onChange={setTab} className="w-fit" />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Input
          label={t("Rechercher", "Search")}
          name="search"
          icon={Search}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t("Référence, patient, pack…", "Reference, patient, pack…")}
          className="sm:col-span-2"
        />
        <Select
          label={t("Statut", "Status")}
          name="status"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          <option value="all">{t("Tous les statuts", "All statuses")}</option>
          <option value="OK">{t("Réussies", "Successful")}</option>
          <option value="ECHEC">{t("Échouées", "Failed")}</option>
          <option value="REMBOURSEE">{t("Remboursées", "Refunded")}</option>
        </Select>
        <div className="grid grid-cols-2 gap-2">
          <Input
            label={t("Du", "From")}
            name="date_from"
            type="date"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
          />
          <Input
            label={t("Au", "To")}
            name="date_to"
            type="date"
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
          />
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title={t("Aucune transaction", "No transaction")}
          description={t(
            "Ajustez les filtres ou la recherche pour afficher d'autres paiements.",
            "Adjust the filters or search to display other payments.",
          )}
        />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t("Référence", "Reference")}</th>
                <th>{t("Patient", "Patient")}</th>
                <th>{t("Type", "Type")}</th>
                <th>{t("Méthode", "Method")}</th>
                <th>{t("Montant", "Amount")}</th>
                <th>{t("Date", "Date")}</th>
                <th>{t("Statut", "Status")}</th>
                <th className="text-right">{t("Facture", "Invoice")}</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((transaction) => (
                <tr key={transaction.id}>
                  <td>
                    <p className="text-[11px] font-black text-ink">{transaction.reference}</p>
                    <p className="text-[9px] text-muted">{transaction.facture_numero}</p>
                  </td>
                  <td>
                    <p className="text-[11px] font-bold text-ink">
                      {transaction.patient_nom || "—"}
                    </p>
                    <p className="text-[9px] text-muted">{transaction.patient_email}</p>
                  </td>
                  <td>
                    <Badge tone={transaction.type === "Remboursement" ? "warn" : "sage"}>
                      {transactionTypeLabel(transaction.type, t)}
                    </Badge>
                    {transaction.pack_nom && (
                      <p className="mt-0.5 max-w-[160px] truncate text-[9px] text-muted">
                        {transaction.pack_nom}
                      </p>
                    )}
                  </td>
                  <td className="text-[10px] font-semibold text-muted">
                    {METHOD_LABEL[transaction.methode]
                      ? t(METHOD_LABEL[transaction.methode].fr, METHOD_LABEL[transaction.methode].en)
                      : transaction.methode_display || transaction.methode}
                  </td>
                  <td className="text-xs font-black text-teal-600">
                    {formatCurrency(transaction.montant, lang)}
                  </td>
                  <td className="text-[10px] text-muted">
                    {formatDateTime(transaction.date_transaction, lang)}
                  </td>
                  <td>
                    <StatusBadge status={transaction.statut} />
                  </td>
                  <td>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => openDetail(transaction)}
                        className="icon-btn"
                        aria-label={t("Voir la facture", "View invoice")}
                        title={t("Voir la facture", "View invoice")}
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination page={page} count={filtered.length} pageSize={PAGE_SIZE} onChange={setPage} />

      <Modal
        open={Boolean(selected)}
        onClose={() => {
          setSelected(null);
          setInvoice(null);
        }}
        title={t("Facture", "Invoice")}
        description={selected ? selected.reference : ""}
        footer={
          <Button
            variant="outline"
            onClick={() => {
              setSelected(null);
              setInvoice(null);
            }}
          >
            {t("Fermer", "Close")}
          </Button>
        }
      >
        {selected && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sage-100 text-teal-600">
                  <FileText className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-black text-ink">
                    {transactionTypeLabel(selected.type, t)}
                  </p>
                  <p className="text-[10px] text-muted">
                    {formatDateTime(selected.date_transaction, lang)}
                  </p>
                </div>
              </div>
              <StatusBadge status={selected.statut} />
            </div>

            {invoiceLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : invoice ? (
              <>
                <div className="rounded-2xl border border-line bg-white p-4">
                  <p className="text-[10px] font-black uppercase tracking-wider text-muted">
                    {t("Émetteur", "Issuer")}
                  </p>
                  <p className="mt-1 text-xs font-bold text-ink">{invoice.emetteur}</p>
                  <div className="mt-3 grid gap-2 text-[11px] sm:grid-cols-2">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-wider text-muted">
                        {t("Client", "Client")}
                      </p>
                      <p className="font-semibold text-ink">{invoice.client}</p>
                      <p className="text-[10px] text-muted">{invoice.email}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-wider text-muted">
                        {t("Facture n°", "Invoice no.")}
                      </p>
                      <p className="font-semibold text-ink">{invoice.numero}</p>
                      <p className="text-[10px] text-muted">
                        {formatDate(invoice.date, lang, "d MMMM yyyy")}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl bg-sand/50 p-4 text-[11px]">
                  <div className="flex items-center justify-between">
                    <span className="text-muted">{t("Libellé", "Description")}</span>
                    <span className="font-semibold text-ink">{invoice.libelle}</span>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between">
                    <span className="text-muted">{t("Montant HT", "Amount excl. tax")}</span>
                    <span className="font-semibold text-ink">
                      {formatCurrency(invoice.montant, lang)}
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between">
                    <span className="text-muted">{t("TVA", "VAT")}</span>
                    <span className="font-semibold text-ink">{invoice.tva}%</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between border-t border-line pt-2">
                    <span className="font-black text-ink">{t("Total", "Total")}</span>
                    <span className="text-sm font-black text-teal-600">
                      {formatCurrency(invoice.total, lang)}
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-2 rounded-2xl bg-sand/50 p-4 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="text-muted">{t("Patient", "Patient")}</span>
                  <span className="font-semibold text-ink">{selected.patient_nom || "—"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted">{t("Montant", "Amount")}</span>
                  <span className="font-black text-teal-600">
                    {formatCurrency(selected.montant, lang)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted">{t("Méthode", "Method")}</span>
                  <span className="font-semibold text-ink">
                    {METHOD_LABEL[selected.methode]
                      ? t(METHOD_LABEL[selected.methode].fr, METHOD_LABEL[selected.methode].en)
                      : selected.methode_display || selected.methode}
                  </span>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between rounded-2xl border border-line bg-white px-3 py-2 text-[10px] text-muted">
              <span className="inline-flex items-center gap-1.5">
                <CreditCard className="h-3.5 w-3.5 text-teal-500" />
                {t("Transaction", "Transaction")} #{selected.id}
              </span>
              <span className="font-bold text-ink">{selected.facture_numero}</span>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
