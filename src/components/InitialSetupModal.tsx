import { useEffect, useState } from 'react';
import { Check, Sparkles, X } from 'lucide-react';
import type { Language, MetaAuthStatus, ShopSettings } from '../types';
import { translations } from '../i18n';
import { MetaAccountCard } from './MetaAccountCard';

interface InitialSetupModalProps {
  isOpen: boolean;
  lang: Language;
  onChangeLang: (lang: Language) => void;
  settings: ShopSettings;
  metaStatus: MetaAuthStatus;
  onRefreshMetaStatus: () => Promise<void>;
  onSaveSettings: (next: ShopSettings) => Promise<void>;
  onClose: () => void;
}

const CURRENCIES = ['MAD', 'DH', 'EUR', 'USD', 'TND', 'DZD'];

export function InitialSetupModal({
  isOpen,
  lang,
  onChangeLang,
  settings,
  metaStatus,
  onRefreshMetaStatus,
  onSaveSettings,
  onClose,
}: InitialSetupModalProps) {
  const t = translations[lang];
  const [currency, setCurrency] = useState(settings.currency || 'MAD');
  const [facebookHandle, setFacebookHandle] = useState(settings.facebookHandle || '');
  const [instagramHandle, setInstagramHandle] = useState(settings.instagramHandle || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setCurrency(settings.currency || 'MAD');
      setFacebookHandle(settings.facebookHandle || '');
      setInstagramHandle(settings.instagramHandle || '');
    }
  }, [isOpen, settings]);

  if (!isOpen) return null;

  const handleFinish = async (skipHandles = false) => {
    setSaving(true);
    try {
      await onSaveSettings({
        customLogo: settings.customLogo,
        currency,
        facebookHandle: skipHandles ? settings.facebookHandle : facebookHandle,
        instagramHandle: skipHandles ? settings.instagramHandle : instagramHandle,
      });
      localStorage.setItem('babsaida_onboarding_done', '1');
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-0 backdrop-blur-xs sm:items-center sm:p-4"
    >
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-[#DCE7E0] bg-white p-6 shadow-xl sm:rounded-3xl dark:border-[#1E3A2D] dark:bg-[#0F2119]">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#ECF7F1] text-[#115E3B] dark:bg-[#132B20] dark:text-[#34D399]">
              <Sparkles className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-display text-lg font-bold text-[#0B1F16] dark:text-[#F2F9F5]">
                {t.setupTitle}
              </h2>
              <p className="mt-0.5 text-xs leading-relaxed text-[#335947] dark:text-[#9EC0AE]">
                {t.setupSubtitle}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void handleFinish(true)}
            aria-label={t.close}
            className="flex min-h-[40px] min-w-[40px] shrink-0 items-center justify-center rounded-xl text-[#335947] hover:bg-[#ECF7F1] dark:text-[#9EC0AE] dark:hover:bg-[#162E23]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Language */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-[#335947] dark:text-[#9EC0AE]">
              {t.setupLanguageLabel}
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onChangeLang('fr')}
                className={`min-h-[42px] rounded-xl border text-xs font-semibold transition-colors ${
                  lang === 'fr'
                    ? 'border-[#115E3B] bg-[#115E3B] text-white dark:border-[#10B981] dark:bg-[#10B981] dark:text-[#052E1C]'
                    : 'border-[#DCE7E0] bg-[#F7FAF8] text-[#0B1F16] dark:border-[#1E3A2D] dark:bg-[#091611] dark:text-[#F2F9F5]'
                }`}
              >
                Français (FR)
              </button>
              <button
                type="button"
                onClick={() => onChangeLang('ar')}
                className={`min-h-[42px] rounded-xl border text-xs font-semibold transition-colors ${
                  lang === 'ar'
                    ? 'border-[#115E3B] bg-[#115E3B] text-white dark:border-[#10B981] dark:bg-[#10B981] dark:text-[#052E1C]'
                    : 'border-[#DCE7E0] bg-[#F7FAF8] text-[#0B1F16] dark:border-[#1E3A2D] dark:bg-[#091611] dark:text-[#F2F9F5]'
                }`}
              >
                العربية (AR)
              </button>
            </div>
          </div>

          {/* Currency */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-[#335947] dark:text-[#9EC0AE]">
              {t.currencyLabel}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {CURRENCIES.map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setCurrency(code)}
                  className={`min-h-[40px] rounded-xl border text-xs font-semibold transition-colors ${
                    currency === code
                      ? 'border-[#115E3B] bg-[#115E3B] text-white dark:border-[#10B981] dark:bg-[#10B981] dark:text-[#052E1C]'
                      : 'border-[#DCE7E0] bg-[#F7FAF8] text-[#0B1F16] dark:border-[#1E3A2D] dark:bg-[#091611] dark:text-[#F2F9F5]'
                  }`}
                >
                  {code}
                </button>
              ))}
            </div>
          </div>

          {/* Optional Social Accounts Link */}
          <MetaAccountCard
            lang={lang}
            metaStatus={metaStatus}
            onRefreshMetaStatus={onRefreshMetaStatus}
            facebookHandle={facebookHandle}
            instagramHandle={instagramHandle}
            onChangeHandles={(next) => {
              setFacebookHandle(next.facebookHandle);
              setInstagramHandle(next.instagramHandle);
            }}
          />
        </div>

        <div className="mt-6 flex items-center gap-3">
          <button
            type="button"
            onClick={() => void handleFinish(true)}
            disabled={saving}
            className="min-h-[46px] flex-1 rounded-xl border border-[#DCE7E0] text-xs font-semibold text-[#335947] hover:bg-[#F7FAF8] dark:border-[#1E3A2D] dark:text-[#9EC0AE] dark:hover:bg-[#162E23]"
          >
            {t.setupSkip}
          </button>
          <button
            type="button"
            onClick={() => void handleFinish(false)}
            disabled={saving}
            className="flex min-h-[46px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#115E3B] text-xs font-semibold text-white hover:bg-[#0D4A2E] disabled:opacity-60 dark:bg-[#10B981] dark:text-[#052E1C]"
          >
            <Check className="h-4 w-4" />
            <span>{t.setupContinue}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
