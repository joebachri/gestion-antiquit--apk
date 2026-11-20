import { useEffect, useState } from 'react';
import { Check, Copy, Download, FileText, QrCode, X } from 'lucide-react';
import type { Language, Product } from '../types';
import { formatCurrency, translations } from '../i18n';
import { buildProductQrUrl, buildQrStickerBlob, generateQrDataUrl } from '../utils/qr';
import { saveOrShareBlob } from '../utils/download';

interface QrCodeDisplayModalProps {
  product: Product | null;
  lang: Language;
  currency: string;
  storeName?: string;
  onClose: () => void;
  onOpenDigitalFile: (product: Product) => void;
  onNotify?: (msg: string) => void;
}

export function QrCodeDisplayModal({
  product,
  lang,
  currency,
  storeName = '',
  onClose,
  onOpenDigitalFile,
  onNotify,
}: QrCodeDisplayModalProps) {
  const t = translations[lang];
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!product) {
      setQrDataUrl('');
      return;
    }
    let active = true;
    const payload = buildProductQrUrl(product);
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
  }, [product]);

  if (!product) return null;

  const qrUrl = buildProductQrUrl(product);

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
      const blob = await buildQrStickerBlob(product, storeName, currency, lang);
      await saveOrShareBlob(blob, `qr-${product.code.toLowerCase()}.png`, `${product.code} QR`);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-0 backdrop-blur-xs sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-t-3xl border border-[#DCE7E0] bg-white p-6 shadow-xl sm:rounded-3xl dark:border-[#1E3A2D] dark:bg-[#0F2119]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-[#DCE7E0] sm:hidden dark:bg-[#1E3A2D]" />

        <div className="mb-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
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

        <div className="flex flex-col items-center rounded-2xl border border-[#DCE7E0] bg-[#F7FAF8] p-5 dark:border-[#1E3A2D] dark:bg-[#091611]">
          <div className="rounded-2xl border border-[#DCE7E0] bg-white p-3 shadow-xs dark:border-[#1E3A2D]">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt={`QR ${product.code}`}
                className="h-52 w-52 object-contain"
              />
            ) : (
              <div className="flex h-52 w-52 items-center justify-center text-xs text-[#335947]">
                ...
              </div>
            )}
          </div>
          <p className="font-mono-code mt-3 text-sm font-bold tracking-wider text-[#115E3B] dark:text-[#34D399]">
            {product.qrToken || `GA-QR-${product.code}`}
          </p>
          <p className="tabular-nums mt-1 text-base font-bold text-[#0B1F16] dark:text-[#F2F9F5]">
            {formatCurrency(product.sellingPrice, currency, lang)}
          </p>
        </div>

        <div className="mt-4 space-y-2.5">
          <button
            type="button"
            onClick={() => void handleDownloadSticker()}
            disabled={downloading}
            className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[#115E3B] px-4 text-sm font-semibold text-white hover:bg-[#0D4A2E] disabled:opacity-60 dark:bg-[#10B981] dark:text-[#052E1C]"
          >
            <Download className="h-4 w-4" />
            <span>{t.qrDownloadSticker}</span>
          </button>

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
