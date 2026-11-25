import { useEffect, useRef, useState } from 'react';
import { BookOpen, Camera, Check, Printer, RotateCcw, Share2, Sliders, Store, Upload, X } from 'lucide-react';
import type {
  Language,
  MetaAuthStatus,
  PrinterMode,
  PrinterPaperFormat,
  SavedPrinterProfile,
  ShopSettings,
} from '../types';
import { formatNumber, translations } from '../i18n';
import { compressImageBlob } from '../utils/image';
import { convertFromMad, SUPPORTED_CURRENCIES } from '../utils/currency';
import { CameraModal } from './CameraModal';
import { MetaAccountCard } from './MetaAccountCard';
import { PrinterSettingsCard } from './PrinterSettingsCard';

interface LogoModalProps {
  isOpen: boolean;
  lang: Language;
  customLogo: string;
  storeName?: string;
  currency: string;
  facebookHandle?: string;
  instagramHandle?: string;
  whatsappPhone?: string;
  printerMode?: PrinterMode;
  printerPaper?: PrinterPaperFormat;
  printerName?: string;
  printerLinked?: boolean;
  savedPrinters?: SavedPrinterProfile[];
  activePrinterId?: string;
  publicAppUrl?: string;
  metaStatus: MetaAuthStatus;
  onRefreshMetaStatus: () => Promise<void>;
  onNotify?: (message: string) => void;
  onOpenGuide?: () => void;
  onClose: () => void;
  onSave: (settings: ShopSettings) => Promise<void>;
}

const CURRENCIES = SUPPORTED_CURRENCIES;

export function LogoModal({
  isOpen,
  lang,
  customLogo,
  storeName = '',
  currency,
  facebookHandle = '',
  instagramHandle = '',
  whatsappPhone = '',
  printerMode = 'pdf_system',
  printerPaper = 'a4',
  printerName = '',
  printerLinked = false,
  savedPrinters = [],
  activePrinterId = '',
  publicAppUrl = '',
  metaStatus,
  onRefreshMetaStatus,
  onNotify,
  onOpenGuide,
  onClose,
  onSave,
}: LogoModalProps) {
  const t = translations[lang];
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [activeTab, setActiveTab] = useState<'general' | 'printers' | 'social'>('general');
  const [draftLogo, setDraftLogo] = useState(customLogo);
  const [draftStoreName, setDraftStoreName] = useState(storeName);
  const [draftCurrency, setDraftCurrency] = useState(currency);
  const [draftFacebookHandle, setDraftFacebookHandle] = useState(facebookHandle);
  const [draftInstagramHandle, setDraftInstagramHandle] = useState(instagramHandle);
  const [draftWhatsappPhone, setDraftWhatsappPhone] = useState(whatsappPhone);
  const [draftPrinterMode, setDraftPrinterMode] = useState<PrinterMode>(printerMode);
  const [draftPrinterPaper, setDraftPrinterPaper] = useState<PrinterPaperFormat>(printerPaper);
  const [draftPrinterName, setDraftPrinterName] = useState(printerName);
  const [draftPrinterLinked, setDraftPrinterLinked] = useState(printerLinked);
  const [draftSavedPrinters, setDraftSavedPrinters] = useState<SavedPrinterProfile[]>(savedPrinters);
  const [draftActivePrinterId, setDraftActivePrinterId] = useState(activePrinterId);
  const [draftPublicAppUrl, setDraftPublicAppUrl] = useState(publicAppUrl);
  const [saving, setSaving] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setDraftLogo(customLogo);
      setDraftStoreName(storeName);
      setDraftCurrency(currency);
      setDraftFacebookHandle(facebookHandle);
      setDraftInstagramHandle(instagramHandle);
      setDraftWhatsappPhone(whatsappPhone);
      setDraftPrinterMode(printerMode);
      setDraftPrinterPaper(printerPaper);
      setDraftPrinterName(printerName);
      setDraftPrinterLinked(printerLinked);
      setDraftSavedPrinters(savedPrinters);
      setDraftActivePrinterId(activePrinterId);
      setDraftPublicAppUrl(publicAppUrl);
    }
  }, [
    isOpen,
    customLogo,
    storeName,
    currency,
    facebookHandle,
    instagramHandle,
    whatsappPhone,
    printerMode,
    printerPaper,
    printerName,
    printerLinked,
    savedPrinters,
    activePrinterId,
    publicAppUrl,
  ]);

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
      const cleanIg = draftInstagramHandle.trim();
      const normalizedIg =
        cleanIg && !cleanIg.startsWith('@') && !cleanIg.includes(' ') ? `@${cleanIg}` : cleanIg;
      const cleanFb = draftFacebookHandle.trim();
      const handlesChanged =
        normalizedIg !== (instagramHandle || '').trim() || cleanFb !== (facebookHandle || '').trim();

      await onSave({
        customLogo: draftLogo,
        storeName: draftStoreName.trim(),
        currency: draftCurrency,
        facebookHandle: cleanFb,
        instagramHandle: normalizedIg,
        whatsappPhone: draftWhatsappPhone.trim(),
        printerMode: draftPrinterMode,
        printerPaper: draftPrinterPaper,
        printerName: draftPrinterName.trim(),
        printerLinked: draftPrinterLinked,
        savedPrinters: draftSavedPrinters,
        activePrinterId: draftActivePrinterId,
        publicAppUrl: draftPublicAppUrl.trim().replace(/\/+$/, ''),
      });

      if (handlesChanged && (normalizedIg || cleanFb)) {
        const linkedSummary = [normalizedIg, cleanFb].filter(Boolean).join(' · ');
        onNotify?.(`${t.socialLinkedToast} ${linkedSummary}`);
      } else {
        onNotify?.(t.settingsSavedToast);
      }
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
          className="pb-safe flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-[#DCE7E0] bg-white shadow-xl sm:rounded-3xl dark:border-[#1E3A2D] dark:bg-[#0F2119]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-6 pt-4">
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-[#DCE7E0] sm:hidden dark:bg-[#1E3A2D]" />

            <div className="mb-4 flex items-center justify-between gap-2">
              <h2 className="font-display text-xl font-bold text-[#0B1F16] dark:text-[#F2F9F5]">
                {t.logoModalTitle}
              </h2>
              <div className="flex items-center gap-1.5">
                {onOpenGuide && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenGuide();
                    }}
                    aria-label={t.guideTitle}
                    title={t.guideTitle}
                    className="flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[#DCE7E0] bg-[#ECF7F1] px-2.5 text-xs font-semibold text-[#115E3B] hover:bg-[#DCF0E4] dark:border-[#1E3A2D] dark:bg-[#132B20] dark:text-[#34D399]"
                  >
                    <BookOpen className="h-4 w-4" />
                    <span>{t.guideButtonLabel}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  aria-label={t.close}
                  className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl text-[#335947] hover:bg-[#ECF7F1] dark:text-[#9EC0AE] dark:hover:bg-[#162E23]"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Settings Tabs */}
            <div className="mb-4 grid grid-cols-3 gap-1.5 rounded-2xl border border-[#DCE7E0] bg-[#F7FAF8] p-1 dark:border-[#1E3A2D] dark:bg-[#091611]">
              <button
                type="button"
                onClick={() => setActiveTab('general')}
                className={`flex min-h-[38px] items-center justify-center gap-1.5 rounded-xl px-2 text-xs font-bold transition-colors ${
                  activeTab === 'general'
                    ? 'bg-[#115E3B] text-white dark:bg-[#10B981] dark:text-[#052E1C]'
                    : 'text-[#335947] hover:bg-[#ECF7F1] dark:text-[#9EC0AE] dark:hover:bg-[#162E23]'
                }`}
              >
                <Sliders className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{t.settingsTabGeneral}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('printers')}
                className={`flex min-h-[38px] items-center justify-center gap-1.5 rounded-xl px-2 text-xs font-bold transition-colors ${
                  activeTab === 'printers'
                    ? 'bg-[#115E3B] text-white dark:bg-[#10B981] dark:text-[#052E1C]'
                    : 'text-[#335947] hover:bg-[#ECF7F1] dark:text-[#9EC0AE] dark:hover:bg-[#162E23]'
                }`}
              >
                <Printer className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{t.settingsTabPrinters}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('social')}
                className={`flex min-h-[38px] items-center justify-center gap-1.5 rounded-xl px-2 text-xs font-bold transition-colors ${
                  activeTab === 'social'
                    ? 'bg-[#115E3B] text-white dark:bg-[#10B981] dark:text-[#052E1C]'
                    : 'text-[#335947] hover:bg-[#ECF7F1] dark:text-[#9EC0AE] dark:hover:bg-[#162E23]'
                }`}
              >
                <Share2 className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{t.settingsTabSocial}</span>
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-6 pb-4">
            {activeTab === 'general' && (
              <div>
                <div className="mb-5 flex flex-col items-center rounded-2xl border border-[#DCE7E0] bg-[#F7FAF8] p-5 dark:border-[#1E3A2D] dark:bg-[#091611]">
                  <div className="mb-4 flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl border border-[#DCE7E0] bg-white p-2 dark:border-[#1E3A2D] dark:bg-[#102119]">
                    {draftLogo ? (
                      <img
                        src={draftLogo}
                        alt={draftStoreName.trim() || t.yourStoreFallback}
                        className="h-full w-full rounded-xl object-cover"
                      />
                    ) : (
                      <Store className="h-10 w-10 text-[#115E3B]/60 dark:text-[#34D399]/60" />
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

                {/* Optional Store Name */}
                <div className="mb-5">
                  <label className="mb-1.5 block text-xs font-semibold text-[#335947] dark:text-[#9EC0AE]">
                    {t.storeNameLabel}
                  </label>
                  <input
                    type="text"
                    value={draftStoreName}
                    onChange={(e) => setDraftStoreName(e.target.value)}
                    placeholder={t.storeNamePlaceholder}
                    maxLength={80}
                    className="min-h-[44px] w-full rounded-xl border border-[#DCE7E0] bg-[#F7FAF8] px-3.5 text-sm text-[#0B1F16] placeholder:text-[#6B8A79] focus:border-[#115E3B] focus:bg-white focus:outline-none dark:border-[#1E3A2D] dark:bg-[#091611] dark:text-[#F2F9F5] dark:placeholder:text-[#8FB39E] dark:focus:border-[#10B981] dark:focus:bg-[#0D1E16]"
                  />
                </div>

                {/* Currency Selection */}
                <div className="mb-5">
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
                  {draftCurrency !== 'MAD' && draftCurrency !== 'DH' && (
                    <p className="tabular-nums mt-2 text-xs font-medium text-[#115E3B] dark:text-[#34D399]">
                      {formatNumber(100, lang)} MAD = {formatNumber(convertFromMad(100, draftCurrency), lang)}{' '}
                      {draftCurrency}
                    </p>
                  )}
                </div>

                {/* Optional Shop WhatsApp Phone (for QR Client View) */}
                <div className="mb-5">
                  <label className="mb-1.5 block text-xs font-semibold text-[#335947] dark:text-[#9EC0AE]">
                    {t.whatsappShopLabel}
                  </label>
                  <input
                    type="tel"
                    value={draftWhatsappPhone}
                    onChange={(e) => setDraftWhatsappPhone(e.target.value)}
                    placeholder={t.whatsappShopPlaceholder}
                    maxLength={40}
                    className="min-h-[44px] w-full rounded-xl border border-[#DCE7E0] bg-[#F7FAF8] px-3.5 text-sm text-[#0B1F16] placeholder:text-[#6B8A79] focus:border-[#115E3B] focus:bg-white focus:outline-none dark:border-[#1E3A2D] dark:bg-[#091611] dark:text-[#F2F9F5] dark:placeholder:text-[#8FB39E] dark:focus:border-[#10B981] dark:focus:bg-[#0D1E16]"
                  />
                  <p className="mt-1 text-[11px] text-[#335947] dark:text-[#9EC0AE]">
                    {t.whatsappShopHint}
                  </p>
                </div>

                {/* Public QR Base URL */}
                <div className="mb-2">
                  <label className="mb-1.5 block text-xs font-semibold text-[#335947] dark:text-[#9EC0AE]">
                    {t.publicAppUrlLabel}
                  </label>
                  <input
                    type="url"
                    dir="ltr"
                    value={draftPublicAppUrl}
                    onChange={(e) => setDraftPublicAppUrl(e.target.value)}
                    placeholder={t.publicAppUrlPlaceholder}
                    maxLength={240}
                    className="min-h-[44px] w-full rounded-xl border border-[#DCE7E0] bg-[#F7FAF8] px-3.5 text-sm text-[#0B1F16] placeholder:text-[#6B8A79] focus:border-[#115E3B] focus:bg-white focus:outline-none dark:border-[#1E3A2D] dark:bg-[#091611] dark:text-[#F2F9F5] dark:placeholder:text-[#8FB39E] dark:focus:border-[#10B981] dark:focus:bg-[#0D1E16]"
                  />
                  <p className="mt-1 text-[11px] leading-relaxed text-[#335947] dark:text-[#9EC0AE]">
                    {t.publicAppUrlHint}
                  </p>
                </div>
              </div>
            )}

            {activeTab === 'printers' && (
              <div className="pb-2">
                <PrinterSettingsCard
                  lang={lang}
                  printerMode={draftPrinterMode}
                  printerPaper={draftPrinterPaper}
                  printerName={draftPrinterName}
                  printerLinked={draftPrinterLinked}
                  savedPrinters={draftSavedPrinters}
                  activePrinterId={draftActivePrinterId}
                  onSavePrinter={async (next) => {
                    setDraftPrinterMode(next.printerMode);
                    setDraftPrinterPaper(next.printerPaper);
                    setDraftPrinterName(next.printerName);
                    setDraftPrinterLinked(next.printerLinked);
                    setDraftSavedPrinters(next.savedPrinters);
                    setDraftActivePrinterId(next.activePrinterId);
                    await onSave({
                      customLogo: draftLogo,
                      storeName: draftStoreName.trim(),
                      currency: draftCurrency,
                      facebookHandle: draftFacebookHandle.trim(),
                      instagramHandle: draftInstagramHandle.trim(),
                      whatsappPhone: draftWhatsappPhone.trim(),
                      printerMode: next.printerMode,
                      printerPaper: next.printerPaper,
                      printerName: next.printerName,
                      printerLinked: next.printerLinked,
                      savedPrinters: next.savedPrinters,
                      activePrinterId: next.activePrinterId,
                      publicAppUrl: draftPublicAppUrl.trim().replace(/\/+$/, ''),
                    });
                  }}
                  onNotify={onNotify}
                />
              </div>
            )}

            {activeTab === 'social' && (
              <div className="pb-2">
                <MetaAccountCard
                  lang={lang}
                  metaStatus={metaStatus}
                  onRefreshMetaStatus={onRefreshMetaStatus}
                  facebookHandle={draftFacebookHandle}
                  instagramHandle={draftInstagramHandle}
                  savedFacebookHandle={facebookHandle}
                  savedInstagramHandle={instagramHandle}
                  onChangeHandles={(next) => {
                    setDraftFacebookHandle(next.facebookHandle);
                    setDraftInstagramHandle(next.instagramHandle);
                  }}
                  onSaveHandles={async (next) => {
                    await onSave({
                      customLogo: draftLogo,
                      storeName: draftStoreName.trim(),
                      currency: draftCurrency,
                      facebookHandle: next.facebookHandle,
                      instagramHandle: next.instagramHandle,
                      whatsappPhone: draftWhatsappPhone.trim(),
                      printerMode: draftPrinterMode,
                      printerPaper: draftPrinterPaper,
                      printerName: draftPrinterName.trim(),
                      printerLinked: draftPrinterLinked,
                      savedPrinters: draftSavedPrinters,
                      activePrinterId: draftActivePrinterId,
                      publicAppUrl: draftPublicAppUrl.trim().replace(/\/+$/, ''),
                    });
                  }}
                  onNotify={onNotify}
                />
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 border-t border-[#DCE7E0] px-6 py-4 dark:border-[#1E3A2D]">
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
