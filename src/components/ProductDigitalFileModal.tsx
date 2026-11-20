import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Download,
  Edit3,
  History,
  Image as ImageIcon,
  MessageCircle,
  Package,
  Play,
  QrCode,
  Receipt,
  RotateCcw,
  ShieldCheck,
  ShoppingBag,
  Store,
  Truck,
  User,
  X,
} from 'lucide-react';
import type {
  Customer,
  Language,
  PosInvoice,
  PosSalePayload,
  Product,
  ProductDigitalFile,
  PurchasePaymentMethod,
} from '../types';
import { formatCurrency, formatNumber, translations } from '../i18n';
import { convertFromMad, convertToMad } from '../utils/currency';
import { isVideoMedia } from '../utils/image';
import {
  buildInvoiceReceiptBlob,
  buildProductQrUrl,
  buildQrStickerBlob,
  generateQrDataUrl,
} from '../utils/qr';
import { saveOrShareBlob } from '../utils/download';

interface ProductDigitalFileModalProps {
  digitalFile: ProductDigitalFile | null;
  initialView?: 'client' | 'management';
  lockedToClient?: boolean;
  lang: Language;
  currency: string;
  storeName?: string;
  whatsappPhone?: string;
  customers: Customer[];
  onClose: () => void;
  onEditProduct: (product: Product) => void;
  onRecordSale: (payload: PosSalePayload) => Promise<PosInvoice | null>;
  onCancelInvoice: (invoiceId: string) => Promise<void>;
  onOpenClientQrScanner?: () => void;
  onNotify?: (msg: string) => void;
}

export function ProductDigitalFileModal({
  digitalFile,
  initialView = 'client',
  lockedToClient = false,
  lang,
  currency,
  storeName = '',
  whatsappPhone = '',
  customers,
  onClose,
  onEditProduct,
  onRecordSale,
  onCancelInvoice,
  onOpenClientQrScanner,
  onNotify,
}: ProductDigitalFileModalProps) {
  const t = translations[lang];
  const [activeView, setActiveView] = useState<'client' | 'management'>(
    lockedToClient ? 'client' : initialView
  );
  const [photoIdx, setPhotoIdx] = useState(0);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [showQuickSell, setShowQuickSell] = useState(false);
  const [sellQty, setSellQty] = useState('1');
  const [sellPriceDisplay, setSellPriceDisplay] = useState('');
  const [sellCustomerId, setSellCustomerId] = useState('');
  const [sellCustomerName, setSellCustomerName] = useState('');
  const [sellPayment, setSellPayment] = useState<PurchasePaymentMethod>('cash');
  const [sellNotes, setSellNotes] = useState('');
  const [submittingSale, setSubmittingSale] = useState(false);
  const [saleError, setSaleError] = useState('');
  const [cancelingInvoiceId, setCancelingInvoiceId] = useState<string | null>(null);

  useEffect(() => {
    setActiveView(lockedToClient ? 'client' : initialView);
  }, [initialView, lockedToClient, digitalFile?.product.id]);

  useEffect(() => {
    setPhotoIdx(0);
    setShowQuickSell(false);
    setSaleError('');
    setCancelingInvoiceId(null);
    if (digitalFile) {
      setSellQty('1');
      setSellPriceDisplay(String(convertFromMad(digitalFile.product.sellingPrice, currency)));
      setSellCustomerId('');
      setSellCustomerName('');
      setSellPayment('cash');
      setSellNotes('');
    }
  }, [digitalFile?.product.id, currency]);

  useEffect(() => {
    if (!digitalFile) {
      setQrDataUrl('');
      return;
    }
    let active = true;
    const url = buildProductQrUrl(digitalFile.product, { storeName, whatsappPhone });
    void generateQrDataUrl(url, 260)
      .then((res) => {
        if (active) setQrDataUrl(res);
      })
      .catch(() => {
        if (active) setQrDataUrl('');
      });
    return () => {
      active = false;
    };
  }, [digitalFile, storeName, whatsappPhone]);

  if (!digitalFile) return null;

  const { product, invoices, history, salesStats } = digitalFile;
  const photos = product.photos || [];
  const activePhoto = photos[photoIdx] || photos[0];
  const isAvailable = (Number(product.quantity) || 0) > 0;
  const totalPurchaseCost =
    (Number(product.referencePrice) || 0) + (Number(product.expenses) || 0);
  const unitMargin = (Number(product.sellingPrice) || 0) - totalPurchaseCost;

  // WhatsApp contact URL for Customer Interface
  const waDigits = (whatsappPhone || '').replace(/[^\d]/g, '');
  const waText = encodeURIComponent(
    `${t.digitalWhatsappMessagePrefix} ${product.name} (${product.code}) — ${formatCurrency(
      product.sellingPrice,
      currency,
      lang
    )}`
  );
  const waHref = waDigits
    ? `https://wa.me/${waDigits}?text=${waText}`
    : `https://wa.me/?text=${waText}`;

  const handleQuickSellSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingSale(true);
    setSaleError('');
    try {
      const qty = Math.max(1, Math.floor(Number(sellQty) || 1));
      const unitPriceMad =
        sellPriceDisplay.trim() !== ''
          ? convertToMad(Number(sellPriceDisplay) || 0, currency)
          : product.sellingPrice;
      const created = await onRecordSale({
        productId: product.id,
        quantity: qty,
        unitPrice: unitPriceMad,
        customerId: sellCustomerId || undefined,
        customerName: sellCustomerName.trim(),
        paymentMethod: sellPayment,
        notes: sellNotes.trim(),
        source: 'pos_manual',
      });
      if (created) {
        setShowQuickSell(false);
      }
    } catch (err) {
      if (err instanceof Error && err.message === 'OUT_OF_STOCK') {
        setSaleError(t.qrScannerOutOfStock);
      } else {
        setSaleError(t.errorSave);
      }
    } finally {
      setSubmittingSale(false);
    }
  };

  const paymentLabel = (method: string) => {
    if (method === 'transfer') return t.paymentTransfer;
    if (method === 'check') return t.paymentCheck;
    if (method === 'card') return t.paymentCard;
    if (method === 'other') return t.paymentOther;
    return t.paymentCash;
  };

  const inputClass =
    'min-h-[44px] w-full rounded-xl border border-[#DCE7E0] bg-[#F7FAF8] px-3 py-2 text-sm text-[#0B1F16] placeholder:text-[#6B8A79] focus:border-[#115E3B] focus:bg-white focus:outline-none dark:border-[#1E3A2D] dark:bg-[#091611] dark:text-[#F2F9F5] dark:placeholder:text-[#8FB39E] dark:focus:border-[#10B981] dark:focus:bg-[#0D1E16]';

  return (
    <div
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-xs sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[95vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl border border-[#DCE7E0] bg-white shadow-2xl sm:rounded-3xl dark:border-[#1E3A2D] dark:bg-[#0F2119]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Modal Bar */}
        <div className="flex items-center justify-between gap-2 border-b border-[#DCE7E0] px-5 py-3.5 dark:border-[#1E3A2D]">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono-code text-xs font-bold tracking-wider text-[#115E3B] dark:text-[#34D399]">
                {product.code}
              </span>
              <span aria-hidden="true" className="text-[#6B8A79]">·</span>
              <span className="text-xs font-medium text-[#335947] dark:text-[#9EC0AE]">
                {t.digitalFileTitle}
              </span>
            </div>
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

        {/* Dual Interface Switcher: hidden when opened externally by customer (?qr=) */}
        {!lockedToClient && (
          <div className="border-b border-[#DCE7E0] bg-[#F7FAF8] px-5 py-2.5 dark:border-[#1E3A2D] dark:bg-[#091611]">
            <div className="grid grid-cols-2 gap-2 rounded-2xl border border-[#DCE7E0] bg-white p-1 dark:border-[#1E3A2D] dark:bg-[#0F2119]">
              <button
                type="button"
                onClick={() => setActiveView('client')}
                className={`flex min-h-[42px] items-center justify-center gap-2 rounded-xl px-3 text-xs font-bold transition-colors sm:text-sm ${
                  activeView === 'client'
                    ? 'bg-[#115E3B] text-white dark:bg-[#10B981] dark:text-[#052E1C]'
                    : 'text-[#335947] hover:bg-[#ECF7F1] dark:text-[#9EC0AE] dark:hover:bg-[#162E23]'
                }`}
              >
                <User className="h-4 w-4 shrink-0" />
                <span>{t.digitalTabClient}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveView('management')}
                className={`flex min-h-[42px] items-center justify-center gap-2 rounded-xl px-3 text-xs font-bold transition-colors sm:text-sm ${
                  activeView === 'management'
                    ? 'bg-[#115E3B] text-white dark:bg-[#10B981] dark:text-[#052E1C]'
                    : 'text-[#335947] hover:bg-[#ECF7F1] dark:text-[#9EC0AE] dark:hover:bg-[#162E23]'
                }`}
              >
                <ShieldCheck className="h-4 w-4 shrink-0" />
                <span>{t.digitalTabManagement}</span>
              </button>
            </div>
          </div>
        )}

        {/* Scrollable Content Body */}
        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          {/* Shared Media Carousel (Present in both Customer & Management Interfaces) */}
          <div>
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="font-mono-code font-bold text-[#115E3B] dark:text-[#34D399]">
                {t.digitalSerialCode} : {activePhoto?.photoCode || product.code}
              </span>
              {photos.length > 1 && (
                <span className="tabular-nums text-[#335947] dark:text-[#9EC0AE]">
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
                  <ImageIcon className="mb-2 h-10 w-10 opacity-45" />
                  <span className="text-xs">{product.code}</span>
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
                {photos.map((ph, idx) => (
                  <button
                    key={ph.id}
                    type="button"
                    onClick={() => setPhotoIdx(idx)}
                    className={`relative h-14 w-16 shrink-0 overflow-hidden rounded-xl border bg-black ${
                      idx === photoIdx
                        ? 'border-[#115E3B] ring-2 ring-[#115E3B]/30 dark:border-[#10B981]'
                        : 'border-[#DCE7E0] dark:border-[#1E3A2D]'
                    }`}
                  >
                    {isVideoMedia(ph.imageData) ? (
                      <>
                        <video src={ph.imageData} muted playsInline className="h-full w-full object-cover" />
                        <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/30">
                          <Play className="h-4 w-4 fill-white text-white" />
                        </span>
                      </>
                    ) : (
                      <img src={ph.imageData} alt={ph.photoCode} className="h-full w-full object-cover" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {lockedToClient || activeView === 'client' ? (
            /* =====================================================================
               A / CUSTOMER INTERFACE
               Serial code, acquisition/purchase date, media, name & description,
               price, status, additional info, and WhatsApp contact button
            ===================================================================== */
            <div className="space-y-5">
              {/* Price + Status Banner */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#DCE7E0] bg-[#F7FAF8] p-4 dark:border-[#1E3A2D] dark:bg-[#091611]">
                <div>
                  <span className="block text-xs font-medium text-[#335947] dark:text-[#9EC0AE]">
                    {t.digitalMgmtSellingPrice}
                  </span>
                  <span className="tabular-nums mt-0.5 block font-display text-2xl font-bold text-[#115E3B] dark:text-[#34D399]">
                    {formatCurrency(product.sellingPrice, currency, lang)}
                  </span>
                </div>

                <div className="text-end">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold ${
                      isAvailable
                        ? 'bg-[#ECF7F1] text-[#115E3B] dark:bg-[#132B20] dark:text-[#34D399]'
                        : 'bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
                    }`}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>{isAvailable ? t.digitalStatusAvailable : t.digitalStatusSold}</span>
                  </span>
                </div>
              </div>

              {/* Name, Serial Code & Dates */}
              <div className="space-y-2 border-b border-[#DCE7E0] pb-4 dark:border-[#1E3A2D]">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#335947] dark:text-[#9EC0AE]">
                  <span className="font-mono-code font-bold text-[#115E3B] dark:text-[#34D399]">
                    {t.digitalSerialCode}: {product.code}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">
                    {t.digitalPurchaseDateClient}: {product.addedDate}
                  </span>
                  {salesStats.lastSaleDate && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">
                        {t.digitalSaleDateClient}: {salesStats.lastSaleDate}
                      </span>
                    </>
                  )}
                </div>

                <h3 className="font-display text-xl font-bold text-[#0B1F16] dark:text-[#F2F9F5]">
                  {product.name}
                </h3>

                {product.description && (
                  <p className="text-sm leading-relaxed text-[#0B1F16]/90 dark:text-[#D1E7DA]">
                    {product.description}
                  </p>
                )}
              </div>

              {/* Additional Information (Dimensions, Pieces, Available qty, Store) */}
              <div className="rounded-2xl border border-[#DCE7E0] bg-[#F7FAF8] p-4 dark:border-[#1E3A2D] dark:bg-[#091611]">
                <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-[#115E3B] dark:text-[#34D399]">
                  {t.digitalAdditionalInfo}
                </h4>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div>
                    <span className="block text-[11px] text-[#335947] dark:text-[#9EC0AE]">
                      {t.dimensionsShort}
                    </span>
                    <span className="tabular-nums text-sm font-semibold text-[#0B1F16] dark:text-[#F2F9F5]">
                      {formatNumber(product.lengthCm, lang)} × {formatNumber(product.widthCm, lang)} ×{' '}
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
                      {formatNumber(product.piecesCount, lang)} {t.piecesUnit}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[11px] text-[#335947] dark:text-[#9EC0AE]">
                      {t.digitalMgmtInventory}
                    </span>
                    <span className="tabular-nums text-sm font-semibold text-[#0B1F16] dark:text-[#F2F9F5]">
                      {formatNumber(product.quantity, lang)} {t.articlesUnit}
                    </span>
                  </div>
                </div>
              </div>

              {/* WhatsApp Contact Button */}
              <div className="rounded-2xl border border-[#10B981]/30 bg-[#ECF7F1]/70 p-4 dark:border-[#10B981]/30 dark:bg-[#132B20]/60">
                <div className="flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
                  <div className="flex items-center gap-2.5">
                    <Store className="h-5 w-5 shrink-0 text-[#115E3B] dark:text-[#34D399]" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-[#0B1F16] dark:text-[#F2F9F5]">
                        {storeName.trim() || t.brandName}
                      </p>
                      <p className="text-xs text-[#335947] dark:text-[#9EC0AE]">
                        {whatsappPhone ? whatsappPhone : t.digitalWhatsappContact}
                      </p>
                    </div>
                  </div>

                  <a
                    href={waHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-[#16A34A] px-5 text-sm font-bold text-white transition-colors hover:bg-[#15803D] whitespace-nowrap shrink-0"
                  >
                    <MessageCircle className="h-4 w-4" />
                    <span>{t.digitalWhatsappContact}</span>
                  </a>
                </div>
              </div>
            </div>
          ) : (
            /* =====================================================================
               B / USER MANAGEMENT INTERFACE
               Serial code, media, name & description, purchase price, supplier,
               inventory, sales, selling price, invoices, and product history
            ===================================================================== */
            <div className="space-y-5">
              {/* Identity + Embedded QR Card */}
              <div className="flex flex-col gap-4 rounded-2xl border border-[#DCE7E0] bg-[#F7FAF8] p-4 sm:flex-row sm:items-center dark:border-[#1E3A2D] dark:bg-[#091611]">
                <div className="flex shrink-0 items-center justify-center rounded-xl border border-[#DCE7E0] bg-white p-2 dark:border-[#1E3A2D]">
                  {qrDataUrl ? (
                    <img src={qrDataUrl} alt={product.code} className="h-24 w-24 object-contain" />
                  ) : (
                    <QrCode className="h-24 w-24 text-[#115E3B]/40" />
                  )}
                </div>

                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono-code text-sm font-bold text-[#115E3B] dark:text-[#34D399]">
                      {product.qrToken || `GA-QR-${product.code}`}
                    </span>
                    <span aria-hidden="true" className="text-[#6B8A79]">·</span>
                    <span className="text-xs text-[#335947] dark:text-[#9EC0AE]">
                      {t.addedDateLabel.replace(/^9\.\s*/, '')}: {product.addedDate}
                    </span>
                  </div>
                  <h3 className="font-display text-lg font-bold text-[#0B1F16] dark:text-[#F2F9F5]">
                    {product.name}
                  </h3>
                  {product.description && (
                    <p className="text-xs leading-relaxed text-[#335947] dark:text-[#9EC0AE]">
                      {product.description}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={async () => {
                        const blob = await buildQrStickerBlob(
                          product,
                          storeName,
                          currency,
                          lang,
                          whatsappPhone
                        );
                        await saveOrShareBlob(
                          blob,
                          `qr-${product.code.toLowerCase()}.png`,
                          `${product.code} QR`
                        );
                      }}
                      className="flex min-h-[38px] items-center gap-1.5 rounded-xl bg-[#115E3B] px-3 text-xs font-semibold text-white hover:bg-[#0D4A2E] dark:bg-[#10B981] dark:text-[#052E1C]"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>{t.qrDownloadSticker}</span>
                    </button>

                    <button
                      type="button"
                      onClick={async () => {
                        await navigator.clipboard.writeText(
                          buildProductQrUrl(product, { storeName, whatsappPhone })
                        );
                        onNotify?.(t.qrLinkCopied);
                      }}
                      className="flex min-h-[38px] items-center gap-1.5 rounded-xl border border-[#DCE7E0] bg-white px-3 text-xs font-semibold text-[#0B1F16] hover:bg-[#ECF7F1] dark:border-[#1E3A2D] dark:bg-[#102119] dark:text-[#F2F9F5]"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      <span>{t.qrCopyLink}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Financial, Supplier, Inventory & Sales Grid */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-[#DCE7E0] p-3.5 dark:border-[#1E3A2D]">
                  <span className="block text-[11px] font-medium text-[#335947] dark:text-[#9EC0AE]">
                    {t.digitalMgmtPurchasePrice}
                  </span>
                  <span className="tabular-nums mt-1 block text-base font-bold text-[#0B1F16] dark:text-[#F2F9F5]">
                    {formatCurrency(totalPurchaseCost, currency, lang)}
                  </span>
                  <span className="tabular-nums mt-0.5 block text-[11px] text-[#335947] dark:text-[#9EC0AE]">
                    {formatCurrency(product.referencePrice, currency, lang)} +{' '}
                    {formatCurrency(product.expenses, currency, lang)}
                  </span>
                </div>

                <div className="rounded-xl border border-[#DCE7E0] p-3.5 dark:border-[#1E3A2D]">
                  <span className="block text-[11px] font-medium text-[#335947] dark:text-[#9EC0AE]">
                    {t.digitalMgmtSellingPrice}
                  </span>
                  <span className="tabular-nums mt-1 block text-base font-bold text-[#115E3B] dark:text-[#34D399]">
                    {formatCurrency(product.sellingPrice, currency, lang)}
                  </span>
                  <span className="tabular-nums mt-0.5 block text-[11px] text-[#335947] dark:text-[#9EC0AE]">
                    {t.marginLabel}: {formatCurrency(unitMargin, currency, lang)}
                  </span>
                </div>

                <div className="rounded-xl border border-[#DCE7E0] p-3.5 dark:border-[#1E3A2D]">
                  <span className="flex items-center gap-1 text-[11px] font-medium text-[#335947] dark:text-[#9EC0AE]">
                    <Truck className="h-3.5 w-3.5" />
                    <span>{t.digitalMgmtSupplier}</span>
                  </span>
                  <span className="mt-1 block truncate text-sm font-bold text-[#0B1F16] dark:text-[#F2F9F5]">
                    {product.supplier?.trim() || t.digitalMgmtNotSpecified}
                  </span>
                </div>

                <div className="rounded-xl border border-[#DCE7E0] p-3.5 dark:border-[#1E3A2D]">
                  <span className="flex items-center gap-1 text-[11px] font-medium text-[#335947] dark:text-[#9EC0AE]">
                    <Package className="h-3.5 w-3.5" />
                    <span>{t.digitalMgmtInventory}</span>
                  </span>
                  <span
                    className={`tabular-nums mt-1 block text-base font-bold ${
                      isAvailable
                        ? 'text-[#115E3B] dark:text-[#34D399]'
                        : 'text-amber-700 dark:text-amber-300'
                    }`}
                  >
                    {formatNumber(product.quantity, lang)} {t.articlesUnit}
                  </span>
                  <span
                    className={`mt-0.5 block text-[11px] font-semibold ${
                      isAvailable
                        ? 'text-[#115E3B] dark:text-[#34D399]'
                        : 'text-amber-700 dark:text-amber-300'
                    }`}
                  >
                    {isAvailable ? t.digitalStatusAvailable : t.digitalStatusSold}
                  </span>
                </div>

                <div className="rounded-xl border border-[#DCE7E0] p-3.5 dark:border-[#1E3A2D]">
                  <span className="block text-[11px] font-medium text-[#335947] dark:text-[#9EC0AE]">
                    {t.digitalMgmtQtySoldLabel}
                  </span>
                  <span className="tabular-nums mt-1 block text-base font-bold text-[#0B1F16] dark:text-[#F2F9F5]">
                    {formatNumber(salesStats.totalUnitsSold, lang)} {t.articlesUnit}
                  </span>
                </div>

                <div className="rounded-xl border border-[#DCE7E0] p-3.5 dark:border-[#1E3A2D]">
                  <span className="block text-[11px] font-medium text-[#335947] dark:text-[#9EC0AE]">
                    {t.digitalMgmtRevenueLabel}
                  </span>
                  <span className="tabular-nums mt-1 block text-base font-bold text-[#115E3B] dark:text-[#34D399]">
                    {formatCurrency(salesStats.totalRevenueMad, currency, lang)}
                  </span>
                </div>
              </div>

              {/* Quick POS Sale Trigger & Inline Form */}
              {isAvailable && (
                <div className="rounded-2xl border border-[#DCE7E0] bg-[#ECF7F1]/55 p-4 dark:border-[#1E3A2D] dark:bg-[#132B20]/45">
                  {!showQuickSell ? (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span className="text-xs font-semibold text-[#335947] dark:text-[#9EC0AE]">
                        {t.posSubtitle}
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowQuickSell(true)}
                        className="flex min-h-[44px] items-center gap-2 rounded-xl bg-[#115E3B] px-4 text-xs font-bold text-white hover:bg-[#0D4A2E] dark:bg-[#10B981] dark:text-[#052E1C]"
                      >
                        <ShoppingBag className="h-4 w-4" />
                        <span>{t.digitalMgmtQuickSell}</span>
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleQuickSellSubmit} className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-bold text-[#0B1F16] dark:text-[#F2F9F5]">
                          {t.digitalMgmtQuickSell}
                        </h4>
                        <button
                          type="button"
                          onClick={() => setShowQuickSell(false)}
                          className="text-xs font-semibold text-[#335947] hover:underline dark:text-[#9EC0AE]"
                        >
                          {t.cancel}
                        </button>
                      </div>

                      {saleError && (
                        <div className="rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-300">
                          {saleError}
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <div>
                          <label className="mb-1 block text-[11px] font-semibold text-[#335947] dark:text-[#9EC0AE]">
                            {t.purchaseQuantityLabel}
                          </label>
                          <input
                            type="number"
                            min="1"
                            max={product.quantity}
                            value={sellQty}
                            onChange={(e) => setSellQty(e.target.value)}
                            className={`${inputClass} tabular-nums`}
                          />
                        </div>

                        <div>
                          <label className="mb-1 block text-[11px] font-semibold text-[#335947] dark:text-[#9EC0AE]">
                            {t.purchaseUnitPriceLabel} ({currency})
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={sellPriceDisplay}
                            onChange={(e) => setSellPriceDisplay(e.target.value)}
                            className={`${inputClass} tabular-nums`}
                          />
                        </div>

                        <div>
                          <label className="mb-1 block text-[11px] font-semibold text-[#335947] dark:text-[#9EC0AE]">
                            {t.purchasePaymentLabel}
                          </label>
                          <select
                            value={sellPayment}
                            onChange={(e) => setSellPayment(e.target.value as PurchasePaymentMethod)}
                            className={inputClass}
                          >
                            <option value="cash">{t.paymentCash}</option>
                            <option value="transfer">{t.paymentTransfer}</option>
                            <option value="card">{t.paymentCard}</option>
                            <option value="check">{t.paymentCheck}</option>
                            <option value="other">{t.paymentOther}</option>
                          </select>
                        </div>

                        <div>
                          <label className="mb-1 block text-[11px] font-semibold text-[#335947] dark:text-[#9EC0AE]">
                            {t.posSelectCustomer}
                          </label>
                          <select
                            value={sellCustomerId}
                            onChange={(e) => {
                              setSellCustomerId(e.target.value);
                              const c = customers.find((x) => x.id === e.target.value);
                              if (c) setSellCustomerName(c.name);
                            }}
                            className={inputClass}
                          >
                            <option value="">{t.posWalkInCustomer}</option>
                            {customers.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.code} — {c.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {!sellCustomerId && (
                        <input
                          type="text"
                          value={sellCustomerName}
                          onChange={(e) => setSellCustomerName(e.target.value)}
                          placeholder={t.posCustomerNamePlaceholder}
                          className={inputClass}
                        />
                      )}

                      <button
                        type="submit"
                        disabled={submittingSale}
                        className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[#115E3B] px-4 text-sm font-semibold text-white hover:bg-[#0D4A2E] disabled:opacity-60 dark:bg-[#10B981] dark:text-[#052E1C]"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        <span>{submittingSale ? t.saving : t.posConfirmSale}</span>
                      </button>
                    </form>
                  )}
                </div>
              )}

              {/* Invoices Section */}
              <section className="space-y-2.5">
                <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#115E3B] dark:text-[#34D399]">
                  <Receipt className="h-4 w-4" />
                  <span>
                    {t.digitalMgmtInvoices} ({formatNumber(invoices.length, lang)})
                  </span>
                </h4>

                {invoices.length === 0 ? (
                  <p className="rounded-xl border border-[#DCE7E0] bg-[#F7FAF8] px-4 py-3 text-xs text-[#335947] dark:border-[#1E3A2D] dark:bg-[#091611] dark:text-[#9EC0AE]">
                    {t.digitalMgmtNoInvoices}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {invoices.map((inv) => (
                      <div
                        key={inv.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#DCE7E0] bg-white px-3.5 py-2.5 dark:border-[#1E3A2D] dark:bg-[#091611]"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 text-xs">
                            <span className="font-mono-code font-bold text-[#115E3B] dark:text-[#34D399]">
                              {inv.invoiceNumber}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className="tabular-nums text-[#335947] dark:text-[#9EC0AE]">
                              {inv.saleDate}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>{paymentLabel(inv.paymentMethod)}</span>
                          </div>
                          <p className="tabular-nums mt-0.5 text-xs text-[#0B1F16] dark:text-[#D1E7DA]">
                            {inv.quantity} × {formatCurrency(inv.unitPrice, currency, lang)}
                            {inv.customerName ? ` · ${inv.customerName}` : ''}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="tabular-nums text-sm font-bold text-[#115E3B] dark:text-[#34D399]">
                            {formatCurrency(inv.totalPrice, currency, lang)}
                          </span>
                          <button
                            type="button"
                            onClick={async () => {
                              const blob = await buildInvoiceReceiptBlob(
                                inv,
                                storeName,
                                currency,
                                lang
                              );
                              await saveOrShareBlob(
                                blob,
                                `${inv.invoiceNumber.toLowerCase()}.png`,
                                inv.invoiceNumber
                              );
                            }}
                            title={t.posDownloadReceipt}
                            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#DCE7E0] text-[#0B1F16] hover:bg-[#ECF7F1] dark:border-[#1E3A2D] dark:text-[#F2F9F5]"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </button>

                          {cancelingInvoiceId === inv.id ? (
                            <button
                              type="button"
                              onClick={async () => {
                                await onCancelInvoice(inv.id);
                                setCancelingInvoiceId(null);
                              }}
                              className="rounded-lg bg-red-600 px-2.5 py-1.5 text-[11px] font-semibold text-white"
                            >
                              {t.confirmDeleteAction}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setCancelingInvoiceId(inv.id)}
                              title={t.posCancelInvoice}
                              className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#DCE7E0] text-red-600 hover:bg-red-50 dark:border-[#1E3A2D] dark:text-red-400"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Product History Timeline */}
              <section className="space-y-2.5">
                <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#115E3B] dark:text-[#34D399]">
                  <History className="h-4 w-4" />
                  <span>{t.digitalMgmtHistory}</span>
                </h4>

                {history.length === 0 ? (
                  <p className="rounded-xl border border-[#DCE7E0] bg-[#F7FAF8] px-4 py-3 text-xs text-[#335947] dark:border-[#1E3A2D] dark:bg-[#091611] dark:text-[#9EC0AE]">
                    {t.digitalMgmtNoHistory}
                  </p>
                ) : (
                  <div className="divide-y divide-[#DCE7E0] rounded-2xl border border-[#DCE7E0] bg-white dark:divide-[#1E3A2D] dark:border-[#1E3A2D] dark:bg-[#091611]">
                    {history.map((ev) => (
                      <div
                        key={ev.id}
                        className="flex items-start justify-between gap-3 px-4 py-3 text-xs"
                      >
                        <div className="min-w-0">
                          <p className="font-semibold text-[#0B1F16] dark:text-[#F2F9F5]">
                            {ev.summary}
                          </p>
                          {ev.details && (
                            <p className="mt-0.5 text-[#335947] dark:text-[#9EC0AE]">
                              {ev.details}
                            </p>
                          )}
                          <p className="tabular-nums mt-1 flex items-center gap-1 text-[11px] text-[#6B8A79]">
                            <Clock className="h-3 w-3" />
                            <span>{ev.createdAt.slice(0, 16).replace('T', ' ')}</span>
                          </p>
                        </div>

                        <div className="tabular-nums shrink-0 text-end">
                          {ev.quantityDelta !== 0 && (
                            <span
                              className={`block font-bold ${
                                ev.quantityDelta > 0
                                  ? 'text-[#115E3B] dark:text-[#34D399]'
                                  : 'text-amber-700 dark:text-amber-300'
                              }`}
                            >
                              {ev.quantityDelta > 0
                                ? `+${ev.quantityDelta}`
                                : ev.quantityDelta}
                            </span>
                          )}
                          <span className="block text-[11px] text-[#335947] dark:text-[#9EC0AE]">
                            Stock: {ev.quantityAfter}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}
        </div>

        {/* Sticky Footer */}
        <div className="pb-safe flex items-center justify-between gap-2.5 border-t border-[#DCE7E0] bg-white px-5 py-3.5 dark:border-[#1E3A2D] dark:bg-[#0F2119]">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[46px] flex-1 rounded-xl border border-[#DCE7E0] text-sm font-semibold text-[#335947] hover:bg-[#F7FAF8] dark:border-[#1E3A2D] dark:text-[#9EC0AE]"
          >
            {t.close}
          </button>

          {!lockedToClient && activeView === 'management' && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onEditProduct(product);
              }}
              className="flex min-h-[46px] flex-1 items-center justify-center gap-2 rounded-xl bg-[#115E3B] px-4 text-sm font-semibold text-white hover:bg-[#0D4A2E] dark:bg-[#10B981] dark:text-[#052E1C]"
            >
              <Edit3 className="h-4 w-4" />
              <span>{t.edit}</span>
            </button>
          )}

          {(lockedToClient || activeView === 'client') && onOpenClientQrScanner && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenClientQrScanner();
              }}
              className="flex min-h-[46px] flex-1 items-center justify-center gap-2 rounded-xl bg-[#115E3B] px-4 text-sm font-semibold text-white hover:bg-[#0D4A2E] dark:bg-[#10B981] dark:text-[#052E1C]"
            >
              <QrCode className="h-4 w-4 shrink-0" />
              <span>{t.digitalScanAnotherQr}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
