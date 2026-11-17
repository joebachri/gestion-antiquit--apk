import { useEffect, useState } from 'react';
import { Check, Copy, Download, Image as ImageIcon, MessageCircle, Play, Share2, Video, X } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import type { Language, Product } from '../types';
import { formatCurrency, translations } from '../i18n';
import {
  buildAllProductPhotoFiles,
  buildProductCardFile,
  buildShareText,
  isVideoMedia,
  renderProductShareCardBlob,
} from '../utils/image';
import {
  canWebShareFiles,
  downloadBlobs,
  saveOrShareBlob,
  shareProductMediaAndText,
  tryCopyCardImageToClipboard,
} from '../utils/download';

interface ShareModalProps {
  product: Product | null;
  lang: Language;
  currency: string;
  onClose: () => void;
}

export function ShareModal({ product, lang, currency, onClose }: ShareModalProps) {
  const t = translations[lang];
  const [copied, setCopied] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [downloadingPhotos, setDownloadingPhotos] = useState(false);
  const [downloadingCard, setDownloadingCard] = useState(false);
  const [cardPreviewUrl, setCardPreviewUrl] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    message: string;
    channel?: 'whatsapp' | 'facebook';
  } | null>(null);

  useEffect(() => {
    setCopied(false);
    setPublishing(false);
    setDownloadingPhotos(false);
    setDownloadingCard(false);
    setFeedback(null);

    if (!product) {
      setCardPreviewUrl(null);
      return;
    }

    let canceled = false;
    let objectUrl: string | null = null;

    renderProductShareCardBlob(product, currency, lang).then((blob) => {
      if (canceled || !blob) return;
      objectUrl = URL.createObjectURL(blob);
      setCardPreviewUrl(objectUrl);
    });

    return () => {
      canceled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [product, currency, lang]);

  if (!product) return null;

  const photos = [...(product.photos || [])].sort(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
  );
  const videoItems = photos.filter((p) => isVideoMedia(p.imageData));
  const primaryPhoto = photos[0];
  const shareText = buildShareText(product, currency, lang);
  const shareTitle = `${product.code} — ${product.name}`;

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

  const handlePublishCard = async (channel?: 'whatsapp' | 'facebook') => {
    setPublishing(true);
    setFeedback(null);
    try {
      const cardFile = await buildProductCardFile(product, currency, lang);
      const files = cardFile ? [cardFile] : await buildAllProductPhotoFiles(product);

      const supportsNativeOrWebFiles = Capacitor.isNativePlatform() || canWebShareFiles();

      if (supportsNativeOrWebFiles) {
        const result = await shareProductMediaAndText({
          files,
          title: shareTitle,
          text: shareText,
          dialogTitle: shareTitle,
        });

        if (result.copiedText) {
          setCopied(true);
          setTimeout(() => setCopied(false), 2500);
        }

        if (result.outcome === 'shared') {
          setFeedback({ message: t.shareCaptionCopiedHint });
          return;
        }
        if (result.outcome === 'canceled') {
          return;
        }
      }

      // Desktop browser fallback: copy the Card PNG to clipboard (for Ctrl+V paste into WhatsApp/Facebook),
      // download the Card PNG file, and show the channel link.
      if (cardFile) {
        await downloadBlobs([cardFile], shareTitle, shareText);
        const copiedImg = await tryCopyCardImageToClipboard(cardFile.blob);
        if (!copiedImg) {
          await handleCopy();
        }
      } else {
        await handleCopy();
      }

      setFeedback({
        message: t.desktopShareFallbackHint,
        channel,
      });
    } finally {
      setPublishing(false);
    }
  };

  const handleSocialClick = async (channel: 'whatsapp' | 'facebook') => {
    await handlePublishCard(channel);
  };

  const handleDownloadAllPhotos = async () => {
    setDownloadingPhotos(true);
    try {
      const files = await buildAllProductPhotoFiles(product);
      if (files.length === 0) return;
      await downloadBlobs(files, shareTitle, shareText);
    } finally {
      setDownloadingPhotos(false);
    }
  };

  const handleShareVideos = async () => {
    if (videoItems.length === 0) return;
    setPublishing(true);
    setFeedback(null);
    try {
      const allFiles = await buildAllProductPhotoFiles(product);
      const videoFiles = allFiles.filter((f) => f.mimeType.startsWith('video/'));
      if (videoFiles.length === 0) return;
      const result = await shareProductMediaAndText({
        files: videoFiles,
        title: shareTitle,
        text: shareText,
        dialogTitle: shareTitle,
      });
      if (result.copiedText) {
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
      if (result.outcome === 'shared') {
        setFeedback({ message: t.shareCaptionCopiedHint });
      } else if (result.outcome === 'downloaded') {
        setFeedback({ message: t.desktopShareFallbackHint });
      }
    } finally {
      setPublishing(false);
    }
  };

  const handleDownloadCard = async () => {
    setDownloadingCard(true);
    try {
      const blob = await renderProductShareCardBlob(product, currency, lang);
      if (!blob) return;
      const filename = `${product.code}-${product.name.slice(0, 24).replace(/\s+/g, '-')}.png`;
      await saveOrShareBlob(blob, filename, shareTitle, shareText);
    } finally {
      setDownloadingCard(false);
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

        {/* Shareable Card Preview: displays the exact generated Card PNG when ready */}
        {cardPreviewUrl ? (
          <div className="mb-5 overflow-hidden rounded-2xl border border-[#DCE7E0] bg-[#F7FAF8] shadow-xs dark:border-[#1E3A2D] dark:bg-[#091611]">
            <img
              src={cardPreviewUrl}
              alt={shareTitle}
              className="block max-h-[420px] w-full object-contain"
            />
          </div>
        ) : (
          <div className="mb-5 overflow-hidden rounded-2xl border border-[#DCE7E0] bg-[#F7FAF8] dark:border-[#1E3A2D] dark:bg-[#091611]">
            <div className="flex items-center justify-between border-b border-[#DCE7E0] bg-[#115E3B] px-4 py-2 text-xs font-semibold text-white dark:border-[#1E3A2D]">
              <span>{t.brandName}</span>
              <div className="flex items-center gap-2">
                {photos.length > 0 && (
                  <span className="tabular-nums rounded-md bg-white/15 px-2 py-0.5 text-[11px] font-medium">
                    {photos.length} {t.photosIncluded}
                  </span>
                )}
                <span className="font-mono-code tracking-wider">{product.code}</span>
              </div>
            </div>

            {primaryPhoto ? (
              <div className="space-y-2 bg-[#E8F2EC] p-2 dark:bg-[#102119]">
                <div className="relative aspect-[16/10] w-full overflow-hidden rounded-xl bg-black">
                  {isVideoMedia(primaryPhoto.imageData) ? (
                    <>
                      <video
                        src={primaryPhoto.imageData}
                        muted
                        playsInline
                        preload="metadata"
                        className="h-full w-full object-cover"
                      />
                      <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/25">
                        <Play className="h-10 w-10 fill-white text-white" />
                      </span>
                    </>
                  ) : (
                    <img
                      src={primaryPhoto.imageData}
                      alt={primaryPhoto.photoCode || product.name}
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover"
                    />
                  )}
                  {primaryPhoto.photoCode && (
                    <span className="font-mono-code absolute left-2 top-2 rounded-md bg-black/65 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur-xs">
                      {primaryPhoto.photoCode}
                    </span>
                  )}
                </div>

                {photos.length > 1 && (
                  <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
                    {photos.map((photo) => (
                      <div
                        key={photo.id}
                        className="flex shrink-0 flex-col items-center overflow-hidden rounded-lg border border-[#DCE7E0] bg-white p-1 dark:border-[#1E3A2D] dark:bg-[#0F2119]"
                      >
                        <span className="font-mono-code mb-0.5 text-[10px] font-semibold text-[#115E3B] dark:text-[#34D399]">
                          {photo.photoCode}
                        </span>
                        <div className="relative h-12 w-16 overflow-hidden rounded-md bg-black">
                          {isVideoMedia(photo.imageData) ? (
                            <>
                              <video
                                src={photo.imageData}
                                muted
                                playsInline
                                preload="metadata"
                                className="h-full w-full object-cover"
                              />
                              <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/25">
                                <Play className="h-3.5 w-3.5 fill-white text-white" />
                              </span>
                            </>
                          ) : (
                            <img
                              src={photo.imageData}
                              alt={photo.photoCode}
                              referrerPolicy="no-referrer"
                              className="h-full w-full object-cover"
                            />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex aspect-[16/7] w-full flex-col items-center justify-center bg-[#E8F2EC] text-[#335947] dark:bg-[#102119] dark:text-[#9EC0AE]">
                <ImageIcon className="mb-1.5 h-8 w-8 opacity-50" />
                <span className="text-xs">{t.noPhotoHint}</span>
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
                {t.dimensionsShort} : {product.lengthCm} × {product.widthCm} × {product.heightCm}{' '}
                {t.cmUnit} · {product.thicknessCm} {t.cmUnit} · {product.piecesCount}{' '}
                {t.piecesUnit}
              </p>
            </div>
          </div>
        )}

        {/* Inline publish feedback */}
        {feedback && (
          <div className="mb-4 flex flex-col gap-2 rounded-xl border border-[#DCE7E0] bg-[#ECF7F1] px-3.5 py-2.5 text-xs text-[#115E3B] dark:border-[#1E3A2D] dark:bg-[#132B20] dark:text-[#6EE7B7]">
            <span>{feedback.message}</span>
            {feedback.channel && (
              <a
                href={feedback.channel === 'whatsapp' ? whatsappUrl : facebookUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-fit items-center gap-1.5 font-semibold underline underline-offset-2"
              >
                <Share2 className="h-3.5 w-3.5" />
                <span>
                  {feedback.channel === 'whatsapp' ? t.shareWhatsapp : t.shareFacebook}
                </span>
              </a>
            )}
          </div>
        )}

        {/* Share / Publish Actions */}
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => handlePublishCard()}
            disabled={publishing}
            className="col-span-2 flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-[#115E3B] px-4 text-sm font-semibold text-white hover:bg-[#0D4A2E] disabled:opacity-60 dark:bg-[#10B981] dark:text-[#052E1C]"
          >
            <Share2 className="h-4 w-4" />
            <span>
              {publishing
                ? t.publishing
                : photos.length > 0
                  ? `${t.nativeShare} (${photos.length})`
                  : t.nativeShare}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleSocialClick('whatsapp')}
            disabled={publishing}
            className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-[#DCE7E0] bg-[#ECF7F1] px-4 text-sm font-semibold text-[#115E3B] hover:bg-[#DCF0E4] disabled:opacity-60 dark:border-[#1E3A2D] dark:bg-[#132B20] dark:text-[#34D399]"
          >
            <MessageCircle className="h-4 w-4" />
            <span>{t.shareWhatsapp}</span>
          </button>

          <button
            type="button"
            onClick={() => handleSocialClick('facebook')}
            disabled={publishing}
            className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-[#DCE7E0] bg-white px-4 text-sm font-semibold text-[#0B1F16] hover:bg-[#F7FAF8] disabled:opacity-60 dark:border-[#1E3A2D] dark:bg-[#102119] dark:text-[#F2F9F5]"
          >
            <Share2 className="h-4 w-4" />
            <span>{t.shareFacebook}</span>
          </button>

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
            disabled={downloadingCard}
            className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-[#DCE7E0] bg-white px-4 text-xs font-semibold text-[#0B1F16] hover:bg-[#F7FAF8] disabled:opacity-50 dark:border-[#1E3A2D] dark:bg-[#102119] dark:text-[#F2F9F5]"
          >
            <Download className="h-4 w-4" />
            <span>{t.downloadCardImage}</span>
          </button>

          {videoItems.length > 0 && (
            <button
              type="button"
              onClick={handleShareVideos}
              disabled={publishing}
              className="col-span-2 flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-[#DCE7E0] bg-[#ECF7F1] px-4 text-xs font-semibold text-[#115E3B] hover:bg-[#DCF0E4] disabled:opacity-50 dark:border-[#1E3A2D] dark:bg-[#132B20] dark:text-[#34D399]"
            >
              <Video className="h-4 w-4" />
              <span>
                {t.shareVideos} ({videoItems.length})
              </span>
            </button>
          )}

          {photos.length > 0 && (
            <button
              type="button"
              onClick={handleDownloadAllPhotos}
              disabled={downloadingPhotos}
              className="col-span-2 flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-[#DCE7E0] bg-[#F7FAF8] px-4 text-xs font-medium text-[#335947] hover:bg-[#ECF7F1] disabled:opacity-50 dark:border-[#1E3A2D] dark:bg-[#091611] dark:text-[#9EC0AE]"
            >
              <Download className="h-3.5 w-3.5" />
              <span>
                {t.downloadAllPhotos} ({photos.length})
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
