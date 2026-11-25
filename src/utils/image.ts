import type { Language, Product } from '../types';
import { formatCurrency } from '../i18n';

export function extractPrefixLetter(name: string): string {
  const normalized = name.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const match = normalized.match(/[A-Za-z0-9\u0600-\u06FF]/);
  if (!match) return 'A';
  const char = match[0];
  return /[a-z]/.test(char) ? char.toUpperCase() : char;
}

export function compressImageBlob(fileOrBlob: Blob, maxDimension = 1280, quality = 0.82): Promise<string> {
  const encodeImage = (img: HTMLImageElement, fallbackUrl?: string): string => {
    let { naturalWidth, naturalHeight, width, height } = img;
    let w = naturalWidth || width;
    let h = naturalHeight || height;
    if (w > maxDimension || h > maxDimension) {
      if (w >= h) {
        h = Math.round((h * maxDimension) / w);
        w = maxDimension;
      } else {
        w = Math.round((w * maxDimension) / h);
        h = maxDimension;
      }
    }
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, w);
    canvas.height = Math.max(1, h);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return fallbackUrl || '';
    }
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', quality);
  };

  return new Promise((resolve, reject) => {
    const readWithFileReader = () => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Failed to read image file'));
      reader.onload = () => {
        const dataUrl = String(reader.result || '');
        const img = new Image();
        img.onerror = () => reject(new Error('Failed to decode image'));
        img.onload = () => resolve(encodeImage(img, dataUrl));
        img.src = dataUrl;
      };
      reader.readAsDataURL(fileOrBlob);
    };

    if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
      const objectUrl = URL.createObjectURL(fileOrBlob);
      const img = new Image();
      img.onload = () => {
        try {
          const out = encodeImage(img);
          URL.revokeObjectURL(objectUrl);
          if (out) {
            resolve(out);
          } else {
            readWithFileReader();
          }
        } catch {
          URL.revokeObjectURL(objectUrl);
          readWithFileReader();
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        readWithFileReader();
      };
      img.src = objectUrl;
      return;
    }

    readWithFileReader();
  });
}

export function buildShareText(product: Product, currency: string, lang: Language): string {
  const priceText = formatCurrency(product.sellingPrice, currency, lang);
  if (lang === 'ar') {
    const dims = `${product.lengthCm} × ${product.widthCm} × ${product.heightCm} سم (السماكة: ${product.thicknessCm} سم · ${product.piecesCount} قطع)`;
    return [
      `إدارة التحف — [${product.code}]`,
      product.name,
      product.description ? `\n${product.description}` : '',
      `\nالأبعاد: ${dims}`,
      `سعر البيع: ${priceText}`,
    ]
      .filter(Boolean)
      .join('\n');
  }
  const dims = `L ${product.lengthCm} × l ${product.widthCm} × H ${product.heightCm} cm (Ép. ${product.thicknessCm} cm · ${product.piecesCount} pièce(s))`;
  return [
    `Gestion Antiquités — [${product.code}]`,
    product.name,
    product.description ? `\n${product.description}` : '',
    `\nDimensions : ${dims}`,
    `Prix de vente : ${priceText}`,
  ]
    .filter(Boolean)
    .join('\n');
}

export interface ShareableMediaFile {
  blob: Blob;
  filename: string;
  mimeType: string;
}

function sanitizeAsciiFilenamePart(input: string, fallback = 'item'): string {
  const ascii = input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return ascii || fallback;
}

function canvasEncodeJpeg(img: HTMLImageElement, quality = 0.92): Promise<Blob | null> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width || 1080;
    canvas.height = img.naturalHeight || img.height || 1080;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      resolve(null);
      return;
    }
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => resolve(blob), 'image/jpeg', quality);
  });
}

export function isVideoMedia(mediaData: string): boolean {
  if (!mediaData) return false;
  return (
    mediaData.startsWith('data:video/') ||
    /\.(mp4|webm|mov|m4v|3gp|mkv|avi)(\?|$)/i.test(mediaData)
  );
}

export function readVideoAsDataUrl(fileOrBlob: Blob, fallbackMime = 'video/mp4'): Promise<string> {
  return new Promise((resolve, reject) => {
    const cleanFallback = (fallbackMime.split(';')[0] || 'video/mp4').trim();
    const rawType = (fileOrBlob.type || '').split(';')[0].trim();
    const safeMime = rawType.startsWith('video/') ? rawType : cleanFallback;

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read video file'));
    reader.onload = () => {
      const result = String(reader.result || '');
      if (!result) {
        resolve('');
        return;
      }
      const base64Marker = ';base64,';
      const markerIdx = result.indexOf(base64Marker);
      if (markerIdx !== -1) {
        const prefix = result.slice(0, markerIdx);
        // Ensure clean data:video/... prefix without commas inside codecs or octet-stream MIME
        if (!prefix.startsWith('data:video/') || prefix.includes(',')) {
          resolve(`data:${safeMime}${result.slice(markerIdx)}`);
          return;
        }
      }
      resolve(result);
    };
    reader.readAsDataURL(fileOrBlob);
  });
}

export async function photoDataToBlob(
  imageData: string
): Promise<{ blob: Blob; ext: string; mimeType: string } | null> {
  if (!imageData) return null;

  try {
    const response = await fetch(imageData);
    if (response.ok) {
      const rawBlob = await response.blob();
      if (rawBlob.size > 0) {
        if (rawBlob.type.startsWith('video/')) {
          const cleanMime = rawBlob.type.split(';')[0] || 'video/mp4';
          const ext = cleanMime.includes('webm')
            ? 'webm'
            : cleanMime.includes('quicktime')
              ? 'mov'
              : 'mp4';
          return { blob: rawBlob, ext, mimeType: cleanMime };
        }
        if (rawBlob.type === 'image/png') {
          return { blob: rawBlob, ext: 'png', mimeType: 'image/png' };
        }
        if (rawBlob.type === 'image/jpeg' || rawBlob.type === 'image/jpg') {
          return { blob: rawBlob, ext: 'jpg', mimeType: 'image/jpeg' };
        }
        // Re-encode webp or untyped blobs to JPEG for maximum social/Android compatibility
        const objectUrl = URL.createObjectURL(rawBlob);
        try {
          const img = await new Promise<HTMLImageElement>((resolve, reject) => {
            const el = new Image();
            el.onload = () => resolve(el);
            el.onerror = reject;
            el.src = objectUrl;
          });
          const jpegBlob = await canvasEncodeJpeg(img);
          if (jpegBlob) {
            return { blob: jpegBlob, ext: 'jpg', mimeType: 'image/jpeg' };
          }
        } finally {
          URL.revokeObjectURL(objectUrl);
        }
      }
    }
  } catch {
    // fallback to Image element decoding below
  }

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.crossOrigin = 'anonymous';
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = imageData;
    });
    const jpegBlob = await canvasEncodeJpeg(img);
    if (jpegBlob) {
      return { blob: jpegBlob, ext: 'jpg', mimeType: 'image/jpeg' };
    }
  } catch {
    // ignore unrecoverable image
  }

  return null;
}

export async function buildAllProductPhotoFiles(product: Product): Promise<ShareableMediaFile[]> {
  const orderedPhotos = [...(product.photos || [])].sort(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
  );
  const baseCode = sanitizeAsciiFilenamePart(product.code || 'produit', 'produit');
  const results: ShareableMediaFile[] = [];

  for (let i = 0; i < orderedPhotos.length; i += 1) {
    const photo = orderedPhotos[i];
    const converted = await photoDataToBlob(photo.imageData);
    if (!converted) continue;

    const photoPart = sanitizeAsciiFilenamePart(
      photo.photoCode || `${baseCode}-${i + 1}`,
      `${baseCode}-${i + 1}`
    );
    const filename = `${photoPart}.${converted.ext}`;
    results.push({
      blob: converted.blob,
      filename,
      mimeType: converted.mimeType,
    });
  }

  return results;
}

function loadHtmlImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const el = new Image();
    el.crossOrigin = 'anonymous';
    el.onload = () => resolve(el);
    el.onerror = () => resolve(null);
    el.src = src;
  });
}

function extractVideoPosterImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.crossOrigin = 'anonymous';

    let settled = false;
    const finish = (img: HTMLImageElement | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      video.removeAttribute('src');
      video.load();
      resolve(img);
    };

    const timer = setTimeout(() => finish(null), 2500);

    const captureFrame = () => {
      try {
        const w = video.videoWidth || 640;
        const h = video.videoHeight || 480;
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          finish(null);
          return;
        }
        ctx.drawImage(video, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        void loadHtmlImage(dataUrl).then(finish);
      } catch {
        finish(null);
      }
    };

    video.onerror = () => finish(null);
    video.onloadeddata = () => {
      if (video.duration && Number.isFinite(video.duration) && video.duration > 0.4) {
        video.currentTime = Math.min(0.3, video.duration / 4);
      } else {
        captureFrame();
      }
    };
    video.onseeked = captureFrame;
    video.src = src;
  });
}

async function loadMediaCardImage(
  src: string
): Promise<{ img: HTMLImageElement | null; isVideo: boolean }> {
  if (isVideoMedia(src)) {
    const poster = await extractVideoPosterImage(src);
    return { img: poster, isVideo: true };
  }
  const img = await loadHtmlImage(src);
  return { img, isVideo: false };
}

function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number
): string[] {
  const cleaned = (text || '').trim();
  if (!cleaned) return [];

  const paragraphs = cleaned.split(/\r?\n/);
  const lines: string[] = [];

  for (const para of paragraphs) {
    const words = para.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) continue;

    let current = '';
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (ctx.measureText(candidate).width > maxWidth) {
        if (current) {
          lines.push(current);
          if (lines.length >= maxLines) return lines;
          current = word;
        } else {
          lines.push(word);
          if (lines.length >= maxLines) return lines;
          current = '';
        }
      } else {
        current = candidate;
      }
    }
    if (current) {
      lines.push(current);
      if (lines.length >= maxLines) return lines;
    }
  }

  return lines.slice(0, maxLines);
}

function drawRoundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function drawCoverPhotoBox(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  x: number,
  y: number,
  w: number,
  h: number,
  badgeText?: string,
  isRtl = false,
  isVideo = false
): void {
  ctx.save();
  drawRoundedRectPath(ctx, x, y, w, h, 20);
  ctx.fillStyle = isVideo ? '#0E241A' : '#E8F2EC';
  ctx.fill();
  ctx.clip();

  if (img && img.width > 0 && img.height > 0) {
    const scale = Math.max(w / img.width, h / img.height);
    const drawW = img.width * scale;
    const drawH = img.height * scale;
    const dx = x + (w - drawW) / 2;
    const dy = y + (h - drawH) / 2;
    ctx.drawImage(img, dx, dy, drawW, drawH);
  }

  if (isVideo) {
    const cx = x + w / 2;
    const cy = y + h / 2;
    const r = Math.min(w, h) * 0.14;
    ctx.fillStyle = 'rgba(11, 31, 22, 0.72)';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 3;
    ctx.stroke();

    const triOffset = r * 0.38;
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.moveTo(cx - triOffset * 0.65, cy - triOffset);
    ctx.lineTo(cx + triOffset * 1.15, cy);
    ctx.lineTo(cx - triOffset * 0.65, cy + triOffset);
    ctx.closePath();
    ctx.fill();
  }

  if (badgeText) {
    const label = isVideo ? `${badgeText} · VID` : badgeText;
    ctx.font = 'bold 20px monospace';
    const textW = ctx.measureText(label).width;
    const pillW = textW + 24;
    const pillH = 34;
    const pillX = isRtl ? x + w - pillW - 14 : x + 14;
    const pillY = y + 14;

    ctx.fillStyle = 'rgba(11, 31, 22, 0.72)';
    drawRoundedRectPath(ctx, pillX, pillY, pillW, pillH, 10);
    ctx.fill();

    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'left';
    ctx.direction = 'ltr';
    ctx.fillText(label, pillX + 12, pillY + 24);
  }

  ctx.restore();

  ctx.save();
  drawRoundedRectPath(ctx, x, y, w, h, 20);
  ctx.strokeStyle = '#CBE0D3';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

export async function renderProductShareCardBlob(
  product: Product,
  currency: string,
  lang: Language
): Promise<Blob | null> {
  const isRtl = lang === 'ar';
  const orderedPhotos = [...(product.photos || [])].sort(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
  );

  const loadedMedia = await Promise.all(orderedPhotos.map((p) => loadMediaCardImage(p.imageData)));

  const W = 1080;
  const PAD = 56;
  const CW = W - PAD * 2;
  const GAP = 16;
  const HEADER_H = 136;
  const photoStartY = HEADER_H + 34;

  // Compute photo collage boxes for 0, 1, 2, 3, 4, or 5+ media items
  interface PhotoSlot {
    x: number;
    y: number;
    w: number;
    h: number;
    img: HTMLImageElement | null;
    isVideo: boolean;
    code: string;
  }

  const slots: PhotoSlot[] = [];
  let photoSectionH = 0;

  if (orderedPhotos.length === 0) {
    photoSectionH = 260;
  } else if (orderedPhotos.length === 1) {
    const h = 580;
    slots.push({
      x: PAD,
      y: photoStartY,
      w: CW,
      h,
      img: loadedMedia[0].img,
      isVideo: loadedMedia[0].isVideo,
      code: orderedPhotos[0].photoCode || product.code,
    });
    photoSectionH = h;
  } else if (orderedPhotos.length === 2) {
    const colW = (CW - GAP) / 2;
    const h = 460;
    for (let i = 0; i < 2; i += 1) {
      slots.push({
        x: PAD + i * (colW + GAP),
        y: photoStartY,
        w: colW,
        h,
        img: loadedMedia[i].img,
        isVideo: loadedMedia[i].isVideo,
        code: orderedPhotos[i].photoCode,
      });
    }
    photoSectionH = h;
  } else if (orderedPhotos.length === 3) {
    const heroH = 420;
    const subH = 280;
    const colW = (CW - GAP) / 2;
    slots.push({
      x: PAD,
      y: photoStartY,
      w: CW,
      h: heroH,
      img: loadedMedia[0].img,
      isVideo: loadedMedia[0].isVideo,
      code: orderedPhotos[0].photoCode,
    });
    for (let i = 1; i < 3; i += 1) {
      slots.push({
        x: PAD + (i - 1) * (colW + GAP),
        y: photoStartY + heroH + GAP,
        w: colW,
        h: subH,
        img: loadedMedia[i].img,
        isVideo: loadedMedia[i].isVideo,
        code: orderedPhotos[i].photoCode,
      });
    }
    photoSectionH = heroH + GAP + subH;
  } else if (orderedPhotos.length === 4) {
    const colW = (CW - GAP) / 2;
    const rowH = 300;
    for (let i = 0; i < 4; i += 1) {
      const row = Math.floor(i / 2);
      const col = i % 2;
      slots.push({
        x: PAD + col * (colW + GAP),
        y: photoStartY + row * (rowH + GAP),
        w: colW,
        h: rowH,
        img: loadedMedia[i].img,
        isVideo: loadedMedia[i].isVideo,
        code: orderedPhotos[i].photoCode,
      });
    }
    photoSectionH = rowH * 2 + GAP;
  } else {
    const heroH = 390;
    const subH = 220;
    const colW = (CW - GAP * 2) / 3;
    slots.push({
      x: PAD,
      y: photoStartY,
      w: CW,
      h: heroH,
      img: loadedMedia[0].img,
      isVideo: loadedMedia[0].isVideo,
      code: orderedPhotos[0].photoCode,
    });
    const restCount = orderedPhotos.length - 1;
    const rows = Math.ceil(restCount / 3);
    for (let i = 1; i < orderedPhotos.length; i += 1) {
      const idx = i - 1;
      const row = Math.floor(idx / 3);
      const col = idx % 3;
      slots.push({
        x: PAD + col * (colW + GAP),
        y: photoStartY + heroH + GAP + row * (subH + GAP),
        w: colW,
        h: subH,
        img: loadedMedia[i].img,
        isVideo: loadedMedia[i].isVideo,
        code: orderedPhotos[i].photoCode,
      });
    }
    photoSectionH = heroH + rows * (subH + GAP);
  }

  // Measure text blocks before creating final canvas height
  const measureCanvas = document.createElement('canvas');
  const mCtx = measureCanvas.getContext('2d');
  if (!mCtx) return null;

  mCtx.font = 'bold 42px Georgia, serif';
  const titleLines = wrapCanvasText(mCtx, product.name, CW, 2);

  mCtx.font = '26px sans-serif';
  const descLines = wrapCanvasText(mCtx, product.description || '', CW, 6);

  const detailsStartY = photoStartY + photoSectionH + 46;
  const titleBlockH = Math.max(1, titleLines.length) * 52;
  const priceBlockH = 66;
  const specsBoxH = 112;
  const descBlockH = descLines.length > 0 ? descLines.length * 38 + 26 : 0;
  const footerH = 74;
  const totalH = Math.max(
    1180,
    detailsStartY + titleBlockH + priceBlockH + specsBoxH + descBlockH + footerH
  );

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = totalH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Clean heritage white & deep emerald palette
  ctx.fillStyle = '#F7FAF8';
  ctx.fillRect(0, 0, W, totalH);

  // Top emerald header band
  ctx.fillStyle = '#115E3B';
  ctx.fillRect(0, 0, W, HEADER_H);

  const headerAnchorX = isRtl ? W - PAD : PAD;
  const oppositeAnchorX = isRtl ? PAD : W - PAD;

  ctx.save();
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 40px Georgia, serif';
  ctx.textAlign = isRtl ? 'right' : 'left';
  ctx.direction = isRtl ? 'rtl' : 'ltr';
  ctx.fillText(isRtl ? 'إدارة التحف' : 'Gestion Antiquités', headerAnchorX, 68);

  ctx.font = '600 24px monospace';
  ctx.fillStyle = '#D1FAE5';
  ctx.textAlign = isRtl ? 'right' : 'left';
  ctx.direction = 'ltr';
  ctx.fillText(product.code, headerAnchorX, 108);

  if (orderedPhotos.length > 0) {
    const countLabel = isRtl
      ? `${orderedPhotos.length} صور`
      : `${orderedPhotos.length} photo${orderedPhotos.length > 1 ? 's' : ''}`;
    ctx.font = '600 22px sans-serif';
    ctx.fillStyle = '#ECF7F1';
    ctx.textAlign = isRtl ? 'left' : 'right';
    ctx.direction = isRtl ? 'rtl' : 'ltr';
    ctx.fillText(countLabel, oppositeAnchorX, 82);
  }
  ctx.restore();

  // Draw photos/videos (or clean placeholder)
  if (slots.length === 0) {
    drawCoverPhotoBox(ctx, null, PAD, photoStartY, CW, photoSectionH, product.code, isRtl, false);
  } else {
    for (const slot of slots) {
      drawCoverPhotoBox(
        ctx,
        slot.img,
        slot.x,
        slot.y,
        slot.w,
        slot.h,
        slot.code,
        isRtl,
        slot.isVideo
      );
    }
  }

  // Product Name
  let cursorY = detailsStartY;
  ctx.save();
  ctx.fillStyle = '#0B1F16';
  ctx.font = 'bold 42px Georgia, serif';
  ctx.textAlign = isRtl ? 'right' : 'left';
  ctx.direction = isRtl ? 'rtl' : 'ltr';
  const textX = isRtl ? W - PAD : PAD;

  for (const tLine of titleLines) {
    ctx.fillText(tLine, textX, cursorY);
    cursorY += 52;
  }

  // Selling Price
  cursorY += 12;
  ctx.fillStyle = '#115E3B';
  ctx.font = 'bold 44px sans-serif';
  ctx.fillText(formatCurrency(product.sellingPrice, currency, lang), textX, cursorY);
  cursorY += 34;

  // Dimensions & Stock Specs Box
  ctx.fillStyle = '#ECF7F1';
  drawRoundedRectPath(ctx, PAD, cursorY, CW, 92, 18);
  ctx.fill();
  ctx.strokeStyle = '#CBE0D3';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const specPadX = isRtl ? W - PAD - 24 : PAD + 24;
  ctx.fillStyle = '#115E3B';
  ctx.font = '600 24px sans-serif';
  const dimText = isRtl
    ? `الأبعاد: ${product.lengthCm} × ${product.widthCm} × ${product.heightCm} سم · السماكة: ${product.thicknessCm} سم · ${product.piecesCount} قطع`
    : `Dimensions : L ${product.lengthCm} × l ${product.widthCm} × H ${product.heightCm} cm · Ép. ${product.thicknessCm} cm · ${product.piecesCount} pièce(s)`;
  ctx.fillText(dimText, specPadX, cursorY + 38);

  ctx.fillStyle = '#335947';
  ctx.font = '500 22px sans-serif';
  const metaText = isRtl
    ? `الرمز: ${product.code} · الكمية المتوفرة: ${product.quantity}`
    : `Référence : ${product.code} · Quantité disponible : ${product.quantity}`;
  ctx.fillText(metaText, specPadX, cursorY + 72);

  cursorY += 126;

  // Description lines
  if (descLines.length > 0) {
    ctx.fillStyle = '#335947';
    ctx.font = '26px sans-serif';
    for (const dLine of descLines) {
      ctx.fillText(dLine, textX, cursorY);
      cursorY += 38;
    }
  }

  // Subtle footer divider
  const footerY = totalH - 36;
  ctx.strokeStyle = '#DCE7E0';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(PAD, footerY - 24);
  ctx.lineTo(W - PAD, footerY - 24);
  ctx.stroke();

  ctx.fillStyle = '#6B8A7A';
  ctx.font = '500 20px sans-serif';
  ctx.fillText(
    isRtl
      ? `إدارة التحف · بطاقة منتج (${product.code})`
      : `Gestion Antiquités · Fiche produit (${product.code})`,
    textX,
    footerY
  );
  ctx.restore();

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png');
  });
}

export async function buildProductCardFile(
  product: Product,
  currency: string,
  lang: Language
): Promise<ShareableMediaFile | null> {
  const cardBlob = await renderProductShareCardBlob(product, currency, lang);
  if (!cardBlob) return null;
  const safeCode = sanitizeAsciiFilenamePart(product.code || 'produit', 'produit');
  const safeName = sanitizeAsciiFilenamePart(product.name.slice(0, 24), 'fiche');
  return {
    blob: cardBlob,
    filename: `${safeCode}-${safeName}-carte.png`,
    mimeType: 'image/png',
  };
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to encode blob'));
    reader.onload = () => resolve(String(reader.result || ''));
    reader.readAsDataURL(blob);
  });
}

export function buildDefaultHashtags(product: Product, lang: Language): string {
  const codeTag = `#${sanitizeAsciiFilenamePart(product.code || 'Antiquite', 'Antiquite')}`;
  if (lang === 'ar') {
    return `#تحف #أنتيكات #تراث_مغربي #صناعة_تقليدية #ديكور_تراثي ${codeTag}`;
  }
  return `#Antiquités #ArtisanatMarocain #Patrimoine #DécorationAncienne #ObjetDArt ${codeTag}`;
}

export async function generateProductReelVideo(
  product: Product,
  currency: string,
  lang: Language
): Promise<{ blob: Blob; dataUrl: string; filename: string; mimeType: string } | null> {
  if (typeof MediaRecorder === 'undefined') return null;

  const isRtl = lang === 'ar';
  const orderedPhotos = [...(product.photos || [])].sort(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
  );
  const loaded = await Promise.all(orderedPhotos.map((p) => loadMediaCardImage(p.imageData)));
  const imgs = loaded.map((item) => item.img).filter((img): img is HTMLImageElement => Boolean(img));

  const W = 720;
  const H = 1280;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx || typeof canvas.captureStream !== 'function') return null;

  const mimeCandidates = ['video/mp4', 'video/webm;codecs=vp8', 'video/webm'];
  let chosenMime = '';
  for (const m of mimeCandidates) {
    try {
      if (MediaRecorder.isTypeSupported(m)) {
        chosenMime = m;
        break;
      }
    } catch {
      // ignore
    }
  }

  const stream = canvas.captureStream(24);
  const cleanMime = (chosenMime.split(';')[0] || 'video/webm').trim();
  let recorder: MediaRecorder;
  try {
    recorder = chosenMime
      ? new MediaRecorder(stream, { mimeType: chosenMime, videoBitsPerSecond: 2_200_000 })
      : new MediaRecorder(stream);
  } catch {
    recorder = new MediaRecorder(stream);
  }

  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  const durationMs = Math.max(3600, Math.min(6000, Math.max(1, imgs.length) * 1500));
  const priceText = formatCurrency(product.sellingPrice, currency, lang);

  const drawFrame = (progress: number) => {
    ctx.fillStyle = '#0B1F16';
    ctx.fillRect(0, 0, W, H);

    // Top heritage emerald banner
    ctx.fillStyle = '#115E3B';
    ctx.fillRect(0, 0, W, 150);

    ctx.save();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 34px Georgia, serif';
    ctx.textAlign = isRtl ? 'right' : 'left';
    ctx.direction = isRtl ? 'rtl' : 'ltr';
    const anchorX = isRtl ? W - 44 : 44;
    ctx.fillText(isRtl ? 'إدارة التحف' : 'Gestion Antiquités', anchorX, 74);

    ctx.fillStyle = '#A7F3D0';
    ctx.font = '600 24px monospace';
    ctx.direction = 'ltr';
    ctx.fillText(product.code, anchorX, 116);
    ctx.restore();

    // Central showcase stage with subtle zoom transition across product images
    const stageX = 36;
    const stageY = 185;
    const stageW = W - 72;
    const stageH = 740;

    ctx.save();
    drawRoundedRectPath(ctx, stageX, stageY, stageW, stageH, 28);
    ctx.fillStyle = '#132B20';
    ctx.fill();
    ctx.clip();

    if (imgs.length > 0) {
      const floatIdx = progress * imgs.length;
      const idx = Math.min(imgs.length - 1, Math.floor(floatIdx));
      const localProgress = floatIdx - idx;
      const img = imgs[idx];
      const baseScale = Math.max(stageW / img.width, stageH / img.height);
      const zoom = 1 + localProgress * 0.06;
      const drawW = img.width * baseScale * zoom;
      const drawH = img.height * baseScale * zoom;
      const dx = stageX + (stageW - drawW) / 2;
      const dy = stageY + (stageH - drawH) / 2;
      ctx.drawImage(img, dx, dy, drawW, drawH);
    }
    ctx.restore();

    ctx.save();
    drawRoundedRectPath(ctx, stageX, stageY, stageW, stageH, 28);
    ctx.strokeStyle = '#34D399';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();

    // Bottom info card
    ctx.save();
    ctx.fillStyle = '#ECF7F1';
    drawRoundedRectPath(ctx, 36, 955, W - 72, 275, 28);
    ctx.fill();

    ctx.fillStyle = '#0B1F16';
    ctx.font = 'bold 34px Georgia, serif';
    ctx.textAlign = isRtl ? 'right' : 'left';
    ctx.direction = isRtl ? 'rtl' : 'ltr';
    const cardAnchor = isRtl ? W - 68 : 68;
    const titleLines = wrapCanvasText(ctx, product.name, W - 140, 2);
    let textY = 1020;
    for (const line of titleLines) {
      ctx.fillText(line, cardAnchor, textY);
      textY += 44;
    }

    ctx.fillStyle = '#115E3B';
    ctx.font = 'bold 42px sans-serif';
    ctx.fillText(priceText, cardAnchor, 1135);

    ctx.fillStyle = '#335947';
    ctx.font = '600 22px sans-serif';
    const dims = isRtl
      ? `${product.lengthCm} × ${product.widthCm} × ${product.heightCm} سم`
      : `L ${product.lengthCm} × l ${product.widthCm} × H ${product.heightCm} cm`;
    ctx.fillText(dims, cardAnchor, 1190);
    ctx.restore();
  };

  drawFrame(0);

  return new Promise((resolve) => {
    recorder.onstop = async () => {
      stream.getTracks().forEach((track) => track.stop());
      const videoBlob = new Blob(chunks, { type: cleanMime });
      if (videoBlob.size === 0) {
        resolve(null);
        return;
      }
      const dataUrl = await readVideoAsDataUrl(videoBlob, cleanMime);
      const safeCode = sanitizeAsciiFilenamePart(product.code || 'reel', 'reel');
      const ext = cleanMime.includes('mp4') ? 'mp4' : 'webm';
      resolve({
        blob: videoBlob,
        dataUrl,
        filename: `${safeCode}-reel.${ext}`,
        mimeType: cleanMime,
      });
    };

    try {
      recorder.start(250);
    } catch {
      recorder.start();
    }

    const startTime = performance.now();
    const tick = () => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(1, elapsed / durationMs);
      drawFrame(progress);
      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        setTimeout(() => {
          if (recorder.state !== 'inactive') {
            try {
              recorder.stop();
            } catch {
              resolve(null);
            }
          }
        }, 120);
      }
    };
    requestAnimationFrame(tick);
  });
}
