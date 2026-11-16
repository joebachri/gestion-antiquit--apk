import { useEffect, useRef, useState } from 'react';
import { Camera, RotateCcw, Upload, X, Check } from 'lucide-react';
import type { Language } from '../types';
import { translations } from '../i18n';
import { compressImageBlob } from '../utils/image';
import { DefaultBabSaidaLogo } from './Header';
import { CameraModal } from './CameraModal';

interface LogoModalProps {
  isOpen: boolean;
  lang: Language;
  customLogo: string;
  currency: string;
  onClose: () => void;
  onSave: (settings: { customLogo: string; currency: string }) => Promise<void>;
}

const CURRENCIES = ['MAD', 'DH', 'EUR', 'USD', 'TND', 'DZD'];

export function LogoModal({
  isOpen,
  lang,
  customLogo,
  currency,
  onClose,
  onSave,
}: LogoModalProps) {
  const t = translations[lang];
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [draftLogo, setDraftLogo] = useState(customLogo);
  const [draftCurrency, setDraftCurrency] = useState(currency);
  const [saving, setSaving] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setDraftLogo(customLogo);
      setDraftCurrency(currency);
    }
  }, [isOpen, customLogo, currency]);

  if (!isOpen) return null;

  const handleFileChange = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageBlob(file, 512, 0.88);
      setDraftLogo(compressed);
    } catch {
      // ignore invalid image
    }
  };

  const handleConfirm = async () => {
    setSaving(true);
    try {
      await onSave({ customLogo: draftLogo, currency: draftCurrency });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div
        dir={lang === 'ar' ? 'rtl' : 'ltr'}
        className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 p-0 backdrop-blur-xs sm:items-center sm:p-4"
        onClick={onClose}
      >
        <div
          className="w-full max-w-md rounded-t-3xl border border-[#DCE7E0] bg-white p-6 shadow-xl sm:rounded-3xl dark:border-[#1E3A2D] dark:bg-[#0F2119]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-[#DCE7E0] sm:hidden dark:bg-[#1E3A2D]" />

          <div className="mb-5 flex items-center justify-between">
            <h2 className="font-display text-xl font-bold text-[#0B1F16] dark:text-[#F2F9F5]">
              {t.logoModalTitle}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label={t.close}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-[#335947] hover:bg-[#ECF7F1] dark:text-[#9EC0AE] dark:hover:bg-[#162E23]"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mb-6 flex flex-col items-center rounded-2xl border border-[#DCE7E0] bg-[#F7FAF8] p-5 dark:border-[#1E3A2D] dark:bg-[#091611]">
            <div className="mb-4 flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl border border-[#DCE7E0] bg-white p-2 dark:border-[#1E3A2D] dark:bg-[#102119]">
              {draftLogo ? (
                <img
                  src={draftLogo}
                  alt={t.brandName}
                  className="h-full w-full rounded-xl object-cover"
                />
              ) : (
                <div className="scale-150">
                  <DefaultBabSaidaLogo />
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex min-h-[44px] items-center gap-2 rounded-xl bg-[#115E3B] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0D4A2E] dark:bg-[#10B981] dark:text-[#052E1C]"
              >
                <Upload className="h-4 w-4" />
                <span>{t.logoUploadButton}</span>
              </button>

              <button
                type="button"
                onClick={() => setCameraOpen(true)}
                className="flex min-h-[44px] items-center gap-2 rounded-xl border border-[#DCE7E0] bg-white px-4 py-2 text-xs font-semibold text-[#115E3B] hover:bg-[#ECF7F1] dark:border-[#1E3A2D] dark:bg-[#102119] dark:text-[#34D399]"
              >
                <Camera className="h-4 w-4" />
                <span>{t.logoCameraButton}</span>
              </button>

              {draftLogo && (
                <button
                  type="button"
                  onClick={() => setDraftLogo('')}
                  className="flex min-h-[44px] items-center gap-1.5 rounded-xl border border-[#DCE7E0] px-3 py-2 text-xs font-medium text-[#335947] hover:bg-[#ECF7F1] dark:border-[#1E3A2D] dark:text-[#9EC0AE]"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>{t.logoResetButton}</span>
                </button>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                void handleFileChange(e.target.files);
                e.target.value = '';
              }}
            />
          </div>

          {/* Currency Selection */}
          <div className="mb-6">
            <label className="mb-2 block text-xs font-semibold text-[#335947] dark:text-[#9EC0AE]">
              {t.currencyLabel}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {CURRENCIES.map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setDraftCurrency(code)}
                  className={`min-h-[44px] rounded-xl border text-xs font-semibold transition-colors ${
                    draftCurrency === code
                      ? 'border-[#115E3B] bg-[#115E3B] text-white dark:border-[#10B981] dark:bg-[#10B981] dark:text-[#052E1C]'
                      : 'border-[#DCE7E0] bg-[#F7FAF8] text-[#0B1F16] hover:border-[#115E3B]/40 dark:border-[#1E3A2D] dark:bg-[#091611] dark:text-[#F2F9F5]'
                  }`}
                >
                  {code}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[48px] flex-1 rounded-xl border border-[#DCE7E0] text-sm font-semibold text-[#335947] hover:bg-[#F7FAF8] dark:border-[#1E3A2D] dark:text-[#9EC0AE] dark:hover:bg-[#162E23]"
            >
              {t.cancel}
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={saving}
              className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl bg-[#115E3B] text-sm font-semibold text-white hover:bg-[#0D4A2E] disabled:opacity-60 dark:bg-[#10B981] dark:text-[#052E1C]"
            >
              <Check className="h-4 w-4" />
              <span>{saving ? t.saving : t.saveSettings}</span>
            </button>
          </div>
        </div>
      </div>

      <CameraModal
        isOpen={cameraOpen}
        lang={lang}
        singleShot
        onClose={() => setCameraOpen(false)}
        onConfirmPhotos={(photos) => {
          if (photos[0]) setDraftLogo(photos[0]);
        }}
      />
    </>
  );
}
