import QRCode from 'qrcode';
import type { Language, PosInvoice, Product, ProductDigitalFile } from '../types';
import { formatCurrency } from '../i18n';

declare const __DEFAULT_PUBLIC_APP_URL__: string;

interface CompactQrSnapshot {
  c: string; // code
  n?: string; // name
  d?: string; // truncated description
  cat?: string; // category
  col?: string; // color
  wh?: string; // warehouseName
  p?: number; // sellingPrice (MAD)
  q?: number; // quantity
  dt?: string; // addedDate
  dim?: string; // LxWxH
  th?: number; // thicknessCm
  pc?: number; // piecesCount
  sp?: string; // supplier
  st?: string; // storeName
  wa?: string; // whatsappPhone
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

function isUnreachableLocalHost(hostname: string): boolean {
  const h = (hostname || '').trim().toLowerCase();
  return (
    !h ||
    h === 'localhost' ||
    h === '127.0.0.1' ||
    h === '0.0.0.0' ||
    h === '::1' ||
    h === '[::1]' ||
    h.endsWith('.localhost') ||
    h.endsWith('.local') ||
    /^10\./.test(h) ||
    /^192\.168\./.test(h) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(h)
  );
}

function normalizePublicOrigin(rawUrl?: string): string {
  const clean = (rawUrl || '').trim();
  if (!clean) return '';
  try {
    const withProto = /^https?:\/\//i.test(clean) ? clean : `https://${clean}`;
    const parsed = new URL(withProto);
    if (!/^https?:$/i.test(parsed.protocol)) return '';
    if (isUnreachableLocalHost(parsed.hostname)) return '';
    // In AI Studio preview, `ais-dev-*` requires developer login whereas `ais-pre-*` is the public shared URL
    const publicHost = parsed.host.startsWith('ais-dev-')
      ? parsed.host.replace(/^ais-dev-/, 'ais-pre-')
      : parsed.host;
    return `${parsed.protocol}//${publicHost}`;
  } catch {
    return '';
  }
}

export function getPublicQrOrigin(customPublicUrl?: string): string {
  const explicit = normalizePublicOrigin(customPublicUrl);
  if (explicit) return explicit;

  if (typeof window !== 'undefined' && /^https?:$/i.test(window.location.protocol)) {
    const currentPublic = normalizePublicOrigin(window.location.origin);
    if (currentPublic) return currentPublic;
  }

  return typeof __DEFAULT_PUBLIC_APP_URL__ !== 'undefined'
    ? normalizePublicOrigin(__DEFAULT_PUBLIC_APP_URL__)
    : '';
}

export function buildProductQrUrl(
  product: Pick<Product, 'id' | 'code' | 'qrToken'> & Partial<Product>,
  extras?: { storeName?: string; whatsappPhone?: string; publicAppUrl?: string }
): string {
  const code = (product.code || product.id).trim();
  const origin = getPublicQrOrigin(extras?.publicAppUrl);
  if (origin) {
    const base = `${origin}/?qr=${encodeURIComponent(code)}`;
    if (product.name) {
      const snap: CompactQrSnapshot = {
        c: code,
        n: product.name.slice(0, 64),
        ...(product.description ? { d: product.description.slice(0, 90) } : {}),
        ...(product.category ? { cat: product.category.slice(0, 32) } : {}),
        ...(product.color ? { col: product.color.slice(0, 28) } : {}),
        ...(product.warehouseName ? { wh: product.warehouseName.slice(0, 32) } : {}),
        ...(typeof product.sellingPrice === 'number' ? { p: product.sellingPrice } : {}),
        ...(typeof product.quantity === 'number' ? { q: product.quantity } : {}),
        ...(product.addedDate ? { dt: product.addedDate } : {}),
        ...(product.lengthCm || product.widthCm || product.heightCm
          ? { dim: `${product.lengthCm || 0}x${product.widthCm || 0}x${product.heightCm || 0}` }
          : {}),
        ...(product.thicknessCm ? { th: product.thicknessCm } : {}),
        ...(product.piecesCount ? { pc: product.piecesCount } : {}),
        ...(product.supplier ? { sp: product.supplier.slice(0, 40) } : {}),
        ...(extras?.storeName ? { st: extras.storeName.slice(0, 36) } : {}),
        ...(extras?.whatsappPhone ? { wa: extras.whatsappPhone.slice(0, 24) } : {}),
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
    } else if (hash.includes('qr=') || hash.includes('code=')) {
      const hp = new URLSearchParams(hash.replace(/^#\/?/, ''));
      qrCode = hp.get('qr') || hp.get('code') || '';
    }
  }

  return {
    qrCode: qrCode.trim(),
    rawHrefOrHash: `${loc.search || ''}${hash}`,
  };
}

export function extractSnapshotExtrasFromQrInput(rawInput: string): {
  storeName?: string;
  whatsappPhone?: string;
} {
  try {
    const idx = rawInput.indexOf('#d=');
    const altIdx = rawInput.indexOf('&d=');
    const start = idx >= 0 ? idx + 3 : altIdx >= 0 ? altIdx + 3 : -1;
    if (start < 0) return {};
    const token = rawInput.slice(start).split(/[&#]/)[0].trim();
    if (!token) return {};
    const parsed = JSON.parse(fromBase64Url(token)) as CompactQrSnapshot;
    return {
      storeName: parsed?.st,
      whatsappPhone: parsed?.wa,
    };
  } catch {
    return {};
  }
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
      category: parsed.cat || '',
      color: parsed.col || '',
      warehouseName: parsed.wh || '',
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
    errorCorrectionLevel: text.length > 180 ? 'L' : 'M',
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
  lang: Language,
  whatsappPhone?: string,
  publicAppUrl?: string
): Promise<Blob> {
  const qrPayload = buildProductQrUrl(product, { storeName, whatsappPhone, publicAppUrl });
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

export async function buildQrStickerSheetBlob(
  product: Product,
  quantity: number,
  storeName: string,
  currency: string,
  lang: Language,
  whatsappPhone?: string,
  publicAppUrl?: string
): Promise<Blob> {
  const count = Math.max(1, Math.min(100, Math.floor(quantity || 1)));
  if (count === 1) {
    return buildQrStickerBlob(product, storeName, currency, lang, whatsappPhone, publicAppUrl);
  }

  const singleBlob = await buildQrStickerBlob(
    product,
    storeName,
    currency,
    lang,
    whatsappPhone,
    publicAppUrl
  );
  const singleUrl = URL.createObjectURL(singleBlob);
  try {
    const stickerImg = new Image();
    await new Promise<void>((resolve, reject) => {
      stickerImg.onload = () => resolve();
      stickerImg.onerror = () => reject(new Error('Sticker render failed'));
      stickerImg.src = singleUrl;
    });

    const cols = count <= 2 ? count : count <= 18 ? 3 : count <= 40 ? 4 : 5;
    const rows = Math.ceil(count / cols);
    const cellW = cols >= 5 ? 300 : cols === 4 ? 340 : 400;
    const cellH = Math.round(cellW * (820 / 640));
    const gap = 24;
    const margin = 36;

    const canvas = document.createElement('canvas');
    canvas.width = margin * 2 + cols * cellW + (cols - 1) * gap;
    canvas.height = margin * 2 + rows * cellH + (rows - 1) * gap;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas unavailable');

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < count; i += 1) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = margin + col * (cellW + gap);
      const y = margin + row * (cellH + gap);

      ctx.drawImage(stickerImg, x, y, cellW, cellH);

      ctx.save();
      ctx.setLineDash([6, 6]);
      ctx.strokeStyle = '#CBD5E1';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x - 6, y - 6, cellW + 12, cellH + 12);
      ctx.restore();
    }

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('PNG sheet export failed'));
      }, 'image/png');
    });
  } finally {
    URL.revokeObjectURL(singleUrl);
  }
}

export async function buildInvoiceReceiptBlob(
  invoice: PosInvoice,
  storeName: string,
  currency: string,
  lang: Language,
  options?: { isCopy?: boolean }
): Promise<Blob> {
  const isAr = lang === 'ar';
  const isCopy = Boolean(options?.isCopy || (invoice.printCount || 0) > 0);
  const items =
    invoice.items && invoice.items.length > 0
      ? invoice.items
      : [
          {
            productId: invoice.productId,
            productCode: invoice.productCode,
            productName: invoice.productName,
            category: invoice.category,
            warehouseName: invoice.warehouseName,
            quantity: invoice.quantity,
            unitPrice: invoice.unitPrice,
            totalPrice: invoice.totalPrice,
            purchasePrice: invoice.purchasePrice,
          },
        ];

  const metaCount =
    3 + (invoice.customerName ? 1 : 0) + (invoice.warehouseName ? 1 : 0) + (invoice.notes ? 1 : 0);
  const canvasHeight = Math.max(820, 380 + metaCount * 54 + items.length * 64 + 170);

  const canvas = document.createElement('canvas');
  canvas.width = 760;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Header strip
  ctx.fillStyle = '#115E3B';
  ctx.fillRect(0, 0, canvas.width, 150);

  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'left';
  ctx.font = 'bold 30px Georgia, serif';
  ctx.fillText(storeName.trim() || (isAr ? 'إدارة التحف' : 'Gestion Antiquités'), 44, 62);

  ctx.fillStyle = '#A7F3D0';
  ctx.font = 'bold 21px monospace';
  ctx.fillText(
    `${isAr ? 'فاتورة' : 'FACTURE'}  ${invoice.invoiceNumber}`,
    44,
    110
  );

  // Copy / Original stamp in header
  if (isCopy) {
    ctx.fillStyle = '#FEF3C7';
    ctx.fillRect(canvas.width - 210, 40, 166, 48);
    ctx.strokeStyle = '#D97706';
    ctx.lineWidth = 2;
    ctx.strokeRect(canvas.width - 210, 40, 166, 48);
    ctx.fillStyle = '#92400E';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(isAr ? 'نسخة / COPIE' : 'COPIE', canvas.width - 127, 72);

    // Subtle diagonal watermark
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(-Math.PI / 7);
    ctx.fillStyle = 'rgba(217, 119, 6, 0.08)';
    ctx.font = 'bold 110px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(isAr ? 'نسخة' : 'COPIE', 0, 0);
    ctx.restore();
  }

  let y = 200;
  const drawMetaRow = (label: string, value: string, boldValue = false) => {
    ctx.fillStyle = '#335947';
    ctx.font = '18px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(label, 44, y);

    ctx.fillStyle = '#0B1F16';
    ctx.font = boldValue ? 'bold 19px system-ui, sans-serif' : '18px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(value.length > 44 ? `${value.slice(0, 43)}…` : value, canvas.width - 44, y);

    y += 16;
    ctx.strokeStyle = '#DCE7E0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(44, y);
    ctx.lineTo(canvas.width - 44, y);
    ctx.stroke();
    y += 34;
  };

  drawMetaRow(isAr ? 'التاريخ / Date' : 'Date', invoice.saleDate);
  if (invoice.customerName) {
    drawMetaRow(
      isAr ? 'العميل / Client' : 'Client',
      `${invoice.customerName}${invoice.customerPhone ? ` (${invoice.customerPhone})` : ''}`,
      true
    );
  }
  if (invoice.warehouseName) {
    drawMetaRow(isAr ? 'المستودع / Entrepôt' : 'Entrepôt / Magasin', invoice.warehouseName);
  }
  drawMetaRow(isAr ? 'الدفع / Paiement' : 'Mode de paiement', invoice.paymentMethod.toUpperCase());
  if (invoice.notes) {
    drawMetaRow(isAr ? 'ملاحظات / Notes' : 'Notes', invoice.notes);
  }

  // Line items table header
  y += 6;
  ctx.fillStyle = '#ECF7F1';
  ctx.fillRect(44, y, canvas.width - 88, 42);
  ctx.strokeStyle = '#DCE7E0';
  ctx.strokeRect(44, y, canvas.width - 88, 42);

  ctx.fillStyle = '#115E3B';
  ctx.font = 'bold 17px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(isAr ? 'المنتج / Article' : 'Article', 56, y + 27);
  ctx.textAlign = 'right';
  ctx.fillText(isAr ? 'الكمية × السعر = المجموع' : 'Qté × P.U. = Total', canvas.width - 56, y + 27);
  y += 60;

  for (const line of items) {
    const lineName = `${line.productCode ? `${line.productCode} · ` : ''}${line.productName}`;
    ctx.fillStyle = '#0B1F16';
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(lineName.length > 36 ? `${lineName.slice(0, 35)}…` : lineName, 52, y);

    ctx.fillStyle = '#335947';
    ctx.font = '17px system-ui, sans-serif';
    ctx.textAlign = 'right';
    const qtyLabel = `${line.quantity} × ${formatCurrency(line.unitPrice, currency, lang)}`;
    ctx.fillText(
      `${qtyLabel} = ${formatCurrency(line.totalPrice, currency, lang)}`,
      canvas.width - 52,
      y + 24
    );

    y += 42;
    ctx.strokeStyle = '#E5EFE9';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(44, y);
    ctx.lineTo(canvas.width - 44, y);
    ctx.stroke();
    y += 22;
  }

  // Total box
  y += 8;
  ctx.fillStyle = '#ECF7F1';
  ctx.fillRect(44, y, canvas.width - 88, 90);
  ctx.strokeStyle = '#115E3B';
  ctx.lineWidth = 2;
  ctx.strokeRect(44, y, canvas.width - 88, 90);

  ctx.fillStyle = '#115E3B';
  ctx.font = 'bold 23px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(
    `${isAr ? 'المجموع' : 'TOTAL'} (${invoice.quantity} ${isAr ? 'ق' : 'art.'})`,
    68,
    y + 55
  );

  ctx.font = 'bold 32px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(formatCurrency(invoice.totalPrice, currency, lang), canvas.width - 68, y + 57);

  ctx.fillStyle = '#6B8A79';
  ctx.font = '17px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(
    isAr
      ? `شكراً لثقتكم${isCopy ? ' — نسخة مطابقة للأصل' : ' — فاتورة رقمية'}`
      : `Merci pour votre confiance${isCopy ? ' — COPIE CONFORME' : ' — Facture numérique'}`,
    canvas.width / 2,
    canvas.height - 32
  );

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Invoice PNG failed'));
    }, 'image/png');
  });
}
