import { useEffect, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  FileText,
  Minus,
  Plus,
  Printer,
  QrCode,
  Settings2,
  X,
} from 'lucide-react';
import type { Language, PrinterMode, PrinterPaperFormat, Product } from '../types';
import { formatCurrency, formatNumber, translations } from '../i18n';
import { buildProductQrUrl, buildQrStickerSheetBlob, generateQrDataUrl } from '../utils/qr';
import { saveOrShareBlob } from '../utils/download';
import { executeSmartQrPrint } from '../utils/printer';
import { PrinterSettingsCard } from './PrinterSettingsCard';

interface QrCodeDisplayModalProps {
  product: Product | null;
  lang: Language;
  currency: string;
  storeName?: string;
  whatsappPhone?: string;
  publicAppUrl?: string;
  printerMode?: PrinterMode;
  printerPaper?: PrinterPaperFormat;
  printerName?: string;
  printerLinked?: boolean;
  onSavePrinterSettings?: (next: {
    printerMode: PrinterMode;
    printerPaper: PrinterPaperFormat;
    printerName: string;
    printerLinked: boolean;
  }) => Promise<void>;
  onClose: () => void;
  onOpenDigitalFile: (product: Product) => void;
  onNotify?: (msg: string) => void;
}

export function QrCodeDisplayModal({
  product,
  lang,
  currency,
  storeName = '',
  whatsappPhone = '',
  publicAppUrl = '',
  printerMode = 'pdf_system',
  printerPaper = 'a4',
  printerName = '',
  printerLinked = false,
  onSavePrinterSettings,
  onClose,
  onOpenDigitalFile,
  onNotify,
}: QrCodeDisplayModalProps) {
  const t = translations[lang];
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [showPrinterSetup, setShowPrinterSetup] = useState(false);
  const [printQty, setPrintQty] = useState<number>(1);

  useEffect(() => {
    if (!product) {
      setQrDataUrl('');
      setShowPrinterSetup(false);
      return;
    }
    setPrintQty(Math.max(1, Math.min(100, Math.floor(Number(product.quantity) || 1))));
    let active = true;
    const payload = buildProductQrUrl(product, { storeName, whatsappPhone, publicAppUrl });
    void generateQrDataUrl(payload, 360)
      .then((url) => {
        if (active) setQrDataUrl(url);
      })
      .catch(() => {
        if (active) setQrDataUrl('');
      });
    return () => {
      active = false;
    };
  }, [product, storeName, whatsappPhone, publicAppUrl]);

  if (!product) return null;

  const qrUrl = buildProductQrUrl(product, { storeName, whatsappPhone, publicAppUrl });
  const qrBasePreview = qrUrl.split('#')[0];
  const safeQty = Math.max(1, Math.min(100, Math.floor(Number(printQty) || 1)));

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(qrUrl);
      setCopied(true);
      onNotify?.(t.qrLinkCopied);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore clipboard errors
    }
  };

  const handleDownloadSticker = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      const blob = await buildQrStickerSheetBlob(
        product,
        safeQty,
        storeName,
        currency,
        lang,
        whatsappPhone,
        publicAppUrl
      );
      const suffix = safeQty > 1 ? `-x${safeQty}` : '';
      await saveOrShareBlob(
        blob,
        `qr-${product.code.toLowerCase()}${suffix}.png`,
        `${product.code} QR ×${safeQty}`
      );
    } finally {
      setDownloading(false);
    }
  };

  const handlePrintLabels = async () => {
    if (!qrDataUrl || printing) return;
    setPrinting(true);
    try {
      const outcome = await executeSmartQrPrint({
        product,
        qty: safeQty,
        qrDataUrl,
        storeName,
        whatsappPhone,
        publicAppUrl,
        currency,
        lang,
        printerMode,
        printerPaper,
      });

      if (outcome === 'printed_bt') {
        onNotify?.(t.printerPrintBtSuccessToast);
      } else if (outcome === 'pdf_fallback') {
        onNotify?.(t.printerPrintBrowserBlockedToast);
      } else if (outcome === 'pdf_exported') {
        onNotify?.(`${t.printerPrintPdfSuccessToast} qr-${product.code.toLowerCase()}-x${safeQty}.pdf`);
      }
    } catch {
      onNotify?.(t.errorSave);
    } finally {
      setPrinting(false);
    }
  };

  return (
    <div
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-0 backdrop-blur-xs sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[94vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-[#DCE7E0] bg-white p-6 shadow-xl sm:rounded-3xl dark:border-[#1E3A2D] dark:bg-[#0F2119]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-[#DCE7E0] sm:hidden dark:bg-[#1E3A2D]" />

        <div className="mb-4 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#ECF7F1] text-[#115E3B] dark:bg-[#132B20] dark:text-[#34D399]">
              <QrCode className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate font-display text-lg font-bold text-[#0B1F16] dark:text-[#F2F9F5]">
                {t.qrLabelButton} — {product.code}
              </h2>
              <p className="truncate text-xs text-[#335947] dark:text-[#9EC0AE]">{product.name}</p>
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

        <div className="flex flex-col items-center rounded-2xl border border-[#DCE7E0] bg-[#F7FAF8] p-4 dark:border-[#1E3A2D] dark:bg-[#091611]">
          <div className="rounded-2xl border border-[#DCE7E0] bg-white p-3 shadow-xs dark:border-[#1E3A2D]">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt={`QR ${product.code}`}
                className="h-44 w-44 object-contain"
              />
            ) : (
              <div className="flex h-44 w-44 items-center justify-center text-xs text-[#335947]">
                ...
              </div>
            )}
          </div>
          <p className="font-mono-code mt-2.5 text-sm font-bold tracking-wider text-[#115E3B] dark:text-[#34D399]">
            {product.qrToken || `GA-QR-${product.code}`}
          </p>
          <p className="tabular-nums mt-1 text-base font-bold text-[#0B1F16] dark:text-[#F2F9F5]">
            {formatCurrency(product.sellingPrice, currency, lang)}
          </p>
          <p
            dir="ltr"
            className="mt-2 max-w-full truncate rounded-lg border border-[#DCE7E0] bg-white px-2.5 py-1 text-[10px] font-mono-code text-[#335947] dark:border-[#1E3A2D] dark:bg-[#0F2119] dark:text-[#9EC0AE]"
            title={qrUrl}
          >
            {t.qrLinkPreviewLabel} {qrBasePreview}
          </p>
        </div>

        {/* Label Print Quantity Selector */}
        <div className="mt-4 rounded-2xl border border-[#DCE7E0] bg-[#F7FAF8] p-3.5 dark:border-[#1E3A2D] dark:bg-[#091611]">
          <div className="mb-2 flex items-center justify-between gap-2 text-xs">
            <label
              htmlFor="qr-print-qty"
              className="font-semibold text-[#0B1F16] dark:text-[#F2F9F5]"
            >
              {t.qrPrintQuantityLabel}
            </label>
            <span className="tabular-nums text-[11px] text-[#335947] dark:text-[#9EC0AE]">
              {t.qrPrintStockHint} {formatNumber(product.quantity, lang)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPrintQty((q) => Math.max(1, q - 1))}
              aria-label="-"
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-[#DCE7E0] bg-white text-[#0B1F16] hover:bg-[#ECF7F1] dark:border-[#1E3A2D] dark:bg-[#0F2119] dark:text-[#F2F9F5]"
            >
              <Minus className="h-4 w-4" />
            </button>

            <input
              id="qr-print-qty"
              type="number"
              min={1}
              max={100}
              value={printQty}
              onChange={(e) => {
                const val = Number(e.target.value);
                if (!Number.isNaN(val)) {
                  setPrintQty(Math.max(1, Math.min(100, Math.floor(val))));
                }
              }}
              className="tabular-nums min-h-[44px] w-full rounded-xl border border-[#DCE7E0] bg-white px-3 text-center text-sm font-bold text-[#0B1F16] focus:border-[#115E3B] focus:bg-white focus:outline-none dark:border-[#1E3A2D] dark:bg-[#0F2119] dark:text-[#F2F9F5] dark:focus:border-[#10B981] dark:focus:bg-[#0D1E16]"
            />

            <button
              type="button"
              onClick={() => setPrintQty((q) => Math.min(100, q + 1))}
              aria-label="+"
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-[#DCE7E0] bg-white text-[#0B1F16] hover:bg-[#ECF7F1] dark:border-[#1E3A2D] dark:bg-[#0F2119] dark:text-[#F2F9F5]"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Printer Link / Configuration Trigger & Inline Setup Drawer */}
        {onSavePrinterSettings && (
          <div className="mt-3">
            <button
              type="button"
              onClick={() => setShowPrinterSetup((v) => !v)}
              className={`flex min-h-[42px] w-full items-center justify-between gap-2 rounded-xl border px-3.5 text-xs font-semibold transition-colors ${
                printerLinked
                  ? 'border-[#10B981]/40 bg-[#ECF7F1] text-[#115E3B] dark:border-[#10B981]/30 dark:bg-[#132B20] dark:text-[#34D399]'
                  : 'border-[#DCE7E0] bg-[#F7FAF8] text-[#0B1F16] hover:bg-[#ECF7F1] dark:border-[#1E3A2D] dark:bg-[#091611] dark:text-[#F2F9F5]'
              }`}
            >
              <span className="flex min-w-0 items-center gap-2">
                <Settings2 className="h-4 w-4 shrink-0" />
                <span className="truncate">
                  {printerLinked && printerName
                    ? `${t.printerLinkedBadge} ${printerName}`
                    : t.printerConfigureButton}
                </span>
              </span>
              <span className="shrink-0 text-[11px] underline">
                {showPrinterSetup ? t.close : t.edit}
              </span>
            </button>

            {showPrinterSetup && (
              <div className="mt-2.5">
                <PrinterSettingsCard
                  lang={lang}
                  printerMode={printerMode}
                  printerPaper={printerPaper}
                  printerName={printerName}
                  printerLinked={printerLinked}
                  onSavePrinter={async (next) => {
                    await onSavePrinterSettings(next);
                  }}
                  onNotify={onNotify}
                />
              </div>
            )}
          </div>
        )}

        <div className="mt-4 space-y-2.5">
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => void handlePrintLabels()}
              disabled={!qrDataUrl || printing}
              className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-[#115E3B] px-3 text-xs font-semibold text-white hover:bg-[#0D4A2E] disabled:opacity-60 sm:text-sm dark:bg-[#10B981] dark:text-[#052E1C]"
            >
              <Printer className="h-4 w-4 shrink-0" />
              <span className="tabular-nums truncate">
                {printing ? t.printerPrinting : `${t.qrPrintButton} (×${safeQty})`}
              </span>
            </button>

            <button
              type="button"
              onClick={() => void handleDownloadSticker()}
              disabled={downloading}
              className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-[#115E3B] bg-[#ECF7F1] px-3 text-xs font-semibold text-[#115E3B] hover:bg-[#DCF0E4] disabled:opacity-60 sm:text-sm dark:border-[#10B981] dark:bg-[#132B20] dark:text-[#34D399]"
            >
              <Download className="h-4 w-4 shrink-0" />
              <span className="tabular-nums truncate">PNG (×{safeQty})</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => void handleCopyLink()}
              className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-[#DCE7E0] bg-[#F7FAF8] px-3 text-xs font-semibold text-[#0B1F16] hover:bg-[#ECF7F1] dark:border-[#1E3A2D] dark:bg-[#102119] dark:text-[#F2F9F5]"
            >
              {copied ? <Check className="h-4 w-4 text-[#115E3B]" /> : <Copy className="h-4 w-4" />}
              <span>{copied ? t.copied : t.qrCopyLink}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenDigitalFile(product);
              }}
              className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-[#DCE7E0] bg-[#ECF7F1] px-3 text-xs font-semibold text-[#115E3B] hover:bg-[#DCF0E4] dark:border-[#1E3A2D] dark:bg-[#132B20] dark:text-[#34D399]"
            >
              <FileText className="h-4 w-4" />
              <span>{t.qrDigitalFileButton}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
