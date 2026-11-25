import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRightLeft,
  Check,
  FileSpreadsheet,
  Filter,
  Plus,
  Printer,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react';
import type {
  AdjustmentType,
  InventoryAdjustment,
  InventoryAdjustmentPayload,
  Language,
  Product,
  Supplier,
  Warehouse,
} from '../types';
import { formatCurrency, formatNumber, translations } from '../i18n';
import { buildInventoryAdjustmentsExcelBlob } from '../utils/excel';
import { saveOrShareBlob } from '../utils/download';

interface InventoryAdjustmentModalProps {
  isOpen: boolean;
  lang: Language;
  currency: string;
  products: Product[];
  warehouses: Warehouse[];
  suppliers: Supplier[];
  adjustments: InventoryAdjustment[];
  onClose: () => void;
  onCreateAdjustment: (payload: InventoryAdjustmentPayload) => Promise<void>;
  onDeleteAdjustment: (id: string) => Promise<void>;
  onPrintInventoryReport?: (filters: {
    warehouseId?: string;
    category?: string;
    productId?: string;
  }) => void;
}

export function InventoryAdjustmentModal({
  isOpen,
  lang,
  currency,
  products,
  warehouses,
  suppliers,
  adjustments,
  onClose,
  onCreateAdjustment,
  onDeleteAdjustment,
  onPrintInventoryReport,
}: InventoryAdjustmentModalProps) {
  const t = translations[lang];

  // Form states
  const [showForm, setShowForm] = useState(false);
  const [adjustmentType, setAdjustmentType] = useState<AdjustmentType>('deduction');
  const [warehouseId, setWarehouseId] = useState('');
  const [targetWarehouseId, setTargetWarehouseId] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [productId, setProductId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [qtyInput, setQtyInput] = useState('1');
  const [adjustmentDate, setAdjustmentDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Ledger Filters
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [filterSupplierId, setFilterSupplierId] = useState('');
  const [filterProductId, setFilterProductId] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterWarehouseId, setFilterWarehouseId] = useState('');
  const [filterType, setFilterType] = useState<string>('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg('');
    setConfirmDeleteId(null);
    setAdjustmentDate(new Date().toISOString().slice(0, 10));
  }, [isOpen]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category?.trim()) set.add(p.category.trim());
    });
    adjustments.forEach((a) => {
      if (a.category?.trim()) set.add(a.category.trim());
    });
    return Array.from(set).sort();
  }, [products, adjustments]);

  const formFilteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (warehouseId && p.warehouseId && p.warehouseId !== warehouseId) return false;
      if (formCategory && (p.category || '') !== formCategory) return false;
      return true;
    });
  }, [products, warehouseId, formCategory]);

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === productId) || null,
    [products, productId]
  );

  const filteredAdjustments = useMemo(() => {
    return adjustments.filter((a) => {
      if (filterFrom && a.adjustmentDate < filterFrom) return false;
      if (filterTo && a.adjustmentDate > filterTo) return false;
      if (filterSupplierId && a.supplierId !== filterSupplierId) return false;
      if (filterProductId && a.productId !== filterProductId) return false;
      if (filterCategory && (a.category || '') !== filterCategory) return false;
      if (
        filterWarehouseId &&
        a.warehouseId !== filterWarehouseId &&
        a.targetWarehouseId !== filterWarehouseId
      ) {
        return false;
      }
      if (filterType && a.adjustmentType !== filterType) return false;
      return true;
    });
  }, [
    adjustments,
    filterFrom,
    filterTo,
    filterSupplierId,
    filterProductId,
    filterCategory,
    filterWarehouseId,
    filterType,
  ]);

  if (!isOpen) return null;

  const typeLabel = (type: AdjustmentType | string) => {
    if (type === 'deduction') return t.adjustmentTypeDeduction;
    if (type === 'restock') return t.adjustmentTypeRestock;
    if (type === 'damage') return t.adjustmentTypeDamage;
    if (type === 'loss') return t.adjustmentTypeLoss;
    if (type === 'transfer') return t.adjustmentTypeTransfer;
    return t.adjustmentTypeCorrection;
  };

  const resetFilters = () => {
    setFilterFrom('');
    setFilterTo('');
    setFilterSupplierId('');
    setFilterProductId('');
    setFilterCategory('');
    setFilterWarehouseId('');
    setFilterType('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productId) {
      setErrorMsg(t.adjustmentValidationProduct);
      return;
    }
    const rawQty = Math.floor(Number(qtyInput) || 0);
    if (rawQty === 0) {
      setErrorMsg(t.adjustmentValidationQty);
      return;
    }
    if (adjustmentType === 'transfer' && (!targetWarehouseId || targetWarehouseId === (warehouseId || selectedProduct?.warehouseId))) {
      setErrorMsg(t.adjustmentValidationTransferTarget);
      return;
    }

    const isNegativeType =
      adjustmentType === 'deduction' ||
      adjustmentType === 'damage' ||
      adjustmentType === 'loss';
    const quantityDelta =
      adjustmentType === 'restock'
        ? Math.abs(rawQty)
        : adjustmentType === 'correction'
        ? rawQty
        : isNegativeType
        ? -Math.abs(rawQty)
        : Math.abs(rawQty);

    setSubmitting(true);
    setErrorMsg('');
    try {
      await onCreateAdjustment({
        adjustmentType,
        warehouseId: warehouseId || selectedProduct?.warehouseId || '',
        targetWarehouseId: adjustmentType === 'transfer' ? targetWarehouseId : undefined,
        productId,
        quantityDelta,
        supplierId: supplierId || selectedProduct?.supplierId || '',
        reason: reason.trim(),
        notes: notes.trim(),
        adjustmentDate,
      });
      setShowForm(false);
      setReason('');
      setNotes('');
      setQtyInput('1');
    } catch {
      setErrorMsg(t.errorSave);
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    'min-h-[42px] w-full rounded-xl border border-[#DCE7E0] bg-[#F7FAF8] px-3 py-2 text-sm text-[#0B1F16] placeholder:text-[#6B8A79] focus:border-[#115E3B] focus:bg-white focus:outline-none dark:border-[#1E3A2D] dark:bg-[#091611] dark:text-[#F2F9F5] dark:placeholder:text-[#8FB39E]';

  return (
    <div
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 p-0 backdrop-blur-xs sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[95dvh] w-full max-w-4xl flex-col overflow-hidden rounded-t-3xl border border-[#DCE7E0] bg-white shadow-2xl sm:rounded-3xl dark:border-[#1E3A2D] dark:bg-[#0F2119]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-[#DCE7E0] px-5 py-4 dark:border-[#1E3A2D]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#ECF7F1] text-[#115E3B] dark:bg-[#132B20] dark:text-[#34D399]">
              <ArrowRightLeft className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate font-display text-lg font-bold text-[#0B1F16] dark:text-[#F2F9F5]">
                {t.adjustmentsTitle}
              </h2>
              <p className="truncate text-xs text-[#335947] dark:text-[#9EC0AE]">
                {t.adjustmentsSubtitle}
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
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const blob = buildInventoryAdjustmentsExcelBlob(
                    filteredAdjustments,
                    currency,
                    lang
                  );
                  void saveOrShareBlob(
                    blob,
                    `ajustements-stock-${new Date().toISOString().slice(0, 10)}.xlsx`,
                    t.adjustmentsTitle
                  );
                }}
                disabled={filteredAdjustments.length === 0}
                className="flex min-h-[42px] items-center gap-2 rounded-xl border border-[#DCE7E0] bg-[#F7FAF8] px-3.5 text-xs font-semibold text-[#115E3B] hover:bg-[#ECF7F1] disabled:opacity-50 dark:border-[#1E3A2D] dark:bg-[#102119] dark:text-[#34D399]"
              >
                <FileSpreadsheet className="h-4 w-4" />
                <span>{t.adjustmentExportExcel}</span>
              </button>

              {onPrintInventoryReport && (
                <button
                  type="button"
                  onClick={() =>
                    onPrintInventoryReport({
                      warehouseId: filterWarehouseId || undefined,
                      category: filterCategory || undefined,
                      productId: filterProductId || undefined,
                    })
                  }
                  className="flex min-h-[42px] items-center gap-2 rounded-xl border border-[#DCE7E0] bg-[#F7FAF8] px-3.5 text-xs font-semibold text-[#115E3B] hover:bg-[#ECF7F1] dark:border-[#1E3A2D] dark:bg-[#102119] dark:text-[#34D399]"
                >
                  <Printer className="h-4 w-4" />
                  <span>{t.reportType3Title}</span>
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                setShowForm((v) => !v);
                setErrorMsg('');
              }}
              className="flex min-h-[42px] items-center gap-2 rounded-xl bg-[#115E3B] px-4 text-xs font-semibold text-white hover:bg-[#0D4A2E] dark:bg-[#10B981] dark:text-[#052E1C]"
            >
              <Plus className="h-4 w-4" />
              <span>{t.newAdjustmentButton}</span>
            </button>
          </div>

          {/* New Adjustment Form */}
          {showForm && (
            <form
              onSubmit={handleSubmit}
              className="space-y-3 rounded-2xl border border-[#115E3B]/30 bg-[#F7FAF8] p-4 dark:border-[#10B981]/30 dark:bg-[#091611]"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-[#0B1F16] dark:text-[#F2F9F5]">
                  {t.newAdjustmentButton}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="text-xs font-semibold text-[#335947] hover:underline dark:text-[#9EC0AE]"
                >
                  {t.cancel}
                </button>
              </div>

              {errorMsg && (
                <div className="rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-300">
                  {errorMsg}
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#0B1F16] dark:text-[#F2F9F5]">
                    {t.adjustmentTypeLabel}
                  </label>
                  <select
                    value={adjustmentType}
                    onChange={(e) => setAdjustmentType(e.target.value as AdjustmentType)}
                    className={inputClass}
                  >
                    <option value="deduction">{t.adjustmentTypeDeduction}</option>
                    <option value="restock">{t.adjustmentTypeRestock}</option>
                    <option value="damage">{t.adjustmentTypeDamage}</option>
                    <option value="loss">{t.adjustmentTypeLoss}</option>
                    <option value="transfer">{t.adjustmentTypeTransfer}</option>
                    <option value="correction">{t.adjustmentTypeCorrection}</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#0B1F16] dark:text-[#F2F9F5]">
                    {t.adjustmentWarehouseLabel}
                  </label>
                  <select
                    value={warehouseId}
                    onChange={(e) => {
                      setWarehouseId(e.target.value);
                      setProductId('');
                    }}
                    className={inputClass}
                  >
                    <option value="">{t.productAllWarehouses}</option>
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#0B1F16] dark:text-[#F2F9F5]">
                    {t.adjustmentCategoryLabel}
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => {
                      setFormCategory(e.target.value);
                      setProductId('');
                    }}
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

                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-semibold text-[#0B1F16] dark:text-[#F2F9F5]">
                    {t.adjustmentProductLabel} *
                  </label>
                  <select
                    required
                    value={productId}
                    onChange={(e) => setProductId(e.target.value)}
                    className={inputClass}
                  >
                    <option value="">{t.posSelectProduct}</option>
                    {formFilteredProducts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.code} — {p.name} ({t.digitalMgmtInventory}: {p.quantity}
                        {p.warehouseName ? ` · ${p.warehouseName}` : ''})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#0B1F16] dark:text-[#F2F9F5]">
                    {t.adjustmentQtyDeltaLabel}
                  </label>
                  <input
                    type="number"
                    step="1"
                    min={adjustmentType === 'correction' ? undefined : '1'}
                    value={qtyInput}
                    onChange={(e) => setQtyInput(e.target.value)}
                    className={`${inputClass} tabular-nums`}
                  />
                </div>

                {adjustmentType === 'transfer' && (
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[#115E3B] dark:text-[#34D399]">
                      {t.adjustmentTargetWarehouseLabel} *
                    </label>
                    <select
                      required
                      value={targetWarehouseId}
                      onChange={(e) => setTargetWarehouseId(e.target.value)}
                      className={inputClass}
                    >
                      <option value="">—</option>
                      {warehouses.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#0B1F16] dark:text-[#F2F9F5]">
                    {t.adjustmentSupplierLabel}
                  </label>
                  <select
                    value={supplierId}
                    onChange={(e) => setSupplierId(e.target.value)}
                    className={inputClass}
                  >
                    <option value="">{t.supplierNoSupplierOption}</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.code} — {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#0B1F16] dark:text-[#F2F9F5]">
                    {t.adjustmentDateLabel}
                  </label>
                  <input
                    type="date"
                    value={adjustmentDate}
                    onChange={(e) => setAdjustmentDate(e.target.value)}
                    className={`${inputClass} tabular-nums`}
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-semibold text-[#0B1F16] dark:text-[#F2F9F5]">
                    {t.adjustmentReasonLabel}
                  </label>
                  <input
                    type="text"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder={t.adjustmentReasonPlaceholder}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#0B1F16] dark:text-[#F2F9F5]">
                    {t.purchaseNotesLabel}
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex min-h-[44px] items-center gap-2 rounded-xl bg-[#115E3B] px-5 text-xs font-semibold text-white hover:bg-[#0D4A2E] disabled:opacity-60 dark:bg-[#10B981] dark:text-[#052E1C]"
                >
                  <Check className="h-4 w-4" />
                  <span>{submitting ? t.saving : t.adjustmentConfirmButton}</span>
                </button>
              </div>
            </form>
          )}

          {/* Advanced Filter Panel */}
          <div className="space-y-2.5 rounded-2xl border border-[#DCE7E0] bg-[#F7FAF8] p-3.5 dark:border-[#1E3A2D] dark:bg-[#091611]">
            <div className="flex items-center justify-between text-xs font-bold text-[#115E3B] dark:text-[#34D399]">
              <span className="flex items-center gap-1.5">
                <Filter className="h-3.5 w-3.5" />
                <span>{t.adjustmentFilterTitle}</span>
              </span>
              <button
                type="button"
                onClick={resetFilters}
                className="flex items-center gap-1 font-semibold text-[#335947] hover:underline dark:text-[#9EC0AE]"
              >
                <RotateCcw className="h-3 w-3" />
                <span>{t.purchasesFilterReset}</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div>
                <label className="mb-1 block text-[11px] font-medium text-[#335947] dark:text-[#9EC0AE]">
                  {t.adjustmentFilterFrom}
                </label>
                <input
                  type="date"
                  value={filterFrom}
                  onChange={(e) => setFilterFrom(e.target.value)}
                  className={`${inputClass} tabular-nums`}
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-[#335947] dark:text-[#9EC0AE]">
                  {t.adjustmentFilterTo}
                </label>
                <input
                  type="date"
                  value={filterTo}
                  onChange={(e) => setFilterTo(e.target.value)}
                  className={`${inputClass} tabular-nums`}
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-[#335947] dark:text-[#9EC0AE]">
                  {t.adjustmentFilterWarehouse}
                </label>
                <select
                  value={filterWarehouseId}
                  onChange={(e) => setFilterWarehouseId(e.target.value)}
                  className={inputClass}
                >
                  <option value="">{t.productAllWarehouses}</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-[#335947] dark:text-[#9EC0AE]">
                  {t.adjustmentFilterCategory}
                </label>
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
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
              <div>
                <label className="mb-1 block text-[11px] font-medium text-[#335947] dark:text-[#9EC0AE]">
                  {t.adjustmentFilterProduct}
                </label>
                <select
                  value={filterProductId}
                  onChange={(e) => setFilterProductId(e.target.value)}
                  className={inputClass}
                >
                  <option value="">{t.posFilterAll}</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} — {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-[#335947] dark:text-[#9EC0AE]">
                  {t.adjustmentFilterSupplier}
                </label>
                <select
                  value={filterSupplierId}
                  onChange={(e) => setFilterSupplierId(e.target.value)}
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
              <div className="col-span-2">
                <label className="mb-1 block text-[11px] font-medium text-[#335947] dark:text-[#9EC0AE]">
                  {t.adjustmentFilterType}
                </label>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className={inputClass}
                >
                  <option value="">{t.posFilterAll}</option>
                  <option value="deduction">{t.adjustmentTypeDeduction}</option>
                  <option value="restock">{t.adjustmentTypeRestock}</option>
                  <option value="damage">{t.adjustmentTypeDamage}</option>
                  <option value="loss">{t.adjustmentTypeLoss}</option>
                  <option value="transfer">{t.adjustmentTypeTransfer}</option>
                  <option value="correction">{t.adjustmentTypeCorrection}</option>
                </select>
              </div>
            </div>
          </div>

          {/* Ledger */}
          {filteredAdjustments.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#DCE7E0] bg-[#F7FAF8] p-8 text-center dark:border-[#1E3A2D] dark:bg-[#091611]">
              <p className="font-display text-base font-bold text-[#0B1F16] dark:text-[#F2F9F5]">
                {t.adjustmentEmptyTitle}
              </p>
              <p className="mt-1 text-xs text-[#335947] dark:text-[#9EC0AE]">
                {t.adjustmentEmptySubtitle}
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredAdjustments.map((adj) => (
                <div
                  key={adj.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#DCE7E0] bg-white p-3.5 dark:border-[#1E3A2D] dark:bg-[#091611]"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-mono-code font-bold text-[#115E3B] dark:text-[#34D399]">
                        {adj.referenceNumber}
                      </span>
                      <span aria-hidden="true" className="text-[#6B8A79]">·</span>
                      <span className="font-semibold text-[#0B1F16] dark:text-[#F2F9F5]">
                        {typeLabel(adj.adjustmentType)}
                      </span>
                      <span aria-hidden="true" className="text-[#6B8A79]">·</span>
                      <span className="tabular-nums text-[#335947] dark:text-[#9EC0AE]">
                        {adj.adjustmentDate}
                      </span>
                    </div>

                    <p className="text-sm font-bold text-[#0B1F16] dark:text-[#F2F9F5]">
                      {adj.productCode} — {adj.productName}
                    </p>

                    <p className="text-xs text-[#335947] dark:text-[#9EC0AE]">
                      {[
                        adj.warehouseName,
                        adj.targetWarehouseName ? `→ ${adj.targetWarehouseName}` : '',
                        adj.category,
                        adj.supplierName,
                        adj.reason,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="tabular-nums text-end">
                      <span
                        className={`block text-sm font-bold ${
                          adj.quantityDelta > 0
                            ? 'text-[#115E3B] dark:text-[#34D399]'
                            : adj.quantityDelta < 0
                            ? 'text-amber-700 dark:text-amber-300'
                            : 'text-[#0B1F16] dark:text-[#F2F9F5]'
                        }`}
                      >
                        {adj.quantityDelta > 0 ? `+${adj.quantityDelta}` : adj.quantityDelta}
                      </span>
                      <span className="block text-[11px] text-[#335947] dark:text-[#9EC0AE]">
                        {formatNumber(adj.quantityBefore, lang)} → {formatNumber(adj.quantityAfter, lang)}
                        {adj.totalValue > 0 ? ` · ${formatCurrency(adj.totalValue, currency, lang)}` : ''}
                      </span>
                    </div>

                    {confirmDeleteId === adj.id ? (
                      <button
                        type="button"
                        onClick={async () => {
                          await onDeleteAdjustment(adj.id);
                          setConfirmDeleteId(null);
                        }}
                        className="rounded-xl bg-red-600 px-2.5 py-1.5 text-xs font-semibold text-white"
                      >
                        {t.confirmDeleteAction}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(adj.id)}
                        aria-label={t.delete}
                        className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#DCE7E0] text-red-600 hover:bg-red-50 dark:border-[#1E3A2D] dark:text-red-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pb-safe border-t border-[#DCE7E0] bg-white px-5 py-3.5 dark:border-[#1E3A2D] dark:bg-[#0F2119]">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[46px] w-full rounded-xl border border-[#DCE7E0] text-sm font-semibold text-[#335947] hover:bg-[#F7FAF8] dark:border-[#1E3A2D] dark:text-[#9EC0AE]"
          >
            {t.close}
          </button>
        </div>
      </div>
    </div>
  );
}
