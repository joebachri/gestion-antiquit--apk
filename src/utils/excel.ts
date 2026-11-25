import * as XLSX from 'xlsx';
import type {
  Customer,
  InventoryAdjustment,
  InventorySummary,
  Language,
  PosInvoice,
  Product,
  ProductPayload,
  Supplier,
} from '../types';
import { convertFromMad, convertToMad } from './currency';

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
          'الفئة',
          'اللون',
          'المستودع / المتجر',
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
          'Catégorie',
          'Couleur',
          'Entrepôt / Magasin',
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
      item.category || '',
      item.color || '',
      item.warehouseName || '',
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
    { wch: 30 },
    { wch: 18 },
    { wch: 15 },
    { wch: 22 },
    { wch: 22 },
    { wch: 40 },
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
    const lines =
      inv.items && inv.items.length > 0
        ? inv.items
        : [
            {
              productId: inv.productId,
              productCode: inv.productCode,
              productName: inv.productName,
              quantity: qty,
              unitPrice: inv.unitPrice,
              totalPrice: rev,
              purchasePrice: inv.purchasePrice,
            },
          ];
    const cost = lines.reduce(
      (sum, li) => sum + (Number(li.purchasePrice) || 0) * (Number(li.quantity) || 0),
      0
    );
    totalCostMad += cost;

    const pKey = inv.paymentMethod || 'cash';
    const payEntry = byPayment.get(pKey) || { count: 0, units: 0, revenueMad: 0 };
    payEntry.count += 1;
    payEntry.units += qty;
    payEntry.revenueMad += rev;
    byPayment.set(pKey, payEntry);

    for (const li of lines) {
      const liQty = Number(li.quantity) || 0;
      const liRev = Number(li.totalPrice) || 0;
      const liCost = (Number(li.purchasePrice) || 0) * liQty;
      const prodKey = li.productCode || li.productId || li.productName;
      const prodEntry = byProduct.get(prodKey) || {
        code: li.productCode || '',
        name: li.productName || '',
        count: 0,
        units: 0,
        revenueMad: 0,
        costMad: 0,
      };
      prodEntry.count += 1;
      prodEntry.units += liQty;
      prodEntry.revenueMad += liRev;
      prodEntry.costMad += liCost;
      byProduct.set(prodKey, prodEntry);
    }
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
  lang: Language,
  options?: { customerId?: string; startDate?: string; endDate?: string }
): Blob {
  const isAr = lang === 'ar';
  const start = (options?.startDate || '').trim();
  const end = (options?.endDate || '').trim();
  const selectedCustomerId = (options?.customerId || '').trim();

  const targetCustomers = selectedCustomerId
    ? customers.filter((c) => c.id === selectedCustomerId)
    : customers;

  const matchesDate = (dateStr: string) => {
    if (!dateStr) return !start && !end;
    if (start && dateStr < start) return false;
    if (end && dateStr > end) return false;
    return true;
  };

  let activeCustomersCount = 0;
  let totalPurchases = 0;
  let totalUnits = 0;
  let totalRevenueMad = 0;

  const byPayment = new Map<string, { count: number; units: number; amountMad: number }>();
  const byCategory = new Map<
    string,
    { customers: number; count: number; units: number; amountMad: number }
  >();

  const filteredCustomerPurchases: Array<{ customer: Customer; purchase: Customer['purchases'][number] }> = [];

  for (const cust of targetCustomers) {
    const purchases = (cust.purchases || []).filter((p) => matchesDate(p.purchaseDate));
    if (purchases.length > 0) activeCustomersCount += 1;

    const catEntry = byCategory.get(cust.category) || {
      customers: 0,
      count: 0,
      units: 0,
      amountMad: 0,
    };
    catEntry.customers += 1;

    for (const p of purchases) {
      filteredCustomerPurchases.push({ customer: cust, purchase: p });
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
  const periodLabel =
    start || end
      ? `${start || '...'} → ${end || '...'}`
      : isAr
      ? 'جميع التواريخ'
      : 'Toutes dates';

  const summaryRows: Array<Array<string | number>> = [
    [
      isAr ? 'التقرير التفصيلي لمشتريات العملاء' : 'BILAN DÉTAILLÉ DES ACHATS CLIENTS',
      periodLabel,
      isAr ? `العملة: ${currency}` : `Devise: ${currency}`,
      new Date().toISOString().slice(0, 10),
    ],
    [],
    [isAr ? 'المؤشر' : 'Indicateur', isAr ? 'القيمة' : 'Valeur'],
    [isAr ? 'إجمالي العملاء' : 'Total clients', targetCustomers.length],
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
  for (const { customer: cust, purchase: p } of filteredCustomerPurchases) {
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

function normalizeExcelHeader(raw: unknown): string {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/[_\-.:/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseExcelNumber(val: unknown, fallback = 0): number {
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  const cleaned = String(val ?? '')
    .trim()
    .replace(/\s+/g, '')
    .replace(',', '.')
    .replace(/[^0-9.-]/g, '');
  if (!cleaned) return fallback;
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseExcelDate(val: unknown, defaultDate: string): string {
  if (val instanceof Date && !Number.isNaN(val.getTime())) {
    return val.toISOString().slice(0, 10);
  }
  if (typeof val === 'number' && val > 20000 && val < 80000) {
    const utcMs = Math.round((val - 25569) * 86400 * 1000);
    return new Date(utcMs).toISOString().slice(0, 10);
  }
  const str = String(val || '').trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
  const dmy = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (dmy) {
    const day = dmy[1].padStart(2, '0');
    const month = dmy[2].padStart(2, '0');
    const year = dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3];
    return `${year}-${month}-${day}`;
  }
  return defaultDate;
}

function detectFieldFromHeader(header: string):
  | 'code'
  | 'name'
  | 'category'
  | 'color'
  | 'warehouseName'
  | 'description'
  | 'supplier'
  | 'lengthCm'
  | 'widthCm'
  | 'heightCm'
  | 'thicknessCm'
  | 'piecesCount'
  | 'quantity'
  | 'referencePrice'
  | 'expenses'
  | 'sellingPrice'
  | 'addedDate'
  | null {
  if (!header) return null;
  if (
    header === 'code qr' ||
    header === 'qr' ||
    header === 'qr token' ||
    header === 'رمز qr'
  ) {
    return null;
  }
  if (
    [
      'code',
      'code produit',
      'code article',
      'ref',
      'reference',
      'sku',
      'id produit',
      'الرمز',
      'رمز المنتج',
      'كود',
      'كود المنتج',
      'product code',
      'item code',
    ].includes(header)
  ) {
    return 'code';
  }
  if (
    [
      'nom',
      'nom produit',
      'nom du produit',
      'produit',
      'article',
      'designation',
      'titre',
      'name',
      'product',
      'product name',
      'اسم المنتج',
      'المنتج',
      'الاسم',
    ].includes(header)
  ) {
    return 'name';
  }
  if (['categorie', 'category', 'type', 'الفئة', 'الصنف'].includes(header)) {
    return 'category';
  }
  if (['couleur', 'color', 'اللون'].includes(header)) {
    return 'color';
  }
  if (
    [
      'entrepot',
      'entrepot magasin',
      'magasin',
      'depot',
      'warehouse',
      'store',
      'المستودع',
      'المتجر',
      'المستودع المتجر',
    ].includes(header)
  ) {
    return 'warehouseName';
  }
  if (['description', 'details', 'detail', 'notes', 'الوصف', 'التفاصيل'].includes(header)) {
    return 'description';
  }
  if (['fournisseur', 'vendeur', 'supplier', 'vendor', 'المورد'].includes(header)) {
    return 'supplier';
  }
  if (['longueur', 'length', 'الطول'].includes(header)) return 'lengthCm';
  if (['largeur', 'width', 'العرض'].includes(header)) return 'widthCm';
  if (['hauteur', 'height', 'الارتفاع'].includes(header)) return 'heightCm';
  if (['epaisseur', 'thickness', 'السماكة'].includes(header)) return 'thicknessCm';
  if (
    ['nombre de pieces', 'nb pieces', 'pieces', 'pieces count', 'عدد القطع'].includes(header)
  ) {
    return 'piecesCount';
  }
  if (['quantite', 'qte', 'qty', 'stock', 'quantity', 'الكمية'].includes(header)) {
    return 'quantity';
  }
  if (
    [
      'prix de reference',
      'prix reference',
      'prix d achat',
      'prix achat',
      'cout achat',
      'purchase price',
      'reference price',
      'cost',
      'السعر المرجعي',
      'سعر الشراء',
    ].includes(header)
  ) {
    return 'referencePrice';
  }
  if (['frais', 'expenses', 'depenses', 'المصاريف'].includes(header)) {
    return 'expenses';
  }
  if (
    [
      'prix de vente',
      'prix vente',
      'prix',
      'selling price',
      'price',
      'سعر البيع',
      'السعر',
    ].includes(header)
  ) {
    return 'sellingPrice';
  }
  if (
    [
      'date d ajout',
      'date ajout',
      'date d acquisition',
      'date',
      'added date',
      'تاريخ الاضافة',
      'تاريخ الإضافة',
      'تاريخ الاقتناء',
    ].includes(header)
  ) {
    return 'addedDate';
  }
  return null;
}

export async function parseProductsFromExcelFile(
  file: File,
  currency: string
): Promise<{ rows: ProductPayload[]; skippedEmpty: number }> {
  const buf = await file.arrayBuffer();
  const workbook = XLSX.read(buf, { type: 'array', cellDates: true });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return { rows: [], skippedEmpty: 0 };

  const sheet = workbook.Sheets[firstSheetName];
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
    blankrows: false,
  });
  if (aoa.length === 0) return { rows: [], skippedEmpty: 0 };

  // Find header row in first 5 rows (or assume row 0 is headers)
  let headerRowIdx = 0;
  let bestMatches = 0;
  for (let i = 0; i < Math.min(5, aoa.length); i += 1) {
    const row = aoa[i] || [];
    let matches = 0;
    for (const cell of row) {
      if (detectFieldFromHeader(normalizeExcelHeader(cell))) {
        matches += 1;
      }
    }
    if (matches > bestMatches) {
      bestMatches = matches;
      headerRowIdx = i;
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const rows: ProductPayload[] = [];
  let skippedEmpty = 0;

  if (bestMatches > 0) {
    const headerRow = aoa[headerRowIdx] || [];
    const colFieldMap = headerRow.map((h) => detectFieldFromHeader(normalizeExcelHeader(h)));

    for (let r = headerRowIdx + 1; r < aoa.length; r += 1) {
      const cells = aoa[r] || [];
      const firstNonEmpty = String(cells[0] ?? '').trim().toUpperCase();
      if (firstNonEmpty === 'TOTAL' || firstNonEmpty === 'المجموع') {
        continue;
      }

      const draft: ProductPayload = {
        code: '',
        name: '',
        category: '',
        color: '',
        warehouseName: '',
        description: '',
        supplier: '',
        lengthCm: 0,
        widthCm: 0,
        heightCm: 0,
        thicknessCm: 0,
        piecesCount: 1,
        quantity: 1,
        referencePrice: 0,
        expenses: 0,
        sellingPrice: 0,
        addedDate: today,
        photos: [],
      };

      let hasCodeOrName = false;
      for (let c = 0; c < colFieldMap.length; c += 1) {
        const field = colFieldMap[c];
        if (!field) continue;
        const val = cells[c];
        const strVal = String(val ?? '').trim();

        if (field === 'code' && strVal) {
          draft.code = strVal;
          hasCodeOrName = true;
        } else if (field === 'name' && strVal) {
          draft.name = strVal;
          hasCodeOrName = true;
        } else if (field === 'category') {
          draft.category = strVal;
        } else if (field === 'color') {
          draft.color = strVal;
        } else if (field === 'warehouseName') {
          draft.warehouseName = strVal;
        } else if (field === 'description') {
          draft.description = strVal;
        } else if (field === 'supplier') {
          draft.supplier = strVal;
        } else if (field === 'lengthCm') {
          draft.lengthCm = Math.max(0, parseExcelNumber(val, 0));
        } else if (field === 'widthCm') {
          draft.widthCm = Math.max(0, parseExcelNumber(val, 0));
        } else if (field === 'heightCm') {
          draft.heightCm = Math.max(0, parseExcelNumber(val, 0));
        } else if (field === 'thicknessCm') {
          draft.thicknessCm = Math.max(0, parseExcelNumber(val, 0));
        } else if (field === 'piecesCount') {
          draft.piecesCount = Math.max(1, Math.floor(parseExcelNumber(val, 1)));
        } else if (field === 'quantity') {
          draft.quantity = strVal === '' ? 1 : Math.max(0, Math.floor(parseExcelNumber(val, 1)));
        } else if (field === 'referencePrice') {
          draft.referencePrice = convertToMad(Math.max(0, parseExcelNumber(val, 0)), currency);
        } else if (field === 'expenses') {
          draft.expenses = convertToMad(Math.max(0, parseExcelNumber(val, 0)), currency);
        } else if (field === 'sellingPrice') {
          draft.sellingPrice = convertToMad(Math.max(0, parseExcelNumber(val, 0)), currency);
        } else if (field === 'addedDate' && strVal) {
          draft.addedDate = parseExcelDate(val, today);
        }
      }

      if (!hasCodeOrName) {
        skippedEmpty += 1;
        continue;
      }
      if (!draft.name && draft.code) {
        draft.name = draft.code;
      }
      rows.push(draft);
    }
  } else {
    // Headerless simple spreadsheet support: Col A = Code, Col B = Name (or Code only)
    for (let r = 0; r < aoa.length; r += 1) {
      const cells = aoa[r] || [];
      const colA = String(cells[0] ?? '').trim();
      const colB = String(cells[1] ?? '').trim();
      if (!colA && !colB) {
        skippedEmpty += 1;
        continue;
      }
      const code = colA;
      const name = colB || colA;
      const qty = cells[2] !== undefined && String(cells[2]).trim() !== ''
        ? Math.max(0, Math.floor(parseExcelNumber(cells[2], 1)))
        : 1;
      const sell = cells[3] !== undefined ? convertToMad(Math.max(0, parseExcelNumber(cells[3], 0)), currency) : 0;

      rows.push({
        code,
        name,
        description: '',
        supplier: '',
        lengthCm: 0,
        widthCm: 0,
        heightCm: 0,
        thicknessCm: 0,
        piecesCount: 1,
        quantity: qty,
        referencePrice: 0,
        expenses: 0,
        sellingPrice: sell,
        addedDate: today,
        photos: [],
      });
    }
  }

  return { rows, skippedEmpty };
}

export function buildProductsTemplateExcelBlob(currency: string, lang: Language): Blob {
  const isAr = lang === 'ar';
  const headers = isAr
    ? [
        'الرمز',
        'اسم المنتج',
        'الفئة',
        'اللون',
        'المستودع',
        'الوصف',
        'المورد',
        'الكمية',
        `سعر الشراء (${currency})`,
        `المصاريف (${currency})`,
        `سعر البيع (${currency})`,
        'الطول (سم)',
        'العرض (سم)',
        'الارتفاع (سم)',
        'السماكة (سم)',
        'عدد القطع',
        'تاريخ الإضافة',
      ]
    : [
        'Code',
        'Nom',
        'Catégorie',
        'Couleur',
        'Entrepôt',
        'Description',
        'Fournisseur',
        'Quantité',
        `Prix d'achat (${currency})`,
        `Frais (${currency})`,
        `Prix de vente (${currency})`,
        'Longueur (cm)',
        'Largeur (cm)',
        'Hauteur (cm)',
        'Épaisseur (cm)',
        'Nombre de pièces',
        "Date d'ajout",
      ];

  const today = new Date().toISOString().slice(0, 10);
  const sampleRows: Array<Array<string | number>> = isAr
    ? [
        headers,
        ['ANT-101', 'فانوس نحاسي منقوش', 'مصابيح', 'نحاسي ذهبي', 'المتجر الرئيسي', 'قطعة عتيقة أصلية', 'سوق النحاسين فاس', 1, 900, 100, 1800, 28, 28, 52, 0.3, 1, today],
        ['VAS-204', 'مزهرية فخار أزرق', 'خزف', 'أزرق فاسي', 'المتجر الرئيسي', 'خزف تقليدي', 'ورشة آسفي', 2, 450, 50, 950, 22, 22, 36, 0.8, 1, today],
      ]
    : [
        headers,
        ['ANT-101', 'Lanterne en laiton ciselé', 'Luminaires', 'Cuivre doré', 'Magasin Principal', 'Pièce ancienne authentique', 'Souk Seffarine Fès', 1, 900, 100, 1800, 28, 28, 52, 0.3, 1, today],
        ['VAS-204', 'Vase céramique bleu de Fès', 'Céramique', 'Bleu de Fès', 'Magasin Principal', 'Artisanat ancien', 'Atelier Safi', 2, 450, 50, 950, 22, 22, 36, 0.8, 1, today],
      ];

  const workbook = XLSX.utils.book_new();
  if (isAr) {
    workbook.Workbook = { Views: [{ RTL: true }] };
  }
  const sheet = XLSX.utils.aoa_to_sheet(sampleRows);
  sheet['!cols'] = [
    { wch: 14 },
    { wch: 28 },
    { wch: 16 },
    { wch: 16 },
    { wch: 20 },
    { wch: 30 },
    { wch: 22 },
    { wch: 10 },
    { wch: 18 },
    { wch: 14 },
    { wch: 18 },
    { wch: 13 },
    { wch: 13 },
    { wch: 13 },
    { wch: 13 },
    { wch: 15 },
    { wch: 14 },
  ];
  XLSX.utils.book_append_sheet(workbook, sheet, isAr ? 'نموذج المنتجات' : 'Modèle Produits');

  const out = XLSX.write(workbook, {
    bookType: 'xlsx',
    type: 'array',
    compression: true,
  }) as ArrayBuffer;

  return new Blob([out], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

function getSupplierCategoryExportLabel(category: string, lang: Language): string {
  if (lang === 'ar') {
    if (category === 'artisan') return 'حرفي';
    if (category === 'wholesaler') return 'تاجر جملة';
    if (category === 'collector') return 'جامع تحف';
    return 'أخرى';
  }
  if (category === 'artisan') return 'Artisan';
  if (category === 'wholesaler') return 'Grossiste';
  if (category === 'collector') return 'Collectionneur';
  return 'Autre';
}

export function buildSuppliersExcelBlob(
  suppliers: Supplier[],
  currency: string,
  lang: Language
): Blob {
  const isAr = lang === 'ar';
  const profileHeaders = isAr
    ? [
        'رمز المورد',
        'الاسم الكامل',
        'الفئة',
        'رقم الهاتف',
        'المدينة',
        'العنوان',
        'عمليات التوريد',
        `إجمالي المشتريات (${currency})`,
        'آخر توريد',
        'ملاحظات',
      ]
    : [
        'Code Fournisseur',
        'Nom complet',
        'Catégorie',
        'Téléphone',
        'Ville',
        'Adresse',
        'Nb acquisitions',
        `Total dépensé (${currency})`,
        'Dernière acquisition',
        'Notes',
      ];

  const profileRows: Array<Array<string | number>> = [profileHeaders];
  let grandPurchases = 0;
  let grandSpentMad = 0;

  for (const sup of suppliers) {
    const purchases = sup.purchases || [];
    const totalMad = purchases.reduce((sum, p) => sum + (Number(p.totalCost) || 0), 0);
    const lastDate = purchases.map((p) => p.purchaseDate).filter(Boolean).sort().pop() || '';
    grandPurchases += purchases.length;
    grandSpentMad += totalMad;

    profileRows.push([
      sup.code,
      sup.name,
      getSupplierCategoryExportLabel(sup.category, lang),
      sup.phone || '',
      sup.city || '',
      sup.address || '',
      purchases.length,
      convertFromMad(totalMad, currency),
      lastDate,
      sup.notes || '',
    ]);
  }

  profileRows.push([
    isAr ? 'المجموع' : 'TOTAL',
    isAr ? `${suppliers.length} موردين` : `${suppliers.length} fournisseur(s)`,
    '',
    '',
    '',
    '',
    grandPurchases,
    convertFromMad(grandSpentMad, currency),
    '',
    '',
  ]);

  const detailHeaders = isAr
    ? [
        'رمز المورد',
        'اسم المورد',
        'التاريخ',
        'رمز المنتج',
        'المنتج',
        'الفئة',
        'المستودع',
        'الكمية',
        `تكلفة الوحدة (${currency})`,
        `التكلفة الإجمالية (${currency})`,
        'الدفع',
        'ملاحظات',
      ]
    : [
        'Code Fournisseur',
        'Fournisseur',
        'Date',
        'Code Produit',
        'Produit',
        'Catégorie',
        'Entrepôt',
        'Quantité',
        `Coût unitaire (${currency})`,
        `Coût total (${currency})`,
        'Paiement',
        'Notes',
      ];

  const detailRows: Array<Array<string | number>> = [detailHeaders];
  for (const sup of suppliers) {
    for (const p of sup.purchases || []) {
      detailRows.push([
        sup.code,
        sup.name,
        p.purchaseDate,
        p.productCode || '',
        p.productName,
        p.category || '',
        p.warehouseName || '',
        p.quantity,
        convertFromMad(p.unitCost, currency),
        convertFromMad(p.totalCost, currency),
        getPaymentMethodExportLabel(p.paymentMethod, lang),
        p.notes || '',
      ]);
    }
  }

  const workbook = XLSX.utils.book_new();
  if (isAr) {
    workbook.Workbook = { Views: [{ RTL: true }] };
  }
  const profileSheet = XLSX.utils.aoa_to_sheet(profileRows);
  profileSheet['!cols'] = [
    { wch: 14 },
    { wch: 24 },
    { wch: 18 },
    { wch: 18 },
    { wch: 16 },
    { wch: 28 },
    { wch: 14 },
    { wch: 20 },
    { wch: 14 },
    { wch: 28 },
  ];
  const detailSheet = XLSX.utils.aoa_to_sheet(detailRows);
  detailSheet['!cols'] = [
    { wch: 14 },
    { wch: 22 },
    { wch: 13 },
    { wch: 13 },
    { wch: 26 },
    { wch: 16 },
    { wch: 18 },
    { wch: 10 },
    { wch: 18 },
    { wch: 18 },
    { wch: 15 },
    { wch: 26 },
  ];

  XLSX.utils.book_append_sheet(
    workbook,
    profileSheet,
    isAr ? 'ملفات الموردين' : 'Fournisseurs'
  );
  XLSX.utils.book_append_sheet(
    workbook,
    detailSheet,
    isAr ? 'مشتريات التوريد' : 'Approvisionnements'
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

export function buildInventoryAdjustmentsExcelBlob(
  adjustments: InventoryAdjustment[],
  currency: string,
  lang: Language
): Blob {
  const isAr = lang === 'ar';
  const typeLabel = (type: string) => {
    if (isAr) {
      if (type === 'deduction') return 'خصم مخزون';
      if (type === 'restock') return 'إعادة تزويد';
      if (type === 'damage') return 'تلف / كسر';
      if (type === 'loss') return 'فقدان';
      if (type === 'transfer') return 'نقل مستودع';
      return 'تصحيح';
    }
    if (type === 'deduction') return 'Déduction';
    if (type === 'restock') return 'Réapprovisionnement';
    if (type === 'damage') return 'Casse';
    if (type === 'loss') return 'Perte';
    if (type === 'transfer') return 'Transfert';
    return 'Correction';
  };

  const headers = isAr
    ? [
        'المرجع',
        'التاريخ',
        'النوع',
        'المستودع المصدر',
        'المستودع المستهدف',
        'رمز المنتج',
        'المنتج',
        'الفئة',
        'المورد',
        'قبل',
        'التعديل',
        'بعد',
        `القيمة (${currency})`,
        'السبب',
        'ملاحظات',
      ]
    : [
        'Référence',
        'Date',
        'Type',
        'Entrepôt source',
        'Entrepôt cible',
        'Code produit',
        'Produit',
        'Catégorie',
        'Fournisseur',
        'Avant',
        'Ajustement',
        'Après',
        `Valeur (${currency})`,
        'Motif',
        'Notes',
      ];

  const rows: Array<Array<string | number>> = [headers];
  for (const adj of adjustments) {
    rows.push([
      adj.referenceNumber,
      adj.adjustmentDate,
      typeLabel(adj.adjustmentType),
      adj.warehouseName || '',
      adj.targetWarehouseName || '',
      adj.productCode,
      adj.productName,
      adj.category || '',
      adj.supplierName || '',
      adj.quantityBefore,
      adj.quantityDelta,
      adj.quantityAfter,
      convertFromMad(adj.totalValue, currency),
      adj.reason || '',
      adj.notes || '',
    ]);
  }

  const workbook = XLSX.utils.book_new();
  if (isAr) {
    workbook.Workbook = { Views: [{ RTL: true }] };
  }
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet['!cols'] = [
    { wch: 16 },
    { wch: 13 },
    { wch: 18 },
    { wch: 20 },
    { wch: 20 },
    { wch: 13 },
    { wch: 26 },
    { wch: 16 },
    { wch: 20 },
    { wch: 10 },
    { wch: 12 },
    { wch: 10 },
    { wch: 16 },
    { wch: 26 },
    { wch: 24 },
  ];
  XLSX.utils.book_append_sheet(
    workbook,
    sheet,
    isAr ? 'تسويات المخزون' : 'Ajustements Stock'
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

