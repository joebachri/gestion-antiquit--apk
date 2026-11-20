import QRCode from 'qrcode';
import type { Language, PosInvoice, Product, ProductDigitalFile } from '../types';
import { formatCurrency } from '../i18n';

interface CompactQrSnapshot {
  c: string; // code
  n?: string; // name
  d?: string; // truncated description
  p?: number; // sellingPrice (MAD)
  q?: number; // quantity
  dt?: string; // addedDate
  dim?: string; // LxWxH
  th?: number; // thicknessCm
  pc?: number; // piecesCount
  sp?: string; // supplier
}

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(encoded: string): string {
  const padded = encoded.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((encoded.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

export function buildProductQrUrl(
  product: Pick<Product, 'id' | 'code' | 'qrToken'> & Partial<Product>
): string {
  const code = (product.code || product.id).trim();
  if (typeof window !== 'undefined' && /^https?:$/i.test(window.location.protocol)) {
    const base = `${window.location.origin}/?qr=${encodeURIComponent(code)}`;
    if (product.name) {
      const snap: CompactQrSnapshot = {
        c: code,
        n: product.name.slice(0, 64),
        ...(product.description ? { d: product.description.slice(0, 90) } : {}),
        ...(typeof product.sellingPrice === 'number' ? { p: product.sellingPrice } : {}),
        ...(typeof product.quantity === 'number' ? { q: product.quantity } : {}),
        ...(product.addedDate ? { dt: product.addedDate } : {}),
        ...(product.lengthCm || product.widthCm || product.heightCm
          ? { dim: `${product.lengthCm || 0}x${product.widthCm || 0}x${product.heightCm || 0}` }
          : {}),
        ...(product.thicknessCm ? { th: product.thicknessCm } : {}),
        ...(product.piecesCount ? { pc: product.piecesCount } : {}),
        ...(product.supplier ? { sp: product.supplier.slice(0, 40) } : {}),
      };
      try {
        return `${base}#d=${toBase64Url(JSON.stringify(snap))}`;
      } catch {
        return base;
      }
    }
    return base;
  }
  return product.qrToken || `GA-QR-${code}`;
}

export function extractQrParamFromLocation(loc: { search?: string; hash?: string }): {
  qrCode: string;
  rawHrefOrHash: string;
} {
  const searchParams = new URLSearchParams(loc.search || '');
  let qrCode =
    searchParams.get('qr') || searchParams.get('code') || searchParams.get('product') || '';

  const hash = loc.hash || '';
  if (!qrCode && hash) {
    const qIdx = hash.indexOf('?');
    if (qIdx >= 0) {
      const hp = new URLSearchParams(hash.slice(qIdx));
      qrCode = hp.get('qr') || hp.get('code') || hp.get('product') || '';
    } else if (hash.includes('qr=')) {
      const hp = new URLSearchParams(hash.replace(/^#/, ''));
      qrCode = hp.get('qr') || '';
    }
  }

  return {
    qrCode: qrCode.trim(),
    rawHrefOrHash: `${loc.search || ''}${hash}`,
  };
}

export function buildDigitalFileFromQrSnapshot(rawInput: string): ProductDigitalFile | null {
  try {
    const idx = rawInput.indexOf('#d=');
    const altIdx = rawInput.indexOf('&d=');
    const start = idx >= 0 ? idx + 3 : altIdx >= 0 ? altIdx + 3 : -1;
    if (start < 0) return null;
    const token = rawInput.slice(start).split(/[&#]/)[0].trim();
    if (!token) return null;
    const parsed = JSON.parse(fromBase64Url(token)) as CompactQrSnapshot;
    if (!parsed || !parsed.c) return null;

    const dims = (parsed.dim || '').split('x').map((n) => Number(n) || 0);
    const now = new Date().toISOString();
    const product: Product = {
      id: `qr-snap-${parsed.c}`,
      code: parsed.c,
      qrToken: `GA-QR-${parsed.c}`,
      name: parsed.n || parsed.c,
      description: parsed.d || '',
      supplier: parsed.sp || '',
      lengthCm: dims[0] || 0,
      widthCm: dims[1] || 0,
      heightCm: dims[2] || 0,
      thicknessCm: parsed.th || 0,
      piecesCount: parsed.pc || 1,
      quantity: typeof parsed.q === 'number' ? parsed.q : 1,
      referencePrice: 0,
      expenses: 0,
      sellingPrice: typeof parsed.p === 'number' ? parsed.p : 0,
      addedDate: parsed.dt || now.slice(0, 10),
      createdAt: now,
      updatedAt: now,
      photos: [],
    };
    return {
      product,
      invoices: [],
      history: [],
      salesStats: {
        totalUnitsSold: 0,
        totalRevenueMad: 0,
        totalInvoices: 0,
        lastSaleDate: '',
      },
    };
  } catch {
    return null;
  }
}

export async function generateQrDataUrl(text: string, size = 320): Promise<string> {
  return QRCode.toDataURL(text, {
    width: size,
    margin: 2,
    errorCorrectionLevel: 'M',
    color: {
      dark: '#0B1F16',
      light: '#FFFFFF',
    },
  });
}

export async function buildQrStickerBlob(
  product: Product,
  storeName: string,
  currency: string,
  lang: Language
): Promise<Blob> {
  const qrPayload = buildProductQrUrl(product);
  const qrDataUrl = await generateQrDataUrl(qrPayload, 420);

  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 820;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');

  // Background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Outer antique emerald border
  ctx.strokeStyle = '#115E3B';
  ctx.lineWidth = 8;
  ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);

  // Header strip
  ctx.fillStyle = '#115E3B';
  ctx.fillRect(20, 20, canvas.width - 40, 96);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 28px Georgia, serif';
  ctx.textAlign = 'center';
  const titleText = storeName.trim() || (lang === 'ar' ? 'إدارة التحف' : 'Gestion Antiquités');
  ctx.fillText(titleText, canvas.width / 2, 68);

  ctx.fillStyle = '#A7F3D0';
  ctx.font = 'bold 22px monospace';
  ctx.fillText(product.code, canvas.width / 2, 100);

  // QR image
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('QR image load failed'));
    img.src = qrDataUrl;
  });

  const qrSize = 420;
  const qrX = (canvas.width - qrSize) / 2;
  const qrY = 148;
  ctx.drawImage(img, qrX, qrY, qrSize, qrSize);

  // Serial token under QR
  ctx.fillStyle = '#335947';
  ctx.font = 'bold 20px monospace';
  ctx.fillText(product.qrToken || `GA-QR-${product.code}`, canvas.width / 2, 598);

  // Product name (truncate cleanly to fit)
  ctx.fillStyle = '#0B1F16';
  ctx.font = 'bold 28px sans-serif';
  const cleanName = product.name.length > 36 ? `${product.name.slice(0, 35)}…` : product.name;
  ctx.fillText(cleanName, canvas.width / 2, 654);

  // Selling Price
  ctx.fillStyle = '#115E3B';
  ctx.font = 'bold 36px sans-serif';
  ctx.fillText(formatCurrency(product.sellingPrice, currency, lang), canvas.width / 2, 718);

  // Footer hint
  ctx.fillStyle = '#6B8A79';
  ctx.font = '18px sans-serif';
  ctx.fillText(
    lang === 'ar' ? 'امسح الرمز لعرض الملف الرقمي للمنتج' : 'Scannez pour ouvrir la fiche numérique',
    canvas.width / 2,
    766
  );

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('PNG export failed'));
    }, 'image/png');
  });
}

export async function buildInvoiceReceiptBlob(
  invoice: PosInvoice,
  storeName: string,
  currency: string,
  lang: Language
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = 720;
  canvas.height = 880;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#115E3B';
  ctx.fillRect(0, 0, canvas.width, 150);

  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'left';
  ctx.font = 'bold 32px Georgia, serif';
  ctx.fillText(storeName.trim() || 'Gestion Antiquités', 48, 64);

  ctx.fillStyle = '#A7F3D0';
  ctx.font = 'bold 22px monospace';
  ctx.fillText(
    `${lang === 'ar' ? 'FACTURE / فاتورة' : 'FACTURE'}  ${invoice.invoiceNumber}`,
    48,
    112
  );

  let y = 215;
  const drawRow = (label: string, value: string, boldValue = false) => {
    ctx.fillStyle = '#335947';
    ctx.font = '20px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(label, 48, y);

    ctx.fillStyle = '#0B1F16';
    ctx.font = boldValue ? 'bold 22px sans-serif' : '20px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(value, canvas.width - 48, y);

    y += 22;
    ctx.strokeStyle = '#DCE7E0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(48, y);
    ctx.lineTo(canvas.width - 48, y);
    ctx.stroke();
    y += 40;
  };

  drawRow(lang === 'ar' ? 'التاريخ / Date' : 'Date', invoice.saleDate);
  drawRow(lang === 'ar' ? 'رمز المنتج / Code' : 'Code produit', invoice.productCode, true);
  drawRow(
    lang === 'ar' ? 'المنتج / Article' : 'Article',
    invoice.productName.length > 34 ? `${invoice.productName.slice(0, 33)}…` : invoice.productName
  );
  drawRow(lang === 'ar' ? 'الكمية / Quantité' : 'Quantité', String(invoice.quantity));
  drawRow(
    lang === 'ar' ? 'سعر الوحدة / Prix unitaire' : 'Prix unitaire',
    formatCurrency(invoice.unitPrice, currency, lang)
  );
  if (invoice.customerName) {
    drawRow(lang === 'ar' ? 'العميل / Client' : 'Client', invoice.customerName);
  }
  drawRow(lang === 'ar' ? 'الدفع / Paiement' : 'Mode de paiement', invoice.paymentMethod.toUpperCase());

  // Total box
  y += 10;
  ctx.fillStyle = '#ECF7F1';
  ctx.fillRect(48, y, canvas.width - 96, 92);
  ctx.strokeStyle = '#115E3B';
  ctx.lineWidth = 2;
  ctx.strokeRect(48, y, canvas.width - 96, 92);

  ctx.fillStyle = '#115E3B';
  ctx.font = 'bold 24px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(lang === 'ar' ? 'المجموع / TOTAL' : 'TOTAL', 72, y + 56);

  ctx.font = 'bold 34px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(formatCurrency(invoice.totalPrice, currency, lang), canvas.width - 72, y + 58);

  ctx.fillStyle = '#6B8A79';
  ctx.font = '18px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(
    lang === 'ar' ? 'شكراً لثقتكم — فاتورة رقمية' : 'Merci pour votre confiance — Facture numérique',
    canvas.width / 2,
    835
  );

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Invoice PNG failed'));
    }, 'image/png');
  });
}
