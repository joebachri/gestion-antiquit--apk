import { useEffect, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Edit3,
  FileText,
  Image as ImageIcon,
  Play,
  QrCode,
  Share2,
  Trash2,
  X,
} from 'lucide-react';
import type { Language, Product } from '../types';
import { formatCurrency, formatNumber, translations } from '../i18n';
import { isVideoMedia } from '../utils/image';

interface ProductDetailSheetProps {
  product: Product | null;
  lang: Language;
  currency: string;
  onClose: () => void;
  onEdit: (product: Product) => void;
  onDelete: (productId: string) => Promise<void>;
  onShare: (product: Product) => void;
  onOpenQrLabel?: (product: Product) => void;
  onOpenDigitalFile?: (product: Product) => void;
}

export function ProductDetailSheet({
  product,
  lang,
  currency,
  onClose,
  onEdit,
  onDelete,
  onShare,
  onOpenQrLabel,
  onOpenDigitalFile,
}: ProductDetailSheetProps) {
  const t = translations[lang];
  const [photoIdx, setPhotoIdx] = useState(0);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setPhotoIdx(0);
    setConfirmingDelete(false);
    setDeleting(false);
  }, [product?.id]);

  if (!product) return null;

  const photos = product.photos || [];
  const activePhoto = photos[photoIdx];
  const displayedCode = activePhoto?.photoCode || product.code;
  const unitMargin = product.sellingPrice - product.referencePrice - product.expenses;
  const stockValue = product.sellingPrice * product.quantity;

  const handleConfirmDelete = async () => {
    setDeleting(true);
    try {
      await onDelete(product.id);
      onClose();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/55 p-0 backdrop-blur-xs sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[94vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border border-[#DCE7E0] bg-white shadow-xl sm:rounded-3xl dark:border-[#1E3A2D] dark:bg-[#0F2119]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top bar */}
        <div className="flex items-center justify-between border-b border-[#DCE7E0] px-5 py-3.5 dark:border-[#1E3A2D]">
          <div className="min-w-0">
            <span className="font-mono-code block text-xs font-semibold text-[#115E3B] dark:text-[#34D399]">
              {product.code}
            </span>
            <h2 className="truncate font-display text-lg font-bold text-[#0B1F16] dark:text-[#F2F9F5]">
              {product.name}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={t.close}
            className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl text-[#335947] hover:bg-[#ECF7F1] dark:text-[#9EC0AE] dark:hover:bg-[#162E23]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          {/* Code directly above image + Photo Carousel */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="font-mono-code text-sm font-bold tracking-wider text-[#115E3B] dark:text-[#34D399]">
                {displayedCode}
              </span>
              {photos.length > 1 && (
                <span className="tabular-nums text-xs font-medium text-[#335947] dark:text-[#9EC0AE]">
                  {photoIdx + 1} / {photos.length}
                </span>
              )}
            </div>

            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-[#DCE7E0] bg-[#E8F2EC] dark:border-[#1E3A2D] dark:bg-[#091611]">
              {activePhoto ? (
                isVideoMedia(activePhoto.imageData) ? (
                  <video
                    key={activePhoto.id}
                    src={activePhoto.imageData}
                    controls
                    playsInline
                    preload="auto"
                    onLoadedData={(e) => {
                      const v = e.currentTarget;
                      if (v.paused && v.currentTime === 0) {
                        try {
                          v.currentTime = 0.05;
                        } catch {
                          // ignore
                        }
                      }
                    }}
                    className="h-full w-full bg-black object-contain"
                  />
                ) : (
                  <img
                    src={activePhoto.imageData}
                    alt={product.name}
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover"
                  />
                )
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center text-[#335947] dark:text-[#9EC0AE]">
                  <ImageIcon className="mb-2 h-10 w-10 opacity-50" />
                  <span className="text-xs">{t.noPhotoHint}</span>
                </div>
              )}

              {photos.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      setPhotoIdx((prev) => (prev - 1 + photos.length) % photos.length)
                    }
                    className="absolute left-2.5 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-xs hover:bg-black/75"
                    aria-label="Previous"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPhotoIdx((prev) => (prev + 1) % photos.length)}
                    className="absolute right-2.5 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-xs hover:bg-black/75"
                    aria-label="Next"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </>
              )}
            </div>

            {photos.length > 1 && (
              <div className="mt-2.5 flex items-center gap-2 overflow-x-auto pb-1">
                {photos.map((photo, idx) => {
                  const isVid = isVideoMedia(photo.imageData);
                  return (
                    <button
                      key={photo.id}
                      type="button"
                      onClick={() => setPhotoIdx(idx)}
                      className={`flex shrink-0 flex-col items-center overflow-hidden rounded-xl border p-1 transition-colors ${
                        idx === photoIdx
                          ? 'border-[#115E3B] bg-[#ECF7F1] dark:border-[#10B981] dark:bg-[#132B20]'
                          : 'border-[#DCE7E0] bg-white dark:border-[#1E3A2D] dark:bg-[#091611]'
                      }`}
                    >
                      <span className="font-mono-code mb-1 text-[10px] font-semibold text-[#115E3B] dark:text-[#34D399]">
                        {photo.photoCode}
                      </span>
                      <div className="relative h-12 w-16 overflow-hidden rounded-lg bg-black">
                        {isVid ? (
                          <>
                            <video
                              src={photo.imageData}
                              muted
                              playsInline
                              preload="auto"
                              onLoadedData={(e) => {
                                const v = e.currentTarget;
                                if (v.currentTime === 0) {
                                  try {
                                    v.currentTime = 0.05;
                                  } catch {
                                    // ignore
                                  }
                                }
                              }}
                              className="h-full w-full object-cover"
                            />
                            <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/25">
                              <Play className="h-4 w-4 fill-white text-white" />
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
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Price & Stock Highlight */}
          <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-[#DCE7E0] pb-4 dark:border-[#1E3A2D]">
            <div>
              <span className="block text-xs font-medium text-[#335947] dark:text-[#9EC0AE]">
                {t.sellingPriceLabel}
              </span>
              <span className="tabular-nums text-2xl font-bold text-[#115E3B] dark:text-[#34D399]">
                {formatCurrency(product.sellingPrice, currency, lang)}
              </span>
            </div>

            <div className="text-end">
              <span className="block text-xs font-medium text-[#335947] dark:text-[#9EC0AE]">
                {t.quantityLabel}
              </span>
              <span className="tabular-nums text-lg font-bold text-[#0B1F16] dark:text-[#F2F9F5]">
                {formatNumber(product.quantity, lang)} {t.articlesUnit}
              </span>
            </div>
          </div>

          {/* Description */}
          {product.description && (
            <div>
              <h3 className="mb-1 text-xs font-semibold text-[#335947] dark:text-[#9EC0AE]">
                {t.descriptionLabel}
              </h3>
              <p className="text-sm leading-relaxed text-[#0B1F16] dark:text-[#E5F2EB]">
                {product.description}
              </p>
            </div>
          )}

          {product.supplier && (
            <div className="flex items-center justify-between rounded-xl border border-[#DCE7E0] px-4 py-2.5 text-xs dark:border-[#1E3A2D]">
              <span className="font-semibold text-[#335947] dark:text-[#9EC0AE]">
                {t.digitalMgmtSupplier}
              </span>
              <span className="font-bold text-[#0B1F16] dark:text-[#F2F9F5]">
                {product.supplier}
              </span>
            </div>
          )}

          {/* Dimensions Grid */}
          <div className="rounded-2xl border border-[#DCE7E0] bg-[#F7FAF8] p-4 dark:border-[#1E3A2D] dark:bg-[#091611]">
            <h3 className="mb-3 text-xs font-semibold text-[#115E3B] dark:text-[#34D399]">
              {t.dimensionsSection}
            </h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <div>
                <span className="block text-[11px] text-[#335947] dark:text-[#9EC0AE]">
                  {t.lengthLabel}
                </span>
                <span className="tabular-nums text-sm font-semibold text-[#0B1F16] dark:text-[#F2F9F5]">
                  {formatNumber(product.lengthCm, lang)} {t.cmUnit}
                </span>
              </div>
              <div>
                <span className="block text-[11px] text-[#335947] dark:text-[#9EC0AE]">
                  {t.widthLabel}
                </span>
                <span className="tabular-nums text-sm font-semibold text-[#0B1F16] dark:text-[#F2F9F5]">
                  {formatNumber(product.widthCm, lang)} {t.cmUnit}
                </span>
              </div>
              <div>
                <span className="block text-[11px] text-[#335947] dark:text-[#9EC0AE]">
                  {t.heightLabel}
                </span>
                <span className="tabular-nums text-sm font-semibold text-[#0B1F16] dark:text-[#F2F9F5]">
                  {formatNumber(product.heightCm, lang)} {t.cmUnit}
                </span>
              </div>
              <div>
                <span className="block text-[11px] text-[#335947] dark:text-[#9EC0AE]">
                  {t.thicknessLabel}
                </span>
                <span className="tabular-nums text-sm font-semibold text-[#0B1F16] dark:text-[#F2F9F5]">
                  {formatNumber(product.thicknessCm, lang)} {t.cmUnit}
                </span>
              </div>
              <div>
                <span className="block text-[11px] text-[#335947] dark:text-[#9EC0AE]">
                  {t.piecesCountLabel}
                </span>
                <span className="tabular-nums text-sm font-semibold text-[#0B1F16] dark:text-[#F2F9F5]">
                  {formatNumber(product.piecesCount, lang)}
                </span>
              </div>
            </div>
          </div>

          {/* Financial & Date Breakdown */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-[#DCE7E0] p-3 dark:border-[#1E3A2D]">
              <span className="block text-[11px] text-[#335947] dark:text-[#9EC0AE]">
                {t.referencePriceLabel}
              </span>
              <span className="tabular-nums mt-0.5 block text-sm font-semibold text-[#0B1F16] dark:text-[#F2F9F5]">
                {formatCurrency(product.referencePrice, currency, lang)}
              </span>
            </div>
            <div className="rounded-xl border border-[#DCE7E0] p-3 dark:border-[#1E3A2D]">
              <span className="block text-[11px] text-[#335947] dark:text-[#9EC0AE]">
                {t.expensesLabel}
              </span>
              <span className="tabular-nums mt-0.5 block text-sm font-semibold text-[#0B1F16] dark:text-[#F2F9F5]">
                {formatCurrency(product.expenses, currency, lang)}
              </span>
            </div>
            <div className="rounded-xl border border-[#DCE7E0] p-3 dark:border-[#1E3A2D]">
              <span className="block text-[11px] text-[#335947] dark:text-[#9EC0AE]">
                {t.marginLabel}
              </span>
              <span
                className={`tabular-nums mt-0.5 block text-sm font-semibold ${
                  unitMargin >= 0
                    ? 'text-[#115E3B] dark:text-[#34D399]'
                    : 'text-red-600 dark:text-red-400'
                }`}
              >
                {formatCurrency(unitMargin, currency, lang)}
              </span>
            </div>
            <div className="rounded-xl border border-[#DCE7E0] p-3 dark:border-[#1E3A2D]">
              <span className="block text-[11px] text-[#335947] dark:text-[#9EC0AE]">
                {t.addedDateLabel}
              </span>
              <span className="tabular-nums mt-0.5 block text-sm font-semibold text-[#0B1F16] dark:text-[#F2F9F5]">
                {product.addedDate}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl bg-[#ECF7F1] px-4 py-2.5 text-xs font-semibold text-[#115E3B] dark:bg-[#132B20] dark:text-[#34D399]">
            <span>{t.totalItemValueLabel}</span>
            <span className="tabular-nums">{formatCurrency(stockValue, currency, lang)}</span>
          </div>

          {/* Inline Delete Confirmation */}
          {confirmingDelete && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 dark:border-red-900/60 dark:bg-red-950/40">
              <p className="text-sm font-bold text-red-800 dark:text-red-200">
                {t.confirmDeleteTitle}
              </p>
              <p className="mt-1 text-xs text-red-700 dark:text-red-300">{t.confirmDeleteText}</p>
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  className="min-h-[44px] flex-1 rounded-xl border border-red-200 bg-white text-xs font-semibold text-red-700 dark:border-red-800 dark:bg-[#0F2119] dark:text-red-300"
                >
                  {t.cancel}
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={deleting}
                  className="min-h-[44px] flex-1 rounded-xl bg-red-600 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {t.confirmDeleteAction}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Sticky Sheet Action Bar */}
        <div className="pb-safe flex flex-wrap items-center gap-2 border-t border-[#DCE7E0] bg-white px-5 py-3.5 dark:border-[#1E3A2D] dark:bg-[#0F2119]">
          {onOpenDigitalFile && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenDigitalFile(product);
              }}
              className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-[#DCE7E0] bg-[#ECF7F1] px-3.5 text-xs font-semibold text-[#115E3B] hover:bg-[#DCF0E4] dark:border-[#1E3A2D] dark:bg-[#132B20] dark:text-[#34D399]"
            >
              <FileText className="h-4 w-4" />
              <span className="whitespace-nowrap">{t.qrDigitalFileButton}</span>
            </button>
          )}

          {onOpenQrLabel && (
            <button
              type="button"
              onClick={() => onOpenQrLabel(product)}
              aria-label={t.qrLabelButton}
              title={t.qrLabelButton}
              className="flex min-h-[48px] min-w-[48px] items-center justify-center rounded-xl border border-[#DCE7E0] bg-[#F7FAF8] px-3 text-[#115E3B] hover:bg-[#ECF7F1] dark:border-[#1E3A2D] dark:bg-[#102119] dark:text-[#34D399]"
            >
              <QrCode className="h-4 w-4" />
            </button>
          )}

          <button
            type="button"
            onClick={() => onShare(product)}
            className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl bg-[#115E3B] px-4 text-sm font-semibold text-white hover:bg-[#0D4A2E] dark:bg-[#10B981] dark:text-[#052E1C] dark:hover:bg-[#059669]"
          >
            <Share2 className="h-4 w-4" />
            <span className="whitespace-nowrap">{t.share}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onClose();
              onEdit(product);
            }}
            className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-[#DCE7E0] bg-[#F7FAF8] px-4 text-sm font-semibold text-[#0B1F16] hover:bg-[#ECF7F1] dark:border-[#1E3A2D] dark:bg-[#102119] dark:text-[#F2F9F5] dark:hover:bg-[#162E23]"
          >
            <Edit3 className="h-4 w-4" />
            <span className="whitespace-nowrap">{t.edit}</span>
          </button>

          <button
            type="button"
            onClick={() => setConfirmingDelete((v) => !v)}
            aria-label={t.delete}
            className="flex min-h-[48px] min-w-[48px] items-center justify-center rounded-xl border border-red-200 bg-red-50 px-3 text-red-700 hover:bg-red-100 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
