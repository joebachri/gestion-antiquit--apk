import { useEffect, useState } from 'react';
import { Check, UserCheck, X } from 'lucide-react';
import type { Customer, CustomerCategory, CustomerPayload, Language } from '../types';
import { translations } from '../i18n';

interface CustomerFormModalProps {
  isOpen: boolean;
  lang: Language;
  editingCustomer: Customer | null;
  onClose: () => void;
  onSubmit: (payload: CustomerPayload, editingId?: string) => Promise<void>;
}

const CATEGORIES: CustomerCategory[] = ['seller', 'hobbyist', 'regular', 'other'];

export function getCustomerCategoryLabel(category: CustomerCategory, lang: Language): string {
  const t = translations[lang];
  if (category === 'seller') return t.customerCategorySeller;
  if (category === 'hobbyist') return t.customerCategoryHobbyist;
  if (category === 'regular') return t.customerCategoryRegular;
  return t.customerCategoryOther;
}

export function CustomerFormModal({
  isOpen,
  lang,
  editingCustomer,
  onClose,
  onSubmit,
}: CustomerFormModalProps) {
  const t = translations[lang];
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [category, setCategory] = useState<CustomerCategory>('regular');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setError('');
    if (editingCustomer) {
      setName(editingCustomer.name);
      setPhone(editingCustomer.phone);
      setCity(editingCustomer.city);
      setAddress(editingCustomer.address);
      setCategory(editingCustomer.category || 'regular');
      setNotes(editingCustomer.notes);
    } else {
      setName('');
      setPhone('');
      setCity('');
      setAddress('');
      setCategory('regular');
      setNotes('');
    }
  }, [isOpen, editingCustomer]);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError(t.customerValidationNameRequired);
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSubmit(
        {
          name: name.trim(),
          phone: phone.trim(),
          city: city.trim(),
          address: address.trim(),
          category,
          notes: notes.trim(),
        },
        editingCustomer?.id
      );
      onClose();
    } catch {
      setError(t.errorSave);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-0 backdrop-blur-xs sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-[#DCE7E0] bg-white p-6 shadow-xl sm:rounded-3xl dark:border-[#1E3A2D] dark:bg-[#0F2119]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-[#DCE7E0] sm:hidden dark:bg-[#1E3A2D]" />

        <div className="mb-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#ECF7F1] text-[#115E3B] dark:bg-[#132B20] dark:text-[#34D399]">
              <UserCheck className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-display text-lg font-bold text-[#0B1F16] sm:text-xl dark:text-[#F2F9F5]">
                {editingCustomer ? t.editCustomerTitle : t.newCustomerTitle}
              </h2>
              {editingCustomer && (
                <span className="font-mono-code text-xs font-bold text-[#115E3B] dark:text-[#34D399]">
                  {editingCustomer.code}
                </span>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={t.close}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-[#335947] hover:bg-[#ECF7F1] dark:text-[#9EC0AE] dark:hover:bg-[#162E23]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={(e) => void handleSave(e)} className="space-y-4">
          {/* Category */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-[#0B1F16] dark:text-[#F2F9F5]">
              {t.customerCategoryLabel}
            </label>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`min-h-[42px] rounded-xl border px-3 text-xs font-semibold transition-colors ${
                    category === cat
                      ? 'border-[#115E3B] bg-[#115E3B] text-white dark:border-[#10B981] dark:bg-[#10B981] dark:text-[#052E1C]'
                      : 'border-[#DCE7E0] bg-[#F7FAF8] text-[#0B1F16] hover:border-[#115E3B]/40 dark:border-[#1E3A2D] dark:bg-[#091611] dark:text-[#F2F9F5]'
                  }`}
                >
                  {getCustomerCategoryLabel(cat, lang)}
                </button>
              ))}
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-[#0B1F16] dark:text-[#F2F9F5]">
              {t.customerNameLabel} *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t.customerNamePlaceholder}
              className="min-h-[44px] w-full rounded-xl border border-[#DCE7E0] bg-[#F7FAF8] px-3.5 text-sm text-[#0B1F16] focus:border-[#115E3B] focus:bg-white focus:outline-none dark:border-[#1E3A2D] dark:bg-[#091611] dark:text-[#F2F9F5]"
            />
          </div>

          {/* Phone & City */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#0B1F16] dark:text-[#F2F9F5]">
                {t.customerPhoneLabel}
              </label>
              <input
                type="tel"
                dir="ltr"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={t.customerPhonePlaceholder}
                className="min-h-[44px] w-full rounded-xl border border-[#DCE7E0] bg-[#F7FAF8] px-3.5 text-sm text-[#0B1F16] focus:border-[#115E3B] focus:bg-white focus:outline-none dark:border-[#1E3A2D] dark:bg-[#091611] dark:text-[#F2F9F5]"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-[#0B1F16] dark:text-[#F2F9F5]">
                {t.customerCityLabel}
              </label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder={t.customerCityPlaceholder}
                className="min-h-[44px] w-full rounded-xl border border-[#DCE7E0] bg-[#F7FAF8] px-3.5 text-sm text-[#0B1F16] focus:border-[#115E3B] focus:bg-white focus:outline-none dark:border-[#1E3A2D] dark:bg-[#091611] dark:text-[#F2F9F5]"
              />
            </div>
          </div>

          {/* Address */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-[#0B1F16] dark:text-[#F2F9F5]">
              {t.customerAddressLabel}
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder={t.customerAddressPlaceholder}
              className="min-h-[44px] w-full rounded-xl border border-[#DCE7E0] bg-[#F7FAF8] px-3.5 text-sm text-[#0B1F16] focus:border-[#115E3B] focus:bg-white focus:outline-none dark:border-[#1E3A2D] dark:bg-[#091611] dark:text-[#F2F9F5]"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-[#0B1F16] dark:text-[#F2F9F5]">
              {t.customerNotesLabel}
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t.customerNotesPlaceholder}
              className="w-full rounded-xl border border-[#DCE7E0] bg-[#F7FAF8] p-3 text-sm text-[#0B1F16] focus:border-[#115E3B] focus:bg-white focus:outline-none dark:border-[#1E3A2D] dark:bg-[#091611] dark:text-[#F2F9F5]"
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[48px] flex-1 rounded-xl border border-[#DCE7E0] text-sm font-semibold text-[#335947] hover:bg-[#F7FAF8] dark:border-[#1E3A2D] dark:text-[#9EC0AE] dark:hover:bg-[#162E23]"
            >
              {t.cancel}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl bg-[#115E3B] text-sm font-semibold text-white hover:bg-[#0D4A2E] disabled:opacity-60 dark:bg-[#10B981] dark:text-[#052E1C]"
            >
              <Check className="h-4 w-4" />
              <span>{saving ? t.saving : t.save}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
