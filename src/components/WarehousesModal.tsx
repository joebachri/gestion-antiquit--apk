import { useEffect, useState } from 'react';
import {
  Check,
  Edit3,
  MapPin,
  Phone,
  Plus,
  Printer,
  Star,
  Trash2,
  User,
  Warehouse as WarehouseIcon,
  X,
} from 'lucide-react';
import type { Language, Product, Warehouse, WarehousePayload } from '../types';
import { formatCurrency, formatNumber, translations } from '../i18n';

interface WarehousesModalProps {
  isOpen: boolean;
  lang: Language;
  currency: string;
  warehouses: Warehouse[];
  products: Product[];
  onClose: () => void;
  onSaveWarehouse: (payload: WarehousePayload, editingId?: string) => Promise<void>;
  onDeleteWarehouse: (warehouseId: string) => Promise<void>;
  onPrintWarehouseReport?: (warehouseId?: string) => void;
}

export function WarehousesModal({
  isOpen,
  lang,
  currency,
  warehouses,
  products,
  onClose,
  onSaveWarehouse,
  onDeleteWarehouse,
  onPrintWarehouseReport,
}: WarehousesModalProps) {
  const t = translations[lang];
  const [showForm, setShowForm] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null);
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [managerName, setManagerName] = useState('');
  const [notes, setNotes] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setShowForm(false);
    setEditingWarehouse(null);
    setConfirmDeleteId(null);
    setErrorMsg('');
  }, [isOpen]);

  if (!isOpen) return null;

  const openNewForm = () => {
    setEditingWarehouse(null);
    setName('');
    setLocation('');
    setAddress('');
    setPhone('');
    setManagerName('');
    setNotes('');
    setIsDefault(warehouses.length === 0);
    setErrorMsg('');
    setShowForm(true);
  };

  const openEditForm = (w: Warehouse) => {
    setEditingWarehouse(w);
    setName(w.name);
    setLocation(w.location || '');
    setAddress(w.address || '');
    setPhone(w.phone || '');
    setManagerName(w.managerName || '');
    setNotes(w.notes || '');
    setIsDefault(Boolean(w.isDefault));
    setErrorMsg('');
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
      setErrorMsg(t.warehouseValidationNameRequired);
      return;
    }
    setSubmitting(true);
    setErrorMsg('');
    try {
      await onSaveWarehouse(
        {
          name: cleanName,
          location: location.trim(),
          address: address.trim(),
          phone: phone.trim(),
          managerName: managerName.trim(),
          notes: notes.trim(),
          isDefault,
        },
        editingWarehouse?.id
      );
      setShowForm(false);
      setEditingWarehouse(null);
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
        className="flex max-h-[94dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl border border-[#DCE7E0] bg-white shadow-2xl sm:rounded-3xl dark:border-[#1E3A2D] dark:bg-[#0F2119]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-[#DCE7E0] px-5 py-4 dark:border-[#1E3A2D]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#ECF7F1] text-[#115E3B] dark:bg-[#132B20] dark:text-[#34D399]">
              <WarehouseIcon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate font-display text-lg font-bold text-[#0B1F16] dark:text-[#F2F9F5]">
                {t.warehousesTitle}
              </h2>
              <p className="truncate text-xs text-[#335947] dark:text-[#9EC0AE]">
                {t.warehousesSubtitle}
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
            {onPrintWarehouseReport && (
              <button
                type="button"
                onClick={() => onPrintWarehouseReport()}
                className="flex min-h-[42px] items-center gap-2 rounded-xl border border-[#DCE7E0] bg-[#F7FAF8] px-3.5 text-xs font-semibold text-[#115E3B] hover:bg-[#ECF7F1] dark:border-[#1E3A2D] dark:bg-[#102119] dark:text-[#34D399]"
              >
                <Printer className="h-4 w-4" />
                <span>{t.reportType10Title}</span>
              </button>
            )}

            <button
              type="button"
              onClick={openNewForm}
              className="flex min-h-[42px] items-center gap-2 rounded-xl bg-[#115E3B] px-4 text-xs font-semibold text-white hover:bg-[#0D4A2E] dark:bg-[#10B981] dark:text-[#052E1C]"
            >
              <Plus className="h-4 w-4" />
              <span>{t.addWarehouseButton}</span>
            </button>
          </div>

          {/* Inline Create / Edit Form */}
          {showForm && (
            <form
              onSubmit={handleSubmit}
              className="space-y-3 rounded-2xl border border-[#115E3B]/30 bg-[#F7FAF8] p-4 dark:border-[#10B981]/30 dark:bg-[#091611]"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-[#0B1F16] dark:text-[#F2F9F5]">
                  {editingWarehouse ? t.editWarehouseTitle : t.addWarehouseButton}
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

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#0B1F16] dark:text-[#F2F9F5]">
                    {t.warehouseNameLabel} *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t.warehouseNamePlaceholder}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#0B1F16] dark:text-[#F2F9F5]">
                    {t.warehouseLocationLabel}
                  </label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder={t.warehouseLocationPlaceholder}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#0B1F16] dark:text-[#F2F9F5]">
                    {t.warehouseManagerLabel}
                  </label>
                  <input
                    type="text"
                    value={managerName}
                    onChange={(e) => setManagerName(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#0B1F16] dark:text-[#F2F9F5]">
                    {t.warehousePhoneLabel}
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-semibold text-[#0B1F16] dark:text-[#F2F9F5]">
                    {t.warehouseAddressLabel}
                  </label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-semibold text-[#0B1F16] dark:text-[#F2F9F5]">
                    {t.warehouseNotesLabel}
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>

              <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-[#0B1F16] dark:text-[#F2F9F5]">
                <input
                  type="checkbox"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="h-4 w-4 accent-[#115E3B]"
                />
                <span>{t.warehouseSetDefault}</span>
              </label>

              <div className="flex justify-end gap-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex min-h-[42px] items-center gap-2 rounded-xl bg-[#115E3B] px-4 text-xs font-semibold text-white hover:bg-[#0D4A2E] disabled:opacity-60 dark:bg-[#10B981] dark:text-[#052E1C]"
                >
                  <Check className="h-4 w-4" />
                  <span>{submitting ? t.saving : t.save}</span>
                </button>
              </div>
            </form>
          )}

          {/* Warehouses List */}
          {warehouses.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#DCE7E0] bg-[#F7FAF8] p-8 text-center dark:border-[#1E3A2D] dark:bg-[#091611]">
              <p className="font-display text-base font-bold text-[#0B1F16] dark:text-[#F2F9F5]">
                {t.warehouseEmptyTitle}
              </p>
              <p className="mt-1 text-xs text-[#335947] dark:text-[#9EC0AE]">
                {t.warehouseEmptySubtitle}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {warehouses.map((w) => {
                const whProducts = products.filter((p) => p.warehouseId === w.id);
                const units = whProducts.reduce((s, p) => s + (Number(p.quantity) || 0), 0);
                const valueMad = whProducts.reduce(
                  (s, p) => s + (Number(p.sellingPrice) || 0) * (Number(p.quantity) || 0),
                  0
                );

                return (
                  <div
                    key={w.id}
                    className="rounded-2xl border border-[#DCE7E0] bg-white p-4 dark:border-[#1E3A2D] dark:bg-[#091611]"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="font-mono-code font-bold text-[#115E3B] dark:text-[#34D399]">
                            {w.code}
                          </span>
                          {w.isDefault && (
                            <span className="inline-flex items-center gap-1 font-bold text-amber-700 dark:text-amber-300">
                              <Star className="h-3 w-3 fill-current" />
                              <span>{t.warehouseDefaultBadge}</span>
                            </span>
                          )}
                          {w.location && (
                            <span className="inline-flex items-center gap-1 text-[#335947] dark:text-[#9EC0AE]">
                              <MapPin className="h-3 w-3" />
                              <span>{w.location}</span>
                            </span>
                          )}
                        </div>
                        <h3 className="mt-0.5 font-display text-base font-bold text-[#0B1F16] dark:text-[#F2F9F5]">
                          {w.name}
                        </h3>
                        {(w.managerName || w.phone || w.address) && (
                          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#335947] dark:text-[#9EC0AE]">
                            {w.managerName && (
                              <span className="inline-flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {w.managerName}
                              </span>
                            )}
                            {w.phone && (
                              <span className="inline-flex items-center gap-1 tabular-nums">
                                <Phone className="h-3 w-3" />
                                {w.phone}
                              </span>
                            )}
                            {w.address && <span>{w.address}</span>}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        {onPrintWarehouseReport && (
                          <button
                            type="button"
                            onClick={() => onPrintWarehouseReport(w.id)}
                            title={t.reportType3Title}
                            className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#DCE7E0] text-[#115E3B] hover:bg-[#ECF7F1] dark:border-[#1E3A2D] dark:text-[#34D399]"
                          >
                            <Printer className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => openEditForm(w)}
                          title={t.edit}
                          className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#DCE7E0] text-[#0B1F16] hover:bg-[#ECF7F1] dark:border-[#1E3A2D] dark:text-[#F2F9F5]"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                        {!w.isDefault && (
                          confirmDeleteId === w.id ? (
                            <button
                              type="button"
                              onClick={async () => {
                                await onDeleteWarehouse(w.id);
                                setConfirmDeleteId(null);
                              }}
                              className="rounded-xl bg-red-600 px-2.5 py-1.5 text-xs font-semibold text-white"
                            >
                              {t.confirmDeleteAction}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(w.id)}
                              title={t.delete}
                              className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#DCE7E0] text-red-600 hover:bg-red-50 dark:border-[#1E3A2D] dark:text-red-400"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )
                        )}
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl border border-[#DCE7E0] bg-[#F7FAF8] p-2.5 text-xs dark:border-[#1E3A2D] dark:bg-[#0F2119]">
                      <div>
                        <span className="block text-[11px] text-[#335947] dark:text-[#9EC0AE]">
                          {t.warehouseProductsCount}
                        </span>
                        <span className="tabular-nums font-bold text-[#0B1F16] dark:text-[#F2F9F5]">
                          {formatNumber(whProducts.length, lang)}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[11px] text-[#335947] dark:text-[#9EC0AE]">
                          {t.warehouseTotalUnits}
                        </span>
                        <span className="tabular-nums font-bold text-[#0B1F16] dark:text-[#F2F9F5]">
                          {formatNumber(units, lang)}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[11px] text-[#335947] dark:text-[#9EC0AE]">
                          {t.warehouseTotalValue}
                        </span>
                        <span className="tabular-nums font-bold text-[#115E3B] dark:text-[#34D399]">
                          {formatCurrency(valueMad, currency, lang)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
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
