import { useState } from 'react';
import { Check, Copy, Download, Share2, X, MessageCircle } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import type { Language, Product } from '../types';
import { formatCurrency, translations } from '../i18n';
import { buildShareText, renderProductShareCardBlob } from '../utils/image';
import { saveOrShareBlob } from '../utils/download';

interface ShareModalProps {
  product: Product | null;
  lang: Language;
  currency: string;
  onClose: () => void;
}

export function ShareModal({ product, lang, currency, onClose }: ShareModalProps) {
  const t = translations[lang];
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  if (!product) return null;

  const shareText = buildShareText(product, currency, lang);
  const primaryPhoto = product.photos[0]?.imageData;
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
  const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
    window.location.href
  )}&quote=${encodeURIComponent(shareText)}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore clipboard restriction
    }
  };

  const handleDownloadCard = async () => {
    setDownloading(true);
    try {
      const blob = await renderProductShareCardBlob(product, currency, lang);
      if (!blob) return;
      const filename = `${product.code}-${product.name.slice(0, 24).replace(/\s+/g, '-')}.png`;
      await saveOrShareBlob(blob, filename, `${product.code} — ${product.name}`, shareText);
    } finally {
      setDownloading(false);
    }
  };

  const handleNativeShare = async () => {
    if (Capacitor.isNativePlatform()) {
      try {
        const cardBlob = await renderProductShareCardBlob(product, currency, lang);
        if (cardBlob) {
          await saveOrShareBlob(
            cardBlob,
            `${product.code}.png`,
            `${product.code} — ${product.name}`,
            shareText
          );
          return;
        }
      } catch {
        // fall through
      }
    }
    if (!navigator.share) {
      await handleCopy();
      return;
    }
    try {
      const shareData: ShareData = {
        title: `${product.code} — ${product.name}`,
        text: shareText,
      };
      if (primaryPhoto) {
        const cardBlob = await renderProductShareCardBlob(product, currency, lang);
        if (cardBlob) {
          const file = new File([cardBlob], `${product.code}.png`, { type: 'image/png' });
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            shareData.files = [file];
          }
        }
      }
      await navigator.share(shareData);
    } catch {
      // user canceled share sheet
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

        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-display text-xl font-bold text-[#0B1F16] dark:text-[#F2F9F5]">
              {t.shareTitle}
            </h2>
            <p className="mt-0.5 text-xs text-[#335947] dark:text-[#9EC0AE]">
              {t.shareDescription}
            </p>
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

        {/* Shareable Card Preview */}
        <div className="mb-5 overflow-hidden rounded-2xl border border-[#DCE7E0] bg-[#F7FAF8] dark:border-[#1E3A2D] dark:bg-[#091611]">
          <div className="flex items-center justify-between border-b border-[#DCE7E0] bg-[#115E3B] px-4 py-2 text-xs font-semibold text-white dark:border-[#1E3A2D]">
            <span>{t.brandName}</span>
            <span className="font-mono-code tracking-wider">{product.code}</span>
          </div>

          {primaryPhoto && (
            <div className="aspect-[16/10] w-full overflow-hidden bg-[#E8F2EC] dark:bg-[#102119]">
              <img
                src={primaryPhoto}
                alt={product.name}
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover"
              />
            </div>
          )}

          <div className="space-y-2 p-4">
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-display text-lg font-bold text-[#0B1F16] dark:text-[#F2F9F5]">
                {product.name}
              </h3>
              <span className="tabular-nums shrink-0 text-base font-bold text-[#115E3B] dark:text-[#34D399]">
                {formatCurrency(product.sellingPrice, currency, lang)}
              </span>
            </div>

            {product.description && (
              <p className="line-clamp-3 text-xs leading-relaxed text-[#335947] dark:text-[#9EC0AE]">
                {product.description}
              </p>
            )}

            <p className="tabular-nums text-xs font-medium text-[#115E3B] dark:text-[#6EE7B7]">
              {t.dimensionsShort} : {product.lengthCm} × {product.widthCm} × {product.heightCm} {t.cmUnit} ·{' '}
              {product.thicknessCm} {t.cmUnit} · {product.piecesCount} {t.piecesUnit}
            </p>
          </div>
        </div>

        {/* Share Actions */}
        <div className="grid grid-cols-2 gap-2.5">
          {(Capacitor.isNativePlatform() ||
            (typeof navigator !== 'undefined' && typeof navigator.share === 'function')) && (
            <button
              type="button"
              onClick={handleNativeShare}
              className="col-span-2 flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-[#115E3B] px-4 text-sm font-semibold text-white hover:bg-[#0D4A2E] dark:bg-[#10B981] dark:text-[#052E1C]"
            >
              <Share2 className="h-4 w-4" />
              <span>{t.nativeShare}</span>
            </button>
          )}

          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-[#DCE7E0] bg-[#ECF7F1] px-4 text-sm font-semibold text-[#115E3B] hover:bg-[#DCF0E4] dark:border-[#1E3A2D] dark:bg-[#132B20] dark:text-[#34D399]"
          >
            <MessageCircle className="h-4 w-4" />
            <span>{t.shareWhatsapp}</span>
          </a>

          <a
            href={facebookUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-[#DCE7E0] bg-white px-4 text-sm font-semibold text-[#0B1F16] hover:bg-[#F7FAF8] dark:border-[#1E3A2D] dark:bg-[#102119] dark:text-[#F2F9F5]"
          >
            <Share2 className="h-4 w-4" />
            <span>{t.shareFacebook}</span>
          </a>

          <button
            type="button"
            onClick={handleCopy}
            className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-[#DCE7E0] bg-white px-4 text-xs font-semibold text-[#0B1F16] hover:bg-[#F7FAF8] dark:border-[#1E3A2D] dark:bg-[#102119] dark:text-[#F2F9F5]"
          >
            {copied ? <Check className="h-4 w-4 text-[#10B981]" /> : <Copy className="h-4 w-4" />}
            <span>{copied ? t.copied : t.copyText}</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadCard}
            disabled={downloading}
            className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-[#DCE7E0] bg-white px-4 text-xs font-semibold text-[#0B1F16] hover:bg-[#F7FAF8] disabled:opacity-50 dark:border-[#1E3A2D] dark:bg-[#102119] dark:text-[#F2F9F5]"
          >
            <Download className="h-4 w-4" />
            <span>{t.downloadCardImage}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
