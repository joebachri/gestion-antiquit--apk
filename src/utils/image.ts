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
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to decode image'));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          if (width >= height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(String(reader.result));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(fileOrBlob);
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

export async function renderProductShareCardBlob(
  product: Product,
  currency: string,
  lang: Language
): Promise<Blob | null> {
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1280;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Clean heritage white & deep emerald palette
  ctx.fillStyle = '#F7FAF8';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Top emerald header band
  ctx.fillStyle = '#115E3B';
  ctx.fillRect(0, 0, canvas.width, 136);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 40px Georgia, serif';
  ctx.fillText(lang === 'ar' ? 'إدارة التحف' : 'Gestion Antiquités', 56, 72);
  ctx.font = '600 24px monospace';
  ctx.fillStyle = '#D1FAE5';
  ctx.fillText(product.code, 56, 110);

  // Photo container
  const imgX = 56;
  const imgY = 176;
  const imgW = 968;
  const imgH = 620;

  ctx.fillStyle = '#E8F2EC';
  ctx.fillRect(imgX, imgY, imgW, imgH);

  const primaryPhoto = product.photos[0]?.imageData;
  if (primaryPhoto) {
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.crossOrigin = 'anonymous';
        el.onload = () => resolve(el);
        el.onerror = reject;
        el.src = primaryPhoto;
      });
      const scale = Math.max(imgW / img.width, imgH / img.height);
      const drawW = img.width * scale;
      const drawH = img.height * scale;
      const dx = imgX + (imgW - drawW) / 2;
      const dy = imgY + (imgH - drawH) / 2;
      ctx.save();
      ctx.beginPath();
      ctx.rect(imgX, imgY, imgW, imgH);
      ctx.clip();
      ctx.drawImage(img, dx, dy, drawW, drawH);
      ctx.restore();
    } catch {
      // keep clean stone placeholder
    }
  }

  // Product details area
  ctx.fillStyle = '#0B1F16';
  ctx.font = 'bold 42px Georgia, serif';
  ctx.fillText(product.name.slice(0, 44), 56, 868);

  // Selling Price
  ctx.fillStyle = '#115E3B';
  ctx.font = 'bold 44px sans-serif';
  ctx.fillText(formatCurrency(product.sellingPrice, currency, lang), 56, 932);

  // Dimensions line
  ctx.fillStyle = '#335947';
  ctx.font = '600 25px sans-serif';
  const dimText =
    lang === 'ar'
      ? `الأبعاد: ${product.lengthCm} × ${product.widthCm} × ${product.heightCm} سم · السماكة ${product.thicknessCm} سم · ${product.piecesCount} قطع`
      : `Dimensions : L ${product.lengthCm} × l ${product.widthCm} × H ${product.heightCm} cm · Ép. ${product.thicknessCm} cm · ${product.piecesCount} p.`;
  ctx.fillText(dimText, 56, 990);

  // Description wrap (max 4 lines)
  ctx.fillStyle = '#476656';
  ctx.font = '26px sans-serif';
  const words = (product.description || '').split(/\s+/);
  let line = '';
  let y = 1052;
  let lineCount = 0;
  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    if (ctx.measureText(testLine).width > 968) {
      ctx.fillText(line, 56, y);
      line = word;
      y += 38;
      lineCount += 1;
      if (lineCount >= 4) break;
    } else {
      line = testLine;
    }
  }
  if (line && lineCount < 4) {
    ctx.fillText(line, 56, y);
  }

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png');
  });
}
