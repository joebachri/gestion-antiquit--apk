import { useEffect, useState } from 'react';
import { Check, ExternalLink, Facebook, Globe, Instagram, MessageCircle, UserCheck, X } from 'lucide-react';
import type { Customer, CustomerCategory, CustomerPayload, Language } from '../types';
import { translations } from '../i18n';
import { getCustomerWhatsAppUrl, normalizePhoneForWhatsApp } from '../utils/phone';
import {
  getCustomerFacebookUrl,
  getCustomerInstagramUrl,
  getCustomerWebsiteUrl,
} from '../utils/socialLinks';

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
  const [facebookUrl, setFacebookUrl] = useState('');
  const [instagramUrl, setInstagramUrl] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
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
      setFacebookUrl(editingCustomer.facebookUrl || '');
      setInstagramUrl(editingCustomer.instagramUrl || '');
      setWebsiteUrl(editingCustomer.websiteUrl || '');
      setCategory(editingCustomer.category || 'regular');
      setNotes(editingCustomer.notes);
    } else {
      setName('');
      setPhone('');
      setCity('');
      setAddress('');
      setFacebookUrl('');
      setInstagramUrl('');
      setWebsiteUrl('');
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
          facebookUrl: facebookUrl.trim(),
          instagramUrl: instagramUrl.trim(),
          websiteUrl: websiteUrl.trim(),
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
              className="min-h-[44px] w-full rounded-xl border border-[#DCE7E0] bg-[#F7FAF8] px-3.5 text-sm text-[#0B1F16] placeholder:text-[#6B8A79] focus:border-[#115E3B] focus:bg-white focus:outline-none dark:border-[#1E3A2D] dark:bg-[#091611] dark:text-[#F2F9F5] dark:placeholder:text-[#8FB39E] dark:focus:border-[#10B981] dark:focus:bg-[#0D1E16]"
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
                className="min-h-[44px] w-full rounded-xl border border-[#DCE7E0] bg-[#F7FAF8] px-3.5 text-sm text-[#0B1F16] placeholder:text-[#6B8A79] focus:border-[#115E3B] focus:bg-white focus:outline-none dark:border-[#1E3A2D] dark:bg-[#091611] dark:text-[#F2F9F5] dark:placeholder:text-[#8FB39E] dark:focus:border-[#10B981] dark:focus:bg-[#0D1E16]"
              />
              {(() => {
                const waUrl = getCustomerWhatsAppUrl(phone);
                const normalized = normalizePhoneForWhatsApp(phone);
                if (!waUrl || !normalized) return null;
                return (
                  <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-[#115E3B] dark:text-[#34D399]">
                    <MessageCircle className="h-3.5 w-3.5 shrink-0" />
                    <span>{t.customerWhatsAppLinkedHint}</span>
                    <a
                      href={waUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      dir="ltr"
                      className="truncate font-semibold underline underline-offset-2"
                    >
                      wa.me/{normalized}
                    </a>
                  </div>
                );
              })()}
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
                className="min-h-[44px] w-full rounded-xl border border-[#DCE7E0] bg-[#F7FAF8] px-3.5 text-sm text-[#0B1F16] placeholder:text-[#6B8A79] focus:border-[#115E3B] focus:bg-white focus:outline-none dark:border-[#1E3A2D] dark:bg-[#091611] dark:text-[#F2F9F5] dark:placeholder:text-[#8FB39E] dark:focus:border-[#10B981] dark:focus:bg-[#0D1E16]"
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
              className="min-h-[44px] w-full rounded-xl border border-[#DCE7E0] bg-[#F7FAF8] px-3.5 text-sm text-[#0B1F16] placeholder:text-[#6B8A79] focus:border-[#115E3B] focus:bg-white focus:outline-none dark:border-[#1E3A2D] dark:bg-[#091611] dark:text-[#F2F9F5] dark:placeholder:text-[#8FB39E] dark:focus:border-[#10B981] dark:focus:bg-[#0D1E16]"
            />
          </div>

          {/* Social Media & Website */}
          <div className="space-y-3 rounded-2xl border border-[#DCE7E0] bg-[#F7FAF8]/70 p-3.5 dark:border-[#1E3A2D] dark:bg-[#091611]/70">
            <p className="text-xs font-bold text-[#0B1F16] dark:text-[#F2F9F5]">
              {t.customerSocialSectionLabel}
            </p>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-[#0B1F16] dark:text-[#F2F9F5]">
                  <Facebook className="h-3.5 w-3.5 text-[#1877F2] dark:text-[#60A5FA]" />
                  <span>{t.customerFacebookLabel}</span>
                </label>
                <input
                  type="text"
                  dir="ltr"
                  value={facebookUrl}
                  onChange={(e) => setFacebookUrl(e.target.value)}
                  placeholder={t.customerFacebookPlaceholder}
                  className="min-h-[42px] w-full rounded-xl border border-[#DCE7E0] bg-white px-3 text-xs text-[#0B1F16] placeholder:text-[#6B8A79] focus:border-[#1877F2] focus:bg-white focus:outline-none dark:border-[#1E3A2D] dark:bg-[#0F2119] dark:text-[#F2F9F5] dark:placeholder:text-[#8FB39E] dark:focus:border-[#60A5FA] dark:focus:bg-[#0D1E16]"
                />
                {(() => {
                  const resolved = getCustomerFacebookUrl(facebookUrl);
                  if (!resolved) return null;
                  return (
                    <a
                      href={resolved}
                      target="_blank"
                      rel="noopener noreferrer"
                      dir="ltr"
                      className="mt-1 inline-flex max-w-full items-center gap-1 truncate text-[11px] font-medium text-[#1877F2] underline underline-offset-2 dark:text-[#60A5FA]"
                    >
                      <ExternalLink className="h-3 w-3 shrink-0" />
                      <span className="truncate">{resolved.replace(/^https?:\/\//i, '')}</span>
                    </a>
                  );
                })()}
              </div>

              <div>
                <label className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-[#0B1F16] dark:text-[#F2F9F5]">
                  <Instagram className="h-3.5 w-3.5 text-[#C13584] dark:text-[#F472B6]" />
                  <span>{t.customerInstagramLabel}</span>
                </label>
                <input
                  type="text"
                  dir="ltr"
                  value={instagramUrl}
                  onChange={(e) => setInstagramUrl(e.target.value)}
                  placeholder={t.customerInstagramPlaceholder}
                  className="min-h-[42px] w-full rounded-xl border border-[#DCE7E0] bg-white px-3 text-xs text-[#0B1F16] placeholder:text-[#6B8A79] focus:border-[#C13584] focus:bg-white focus:outline-none dark:border-[#1E3A2D] dark:bg-[#0F2119] dark:text-[#F2F9F5] dark:placeholder:text-[#8FB39E] dark:focus:border-[#F472B6] dark:focus:bg-[#0D1E16]"
                />
                {(() => {
                  const resolved = getCustomerInstagramUrl(instagramUrl);
                  if (!resolved) return null;
                  return (
                    <a
                      href={resolved}
                      target="_blank"
                      rel="noopener noreferrer"
                      dir="ltr"
                      className="mt-1 inline-flex max-w-full items-center gap-1 truncate text-[11px] font-medium text-[#C13584] underline underline-offset-2 dark:text-[#F472B6]"
                    >
                      <ExternalLink className="h-3 w-3 shrink-0" />
                      <span className="truncate">{resolved.replace(/^https?:\/\//i, '')}</span>
                    </a>
                  );
                })()}
              </div>
            </div>

            <div>
              <label className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-[#0B1F16] dark:text-[#F2F9F5]">
                <Globe className="h-3.5 w-3.5 text-[#115E3B] dark:text-[#34D399]" />
                <span>{t.customerWebsiteLabel}</span>
              </label>
              <input
                type="text"
                dir="ltr"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder={t.customerWebsitePlaceholder}
                className="min-h-[42px] w-full rounded-xl border border-[#DCE7E0] bg-white px-3 text-xs text-[#0B1F16] placeholder:text-[#6B8A79] focus:border-[#115E3B] focus:bg-white focus:outline-none dark:border-[#1E3A2D] dark:bg-[#0F2119] dark:text-[#F2F9F5] dark:placeholder:text-[#8FB39E] dark:focus:border-[#10B981] dark:focus:bg-[#0D1E16]"
              />
              {(() => {
                const resolved = getCustomerWebsiteUrl(websiteUrl);
                if (!resolved) return null;
                return (
                  <a
                    href={resolved}
                    target="_blank"
                    rel="noopener noreferrer"
                    dir="ltr"
                    className="mt-1 inline-flex max-w-full items-center gap-1 truncate text-[11px] font-medium text-[#115E3B] underline underline-offset-2 dark:text-[#34D399]"
                  >
                    <ExternalLink className="h-3 w-3 shrink-0" />
                    <span className="truncate">{resolved.replace(/^https?:\/\//i, '')}</span>
                  </a>
                );
              })()}
            </div>
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
              className="w-full rounded-xl border border-[#DCE7E0] bg-[#F7FAF8] p-3 text-sm text-[#0B1F16] placeholder:text-[#6B8A79] focus:border-[#115E3B] focus:bg-white focus:outline-none dark:border-[#1E3A2D] dark:bg-[#091611] dark:text-[#F2F9F5] dark:placeholder:text-[#8FB39E] dark:focus:border-[#10B981] dark:focus:bg-[#0D1E16]"
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
