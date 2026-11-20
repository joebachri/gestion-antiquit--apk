import * as XLSX from 'xlsx';
import type { InventorySummary, Language, Product } from '../types';
import { convertFromMad } from './currency';

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
          'رمز QR',
          'اسم المنتج',
          'المورد',
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
          'Code QR',
          'Nom',
          'Fournisseur',
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
      item.qrToken || `GA-QR-${item.code}`,
      item.name,
      item.supplier || '',
      item.description || '',
      item.lengthCm,
      item.widthCm,
      item.heightCm,
      item.thicknessCm,
      item.piecesCount,
      item.quantity,
      convertFromMad(item.referencePrice, currency),
      convertFromMad(item.expenses, currency),
      convertFromMad(item.sellingPrice, currency),
      convertFromMad(item.sellingPrice * item.quantity, currency),
      item.photos.length,
      item.addedDate,
    ]);
  }

  rows.push([
    lang === 'ar' ? 'المجموع' : 'TOTAL',
    '',
    lang === 'ar' ? `${summary.totalReferences} أصناف` : `${summary.totalReferences} références`,
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    summary.totalUnits,
    convertFromMad(summary.totalReferenceCost, currency),
    '',
    '',
    convertFromMad(summary.totalSellingValue, currency),
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
    { wch: 16 },
    { wch: 32 },
    { wch: 24 },
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

function getCustomerCategoryExportLabel(category: string, lang: Language): string {
  if (lang === 'ar') {
    if (category === 'seller') return 'بائع / تاجر';
    if (category === 'hobbyist') return 'هاوٍ / جامع تحف';
    if (category === 'regular') return 'عميل دائم';
    return 'أخرى';
  }
  if (category === 'seller') return 'Vendeur / Revendeur';
  if (category === 'hobbyist') return 'Amateur / Collectionneur';
  if (category === 'regular') return 'Client régulier';
  return 'Autre';
}

function getPaymentMethodExportLabel(method: string, lang: Language): string {
  if (lang === 'ar') {
    if (method === 'cash') return 'نقداً';
    if (method === 'transfer') return 'تحويل بنكي';
    if (method === 'check') return 'شيك';
    if (method === 'card') return 'بطاقة بنكية';
    return 'أخرى';
  }
  if (method === 'cash') return 'Espèces';
  if (method === 'transfer') return 'Virement';
  if (method === 'check') return 'Chèque';
  if (method === 'card') return 'Carte bancaire';
  return 'Autre';
}

export function buildCustomersExcelBlob(
  customers: import('../types').Customer[],
  currency: string,
  lang: Language
): Blob {
  const profileHeaders =
    lang === 'ar'
      ? [
          'رمز العميل',
          'الاسم الكامل',
          'الفئة',
          'رقم الهاتف',
          'المدينة',
          'العنوان',
          'فيسبوك',
          'إنستغرام',
          'الموقع الإلكتروني',
          'عدد المشتريات',
          `إجمالي المشتريات (${currency})`,
          'آخر شراء',
          'ملاحظات',
        ]
      : [
          'Code Client',
          'Nom complet',
          'Catégorie',
          'Téléphone',
          'Ville',
          'Adresse',
          'Facebook',
          'Instagram',
          'Site web',
          "Nb d'achats",
          `Total acheté (${currency})`,
          'Dernier achat',
          'Notes',
        ];

  const profileRows: Array<Array<string | number>> = [profileHeaders];
  let grandPurchasesCount = 0;
  let grandRevenueMad = 0;

  for (const cust of customers) {
    const purchases = cust.purchases || [];
    const totalMad = purchases.reduce((sum, p) => sum + (Number(p.totalPrice) || 0), 0);
    const lastDate = purchases
      .map((p) => p.purchaseDate)
      .filter(Boolean)
      .sort()
      .pop() || '';
    grandPurchasesCount += purchases.length;
    grandRevenueMad += totalMad;

    profileRows.push([
      cust.code,
      cust.name,
      getCustomerCategoryExportLabel(cust.category, lang),
      cust.phone || '',
      cust.city || '',
      cust.address || '',
      cust.facebookUrl || '',
      cust.instagramUrl || '',
      cust.websiteUrl || '',
      purchases.length,
      convertFromMad(totalMad, currency),
      lastDate,
      cust.notes || '',
    ]);
  }

  profileRows.push([
    lang === 'ar' ? 'المجموع' : 'TOTAL',
    lang === 'ar' ? `${customers.length} عملاء` : `${customers.length} client(s)`,
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    grandPurchasesCount,
    convertFromMad(grandRevenueMad, currency),
    '',
    '',
  ]);

  const purchaseHeaders =
    lang === 'ar'
      ? [
          'رمز العميل',
          'اسم العميل',
          'رقم الهاتف',
          'المدينة',
          'الفئة',
          'تاريخ الشراء',
          'رمز المنتج',
          'اسم المنتج',
          'الكمية',
          `سعر الوحدة (${currency})`,
          `المجموع (${currency})`,
          'طريقة الدفع',
          'تفاصيل',
        ]
      : [
          'Code Client',
          'Nom Client',
          'Téléphone',
          'Ville',
          'Catégorie',
          "Date d'achat",
          'Code Produit',
          'Nom Produit',
          'Quantité',
          `Prix unitaire (${currency})`,
          `Total (${currency})`,
          'Paiement',
          'Détails',
        ];

  const purchaseRows: Array<Array<string | number>> = [purchaseHeaders];
  let totalQty = 0;
  let totalPurchasesMad = 0;

  for (const cust of customers) {
    for (const p of cust.purchases || []) {
      totalQty += Number(p.quantity) || 0;
      totalPurchasesMad += Number(p.totalPrice) || 0;
      purchaseRows.push([
        cust.code,
        cust.name,
        cust.phone || '',
        cust.city || '',
        getCustomerCategoryExportLabel(cust.category, lang),
        p.purchaseDate,
        p.productCode || '',
        p.productName,
        p.quantity,
        convertFromMad(p.unitPrice, currency),
        convertFromMad(p.totalPrice, currency),
        getPaymentMethodExportLabel(p.paymentMethod, lang),
        p.notes || '',
      ]);
    }
  }

  purchaseRows.push([
    lang === 'ar' ? 'المجموع' : 'TOTAL',
    '',
    '',
    '',
    '',
    '',
    '',
    lang === 'ar' ? `${grandPurchasesCount} عمليات` : `${grandPurchasesCount} achat(s)`,
    totalQty,
    '',
    convertFromMad(totalPurchasesMad, currency),
    '',
    '',
  ]);

  const workbook = XLSX.utils.book_new();
  if (lang === 'ar') {
    workbook.Workbook = { Views: [{ RTL: true }] };
  }

  const profileSheet = XLSX.utils.aoa_to_sheet(profileRows);
  profileSheet['!cols'] = [
    { wch: 13 },
    { wch: 24 },
    { wch: 22 },
    { wch: 18 },
    { wch: 16 },
    { wch: 30 },
    { wch: 24 },
    { wch: 22 },
    { wch: 26 },
    { wch: 14 },
    { wch: 20 },
    { wch: 14 },
    { wch: 30 },
  ];

  const purchaseSheet = XLSX.utils.aoa_to_sheet(purchaseRows);
  purchaseSheet['!cols'] = [
    { wch: 13 },
    { wch: 22 },
    { wch: 18 },
    { wch: 15 },
    { wch: 20 },
    { wch: 14 },
    { wch: 13 },
    { wch: 28 },
    { wch: 10 },
    { wch: 18 },
    { wch: 18 },
    { wch: 16 },
    { wch: 28 },
  ];

  XLSX.utils.book_append_sheet(
    workbook,
    profileSheet,
    lang === 'ar' ? 'ملفات العملاء' : 'Profils Clients'
  );
  XLSX.utils.book_append_sheet(
    workbook,
    purchaseSheet,
    lang === 'ar' ? 'سجل المشتريات' : 'Historique Achats'
  );

  const out = XLSX.write(workbook, {
    bookType: 'xlsx',
    type: 'array',
    compression: true,
  }) as ArrayBuffer;

  return new Blob([out], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

