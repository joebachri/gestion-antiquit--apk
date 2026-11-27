import { useEffect, useMemo, useState } from 'react';
import {
  Download,
  FileText,
  Printer,
  RotateCcw,
  X,
} from 'lucide-react';
import type {
  Customer,
  InventoryAdjustment,
  Language,
  PosInvoice,
  Product,
  ReportFilters,
  ReportType,
  ShopSettings,
  Supplier,
  Warehouse,
} from '../types';
import { formatNumber, translations } from '../i18n';
import { buildReportSpec, executeReportOutput } from '../utils/printReports';

interface ReportsPrintModalProps {
  isOpen: boolean;
  lang: Language;
  currency: string;
  storeName: string;
  shopSettings?: Partial<ShopSettings>;
  initialFilters?: Partial<ReportFilters>;
  products: Product[];
  warehouses: Warehouse[];
  customers: Customer[];
  suppliers: Supplier[];
  invoices: PosInvoice[];
  adjustments: InventoryAdjustment[];
  onClose: () => void;
  onMarkInvoicePrinted?: (invoiceId: string) => Promise<void>;
  onNotify?: (message: string) => void;
}

export function ReportsPrintModal({
  isOpen,
  lang,
  currency,
  storeName,
  shopSettings,
  initialFilters,
  products,
  warehouses,
  customers,
  suppliers,
  invoices,
  adjustments,
  onClose,
  onMarkInvoicePrinted,
  onNotify,
}: ReportsPrintModalProps) {
  const t = translations[lang];

  const reportOptions: Array<{ type: ReportType; title: string }> = [
    { type: 'invoice_single', title: t.reportType1Title },
    { type: 'invoices_aggregate', title: t.reportType2Title },
    { type: 'inventory', title: t.reportType3Title },
    { type: 'customers', title: t.reportType4Title },
    { type: 'suppliers', title: t.reportType5Title },
    { type: 'purchases', title: t.reportType6Title },
    { type: 'sales', title: t.reportType7Title },
    { type: 'products', title: t.reportType8Title },
    { type: 'product_single', title: t.reportType9Title },
    { type: 'warehouses', title: t.reportType10Title },
    { type: 'cash_register_summary', title: t.reportTypeCashSummaryTitle },
  ];

  const categories = useMemo(
    () =>
      Array.from(
        new Set(products.map((p) => (p.category || '').trim()).filter(Boolean))
      ).sort(),
    [products]
  );

  const [reportType, setReportType] = useState<ReportType>('inventory');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [category, setCategory] = useState('');
  const [productId, setProductId] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [invoiceId, setInvoiceId] = useState('');
  const [isCopy, setIsCopy] = useState(false);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setReportType(initialFilters?.reportType || 'inventory');
    setStartDate(initialFilters?.startDate || '');
    setEndDate(initialFilters?.endDate || '');
    setWarehouseId(initialFilters?.warehouseId || '');
    setCategory(initialFilters?.category || '');
    setProductId(initialFilters?.productId || '');
    setCustomerId(initialFilters?.customerId || '');
    setSupplierId(initialFilters?.supplierId || '');
    setInvoiceId(initialFilters?.invoiceId || '');
    setIsCopy(Boolean(initialFilters?.isCopy));
  }, [isOpen, initialFilters]);

  // Default invoice picker if single-invoice report is selected without an invoiceId
  useEffect(() => {
    if (isOpen && reportType === 'invoice_single' && !invoiceId && invoices.length > 0) {
      setInvoiceId(invoices[0].id);
    }
  }, [isOpen, reportType, invoiceId, invoices]);

  // Keep selected invoice copy default synced when selecting an invoice
  useEffect(() => {
    if (isOpen && reportType === 'invoice_single' && invoiceId) {
      const inv = invoices.find((i) => i.id === invoiceId);
      if (inv && !initialFilters?.invoiceId) {
        setIsCopy((inv.printCount || 0) > 0);
      }
    }
  }, [isOpen, reportType, invoiceId, invoices, initialFilters?.invoiceId]);

  const currentFilters: ReportFilters = {
    reportType,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    warehouseId: warehouseId || undefined,
    category: category || undefined,
    productId: productId || undefined,
    customerId: customerId || undefined,
    supplierId: supplierId || undefined,
    invoiceId: invoiceId || undefined,
    isCopy,
  };

  const previewSpec = useMemo(
    () =>
      buildReportSpec(currentFilters, {
        products,
        warehouses,
        customers,
        suppliers,
        invoices,
        adjustments,
        storeName,
        currency,
        lang,
        shopSettings,
      }),
    [
      currentFilters,
      products,
      warehouses,
      customers,
      suppliers,
      invoices,
      adjustments,
      storeName,
      currency,
      lang,
      shopSettings,
    ]
  );

  if (!isOpen) return null;

  const totalRows = previewSpec.tables.reduce((sum, tbl) => sum + tbl.rows.length, 0);

  const showDateRange = [
    'invoices_aggregate',
    'purchases',
    'sales',
    'products',
    'warehouses',
    'cash_register_summary',
  ].includes(reportType);
  const showWarehouseFilter = ['inventory', 'warehouses'].includes(reportType);
  const showCategoryFilter = [
    'invoices_aggregate',
    'inventory',
    'purchases',
    'sales',
    'products',
    'warehouses',
  ].includes(reportType);
  const showProductFilter = [
    'invoices_aggregate',
    'inventory',
    'purchases',
    'sales',
    'products',
    'product_single',
    'warehouses',
  ].includes(reportType);
  const showCustomerFilter = [
    'invoices_aggregate',
    'customers',
    'purchases',
    'sales',
  ].includes(reportType);
  const showSupplierFilter = ['suppliers', 'purchases'].includes(reportType);
  const showInvoicePicker = reportType === 'invoice_single';

  const handleRunReport = async (mode: 'print' | 'pdf') => {
    if (running) return;
    setRunning(true);
    try {
      const targetInvoiceId =
        reportType === 'invoice_single' ? invoiceId || invoices[0]?.id : undefined;

      const spec = buildReportSpec(
        { ...currentFilters, invoiceId: targetInvoiceId },
        {
          products,
          warehouses,
          customers,
          suppliers,
          invoices,
          adjustments,
          storeName,
          currency,
          lang,
          shopSettings,
        }
      );

      const dateStamp = new Date().toISOString().slice(0, 10);
      const filename = `rapport-${reportType}-${dateStamp}.pdf`;
      const outcome = await executeReportOutput({
        mode,
        spec,
        filename,
        lang,
      });

      if (targetInvoiceId && onMarkInvoicePrinted) {
        await onMarkInvoicePrinted(targetInvoiceId);
      }

      if (onNotify) {
        if (outcome === 'pdf_fallback') {
          onNotify(t.reportPrintBlockedPdfToast);
        } else {
          onNotify(`${t.reportGeneratedToast} ${spec.title}`);
        }
      }
    } finally {
      setRunning(false);
    }
  };

  const resetFilters = () => {
    setStartDate('');
    setEndDate('');
    setWarehouseId('');
    setCategory('');
    setProductId('');
    setCustomerId('');
    setSupplierId('');
    setIsCopy(false);
  };

  const inputClass =
    'min-h-[42px] w-full rounded-xl border border-[#DCE7E0] bg-white px-3 text-xs text-[#0B1F16] focus:border-[#115E3B] focus:outline-none dark:border-[#1E3A2D] dark:bg-[#091611] dark:text-[#F2F9F5]';

  return (
    <div
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/55 p-0 backdrop-blur-xs sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[94dvh] w-full max-w-5xl flex-col overflow-hidden rounded-t-3xl border border-[#DCE7E0] bg-white shadow-2xl sm:rounded-3xl dark:border-[#1E3A2D] dark:bg-[#0F2119]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-[#DCE7E0] px-5 py-4 dark:border-[#1E3A2D]">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#ECF7F1] text-[#115E3B] dark:bg-[#132B20] dark:text-[#34D399]">
              <Printer className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h2 className="truncate font-display text-lg font-bold text-[#0B1F16] sm:text-xl dark:text-[#F2F9F5]">
                {t.reportsHubTitle}
              </h2>
              <p className="truncate text-xs text-[#335947] dark:text-[#9EC0AE]">
                {t.reportsHubSubtitle}
              </p>
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

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
            {/* Left Sidebar: 10 Report Types */}
            <div className="space-y-1.5 lg:col-span-4">
              {reportOptions.map((opt) => {
                const active = reportType === opt.type;
                return (
                  <button
                    key={opt.type}
                    type="button"
                    onClick={() => setReportType(opt.type)}
                    className={`flex min-h-[42px] w-full items-center gap-2 rounded-xl border px-3 py-2 text-start text-xs font-semibold transition-colors ${
                      active
                        ? 'border-[#115E3B] bg-[#115E3B] text-white dark:border-[#10B981] dark:bg-[#10B981] dark:text-[#052E1C]'
                        : 'border-[#DCE7E0] bg-[#F7FAF8] text-[#0B1F16] hover:bg-[#ECF7F1] dark:border-[#1E3A2D] dark:bg-[#091611] dark:text-[#F2F9F5] dark:hover:bg-[#132B20]'
                    }`}
                  >
                    <FileText className="h-3.5 w-3.5 shrink-0" />
                    <span className="leading-snug">{opt.title}</span>
                  </button>
                );
              })}
            </div>

            {/* Right Panel: Filters + Live Preview + Print / PDF */}
            <div className="space-y-4 lg:col-span-8">
              {/* Dynamic Filter Box */}
              <div className="space-y-3 rounded-2xl border border-[#DCE7E0] bg-[#F7FAF8] p-4 dark:border-[#1E3A2D] dark:bg-[#091611]">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#335947] dark:text-[#9EC0AE]">
                    {t.adjustmentFilterTitle}
                  </h3>
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#115E3B] hover:underline dark:text-[#34D399]"
                  >
                    <RotateCcw className="h-3 w-3" />
                    <span>{t.purchasesFilterReset}</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {showInvoicePicker && (
                    <>
                      <div className="sm:col-span-2">
                        <label className="mb-1 block text-xs font-semibold text-[#0B1F16] dark:text-[#F2F9F5]">
                          {t.reportSelectInvoice}
                        </label>
                        <select
                          value={invoiceId}
                          onChange={(e) => setInvoiceId(e.target.value)}
                          className={inputClass}
                        >
                          {invoices.length === 0 ? (
                            <option value="">{t.posEmptyInvoices}</option>
                          ) : (
                            invoices.map((inv) => (
                              <option key={inv.id} value={inv.id}>
                                {inv.invoiceNumber} · {inv.saleDate} · {inv.customerName || t.posWalkInCustomer} ({formatNumber(inv.totalPrice, lang)} {currency})
                              </option>
                            ))
                          )}
                        </select>
                      </div>

                      <div className="sm:col-span-2">
                        <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-[#0B1F16] dark:text-[#F2F9F5]">
                          <input
                            type="checkbox"
                            checked={isCopy}
                            onChange={(e) => setIsCopy(e.target.checked)}
                            className="h-4 w-4 rounded border-[#DCE7E0] accent-[#115E3B]"
                          />
                          <span>{t.reportReprintAsCopy}</span>
                        </label>
                      </div>
                    </>
                  )}

                  {showDateRange && (
                    <>
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-[#0B1F16] dark:text-[#F2F9F5]">
                          {t.adjustmentFilterFrom}
                        </label>
                        <input
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-[#0B1F16] dark:text-[#F2F9F5]">
                          {t.adjustmentFilterTo}
                        </label>
                        <input
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          className={inputClass}
                        />
                      </div>
                    </>
                  )}

                  {showWarehouseFilter && (
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-[#0B1F16] dark:text-[#F2F9F5]">
                        {t.productWarehouseLabel}
                      </label>
                      <select
                        value={warehouseId}
                        onChange={(e) => setWarehouseId(e.target.value)}
                        className={inputClass}
                      >
                        <option value="">{t.productAllWarehouses}</option>
                        {warehouses.map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.code} — {w.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {showCategoryFilter && (
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-[#0B1F16] dark:text-[#F2F9F5]">
                        {t.productCategoryLabel}
                      </label>
                      <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className={inputClass}
                      >
                        <option value="">{t.productAllCategories}</option>
                        {categories.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {showProductFilter && (
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-[#0B1F16] dark:text-[#F2F9F5]">
                        {reportType === 'product_single' ? t.reportSelectProduct : t.adjustmentFilterProduct}
                      </label>
                      <select
                        value={productId}
                        onChange={(e) => setProductId(e.target.value)}
                        className={inputClass}
                      >
                        {reportType !== 'product_single' && <option value="">{t.posFilterAll}</option>}
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.code} — {p.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {showCustomerFilter && (
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-[#0B1F16] dark:text-[#F2F9F5]">
                        {t.purchasesFilterCustomerLabel}
                      </label>
                      <select
                        value={customerId}
                        onChange={(e) => setCustomerId(e.target.value)}
                        className={inputClass}
                      >
                        <option value="">{t.purchasesFilterAllCustomers}</option>
                        {customers.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.code} — {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {showSupplierFilter && (
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-[#0B1F16] dark:text-[#F2F9F5]">
                        {t.digitalMgmtSupplier}
                      </label>
                      <select
                        value={supplierId}
                        onChange={(e) => setSupplierId(e.target.value)}
                        className={inputClass}
                      >
                        <option value="">{t.posFilterAll}</option>
                        {suppliers.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.code} — {s.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {/* Live Report Summary Preview */}
              <div className="space-y-3 rounded-2xl border border-[#DCE7E0] bg-white p-4 dark:border-[#1E3A2D] dark:bg-[#091611]">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#DCE7E0] pb-2.5 dark:border-[#1E3A2D]">
                  <div>
                    <h4 className="font-display text-base font-bold text-[#0B1F16] dark:text-[#F2F9F5]">
                      {previewSpec.title}
                    </h4>
                    {previewSpec.subtitle && (
                      <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                        {previewSpec.subtitle}
                      </p>
                    )}
                  </div>
                  <span className="tabular-nums text-xs font-semibold text-[#335947] dark:text-[#9EC0AE]">
                    {t.reportSummaryTotalRows}: {formatNumber(totalRows, lang)}
                  </span>
                </div>

                {previewSpec.kpis.length > 0 && (
                  <div
                    className={`grid grid-cols-2 gap-2.5 ${
                      previewSpec.kpis.length <= 2
                        ? 'sm:grid-cols-2'
                        : previewSpec.kpis.length === 3
                        ? 'sm:grid-cols-3'
                        : 'sm:grid-cols-4'
                    }`}
                  >
                    {previewSpec.kpis.map((kpi, idx) => (
                      <div
                        key={idx}
                        className="rounded-xl border border-[#DCE7E0] bg-[#F7FAF8] p-2.5 dark:border-[#1E3A2D] dark:bg-[#0F2119]"
                      >
                        <span className="block text-[11px] text-[#335947] dark:text-[#9EC0AE]">
                          {kpi.label}
                        </span>
                        <span className="tabular-nums mt-0.5 block text-sm font-bold text-[#115E3B] dark:text-[#34D399]">
                          {kpi.value}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {previewSpec.tables.map((tbl, tIdx) => (
                  <div key={tIdx} className="space-y-1.5">
                    {tbl.heading && (
                      <p className="text-xs font-bold text-[#335947] dark:text-[#9EC0AE]">
                        {tbl.heading}
                      </p>
                    )}
                    <div className="max-h-48 overflow-auto rounded-xl border border-[#DCE7E0] dark:border-[#1E3A2D]">
                      <table className="w-full border-collapse text-xs">
                        <thead className="sticky top-0 bg-[#115E3B] text-white dark:bg-[#132B20]">
                          <tr>
                            {tbl.columns.map((col, cIdx) => (
                              <th
                                key={cIdx}
                                className="px-2.5 py-2 text-start font-semibold whitespace-nowrap"
                              >
                                {col.label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#DCE7E0] dark:divide-[#1E3A2D]">
                          {tbl.rows.length === 0 ? (
                            <tr>
                              <td
                                colSpan={tbl.columns.length}
                                className="px-3 py-4 text-center text-[#6B8A79]"
                              >
                                {t.reportNoDataForFilters}
                              </td>
                            </tr>
                          ) : (
                            tbl.rows.slice(0, 12).map((row, rIdx) => (
                              <tr key={rIdx} className="hover:bg-[#F7FAF8] dark:hover:bg-[#0F2119]">
                                {row.map((cell, cIdx) => (
                                  <td
                                    key={cIdx}
                                    className="tabular-nums px-2.5 py-1.5 text-[#0B1F16] dark:text-[#F2F9F5]"
                                  >
                                    {cell}
                                  </td>
                                ))}
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}

                {(() => {
                  const payLines =
                    previewSpec.paymentSummaryLines && previewSpec.paymentSummaryLines.length > 0
                      ? previewSpec.paymentSummaryLines
                      : previewSpec.paymentSummaryLine
                      ? [previewSpec.paymentSummaryLine]
                      : [];
                  if (payLines.length === 0) return null;
                  return (
                    <div className="flex justify-end">
                      <div className="tabular-nums space-y-0.5 rounded-lg border border-[#115E3B]/30 bg-[#ECF7F1] px-3 py-1.5 text-end text-xs font-bold text-[#0B1F16] dark:border-[#34D399]/30 dark:bg-[#132B20] dark:text-[#F2F9F5]">
                        {payLines.map((line, i) => (
                          <div key={i}>{line}</div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {previewSpec.companyFooterLines && previewSpec.companyFooterLines.length > 0 && (
                  <div className="border-t border-[#DCE7E0] pt-2.5 text-center text-[11px] leading-relaxed text-[#335947] dark:border-[#1E3A2D] dark:text-[#9EC0AE]">
                    {previewSpec.companyFooterLines.map((line, i) => (
                      <div
                        key={i}
                        className={i === 0 ? 'font-bold text-[#0B1F16] dark:text-[#F2F9F5]' : ''}
                      >
                        {line}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <button
                  type="button"
                  disabled={running}
                  onClick={() => void handleRunReport('print')}
                  className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-[#115E3B] px-5 text-sm font-semibold text-white hover:bg-[#0D4A2E] disabled:opacity-60 dark:bg-[#10B981] dark:text-[#052E1C]"
                >
                  <Printer className="h-4 w-4" />
                  <span>{t.reportPrintNow}</span>
                </button>

                <button
                  type="button"
                  disabled={running}
                  onClick={() => void handleRunReport('pdf')}
                  className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-[#DCE7E0] bg-white px-5 text-sm font-semibold text-[#115E3B] hover:bg-[#ECF7F1] disabled:opacity-60 dark:border-[#1E3A2D] dark:bg-[#091611] dark:text-[#34D399]"
                >
                  <Download className="h-4 w-4" />
                  <span>{t.reportDownloadPdf}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
