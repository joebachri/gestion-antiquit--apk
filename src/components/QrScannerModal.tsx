import { useCallback, useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import {
  Camera,
  CheckCircle2,
  Download,
  Eye,
  FileText,
  ImagePlus,
  QrCode,
  Search,
  ShoppingBag,
  X,
} from 'lucide-react';
import type { Language, PosInvoice, ProductDigitalFile } from '../types';
import { formatCurrency, formatNumber, translations } from '../i18n';
import { buildInvoiceReceiptBlob } from '../utils/qr';
import { saveOrShareBlob } from '../utils/download';

export type QrScanMode = 'view' | 'sell';

interface QrScannerModalProps {
  isOpen: boolean;
  lang: Language;
  currency: string;
  storeName?: string;
  initialMode?: QrScanMode;
  onClose: () => void;
  onLookupQr: (qrInput: string, logScan: boolean) => Promise<ProductDigitalFile>;
  onExecuteQrSale: (productId: string) => Promise<{
    invoice: PosInvoice;
    digitalFile: ProductDigitalFile;
  }>;
  onOpenDigitalFile: (digitalFile: ProductDigitalFile, view: 'client' | 'management') => void;
}

interface BarcodeDetectorLike {
  detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>;
}

export function QrScannerModal({
  isOpen,
  lang,
  currency,
  storeName = '',
  initialMode = 'view',
  onClose,
  onLookupQr,
  onExecuteQrSale,
  onOpenDigitalFile,
}: QrScannerModalProps) {
  const t = translations[lang];
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const busyScanRef = useRef(false);

  const [scanMode, setScanMode] = useState<QrScanMode>(initialMode);
  const [cameraState, setCameraState] = useState<'starting' | 'active' | 'unavailable'>('starting');
  const [manualInput, setManualInput] = useState('');
  const [processing, setProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [soldReceipt, setSoldReceipt] = useState<{
    invoice: PosInvoice;
    digitalFile: ProductDigitalFile;
  } | null>(null);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const handleDecodedCode = useCallback(
    async (rawCode: string) => {
      const clean = rawCode.trim();
      if (!clean || busyScanRef.current) return;
      busyScanRef.current = true;
      setProcessing(true);
      setErrorMsg('');
      try {
        if (scanMode === 'view') {
          const digitalFile = await onLookupQr(clean, true);
          stopCamera();
          onClose();
          onOpenDigitalFile(digitalFile, 'client');
        } else {
          const digitalFile = await onLookupQr(clean, false);
          if ((Number(digitalFile.product.quantity) || 0) <= 0) {
            setErrorMsg(t.qrScannerOutOfStock);
            return;
          }
          const result = await onExecuteQrSale(digitalFile.product.id);
          setSoldReceipt(result);
        }
      } catch (err) {
        if (err instanceof Error && err.message === 'OUT_OF_STOCK') {
          setErrorMsg(t.qrScannerOutOfStock);
        } else {
          setErrorMsg(t.qrScannerNotFound);
        }
      } finally {
        setProcessing(false);
        setTimeout(() => {
          busyScanRef.current = false;
        }, 900);
      }
    },
    [
      scanMode,
      onLookupQr,
      onExecuteQrSale,
      onClose,
      onOpenDigitalFile,
      stopCamera,
      t.qrScannerNotFound,
      t.qrScannerOutOfStock,
    ]
  );

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      return;
    }
    setScanMode(initialMode);
    setSoldReceipt(null);
    setErrorMsg('');
    setManualInput('');
    busyScanRef.current = false;
  }, [isOpen, initialMode, stopCamera]);

  useEffect(() => {
    if (!isOpen || soldReceipt) {
      stopCamera();
      return;
    }

    let cancelled = false;
    let rafTimer: number | null = null;

    const startCamera = async () => {
      setCameraState('starting');
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        if (!cancelled) setCameraState('unavailable');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((tr) => tr.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setCameraState('active');

        const winWithDetector = window as unknown as {
          BarcodeDetector?: new (opts: { formats: string[] }) => BarcodeDetectorLike;
        };
        const detector =
          typeof winWithDetector.BarcodeDetector === 'function'
            ? new winWithDetector.BarcodeDetector({ formats: ['qr_code'] })
            : null;

        const scanFrame = async () => {
          if (cancelled || !videoRef.current || !streamRef.current) return;
          const video = videoRef.current;
          if (video.readyState >= 2 && video.videoWidth > 0 && !busyScanRef.current) {
            try {
              if (detector) {
                const codes = await detector.detect(video);
                const hit = codes.find((c) => c.rawValue)?.rawValue;
                if (hit) {
                  void handleDecodedCode(hit);
                }
              }
              if (!busyScanRef.current && canvasRef.current) {
                const canvas = canvasRef.current;
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                if (ctx) {
                  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                  const decoded = jsQR(imageData.data, imageData.width, imageData.height, {
                    inversionAttempts: 'dontInvert',
                  });
                  if (decoded?.data) {
                    void handleDecodedCode(decoded.data);
                  }
                }
              }
            } catch {
              // ignore transient frame decode errors
            }
          }
          if (!cancelled) {
            rafTimer = window.setTimeout(() => {
              void scanFrame();
            }, 220);
          }
        };

        rafTimer = window.setTimeout(() => {
          void scanFrame();
        }, 250);
      } catch {
        if (!cancelled) setCameraState('unavailable');
      }
    };

    void startCamera();

    return () => {
      cancelled = true;
      if (rafTimer !== null) clearTimeout(rafTimer);
      stopCamera();
    };
  }, [isOpen, soldReceipt, handleDecodedCode, stopCamera]);

  if (!isOpen) return null;

  const handleUploadQrPhoto = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setErrorMsg('');
    setProcessing(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('read error'));
        reader.readAsDataURL(file);
      });
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('img error'));
        img.src = dataUrl;
      });
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('no canvas');
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const decoded = jsQR(imageData.data, imageData.width, imageData.height);
      if (!decoded?.data) {
        setErrorMsg(t.qrScannerNotFound);
        return;
      }
      await handleDecodedCode(decoded.data);
    } catch {
      setErrorMsg(t.qrScannerNotFound);
    } finally {
      setProcessing(false);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    void handleDecodedCode(manualInput.trim());
  };

  return (
    <div
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/65 p-0 backdrop-blur-xs sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[94vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-[#DCE7E0] bg-white shadow-2xl sm:rounded-3xl dark:border-[#1E3A2D] dark:bg-[#0F2119]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2 border-b border-[#DCE7E0] px-5 py-4 dark:border-[#1E3A2D]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#ECF7F1] text-[#115E3B] dark:bg-[#132B20] dark:text-[#34D399]">
              <QrCode className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate font-display text-lg font-bold text-[#0B1F16] dark:text-[#F2F9F5]">
                {t.qrScanTitle}
              </h2>
              <p className="truncate text-xs text-[#335947] dark:text-[#9EC0AE]">
                {t.qrScanSubtitle}
              </p>
            </div>
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

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {/* Two Scan Options Selector */}
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[#335947] dark:text-[#9EC0AE]">
              {t.qrModeLabel}
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => {
                  setScanMode('view');
                  setSoldReceipt(null);
                  setErrorMsg('');
                }}
                className={`flex flex-col items-start gap-1 rounded-2xl border p-3.5 text-start transition-colors ${
                  scanMode === 'view'
                    ? 'border-[#115E3B] bg-[#ECF7F1] text-[#0B1F16] dark:border-[#10B981] dark:bg-[#132B20] dark:text-[#F2F9F5]'
                    : 'border-[#DCE7E0] bg-[#F7FAF8] text-[#335947] hover:border-[#115E3B]/40 dark:border-[#1E3A2D] dark:bg-[#091611] dark:text-[#9EC0AE]'
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-xs sm:text-sm">
                  <Eye className="h-4 w-4 text-[#115E3B] dark:text-[#34D399]" />
                  <span>{t.qrModeViewTitle}</span>
                </div>
                <span className="text-[11px] leading-snug opacity-85">{t.qrModeViewDesc}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setScanMode('sell');
                  setErrorMsg('');
                }}
                className={`flex flex-col items-start gap-1 rounded-2xl border p-3.5 text-start transition-colors ${
                  scanMode === 'sell'
                    ? 'border-amber-600 bg-amber-50 text-[#0B1F16] dark:border-amber-500 dark:bg-amber-950/40 dark:text-[#F2F9F5]'
                    : 'border-[#DCE7E0] bg-[#F7FAF8] text-[#335947] hover:border-amber-600/40 dark:border-[#1E3A2D] dark:bg-[#091611] dark:text-[#9EC0AE]'
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-xs sm:text-sm">
                  <ShoppingBag className="h-4 w-4 text-amber-700 dark:text-amber-300" />
                  <span>{t.qrModeSellTitle}</span>
                </div>
                <span className="text-[11px] leading-snug opacity-85">{t.qrModeSellDesc}</span>
              </button>
            </div>
          </div>

          {errorMsg && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
              {errorMsg}
            </div>
          )}

          {soldReceipt ? (
            /* Instant POS Sale Receipt Confirmation */
            <div className="space-y-4 rounded-2xl border border-[#10B981]/40 bg-[#ECF7F1]/70 p-4 dark:border-[#10B981]/30 dark:bg-[#132B20]/60">
              <div className="flex items-center gap-2.5 text-[#115E3B] dark:text-[#34D399]">
                <CheckCircle2 className="h-5 w-5 shrink-0" />
                <div>
                  <p className="text-sm font-bold">{t.posSoldReceiptBadge}</p>
                  <p className="text-xs opacity-90">
                    {t.qrScannerSoldSuccess} {soldReceipt.invoice.invoiceNumber}
                  </p>
                </div>
              </div>

              <div className="space-y-2 rounded-xl border border-[#DCE7E0] bg-white p-3.5 text-xs dark:border-[#1E3A2D] dark:bg-[#091611]">
                <div className="flex items-center justify-between">
                  <span className="text-[#335947] dark:text-[#9EC0AE]">{t.posInvoiceNumber}</span>
                  <span className="font-mono-code font-bold text-[#115E3B] dark:text-[#34D399]">
                    {soldReceipt.invoice.invoiceNumber}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#335947] dark:text-[#9EC0AE]">{t.digitalSerialCode}</span>
                  <span className="font-mono-code font-semibold">
                    {soldReceipt.invoice.productCode}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[#335947] dark:text-[#9EC0AE]">{t.purchaseProductNameLabel}</span>
                  <span className="truncate font-semibold">{soldReceipt.invoice.productName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#335947] dark:text-[#9EC0AE]">{t.purchaseTotalLabel}</span>
                  <span className="tabular-nums text-sm font-bold text-[#115E3B] dark:text-[#34D399]">
                    {formatCurrency(soldReceipt.invoice.totalPrice, currency, lang)}
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-[#DCE7E0] pt-2 dark:border-[#1E3A2D]">
                  <span className="text-[#335947] dark:text-[#9EC0AE]">{t.posRemainingStock}</span>
                  <span className="tabular-nums font-bold">
                    {formatNumber(soldReceipt.digitalFile.product.quantity, lang)} {t.articlesUnit}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={async () => {
                    const blob = await buildInvoiceReceiptBlob(
                      soldReceipt.invoice,
                      storeName,
                      currency,
                      lang
                    );
                    await saveOrShareBlob(
                      blob,
                      `${soldReceipt.invoice.invoiceNumber.toLowerCase()}.png`,
                      soldReceipt.invoice.invoiceNumber
                    );
                  }}
                  className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-[#115E3B] px-3 text-xs font-semibold text-white dark:bg-[#10B981] dark:text-[#052E1C]"
                >
                  <Download className="h-4 w-4" />
                  <span>{t.posDownloadReceipt}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const file = soldReceipt.digitalFile;
                    onClose();
                    onOpenDigitalFile(file, 'management');
                  }}
                  className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-[#DCE7E0] bg-white px-3 text-xs font-semibold text-[#0B1F16] dark:border-[#1E3A2D] dark:bg-[#102119] dark:text-[#F2F9F5]"
                >
                  <FileText className="h-4 w-4" />
                  <span>{t.digitalTabManagement}</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setSoldReceipt(null)}
                className="min-h-[44px] w-full rounded-xl border border-[#DCE7E0] bg-white text-xs font-semibold text-[#115E3B] hover:bg-[#ECF7F1] dark:border-[#1E3A2D] dark:bg-[#091611] dark:text-[#34D399]"
              >
                {t.qrScanButtonLabel}
              </button>
            </div>
          ) : (
            <>
              {/* Camera Preview */}
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-[#DCE7E0] bg-[#0B1F16] dark:border-[#1E3A2D]">
                <video
                  ref={videoRef}
                  muted
                  playsInline
                  className={`h-full w-full object-cover ${
                    cameraState === 'active' ? 'opacity-100' : 'opacity-0'
                  }`}
                />
                <canvas ref={canvasRef} className="hidden" />

                {cameraState === 'active' && (
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center p-4">
                    <div className="h-44 w-44 rounded-2xl border-2 border-[#34D399] shadow-[0_0_0_9999px_rgba(0,0,0,0.38)]" />
                    <span className="mt-3 rounded-lg bg-black/70 px-3 py-1 text-xs font-medium text-white">
                      {processing ? t.qrScannerDecoding : t.qrScannerCameraHint}
                    </span>
                  </div>
                )}

                {cameraState === 'starting' && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-5 text-center text-white">
                    <Camera className="h-8 w-8 animate-pulse opacity-75" />
                    <p className="text-xs font-medium">{t.qrScannerCameraStarting}</p>
                  </div>
                )}

                {cameraState === 'unavailable' && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#F7FAF8] p-5 text-center dark:bg-[#091611]">
                    <Camera className="h-8 w-8 text-[#115E3B]/55 dark:text-[#34D399]/55" />
                    <p className="max-w-xs text-xs leading-relaxed text-[#335947] dark:text-[#9EC0AE]">
                      {t.qrScannerCameraUnavailable}
                    </p>
                  </div>
                )}
              </div>

              {/* Upload QR Photo + Manual Code Input */}
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={processing}
                  className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl border border-[#DCE7E0] bg-[#ECF7F1] px-4 text-xs font-semibold text-[#115E3B] hover:bg-[#DCF0E4] disabled:opacity-60 dark:border-[#1E3A2D] dark:bg-[#132B20] dark:text-[#34D399]"
                >
                  <ImagePlus className="h-4 w-4" />
                  <span>{t.qrScannerUploadImage}</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    void handleUploadQrPhoto(e.target.files);
                    e.target.value = '';
                  }}
                />

                <form onSubmit={handleManualSubmit} className="space-y-1.5">
                  <label className="block text-xs font-semibold text-[#335947] dark:text-[#9EC0AE]">
                    {t.qrScannerManualLabel}
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search
                        className={`pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B8A79] ${
                          lang === 'ar' ? 'right-3' : 'left-3'
                        }`}
                      />
                      <input
                        type="text"
                        value={manualInput}
                        onChange={(e) => setManualInput(e.target.value)}
                        placeholder={t.qrScannerManualPlaceholder}
                        className={`min-h-[44px] w-full rounded-xl border border-[#DCE7E0] bg-[#F7FAF8] py-2 text-sm text-[#0B1F16] placeholder:text-[#6B8A79] focus:border-[#115E3B] focus:bg-white focus:outline-none dark:border-[#1E3A2D] dark:bg-[#091611] dark:text-[#F2F9F5] ${
                          lang === 'ar' ? 'pl-3 pr-9' : 'pl-9 pr-3'
                        }`}
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={processing || !manualInput.trim()}
                      className="min-h-[44px] rounded-xl bg-[#115E3B] px-4 text-xs font-bold text-white hover:bg-[#0D4A2E] disabled:opacity-50 whitespace-nowrap shrink-0 dark:bg-[#10B981] dark:text-[#052E1C]"
                    >
                      {t.qrScannerManualSubmit}
                    </button>
                  </div>
                </form>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
