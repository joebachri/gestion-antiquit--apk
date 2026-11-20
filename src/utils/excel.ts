import * as XLSX from 'xlsx';
import type { Customer, InventorySummary, Language, PosInvoice, Product } from '../types';
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

export function buildSalesReportExcelBlob(
  invoices: PosInvoice[],
  summary: {
    totalInvoices: number;
    totalUnitsSold: number;
    totalRevenueMad: number;
    totalProfitMad: number;
  },
  currency: string,
  lang: Language
): Blob {
  const isAr = lang === 'ar';
  let totalCostMad = 0;
  const byPayment = new Map<string, { count: number; units: number; revenueMad: number }>();
  const byProduct = new Map<
    string,
    { code: string; name: string; count: number; units: number; revenueMad: number; costMad: number }
  >();

  for (const inv of invoices) {
    const qty = Number(inv.quantity) || 0;
    const rev = Number(inv.totalPrice) || 0;
    const cost = (Number(inv.purchasePrice) || 0) * qty;
    totalCostMad += cost;

    const pKey = inv.paymentMethod || 'cash';
    const payEntry = byPayment.get(pKey) || { count: 0, units: 0, revenueMad: 0 };
    payEntry.count += 1;
    payEntry.units += qty;
    payEntry.revenueMad += rev;
    byPayment.set(pKey, payEntry);

    const prodKey = inv.productCode || inv.productId;
    const prodEntry = byProduct.get(prodKey) || {
      code: inv.productCode,
      name: inv.productName,
      count: 0,
      units: 0,
      revenueMad: 0,
      costMad: 0,
    };
    prodEntry.count += 1;
    prodEntry.units += qty;
    prodEntry.revenueMad += rev;
    prodEntry.costMad += cost;
    byProduct.set(prodKey, prodEntry);
  }

  const netProfitMad = summary.totalRevenueMad - totalCostMad;
  const marginPct =
    summary.totalRevenueMad > 0
      ? Math.round((netProfitMad / summary.totalRevenueMad) * 1000) / 10
      : 0;
  const avgInvoiceMad =
    summary.totalInvoices > 0 ? summary.totalRevenueMad / summary.totalInvoices : 0;

  const summaryRows: Array<Array<string | number>> = [
    [
      isAr ? 'تقرير وميزانية المبيعات التفصيلي' : 'BILAN DÉTAILLÉ DES VENTES (POS)',
      '',
      isAr ? `العملة: ${currency}` : `Devise: ${currency}`,
      new Date().toISOString().slice(0, 10),
    ],
    [],
    [isAr ? 'المؤشر' : 'Indicateur', isAr ? 'القيمة' : 'Valeur'],
    [isAr ? 'إجمالي الفواتير' : 'Factures émises', summary.totalInvoices],
    [isAr ? 'إجمالي القطع المباعة' : 'Unités vendues', summary.totalUnitsSold],
    [
      isAr ? `إجمالي المبيعات (${currency})` : `Chiffre d'affaires total (${currency})`,
      convertFromMad(summary.totalRevenueMad, currency),
    ],
    [
      isAr ? `إجمالي تكلفة الشراء (${currency})` : `Coût d'achat total (${currency})`,
      convertFromMad(totalCostMad, currency),
    ],
    [
      isAr ? `صافي الربح التقديري (${currency})` : `Bénéfice net estimé (${currency})`,
      convertFromMad(netProfitMad, currency),
    ],
    [isAr ? 'نسبة هامش الربح (%)' : 'Taux de marge (%)', `${marginPct}%`],
    [
      isAr ? `متوسط الفاتورة (${currency})` : `Panier moyen par facture (${currency})`,
      convertFromMad(avgInvoiceMad, currency),
    ],
    [],
    [
      isAr ? 'التوزيع حسب طريقة الدفع' : 'Répartition par mode de paiement',
      isAr ? 'الفواتير' : 'Factures',
      isAr ? 'القطع' : 'Unités',
      isAr ? `المبلغ (${currency})` : `Montant (${currency})`,
    ],
  ];

  for (const [method, data] of byPayment.entries()) {
    summaryRows.push([
      getPaymentMethodExportLabel(method, lang),
      data.count,
      data.units,
      convertFromMad(data.revenueMad, currency),
    ]);
  }

  summaryRows.push([]);
  summaryRows.push([
    isAr ? 'رمز المنتج' : 'Code Produit',
    isAr ? 'اسم المنتج' : 'Produit',
    isAr ? 'عدد الفواتير' : 'Ventes',
    isAr ? 'الكمية المباعة' : 'Quantité',
    isAr ? `إجمالي المبيعات (${currency})` : `CA (${currency})`,
    isAr ? `التكلفة (${currency})` : `Coût (${currency})`,
    isAr ? `الربح (${currency})` : `Marge (${currency})`,
  ]);

  for (const prod of Array.from(byProduct.values()).sort((a, b) => b.revenueMad - a.revenueMad)) {
    summaryRows.push([
      prod.code,
      prod.name,
      prod.count,
      prod.units,
      convertFromMad(prod.revenueMad, currency),
      convertFromMad(prod.costMad, currency),
      convertFromMad(prod.revenueMad - prod.costMad, currency),
    ]);
  }

  const detailHeaders = isAr
    ? [
        'رقم الفاتورة',
        'تاريخ البيع',
        'رمز المنتج',
        'اسم المنتج',
        'العميل',
        'الهاتف',
        'طريقة الدفع',
        'الكمية',
        `سعر الوحدة (${currency})`,
        `إجمالي المبيع (${currency})`,
        `التكلفة الإجمالية (${currency})`,
        `صافي الربح (${currency})`,
        'ملاحظات',
      ]
    : [
        'N° Facture',
        'Date',
        'Code Produit',
        'Produit',
        'Client',
        'Téléphone',
        'Paiement',
        'Quantité',
        `Prix unitaire (${currency})`,
        `Total vente (${currency})`,
        `Coût total (${currency})`,
        `Marge nette (${currency})`,
        'Notes',
      ];

  const detailRows: Array<Array<string | number>> = [detailHeaders];
  for (const inv of invoices) {
    const qty = Number(inv.quantity) || 0;
    const lineCost = (Number(inv.purchasePrice) || 0) * qty;
    detailRows.push([
      inv.invoiceNumber,
      inv.saleDate,
      inv.productCode,
      inv.productName,
      inv.customerName || (isAr ? 'عميل عابر' : 'Client de passage'),
      inv.customerPhone || '',
      getPaymentMethodExportLabel(inv.paymentMethod, lang),
      qty,
      convertFromMad(inv.unitPrice, currency),
      convertFromMad(inv.totalPrice, currency),
      convertFromMad(lineCost, currency),
      convertFromMad(inv.totalPrice - lineCost, currency),
      inv.notes || '',
    ]);
  }

  detailRows.push([
    isAr ? 'المجموع' : 'TOTAL',
    '',
    '',
    isAr ? `${summary.totalInvoices} فاتورة` : `${summary.totalInvoices} facture(s)`,
    '',
    '',
    '',
    summary.totalUnitsSold,
    '',
    convertFromMad(summary.totalRevenueMad, currency),
    convertFromMad(totalCostMad, currency),
    convertFromMad(netProfitMad, currency),
    '',
  ]);

  const workbook = XLSX.utils.book_new();
  if (isAr) {
    workbook.Workbook = { Views: [{ RTL: true }] };
  }

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
  summarySheet['!cols'] = [
    { wch: 30 },
    { wch: 28 },
    { wch: 14 },
    { wch: 16 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
  ];

  const detailSheet = XLSX.utils.aoa_to_sheet(detailRows);
  detailSheet['!cols'] = [
    { wch: 16 },
    { wch: 13 },
    { wch: 13 },
    { wch: 28 },
    { wch: 22 },
    { wch: 16 },
    { wch: 16 },
    { wch: 10 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 26 },
  ];

  XLSX.utils.book_append_sheet(workbook, summarySheet, isAr ? 'ميزانية المبيعات' : 'Bilan Ventes');
  XLSX.utils.book_append_sheet(
    workbook,
    detailSheet,
    isAr ? 'تفاصيل الفواتير' : 'Détail Factures'
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

export function buildPurchasesReportExcelBlob(
  customers: Customer[],
  currency: string,
  lang: Language
): Blob {
  const isAr = lang === 'ar';
  let activeCustomersCount = 0;
  let totalPurchases = 0;
  let totalUnits = 0;
  let totalRevenueMad = 0;

  const byPayment = new Map<string, { count: number; units: number; amountMad: number }>();
  const byCategory = new Map<
    string,
    { customers: number; count: number; units: number; amountMad: number }
  >();

  for (const cust of customers) {
    const purchases = cust.purchases || [];
    if (purchases.length > 0) activeCustomersCount += 1;

    const catEntry = byCategory.get(cust.category) || {
      customers: 0,
      count: 0,
      units: 0,
      amountMad: 0,
    };
    catEntry.customers += 1;

    for (const p of purchases) {
      const qty = Number(p.quantity) || 0;
      const amt = Number(p.totalPrice) || 0;
      totalPurchases += 1;
      totalUnits += qty;
      totalRevenueMad += amt;

      catEntry.count += 1;
      catEntry.units += qty;
      catEntry.amountMad += amt;

      const payKey = p.paymentMethod || 'cash';
      const payEntry = byPayment.get(payKey) || { count: 0, units: 0, amountMad: 0 };
      payEntry.count += 1;
      payEntry.units += qty;
      payEntry.amountMad += amt;
      byPayment.set(payKey, payEntry);
    }

    byCategory.set(cust.category, catEntry);
  }

  const avgPurchaseMad = totalPurchases > 0 ? totalRevenueMad / totalPurchases : 0;

  const summaryRows: Array<Array<string | number>> = [
    [
      isAr ? 'التقرير التفصيلي لمشتريات العملاء' : 'BILAN DÉTAILLÉ DES ACHATS CLIENTS',
      '',
      isAr ? `العملة: ${currency}` : `Devise: ${currency}`,
      new Date().toISOString().slice(0, 10),
    ],
    [],
    [isAr ? 'المؤشر' : 'Indicateur', isAr ? 'القيمة' : 'Valeur'],
    [isAr ? 'إجمالي العملاء' : 'Total clients', customers.length],
    [isAr ? 'العملاء المشترون' : 'Clients acheteurs', activeCustomersCount],
    [isAr ? 'عدد عمليات الشراء' : 'Nombre d’achats', totalPurchases],
    [isAr ? 'إجمالي القطع المشتراة' : 'Unités achetées', totalUnits],
    [
      isAr ? `إجمالي مبلغ المشتريات (${currency})` : `Montant total des achats (${currency})`,
      convertFromMad(totalRevenueMad, currency),
    ],
    [
      isAr ? `متوسط عملية الشراء (${currency})` : `Achat moyen (${currency})`,
      convertFromMad(avgPurchaseMad, currency),
    ],
    [],
    [
      isAr ? 'التوزيع حسب طريقة الدفع' : 'Répartition par mode de paiement',
      isAr ? 'العمليات' : 'Achats',
      isAr ? 'القطع' : 'Unités',
      isAr ? `المبلغ (${currency})` : `Montant (${currency})`,
    ],
  ];

  for (const [method, data] of byPayment.entries()) {
    summaryRows.push([
      getPaymentMethodExportLabel(method, lang),
      data.count,
      data.units,
      convertFromMad(data.amountMad, currency),
    ]);
  }

  summaryRows.push([]);
  summaryRows.push([
    isAr ? 'التوزيع حسب فئة العميل' : 'Répartition par catégorie client',
    isAr ? 'العملاء' : 'Clients',
    isAr ? 'العمليات' : 'Achats',
    isAr ? 'القطع' : 'Unités',
    isAr ? `المبلغ (${currency})` : `Montant (${currency})`,
  ]);

  for (const [cat, data] of byCategory.entries()) {
    summaryRows.push([
      getCustomerCategoryExportLabel(cat, lang),
      data.customers,
      data.count,
      data.units,
      convertFromMad(data.amountMad, currency),
    ]);
  }

  const purchaseHeaders = isAr
    ? [
        'رمز العميل',
        'اسم العميل',
        'الفئة',
        'الهاتف',
        'تاريخ الشراء',
        'رمز المنتج',
        'اسم المنتج',
        'الكمية',
        `سعر الوحدة (${currency})`,
        `المجموع (${currency})`,
        'طريقة الدفع',
        'ملاحظات',
      ]
    : [
        'Code Client',
        'Client',
        'Catégorie',
        'Téléphone',
        "Date d'achat",
        'Code Produit',
        'Produit',
        'Quantité',
        `Prix unitaire (${currency})`,
        `Total (${currency})`,
        'Paiement',
        'Détails',
      ];

  const purchaseRows: Array<Array<string | number>> = [purchaseHeaders];
  for (const cust of customers) {
    for (const p of cust.purchases || []) {
      purchaseRows.push([
        cust.code,
        cust.name,
        getCustomerCategoryExportLabel(cust.category, lang),
        cust.phone || '',
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
    isAr ? 'المجموع' : 'TOTAL',
    '',
    '',
    '',
    '',
    '',
    isAr ? `${totalPurchases} عملية` : `${totalPurchases} achat(s)`,
    totalUnits,
    '',
    convertFromMad(totalRevenueMad, currency),
    '',
    '',
  ]);

  const workbook = XLSX.utils.book_new();
  if (isAr) {
    workbook.Workbook = { Views: [{ RTL: true }] };
  }

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
  summarySheet['!cols'] = [{ wch: 32 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 22 }];

  const detailSheet = XLSX.utils.aoa_to_sheet(purchaseRows);
  detailSheet['!cols'] = [
    { wch: 13 },
    { wch: 22 },
    { wch: 20 },
    { wch: 16 },
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
    summarySheet,
    isAr ? 'ميزانية المشتريات' : 'Bilan Achats'
  );
  XLSX.utils.book_append_sheet(
    workbook,
    detailSheet,
    isAr ? 'تفاصيل المشتريات' : 'Détail Achats'
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

export function buildStockPurchasesExcelBlob(
  products: Product[],
  currency: string,
  lang: Language
): Blob {
  const isAr = lang === 'ar';
  let totalStockUnits = 0;
  let baseCostMad = 0;
  let expensesMad = 0;
  let totalInvestedMad = 0;
  let totalSellingMad = 0;

  const bySupplier = new Map<
    string,
    { refs: number; units: number; baseCostMad: number; expensesMad: number; totalCostMad: number }
  >();

  for (const prod of products) {
    const qty = Math.max(0, Number(prod.quantity) || 0);
    const refUnit = Number(prod.referencePrice) || 0;
    const expUnit = Number(prod.expenses) || 0;
    const unitCost = refUnit + expUnit;
    const calcQty = qty > 0 ? qty : 1;

    totalStockUnits += qty;
    baseCostMad += refUnit * qty;
    expensesMad += expUnit * qty;
    totalInvestedMad += unitCost * qty;
    totalSellingMad += (Number(prod.sellingPrice) || 0) * qty;

    const supName = (prod.supplier || '').trim() || (isAr ? 'مورد غير محدد' : 'Non renseigné');
    const supEntry = bySupplier.get(supName) || {
      refs: 0,
      units: 0,
      baseCostMad: 0,
      expensesMad: 0,
      totalCostMad: 0,
    };
    supEntry.refs += 1;
    supEntry.units += qty;
    supEntry.baseCostMad += refUnit * calcQty;
    supEntry.expensesMad += expUnit * calcQty;
    supEntry.totalCostMad += unitCost * calcQty;
    bySupplier.set(supName, supEntry);
  }

  const summaryRows: Array<Array<string | number>> = [
    [
      isAr
        ? 'التقرير التفصيلي لمشتريات المخزون والموردين'
        : 'BILAN DÉTAILLÉ DES ACHATS STOCK & FOURNISSEURS',
      '',
      isAr ? `العملة: ${currency}` : `Devise: ${currency}`,
      new Date().toISOString().slice(0, 10),
    ],
    [],
    [isAr ? 'المؤشر' : 'Indicateur', isAr ? 'القيمة' : 'Valeur'],
    [isAr ? 'إجمالي الأصناف' : 'Références enregistrées', products.length],
    [isAr ? 'الوحدات المتوفرة بالمخزون' : 'Unités en stock', totalStockUnits],
    [
      isAr ? `تكلفة الشراء الأساسية (${currency})` : `Coût d'achat de base (${currency})`,
      convertFromMad(baseCostMad, currency),
    ],
    [
      isAr ? `إجمالي المصاريف (${currency})` : `Total des frais (${currency})`,
      convertFromMad(expensesMad, currency),
    ],
    [
      isAr ? `التكلفة الإجمالية المستثمرة (${currency})` : `Coût total investi (${currency})`,
      convertFromMad(totalInvestedMad, currency),
    ],
    [
      isAr ? `قيمة البيع المقدرة (${currency})` : `Valeur de vente estimée (${currency})`,
      convertFromMad(totalSellingMad, currency),
    ],
    [
      isAr ? `هامش الربح المتوقع (${currency})` : `Marge brute potentielle (${currency})`,
      convertFromMad(totalSellingMad - totalInvestedMad, currency),
    ],
    [],
    [
      isAr ? 'المورد' : 'Fournisseur',
      isAr ? 'عدد الأصناف' : 'Articles',
      isAr ? 'الوحدات بالمخزون' : 'Unités stock',
      isAr ? `سعر الشراء (${currency})` : `Achat base (${currency})`,
      isAr ? `المصاريف (${currency})` : `Frais (${currency})`,
      isAr ? `الإجمالي (${currency})` : `Coût total (${currency})`,
    ],
  ];

  for (const [sup, data] of Array.from(bySupplier.entries()).sort(
    (a, b) => b[1].totalCostMad - a[1].totalCostMad
  )) {
    summaryRows.push([
      sup,
      data.refs,
      data.units,
      convertFromMad(data.baseCostMad, currency),
      convertFromMad(data.expensesMad, currency),
      convertFromMad(data.totalCostMad, currency),
    ]);
  }

  const detailHeaders = isAr
    ? [
        'الرمز',
        'المنتج',
        'المورد',
        'تاريخ الاقتناء',
        'الكمية',
        'الحالة',
        `سعر الشراء (${currency})`,
        `المصاريف (${currency})`,
        `تكلفة الوحدة (${currency})`,
        `التكلفة الإجمالية (${currency})`,
        `سعر البيع (${currency})`,
      ]
    : [
        'Code',
        'Produit',
        'Fournisseur',
        "Date d'acquisition",
        'Quantité',
        'Statut',
        `Prix d'achat (${currency})`,
        `Frais (${currency})`,
        `Coût unitaire (${currency})`,
        `Coût stock (${currency})`,
        `Prix vente (${currency})`,
      ];

  const detailRows: Array<Array<string | number>> = [detailHeaders];
  for (const prod of products) {
    const qty = Number(prod.quantity) || 0;
    const ref = Number(prod.referencePrice) || 0;
    const exp = Number(prod.expenses) || 0;
    const unitCost = ref + exp;
    detailRows.push([
      prod.code,
      prod.name,
      (prod.supplier || '').trim() || (isAr ? 'غير محدد' : 'Non renseigné'),
      prod.addedDate,
      qty,
      qty > 0 ? (isAr ? 'متوفر' : 'En stock') : isAr ? 'مباع' : 'Vendu',
      convertFromMad(ref, currency),
      convertFromMad(exp, currency),
      convertFromMad(unitCost, currency),
      convertFromMad(unitCost * qty, currency),
      convertFromMad(prod.sellingPrice, currency),
    ]);
  }

  detailRows.push([
    isAr ? 'المجموع' : 'TOTAL',
    isAr ? `${products.length} أصناف` : `${products.length} référence(s)`,
    '',
    '',
    totalStockUnits,
    '',
    convertFromMad(baseCostMad, currency),
    convertFromMad(expensesMad, currency),
    '',
    convertFromMad(totalInvestedMad, currency),
    convertFromMad(totalSellingMad, currency),
  ]);

  const workbook = XLSX.utils.book_new();
  if (isAr) {
    workbook.Workbook = { Views: [{ RTL: true }] };
  }

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
  summarySheet['!cols'] = [
    { wch: 30 },
    { wch: 16 },
    { wch: 16 },
    { wch: 18 },
    { wch: 16 },
    { wch: 20 },
  ];

  const detailSheet = XLSX.utils.aoa_to_sheet(detailRows);
  detailSheet['!cols'] = [
    { wch: 12 },
    { wch: 28 },
    { wch: 24 },
    { wch: 16 },
    { wch: 10 },
    { wch: 12 },
    { wch: 18 },
    { wch: 16 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
  ];

  XLSX.utils.book_append_sheet(
    workbook,
    summarySheet,
    isAr ? 'ميزانية مشتريات المخزون' : 'Bilan Achats Stock'
  );
  XLSX.utils.book_append_sheet(
    workbook,
    detailSheet,
    isAr ? 'تفاصيل المشتريات' : 'Détail Acquisitions'
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

