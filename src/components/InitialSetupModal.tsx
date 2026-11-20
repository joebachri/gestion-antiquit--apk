import { useEffect, useState } from 'react';
import { BookOpen, Check, Sparkles, X } from 'lucide-react';
import type { Language, MetaAuthStatus, ShopSettings } from '../types';
import { formatNumber, translations } from '../i18n';
import { convertFromMad, SUPPORTED_CURRENCIES } from '../utils/currency';
import { MetaAccountCard } from './MetaAccountCard';

interface InitialSetupModalProps {
  isOpen: boolean;
  lang: Language;
  onChangeLang: (lang: Language) => void;
  settings: ShopSettings;
  metaStatus: MetaAuthStatus;
  onRefreshMetaStatus: () => Promise<void>;
  onSaveSettings: (next: ShopSettings) => Promise<void>;
  onNotify?: (message: string) => void;
  onOpenGuide?: () => void;
  onClose: () => void;
}

const CURRENCIES = SUPPORTED_CURRENCIES;

export function InitialSetupModal({
  isOpen,
  lang,
  onChangeLang,
  settings,
  metaStatus,
  onRefreshMetaStatus,
  onSaveSettings,
  onNotify,
  onOpenGuide,
  onClose,
}: InitialSetupModalProps) {
  const t = translations[lang];
  const [storeName, setStoreName] = useState(settings.storeName || '');
  const [currency, setCurrency] = useState(settings.currency || 'MAD');
  const [facebookHandle, setFacebookHandle] = useState(settings.facebookHandle || '');
  const [instagramHandle, setInstagramHandle] = useState(settings.instagramHandle || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setStoreName(settings.storeName || '');
      setCurrency(settings.currency || 'MAD');
      setFacebookHandle(settings.facebookHandle || '');
      setInstagramHandle(settings.instagramHandle || '');
    }
  }, [isOpen, settings]);

  if (!isOpen) return null;

  const handleFinish = async (skipHandles = false) => {
    setSaving(true);
    try {
      const cleanIg = instagramHandle.trim();
      const normalizedIg =
        cleanIg && !cleanIg.startsWith('@') && !cleanIg.includes(' ') ? `@${cleanIg}` : cleanIg;
      const cleanFb = facebookHandle.trim();

      await onSaveSettings({
        customLogo: settings.customLogo,
        storeName: skipHandles ? settings.storeName : storeName.trim(),
        currency,
        facebookHandle: skipHandles ? settings.facebookHandle : cleanFb,
        instagramHandle: skipHandles ? settings.instagramHandle : normalizedIg,
      });
      localStorage.setItem('babsaida_onboarding_done', '1');
      if (!skipHandles && (normalizedIg || cleanFb)) {
        const linkedSummary = [normalizedIg, cleanFb].filter(Boolean).join(' · ');
        onNotify?.(`${t.socialLinkedToast} ${linkedSummary}`);
      } else if (!skipHandles) {
        onNotify?.(t.settingsSavedToast);
      }
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
            {currency !== 'MAD' && currency !== 'DH' && (
              <p className="tabular-nums mt-2 text-xs font-medium text-[#115E3B] dark:text-[#34D399]">
                {formatNumber(100, lang)} MAD = {formatNumber(convertFromMad(100, currency), lang)}{' '}
                {currency}
              </p>
            )}
          </div>

          {/* Optional Store Name */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-[#335947] dark:text-[#9EC0AE]">
              {t.storeNameLabel}
            </label>
            <input
              type="text"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              placeholder={t.storeNamePlaceholder}
              maxLength={80}
              className="min-h-[44px] w-full rounded-xl border border-[#DCE7E0] bg-[#F7FAF8] px-3.5 text-sm text-[#0B1F16] placeholder:text-[#6B8A79] focus:border-[#115E3B] focus:bg-white focus:outline-none dark:border-[#1E3A2D] dark:bg-[#091611] dark:text-[#F2F9F5] dark:placeholder:text-[#8FB39E] dark:focus:border-[#10B981] dark:focus:bg-[#0D1E16]"
            />
          </div>

          {/* Optional Social Accounts Link */}
          <MetaAccountCard
            lang={lang}
            metaStatus={metaStatus}
            onRefreshMetaStatus={onRefreshMetaStatus}
            facebookHandle={facebookHandle}
            instagramHandle={instagramHandle}
            savedFacebookHandle={settings.facebookHandle}
            savedInstagramHandle={settings.instagramHandle}
            onChangeHandles={(next) => {
              setFacebookHandle(next.facebookHandle);
              setInstagramHandle(next.instagramHandle);
            }}
            onSaveHandles={async (next) => {
              await onSaveSettings({
                customLogo: settings.customLogo,
                storeName: storeName.trim(),
                currency,
                facebookHandle: next.facebookHandle,
                instagramHandle: next.instagramHandle,
              });
            }}
            onNotify={onNotify}
          />

          {onOpenGuide && (
            <button
              type="button"
              onClick={onOpenGuide}
              className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-[#DCE7E0] bg-[#ECF7F1] px-4 text-xs font-semibold text-[#115E3B] hover:bg-[#DCF0E4] dark:border-[#1E3A2D] dark:bg-[#132B20] dark:text-[#34D399]"
            >
              <BookOpen className="h-4 w-4 shrink-0" />
              <span>{t.guideOpenLink}</span>
            </button>
          )}
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
