import * as XLSX from 'xlsx';
import type { InventorySummary, Language, Product } from '../types';

export function buildExcelBlob(
  products: Product[],
  summary: InventorySummary,
  currency: string,
  lang: Language
): Blob {
  const headers =
    lang === 'ar'
      ? [
          'الرمز',
          'اسم المنتج',
          'الوصف',
          'الطول (سم)',
          'العرض (سم)',
          'الارتفاع (سم)',
          'السماكة (سم)',
          'عدد القطع',
          'الكمية',
          `السعر المرجعي (${currency})`,
          `المصاريف (${currency})`,
          `سعر البيع (${currency})`,
          `القيمة الإجمالية (${currency})`,
          'عدد الصور',
          'تاريخ الإضافة',
        ]
      : [
          'Code',
          'Nom',
          'Description',
          'Longueur (cm)',
          'Largeur (cm)',
          'Hauteur (cm)',
          'Épaisseur (cm)',
          'Nombre de pièces',
          'Quantité',
          `Prix de référence (${currency})`,
          `Frais (${currency})`,
          `Prix de vente (${currency})`,
          `Valeur totale (${currency})`,
          'Nombre de photos',
          "Date d'ajout",
        ];

  const rows: Array<Array<string | number>> = [headers];

  let totalPhotos = 0;
  for (const item of products) {
    totalPhotos += item.photos.length;
    rows.push([
      item.code,
      item.name,
      item.description || '',
      item.lengthCm,
      item.widthCm,
      item.heightCm,
      item.thicknessCm,
      item.piecesCount,
      item.quantity,
      item.referencePrice,
      item.expenses,
      item.sellingPrice,
      item.sellingPrice * item.quantity,
      item.photos.length,
      item.addedDate,
    ]);
  }

  rows.push([
    lang === 'ar' ? 'المجموع' : 'TOTAL',
    lang === 'ar' ? `${summary.totalReferences} أصناف` : `${summary.totalReferences} références`,
    '',
    '',
    '',
    '',
    '',
    '',
    summary.totalUnits,
    summary.totalReferenceCost,
    '',
    '',
    summary.totalSellingValue,
    totalPhotos,
    '',
  ]);

  const workbook = XLSX.utils.book_new();
  if (lang === 'ar') {
    workbook.Workbook = { Views: [{ RTL: true }] };
  }

  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  worksheet['!cols'] = [
    { wch: 12 },
    { wch: 32 },
    { wch: 44 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 16 },
    { wch: 12 },
    { wch: 22 },
    { wch: 16 },
    { wch: 20 },
    { wch: 22 },
    { wch: 14 },
    { wch: 14 },
  ];

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Gestion Antiquites');
  const out = XLSX.write(workbook, {
    bookType: 'xlsx',
    type: 'array',
    compression: true,
  }) as ArrayBuffer;

  return new Blob([out], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}
