import { useCallback, useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import {
  Camera,
  Check,
  CheckCircle2,
  Download,
  Eye,
  FileText,
  ImagePlus,
  Minus,
  Plus,
  Printer,
  QrCode,
  RefreshCw,
  Search,
  ShoppingBag,
  Trash2,
  UserCheck,
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
import { buildInvoiceReceiptBlob } from '../utils/qr';
import { saveOrShareBlob } from '../utils/download';

export type QrScanMode = 'view' | 'sell' | 'pos_pick';

interface QrScannerModalProps {
  isOpen: boolean;
  lang: Language;
  currency: string;
  storeName?: string;
  initialMode?: QrScanMode;
  clientOnly?: boolean;
  customers?: Customer[];
  lockedCustomer?: Customer | null;
  onClose: () => void;
  onLookupQr: (qrInput: string, logScan: boolean) => Promise<ProductDigitalFile>;
  onExecuteQrSale: (payload: PosSalePayload) => Promise<{
    invoice: PosInvoice;
    digitalFile: ProductDigitalFile;
  }>;
  onPickProductForPos?: (digitalFile: ProductDigitalFile) => void;
  onPrintInvoice?: (invoice: PosInvoice, isCopy: boolean) => Promise<void>;
  onOpenDigitalFile: (digitalFile: ProductDigitalFile, view: 'client' | 'management') => void;
}

interface QrCartItem {
  product: Product;
  quantity: number;
  unitPriceDisplay: number;
}

interface BarcodeDetectorLike {
  detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>;
}

const PAYMENT_METHODS: PurchasePaymentMethod[] = ['cash', 'transfer', 'check', 'card', 'other'];

async function getCameraStreamWithFallback(): Promise<MediaStream> {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error('NO_MEDIA_DEVICES');
  }
  const constraintsList: MediaStreamConstraints[] = [
    {
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    },
    { video: { facingMode: 'environment' }, audio: false },
    { video: true, audio: false },
  ];

  let lastErr: unknown;
  for (const constraints of constraintsList) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('CAMERA_FAILED');
}

function decodeCanvasPass(canvas: HTMLCanvasElement): string {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return '';
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  const direct = jsQR(imageData.data, imageData.width, imageData.height, {
    inversionAttempts: 'attemptBoth',
  });
  if (direct?.data) return direct.data;

  const buf = new Uint8ClampedArray(imageData.data.length);
  const src = imageData.data;
  let minL = 255;
  let maxL = 0;
  for (let i = 0; i < src.length; i += 4) {
    const lum = (src[i] * 77 + src[i + 1] * 150 + src[i + 2] * 29) >> 8;
    if (lum < minL) minL = lum;
    if (lum > maxL) maxL = lum;
  }
  const span = Math.max(1, maxL - minL);
  const mid = (minL + maxL) >> 1;
  for (let i = 0; i < src.length; i += 4) {
    const lum = (src[i] * 77 + src[i + 1] * 150 + src[i + 2] * 29) >> 8;
    const norm = ((lum - minL) * 255) / span;
    const v = norm > (mid - minL) * (255 / span) ? 255 : 0;
    buf[i] = v;
    buf[i + 1] = v;
    buf[i + 2] = v;
    buf[i + 3] = 255;
  }
  const boosted = jsQR(buf, imageData.width, imageData.height, {
    inversionAttempts: 'attemptBoth',
  });
  return boosted?.data || '';
}

async function decodeQrFromImageElement(img: HTMLImageElement): Promise<string> {
  const winWithDetector = window as unknown as {
    BarcodeDetector?: new (opts: { formats: string[] }) => BarcodeDetectorLike;
  };
  if (typeof winWithDetector.BarcodeDetector === 'function') {
    try {
      const detector = new winWithDetector.BarcodeDetector({ formats: ['qr_code'] });
      const codes = await detector.detect(img);
      const hit = codes.find((c) => c.rawValue)?.rawValue || '';
      if (hit) return hit;
    } catch {
      // fallback to jsQR passes below
    }
  }

  const natW = img.naturalWidth || img.width;
  const natH = img.naturalHeight || img.height;
  if (!natW || !natH) return '';

  const crops = [
    { ratio: 1, label: 'full' },
    { ratio: 0.65, label: 'center-65' },
    { ratio: 0.42, label: 'center-42' },
  ];
  const targets = [1600, 1000, 640];

  for (const crop of crops) {
    const sx = Math.round(((1 - crop.ratio) / 2) * natW);
    const sy = Math.round(((1 - crop.ratio) / 2) * natH);
    const sw = Math.max(1, Math.round(natW * crop.ratio));
    const sh = Math.max(1, Math.round(natH * crop.ratio));
    const maxCropSide = Math.max(sw, sh);

    for (const maxTarget of targets) {
      const scale = maxCropSide > maxTarget ? maxTarget / maxCropSide : 1;
      const w = Math.max(1, Math.round(sw * scale));
      const h = Math.max(1, Math.round(sh * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) continue;
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
      const hit = decodeCanvasPass(canvas);
      if (hit) return hit;
    }
  }

  return '';
}

export function QrScannerModal({
  isOpen,
  lang,
  currency,
  storeName = '',
  initialMode = 'view',
  clientOnly = false,
  customers = [],
  lockedCustomer = null,
  onClose,
  onLookupQr,
  onExecuteQrSale,
  onPickProductForPos,
  onPrintInvoice,
  onOpenDigitalFile,
}: QrScannerModalProps) {
  const t = translations[lang];
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const nativeCamInputRef = useRef<HTMLInputElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanLoopTimerRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  const busyScanRef = useRef(false);

  const [scanMode, setScanMode] = useState<QrScanMode>(clientOnly ? 'view' : initialMode);
  const [cameraState, setCameraState] = useState<
    'starting' | 'active' | 'needs_tap' | 'unavailable'
  >('starting');
  const [manualInput, setManualInput] = useState('');
  const [processing, setProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [noticeMsg, setNoticeMsg] = useState('');

  // Pending sale details state + multi-product QR invoice cart
  const [pendingSaleFile, setPendingSaleFile] = useState<ProductDigitalFile | null>(null);
  const [qrCart, setQrCart] = useState<QrCartItem[]>([]);
  const [saleQuantity, setSaleQuantity] = useState('1');
  const [saleUnitPrice, setSaleUnitPrice] = useState('');
  const [salePaymentMethod, setSalePaymentMethod] = useState<PurchasePaymentMethod>('cash');
  const [saleCustomerId, setSaleCustomerId] = useState('');
  const [saleCustomerName, setSaleCustomerName] = useState('');
  const [saleCustomerPhone, setSaleCustomerPhone] = useState('');
  const [saleNotes, setSaleNotes] = useState('');
  const [saleSubmitting, setSaleSubmitting] = useState(false);

  const [soldReceipt, setSoldReceipt] = useState<{
    invoice: PosInvoice;
    digitalFile: ProductDigitalFile;
  } | null>(null);

  const stopCamera = useCallback(() => {
    if (scanLoopTimerRef.current !== null) {
      clearTimeout(scanLoopTimerRef.current);
      scanLoopTimerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const populateSaleDraft = useCallback(
    (digitalFile: ProductDigitalFile) => {
      setPendingSaleFile(digitalFile);
      setSaleQuantity('1');
      setSaleUnitPrice(String(convertFromMad(digitalFile.product.sellingPrice, currency)));
      setNoticeMsg('');
    },
    [currency]
  );

  const handleDecodedCode = useCallback(
    async (rawCode: string) => {
      const clean = rawCode.trim();
      if (!clean || busyScanRef.current) return;
      busyScanRef.current = true;
      setProcessing(true);
      setErrorMsg('');
      setNoticeMsg('');
      try {
        if (clientOnly || scanMode === 'view') {
          const digitalFile = await onLookupQr(clean, true);
          stopCamera();
          onClose();
          onOpenDigitalFile(digitalFile, clientOnly ? 'client' : 'management');
        } else if (scanMode === 'pos_pick') {
          const digitalFile = await onLookupQr(clean, false);
          if ((Number(digitalFile.product.quantity) || 0) <= 0) {
            setErrorMsg(t.qrScannerOutOfStock);
            return;
          }
          onPickProductForPos?.(digitalFile);
          setManualInput('');
          setNoticeMsg(
            `${t.posQrUpdatedQtyToast} ${digitalFile.product.code} — ${digitalFile.product.name}`
          );
        } else {
          const digitalFile = await onLookupQr(clean, false);
          if ((Number(digitalFile.product.quantity) || 0) <= 0) {
            setErrorMsg(t.qrScannerOutOfStock);
            return;
          }
          stopCamera();
          populateSaleDraft(digitalFile);
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
      clientOnly,
      scanMode,
      onLookupQr,
      onPickProductForPos,
      populateSaleDraft,
      onClose,
      onOpenDigitalFile,
      stopCamera,
      t.posQrUpdatedQtyToast,
      t.qrScannerNotFound,
      t.qrScannerOutOfStock,
    ]
  );

  const beginLiveCamera = useCallback(
    async (fromUserTap = false) => {
      stopCamera();
      setCameraState('starting');

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        if (mountedRef.current) setCameraState('unavailable');
        return;
      }

      try {
        const stream = await getCameraStreamWithFallback();
        if (!mountedRef.current || !isOpen) {
          stream.getTracks().forEach((tr) => tr.stop());
          return;
        }
        streamRef.current = stream;

        const video = videoRef.current;
        if (video) {
          video.setAttribute('playsinline', '');
          video.setAttribute('webkit-playsinline', '');
          video.setAttribute('muted', '');
          video.defaultMuted = true;
          video.muted = true;
          video.autoplay = true;
          video.srcObject = stream;

          if (video.readyState < 1) {
            await new Promise<void>((resolve) => {
              const onMeta = () => {
                video.removeEventListener('loadedmetadata', onMeta);
                resolve();
              };
              video.addEventListener('loadedmetadata', onMeta);
              setTimeout(resolve, 1200);
            });
          }

          try {
            await video.play();
            if (video.paused && !fromUserTap && mountedRef.current) {
              setCameraState('needs_tap');
              return;
            }
          } catch {
            if (!fromUserTap && mountedRef.current) {
              setCameraState('needs_tap');
              return;
            }
          }
        }

        if (!mountedRef.current) return;
        setCameraState('active');

        const winWithDetector = window as unknown as {
          BarcodeDetector?: new (opts: { formats: string[] }) => BarcodeDetectorLike;
        };
        const detector =
          typeof winWithDetector.BarcodeDetector === 'function'
            ? new winWithDetector.BarcodeDetector({ formats: ['qr_code'] })
            : null;

        const scanFrame = async () => {
          if (!mountedRef.current || !videoRef.current || !streamRef.current) return;
          const v = videoRef.current;
          if (v.readyState >= 2 && v.videoWidth > 0 && v.videoHeight > 0 && !busyScanRef.current) {
            try {
              if (detector) {
                const codes = await detector.detect(v);
                const hit = codes.find((c) => c.rawValue)?.rawValue;
                if (hit) {
                  void handleDecodedCode(hit);
                }
              }
              if (!busyScanRef.current && canvasRef.current) {
                const canvas = canvasRef.current;
                const scale = Math.min(1, 960 / Math.max(v.videoWidth, v.videoHeight));
                canvas.width = Math.max(1, Math.round(v.videoWidth * scale));
                canvas.height = Math.max(1, Math.round(v.videoHeight * scale));
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                if (ctx) {
                  ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
                  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                  const decoded = jsQR(imageData.data, imageData.width, imageData.height, {
                    inversionAttempts: 'attemptBoth',
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
          if (mountedRef.current && streamRef.current) {
            scanLoopTimerRef.current = window.setTimeout(() => {
              void scanFrame();
            }, 220);
          }
        };

        scanLoopTimerRef.current = window.setTimeout(() => {
          void scanFrame();
        }, 250);
      } catch (err) {
        if (!mountedRef.current) return;
        const name = err instanceof Error ? err.name : '';
        if (!fromUserTap && (name === 'NotAllowedError' || name === 'AbortError')) {
          setCameraState('needs_tap');
        } else {
          setCameraState('unavailable');
        }
      }
    },
    [handleDecodedCode, isOpen, stopCamera]
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopCamera();
    };
  }, [stopCamera]);

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      return;
    }
    setScanMode(clientOnly ? 'view' : initialMode);
    setPendingSaleFile(null);
    setQrCart([]);
    setSoldReceipt(null);
    setErrorMsg('');
    setNoticeMsg('');
    setManualInput('');
    setSalePaymentMethod('cash');
    setSaleNotes('');
    setSaleCustomerId(lockedCustomer?.id || '');
    setSaleCustomerName(lockedCustomer?.name || '');
    setSaleCustomerPhone(lockedCustomer?.phone || '');
    busyScanRef.current = false;
  }, [isOpen, initialMode, clientOnly, lockedCustomer, stopCamera]);

  useEffect(() => {
    if (!isOpen || soldReceipt || pendingSaleFile) {
      stopCamera();
      return;
    }
    void beginLiveCamera(false);
    return () => {
      stopCamera();
    };
  }, [isOpen, soldReceipt, pendingSaleFile, beginLiveCamera, stopCamera]);

  if (!isOpen) return null;

  const paymentLabel = (pm: PurchasePaymentMethod) => {
    if (pm === 'transfer') return t.paymentTransfer;
    if (pm === 'check') return t.paymentCheck;
    if (pm === 'card') return t.paymentCard;
    if (pm === 'other') return t.paymentOther;
    return t.paymentCash;
  };

  const handleSelectCustomer = (custId: string) => {
    setSaleCustomerId(custId);
    if (!custId) return;
    const found = customers.find((c) => c.id === custId);
    if (found) {
      setSaleCustomerName(found.name);
      setSaleCustomerPhone(found.phone);
    }
  };

  const handleAddPendingToQrCart = () => {
    if (!pendingSaleFile) return;
    const prod = pendingSaleFile.product;
    const maxStock = Math.max(1, Number(prod.quantity) || 1);
    const qtyNum = Math.min(maxStock, Math.max(1, Math.floor(Number(saleQuantity) || 1)));
    const priceDisplay = Math.max(0, Number(saleUnitPrice) || 0);

    setQrCart((prev) => {
      const idx = prev.findIndex((item) => item.product.id === prod.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = {
          product: prod,
          quantity: Math.min(maxStock, next[idx].quantity + qtyNum),
          unitPriceDisplay: priceDisplay,
        };
        return next;
      }
      return [...prev, { product: prod, quantity: qtyNum, unitPriceDisplay: priceDisplay }];
    });

    setNoticeMsg(`${t.qrCartAddedToast} ${prod.code} — ${prod.name}`);
    setPendingSaleFile(null);
    setManualInput('');
  };

  const executeInvoiceItems = async (itemsToSell: QrCartItem[]) => {
    if (itemsToSell.length === 0 || saleSubmitting) return;
    setSaleSubmitting(true);
    setErrorMsg('');
    try {
      const payloadItems = itemsToSell.map((item) => ({
        productId: item.product.id,
        quantity: item.quantity,
        unitPrice: convertToMad(item.unitPriceDisplay, currency),
      }));
      const result = await onExecuteQrSale({
        items: payloadItems,
        productId: payloadItems[0].productId,
        quantity: payloadItems[0].quantity,
        unitPrice: payloadItems[0].unitPrice,
        customerId: saleCustomerId.trim(),
        customerName: saleCustomerName.trim(),
        customerPhone: saleCustomerPhone.trim(),
        paymentMethod: salePaymentMethod,
        notes: saleNotes.trim(),
        source: 'qr_scan',
      });
      setPendingSaleFile(null);
      setQrCart([]);
      setNoticeMsg('');
      setSoldReceipt(result);
    } catch (err) {
      if (err instanceof Error && err.message === 'OUT_OF_STOCK') {
        setErrorMsg(t.qrScannerOutOfStock);
      } else {
        setErrorMsg(t.errorSave);
      }
    } finally {
      setSaleSubmitting(false);
    }
  };

  const handleConfirmPendingSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingSaleFile) return;
    const prod = pendingSaleFile.product;
    const maxStock = Math.max(1, Number(prod.quantity) || 1);
    const qtyNum = Math.min(maxStock, Math.max(1, Math.floor(Number(saleQuantity) || 1)));
    const priceDisplay = Math.max(0, Number(saleUnitPrice) || 0);

    // Merge with existing qrCart items if any
    const combined = [...qrCart];
    const existingIdx = combined.findIndex((i) => i.product.id === prod.id);
    if (existingIdx >= 0) {
      combined[existingIdx] = {
        product: prod,
        quantity: Math.min(maxStock, combined[existingIdx].quantity + qtyNum),
        unitPriceDisplay: priceDisplay,
      };
    } else {
      combined.push({ product: prod, quantity: qtyNum, unitPriceDisplay: priceDisplay });
    }

    await executeInvoiceItems(combined);
  };

  const handleUploadQrPhoto = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setErrorMsg('');
    setProcessing(true);
    const objectUrl = URL.createObjectURL(file);
    try {
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('img error'));
        img.src = objectUrl;
      });

      const decodedText = await decodeQrFromImageElement(img);
      if (!decodedText) {
        setErrorMsg(t.qrScannerNotFound);
        return;
      }
      await handleDecodedCode(decodedText);
    } catch {
      setErrorMsg(t.qrScannerNotFound);
    } finally {
      URL.revokeObjectURL(objectUrl);
      setProcessing(false);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    void handleDecodedCode(manualInput.trim());
  };

  const maxStockForPending = pendingSaleFile
    ? Math.max(1, Number(pendingSaleFile.product.quantity) || 1)
    : 1;
  const clampedSaleQty = Math.min(
    maxStockForPending,
    Math.max(1, Math.floor(Number(saleQuantity) || 1))
  );
  const liveSaleTotalMad =
    clampedSaleQty * convertToMad(Math.max(0, Number(saleUnitPrice) || 0), currency);

  const qrCartTotalDisplay = qrCart.reduce(
    (sum, item) => sum + item.quantity * item.unitPriceDisplay,
    0
  );

  const inputClass =
    'min-h-[42px] w-full rounded-xl border border-[#DCE7E0] bg-white px-3 text-xs text-[#0B1F16] placeholder:text-[#6B8A79] focus:border-[#115E3B] focus:outline-none dark:border-[#1E3A2D] dark:bg-[#091611] dark:text-[#F2F9F5] dark:placeholder:text-[#8FB39E] dark:focus:border-[#10B981] dark:focus:bg-[#0D1E16]';

  const receiptItems =
    soldReceipt?.invoice.items && soldReceipt.invoice.items.length > 0
      ? soldReceipt.invoice.items
      : soldReceipt
      ? [
          {
            productId: soldReceipt.invoice.productId,
            productCode: soldReceipt.invoice.productCode,
            productName: soldReceipt.invoice.productName,
            quantity: soldReceipt.invoice.quantity,
            unitPrice: soldReceipt.invoice.unitPrice,
            totalPrice: soldReceipt.invoice.totalPrice,
            purchasePrice: soldReceipt.invoice.purchasePrice,
          },
        ]
      : [];

  return (
    <div
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/65 p-0 backdrop-blur-xs sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[94dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-[#DCE7E0] bg-white shadow-2xl sm:rounded-3xl dark:border-[#1E3A2D] dark:bg-[#0F2119]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2 border-b border-[#DCE7E0] px-5 py-4 dark:border-[#1E3A2D]">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#ECF7F1] text-[#115E3B] dark:bg-[#132B20] dark:text-[#34D399]">
              <QrCode className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate font-display text-lg font-bold text-[#0B1F16] dark:text-[#F2F9F5]">
                {t.qrScanTitle}
              </h2>
              <p className="truncate text-xs text-[#335947] dark:text-[#9EC0AE]">
                {clientOnly ? t.qrScannerClientHint : t.qrScanSubtitle}
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
          {/* Locked Customer Banner */}
          {!clientOnly && lockedCustomer && (
            <div className="flex items-center justify-between gap-2 rounded-2xl border border-[#115E3B]/35 bg-[#ECF7F1]/80 px-3.5 py-2.5 text-xs dark:border-[#10B981]/30 dark:bg-[#132B20]/70">
              <div className="flex min-w-0 items-center gap-2">
                <UserCheck className="h-4 w-4 shrink-0 text-[#115E3B] dark:text-[#34D399]" />
                <div className="min-w-0">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-[#335947] dark:text-[#9EC0AE]">
                    {t.qrSaleLockedCustomerLabel}
                  </span>
                  <span className="truncate font-bold text-[#0B1F16] dark:text-[#F2F9F5]">
                    {lockedCustomer.code} · {lockedCustomer.name}
                    {lockedCustomer.phone ? ` (${lockedCustomer.phone})` : ''}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Two Scan Options Selector (hidden in clientOnly or pos_pick mode) */}
          {!clientOnly && scanMode === 'pos_pick' ? (
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#115E3B]/30 bg-[#ECF7F1] px-4 py-3 text-xs text-[#0B1F16] dark:border-[#10B981]/30 dark:bg-[#132B20] dark:text-[#F2F9F5]">
              <div className="flex min-w-0 items-center gap-2.5">
                <QrCode className="h-4 w-4 shrink-0 text-[#115E3B] dark:text-[#34D399]" />
                <span className="leading-snug font-medium">{t.posQrAddHint}</span>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="min-h-[36px] shrink-0 whitespace-nowrap rounded-xl bg-[#115E3B] px-3 text-xs font-bold text-white hover:bg-[#0D4A2E] dark:bg-[#10B981] dark:text-[#052E1C]"
              >
                {t.posQrPickDone}
              </button>
            </div>
          ) : !clientOnly ? (
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[#335947] dark:text-[#9EC0AE]">
                {t.qrModeLabel}
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => {
                    setScanMode('view');
                    setPendingSaleFile(null);
                    setSoldReceipt(null);
                    setErrorMsg('');
                  }}
                  className={`flex flex-col items-start gap-1 rounded-2xl border p-3.5 text-start transition-colors ${
                    scanMode === 'view'
                      ? 'border-[#115E3B] bg-[#ECF7F1] text-[#0B1F16] dark:border-[#10B981] dark:bg-[#132B20] dark:text-[#F2F9F5]'
                      : 'border-[#DCE7E0] bg-[#F7FAF8] text-[#335947] hover:border-[#115E3B]/40 dark:border-[#1E3A2D] dark:bg-[#091611] dark:text-[#9EC0AE]'
                  }`}
                >
                  <div className="flex items-center gap-2 text-xs font-bold sm:text-sm">
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
                  <div className="flex items-center gap-2 text-xs font-bold sm:text-sm">
                    <ShoppingBag className="h-4 w-4 text-amber-700 dark:text-amber-300" />
                    <span>{t.qrModeSellTitle}</span>
                  </div>
                  <span className="text-[11px] leading-snug opacity-85">{t.qrModeSellDesc}</span>
                </button>
              </div>
            </div>
          ) : null}

          {noticeMsg && (
            <div className="rounded-xl border border-[#10B981]/40 bg-[#ECF7F1] px-4 py-2.5 text-xs font-semibold text-[#115E3B] dark:bg-[#132B20] dark:text-[#34D399]">
              {noticeMsg}
            </div>
          )}

          {errorMsg && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
              {errorMsg}
            </div>
          )}

          {/* Queued Multi-Product QR Invoice Cart (when scanning multiple QR items in Sell mode) */}
          {!clientOnly && scanMode === 'sell' && qrCart.length > 0 && !pendingSaleFile && !soldReceipt && (
            <div className="space-y-3 rounded-2xl border border-[#115E3B]/35 bg-[#ECF7F1]/70 p-4 dark:border-[#10B981]/30 dark:bg-[#132B20]/60">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold text-[#0B1F16] dark:text-[#F2F9F5]">
                  {t.qrInvoiceCartLabel} ({formatNumber(qrCart.length, lang)})
                </p>
                <button
                  type="button"
                  onClick={() => setQrCart([])}
                  className="text-[11px] font-semibold text-red-600 hover:underline dark:text-red-400"
                >
                  {t.qrCartClear}
                </button>
              </div>

              <div className="space-y-1.5">
                {qrCart.map((item) => (
                  <div
                    key={item.product.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-[#DCE7E0] bg-white px-3 py-2 text-xs dark:border-[#1E3A2D] dark:bg-[#091611]"
                  >
                    <div className="min-w-0 flex-1">
                      <span className="font-mono-code font-bold text-[#115E3B] dark:text-[#34D399]">
                        {item.product.code}
                      </span>{' '}
                      <span className="font-semibold text-[#0B1F16] dark:text-[#F2F9F5]">
                        {item.product.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="tabular-nums text-[11px] text-[#335947] dark:text-[#9EC0AE]">
                        {formatNumber(item.quantity, lang)} × {formatNumber(item.unitPriceDisplay, lang)} {currency}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setQrCart((prev) => prev.filter((x) => x.product.id !== item.product.id))
                        }
                        aria-label={t.posCartRemoveItem}
                        className="text-red-600 dark:text-red-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <select
                  value={salePaymentMethod}
                  onChange={(e) => setSalePaymentMethod(e.target.value as PurchasePaymentMethod)}
                  className={inputClass}
                >
                  {PAYMENT_METHODS.map((pm) => (
                    <option key={pm} value={pm}>
                      {paymentLabel(pm)}
                    </option>
                  ))}
                </select>
                {!lockedCustomer && customers.length > 0 && (
                  <select
                    value={saleCustomerId}
                    onChange={(e) => handleSelectCustomer(e.target.value)}
                    className={inputClass}
                  >
                    <option value="">{t.posWalkInCustomer}</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code} — {c.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <button
                type="button"
                disabled={saleSubmitting}
                onClick={() => void executeInvoiceItems(qrCart)}
                className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[#115E3B] px-4 text-xs font-bold text-white hover:bg-[#0D4A2E] disabled:opacity-60 dark:bg-[#10B981] dark:text-[#052E1C]"
              >
                <Check className="h-4 w-4" />
                <span>
                  {t.qrCheckoutCartButton} ({formatNumber(qrCartTotalDisplay, lang)} {currency})
                </span>
              </button>
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

                <div className="space-y-1 border-y border-[#DCE7E0] py-2 dark:border-[#1E3A2D]">
                  {receiptItems.map((li, idx) => (
                    <div key={`${li.productId}-${idx}`} className="flex items-center justify-between gap-2">
                      <span className="truncate font-semibold">
                        <span className="font-mono-code text-[#115E3B] dark:text-[#34D399]">
                          {li.productCode}
                        </span>{' '}
                        {li.productName}
                      </span>
                      <span className="tabular-nums shrink-0 text-[#335947] dark:text-[#9EC0AE]">
                        {formatNumber(li.quantity, lang)} × {formatCurrency(li.unitPrice, currency, lang)}
                      </span>
                    </div>
                  ))}
                </div>

                {soldReceipt.invoice.customerName && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[#335947] dark:text-[#9EC0AE]">{t.posCustomerLabel}</span>
                    <span className="truncate font-semibold">
                      {soldReceipt.invoice.customerName}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-[#335947] dark:text-[#9EC0AE]">{t.purchasePaymentLabel}</span>
                  <span className="font-semibold">
                    {paymentLabel(soldReceipt.invoice.paymentMethod)}
                  </span>
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

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {onPrintInvoice && (
                  <button
                    type="button"
                    onClick={() => void onPrintInvoice(soldReceipt.invoice, false)}
                    className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl bg-[#115E3B] px-3 text-xs font-semibold text-white dark:bg-[#10B981] dark:text-[#052E1C]"
                  >
                    <Printer className="h-4 w-4" />
                    <span>{t.posPrintInvoice}</span>
                  </button>
                )}

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
                  className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-[#DCE7E0] bg-white px-3 text-xs font-semibold text-[#115E3B] dark:border-[#1E3A2D] dark:bg-[#102119] dark:text-[#34D399]"
                >
                  <Download className="h-4 w-4" />
                  <span>PNG</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const file = soldReceipt.digitalFile;
                    onClose();
                    onOpenDigitalFile(file, 'management');
                  }}
                  className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-[#DCE7E0] bg-white px-3 text-xs font-semibold text-[#0B1F16] dark:border-[#1E3A2D] dark:bg-[#102119] dark:text-[#F2F9F5]"
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
          ) : pendingSaleFile ? (
            /* Step 2 after QR scan in Sell Mode: Add to Multi-Item Cart OR Confirm Immediate Sale */
            <form
              onSubmit={(e) => void handleConfirmPendingSale(e)}
              className="space-y-3.5 rounded-2xl border border-amber-500/40 bg-amber-50/50 p-4 dark:border-amber-500/35 dark:bg-amber-950/20"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                    {t.qrSaleFormTitle}
                  </span>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className="font-mono-code rounded-md bg-white px-2 py-0.5 text-xs font-bold text-[#115E3B] dark:bg-[#091611] dark:text-[#34D399]">
                      {pendingSaleFile.product.code}
                    </span>
                    <h3 className="text-sm font-bold text-[#0B1F16] dark:text-[#F2F9F5]">
                      {pendingSaleFile.product.name}
                    </h3>
                  </div>
                  <p className="tabular-nums mt-1 text-xs font-medium text-[#335947] dark:text-[#9EC0AE]">
                    {t.qrSaleAvailableLabel} :{' '}
                    <span className="font-bold text-[#115E3B] dark:text-[#34D399]">
                      {formatNumber(pendingSaleFile.product.quantity, lang)} {t.articlesUnit}
                    </span>
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setPendingSaleFile(null);
                    setErrorMsg('');
                  }}
                  className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border border-[#DCE7E0] bg-white px-2.5 text-xs font-semibold text-[#335947] hover:bg-[#F7FAF8] dark:border-[#1E3A2D] dark:bg-[#091611] dark:text-[#9EC0AE]"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>{t.qrSaleRescanButton}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#0B1F16] dark:text-[#F2F9F5]">
                    {t.qrSaleQtyLabel}
                  </label>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        setSaleQuantity((prev) =>
                          String(Math.max(1, (Math.floor(Number(prev)) || 1) - 1))
                        )
                      }
                      aria-label="-1"
                      className="flex min-h-[42px] min-w-[42px] items-center justify-center rounded-xl border border-[#DCE7E0] bg-white text-[#0B1F16] hover:bg-[#ECF7F1] dark:border-[#1E3A2D] dark:bg-[#091611] dark:text-[#F2F9F5]"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <input
                      type="number"
                      min="1"
                      max={maxStockForPending}
                      step="1"
                      value={saleQuantity}
                      onChange={(e) => setSaleQuantity(e.target.value)}
                      className={`${inputClass} tabular-nums text-center font-bold`}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setSaleQuantity((prev) =>
                          String(
                            Math.min(maxStockForPending, (Math.floor(Number(prev)) || 1) + 1)
                          )
                        )
                      }
                      aria-label="+1"
                      className="flex min-h-[42px] min-w-[42px] items-center justify-center rounded-xl border border-[#DCE7E0] bg-white text-[#0B1F16] hover:bg-[#ECF7F1] dark:border-[#1E3A2D] dark:bg-[#091611] dark:text-[#F2F9F5]"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#0B1F16] dark:text-[#F2F9F5]">
                    {t.qrSaleUnitPriceLabel} ({currency})
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={saleUnitPrice}
                    onChange={(e) => setSaleUnitPrice(e.target.value)}
                    className={`${inputClass} tabular-nums`}
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-[#0B1F16] dark:text-[#F2F9F5]">
                  {t.purchasePaymentLabel}
                </label>
                <select
                  value={salePaymentMethod}
                  onChange={(e) => setSalePaymentMethod(e.target.value as PurchasePaymentMethod)}
                  className={inputClass}
                >
                  {PAYMENT_METHODS.map((pm) => (
                    <option key={pm} value={pm}>
                      {paymentLabel(pm)}
                    </option>
                  ))}
                </select>
              </div>

              {!lockedCustomer && (
                <div className="space-y-2.5 rounded-xl border border-[#DCE7E0] bg-white/85 p-3 dark:border-[#1E3A2D] dark:bg-[#091611]/85">
                  {customers.length > 0 && (
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-[#0B1F16] dark:text-[#F2F9F5]">
                        {t.qrSaleCustomerSelectLabel}
                      </label>
                      <select
                        value={saleCustomerId}
                        onChange={(e) => handleSelectCustomer(e.target.value)}
                        className={inputClass}
                      >
                        <option value="">{t.posWalkInCustomer}</option>
                        {customers.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.code} — {c.name}
                            {c.phone ? ` (${c.phone})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-[#0B1F16] dark:text-[#F2F9F5]">
                        {t.posCustomerLabel}
                      </label>
                      <input
                        type="text"
                        value={saleCustomerName}
                        onChange={(e) => setSaleCustomerName(e.target.value)}
                        placeholder={t.qrSaleCustomerNamePlaceholder}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-[#0B1F16] dark:text-[#F2F9F5]">
                        {t.customerPhoneLabel}
                      </label>
                      <input
                        type="tel"
                        dir="ltr"
                        value={saleCustomerPhone}
                        onChange={(e) => setSaleCustomerPhone(e.target.value)}
                        placeholder={t.qrSaleCustomerPhonePlaceholder}
                        className={inputClass}
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:items-end">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#0B1F16] dark:text-[#F2F9F5]">
                    {t.purchaseNotesLabel}
                  </label>
                  <input
                    type="text"
                    value={saleNotes}
                    onChange={(e) => setSaleNotes(e.target.value)}
                    placeholder={t.purchaseNotesPlaceholder}
                    className={inputClass}
                  />
                </div>

                <div className="flex min-h-[42px] items-center justify-between rounded-xl border border-[#DCE7E0] bg-white px-3.5 py-2 text-xs dark:border-[#1E3A2D] dark:bg-[#091611]">
                  <span className="font-semibold text-[#335947] dark:text-[#9EC0AE]">
                    {t.purchaseTotalLabel}
                  </span>
                  <span className="tabular-nums text-sm font-bold text-[#115E3B] dark:text-[#34D399]">
                    {formatCurrency(liveSaleTotalMad, currency, lang)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={handleAddPendingToQrCart}
                  className="flex min-h-[46px] items-center justify-center gap-2 rounded-xl border border-[#115E3B] bg-white px-3 text-xs font-bold text-[#115E3B] hover:bg-[#ECF7F1] dark:border-[#10B981] dark:bg-[#091611] dark:text-[#34D399]"
                >
                  <Plus className="h-4 w-4" />
                  <span>{t.qrAddToInvoiceCart}</span>
                </button>

                <button
                  type="submit"
                  disabled={saleSubmitting}
                  className="flex min-h-[46px] items-center justify-center gap-2 rounded-xl bg-[#115E3B] px-3 text-xs font-bold text-white hover:bg-[#0D4A2E] disabled:opacity-60 dark:bg-[#10B981] dark:text-[#052E1C]"
                >
                  <Check className="h-4 w-4" />
                  <span>{saleSubmitting ? t.saving : t.qrSaleConfirmButton}</span>
                </button>
              </div>
            </form>
          ) : (
            <>
              {/* Camera Preview */}
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-[#DCE7E0] bg-[#0B1F16] dark:border-[#1E3A2D]">
                <video
                  ref={videoRef}
                  autoPlay
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
                    <Camera className="h-8 w-8 opacity-75" />
                    <p className="text-xs font-medium">{t.qrScannerCameraStarting}</p>
                  </div>
                )}

                {(cameraState === 'needs_tap' || cameraState === 'unavailable') && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#F7FAF8] p-5 text-center dark:bg-[#091611]">
                    <Camera className="h-8 w-8 text-[#115E3B]/65 dark:text-[#34D399]/65" />
                    <p className="max-w-xs text-xs leading-relaxed text-[#335947] dark:text-[#9EC0AE]">
                      {cameraState === 'needs_tap'
                        ? t.qrScannerCameraTapHint
                        : t.qrScannerCameraUnavailable}
                    </p>
                    <button
                      type="button"
                      onClick={() => void beginLiveCamera(true)}
                      className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-xl bg-[#115E3B] px-4 text-xs font-bold text-white hover:bg-[#0D4A2E] dark:bg-[#10B981] dark:text-[#052E1C]"
                    >
                      <Camera className="h-4 w-4" />
                      <span>{t.qrScannerEnableCamera}</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Native iPhone/Mobile Camera Capture + Library QR Photo + Manual Code Input */}
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => nativeCamInputRef.current?.click()}
                    disabled={processing}
                    className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-[#115E3B] px-3.5 text-xs font-semibold text-white hover:bg-[#0D4A2E] disabled:opacity-60 dark:bg-[#10B981] dark:text-[#052E1C]"
                  >
                    <Camera className="h-4 w-4 shrink-0" />
                    <span className="truncate">{t.qrScannerNativeCameraPhoto}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={processing}
                    className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl border border-[#DCE7E0] bg-[#ECF7F1] px-3.5 text-xs font-semibold text-[#115E3B] hover:bg-[#DCF0E4] disabled:opacity-60 dark:border-[#1E3A2D] dark:bg-[#132B20] dark:text-[#34D399]"
                  >
                    <ImagePlus className="h-4 w-4 shrink-0" />
                    <span className="truncate">{t.qrScannerUploadImage}</span>
                  </button>
                </div>

                <input
                  ref={nativeCamInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    void handleUploadQrPhoto(e.target.files);
                    e.target.value = '';
                  }}
                />

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
                        className={`min-h-[44px] w-full rounded-xl border border-[#DCE7E0] bg-[#F7FAF8] py-2 text-sm text-[#0B1F16] placeholder:text-[#6B8A79] focus:border-[#115E3B] focus:bg-white focus:outline-none dark:border-[#1E3A2D] dark:bg-[#091611] dark:text-[#F2F9F5] dark:placeholder:text-[#8FB39E] dark:focus:border-[#10B981] dark:focus:bg-[#0D1E16] ${
                          lang === 'ar' ? 'pl-3 pr-9' : 'pl-9 pr-3'
                        }`}
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={processing || !manualInput.trim()}
                      className="min-h-[44px] shrink-0 whitespace-nowrap rounded-xl bg-[#115E3B] px-4 text-xs font-bold text-white hover:bg-[#0D4A2E] disabled:opacity-50 dark:bg-[#10B981] dark:text-[#052E1C]"
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
