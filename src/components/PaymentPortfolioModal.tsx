import { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  CreditCard,
  Edit3,
  FileCheck2,
  FileSpreadsheet,
  Plus,
  Receipt,
  RotateCcw,
  Search,
  Trash2,
  Wallet,
  X,
} from 'lucide-react';
import type {
  Customer,
  Language,
  PaymentInstrument,
  PaymentInstrumentPayload,
  PaymentInstrumentStatus,
  PaymentInstrumentType,
  PaymentPortfolioSummary,
} from '../types';
import { formatCurrency, formatNumber, translations } from '../i18n';
import { convertFromMad, convertToMad } from '../utils/currency';
import { saveOrShareBlob } from '../utils/download';

interface PaymentPortfolioModalProps {
  isOpen: boolean;
  lang: Language;
  currency: string;
  instruments: PaymentInstrument[];
  summary: PaymentPortfolioSummary;
  customers: Customer[];
  onClose: () => void;
  onCreateInstrument: (payload: PaymentInstrumentPayload) => Promise<void>;
  onUpdateInstrument: (
    id: string,
    payload: Partial<PaymentInstrumentPayload>
  ) => Promise<void>;
  onDeleteInstrument: (id: string) => Promise<void>;
  onNotify?: (message: string) => void;
}

type SortOrder = 'due_asc' | 'due_desc' | 'receipt_desc' | 'receipt_asc';
type DateTarget = 'dueDate' | 'receiptDate';

interface InstrumentFormState {
  instrumentType: PaymentInstrumentType;
  customerId: string;
  customerName: string;
  customerPhone: string;
  holderName: string;
  bankName: string;
  instrumentNumber: string;
  amountDisplay: string;
  blNumber: string;
  invoiceNumber: string;
  receiptDate: string;
  dueDate: string;
  status: PaymentInstrumentStatus;
  notes: string;
}

const todayIso = () => new Date().toISOString().slice(0, 10);

export function PaymentPortfolioModal({
  isOpen,
  lang,
  currency,
  instruments,
  summary,
  customers,
  onClose,
  onCreateInstrument,
  onUpdateInstrument,
  onDeleteInstrument,
  onNotify,
}: PaymentPortfolioModalProps) {
  const t = translations[lang];

  const [typeFilter, setTypeFilter] = useState<'all' | PaymentInstrumentType>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | PaymentInstrumentStatus>('all');
  const [dateTarget, setDateTarget] = useState<DateTarget>('dueDate');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortOrder, setSortOrder] = useState<SortOrder>('due_asc');
  const [searchQuery, setSearchQuery] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [editingInstrument, setEditingInstrument] = useState<PaymentInstrument | null>(null);
  const [formState, setFormState] = useState<InstrumentFormState>({
    instrumentType: 'check',
    customerId: '',
    customerName: '',
    customerPhone: '',
    holderName: '',
    bankName: '',
    instrumentNumber: '',
    amountDisplay: '',
    blNumber: '',
    invoiceNumber: '',
    receiptDate: todayIso(),
    dueDate: todayIso(),
    status: 'pending',
    notes: '',
  });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const today = todayIso();

  const typeLabel = (type: PaymentInstrumentType) => {
    if (type === 'check') return t.portfolioTypeCheck;
    if (type === 'bill_of_exchange') return t.portfolioTypeBillOfExchange;
    return t.portfolioTypeCard;
  };

  const statusLabel = (status: PaymentInstrumentStatus) => {
    if (status === 'deposited') return t.portfolioStatusDeposited;
    if (status === 'collected') return t.portfolioStatusCollected;
    if (status === 'bounced') return t.portfolioStatusBounced;
    if (status === 'cancelled') return t.portfolioStatusCancelled;
    return t.portfolioStatusPending;
  };

  const statusColorClass = (status: PaymentInstrumentStatus) => {
    if (status === 'collected') {
      return 'border-[#10B981]/40 bg-[#ECF7F1] text-[#065F46] dark:border-[#10B981]/35 dark:bg-[#0D2E22] dark:text-[#34D399]';
    }
    if (status === 'deposited') {
      return 'border-[#0284C7]/35 bg-[#E0F2FE] text-[#075985] dark:border-[#38BDF8]/30 dark:bg-[#0B2333] dark:text-[#7DD3FC]';
    }
    if (status === 'bounced') {
      return 'border-[#DC2626]/35 bg-[#FEE2E2] text-[#991B1B] dark:border-[#F87171]/35 dark:bg-[#2F1114] dark:text-[#FCA5A5]';
    }
    if (status === 'cancelled') {
      return 'border-[#94A3B8]/35 bg-[#F1F5F9] text-[#475569] dark:border-[#64748B]/30 dark:bg-[#1E293B] dark:text-[#94A3B8]';
    }
    return 'border-[#D97706]/35 bg-[#FEF3C7] text-[#92400E] dark:border-[#F59E0B]/30 dark:bg-[#2B1F0B] dark:text-[#FBBF24]';
  };

  const filteredAndSorted = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = instruments.filter((inst) => {
      if (typeFilter !== 'all' && inst.instrumentType !== typeFilter) return false;
      if (statusFilter !== 'all' && inst.status !== statusFilter) return false;

      const targetVal = dateTarget === 'dueDate' ? inst.dueDate : inst.receiptDate;
      if (dateFrom && (!targetVal || targetVal < dateFrom)) return false;
      if (dateTo && (!targetVal || targetVal > dateTo)) return false;

      if (q) {
        const hay = [
          inst.instrumentNumber,
          inst.bankName,
          inst.holderName,
          inst.customerName,
          inst.customerPhone,
          inst.blNumber,
          inst.invoiceNumber,
          inst.notes,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }

      return true;
    });

    const sorted = [...list].sort((a, b) => {
      if (sortOrder === 'due_asc') {
        return (a.dueDate || '9999-12-31').localeCompare(b.dueDate || '9999-12-31') ||
          b.createdAt.localeCompare(a.createdAt);
      }
      if (sortOrder === 'due_desc') {
        return (b.dueDate || '').localeCompare(a.dueDate || '') ||
          b.createdAt.localeCompare(a.createdAt);
      }
      if (sortOrder === 'receipt_desc') {
        return (b.receiptDate || '').localeCompare(a.receiptDate || '') ||
          b.createdAt.localeCompare(a.createdAt);
      }
      return (a.receiptDate || '').localeCompare(b.receiptDate || '') ||
        a.createdAt.localeCompare(b.createdAt);
    });

    return sorted;
  }, [instruments, typeFilter, statusFilter, dateTarget, dateFrom, dateTo, searchQuery, sortOrder]);

  const filteredTotalMad = useMemo(
    () =>
      filteredAndSorted
        .filter((item) => item.status !== 'cancelled')
        .reduce((acc, item) => acc + (Number(item.amount) || 0), 0),
    [filteredAndSorted]
  );

  if (!isOpen) return null;

  const openNewForm = () => {
    setEditingInstrument(null);
    setFormError('');
    setFormState({
      instrumentType: typeFilter === 'all' ? 'check' : typeFilter,
      customerId: '',
      customerName: '',
      customerPhone: '',
      holderName: '',
      bankName: '',
      instrumentNumber: '',
      amountDisplay: '',
      blNumber: '',
      invoiceNumber: '',
      receiptDate: todayIso(),
      dueDate: todayIso(),
      status: 'pending',
      notes: '',
    });
    setFormOpen(true);
  };

  const openEditForm = (inst: PaymentInstrument) => {
    setEditingInstrument(inst);
    setFormError('');
    const amtDisplay = convertFromMad(inst.amount || 0, currency);
    setFormState({
      instrumentType: inst.instrumentType,
      customerId: inst.customerId || '',
      customerName: inst.customerName || '',
      customerPhone: inst.customerPhone || '',
      holderName: inst.holderName || '',
      bankName: inst.bankName || '',
      instrumentNumber: inst.instrumentNumber || '',
      amountDisplay: amtDisplay ? String(Math.round(amtDisplay * 100) / 100) : '',
      blNumber: inst.blNumber || '',
      invoiceNumber: inst.invoiceNumber || '',
      receiptDate: inst.receiptDate || todayIso(),
      dueDate: inst.dueDate || inst.receiptDate || todayIso(),
      status: inst.status,
      notes: inst.notes || '',
    });
    setFormOpen(true);
  };

  const handleSelectCustomer = (custId: string) => {
    const found = customers.find((c) => c.id === custId);
    if (!found) {
      setFormState((prev) => ({ ...prev, customerId: '' }));
      return;
    }
    setFormState((prev) => ({
      ...prev,
      customerId: found.id,
      customerName: found.name,
      customerPhone: found.phone || prev.customerPhone,
      holderName: prev.holderName.trim() ? prev.holderName : found.name,
    }));
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    const amt = Number(formState.amountDisplay) || 0;
    if (amt <= 0) {
      setFormError(t.portfolioAmountLabel);
      return;
    }
    if (formState.instrumentType === 'card') {
      if (!formState.holderName.trim() || !formState.instrumentNumber.trim()) {
        setFormError(t.portfolioValidationCardRequired);
        return;
      }
    } else if (
      !formState.bankName.trim() ||
      !formState.instrumentNumber.trim() ||
      !formState.holderName.trim() ||
      !formState.dueDate.trim()
    ) {
      setFormError(`${t.portfolioValidationRequired} ${typeLabel(formState.instrumentType)}`);
      return;
    }

    const amountMad = convertToMad(amt, currency);
    const payload: PaymentInstrumentPayload = {
      instrumentType: formState.instrumentType,
      customerId: formState.customerId || '',
      customerName: formState.customerName.trim() || formState.holderName.trim(),
      customerPhone: formState.customerPhone.trim(),
      holderName: formState.holderName.trim(),
      bankName: formState.bankName.trim(),
      instrumentNumber: formState.instrumentNumber.trim(),
      amount: amountMad,
      blNumber: formState.blNumber.trim(),
      invoiceNumber: formState.invoiceNumber.trim() || formState.blNumber.trim(),
      receiptDate: formState.receiptDate || todayIso(),
      dueDate: formState.dueDate || formState.receiptDate || todayIso(),
      status: formState.status,
      notes: formState.notes.trim(),
    };

    setSaving(true);
    try {
      if (editingInstrument) {
        await onUpdateInstrument(editingInstrument.id, payload);
      } else {
        await onCreateInstrument(payload);
      }
      setFormOpen(false);
      onNotify?.(t.portfolioSavedToast);
    } catch {
      setFormError(t.errorSave);
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (id: string, nextStatus: PaymentInstrumentStatus) => {
    setUpdatingStatusId(id);
    try {
      await onUpdateInstrument(id, { status: nextStatus });
      onNotify?.(t.portfolioStatusUpdatedToast);
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const handleDelete = async (id: string) => {
    await onDeleteInstrument(id);
    setConfirmDeleteId(null);
    onNotify?.(t.portfolioDeletedToast);
  };

  const handleExportExcel = async () => {
    if (exporting || filteredAndSorted.length === 0) return;
    setExporting(true);
    try {
      const rows = filteredAndSorted.map((item) => ({
        [t.adjustmentTypeLabel]: typeLabel(item.instrumentType),
        [t.portfolioNumberLabel]: item.instrumentNumber,
        [t.portfolioBankLabel]: item.bankName,
        [t.portfolioHolderLabel]: item.holderName,
        [t.portfolioCustomerPhoneLabel]: item.customerPhone || '',
        [t.portfolioBlNumberLabel]: item.blNumber || item.invoiceNumber || '',
        [t.portfolioReceiptDateLabel]: item.receiptDate,
        [t.portfolioDueDateLabel]: item.dueDate,
        [`${t.portfolioAmountLabel} (${currency})`]: Number(
          (convertFromMad(item.amount || 0, currency) || 0).toFixed(2)
        ),
        [t.portfolioStatusLabel]: statusLabel(item.status),
        [t.warehouseNotesLabel]: item.notes || '',
      }));

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Portefeuille');
      const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
      const blob = new Blob([buf], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      await saveOrShareBlob(
        blob,
        `portefeuille-effets-${todayIso()}.xlsx`,
        t.portfolioTitle
      );
    } finally {
      setExporting(false);
    }
  };

  const inputClass =
    'min-h-[44px] w-full rounded-xl border border-[#DCE7E0] bg-[#F7FAF8] px-3 py-2 text-sm text-[#0B1F16] placeholder:text-[#6B8A79] focus:border-[#115E3B] focus:bg-white focus:outline-none dark:border-[#1E3A2D] dark:bg-[#091611] dark:text-[#F2F9F5] dark:placeholder:text-[#8FB39E] dark:focus:border-[#10B981] dark:focus:bg-[#0D1E16]';

  const typeIcon = (type: PaymentInstrumentType) => {
    if (type === 'check') return <Receipt className="h-4 w-4 text-[#075985] dark:text-[#38BDF8]" />;
    if (type === 'bill_of_exchange') {
      return <FileCheck2 className="h-4 w-4 text-[#92400E] dark:text-[#FBBF24]" />;
    }
    return <CreditCard className="h-4 w-4 text-[#115E3B] dark:text-[#34D399]" />;
  };

  return (
    <div
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-0 backdrop-blur-xs sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t.portfolioTitle}
    >
      <div className="flex h-dvh w-full max-w-6xl flex-col overflow-hidden bg-white sm:h-[92vh] sm:rounded-3xl sm:border sm:border-[#DCE7E0] dark:bg-[#0F2119] dark:sm:border-[#1E3A2D]">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#DCE7E0] px-4 py-3.5 sm:px-6 dark:border-[#1E3A2D]">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#ECF7F1] text-[#115E3B] dark:bg-[#132B20] dark:text-[#34D399]">
              <Wallet className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h2 className="truncate font-display text-base font-bold text-[#0B1F16] sm:text-lg dark:text-[#F2F9F5]">
                {t.portfolioTitle}
              </h2>
              <p className="truncate text-xs text-[#335947] dark:text-[#9EC0AE]">
                {t.portfolioSubtitle}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void handleExportExcel()}
              disabled={exporting || filteredAndSorted.length === 0}
              className="flex min-h-[44px] items-center gap-1.5 rounded-xl border border-[#DCE7E0] bg-white px-3 text-xs font-bold text-[#115E3B] transition-colors hover:bg-[#ECF7F1] disabled:opacity-50 whitespace-nowrap dark:border-[#1E3A2D] dark:bg-[#0B1913] dark:text-[#34D399] dark:hover:bg-[#162E23]"
            >
              <FileSpreadsheet className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">{t.portfolioExportExcel}</span>
              <span className="sm:hidden">Excel</span>
            </button>

            <button
              type="button"
              onClick={openNewForm}
              className="flex min-h-[44px] items-center gap-1.5 rounded-xl bg-[#115E3B] px-3.5 text-xs font-bold text-white transition-colors hover:bg-[#0D4A2E] whitespace-nowrap dark:bg-[#10B981] dark:text-[#052E1C]"
            >
              <Plus className="h-4 w-4 shrink-0" />
              <span>{t.portfolioAddButton}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label={t.close}
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#DCE7E0] text-[#335947] hover:bg-[#ECF7F1] dark:border-[#1E3A2D] dark:text-[#9EC0AE] dark:hover:bg-[#162E23]"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto bg-[#F7FAF8] p-4 sm:p-6 dark:bg-[#08130E]">
          {/* KPI Summary Cards */}
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="rounded-2xl border border-[#DCE7E0] bg-white p-3.5 dark:border-[#1E3A2D] dark:bg-[#0F2119]">
              <p className="text-[11px] font-semibold text-[#335947] dark:text-[#9EC0AE]">
                {t.portfolioKpiPending}
              </p>
              <p className="tabular-nums mt-1 font-display text-lg font-bold text-[#92400E] sm:text-xl dark:text-[#FBBF24]">
                {formatCurrency(summary.pendingAmountMad, currency, lang)}
              </p>
              <p className="tabular-nums mt-0.5 text-[11px] text-[#6B8A79] dark:text-[#8FB39E]">
                {formatNumber(summary.pendingCount, lang)} {t.posItemCountUnit}
              </p>
            </div>

            <div className="rounded-2xl border border-[#DCE7E0] bg-white p-3.5 dark:border-[#1E3A2D] dark:bg-[#0F2119]">
              <p className="text-[11px] font-semibold text-[#335947] dark:text-[#9EC0AE]">
                {t.portfolioKpiDueSoon}
              </p>
              <p className="tabular-nums mt-1 font-display text-lg font-bold text-[#075985] sm:text-xl dark:text-[#38BDF8]">
                {formatCurrency(summary.dueSoonAmountMad, currency, lang)}
              </p>
              <p className="tabular-nums mt-0.5 text-[11px] text-[#6B8A79] dark:text-[#8FB39E]">
                {formatNumber(summary.dueSoonCount, lang)} {t.posItemCountUnit}
              </p>
            </div>

            <div className="rounded-2xl border border-[#DCE7E0] bg-white p-3.5 dark:border-[#1E3A2D] dark:bg-[#0F2119]">
              <p className="text-[11px] font-semibold text-[#335947] dark:text-[#9EC0AE]">
                {t.portfolioKpiCollected}
              </p>
              <p className="tabular-nums mt-1 font-display text-lg font-bold text-[#115E3B] sm:text-xl dark:text-[#34D399]">
                {formatCurrency(summary.collectedAmountMad, currency, lang)}
              </p>
              <p className="tabular-nums mt-0.5 text-[11px] text-[#6B8A79] dark:text-[#8FB39E]">
                {formatNumber(summary.collectedCount, lang)} {t.posItemCountUnit}
              </p>
            </div>

            <div className="rounded-2xl border border-[#DCE7E0] bg-white p-3.5 dark:border-[#1E3A2D] dark:bg-[#0F2119]">
              <p className="text-[11px] font-semibold text-[#335947] dark:text-[#9EC0AE]">
                {t.portfolioKpiBounced}
              </p>
              <p className="tabular-nums mt-1 font-display text-lg font-bold text-[#DC2626] sm:text-xl dark:text-[#F87171]">
                {formatCurrency(summary.bouncedAmountMad, currency, lang)}
              </p>
              <p className="tabular-nums mt-0.5 text-[11px] text-[#6B8A79] dark:text-[#8FB39E]">
                {formatNumber(summary.bouncedCount, lang)} {t.posItemCountUnit}
              </p>
            </div>
          </div>

          {/* Filter & Organization Bar */}
          <div className="mb-4 space-y-3 rounded-2xl border border-[#DCE7E0] bg-white p-3.5 dark:border-[#1E3A2D] dark:bg-[#0F2119]">
            {/* Type Tabs + Search */}
            <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-[#DCE7E0] bg-[#F7FAF8] p-1 dark:border-[#1E3A2D] dark:bg-[#091611]">
                {(
                  [
                    ['all', t.portfolioTypeAll],
                    ['check', t.portfolioTypeCheck],
                    ['bill_of_exchange', t.portfolioTypeBillOfExchange],
                    ['card', t.portfolioTypeCard],
                  ] as Array<['all' | PaymentInstrumentType, string]>
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setTypeFilter(key)}
                    className={`min-h-[38px] rounded-lg px-3 text-xs font-bold transition-colors whitespace-nowrap ${
                      typeFilter === key
                        ? 'bg-[#115E3B] text-white dark:bg-[#10B981] dark:text-[#052E1C]'
                        : 'text-[#335947] hover:bg-[#ECF7F1] dark:text-[#9EC0AE] dark:hover:bg-[#162E23]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="relative flex-1 lg:max-w-sm">
                <Search
                  className={`pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-[#335947] dark:text-[#9EC0AE] ${
                    lang === 'ar' ? 'right-3' : 'left-3'
                  }`}
                />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t.portfolioSearchPlaceholder}
                  className={`${inputClass} ${lang === 'ar' ? 'pr-9 pl-3' : 'pl-9 pr-3'}`}
                />
              </div>
            </div>

            {/* Status + Date Target + Date Range + Sort */}
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-6">
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-[#335947] dark:text-[#9EC0AE]">
                  {t.portfolioStatusLabel}
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) =>
                    setStatusFilter(e.target.value as 'all' | PaymentInstrumentStatus)
                  }
                  className={inputClass}
                >
                  <option value="all">{t.portfolioStatusAll}</option>
                  <option value="pending">{t.portfolioStatusPending}</option>
                  <option value="deposited">{t.portfolioStatusDeposited}</option>
                  <option value="collected">{t.portfolioStatusCollected}</option>
                  <option value="bounced">{t.portfolioStatusBounced}</option>
                  <option value="cancelled">{t.portfolioStatusCancelled}</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-semibold text-[#335947] dark:text-[#9EC0AE]">
                  {t.portfolioDateFilterTarget}
                </label>
                <select
                  value={dateTarget}
                  onChange={(e) => setDateTarget(e.target.value as DateTarget)}
                  className={inputClass}
                >
                  <option value="dueDate">{t.portfolioDateTargetDue}</option>
                  <option value="receiptDate">{t.portfolioDateTargetReceipt}</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-semibold text-[#335947] dark:text-[#9EC0AE]">
                  {t.purchasesFilterDateFrom}
                </label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-semibold text-[#335947] dark:text-[#9EC0AE]">
                  {t.purchasesFilterDateTo}
                </label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-semibold text-[#335947] dark:text-[#9EC0AE]">
                  {t.portfolioSortLabel}
                </label>
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as SortOrder)}
                  className={inputClass}
                >
                  <option value="due_asc">{t.portfolioSortDueAsc}</option>
                  <option value="due_desc">{t.portfolioSortDueDesc}</option>
                  <option value="receipt_desc">{t.portfolioSortReceiptDesc}</option>
                  <option value="receipt_asc">{t.portfolioSortReceiptAsc}</option>
                </select>
              </div>

              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => {
                    setTypeFilter('all');
                    setStatusFilter('all');
                    setDateTarget('dueDate');
                    setDateFrom('');
                    setDateTo('');
                    setSortOrder('due_asc');
                    setSearchQuery('');
                  }}
                  className="flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl border border-[#DCE7E0] bg-[#F7FAF8] px-3 text-xs font-semibold text-[#335947] hover:bg-[#ECF7F1] dark:border-[#1E3A2D] dark:bg-[#091611] dark:text-[#9EC0AE] dark:hover:bg-[#162E23]"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>{t.purchasesFilterReset}</span>
                </button>
              </div>
            </div>

            {/* Active Result Strip */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#DCE7E0] pt-2.5 text-xs dark:border-[#1E3A2D]">
              <span className="font-semibold text-[#335947] dark:text-[#9EC0AE]">
                {t.purchasesFilterResultCount}:{' '}
                <strong className="tabular-nums text-[#0B1F16] dark:text-[#F2F9F5]">
                  {formatNumber(filteredAndSorted.length, lang)}
                </strong>
              </span>
              <span className="font-semibold text-[#335947] dark:text-[#9EC0AE]">
                {t.purchaseTotalLabel}:{' '}
                <strong className="tabular-nums text-[#115E3B] dark:text-[#34D399]">
                  {formatCurrency(filteredTotalMad, currency, lang)}
                </strong>
              </span>
            </div>
          </div>

          {/* Empty State or Portfolio Rows */}
          {filteredAndSorted.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#DCE7E0] bg-white px-6 py-12 text-center dark:border-[#1E3A2D] dark:bg-[#0F2119]">
              <Wallet className="mx-auto h-10 w-10 text-[#6B8A79] dark:text-[#8FB39E]" />
              <h3 className="mt-3 font-display text-base font-bold text-[#0B1F16] dark:text-[#F2F9F5]">
                {t.portfolioEmptyTitle}
              </h3>
              <p className="mx-auto mt-1 max-w-md text-xs text-[#335947] dark:text-[#9EC0AE]">
                {t.portfolioEmptySubtitle}
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredAndSorted.map((inst) => {
                const isOpenStatus = inst.status === 'pending' || inst.status === 'deposited';
                const isOverdue = isOpenStatus && Boolean(inst.dueDate) && inst.dueDate < today;
                const isDueToday = isOpenStatus && Boolean(inst.dueDate) && inst.dueDate === today;

                return (
                  <article
                    key={inst.id}
                    className={`rounded-2xl border bg-white p-3.5 transition-colors sm:p-4 dark:bg-[#0F2119] ${
                      isOverdue
                        ? 'border-[#DC2626]/45 dark:border-[#F87171]/40'
                        : 'border-[#DCE7E0] dark:border-[#1E3A2D]'
                    }`}
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      {/* Left Info Block */}
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0B1F16] dark:text-[#F2F9F5]">
                            {typeIcon(inst.instrumentType)}
                            <span>{typeLabel(inst.instrumentType)}</span>
                          </span>

                          <span className="text-xs font-bold text-[#115E3B] tabular-nums dark:text-[#34D399]">
                            #{inst.instrumentNumber || '—'}
                          </span>

                          {inst.bankName && (
                            <span className="text-xs font-medium text-[#335947] dark:text-[#9EC0AE]">
                              · {inst.bankName}
                            </span>
                          )}

                          {(inst.blNumber || inst.invoiceNumber) && (
                            <span className="text-xs font-semibold text-[#075985] tabular-nums dark:text-[#7DD3FC]">
                              · {inst.blNumber || inst.invoiceNumber}
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#335947] dark:text-[#9EC0AE]">
                          <span>
                            <strong className="text-[#0B1F16] dark:text-[#F2F9F5]">
                              {inst.holderName || inst.customerName}
                            </strong>
                            {inst.customerPhone ? ` · ${inst.customerPhone}` : ''}
                          </span>

                          <span className="inline-flex items-center gap-1 tabular-nums">
                            <Calendar className="h-3.5 w-3.5 opacity-75" />
                            <span>
                              {t.portfolioReceiptDateLabel}: {inst.receiptDate || '—'}
                            </span>
                          </span>

                          <span
                            className={`inline-flex items-center gap-1 font-semibold tabular-nums ${
                              isOverdue
                                ? 'text-[#DC2626] dark:text-[#F87171]'
                                : isDueToday
                                  ? 'text-[#B45309] dark:text-[#FBBF24]'
                                  : 'text-[#0B1F16] dark:text-[#F2F9F5]'
                            }`}
                          >
                            {isOverdue && <AlertTriangle className="h-3.5 w-3.5 shrink-0" />}
                            <span>
                              {inst.instrumentType === 'card'
                                ? t.portfolioCardSettlementDateLabel
                                : t.portfolioDueDateLabel}
                              : {inst.dueDate || '—'}
                            </span>
                            {isOverdue && ` (${t.portfolioOverdueTag})`}
                            {isDueToday && ` (${t.portfolioTodayTag})`}
                          </span>
                        </div>

                        {inst.notes && (
                          <p className="text-[11px] text-[#6B8A79] dark:text-[#8FB39E]">
                            {inst.notes}
                          </p>
                        )}
                      </div>

                      {/* Right Amount + Status + Actions */}
                      <div className="flex flex-wrap items-center justify-between gap-2.5 lg:justify-end">
                        <span className="tabular-nums font-display text-base font-bold text-[#115E3B] sm:text-lg dark:text-[#34D399]">
                          {formatCurrency(inst.amount, currency, lang)}
                        </span>

                        <select
                          value={inst.status}
                          disabled={updatingStatusId === inst.id}
                          onChange={(e) =>
                            void handleStatusChange(
                              inst.id,
                              e.target.value as PaymentInstrumentStatus
                            )
                          }
                          aria-label={t.portfolioStatusLabel}
                          className={`min-h-[40px] rounded-xl border px-2.5 text-xs font-bold focus:outline-none ${statusColorClass(
                            inst.status
                          )}`}
                        >
                          <option value="pending">{t.portfolioStatusPending}</option>
                          <option value="deposited">{t.portfolioStatusDeposited}</option>
                          <option value="collected">{t.portfolioStatusCollected}</option>
                          <option value="bounced">{t.portfolioStatusBounced}</option>
                          <option value="cancelled">{t.portfolioStatusCancelled}</option>
                        </select>

                        <button
                          type="button"
                          onClick={() => openEditForm(inst)}
                          aria-label={t.edit}
                          className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#DCE7E0] text-[#335947] hover:bg-[#ECF7F1] dark:border-[#1E3A2D] dark:text-[#9EC0AE] dark:hover:bg-[#162E23]"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>

                        {confirmDeleteId === inst.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => void handleDelete(inst.id)}
                              className="min-h-[40px] rounded-xl bg-[#DC2626] px-2.5 text-xs font-bold text-white"
                            >
                              {t.confirmDeleteAction}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="min-h-[40px] rounded-xl border border-[#DCE7E0] px-2 text-xs font-semibold text-[#335947] dark:border-[#1E3A2D] dark:text-[#9EC0AE]"
                            >
                              {t.cancel}
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(inst.id)}
                            aria-label={t.delete}
                            className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#DCE7E0] text-[#DC2626] hover:bg-[#FEE2E2] dark:border-[#1E3A2D] dark:text-[#F87171] dark:hover:bg-[#2F1114]"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit Sub-Modal */}
      {formOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 p-3 backdrop-blur-xs">
          <div className="max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-3xl border border-[#DCE7E0] bg-white p-5 shadow-2xl dark:border-[#1E3A2D] dark:bg-[#0F2119]">
            <div className="mb-4 flex items-center justify-between border-b border-[#DCE7E0] pb-3 dark:border-[#1E3A2D]">
              <h3 className="font-display text-base font-bold text-[#0B1F16] dark:text-[#F2F9F5]">
                {editingInstrument ? t.portfolioEditTitle : t.portfolioNewTitle}
              </h3>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#DCE7E0] text-[#335947] hover:bg-[#ECF7F1] dark:border-[#1E3A2D] dark:text-[#9EC0AE]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={(e) => void handleSubmitForm(e)} className="space-y-3.5">
              {/* Type Buttons */}
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    ['check', t.portfolioTypeCheck],
                    ['bill_of_exchange', t.portfolioTypeBillOfExchange],
                    ['card', t.portfolioTypeCard],
                  ] as Array<[PaymentInstrumentType, string]>
                ).map(([typeKey, label]) => (
                  <button
                    key={typeKey}
                    type="button"
                    onClick={() =>
                      setFormState((prev) => ({ ...prev, instrumentType: typeKey }))
                    }
                    className={`min-h-[44px] rounded-xl border px-2 text-xs font-bold transition-colors ${
                      formState.instrumentType === typeKey
                        ? 'border-[#115E3B] bg-[#115E3B] text-white dark:border-[#10B981] dark:bg-[#10B981] dark:text-[#052E1C]'
                        : 'border-[#DCE7E0] bg-[#F7FAF8] text-[#335947] hover:bg-[#ECF7F1] dark:border-[#1E3A2D] dark:bg-[#091611] dark:text-[#9EC0AE]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Customer Pick */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#335947] dark:text-[#9EC0AE]">
                  {t.posSelectCustomer}
                </label>
                <select
                  value={formState.customerId}
                  onChange={(e) => handleSelectCustomer(e.target.value)}
                  className={inputClass}
                >
                  <option value="">{t.posWalkInCustomer}</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} — {c.name} {c.phone ? `(${c.phone})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#335947] dark:text-[#9EC0AE]">
                    {formState.instrumentType === 'card'
                      ? t.portfolioBankCardLabel
                      : t.portfolioBankLabel}
                  </label>
                  <input
                    type="text"
                    value={formState.bankName}
                    onChange={(e) =>
                      setFormState((prev) => ({ ...prev, bankName: e.target.value }))
                    }
                    placeholder={
                      formState.instrumentType === 'card'
                        ? 'CMI / Visa / CIH / Attijari...'
                        : 'Attijariwafa / BMCE / BP / CIH...'
                    }
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#335947] dark:text-[#9EC0AE]">
                    {formState.instrumentType === 'card'
                      ? t.portfolioCardNumberLabel
                      : t.portfolioNumberLabel}
                  </label>
                  <input
                    type="text"
                    value={formState.instrumentNumber}
                    onChange={(e) =>
                      setFormState((prev) => ({ ...prev, instrumentNumber: e.target.value }))
                    }
                    placeholder={
                      formState.instrumentType === 'card' ? '**** 4821 / Auth 9041' : 'CHQ-784512'
                    }
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#335947] dark:text-[#9EC0AE]">
                    {formState.instrumentType === 'card'
                      ? t.portfolioCardHolderLabel
                      : t.portfolioHolderLabel}
                  </label>
                  <input
                    type="text"
                    value={formState.holderName}
                    onChange={(e) =>
                      setFormState((prev) => ({ ...prev, holderName: e.target.value }))
                    }
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#335947] dark:text-[#9EC0AE]">
                    {t.portfolioCustomerPhoneLabel}
                  </label>
                  <input
                    type="tel"
                    value={formState.customerPhone}
                    onChange={(e) =>
                      setFormState((prev) => ({ ...prev, customerPhone: e.target.value }))
                    }
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#335947] dark:text-[#9EC0AE]">
                    {t.portfolioAmountLabel} ({currency})
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={formState.amountDisplay}
                    onChange={(e) =>
                      setFormState((prev) => ({ ...prev, amountDisplay: e.target.value }))
                    }
                    className={`${inputClass} tabular-nums font-bold`}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#335947] dark:text-[#9EC0AE]">
                    {t.portfolioBlNumberLabel}
                  </label>
                  <input
                    type="text"
                    value={formState.blNumber}
                    onChange={(e) =>
                      setFormState((prev) => ({ ...prev, blNumber: e.target.value }))
                    }
                    placeholder="BL-0001"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#335947] dark:text-[#9EC0AE]">
                    {t.portfolioReceiptDateLabel}
                  </label>
                  <input
                    type="date"
                    value={formState.receiptDate}
                    onChange={(e) =>
                      setFormState((prev) => ({ ...prev, receiptDate: e.target.value }))
                    }
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#335947] dark:text-[#9EC0AE]">
                    {formState.instrumentType === 'card'
                      ? t.portfolioCardSettlementDateLabel
                      : t.portfolioDueDateLabel}
                  </label>
                  <input
                    type="date"
                    value={formState.dueDate}
                    onChange={(e) =>
                      setFormState((prev) => ({ ...prev, dueDate: e.target.value }))
                    }
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-[#335947] dark:text-[#9EC0AE]">
                  {t.portfolioStatusLabel}
                </label>
                <select
                  value={formState.status}
                  onChange={(e) =>
                    setFormState((prev) => ({
                      ...prev,
                      status: e.target.value as PaymentInstrumentStatus,
                    }))
                  }
                  className={inputClass}
                >
                  <option value="pending">{t.portfolioStatusPending}</option>
                  <option value="deposited">{t.portfolioStatusDeposited}</option>
                  <option value="collected">{t.portfolioStatusCollected}</option>
                  <option value="bounced">{t.portfolioStatusBounced}</option>
                  <option value="cancelled">{t.portfolioStatusCancelled}</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-[#335947] dark:text-[#9EC0AE]">
                  {t.warehouseNotesLabel}
                </label>
                <input
                  type="text"
                  value={formState.notes}
                  onChange={(e) =>
                    setFormState((prev) => ({ ...prev, notes: e.target.value }))
                  }
                  className={inputClass}
                />
              </div>

              {formError && (
                <p className="rounded-xl border border-[#DC2626]/30 bg-[#FEE2E2] px-3 py-2 text-xs font-semibold text-[#991B1B] dark:border-[#F87171]/30 dark:bg-[#2F1114] dark:text-[#FCA5A5]">
                  {formError}
                </p>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="min-h-[44px] rounded-xl border border-[#DCE7E0] px-4 text-xs font-bold text-[#335947] hover:bg-[#ECF7F1] dark:border-[#1E3A2D] dark:text-[#9EC0AE]"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex min-h-[44px] items-center gap-1.5 rounded-xl bg-[#115E3B] px-5 text-xs font-bold text-white hover:bg-[#0D4A2E] disabled:opacity-50 dark:bg-[#10B981] dark:text-[#052E1C]"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>{saving ? t.saving : t.save}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
