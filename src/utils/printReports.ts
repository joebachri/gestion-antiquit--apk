import { Capacitor } from '@capacitor/core';
import { jsPDF } from 'jspdf';
import type {
  Customer,
  InventoryAdjustment,
  Language,
  PosInvoice,
  PosInvoiceItem,
  Product,
  ProductDigitalFile,
  ReportFilters,
  ShopSettings,
  Supplier,
  Warehouse,
} from '../types';
import { formatCurrency, formatNumber, translations } from '../i18n';
import { saveOrShareBlob } from './download';

export interface PrintableKpi {
  label: string;
  value: string;
}

export interface PrintableTable {
  heading?: string;
  columns: Array<{ label: string; align?: 'left' | 'right' | 'center'; widthWeight?: number }>;
  rows: Array<string[]>;
  totalsRow?: string[];
}

export interface PrintableReportSpec {
  title: string;
  subtitle?: string;
  storeName: string;
  generatedDate: string;
  watermark?: string;
  thumbnailDataUrl?: string;
  metaPairs?: Array<{ label: string; value: string }>;
  kpis: PrintableKpi[];
  tables: PrintableTable[];
  paymentSummaryLine?: string;
  paymentSummaryLines?: string[];
  companyFooterLines?: string[];
  footerNote?: string;
}

export interface ReportContextData {
  products: Product[];
  warehouses: Warehouse[];
  customers: Customer[];
  suppliers: Supplier[];
  invoices: PosInvoice[];
  adjustments: InventoryAdjustment[];
  storeName: string;
  currency: string;
  lang: Language;
  digitalFile?: ProductDigitalFile | null;
  shopSettings?: Partial<ShopSettings>;
}

function escapeHtml(text: string): string {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function withinDateRange(dateStr: string | undefined, startDate?: string, endDate?: string): boolean {
  const s = (startDate || '').trim();
  const e = (endDate || '').trim();
  if (!s && !e) return true;
  const d = (dateStr || '').slice(0, 10);
  if (!d) return false;
  if (s && d < s) return false;
  if (e && d > e) return false;
  return true;
}

function getInvoiceItems(inv: PosInvoice): PosInvoiceItem[] {
  if (inv.items && inv.items.length > 0) return inv.items;
  return [
    {
      productId: inv.productId,
      productCode: inv.productCode,
      productName: inv.productName,
      category: inv.category,
      warehouseId: inv.warehouseId,
      warehouseName: inv.warehouseName,
      quantity: inv.quantity,
      unitPrice: inv.unitPrice,
      totalPrice: inv.totalPrice,
      purchasePrice: inv.purchasePrice,
    },
  ];
}

function paymentLabel(method: string, lang: Language): string {
  const t = translations[lang];
  if (method === 'cash') return t.paymentCash;
  if (method === 'transfer') return t.paymentTransfer;
  if (method === 'check') return t.paymentCheck;
  if (method === 'card') return t.paymentCard;
  if (method === 'credit') return t.paymentCredit;
  if (method === 'mixed') return t.posPaymentMixed;
  return t.paymentOther;
}

function formatPaymentSummary(inv: PosInvoice, lang: Language, currency: string): string {
  if (inv.paymentBreakdown && inv.paymentBreakdown.length > 0) {
    return inv.paymentBreakdown
      .filter((p) => (Number(p.amount) || 0) > 0)
      .map((p) => `${paymentLabel(p.method, lang)}: ${formatCurrency(p.amount, currency, lang)}`)
      .join(' + ');
  }
  return paymentLabel(inv.paymentMethod, lang);
}

function formatPaymentBelowTableLines(inv: PosInvoice, lang: Language, currency: string): string[] {
  const prefix = lang === 'ar' ? 'طريقة الدفع' : 'MODE DE PAIEMENT';
  const splits = (inv.paymentBreakdown || []).filter((p) => (Number(p.amount) || 0) > 0);
  if (splits.length > 1) {
    return [
      `${prefix} :`,
      ...splits.map((p) => `${paymentLabel(p.method, lang)} ........ ${formatCurrency(p.amount, currency, lang)}`),
    ];
  }
  const method = splits.length === 1 ? splits[0].method : inv.paymentMethod;
  return [`${prefix} : ${paymentLabel(method, lang)} ........ ${formatCurrency(inv.totalPrice, currency, lang)}`];
}

export function buildCompanyFooterLines(
  settings: Partial<ShopSettings> | undefined,
  storeNameFallback: string,
  lang: Language
): string[] {
  const isAr = lang === 'ar';
  const name = (settings?.storeName || storeNameFallback || '').trim();
  const addr = (settings?.companyAddress || '').trim();
  const mob = (settings?.companyMobile || '').trim();
  const wa = (settings?.whatsappPhone || '').trim();
  const fix = (settings?.companyPhone || '').trim();
  const web = (settings?.companyWebsite || '').trim();
  const rc = (settings?.companyRc || '').trim();
  const ice = (settings?.companyIce || '').trim();
  const taxIf = (settings?.companyIf || '').trim();
  const cnss = (settings?.companyCnss || '').trim();

  const hasExtraCoords = Boolean(addr || mob || wa || fix || web || rc || ice || taxIf || cnss || settings?.storeName?.trim());
  if (!hasExtraCoords) return [];

  const lines: string[] = [];
  const line1 = [name, addr].filter(Boolean).join(' — ');
  if (line1) lines.push(line1);

  const contacts = [
    mob ? `${isAr ? 'موبايل' : 'Mobile'}: ${mob}` : '',
    wa ? `WhatsApp: ${wa}` : '',
    fix ? `${isAr ? 'الهاتف' : 'Tél'}: ${fix}` : '',
    web ? web : '',
  ].filter(Boolean);
  if (contacts.length > 0) lines.push(contacts.join('  ·  '));

  const legal = [
    rc ? `RC: ${rc}` : '',
    ice ? `ICE: ${ice}` : '',
    taxIf ? `IF: ${taxIf}` : '',
    cnss ? `CNSS: ${cnss}` : '',
  ].filter(Boolean);
  if (legal.length > 0) lines.push(legal.join('  ·  '));

  return lines;
}

function customerCategoryLabel(cat: string, lang: Language): string {
  const t = translations[lang];
  if (cat === 'seller') return t.customerCategorySeller;
  if (cat === 'hobbyist') return t.customerCategoryHobbyist;
  if (cat === 'regular') return t.customerCategoryRegular;
  return t.customerCategoryOther;
}

function supplierCategoryLabel(cat: string, lang: Language): string {
  const t = translations[lang];
  if (cat === 'artisan') return t.supplierCategoryArtisan;
  if (cat === 'wholesaler') return t.supplierCategoryWholesaler;
  if (cat === 'collector') return t.supplierCategoryCollector;
  return t.supplierCategoryOther;
}

function buildFilterSummaryPairs(
  filters: ReportFilters,
  ctx: ReportContextData
): Array<{ label: string; value: string }> {
  const t = translations[ctx.lang];
  const pairs: Array<{ label: string; value: string }> = [];
  if (filters.startDate || filters.endDate) {
    pairs.push({
      label: ctx.lang === 'ar' ? 'الفترة' : 'Période',
      value: `${filters.startDate || '…'} → ${filters.endDate || '…'}`,
    });
  }
  if (filters.timeOfDay && filters.timeOfDay !== 'all') {
    pairs.push({
      label: ctx.lang === 'ar' ? 'الفترة الزمنية' : 'Tranche',
      value:
        filters.timeOfDay === 'morning'
          ? t.posPeriodMorning
          : t.posPeriodAfternoon,
    });
  }
  if (filters.warehouseId) {
    const wh = ctx.warehouses.find((w) => w.id === filters.warehouseId);
    pairs.push({ label: t.productWarehouseLabel, value: wh?.name || filters.warehouseId });
  }
  if (filters.category) {
    pairs.push({ label: t.productCategoryLabel, value: filters.category });
  }
  if (filters.productId) {
    const prod = ctx.products.find((p) => p.id === filters.productId);
    pairs.push({
      label: t.adjustmentProductLabel,
      value: prod ? `${prod.code} · ${prod.name}` : filters.productId,
    });
  }
  if (filters.customerId) {
    const cust = ctx.customers.find((c) => c.id === filters.customerId);
    pairs.push({
      label: t.purchasesFilterCustomerLabel,
      value: cust ? `${cust.code} · ${cust.name}` : filters.customerId,
    });
  }
  if (filters.supplierId) {
    const sup = ctx.suppliers.find((s) => s.id === filters.supplierId);
    pairs.push({
      label: t.digitalMgmtSupplier,
      value: sup ? `${sup.code} · ${sup.name}` : filters.supplierId,
    });
  }
  return pairs;
}

export function buildReportSpec(filters: ReportFilters, ctx: ReportContextData): PrintableReportSpec {
  const { products, warehouses, customers, suppliers, invoices, storeName, currency, lang } = ctx;
  const t = translations[lang];
  const isAr = lang === 'ar';
  const today = new Date().toISOString().slice(0, 10);
  const cleanStore = storeName.trim() || t.brandName;
  const prodMap = new Map(products.map((p) => [p.id, p]));
  const metaPairs = buildFilterSummaryPairs(filters, ctx);

  // 1. INDIVIDUAL INVOICE / BL (never shows ORIGINAL; adds COPIE automatically on reprints)
  if (filters.reportType === 'invoice_single') {
    const inv = invoices.find((i) => i.id === filters.invoiceId) || invoices[0];
    if (!inv) {
      return {
        title: t.reportType1Title,
        storeName: cleanStore,
        generatedDate: today,
        metaPairs,
        kpis: [],
        tables: [],
        footerNote: t.reportNoDataForFilters,
      };
    }
    const items = getInvoiceItems(inv);
    const isCopy = Boolean(filters.isCopy || (inv.printCount || 0) > 0);
    const isBl = inv.documentType === 'bl';
    const docPrefix = isBl ? t.posBlNumberLabel : t.posInvoiceNumber;
    return {
      title: `${docPrefix} ${inv.invoiceNumber}`,
      subtitle: isCopy ? `${t.invoiceCopyBadge} · ${inv.saleDate}` : inv.saleDate,
      storeName: cleanStore,
      generatedDate: '',
      watermark: isCopy ? t.invoiceCopyBadge : undefined,
      metaPairs: [
        ...(inv.blNumber && !isBl ? [{ label: t.posBlNumberLabel, value: inv.blNumber }] : []),
        {
          label: t.posCustomerLabel,
          value: inv.customerName
            ? `${inv.customerName}${inv.customerPhone ? ` (${inv.customerPhone})` : ''}`
            : t.posWalkInCustomer,
        },
        ...(inv.warehouseName ? [{ label: t.productWarehouseLabel, value: inv.warehouseName }] : []),
        ...(inv.notes ? [{ label: t.purchaseNotesLabel, value: inv.notes }] : []),
      ],
      kpis: [
        { label: t.posCartItemsCount, value: formatNumber(items.length, lang) },
        { label: t.purchaseQuantityLabel, value: formatNumber(inv.quantity, lang) },
      ],
      tables: [
        {
          columns: [
            { label: isAr ? 'الرمز' : 'Code', widthWeight: 1.0 },
            { label: isAr ? 'المنتج' : 'Article', widthWeight: 2.3 },
            { label: isAr ? 'الكمية' : 'Qté', align: 'right', widthWeight: 0.7 },
            { label: isAr ? 'سعر الوحدة' : 'P.U.', align: 'right', widthWeight: 1.2 },
            { label: 'R %', align: 'right', widthWeight: 0.7 },
            { label: isAr ? 'المجموع' : 'Total', align: 'right', widthWeight: 1.3 },
          ],
          rows: items.map((item) => [
            item.productCode || '—',
            item.productName,
            formatNumber(item.quantity, lang),
            formatCurrency(item.unitPrice, currency, lang),
            `${formatNumber(item.discountPercent || 0, lang)}%`,
            formatCurrency(item.totalPrice, currency, lang),
          ]),
          totalsRow: [
            isAr ? 'المجموع' : 'TOTAL',
            `${items.length} ${t.posItemCountUnit}`,
            formatNumber(inv.quantity, lang),
            '',
            '',
            formatCurrency(inv.totalPrice, currency, lang),
          ],
        },
      ],
      paymentSummaryLines: formatPaymentBelowTableLines(inv, lang, currency),
      companyFooterLines: buildCompanyFooterLines(ctx.shopSettings, storeName, lang),
      footerNote: isCopy
        ? isAr
          ? 'نسخة مطابقة للأصل — شكراً لثقتكم'
          : 'COPIE — Merci pour votre confiance'
        : isBl
        ? isAr
          ? 'بيان تسليم (BL) — شكراً لثقتكم'
          : 'BON DE LIVRAISON (BL) — Merci pour votre confiance'
        : isAr
        ? 'فاتورة — شكراً لثقتكم'
        : 'FACTURE — Merci pour votre confiance',
    };
  }

  // 1B. DAILY CASH REGISTER SUMMARY (Recette journalière du caisse)
  if (filters.reportType === 'cash_register_summary') {
    const filtered = invoices.filter((inv) => {
      if (!withinDateRange(inv.saleDate, filters.startDate, filters.endDate)) return false;
      if (filters.timeOfDay && filters.timeOfDay !== 'all') {
        const created = inv.createdAt || '';
        const hourMatch = created.match(/T(\d{2}):/);
        const hour = hourMatch ? Number(hourMatch[1]) : 12;
        if (filters.timeOfDay === 'morning' && hour >= 13) return false;
        if (filters.timeOfDay === 'afternoon' && hour < 13) return false;
      }
      return true;
    });

    const totalTransactions = filtered.length;
    const totalUnits = filtered.reduce((s, inv) => s + (Number(inv.quantity) || 0), 0);
    const grandTotal = filtered.reduce((s, inv) => s + (Number(inv.totalPrice) || 0), 0);

    const paymentTotals: Record<'cash' | 'check' | 'card' | 'credit' | 'transfer' | 'other', number> = {
      cash: 0,
      check: 0,
      card: 0,
      credit: 0,
      transfer: 0,
      other: 0,
    };

    for (const inv of filtered) {
      if (inv.paymentBreakdown && inv.paymentBreakdown.length > 0) {
        for (const split of inv.paymentBreakdown) {
          const amt = Number(split.amount) || 0;
          if (amt <= 0) continue;
          const m = split.method;
          if (m in paymentTotals) {
            paymentTotals[m as keyof typeof paymentTotals] += amt;
          } else {
            paymentTotals.other += amt;
          }
        }
      } else {
        const amt = Number(inv.totalPrice) || 0;
        const m = inv.paymentMethod || 'cash';
        if (m in paymentTotals) {
          paymentTotals[m as keyof typeof paymentTotals] += amt;
        } else {
          paymentTotals.other += amt;
        }
      }
    }

    const paymentRows: Array<string[]> = [
      [t.paymentCash, formatCurrency(paymentTotals.cash, currency, lang)],
      [t.paymentCheck, formatCurrency(paymentTotals.check, currency, lang)],
      [t.paymentCard, formatCurrency(paymentTotals.card, currency, lang)],
      [t.paymentCredit, formatCurrency(paymentTotals.credit, currency, lang)],
      [t.paymentTransfer, formatCurrency(paymentTotals.transfer, currency, lang)],
      [t.paymentOther, formatCurrency(paymentTotals.other, currency, lang)],
    ];

    return {
      title: t.posDailySummaryTitle,
      storeName: cleanStore,
      generatedDate: today,
      metaPairs,
      kpis: [
        { label: t.posDailySummaryTotalTx, value: formatNumber(totalTransactions, lang) },
        { label: t.posTotalUnitsSold, value: formatNumber(totalUnits, lang) },
      ],
      tables: [
        {
          heading: t.posDailySummaryTxList,
          columns: [
            { label: isAr ? 'رقم BL / الوثيقة' : 'N° BL', widthWeight: 1.4 },
            { label: isAr ? 'التاريخ' : 'Date', widthWeight: 1.0 },
            { label: isAr ? 'رموز العمليات / المنتجات' : 'IDs / Articles', widthWeight: 2.5 },
            { label: isAr ? 'الكمية' : 'Qté', align: 'right', widthWeight: 0.7 },
            { label: isAr ? 'الدفع' : 'Paiement', widthWeight: 1.3 },
            { label: isAr ? 'المجموع' : 'Total BL', align: 'right', widthWeight: 1.3 },
          ],
          rows: filtered.map((inv) => {
            const items = getInvoiceItems(inv);
            const itemCodes = items.map((x) => `${x.productCode} (×${x.quantity})`).join(', ');
            const blLabel =
              inv.documentType === 'bl'
                ? inv.invoiceNumber
                : inv.blNumber
                ? `${inv.blNumber} → ${inv.invoiceNumber}`
                : inv.invoiceNumber;
            return [
              blLabel,
              inv.saleDate,
              itemCodes,
              formatNumber(inv.quantity, lang),
              formatPaymentSummary(inv, lang, currency),
              formatCurrency(inv.totalPrice, currency, lang),
            ];
          }),
          totalsRow: [
            isAr ? 'المجموع العام' : 'TOTAL GÉNÉRAL',
            '',
            `${formatNumber(totalTransactions, lang)} ${isAr ? 'عمليات' : 'opérations'}`,
            formatNumber(totalUnits, lang),
            '',
            formatCurrency(grandTotal, currency, lang),
          ],
        },
        {
          heading: t.posDailySummaryByPayment,
          columns: [
            { label: t.purchasePaymentLabel, widthWeight: 2.2 },
            { label: isAr ? 'المبلغ' : 'Montant', align: 'right', widthWeight: 1.4 },
          ],
          rows: paymentRows,
          totalsRow: [
            isAr ? 'المجموع الكلي للمداخيل' : 'TOTAL RECETTE',
            formatCurrency(grandTotal, currency, lang),
          ],
        },
      ],
    };
  }

  // 2. AGGREGATE INVOICES
  if (filters.reportType === 'invoices_aggregate') {
    const filtered = invoices.filter((inv) => {
      if (!withinDateRange(inv.saleDate, filters.startDate, filters.endDate)) return false;
      if (filters.customerId && inv.customerId !== filters.customerId) return false;
      const items = getInvoiceItems(inv);
      if (filters.productId && !items.some((it) => it.productId === filters.productId)) return false;
      if (filters.category) {
        const matchCat = items.some((it) => {
          const cat = it.category || prodMap.get(it.productId)?.category || '';
          return cat === filters.category;
        });
        if (!matchCat) return false;
      }
      return true;
    });
    const totalUnits = filtered.reduce((s, i) => s + (Number(i.quantity) || 0), 0);
    const totalRev = filtered.reduce((s, i) => s + (Number(i.totalPrice) || 0), 0);
    return {
      title: t.reportType2Title,
      storeName: cleanStore,
      generatedDate: today,
      metaPairs,
      kpis: [
        { label: t.posTotalInvoices, value: formatNumber(filtered.length, lang) },
        { label: t.posTotalUnitsSold, value: formatNumber(totalUnits, lang) },
        { label: t.posTotalRevenue, value: formatCurrency(totalRev, currency, lang) },
      ],
      tables: [
        {
          columns: [
            { label: isAr ? 'رقم الفاتورة' : 'N° Facture', widthWeight: 1.4 },
            { label: isAr ? 'التاريخ' : 'Date', widthWeight: 1.1 },
            { label: isAr ? 'العميل' : 'Client', widthWeight: 1.7 },
            { label: isAr ? 'المنتجات' : 'Articles', widthWeight: 2.3 },
            { label: isAr ? 'الكمية' : 'Qté', align: 'right', widthWeight: 0.7 },
            { label: isAr ? 'الدفع' : 'Paiement', widthWeight: 1.0 },
            { label: isAr ? 'المجموع' : 'Total', align: 'right', widthWeight: 1.4 },
          ],
          rows: filtered.map((inv) => {
            const items = getInvoiceItems(inv);
            const summaryItems = items.map((x) => `${x.productCode} (×${x.quantity})`).join(', ');
            return [
              `${inv.invoiceNumber}${(inv.printCount || 0) > 0 ? ` [${t.invoiceCopyBadge}]` : ''}`,
              inv.saleDate,
              inv.customerName || t.posWalkInCustomer,
              summaryItems,
              formatNumber(inv.quantity, lang),
              formatPaymentSummary(inv, lang, currency),
              formatCurrency(inv.totalPrice, currency, lang),
            ];
          }),
          totalsRow: [
            isAr ? 'المجموع' : 'TOTAL',
            '',
            '',
            `${filtered.length}`,
            formatNumber(totalUnits, lang),
            '',
            formatCurrency(totalRev, currency, lang),
          ],
        },
      ],
    };
  }

  // 3. INVENTORY
  if (filters.reportType === 'inventory') {
    const filtered = products.filter((p) => {
      if (filters.warehouseId && p.warehouseId !== filters.warehouseId) return false;
      if (filters.category && (p.category || '') !== filters.category) return false;
      if (filters.productId && p.id !== filters.productId) return false;
      return true;
    });
    const totalUnits = filtered.reduce((s, p) => s + (Number(p.quantity) || 0), 0);
    const totalCost = filtered.reduce(
      (s, p) => s + ((Number(p.referencePrice) || 0) + (Number(p.expenses) || 0)) * (Number(p.quantity) || 0),
      0
    );
    const totalVal = filtered.reduce(
      (s, p) => s + (Number(p.sellingPrice) || 0) * (Number(p.quantity) || 0),
      0
    );
    return {
      title: t.reportType3Title,
      storeName: cleanStore,
      generatedDate: today,
      metaPairs,
      kpis: [
        { label: t.warehouseProductsCount, value: formatNumber(filtered.length, lang) },
        { label: t.warehouseTotalUnits, value: formatNumber(totalUnits, lang) },
        { label: t.stockPurchasesTotalInvested, value: formatCurrency(totalCost, currency, lang) },
        { label: t.globalValueLabel, value: formatCurrency(totalVal, currency, lang) },
      ],
      tables: [
        {
          columns: [
            { label: isAr ? 'الرمز' : 'Code', widthWeight: 1.0 },
            { label: isAr ? 'المنتج' : 'Produit', widthWeight: 2.2 },
            { label: t.productCategoryLabel, widthWeight: 1.2 },
            { label: t.productColorLabel, widthWeight: 1.0 },
            { label: t.productWarehouseLabel, widthWeight: 1.4 },
            { label: isAr ? 'الكمية' : 'Qté', align: 'right', widthWeight: 0.7 },
            { label: isAr ? 'التكلفة' : 'Coût u.', align: 'right', widthWeight: 1.2 },
            { label: isAr ? 'سعر البيع' : 'P. Vente', align: 'right', widthWeight: 1.2 },
            { label: isAr ? 'القيمة' : 'Valeur', align: 'right', widthWeight: 1.3 },
          ],
          rows: filtered.map((p) => {
            const unitCost = (Number(p.referencePrice) || 0) + (Number(p.expenses) || 0);
            return [
              p.code,
              p.name,
              p.category || '—',
              p.color || '—',
              p.warehouseName || '—',
              formatNumber(p.quantity, lang),
              formatCurrency(unitCost, currency, lang),
              formatCurrency(p.sellingPrice, currency, lang),
              formatCurrency(p.sellingPrice * p.quantity, currency, lang),
            ];
          }),
          totalsRow: [
            isAr ? 'المجموع' : 'TOTAL',
            `${filtered.length}`,
            '',
            '',
            '',
            formatNumber(totalUnits, lang),
            formatCurrency(totalCost, currency, lang),
            '',
            formatCurrency(totalVal, currency, lang),
          ],
        },
      ],
    };
  }

  // 4. CUSTOMERS LIST
  if (filters.reportType === 'customers') {
    const filtered = filters.customerId
      ? customers.filter((c) => c.id === filters.customerId)
      : customers;
    const totalPurchases = filtered.reduce((s, c) => s + (c.purchases?.length || 0), 0);
    const totalSpent = filtered.reduce(
      (s, c) => s + (c.purchases || []).reduce((ps, p) => ps + (Number(p.totalPrice) || 0), 0),
      0
    );
    return {
      title: t.reportType4Title,
      storeName: cleanStore,
      generatedDate: today,
      metaPairs,
      kpis: [
        { label: t.totalCustomersLabel, value: formatNumber(filtered.length, lang) },
        { label: t.totalPurchasesLabel, value: formatNumber(totalPurchases, lang) },
        { label: t.totalCustomerRevenueLabel, value: formatCurrency(totalSpent, currency, lang) },
      ],
      tables: [
        {
          columns: [
            { label: isAr ? 'الرمز' : 'Code', widthWeight: 1.0 },
            { label: t.customerNameLabel, widthWeight: 2.0 },
            { label: t.customerCategoryLabel, widthWeight: 1.4 },
            { label: t.customerPhoneLabel, widthWeight: 1.4 },
            { label: t.customerCityLabel, widthWeight: 1.2 },
            { label: isAr ? 'المشتريات' : 'Achats', align: 'right', widthWeight: 0.9 },
            { label: t.customerTotalSpent, align: 'right', widthWeight: 1.5 },
          ],
          rows: filtered.map((c) => {
            const spent = (c.purchases || []).reduce((s, p) => s + (Number(p.totalPrice) || 0), 0);
            return [
              c.code,
              c.name,
              customerCategoryLabel(c.category, lang),
              c.phone || '—',
              c.city || '—',
              formatNumber(c.purchases?.length || 0, lang),
              formatCurrency(spent, currency, lang),
            ];
          }),
          totalsRow: [
            isAr ? 'المجموع' : 'TOTAL',
            `${filtered.length}`,
            '',
            '',
            '',
            formatNumber(totalPurchases, lang),
            formatCurrency(totalSpent, currency, lang),
          ],
        },
      ],
    };
  }

  // 5. SUPPLIERS LIST
  if (filters.reportType === 'suppliers') {
    const filtered = filters.supplierId
      ? suppliers.filter((s) => s.id === filters.supplierId)
      : suppliers;
    const totalAcq = filtered.reduce((s, sup) => s + (sup.purchases?.length || 0), 0);
    const totalCost = filtered.reduce(
      (s, sup) => s + (sup.purchases || []).reduce((ps, p) => ps + (Number(p.totalCost) || 0), 0),
      0
    );
    return {
      title: t.reportType5Title,
      storeName: cleanStore,
      generatedDate: today,
      metaPairs,
      kpis: [
        { label: t.supplierCountLabel, value: formatNumber(filtered.length, lang) },
        { label: t.supplierPurchasesCountLabel, value: formatNumber(totalAcq, lang) },
        { label: t.supplierTotalSpentLabel, value: formatCurrency(totalCost, currency, lang) },
      ],
      tables: [
        {
          columns: [
            { label: isAr ? 'الرمز' : 'Code', widthWeight: 1.0 },
            { label: t.customerNameLabel, widthWeight: 2.0 },
            { label: t.customerCategoryLabel, widthWeight: 1.3 },
            { label: t.customerPhoneLabel, widthWeight: 1.4 },
            { label: t.customerCityLabel, widthWeight: 1.2 },
            { label: isAr ? 'التوريدات' : 'Acq.', align: 'right', widthWeight: 0.9 },
            { label: t.supplierTotalCostLabel, align: 'right', widthWeight: 1.5 },
          ],
          rows: filtered.map((sup) => {
            const spent = (sup.purchases || []).reduce((s, p) => s + (Number(p.totalCost) || 0), 0);
            return [
              sup.code,
              sup.name,
              supplierCategoryLabel(sup.category, lang),
              sup.phone || '—',
              sup.city || '—',
              formatNumber(sup.purchases?.length || 0, lang),
              formatCurrency(spent, currency, lang),
            ];
          }),
          totalsRow: [
            isAr ? 'المجموع' : 'TOTAL',
            `${filtered.length}`,
            '',
            '',
            '',
            formatNumber(totalAcq, lang),
            formatCurrency(totalCost, currency, lang),
          ],
        },
      ],
    };
  }

  // 6. PURCHASES / ACQUISITIONS (filterable by supplier, customer, product, category, date)
  if (filters.reportType === 'purchases') {
    const supRows: Array<string[]> = [];
    let supUnits = 0;
    let supTotal = 0;

    const targetSuppliers = filters.supplierId
      ? suppliers.filter((s) => s.id === filters.supplierId)
      : suppliers;

    for (const sup of targetSuppliers) {
      for (const p of sup.purchases || []) {
        if (!withinDateRange(p.purchaseDate, filters.startDate, filters.endDate)) continue;
        if (filters.productId && p.productId !== filters.productId) continue;
        const prodCat = p.category || (p.productId ? prodMap.get(p.productId)?.category : '') || '';
        if (filters.category && prodCat !== filters.category) continue;
        supUnits += Number(p.quantity) || 0;
        supTotal += Number(p.totalCost) || 0;
        supRows.push([
          p.purchaseDate,
          sup.name,
          p.productCode || '—',
          p.productName,
          prodCat || '—',
          formatNumber(p.quantity, lang),
          formatCurrency(p.unitCost, currency, lang),
          formatCurrency(p.totalCost, currency, lang),
        ]);
      }
    }

    // Also include matching stock acquisitions from products if no supplier-only conflict
    const stockProducts = products.filter((p) => {
      if (!withinDateRange(p.addedDate, filters.startDate, filters.endDate)) return false;
      if (filters.productId && p.id !== filters.productId) return false;
      if (filters.category && (p.category || '') !== filters.category) return false;
      if (filters.supplierId) {
        const sup = suppliers.find((s) => s.id === filters.supplierId);
        if (p.supplierId !== filters.supplierId && p.supplier !== sup?.name) return false;
      }
      return true;
    });
    const stockInvested = stockProducts.reduce(
      (s, p) => s + ((Number(p.referencePrice) || 0) + (Number(p.expenses) || 0)) * (Number(p.quantity) || 0),
      0
    );

    const custRows: Array<string[]> = [];
    let custUnits = 0;
    let custTotal = 0;
    if (!filters.supplierId) {
      const targetCustomers = filters.customerId
        ? customers.filter((c) => c.id === filters.customerId)
        : customers;
      for (const cust of targetCustomers) {
        for (const p of cust.purchases || []) {
          if (!withinDateRange(p.purchaseDate, filters.startDate, filters.endDate)) continue;
          if (filters.productId && p.productId !== filters.productId) continue;
          const prodCat = (p.productId ? prodMap.get(p.productId)?.category : '') || '';
          if (filters.category && prodCat !== filters.category) continue;
          custUnits += Number(p.quantity) || 0;
          custTotal += Number(p.totalPrice) || 0;
          custRows.push([
            p.purchaseDate,
            cust.name,
            p.productCode || '—',
            p.productName,
            formatNumber(p.quantity, lang),
            formatCurrency(p.unitPrice, currency, lang),
            formatCurrency(p.totalPrice, currency, lang),
          ]);
        }
      }
    }

    const tables: PrintableTable[] = [
      {
        heading: isAr ? 'مشتريات التوريد (الموردون)' : 'Acquisitions Fournisseurs',
        columns: [
          { label: isAr ? 'التاريخ' : 'Date', widthWeight: 1.1 },
          { label: t.digitalMgmtSupplier, widthWeight: 1.7 },
          { label: isAr ? 'الرمز' : 'Code', widthWeight: 0.9 },
          { label: isAr ? 'المنتج' : 'Article', widthWeight: 2.0 },
          { label: t.productCategoryLabel, widthWeight: 1.1 },
          { label: isAr ? 'الكمية' : 'Qté', align: 'right', widthWeight: 0.7 },
          { label: isAr ? 'تكلفة الوحدة' : 'Coût u.', align: 'right', widthWeight: 1.2 },
          { label: isAr ? 'الإجمالي' : 'Total', align: 'right', widthWeight: 1.3 },
        ],
        rows: supRows,
        totalsRow: [
          isAr ? 'المجموع' : 'TOTAL',
          `${supRows.length}`,
          '',
          '',
          '',
          formatNumber(supUnits, lang),
          '',
          formatCurrency(supTotal, currency, lang),
        ],
      },
      {
        heading: t.stockPurchasesReportTitle,
        columns: [
          { label: isAr ? 'التاريخ' : 'Date', widthWeight: 1.1 },
          { label: isAr ? 'الرمز' : 'Code', widthWeight: 0.9 },
          { label: isAr ? 'المنتج' : 'Article', widthWeight: 2.0 },
          { label: t.digitalMgmtSupplier, widthWeight: 1.6 },
          { label: t.productCategoryLabel, widthWeight: 1.1 },
          { label: isAr ? 'الكمية' : 'Qté', align: 'right', widthWeight: 0.7 },
          { label: isAr ? 'التكلفة المستثمرة' : 'Coût stock', align: 'right', widthWeight: 1.4 },
        ],
        rows: stockProducts.map((p) => [
          p.addedDate,
          p.code,
          p.name,
          p.supplier || t.digitalMgmtNotSpecified,
          p.category || '—',
          formatNumber(p.quantity, lang),
          formatCurrency(((Number(p.referencePrice) || 0) + (Number(p.expenses) || 0)) * (Number(p.quantity) || 0), currency, lang),
        ]),
        totalsRow: [
          isAr ? 'المجموع' : 'TOTAL',
          '',
          `${stockProducts.length}`,
          '',
          '',
          formatNumber(stockProducts.reduce((s, p) => s + (Number(p.quantity) || 0), 0), lang),
          formatCurrency(stockInvested, currency, lang),
        ],
      },
    ];

    if (custRows.length > 0 || filters.customerId) {
      tables.push({
        heading: t.purchasesReportTitle,
        columns: [
          { label: isAr ? 'التاريخ' : 'Date', widthWeight: 1.1 },
          { label: t.posCustomerLabel, widthWeight: 1.8 },
          { label: isAr ? 'الرمز' : 'Code', widthWeight: 0.9 },
          { label: isAr ? 'المنتج' : 'Article', widthWeight: 2.1 },
          { label: isAr ? 'الكمية' : 'Qté', align: 'right', widthWeight: 0.7 },
          { label: isAr ? 'سعر الوحدة' : 'P.U.', align: 'right', widthWeight: 1.2 },
          { label: isAr ? 'المجموع' : 'Total', align: 'right', widthWeight: 1.3 },
        ],
        rows: custRows,
        totalsRow: [
          isAr ? 'المجموع' : 'TOTAL',
          `${custRows.length}`,
          '',
          '',
          formatNumber(custUnits, lang),
          '',
          formatCurrency(custTotal, currency, lang),
        ],
      });
    }

    return {
      title: t.reportType6Title,
      storeName: cleanStore,
      generatedDate: today,
      metaPairs,
      kpis: [
        { label: t.supplierPurchasesCountLabel, value: formatNumber(supRows.length, lang) },
        { label: t.supplierTotalSpentLabel, value: formatCurrency(supTotal, currency, lang) },
        { label: t.stockPurchasesTotalInvested, value: formatCurrency(stockInvested, currency, lang) },
        { label: t.totalCustomerRevenueLabel, value: formatCurrency(custTotal, currency, lang) },
      ],
      tables,
    };
  }

  // 7. SALES REPORT
  if (filters.reportType === 'sales') {
    const lineRows: Array<string[]> = [];
    let totalUnits = 0;
    let totalRev = 0;
    let totalCost = 0;
    const invoiceIds = new Set<string>();

    for (const inv of invoices) {
      if (!withinDateRange(inv.saleDate, filters.startDate, filters.endDate)) continue;
      if (filters.customerId && inv.customerId !== filters.customerId) continue;
      for (const li of getInvoiceItems(inv)) {
        if (filters.productId && li.productId !== filters.productId) continue;
        const cat = li.category || prodMap.get(li.productId)?.category || '';
        if (filters.category && cat !== filters.category) continue;
        invoiceIds.add(inv.id);
        const qty = Number(li.quantity) || 0;
        const rev = Number(li.totalPrice) || 0;
        const cost = (Number(li.purchasePrice) || 0) * qty;
        totalUnits += qty;
        totalRev += rev;
        totalCost += cost;
        lineRows.push([
          inv.saleDate,
          inv.invoiceNumber,
          inv.customerName || t.posWalkInCustomer,
          li.productCode || '—',
          li.productName,
          cat || '—',
          formatNumber(qty, lang),
          formatCurrency(li.unitPrice, currency, lang),
          formatCurrency(rev, currency, lang),
          formatCurrency(rev - cost, currency, lang),
        ]);
      }
    }

    return {
      title: t.reportType7Title,
      storeName: cleanStore,
      generatedDate: today,
      metaPairs,
      kpis: [
        { label: t.posTotalInvoices, value: formatNumber(invoiceIds.size, lang) },
        { label: t.posTotalUnitsSold, value: formatNumber(totalUnits, lang) },
        { label: t.posTotalRevenue, value: formatCurrency(totalRev, currency, lang) },
        { label: t.posTotalProfit, value: formatCurrency(totalRev - totalCost, currency, lang) },
      ],
      tables: [
        {
          columns: [
            { label: isAr ? 'التاريخ' : 'Date', widthWeight: 1.0 },
            { label: isAr ? 'الفاتورة' : 'Facture', widthWeight: 1.2 },
            { label: t.posCustomerLabel, widthWeight: 1.5 },
            { label: isAr ? 'الرمز' : 'Code', widthWeight: 0.9 },
            { label: isAr ? 'المنتج' : 'Article', widthWeight: 2.0 },
            { label: t.productCategoryLabel, widthWeight: 1.0 },
            { label: isAr ? 'الكمية' : 'Qté', align: 'right', widthWeight: 0.7 },
            { label: isAr ? 'سعر الوحدة' : 'P.U.', align: 'right', widthWeight: 1.1 },
            { label: isAr ? 'الإجمالي' : 'Total', align: 'right', widthWeight: 1.2 },
            { label: isAr ? 'الربح' : 'Marge', align: 'right', widthWeight: 1.1 },
          ],
          rows: lineRows,
          totalsRow: [
            isAr ? 'المجموع' : 'TOTAL',
            `${invoiceIds.size}`,
            '',
            '',
            '',
            '',
            formatNumber(totalUnits, lang),
            '',
            formatCurrency(totalRev, currency, lang),
            formatCurrency(totalRev - totalCost, currency, lang),
          ],
        },
      ],
    };
  }

  // 8. PRODUCTS CATALOG REPORT
  if (filters.reportType === 'products') {
    const filtered = products.filter((p) => {
      if (!withinDateRange(p.addedDate, filters.startDate, filters.endDate)) return false;
      if (filters.category && (p.category || '') !== filters.category) return false;
      if (filters.productId && p.id !== filters.productId) return false;
      return true;
    });
    const totalUnits = filtered.reduce((s, p) => s + (Number(p.quantity) || 0), 0);
    const totalSelling = filtered.reduce(
      (s, p) => s + (Number(p.sellingPrice) || 0) * (Number(p.quantity) || 0),
      0
    );
    return {
      title: t.reportType8Title,
      storeName: cleanStore,
      generatedDate: today,
      metaPairs,
      kpis: [
        { label: t.referencesUnit, value: formatNumber(filtered.length, lang) },
        { label: t.articlesUnit, value: formatNumber(totalUnits, lang) },
        { label: t.globalValueLabel, value: formatCurrency(totalSelling, currency, lang) },
      ],
      tables: [
        {
          columns: [
            { label: isAr ? 'الرمز' : 'Code', widthWeight: 0.9 },
            { label: isAr ? 'الاسم' : 'Nom', widthWeight: 2.1 },
            { label: t.productCategoryLabel, widthWeight: 1.2 },
            { label: t.productColorLabel, widthWeight: 1.0 },
            { label: t.productWarehouseLabel, widthWeight: 1.4 },
            { label: t.dimensionsShort, widthWeight: 1.3 },
            { label: isAr ? 'الكمية' : 'Qté', align: 'right', widthWeight: 0.7 },
            { label: isAr ? 'سعر البيع' : 'P. Vente', align: 'right', widthWeight: 1.2 },
            { label: isAr ? 'التاريخ' : 'Date', widthWeight: 1.0 },
          ],
          rows: filtered.map((p) => [
            p.code,
            p.name,
            p.category || '—',
            p.color || '—',
            p.warehouseName || '—',
            `${p.lengthCm}×${p.widthCm}×${p.heightCm}`,
            formatNumber(p.quantity, lang),
            formatCurrency(p.sellingPrice, currency, lang),
            p.addedDate,
          ]),
        },
      ],
    };
  }

  // 9. INDIVIDUAL PRODUCT REPORT
  if (filters.reportType === 'product_single') {
    const product =
      (filters.productId ? products.find((p) => p.id === filters.productId) : undefined) ||
      ctx.digitalFile?.product ||
      products[0];
    if (!product) {
      return {
        title: t.reportType9Title,
        storeName: cleanStore,
        generatedDate: today,
        metaPairs,
        kpis: [],
        tables: [],
        footerNote: t.reportNoDataForFilters,
      };
    }

    const firstImg = product.photos?.find(
      (ph) => ph.imageData && !ph.imageData.startsWith('data:video/')
    )?.imageData;

    const prodInvoices = invoices.filter((inv) =>
      getInvoiceItems(inv).some((li) => li.productId === product.id || li.productCode === product.code)
    );
    const prodAdjustments = ctx.adjustments.filter((a) => a.productId === product.id);
    const unitCost = (Number(product.referencePrice) || 0) + (Number(product.expenses) || 0);
    const margin = (Number(product.sellingPrice) || 0) - unitCost;

    const tables: PrintableTable[] = [
      {
        heading: t.digitalMgmtInvoices,
        columns: [
          { label: isAr ? 'رقم الفاتورة' : 'N° Facture', widthWeight: 1.4 },
          { label: isAr ? 'التاريخ' : 'Date', widthWeight: 1.1 },
          { label: t.posCustomerLabel, widthWeight: 2.0 },
          { label: isAr ? 'الكمية' : 'Qté', align: 'right', widthWeight: 0.8 },
          { label: isAr ? 'المجموع' : 'Total', align: 'right', widthWeight: 1.4 },
        ],
        rows: prodInvoices.map((inv) => [
          inv.invoiceNumber,
          inv.saleDate,
          inv.customerName || t.posWalkInCustomer,
          formatNumber(inv.quantity, lang),
          formatCurrency(inv.totalPrice, currency, lang),
        ]),
      },
      {
        heading: t.adjustmentsNavLabel,
        columns: [
          { label: isAr ? 'التاريخ' : 'Date', widthWeight: 1.1 },
          { label: t.adjustmentTypeLabel, widthWeight: 1.4 },
          { label: t.adjustmentWarehouseLabel, widthWeight: 1.5 },
          { label: isAr ? 'التعديل' : 'Delta', align: 'right', widthWeight: 0.9 },
          { label: t.adjustmentReasonLabel, widthWeight: 2.2 },
        ],
        rows: prodAdjustments.map((a) => [
          a.adjustmentDate,
          a.adjustmentType,
          a.warehouseName || '—',
          a.quantityDelta > 0 ? `+${a.quantityDelta}` : String(a.quantityDelta),
          a.reason || '—',
        ]),
      },
    ];

    return {
      title: `${t.reportType9Title} — ${product.code}`,
      subtitle: product.name,
      storeName: cleanStore,
      generatedDate: today,
      thumbnailDataUrl: firstImg,
      metaPairs: [
        { label: t.digitalSerialCode, value: `${product.code} (${product.qrToken || `GA-QR-${product.code}`})` },
        { label: t.productCategoryLabel, value: product.category || t.digitalMgmtNotSpecified },
        { label: t.productColorLabel, value: product.color || t.digitalMgmtNotSpecified },
        { label: t.productWarehouseLabel, value: product.warehouseName || t.digitalMgmtNotSpecified },
        { label: t.digitalMgmtSupplier, value: product.supplier || t.digitalMgmtNotSpecified },
        {
          label: t.dimensionsSection,
          value: `${product.lengthCm} × ${product.widthCm} × ${product.heightCm} ${t.cmUnit} (${product.piecesCount} ${t.piecesUnit})`,
        },
        ...(product.description ? [{ label: t.descriptionLabel, value: product.description }] : []),
      ],
      kpis: [
        { label: t.quantityLabel, value: formatNumber(product.quantity, lang) },
        { label: t.digitalMgmtPurchasePrice, value: formatCurrency(unitCost, currency, lang) },
        { label: t.sellingPriceLabel, value: formatCurrency(product.sellingPrice, currency, lang) },
        { label: t.marginLabel, value: formatCurrency(margin, currency, lang) },
      ],
      tables,
    };
  }

  // 10. WAREHOUSES REPORT (filterable by date, warehouse, category, product)
  const targetWarehouses = filters.warehouseId
    ? warehouses.filter((w) => w.id === filters.warehouseId)
    : warehouses;

  const filteredProducts = products.filter((p) => {
    if (!withinDateRange(p.addedDate, filters.startDate, filters.endDate)) return false;
    if (filters.warehouseId && p.warehouseId !== filters.warehouseId) return false;
    if (filters.category && (p.category || '') !== filters.category) return false;
    if (filters.productId && p.id !== filters.productId) return false;
    return true;
  });

  const whSummaryRows = targetWarehouses.map((w) => {
    const whProds = filteredProducts.filter((p) => p.warehouseId === w.id);
    const units = whProds.reduce((s, p) => s + (Number(p.quantity) || 0), 0);
    const val = whProds.reduce(
      (s, p) => s + (Number(p.sellingPrice) || 0) * (Number(p.quantity) || 0),
      0
    );
    return [
      w.code,
      w.name,
      w.location || '—',
      w.managerName || '—',
      formatNumber(whProds.length, lang),
      formatNumber(units, lang),
      formatCurrency(val, currency, lang),
    ];
  });

  const totalWhUnits = filteredProducts.reduce((s, p) => s + (Number(p.quantity) || 0), 0);
  const totalWhVal = filteredProducts.reduce(
    (s, p) => s + (Number(p.sellingPrice) || 0) * (Number(p.quantity) || 0),
    0
  );

  return {
    title: t.reportType10Title,
    storeName: cleanStore,
    generatedDate: today,
    metaPairs,
    kpis: [
      { label: t.warehousesTitle, value: formatNumber(targetWarehouses.length, lang) },
      { label: t.warehouseProductsCount, value: formatNumber(filteredProducts.length, lang) },
      { label: t.warehouseTotalUnits, value: formatNumber(totalWhUnits, lang) },
      { label: t.warehouseTotalValue, value: formatCurrency(totalWhVal, currency, lang) },
    ],
    tables: [
      {
        heading: t.warehousesTitle,
        columns: [
          { label: isAr ? 'الرمز' : 'Code', widthWeight: 1.0 },
          { label: t.warehouseNameLabel, widthWeight: 1.8 },
          { label: t.warehouseLocationLabel, widthWeight: 1.3 },
          { label: t.warehouseManagerLabel, widthWeight: 1.3 },
          { label: t.warehouseProductsCount, align: 'right', widthWeight: 0.9 },
          { label: t.warehouseTotalUnits, align: 'right', widthWeight: 0.9 },
          { label: t.warehouseTotalValue, align: 'right', widthWeight: 1.4 },
        ],
        rows: whSummaryRows,
      },
      {
        heading: t.reportType3Title,
        columns: [
          { label: t.productWarehouseLabel, widthWeight: 1.5 },
          { label: isAr ? 'الرمز' : 'Code', widthWeight: 0.9 },
          { label: isAr ? 'المنتج' : 'Produit', widthWeight: 2.1 },
          { label: t.productCategoryLabel, widthWeight: 1.1 },
          { label: t.productColorLabel, widthWeight: 1.0 },
          { label: isAr ? 'الكمية' : 'Qté', align: 'right', widthWeight: 0.7 },
          { label: isAr ? 'القيمة' : 'Valeur', align: 'right', widthWeight: 1.3 },
        ],
        rows: filteredProducts.map((p) => [
          p.warehouseName || '—',
          p.code,
          p.name,
          p.category || '—',
          p.color || '—',
          formatNumber(p.quantity, lang),
          formatCurrency(p.sellingPrice * p.quantity, currency, lang),
        ]),
      },
    ],
  };
}

export function buildPrintableReportHtml(spec: PrintableReportSpec, lang: Language): string {
  const isAr = lang === 'ar';
  const dir = isAr ? 'rtl' : 'ltr';
  const alignStart = isAr ? 'right' : 'left';
  const alignEnd = isAr ? 'left' : 'right';

  const kpiHtml = spec.kpis
    .map(
      (k) => `
      <div class="kpi">
        <div class="kpi-label">${escapeHtml(k.label)}</div>
        <div class="kpi-value">${escapeHtml(k.value)}</div>
      </div>`
    )
    .join('');

  const metaHtml = (spec.metaPairs || [])
    .map(
      (m) => `
      <div class="meta-item">
        <span class="meta-label">${escapeHtml(m.label)}:</span>
        <span class="meta-val">${escapeHtml(m.value)}</span>
      </div>`
    )
    .join('');

  const tablesHtml = spec.tables
    .map((tbl) => {
      const ths = tbl.columns
        .map((c) => {
          const al = c.align || alignStart;
          return `<th style="text-align:${al}">${escapeHtml(c.label)}</th>`;
        })
        .join('');

      const trs =
        tbl.rows.length > 0
          ? tbl.rows
              .map(
                (r) =>
                  `<tr>${r
                    .map((cell, idx) => {
                      const al = tbl.columns[idx]?.align || alignStart;
                      return `<td style="text-align:${al}">${escapeHtml(cell)}</td>`;
                    })
                    .join('')}</tr>`
              )
              .join('')
          : `<tr><td colspan="${tbl.columns.length}" style="text-align:center;color:#6B8A79;padding:14px;">${escapeHtml(
              translations[lang].reportNoDataForFilters
            )}</td></tr>`;

      const tfoot = tbl.totalsRow
        ? `<tfoot><tr>${tbl.totalsRow
            .map((cell, idx) => {
              const al = tbl.columns[idx]?.align || alignStart;
              return `<td style="text-align:${al}">${escapeHtml(cell)}</td>`;
            })
            .join('')}</tr></tfoot>`
        : '';

      return `
        <div class="table-section">
          ${tbl.heading ? `<h2 class="section-heading">${escapeHtml(tbl.heading)}</h2>` : ''}
          <table>
            <thead><tr>${ths}</tr></thead>
            <tbody>${trs}</tbody>
            ${tfoot}
          </table>
        </div>`;
    })
    .join('');

  return `<!doctype html>
  <html dir="${dir}" lang="${isAr ? 'ar' : 'fr'}">
    <head>
      <meta charset="utf-8" />
      <title>${escapeHtml(spec.title)}</title>
      <style>
        @page { size: A4 portrait; margin: 12mm; }
        * { box-sizing: border-box; }
        body {
          margin: 0; padding: 0; background: #fff; color: #0b1f16;
          font-family: system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif;
          font-size: 11px; line-height: 1.45; position: relative;
        }
        .watermark {
          position: fixed; top: 45%; left: 50%; transform: translate(-50%, -50%) rotate(-24deg);
          font-size: 86px; font-weight: 800; color: rgba(217, 119, 6, 0.12);
          pointer-events: none; z-index: 0; letter-spacing: 6px;
        }
        .header {
          display: flex; justify-content: space-between; align-items: flex-start;
          border-bottom: 2px solid #115E3B; padding-bottom: 10px; margin-bottom: 12px;
        }
        .store { font-size: 12px; font-weight: 700; color: #115E3B; text-transform: uppercase; letter-spacing: .04em; }
        .title { font-size: 19px; font-weight: 800; color: #0B1F16; margin: 2px 0 0; }
        .subtitle { font-size: 12px; font-weight: 600; color: #335947; margin-top: 2px; }
        .header-right { text-align: ${alignEnd}; font-size: 10.5px; color: #335947; }
        .copy-badge {
          display: inline-block; padding: 3px 10px; border: 1.5px solid #D97706;
          background: #FEF3C7; color: #92400E; font-weight: 800; font-size: 11px;
          border-radius: 6px; margin-bottom: 4px;
        }
        .thumb { width: 72px; height: 72px; object-fit: cover; border-radius: 8px; border: 1px solid #DCE7E0; margin-top: 4px; }
        .meta-grid {
          display: flex; flex-wrap: wrap; gap: 6px 18px;
          padding: 8px 10px; background: #F7FAF8; border: 1px solid #DCE7E0;
          border-radius: 8px; margin-bottom: 12px;
        }
        .meta-label { font-weight: 700; color: #335947; }
        .meta-val { color: #0B1F16; }
        .kpis {
          display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
          gap: 8px; margin-bottom: 14px;
        }
        .kpi {
          border: 1px solid #DCE7E0; background: #ECF7F1; border-radius: 8px; padding: 8px 10px;
        }
        .kpi-label { font-size: 9.5px; font-weight: 600; color: #335947; }
        .kpi-value { font-size: 13.5px; font-weight: 800; color: #115E3B; margin-top: 2px; font-variant-numeric: tabular-nums; }
        .section-heading { font-size: 13px; font-weight: 700; color: #115E3B; margin: 14px 0 6px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-variant-numeric: tabular-nums; }
        th {
          background: #115E3B; color: #fff; font-weight: 700; font-size: 10px;
          padding: 7px 6px; border: 1px solid #115E3B;
        }
        td { padding: 6px; border: 1px solid #DCE7E0; font-size: 10.5px; vertical-align: top; }
        tbody tr:nth-child(even) td { background: #F7FAF8; }
        tfoot td { background: #ECF7F1; font-weight: 800; color: #0B1F16; border-top: 2px solid #115E3B; }
        .footer {
          margin-top: 16px; padding-top: 8px; border-top: 1px solid #DCE7E0;
          display: flex; justify-content: space-between; font-size: 10px; color: #6B8A79;
        }
      </style>
    </head>
    <body>
      ${spec.watermark ? `<div class="watermark">${escapeHtml(spec.watermark)}</div>` : ''}
      <div class="header">
        <div>
          <div class="store">${escapeHtml(spec.storeName)}</div>
          <h1 class="title">${escapeHtml(spec.title)}</h1>
          ${spec.subtitle ? `<div class="subtitle">${escapeHtml(spec.subtitle)}</div>` : ''}
        </div>
        <div class="header-right">
          ${spec.watermark ? `<div class="copy-badge">${escapeHtml(spec.watermark)}</div><br/>` : ''}
          ${spec.generatedDate ? `<div>${escapeHtml(translations[lang].reportGeneratedOn)} ${escapeHtml(spec.generatedDate)}</div>` : ''}
          ${spec.thumbnailDataUrl ? `<img class="thumb" src="${escapeHtml(spec.thumbnailDataUrl)}" alt="" />` : ''}
        </div>
      </div>
      ${metaHtml ? `<div class="meta-grid">${metaHtml}</div>` : ''}
      ${spec.kpis.length > 0 ? `<div class="kpis">${kpiHtml}</div>` : ''}
      ${tablesHtml}
      ${(() => {
        const payLines =
          spec.paymentSummaryLines && spec.paymentSummaryLines.length > 0
            ? spec.paymentSummaryLines
            : spec.paymentSummaryLine
            ? [spec.paymentSummaryLine]
            : [];
        if (payLines.length === 0) return '';
        return `<div style="display:flex;justify-content:flex-end;margin:-4px 0 12px;"><div style="border:1px solid #115E3B;background:#ECF7F1;color:#0B1F16;padding:6px 12px;border-radius:6px;font-weight:800;font-size:11px;line-height:1.55;text-align:${alignEnd};font-variant-numeric:tabular-nums;">${payLines
          .map((line) => `<div>${escapeHtml(line)}</div>`)
          .join('')}</div></div>`;
      })()}
      <div class="footer">
        <span>${escapeHtml(spec.footerNote || spec.storeName)}</span>
        ${spec.generatedDate ? `<span>${escapeHtml(spec.generatedDate)}</span>` : '<span></span>'}
      </div>
      ${
        spec.companyFooterLines && spec.companyFooterLines.length > 0
          ? `<div style="margin-top:10px;padding-top:8px;border-top:1px solid #DCE7E0;text-align:center;color:#335947;font-size:9.5px;line-height:1.55;">
              ${spec.companyFooterLines
                .map(
                  (line, idx) =>
                    `<div style="${idx === 0 ? 'font-weight:700;color:#0B1F16;font-size:10px;' : ''}">${escapeHtml(line)}</div>`
                )
                .join('')}
            </div>`
          : ''
      }
    </body>
  </html>`;
}

export async function tryPrintHtmlDocument(html: string): Promise<boolean> {
  if (Capacitor.isNativePlatform() || typeof document === 'undefined') {
    return false;
  }

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
      setTimeout(() => {
        cleanup(printTriggered);
      }, 380);
    };

    document.body.appendChild(iframe);
    iframe.srcdoc = html;
  });
}

function truncateText(text: string, maxChars: number): string {
  const clean = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (clean.length <= maxChars) return clean;
  return `${clean.slice(0, Math.max(1, maxChars - 1))}…`;
}

export async function renderSpecToPdfBlob(spec: PrintableReportSpec, lang: Language): Promise<Blob> {
  const isAr = lang === 'ar';
  // High-DPI A4 raster (1240 x 1754) -> supports Arabic glyphs & RTL seamlessly
  const pageW = 1240;
  const pageH = 1754;
  const marginX = 56;
  const contentW = pageW - marginX * 2;
  const companyLines = spec.companyFooterLines || [];
  const companyBlockH = companyLines.length > 0 ? companyLines.length * 22 + 30 : 0;
  const bottomLimit = pageH - (72 + companyBlockH);

  const pages: HTMLCanvasElement[] = [];

  const createPage = (pageNum: number) => {
    const canvas = document.createElement('canvas');
    canvas.width = pageW;
    canvas.height = pageH;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas unavailable');
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, pageW, pageH);
    ctx.direction = isAr ? 'rtl' : 'ltr';

    if (spec.watermark) {
      ctx.save();
      ctx.translate(pageW / 2, pageH / 2);
      ctx.rotate(-Math.PI / 6);
      ctx.fillStyle = 'rgba(217, 119, 6, 0.08)';
      ctx.font = 'bold 140px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(spec.watermark, 0, 0);
      ctx.restore();
    }

    // Footer & optional company coordinates at bottom of BL
    const noteY = companyLines.length > 0 ? pageH - companyBlockH - 22 : pageH - 32;
    ctx.fillStyle = '#6B8A79';
    ctx.font = '18px system-ui, sans-serif';
    ctx.textAlign = isAr ? 'right' : 'left';
    ctx.fillText(spec.footerNote || spec.storeName, isAr ? pageW - marginX : marginX, noteY);
    ctx.textAlign = isAr ? 'left' : 'right';
    ctx.fillText(`p.${pageNum}`, isAr ? marginX : pageW - marginX, noteY);

    if (companyLines.length > 0) {
      const dividerY = pageH - companyBlockH - 4;
      ctx.strokeStyle = '#DCE7E0';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(marginX, dividerY);
      ctx.lineTo(pageW - marginX, dividerY);
      ctx.stroke();

      companyLines.forEach((line, idx) => {
        ctx.fillStyle = idx === 0 ? '#0B1F16' : '#335947';
        ctx.font = idx === 0 ? 'bold 15px system-ui, sans-serif' : '14px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(truncateText(line, 115), pageW / 2, dividerY + 24 + idx * 22);
      });
    }

    pages.push(canvas);
    return { canvas, ctx };
  };

  let { ctx } = createPage(1);
  let y = 56;

  // Header bar
  ctx.fillStyle = '#115E3B';
  ctx.fillRect(marginX, y, contentW, 116);

  ctx.fillStyle = '#A7F3D0';
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.textAlign = isAr ? 'right' : 'left';
  ctx.fillText(spec.storeName, isAr ? pageW - marginX - 24 : marginX + 24, y + 36);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 30px system-ui, sans-serif';
  ctx.fillText(truncateText(spec.title, 54), isAr ? pageW - marginX - 24 : marginX + 24, y + 76);

  if (spec.subtitle) {
    ctx.fillStyle = '#D1FAE5';
    ctx.font = '18px system-ui, sans-serif';
    ctx.fillText(truncateText(spec.subtitle, 65), isAr ? pageW - marginX - 24 : marginX + 24, y + 102);
  }

  if (spec.generatedDate) {
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '18px system-ui, sans-serif';
    ctx.textAlign = isAr ? 'left' : 'right';
    ctx.fillText(spec.generatedDate, isAr ? marginX + 24 : pageW - marginX - 24, y + 40);
  }

  if (spec.watermark) {
    ctx.fillStyle = '#FEF3C7';
    const bx = isAr ? marginX + 24 : pageW - marginX - 180;
    ctx.fillRect(bx, y + 54, 156, 40);
    ctx.fillStyle = '#92400E';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(spec.watermark, bx + 78, y + 81);
  }

  y += 136;

  // Meta pairs box
  if (spec.metaPairs && spec.metaPairs.length > 0) {
    const metaHeight = Math.ceil(spec.metaPairs.length / 2) * 32 + 22;
    ctx.fillStyle = '#F7FAF8';
    ctx.fillRect(marginX, y, contentW, metaHeight);
    ctx.strokeStyle = '#DCE7E0';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(marginX, y, contentW, metaHeight);

    const halfW = contentW / 2 - 20;
    spec.metaPairs.forEach((m, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const px = isAr
        ? pageW - marginX - 18 - col * halfW
        : marginX + 18 + col * halfW;
      const py = y + 32 + row * 32;
      ctx.fillStyle = '#335947';
      ctx.font = 'bold 17px system-ui, sans-serif';
      ctx.textAlign = isAr ? 'right' : 'left';
      ctx.fillText(truncateText(`${m.label}: ${m.value}`, 46), px, py);
    });
    y += metaHeight + 18;
  }

  // KPI cards
  if (spec.kpis.length > 0) {
    const count = Math.min(4, spec.kpis.length);
    const gap = 14;
    const cardW = (contentW - gap * (count - 1)) / count;
    spec.kpis.slice(0, 4).forEach((k, i) => {
      const visualIndex = isAr ? count - 1 - i : i;
      const kx = marginX + visualIndex * (cardW + gap);
      ctx.fillStyle = '#ECF7F1';
      ctx.fillRect(kx, y, cardW, 78);
      ctx.strokeStyle = '#DCE7E0';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(kx, y, cardW, 78);

      ctx.fillStyle = '#335947';
      ctx.font = 'bold 16px system-ui, sans-serif';
      ctx.textAlign = isAr ? 'right' : 'left';
      ctx.fillText(truncateText(k.label, 24), isAr ? kx + cardW - 14 : kx + 14, y + 28);

      ctx.fillStyle = '#115E3B';
      ctx.font = 'bold 23px system-ui, sans-serif';
      ctx.fillText(truncateText(k.value, 22), isAr ? kx + cardW - 14 : kx + 14, y + 60);
    });
    y += 98;
  }

  const ensureSpace = (needed: number) => {
    if (y + needed > bottomLimit) {
      const next = createPage(pages.length + 1);
      ctx = next.ctx;
      y = 56;
    }
  };

  for (const tbl of spec.tables) {
    ensureSpace(120);
    if (tbl.heading) {
      ctx.fillStyle = '#115E3B';
      ctx.font = 'bold 22px system-ui, sans-serif';
      ctx.textAlign = isAr ? 'right' : 'left';
      ctx.fillText(tbl.heading, isAr ? pageW - marginX : marginX, y + 20);
      y += 34;
    }

    const totalWeight = tbl.columns.reduce((s, c) => s + (c.widthWeight || 1), 0);
    const colWidths = tbl.columns.map((c) => ((c.widthWeight || 1) / totalWeight) * contentW);
    const orderedCols = isAr ? [...tbl.columns].reverse() : tbl.columns;
    const orderedWidths = isAr ? [...colWidths].reverse() : colWidths;

    const drawTableHeader = () => {
      ctx.fillStyle = '#115E3B';
      ctx.fillRect(marginX, y, contentW, 40);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 15px system-ui, sans-serif';
      let cx = marginX;
      orderedCols.forEach((col, i) => {
        const w = orderedWidths[i];
        const al = col.align || (isAr ? 'right' : 'left');
        ctx.textAlign = al;
        const tx = al === 'right' ? cx + w - 8 : al === 'center' ? cx + w / 2 : cx + 8;
        ctx.fillText(truncateText(col.label, Math.max(8, Math.floor(w / 9))), tx, y + 26);
        cx += w;
      });
      y += 40;
    };

    drawTableHeader();

    const rowsToDraw =
      tbl.rows.length > 0
        ? tbl.rows
        : [[translations[lang].reportNoDataForFilters, ...Array(Math.max(0, tbl.columns.length - 1)).fill('')]];

    rowsToDraw.forEach((row, rIdx) => {
      if (y + 38 > bottomLimit) {
        const next = createPage(pages.length + 1);
        ctx = next.ctx;
        y = 56;
        drawTableHeader();
      }
      ctx.fillStyle = rIdx % 2 === 1 ? '#F7FAF8' : '#FFFFFF';
      ctx.fillRect(marginX, y, contentW, 36);
      ctx.strokeStyle = '#DCE7E0';
      ctx.lineWidth = 1;
      ctx.strokeRect(marginX, y, contentW, 36);

      const orderedCells = isAr ? [...row].reverse() : row;
      ctx.fillStyle = '#0B1F16';
      ctx.font = '15px system-ui, sans-serif';
      let cx = marginX;
      orderedCells.forEach((cell, i) => {
        const w = orderedWidths[i] || 80;
        const col = orderedCols[i];
        const al = col?.align || (isAr ? 'right' : 'left');
        ctx.textAlign = al;
        const tx = al === 'right' ? cx + w - 8 : al === 'center' ? cx + w / 2 : cx + 8;
        ctx.fillText(truncateText(cell, Math.max(8, Math.floor(w / 8.5))), tx, y + 24);
        cx += w;
      });
      y += 36;
    });

    if (tbl.totalsRow) {
      ensureSpace(44);
      ctx.fillStyle = '#ECF7F1';
      ctx.fillRect(marginX, y, contentW, 40);
      ctx.strokeStyle = '#115E3B';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(marginX, y, contentW, 40);

      const orderedTotals = isAr ? [...tbl.totalsRow].reverse() : tbl.totalsRow;
      ctx.fillStyle = '#115E3B';
      ctx.font = 'bold 16px system-ui, sans-serif';
      let cx = marginX;
      orderedTotals.forEach((cell, i) => {
        const w = orderedWidths[i] || 80;
        const col = orderedCols[i];
        const al = col?.align || (isAr ? 'right' : 'left');
        ctx.textAlign = al;
        const tx = al === 'right' ? cx + w - 8 : al === 'center' ? cx + w / 2 : cx + 8;
        ctx.fillText(truncateText(cell, Math.max(8, Math.floor(w / 8.5))), tx, y + 26);
        cx += w;
      });
      y += 42;
    }

    y += 18;
  }

  const pdfPayLines =
    spec.paymentSummaryLines && spec.paymentSummaryLines.length > 0
      ? spec.paymentSummaryLines
      : spec.paymentSummaryLine
      ? [spec.paymentSummaryLine]
      : [];
  if (pdfPayLines.length > 0) {
    ensureSpace(20 + pdfPayLines.length * 26);
    ctx.fillStyle = '#0B1F16';
    ctx.font = 'bold 17px system-ui, sans-serif';
    ctx.textAlign = isAr ? 'left' : 'right';
    pdfPayLines.forEach((line, idx) => {
      ctx.fillText(
        line,
        isAr ? marginX + 8 : pageW - marginX - 8,
        y + 6 + idx * 25
      );
    });
    y += 14 + pdfPayLines.length * 25;
  }

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  pages.forEach((canvas, idx) => {
    if (idx > 0) doc.addPage('a4', 'portrait');
    const dataUrl = canvas.toDataURL('image/png');
    doc.addImage(dataUrl, 'PNG', 0, 0, 210, 297);
  });

  return doc.output('blob');
}

export async function executeReportOutput(options: {
  mode: 'print' | 'pdf';
  spec: PrintableReportSpec;
  filename: string;
  lang: Language;
}): Promise<'printed' | 'pdf_exported' | 'pdf_fallback'> {
  const { mode, spec, filename, lang } = options;

  if (mode === 'print') {
    const html = buildPrintableReportHtml(spec, lang);
    const printed = await tryPrintHtmlDocument(html);
    if (printed) return 'printed';

    const pdfBlob = await renderSpecToPdfBlob(spec, lang);
    await saveOrShareBlob(pdfBlob, filename, spec.title);
    return 'pdf_fallback';
  }

  const pdfBlob = await renderSpecToPdfBlob(spec, lang);
  await saveOrShareBlob(pdfBlob, filename, spec.title);
  return 'pdf_exported';
}
