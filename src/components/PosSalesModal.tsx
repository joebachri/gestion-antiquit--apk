import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Download,
  FileText,
  Plus,
  Receipt,
  RotateCcw,
  Search,
  ShoppingBag,
  X,
} from 'lucide-react';
import type {
  Customer,
  Language,
  PosInvoice,
  PosSalePayload,
  Product,
  PurchasePaymentMethod,
} from '../types';
import { formatCurrency, formatNumber, translations } from '../i18n';
import { convertFromMad, convertToMad } from '../utils/currency';
import { buildInvoiceReceiptBlob } from '../utils/qr';
import { saveOrShareBlob } from '../utils/download';

interface PosSalesModalProps {
  isOpen: boolean;
  lang: Language;
  currency: string;
  storeName?: string;
  products: Product[];
  customers: Customer[];
  invoices: PosInvoice[];
  summary: {
    totalInvoices: number;
    totalUnitsSold: number;
    totalRevenueMad: number;
    totalProfitMad: number;
  };
  onClose: () => void;
  onCreateSale: (payload: PosSalePayload) => Promise<PosInvoice | null>;
  onCancelInvoice: (invoiceId: string) => Promise<void>;
  onOpenProductDigitalFile: (productId: string) => void;
}

export function PosSalesModal({
  isOpen,
  lang,
  currency,
  storeName = '',
  products,
  customers,
  invoices,
  summary,
  onClose,
  onCreateSale,
  onCancelInvoice,
  onOpenProductDigitalFile,
}: PosSalesModalProps) {
  const t = translations[lang];
  const availableProducts = useMemo(
    () => products.filter((p) => (Number(p.quantity) || 0) > 0),
    [products]
  );

  const [showNewSale, setShowNewSale] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unitPriceDisplay, setUnitPriceDisplay] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PurchasePaymentMethod>('cash');
  const [notes, setNotes] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [cancelingId, setCancelingId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg('');
    if (availableProducts.length > 0) {
      const first = availableProducts[0];
      setSelectedProductId(first.id);
      setUnitPriceDisplay(String(convertFromMad(first.sellingPrice, currency)));
    } else {
      setSelectedProductId('');
      setUnitPriceDisplay('');
    }
    setQuantity('1');
    setCustomerId('');
    setCustomerName('');
    setCustomerPhone('');
    setPaymentMethod('cash');
    setNotes('');
  }, [isOpen, availableProducts, currency]);

  if (!isOpen) return null;

  const selectedProduct = availableProducts.find((p) => p.id === selectedProductId);

  const handleSelectProduct = (id: string) => {
    setSelectedProductId(id);
    const prod = availableProducts.find((p) => p.id === id);
    if (prod) {
      setUnitPriceDisplay(String(convertFromMad(prod.sellingPrice, currency)));
      setQuantity('1');
    }
  };

  const handleSelectCustomer = (id: string) => {
    setCustomerId(id);
    const cust = customers.find((c) => c.id === id);
    if (cust) {
      setCustomerName(cust.name);
      setCustomerPhone(cust.phone);
    }
  };

  const handleSubmitSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;
    setSubmitting(true);
    setErrorMsg('');
    try {
      const qty = Math.max(1, Math.floor(Number(quantity) || 1));
      const unitPriceMad =
        unitPriceDisplay.trim() !== ''
          ? convertToMad(Number(unitPriceDisplay) || 0, currency)
          : selectedProduct.sellingPrice;
      const created = await onCreateSale({
        productId: selectedProduct.id,
        quantity: qty,
        unitPrice: unitPriceMad,
        customerId: customerId || undefined,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        paymentMethod,
        notes: notes.trim(),
        source: 'pos_manual',
      });
      if (created) {
        setShowNewSale(false);
        setNotes('');
      }
    } catch (err) {
      if (err instanceof Error && err.message === 'OUT_OF_STOCK') {
        setErrorMsg(t.qrScannerOutOfStock);
      } else {
        setErrorMsg(t.errorSave);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const filteredInvoices = invoices.filter((inv) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      inv.invoiceNumber.toLowerCase().includes(q) ||
      inv.productCode.toLowerCase().includes(q) ||
      inv.productName.toLowerCase().includes(q) ||
      inv.customerName.toLowerCase().includes(q)
    );
  });

  const paymentLabel = (method: string) => {
    if (method === 'transfer') return t.paymentTransfer;
    if (method === 'check') return t.paymentCheck;
    if (method === 'card') return t.paymentCard;
    if (method === 'other') return t.paymentOther;
    return t.paymentCash;
  };

  const inputClass =
    'min-h-[44px] w-full rounded-xl border border-[#DCE7E0] bg-[#F7FAF8] px-3.5 py-2 text-sm text-[#0B1F16] placeholder:text-[#6B8A79] focus:border-[#115E3B] focus:bg-white focus:outline-none dark:border-[#1E3A2D] dark:bg-[#091611] dark:text-[#F2F9F5] dark:placeholder:text-[#5F8370] dark:focus:border-[#10B981]';

  return (
    <div
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/55 p-0 backdrop-blur-xs sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-3xl border border-[#DCE7E0] bg-white shadow-xl sm:rounded-3xl dark:border-[#1E3A2D] dark:bg-[#0F2119]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#DCE7E0] px-5 py-4 dark:border-[#1E3A2D]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#ECF7F1] text-[#115E3B] dark:bg-[#132B20] dark:text-[#34D399]">
              <Receipt className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate font-display text-lg font-bold text-[#0B1F16] sm:text-xl dark:text-[#F2F9F5]">
                {t.posTitle}
              </h2>
              <p className="truncate text-xs text-[#335947] dark:text-[#9EC0AE]">{t.posSubtitle}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={t.close}
            className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl text-[#335947] hover:bg-[#ECF7F1] dark:text-[#9EC0AE] dark:hover:bg-[#162E23]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          {/* KPI Strip */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-[#DCE7E0] bg-[#F7FAF8] p-3.5 dark:border-[#1E3A2D] dark:bg-[#091611]">
              <span className="block text-[11px] font-medium text-[#335947] dark:text-[#9EC0AE]">
                {t.posTotalInvoices}
              </span>
              <span className="tabular-nums mt-1 block font-display text-xl font-bold text-[#0B1F16] dark:text-[#F2F9F5]">
                {formatNumber(summary.totalInvoices, lang)}
              </span>
            </div>
            <div className="rounded-2xl border border-[#DCE7E0] bg-[#F7FAF8] p-3.5 dark:border-[#1E3A2D] dark:bg-[#091611]">
              <span className="block text-[11px] font-medium text-[#335947] dark:text-[#9EC0AE]">
                {t.posTotalUnitsSold}
              </span>
              <span className="tabular-nums mt-1 block font-display text-xl font-bold text-[#0B1F16] dark:text-[#F2F9F5]">
                {formatNumber(summary.totalUnitsSold, lang)}
              </span>
            </div>
            <div className="rounded-2xl border border-[#DCE7E0] bg-[#F7FAF8] p-3.5 dark:border-[#1E3A2D] dark:bg-[#091611]">
              <span className="block text-[11px] font-medium text-[#335947] dark:text-[#9EC0AE]">
                {t.posTotalRevenue}
              </span>
              <span className="tabular-nums mt-1 block font-display text-xl font-bold text-[#115E3B] dark:text-[#34D399]">
                {formatCurrency(summary.totalRevenueMad, currency, lang)}
              </span>
            </div>
            <div className="rounded-2xl border border-[#DCE7E0] bg-[#F7FAF8] p-3.5 dark:border-[#1E3A2D] dark:bg-[#091611]">
              <span className="block text-[11px] font-medium text-[#335947] dark:text-[#9EC0AE]">
                {t.posTotalProfit}
              </span>
              <span className="tabular-nums mt-1 block font-display text-xl font-bold text-[#115E3B] dark:text-[#34D399]">
                {formatCurrency(summary.totalProfitMad, currency, lang)}
              </span>
            </div>
          </div>

          {/* Toolbar: Search + New Sale Toggle */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search
                className={`pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-[#335947] dark:text-[#9EC0AE] ${
                  lang === 'ar' ? 'right-3.5' : 'left-3.5'
                }`}
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t.searchPlaceholder}
                className={`min-h-[44px] w-full rounded-xl border border-[#DCE7E0] bg-[#F7FAF8] py-2 text-sm text-[#0B1F16] placeholder:text-[#6B8A79] focus:border-[#115E3B] focus:bg-white focus:outline-none dark:border-[#1E3A2D] dark:bg-[#091611] dark:text-[#F2F9F5] ${
                  lang === 'ar' ? 'pl-3.5 pr-10' : 'pl-10 pr-3.5'
                }`}
              />
            </div>

            <button
              type="button"
              onClick={() => setShowNewSale((v) => !v)}
              className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-[#115E3B] px-4 text-sm font-semibold text-white hover:bg-[#0D4A2E] whitespace-nowrap shrink-0 dark:bg-[#10B981] dark:text-[#052E1C]"
            >
              <Plus className="h-4 w-4" />
              <span>{t.posNewSale}</span>
            </button>
          </div>

          {/* New POS Sale Form */}
          {showNewSale && (
            <form
              onSubmit={handleSubmitSale}
              className="space-y-4 rounded-2xl border border-[#115E3B]/30 bg-[#ECF7F1]/50 p-4 dark:border-[#10B981]/30 dark:bg-[#132B20]/40"
            >
              <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-sm font-bold text-[#0B1F16] dark:text-[#F2F9F5]">
                  <ShoppingBag className="h-4 w-4 text-[#115E3B] dark:text-[#34D399]" />
                  <span>{t.posNewSale}</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setShowNewSale(false)}
                  className="text-xs font-semibold text-[#335947] hover:underline dark:text-[#9EC0AE]"
                >
                  {t.cancel}
                </button>
              </div>

              {errorMsg && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
                  {errorMsg}
                </div>
              )}

              {availableProducts.length === 0 ? (
                <p className="text-xs font-medium text-[#335947] dark:text-[#9EC0AE]">
                  {t.qrScannerOutOfStock}
                </p>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="sm:col-span-2">
                      <label className="mb-1 block text-xs font-semibold text-[#335947] dark:text-[#9EC0AE]">
                        {t.posSelectProduct}
                      </label>
                      <select
                        value={selectedProductId}
                        onChange={(e) => handleSelectProduct(e.target.value)}
                        className={inputClass}
                      >
                        {availableProducts.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.code} — {p.name} ({p.quantity})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-semibold text-[#335947] dark:text-[#9EC0AE]">
                        {t.purchaseQuantityLabel}
                      </label>
                      <input
                        type="number"
                        min="1"
                        max={selectedProduct?.quantity || 1}
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        className={`${inputClass} tabular-nums`}
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-semibold text-[#335947] dark:text-[#9EC0AE]">
                        {t.purchaseUnitPriceLabel} ({currency})
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={unitPriceDisplay}
                        onChange={(e) => setUnitPriceDisplay(e.target.value)}
                        className={`${inputClass} tabular-nums`}
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-semibold text-[#335947] dark:text-[#9EC0AE]">
                        {t.posSelectCustomer}
                      </label>
                      <select
                        value={customerId}
                        onChange={(e) => handleSelectCustomer(e.target.value)}
                        className={inputClass}
                      >
                        <option value="">{t.posWalkInCustomer}</option>
                        {customers.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.code} — {c.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-semibold text-[#335947] dark:text-[#9EC0AE]">
                        {t.purchasePaymentLabel}
                      </label>
                      <select
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value as PurchasePaymentMethod)}
                        className={inputClass}
                      >
                        <option value="cash">{t.paymentCash}</option>
                        <option value="transfer">{t.paymentTransfer}</option>
                        <option value="card">{t.paymentCard}</option>
                        <option value="check">{t.paymentCheck}</option>
                        <option value="other">{t.paymentOther}</option>
                      </select>
                    </div>

                    {!customerId && (
                      <>
                        <div>
                          <label className="mb-1 block text-xs font-semibold text-[#335947] dark:text-[#9EC0AE]">
                            {t.customerNameLabel}
                          </label>
                          <input
                            type="text"
                            value={customerName}
                            onChange={(e) => setCustomerName(e.target.value)}
                            placeholder={t.posCustomerNamePlaceholder}
                            className={inputClass}
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-semibold text-[#335947] dark:text-[#9EC0AE]">
                            {t.customerPhoneLabel}
                          </label>
                          <input
                            type="tel"
                            value={customerPhone}
                            onChange={(e) => setCustomerPhone(e.target.value)}
                            placeholder={t.posCustomerPhonePlaceholder}
                            className={inputClass}
                          />
                        </div>
                      </>
                    )}

                    <div className={!customerId ? 'sm:col-span-1' : 'sm:col-span-3'}>
                      <label className="mb-1 block text-xs font-semibold text-[#335947] dark:text-[#9EC0AE]">
                        {t.purchaseNotesLabel}
                      </label>
                      <input
                        type="text"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder={t.purchaseNotesPlaceholder}
                        className={inputClass}
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting || !selectedProduct}
                    className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[#115E3B] px-5 text-sm font-semibold text-white hover:bg-[#0D4A2E] disabled:opacity-60 dark:bg-[#10B981] dark:text-[#052E1C]"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    <span>{submitting ? t.saving : t.posConfirmSale}</span>
                  </button>
                </>
              )}
            </form>
          )}

          {/* Invoices List */}
          {filteredInvoices.length === 0 ? (
            <div className="rounded-2xl border border-[#DCE7E0] bg-[#F7FAF8] px-5 py-10 text-center dark:border-[#1E3A2D] dark:bg-[#091611]">
              <Receipt className="mx-auto mb-2 h-8 w-8 text-[#115E3B]/45 dark:text-[#34D399]/45" />
              <p className="text-sm font-medium text-[#335947] dark:text-[#9EC0AE]">
                {t.posEmptyInvoices}
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredInvoices.map((inv) => (
                <div
                  key={inv.id}
                  className="flex flex-col justify-between gap-3 rounded-2xl border border-[#DCE7E0] bg-white p-4 sm:flex-row sm:items-center dark:border-[#1E3A2D] dark:bg-[#091611]"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                      <span className="font-mono-code text-sm font-bold text-[#115E3B] dark:text-[#34D399]">
                        {inv.invoiceNumber}
                      </span>
                      <span aria-hidden="true" className="text-[#6B8A79]">·</span>
                      <span className="font-mono-code text-xs font-semibold text-[#0B1F16] dark:text-[#D1E7DA]">
                        {inv.productCode}
                      </span>
                      <span aria-hidden="true" className="text-[#6B8A79]">·</span>
                      <span className="tabular-nums text-xs text-[#335947] dark:text-[#9EC0AE]">
                        {inv.saleDate}
                      </span>
                    </div>

                    <p className="truncate font-display text-sm font-bold text-[#0B1F16] dark:text-[#F2F9F5]">
                      {inv.productName}
                    </p>

                    <div className="tabular-nums flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#335947] dark:text-[#9EC0AE]">
                      <span>
                        {inv.quantity} × {formatCurrency(inv.unitPrice, currency, lang)}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{paymentLabel(inv.paymentMethod)}</span>
                      {inv.customerName && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-medium text-[#0B1F16] dark:text-[#F2F9F5]">
                            {inv.customerName}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 sm:justify-end">
                    <span className="tabular-nums text-base font-bold text-[#115E3B] dark:text-[#34D399]">
                      {formatCurrency(inv.totalPrice, currency, lang)}
                    </span>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onOpenProductDigitalFile(inv.productId)}
                        title={t.qrDigitalFileButton}
                        className="flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[#DCE7E0] bg-[#ECF7F1] px-2.5 text-xs font-semibold text-[#115E3B] hover:bg-[#DCF0E4] dark:border-[#1E3A2D] dark:bg-[#132B20] dark:text-[#34D399]"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        <span>{t.qrDigitalFileButton}</span>
                      </button>

                      <button
                        type="button"
                        onClick={async () => {
                          const blob = await buildInvoiceReceiptBlob(inv, storeName, currency, lang);
                          await saveOrShareBlob(
                            blob,
                            `${inv.invoiceNumber.toLowerCase()}.png`,
                            inv.invoiceNumber
                          );
                        }}
                        title={t.posDownloadReceipt}
                        className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl border border-[#DCE7E0] text-[#0B1F16] hover:bg-[#F7FAF8] dark:border-[#1E3A2D] dark:text-[#F2F9F5] dark:hover:bg-[#162E23]"
                      >
                        <Download className="h-4 w-4" />
                      </button>

                      {cancelingId === inv.id ? (
                        <button
                          type="button"
                          onClick={async () => {
                            await onCancelInvoice(inv.id);
                            setCancelingId(null);
                          }}
                          className="min-h-[40px] rounded-xl bg-red-600 px-3 text-xs font-semibold text-white"
                        >
                          {t.confirmDeleteAction}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setCancelingId(inv.id)}
                          title={t.posCancelInvoice}
                          className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl border border-[#DCE7E0] text-red-600 hover:bg-red-50 dark:border-[#1E3A2D] dark:text-red-400 dark:hover:bg-red-950/40"
                        >
                          <RotateCcw className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
