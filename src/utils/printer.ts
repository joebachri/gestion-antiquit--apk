import { Capacitor } from '@capacitor/core';
import { jsPDF } from 'jspdf';
import type { Language, PosInvoice, PrinterMode, PrinterPaperFormat, Product } from '../types';
import { formatCurrency } from '../i18n';
import { buildProductQrUrl, buildQrStickerBlob, generateQrDataUrl } from './qr';
import { saveOrShareBlob } from './download';

interface BluetoothRemoteGATTCharacteristicLike {
  properties?: { write?: boolean; writeWithoutResponse?: boolean };
  writeValueWithResponse?: (value: BufferSource) => Promise<void>;
  writeValueWithoutResponse?: (value: BufferSource) => Promise<void>;
  writeValue?: (value: BufferSource) => Promise<void>;
}

interface BluetoothRemoteGATTServiceLike {
  getCharacteristics: () => Promise<BluetoothRemoteGATTCharacteristicLike[]>;
}

interface BluetoothDeviceLike {
  name?: string;
  gatt?: {
    connected: boolean;
    connect: () => Promise<{
      getPrimaryServices: () => Promise<BluetoothRemoteGATTServiceLike[]>;
    }>;
    disconnect: () => void;
  };
}

let activeBtDevice: BluetoothDeviceLike | null = null;
let activeBtCharacteristic: BluetoothRemoteGATTCharacteristicLike | null = null;

export function isWebBluetoothSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof (navigator as unknown as { bluetooth?: { requestDevice?: unknown } }).bluetooth
      ?.requestDevice === 'function'
  );
}

export function isBluetoothPrinterConnected(): boolean {
  return Boolean(activeBtDevice?.gatt?.connected && activeBtCharacteristic);
}

export function disconnectBluetoothPrinter(): void {
  try {
    if (activeBtDevice?.gatt?.connected) {
      activeBtDevice.gatt.disconnect();
    }
  } catch {
    // ignore disconnect errors
  }
  activeBtDevice = null;
  activeBtCharacteristic = null;
}

export async function linkBluetoothPrinter(): Promise<
  { ok: true; printerName: string } | { ok: false; reason: 'UNSUPPORTED' | 'CANCELED' | 'FAILED' }
> {
  if (!isWebBluetoothSupported()) {
    return { ok: false, reason: 'UNSUPPORTED' };
  }

  try {
    const bt = (
      navigator as unknown as {
        bluetooth: {
          requestDevice: (opts: {
            acceptAllDevices?: boolean;
            optionalServices?: string[];
          }) => Promise<BluetoothDeviceLike>;
        };
      }
    ).bluetooth;

    const device = await bt.requestDevice({
      acceptAllDevices: true,
      optionalServices: [
        '000018f0-0000-1000-8000-00805f9b34fb',
        'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
        '49535343-fe7d-4ae5-8fa9-9fafd205e455',
        '0000ff00-0000-1000-8000-00805f9b34fb',
      ],
    });

    if (!device?.gatt) {
      return { ok: false, reason: 'FAILED' };
    }

    const server = await device.gatt.connect();
    const services = await server.getPrimaryServices();
    let writableChar: BluetoothRemoteGATTCharacteristicLike | null = null;

    for (const service of services) {
      const chars = await service.getCharacteristics();
      for (const ch of chars) {
        if (ch.properties?.writeWithoutResponse || ch.properties?.write) {
          writableChar = ch;
          break;
        }
      }
      if (writableChar) break;
    }

    if (!writableChar) {
      device.gatt.disconnect();
      return { ok: false, reason: 'FAILED' };
    }

    activeBtDevice = device;
    activeBtCharacteristic = writableChar;
    return {
      ok: true,
      printerName: device.name?.trim() || 'Imprimante Bluetooth ESC/POS',
    };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'NotFoundError') {
      return { ok: false, reason: 'CANCELED' };
    }
    return { ok: false, reason: 'FAILED' };
  }
}

async function writeChunkToCharacteristic(
  ch: BluetoothRemoteGATTCharacteristicLike,
  chunk: Uint8Array
): Promise<void> {
  const buf = new Uint8Array(chunk).buffer;
  if (ch.properties?.writeWithoutResponse && ch.writeValueWithoutResponse) {
    await ch.writeValueWithoutResponse(buf);
  } else if (ch.writeValueWithResponse) {
    await ch.writeValueWithResponse(buf);
  } else if (ch.writeValue) {
    await ch.writeValue(buf);
  }
}

async function renderMonochromeStickerRaster(
  product: Product,
  storeName: string,
  currency: string,
  lang: Language,
  widthPx: number,
  whatsappPhone?: string,
  publicAppUrl?: string
): Promise<{ widthBytes: number; height: number; data: Uint8Array }> {
  const heightPx = Math.round(widthPx * 1.15);
  const canvas = document.createElement('canvas');
  canvas.width = widthPx;
  canvas.height = heightPx;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, widthPx, heightPx);

  const qrPayload = buildProductQrUrl(product, { storeName, whatsappPhone, publicAppUrl });
  const qrSize = Math.round(widthPx * 0.66);
  const qrUrl = await generateQrDataUrl(qrPayload, qrSize);
  const qrImg = new Image();
  await new Promise<void>((resolve, reject) => {
    qrImg.onload = () => resolve();
    qrImg.onerror = () => reject(new Error('QR image load failed'));
    qrImg.src = qrUrl;
  });

  ctx.fillStyle = '#000000';
  ctx.textAlign = 'center';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText(
    (storeName.trim() || (lang === 'ar' ? 'إدارة التحف' : 'Gestion Antiquités')).slice(0, 26),
    widthPx / 2,
    26
  );

  ctx.font = 'bold 22px monospace';
  ctx.fillText(product.code, widthPx / 2, 54);

  ctx.drawImage(qrImg, (widthPx - qrSize) / 2, 66, qrSize, qrSize);

  const afterQrY = 66 + qrSize + 24;
  ctx.font = 'bold 18px sans-serif';
  const nameLine = product.name.length > 28 ? `${product.name.slice(0, 27)}…` : product.name;
  ctx.fillText(nameLine, widthPx / 2, afterQrY);

  ctx.font = 'bold 24px sans-serif';
  ctx.fillText(formatCurrency(product.sellingPrice, currency, lang), widthPx / 2, afterQrY + 32);

  const imgData = ctx.getImageData(0, 0, widthPx, heightPx).data;
  const widthBytes = Math.ceil(widthPx / 8);
  const data = new Uint8Array(widthBytes * heightPx);

  for (let y = 0; y < heightPx; y += 1) {
    for (let x = 0; x < widthPx; x += 1) {
      const idx = (y * widthPx + x) * 4;
      const lum = 0.299 * imgData[idx] + 0.587 * imgData[idx + 1] + 0.114 * imgData[idx + 2];
      if (lum < 145) {
        data[y * widthBytes + (x >> 3)] |= 0x80 >> (x & 7);
      }
    }
  }

  return { widthBytes, height: heightPx, data };
}

export async function printQrLabelsBluetooth(
  product: Product,
  qty: number,
  storeName: string,
  currency: string,
  lang: Language,
  paperFormat: PrinterPaperFormat,
  whatsappPhone?: string,
  publicAppUrl?: string
): Promise<void> {
  if (!activeBtCharacteristic || !activeBtDevice?.gatt?.connected) {
    throw new Error('BT_NOT_CONNECTED');
  }

  const widthPx = paperFormat === 'roll_80' ? 512 : 384;
  const raster = await renderMonochromeStickerRaster(
    product,
    storeName,
    currency,
    lang,
    widthPx,
    whatsappPhone,
    publicAppUrl
  );

  const xL = raster.widthBytes & 0xff;
  const xH = (raster.widthBytes >> 8) & 0xff;
  const yL = raster.height & 0xff;
  const yH = (raster.height >> 8) & 0xff;

  const initCmd = new Uint8Array([0x1b, 0x40]);
  const rasterHeader = new Uint8Array([0x1d, 0x76, 0x30, 0x00, xL, xH, yL, yH]);
  const feedCmd = new Uint8Array([0x1b, 0x64, 0x03]);

  const packet = new Uint8Array(
    initCmd.length + rasterHeader.length + raster.data.length + feedCmd.length
  );
  packet.set(initCmd, 0);
  packet.set(rasterHeader, initCmd.length);
  packet.set(raster.data, initCmd.length + rasterHeader.length);
  packet.set(feedCmd, initCmd.length + rasterHeader.length + raster.data.length);

  const count = Math.max(1, Math.min(100, Math.floor(qty || 1)));
  for (let copy = 0; copy < count; copy += 1) {
    for (let offset = 0; offset < packet.length; offset += 120) {
      await writeChunkToCharacteristic(activeBtCharacteristic, packet.slice(offset, offset + 120));
      await new Promise((r) => setTimeout(r, 14));
    }
  }
}

export async function openCashDrawer(): Promise<'bt_sent' | 'no_drawer'> {
  if (!activeBtCharacteristic || !activeBtDevice?.gatt?.connected) {
    return 'no_drawer';
  }
  try {
    // ESC p m t1 t2 — standard ESC/POS cash drawer kick pulse (pin 2 & pin 5)
    const kickPin2 = new Uint8Array([0x1b, 0x70, 0x00, 0x19, 0xfa]);
    const kickPin5 = new Uint8Array([0x1b, 0x70, 0x01, 0x19, 0xfa]);
    await writeChunkToCharacteristic(activeBtCharacteristic, kickPin2);
    await new Promise((r) => setTimeout(r, 40));
    await writeChunkToCharacteristic(activeBtCharacteristic, kickPin5);
    return 'bt_sent';
  } catch {
    return 'no_drawer';
  }
}

export async function printThermalTicketBluetooth(
  invoice: PosInvoice,
  storeName: string,
  currency: string,
  lang: Language,
  paperFormat: PrinterPaperFormat = 'roll_80',
  withDrawerKick = true
): Promise<void> {
  if (!activeBtCharacteristic || !activeBtDevice?.gatt?.connected) {
    throw new Error('BT_NOT_CONNECTED');
  }

  const isAr = lang === 'ar';
  const widthPx = paperFormat === 'roll_80' ? 512 : 384;
  const items =
    invoice.items && invoice.items.length > 0
      ? invoice.items
      : [
          {
            productId: invoice.productId,
            productCode: invoice.productCode,
            productName: invoice.productName,
            quantity: invoice.quantity,
            unitPrice: invoice.unitPrice,
            discountPercent: 0,
            totalPrice: invoice.totalPrice,
            purchasePrice: invoice.purchasePrice,
          },
        ];

  const heightPx = 280 + items.length * 54 + (invoice.paymentBreakdown?.length || 1) * 28;
  const canvas = document.createElement('canvas');
  canvas.width = widthPx;
  canvas.height = heightPx;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, widthPx, heightPx);
  ctx.fillStyle = '#000000';

  let y = 28;
  ctx.textAlign = 'center';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText(
    (storeName.trim() || (isAr ? 'إدارة التحف' : 'Gestion Antiquités')).slice(0, 28),
    widthPx / 2,
    y
  );
  y += 28;

  const isBl = invoice.documentType === 'bl';
  ctx.font = 'bold 18px monospace';
  ctx.fillText(
    `${isBl ? (isAr ? 'بيان تسليم' : 'BON DE LIVRAISON') : (isAr ? 'فاتورة' : 'FACTURE')} ${invoice.invoiceNumber}`,
    widthPx / 2,
    y
  );
  y += 24;

  ctx.font = '15px sans-serif';
  ctx.fillText(`${invoice.saleDate} · ${invoice.customerName || (isAr ? 'زبون عابر' : 'Client de passage')}`, widthPx / 2, y);
  y += 18;

  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(10, y);
  ctx.lineTo(widthPx - 10, y);
  ctx.stroke();
  y += 22;

  for (const li of items) {
    ctx.textAlign = 'left';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(`${li.productCode} ${li.productName}`.slice(0, 32), 10, y);
    y += 20;
    ctx.font = '15px monospace';
    const discTxt = li.discountPercent && li.discountPercent > 0 ? ` (-${li.discountPercent}%)` : '';
    ctx.fillText(`${li.quantity} x ${formatCurrency(li.unitPrice, currency, lang)}${discTxt}`, 10, y);
    ctx.textAlign = 'right';
    ctx.fillText(formatCurrency(li.totalPrice, currency, lang), widthPx - 10, y);
    y += 26;
  }

  ctx.beginPath();
  ctx.moveTo(10, y);
  ctx.lineTo(widthPx - 10, y);
  ctx.stroke();
  y += 28;

  ctx.textAlign = 'left';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText(`TOTAL (${invoice.quantity} art.)`, 10, y);
  ctx.textAlign = 'right';
  ctx.fillText(formatCurrency(invoice.totalPrice, currency, lang), widthPx - 10, y);
  y += 30;

  ctx.textAlign = 'center';
  ctx.font = '14px sans-serif';
  ctx.fillText(isAr ? 'شكراً لزيارتكم' : 'Merci pour votre visite', widthPx / 2, y);

  const imgData = ctx.getImageData(0, 0, widthPx, heightPx).data;
  const widthBytes = Math.ceil(widthPx / 8);
  const data = new Uint8Array(widthBytes * heightPx);
  for (let py = 0; py < heightPx; py += 1) {
    for (let px = 0; px < widthPx; px += 1) {
      const idx = (py * widthPx + px) * 4;
      const lum = 0.299 * imgData[idx] + 0.587 * imgData[idx + 1] + 0.114 * imgData[idx + 2];
      if (lum < 150) {
        data[py * widthBytes + (px >> 3)] |= 0x80 >> (px & 7);
      }
    }
  }

  const xL = widthBytes & 0xff;
  const xH = (widthBytes >> 8) & 0xff;
  const yL = heightPx & 0xff;
  const yH = (heightPx >> 8) & 0xff;

  const initCmd = new Uint8Array([0x1b, 0x40]);
  const rasterHeader = new Uint8Array([0x1d, 0x76, 0x30, 0x00, xL, xH, yL, yH]);
  const feedAndCut = new Uint8Array([0x1b, 0x64, 0x04, 0x1d, 0x56, 0x42, 0x00]);
  const drawerCmd = withDrawerKick ? new Uint8Array([0x1b, 0x70, 0x00, 0x19, 0xfa]) : new Uint8Array(0);

  const packet = new Uint8Array(
    initCmd.length + rasterHeader.length + data.length + feedAndCut.length + drawerCmd.length
  );
  let pos = 0;
  packet.set(initCmd, pos); pos += initCmd.length;
  packet.set(rasterHeader, pos); pos += rasterHeader.length;
  packet.set(data, pos); pos += data.length;
  packet.set(feedAndCut, pos); pos += feedAndCut.length;
  if (drawerCmd.length > 0) packet.set(drawerCmd, pos);

  for (let offset = 0; offset < packet.length; offset += 120) {
    await writeChunkToCharacteristic(activeBtCharacteristic, packet.slice(offset, offset + 120));
    await new Promise((r) => setTimeout(r, 14));
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read blob'));
    reader.readAsDataURL(blob);
  });
}

export async function buildQrLabelsPdfBlob(
  product: Product,
  qty: number,
  storeName: string,
  currency: string,
  lang: Language,
  paperFormat: PrinterPaperFormat = 'a4',
  whatsappPhone?: string,
  publicAppUrl?: string
): Promise<Blob> {
  const count = Math.max(1, Math.min(100, Math.floor(qty || 1)));
  const stickerBlob = await buildQrStickerBlob(
    product,
    storeName,
    currency,
    lang,
    whatsappPhone,
    publicAppUrl
  );
  const stickerDataUrl = await blobToDataUrl(stickerBlob);

  if (paperFormat === 'a4') {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const cols = 3;
    const rows = 4;
    const perPage = cols * rows;
    const marginX = 12;
    const marginY = 12;
    const gapX = 6;
    const gapY = 6;
    const cardW = (210 - marginX * 2 - gapX * (cols - 1)) / cols; // ~58mm
    const cardH = Math.min(
      (297 - marginY * 2 - gapY * (rows - 1)) / rows,
      cardW * (820 / 640)
    );

    for (let i = 0; i < count; i += 1) {
      if (i > 0 && i % perPage === 0) {
        doc.addPage('a4', 'portrait');
      }
      const posInPage = i % perPage;
      const col = posInPage % cols;
      const row = Math.floor(posInPage / cols);
      const x = marginX + col * (cardW + gapX);
      const y = marginY + row * (cardH + gapY);

      doc.addImage(stickerDataUrl, 'PNG', x, y, cardW, cardH);
    }

    return doc.output('blob');
  }

  const sizeMap: Record<
    Exclude<PrinterPaperFormat, 'a4'>,
    { w: number; h: number; orientation: 'portrait' | 'landscape' }
  > = {
    label_50x30: { w: 50, h: 30, orientation: 'landscape' },
    label_40x30: { w: 40, h: 30, orientation: 'landscape' },
    roll_58: { w: 58, h: 74, orientation: 'portrait' },
    roll_80: { w: 80, h: 100, orientation: 'portrait' },
  };

  const spec = sizeMap[paperFormat];
  const doc = new jsPDF({
    orientation: spec.orientation,
    unit: 'mm',
    format: [spec.w, spec.h],
  });

  const pad = 1.5;
  const maxW = spec.w - pad * 2;
  const maxH = spec.h - pad * 2;
  const aspect = 640 / 820;
  let drawW = maxW;
  let drawH = drawW / aspect;
  if (drawH > maxH) {
    drawH = maxH;
    drawW = drawH * aspect;
  }
  const offsetX = (spec.w - drawW) / 2;
  const offsetY = (spec.h - drawH) / 2;

  for (let i = 0; i < count; i += 1) {
    if (i > 0) {
      doc.addPage([spec.w, spec.h], spec.orientation);
    }
    doc.addImage(stickerDataUrl, 'PNG', offsetX, offsetY, drawW, drawH);
  }

  return doc.output('blob');
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function tryIsolatedIframePrint(
  product: Product,
  qty: number,
  qrDataUrl: string,
  storeName: string,
  currency: string,
  lang: Language,
  paperFormat: PrinterPaperFormat
): Promise<boolean> {
  if (Capacitor.isNativePlatform() || typeof document === 'undefined') {
    return false;
  }

  const count = Math.max(1, Math.min(100, Math.floor(qty || 1)));
  const titleText = escapeHtml(storeName.trim() || 'Gestion Antiquités');
  const prodCode = escapeHtml(product.code);
  const qrToken = escapeHtml(product.qrToken || `GA-QR-${product.code}`);
  const prodName = escapeHtml(product.name);
  const priceText = escapeHtml(formatCurrency(product.sellingPrice, currency, lang));

  const pageCss =
    paperFormat === 'a4'
      ? '@page { size: A4 portrait; margin: 10mm; } .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6mm; }'
      : paperFormat === 'label_50x30'
      ? '@page { size: 50mm 30mm; margin: 1.5mm; } .grid { display: block; } .card { page-break-after: always; }'
      : paperFormat === 'label_40x30'
      ? '@page { size: 40mm 30mm; margin: 1.5mm; } .grid { display: block; } .card { page-break-after: always; }'
      : paperFormat === 'roll_58'
      ? '@page { size: 58mm auto; margin: 2mm; } .grid { display: block; } .card { page-break-after: always; }'
      : '@page { size: 80mm auto; margin: 3mm; } .grid { display: block; } .card { page-break-after: always; }';

  const cardsHtml = Array.from({ length: count })
    .map(
      () => `
      <div class="card">
        <div class="store">${titleText}</div>
        <div class="code">${prodCode}</div>
        <img src="${qrDataUrl}" alt="QR ${prodCode}" />
        <div class="token">${qrToken}</div>
        <div class="name">${prodName}</div>
        <div class="price">${priceText}</div>
      </div>`
    )
    .join('');

  const html = `<!doctype html>
  <html dir="${lang === 'ar' ? 'rtl' : 'ltr'}">
    <head>
      <meta charset="utf-8" />
      <title>QR ${prodCode}</title>
      <style>
        * { box-sizing: border-box; }
        body { margin: 0; padding: 0; background: #fff; color: #0b1f16; font-family: system-ui, sans-serif; }
        ${pageCss}
        .card { border: 1.5px solid #115E3B; border-radius: 6px; padding: 6px; text-align: center; break-inside: avoid; page-break-inside: avoid; }
        .store { font-size: 9px; font-weight: 700; color: #115E3B; text-transform: uppercase; }
        .code { font-size: 11px; font-weight: 700; font-family: monospace; margin-top: 2px; }
        img { width: 92px; height: 92px; object-fit: contain; display: block; margin: 4px auto; }
        .token { font-size: 8px; font-family: monospace; color: #335947; }
        .name { font-size: 10px; font-weight: 700; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .price { font-size: 11px; font-weight: 700; color: #115E3B; margin-top: 2px; }
      </style>
    </head>
    <body>
      <div class="grid">${cardsHtml}</div>
    </body>
  </html>`;

  return new Promise<boolean>((resolve) => {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '1px';
    iframe.style.height = '1px';
    iframe.style.border = '0';
    iframe.style.opacity = '0';
    iframe.style.pointerEvents = 'none';

    let settled = false;
    let printTriggered = false;
    const cleanup = (ok: boolean) => {
      if (settled) return;
      settled = true;
      setTimeout(() => {
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
      }, 1500);
      resolve(ok);
    };

    iframe.onload = () => {
      const cw = iframe.contentWindow;
      if (!cw) {
        cleanup(false);
        return;
      }
      cw.addEventListener('beforeprint', () => {
        printTriggered = true;
      });
      cw.addEventListener('afterprint', () => {
        cleanup(true);
      });
      try {
        cw.focus();
        cw.print();
      } catch {
        cleanup(false);
        return;
      }
      // If sandbox blocked cw.print(), beforeprint never fires synchronously
      setTimeout(() => {
        cleanup(printTriggered);
      }, 350);
    };

    document.body.appendChild(iframe);
    iframe.srcdoc = html;
  });
}

export async function executeSmartQrPrint(options: {
  product: Product;
  qty: number;
  qrDataUrl: string;
  storeName: string;
  whatsappPhone?: string;
  publicAppUrl?: string;
  currency: string;
  lang: Language;
  printerMode?: PrinterMode;
  printerPaper?: PrinterPaperFormat;
}): Promise<'printed_bt' | 'printed_browser' | 'pdf_exported' | 'pdf_fallback'> {
  const {
    product,
    qty,
    qrDataUrl,
    storeName,
    whatsappPhone,
    publicAppUrl,
    currency,
    lang,
    printerMode = 'pdf_system',
    printerPaper = 'a4',
  } = options;
  const safeQty = Math.max(1, Math.min(100, Math.floor(qty || 1)));

  if (printerMode === 'thermal_bt' && isBluetoothPrinterConnected()) {
    await printQrLabelsBluetooth(
      product,
      safeQty,
      storeName,
      currency,
      lang,
      printerPaper,
      whatsappPhone,
      publicAppUrl
    );
    return 'printed_bt';
  }

  if (printerMode === 'browser') {
    const opened = await tryIsolatedIframePrint(
      product,
      safeQty,
      qrDataUrl,
      storeName,
      currency,
      lang,
      printerPaper
    );
    if (opened) {
      return 'printed_browser';
    }
    const pdfBlob = await buildQrLabelsPdfBlob(
      product,
      safeQty,
      storeName,
      currency,
      lang,
      printerPaper,
      whatsappPhone,
      publicAppUrl
    );
    await saveOrShareBlob(
      pdfBlob,
      `qr-${product.code.toLowerCase()}-x${safeQty}.pdf`,
      `${product.code} QR ×${safeQty}`
    );
    return 'pdf_fallback';
  }

  // Default ('pdf_system') & fallback when Bluetooth session isn't paired yet:
  // Always generate an exact calibrated multi-label PDF for OS / Android / Wi-Fi printers.
  const pdfBlob = await buildQrLabelsPdfBlob(
    product,
    safeQty,
    storeName,
    currency,
    lang,
    printerPaper,
    whatsappPhone,
    publicAppUrl
  );
  await saveOrShareBlob(
    pdfBlob,
    `qr-${product.code.toLowerCase()}-x${safeQty}.pdf`,
    `${product.code} QR ×${safeQty}`
  );
  return 'pdf_exported';
}
