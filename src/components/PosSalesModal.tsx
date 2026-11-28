import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Banknote,
  BarChart3,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CreditCard,
  Download,
  Edit3,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  Filter,
  History,
  Landmark,
  Pencil,
  Printer,
  QrCode,
  Receipt,
  RotateCcw,
  Search,
  ShoppingBag,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  Vault,
  Wallet,
  X,
} from 'lucide-react';
import type {
  Customer,
  CustomerCategory,
  CustomerPayload,
  Language,
  PaymentInstrumentType,
  PosInvoice,
  PosInvoiceItem,
  PosPaymentSplit,
  PosSaleInstrumentInput,
  PosSalePayload,
  PosSummary,
  Product,
  PurchasePaymentMethod,
  ShopSettings,
  Warehouse,
} from '../types';
import { formatCurrency, formatNumber, translations } from '../i18n';
import { convertFromMad, convertToMad } from '../utils/currency';
import { buildInvoiceReceiptBlob } from '../utils/qr';
import { buildSalesReportExcelBlob } from '../utils/excel';
import { saveOrShareBlob } from '../utils/download';
import { openCashDrawer } from '../utils/printer';
import { buildReportSpec, executeReportOutput } from '../utils/printReports';

interface PosSalesModalProps {
  isOpen: boolean;
  initialView?: 'caisse' | 'invoices';
  lang: Language;
  currency: string;
  storeName?: string;
  shopSettings?: Partial<ShopSettings>;
  products: Product[];
  customers: Customer[];
  warehouses?: Warehouse[];
  invoices: PosInvoice[];
  summary: PosSummary;
  onClose: () => void;
  onCreateSale: (payload: PosSalePayload) => Promise<PosInvoice | null>;
  onCancelInvoice: (invoiceId: string) => Promise<void>;
  onUpdateBlSequence?: (
    nextSeqOrLabel: number | string
  ) => Promise<{ nextBlSeq: number; blNumber: string }>;
  onConvertBlToInvoice?: (invoiceId: string) => Promise<PosInvoice | null>;
  onCreateCustomer?: (payload: CustomerPayload) => Promise<Customer>;
  onPickProductViaQr?: (onSelect: (product: Product) => void) => void;
  onPrintInvoice?: (invoice: PosInvoice, isCopy: boolean) => Promise<void>;
  onPrintPosTicket?: (invoice: PosInvoice) => Promise<void>;
  onOpenProductDigitalFile: (productId: string) => void;
  onPrintAggregateInvoices?: (filters: {
    startDate?: string;
    endDate?: string;
    customerId?: string;
    productId?: string;
    category?: string;
  }) => void;
  onPrintSalesReport?: (filters: {
    startDate?: string;
    endDate?: string;
    customerId?: string;
    productId?: string;
    category?: string;
  }) => void;
  onOpenPortfolio?: () => void;
  onPortfolioChanged?: () => void;
  onNotify?: (message: string) => void;
}

interface CartLineItem {
  productId: string;
  productCode: string;
  productName: string;
  availableQty: number;
  quantity: number;
  unitPriceDisplay: number;
  discountPercent: number;
}

type DailyPreset = 'today' | 'morning' | 'afternoon' | 'week' | 'month' | 'custom';
type SplitMethod = 'cash' | 'check' | 'bill_of_exchange' | 'card' | 'credit';

interface InstrumentDraft {
  bankName: string;
  instrumentNumber: string;
  holderName: string;
  customerPhone: string;
  blNumber: string;
  receiptDate: string;
  dueDate: string;
  notes: string;
}

function createEmptyInstrumentDrafts(
  receiptDate: string,
  blNumber: string,
  customerName: string,
  customerPhone: string
): Record<PaymentInstrumentType, InstrumentDraft> {
  return {
    check: {
      bankName: '',
      instrumentNumber: '',
      holderName: customerName,
      customerPhone,
      blNumber,
      receiptDate,
      dueDate: '',
      notes: '',
    },
    bill_of_exchange: {
      bankName: '',
      instrumentNumber: '',
      holderName: customerName,
      customerPhone,
      blNumber,
      receiptDate,
      dueDate: '',
      notes: '',
    },
    card: {
      bankName: '',
      instrumentNumber: '',
      holderName: customerName,
      customerPhone,
      blNumber,
      receiptDate,
      dueDate: receiptDate,
      notes: '',
    },
  };
}

function formatBlCode(seq: number): string {
  const safe = Math.max(1, Math.floor(Number(seq) || 1));
  return `BL-${String(safe).padStart(4, '0')}`;
}

function calcLineTotalDisplay(item: CartLineItem): number {
  const gross = Math.max(0, Number(item.quantity) || 0) * Math.max(0, Number(item.unitPriceDisplay) || 0);
  const disc = Math.min(100, Math.max(0, Number(item.discountPercent) || 0));
  return Math.round(gross * (1 - disc / 100) * 100) / 100;
}

function getInvoiceLineItems(inv: PosInvoice): PosInvoiceItem[] {
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
      discountPercent: 0,
      totalPrice: inv.totalPrice,
      purchasePrice: inv.purchasePrice,
    },
  ];
}

function getDateOffsetIso(daysOffset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  return d.toISOString().slice(0, 10);
}

export function PosSalesModal({
  isOpen,
  initialView = 'invoices',
  lang,
  currency,
  storeName = '',
  shopSettings,
  products,
  customers,
  warehouses = [],
  invoices,
  summary,
  onClose,
  onCreateSale,
  onCancelInvoice,
  onUpdateBlSequence,
  onConvertBlToInvoice,
  onCreateCustomer,
  onPickProductViaQr,
  onPrintInvoice,
  onPrintPosTicket,
  onOpenProductDigitalFile,
  onPrintAggregateInvoices,
  onPrintSalesReport,
  onOpenPortfolio,
  onPortfolioChanged,
  onNotify,
}: PosSalesModalProps) {
  const t = translations[lang];
  const isCaisseMode = initialView === 'caisse';
  const availableProducts = useMemo(
    () => products.filter((p) => (Number(p.quantity) || 0) > 0),
    [products]
  );

  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const categories = useMemo(
    () =>
      Array.from(
        new Set(products.map((p) => (p.category || '').trim()).filter(Boolean))
      ).sort(),
    [products]
  );

  // Shared / Invoices state
  const [showReport, setShowReport] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [docTypeFilter, setDocTypeFilter] = useState<'all' | 'bl' | 'facture'>('all');
  const [exportingSales, setExportingSales] = useState(false);
  const [lastCreatedInvoice, setLastCreatedInvoice] = useState<PosInvoice | null>(null);
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [convertingId, setConvertingId] = useState<string | null>(null);
  const [printingId, setPrintingId] = useState<string | null>(null);

  // CAISSE BL Workspace state
  const [cartItems, setCartItems] = useState<CartLineItem[]>([]);
  const [productSearchInput, setProductSearchInput] = useState('');
  const [searchDropdownOpen, setSearchDropdownOpen] = useState(false);
  const [priceEditMode, setPriceEditMode] = useState(false);
  const [confirmClearBl, setConfirmClearBl] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Editable BL sequence (item 00)
  const [editingBlSeq, setEditingBlSeq] = useState(false);
  const [blSeqInput, setBlSeqInput] = useState('');
  const [savingBlSeq, setSavingBlSeq] = useState(false);

  // Customer selection + modal (item 9)
  const [customerId, setCustomerId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [customerSearchInput, setCustomerSearchInput] = useState('');
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustCity, setNewCustCity] = useState('');
  const [newCustCategory, setNewCustCategory] = useState<CustomerCategory>('regular');
  const [savingNewCustomer, setSavingNewCustomer] = useState(false);

  // Payment & Validate Modal (item 14)
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentMode, setPaymentMode] = useState<'single' | 'mixed'>('single');
  const [singlePaymentMethod, setSinglePaymentMethod] =
    useState<Exclude<PurchasePaymentMethod, 'mixed'>>('cash');
  const [splitAmounts, setSplitAmounts] = useState<Record<SplitMethod, string>>({
    cash: '',
    check: '',
    bill_of_exchange: '',
    card: '',
    credit: '',
  });
  const [instrumentDrafts, setInstrumentDrafts] = useState<
    Record<PaymentInstrumentType, InstrumentDraft>
  >(() =>
    createEmptyInstrumentDrafts(new Date().toISOString().slice(0, 10), 'BL-0001', '', '')
  );
  const [saleDate, setSaleDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Daily Cash Register Summary Modal (item 0)
  const [dailySummaryOpen, setDailySummaryOpen] = useState(false);
  const [dailyPreset, setDailyPreset] = useState<DailyPreset>('today');
  const [dailyStartDate, setDailyStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dailyEndDate, setDailyEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dailyValidated, setDailyValidated] = useState(false);
  const [dailyRunningOutput, setDailyRunningOutput] = useState(false);

  // BL History & Copy Reprint Modal inside CAISSE
  const [blHistoryOpen, setBlHistoryOpen] = useState(false);
  const [blHistorySearch, setBlHistorySearch] = useState('');
  const [blHistoryDate, setBlHistoryDate] = useState('');
  const [blHistoryProductId, setBlHistoryProductId] = useState('');
  const [blHistoryCustomerId, setBlHistoryCustomerId] = useState('');
  const [blHistoryPrintedOnly, setBlHistoryPrintedOnly] = useState(false);

  // Filter states for Factures mode
  const [searchQuery, setSearchQuery] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [filterProductId, setFilterProductId] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterCustomerId, setFilterCustomerId] = useState('');
  const [filterWarehouseId, setFilterWarehouseId] = useState('');

  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const firstPriceInputRef = useRef<HTMLInputElement | null>(null);
  const searchBoxRef = useRef<HTMLDivElement | null>(null);
  const prevIsOpenRef = useRef(false);

  useEffect(() => {
    const justOpened = isOpen && !prevIsOpenRef.current;
    prevIsOpenRef.current = isOpen;
    if (!justOpened) return;

    const todayStr = new Date().toISOString().slice(0, 10);
    setErrorMsg('');
    setLastCreatedInvoice(null);
    setShowFilters(false);
    setShowReport(false);
    setDocTypeFilter('all');
    setCartItems([]);
    setProductSearchInput('');
    setSearchDropdownOpen(false);
    setPriceEditMode(false);
    setConfirmClearBl(false);
    setEditingBlSeq(false);
    setBlSeqInput(formatBlCode(summary.nextBlSeq || 1));
    setCustomerId('');
    setCustomerName('');
    setCustomerPhone('');
    setCustomerModalOpen(false);
    setPaymentModalOpen(false);
    setPaymentMode('single');
    setSinglePaymentMethod('cash');
    setSplitAmounts({ cash: '', check: '', bill_of_exchange: '', card: '', credit: '' });
    setInstrumentDrafts(
      createEmptyInstrumentDrafts(todayStr, formatBlCode(summary.nextBlSeq || 1), '', '')
    );
    setSaleDate(todayStr);
    setNotes('');
    setDailySummaryOpen(false);
    setDailyPreset('today');
    setDailyStartDate(todayStr);
    setDailyEndDate(todayStr);
    setDailyValidated(false);
    setBlHistoryOpen(false);
    setBlHistorySearch('');
    setBlHistoryDate('');
    setBlHistoryProductId('');
    setBlHistoryCustomerId('');
    setBlHistoryPrintedOnly(false);
  }, [isOpen, initialView, summary.nextBlSeq]);

  // Close product search dropdown on outside click
  useEffect(() => {
    if (!searchDropdownOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) {
        setSearchDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [searchDropdownOpen]);

  const currentBlLabel = formatBlCode(summary.nextBlSeq || 1);

  const filteredAvailableProducts = useMemo(() => {
    const q = productSearchInput.trim().toLowerCase();
    if (!q) return availableProducts.slice(0, 25);
    return availableProducts
      .filter(
        (p) =>
          p.code.toLowerCase().includes(q) ||
          (p.qrToken || '').toLowerCase().includes(q) ||
          p.name.toLowerCase().includes(q)
      )
      .slice(0, 30);
  }, [availableProducts, productSearchInput]);

  const filteredCustomers = useMemo(() => {
    const q = customerSearchInput.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.code.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        (c.phone || '').toLowerCase().includes(q)
    );
  }, [customers, customerSearchInput]);

  const addOrIncrementProductInBl = useCallback(
    (prod: Product) => {
      const avail = Math.max(0, Number(prod.quantity) || 0);
      if (avail <= 0) {
        setErrorMsg(t.qrScannerOutOfStock);
        return;
      }
      setErrorMsg('');
      const defaultPriceDisp = convertFromMad(prod.sellingPrice, currency);
      setCartItems((prev) => {
        const idx = prev.findIndex((item) => item.productId === prod.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = {
            ...next[idx],
            availableQty: avail,
            quantity: Math.min(avail, next[idx].quantity + 1),
          };
          return next;
        }
        return [
          ...prev,
          {
            productId: prod.id,
            productCode: prod.code,
            productName: prod.name,
            availableQty: avail,
            quantity: 1,
            unitPriceDisplay: defaultPriceDisp,
            discountPercent: 0,
          },
        ];
      });
      setProductSearchInput('');
      setSearchDropdownOpen(false);
    },
    [currency, t.qrScannerOutOfStock]
  );

  // Daily Summary Report Spec
  const dailyReportSpec = useMemo(() => {
    const timeOfDay =
      dailyPreset === 'morning'
        ? 'morning'
        : dailyPreset === 'afternoon'
        ? 'afternoon'
        : 'all';
    return buildReportSpec(
      {
        reportType: 'cash_register_summary',
        startDate: dailyStartDate || undefined,
        endDate: dailyEndDate || undefined,
        timeOfDay,
      },
      {
        products,
        warehouses,
        customers,
        suppliers: [],
        invoices,
        adjustments: [],
        storeName,
        currency,
        lang,
      }
    );
  }, [
    dailyPreset,
    dailyStartDate,
    dailyEndDate,
    products,
    warehouses,
    customers,
    invoices,
    storeName,
    currency,
    lang,
  ]);

  const blHistoryMatches = useMemo(() => {
    const q = blHistorySearch.trim().toLowerCase();
    return invoices.filter((inv) => {
      const hasBl = inv.documentType === 'bl' || Boolean(inv.blNumber);
      if (!hasBl) return false;
      if (blHistoryPrintedOnly && (inv.printCount || 0) <= 0) return false;
      const d = (inv.saleDate || '').slice(0, 10);
      if (blHistoryDate && d !== blHistoryDate) return false;
      if (blHistoryCustomerId === '__walk_in__') {
        if (inv.customerId) return false;
      } else if (blHistoryCustomerId && inv.customerId !== blHistoryCustomerId) {
        return false;
      }
      const items = getInvoiceLineItems(inv);
      if (
        blHistoryProductId &&
        inv.productId !== blHistoryProductId &&
        !items.some((li) => li.productId === blHistoryProductId)
      ) {
        return false;
      }
      if (q) {
        const blCode = (inv.blNumber || inv.invoiceNumber || '').toLowerCase();
        const matchText =
          blCode.includes(q) ||
          inv.invoiceNumber.toLowerCase().includes(q) ||
          d.includes(q) ||
          (inv.customerName || '').toLowerCase().includes(q) ||
          (inv.customerPhone || '').toLowerCase().includes(q) ||
          (inv.productCode || '').toLowerCase().includes(q) ||
          (inv.productName || '').toLowerCase().includes(q) ||
          items.some(
            (li) =>
              li.productCode.toLowerCase().includes(q) ||
              li.productName.toLowerCase().includes(q)
          );
        if (!matchText) return false;
      }
      return true;
    });
  }, [
    invoices,
    blHistorySearch,
    blHistoryDate,
    blHistoryProductId,
    blHistoryCustomerId,
    blHistoryPrintedOnly,
  ]);

  // Factures filtering
  const filteredInvoices = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return invoices.filter((inv) => {
      const docType = inv.documentType || 'facture';
      if (docTypeFilter !== 'all' && docType !== docTypeFilter) return false;
      const items = getInvoiceLineItems(inv);
      const d = (inv.saleDate || '').slice(0, 10);
      if (filterFrom && (!d || d < filterFrom)) return false;
      if (filterTo && (!d || d > filterTo)) return false;
      if (filterCustomerId && inv.customerId !== filterCustomerId) return false;
      if (filterProductId && !items.some((li) => li.productId === filterProductId)) return false;
      if (filterCategory) {
        const matchCat = items.some((li) => {
          const cat = (li.category || productMap.get(li.productId)?.category || '').trim();
          return cat === filterCategory;
        });
        if (!matchCat) return false;
      }
      if (filterWarehouseId) {
        const matchWh = items.some((li) => {
          const wh = (li.warehouseId || productMap.get(li.productId)?.warehouseId || '').trim();
          return wh === filterWarehouseId || inv.warehouseId === filterWarehouseId;
        });
        if (!matchWh) return false;
      }
      if (q) {
        const matchSearch =
          inv.invoiceNumber.toLowerCase().includes(q) ||
          (inv.blNumber || '').toLowerCase().includes(q) ||
          inv.customerName.toLowerCase().includes(q) ||
          inv.productCode.toLowerCase().includes(q) ||
          inv.productName.toLowerCase().includes(q) ||
          items.some(
            (li) =>
              li.productCode.toLowerCase().includes(q) ||
              li.productName.toLowerCase().includes(q)
          );
        if (!matchSearch) return false;
      }
      return true;
    });
  }, [
    invoices,
    docTypeFilter,
    searchQuery,
    filterFrom,
    filterTo,
    filterCustomerId,
    filterProductId,
    filterCategory,
    filterWarehouseId,
    productMap,
  ]);

  const hasActiveFilters = Boolean(
    searchQuery ||
      docTypeFilter !== 'all' ||
      filterFrom ||
      filterTo ||
      filterCustomerId ||
      filterProductId ||
      filterCategory ||
      filterWarehouseId
  );

  const filteredSummary = useMemo(() => {
    let totalUnitsSold = 0;
    let totalRevenueMad = 0;
    let totalCostMad = 0;
    let totalBlCount = 0;
    let totalFormalInvoices = 0;
    const todayStr = new Date().toISOString().slice(0, 10);
    let todayBlCount = 0;

    for (const inv of filteredInvoices) {
      const docType = inv.documentType || 'facture';
      if (docType === 'bl') {
        totalBlCount += 1;
        if ((inv.saleDate || '').slice(0, 10) === todayStr) todayBlCount += 1;
      } else {
        totalFormalInvoices += 1;
      }
      const items = getInvoiceLineItems(inv);
      for (const li of items) {
        const qty = Number(li.quantity) || 0;
        totalUnitsSold += qty;
        totalRevenueMad += Number(li.totalPrice) || 0;
        totalCostMad += (Number(li.purchasePrice) || 0) * qty;
      }
    }
    return {
      totalInvoices: filteredInvoices.length,
      totalFormalInvoices,
      totalBlCount,
      todayBlCount,
      totalUnitsSold,
      totalRevenueMad,
      totalProfitMad: totalRevenueMad - totalCostMad,
      nextBlSeq: summary.nextBlSeq,
    };
  }, [filteredInvoices, summary.nextBlSeq]);

  const activeSummary = hasActiveFilters ? filteredSummary : summary;

  const salesBreakdown = useMemo(() => {
    let totalCostMad = 0;
    let totalRevenueMad = 0;
    const byPayment = new Map<string, { count: number; units: number; revenueMad: number }>();
    const byProduct = new Map<
      string,
      { code: string; name: string; count: number; units: number; revenueMad: number; costMad: number }
    >();

    for (const inv of filteredInvoices) {
      const items = getInvoiceLineItems(inv);
      const invUnits = items.reduce((s, x) => s + (Number(x.quantity) || 0), 0);
      const invRev = Number(inv.totalPrice) || 0;
      totalRevenueMad += invRev;

      if (inv.paymentBreakdown && inv.paymentBreakdown.length > 0) {
        for (const split of inv.paymentBreakdown) {
          const amt = Number(split.amount) || 0;
          if (amt <= 0) continue;
          const pKey = split.method || 'cash';
          const pEntry = byPayment.get(pKey) || { count: 0, units: 0, revenueMad: 0 };
          pEntry.count += 1;
          pEntry.units += invUnits;
          pEntry.revenueMad += amt;
          byPayment.set(pKey, pEntry);
        }
      } else {
        const pKey = inv.paymentMethod || 'cash';
        const pEntry = byPayment.get(pKey) || { count: 0, units: 0, revenueMad: 0 };
        pEntry.count += 1;
        pEntry.units += invUnits;
        pEntry.revenueMad += invRev;
        byPayment.set(pKey, pEntry);
      }

      for (const li of items) {
        const qty = Number(li.quantity) || 0;
        const rev = Number(li.totalPrice) || 0;
        const cost = (Number(li.purchasePrice) || 0) * qty;
        totalCostMad += cost;

        const prodKey = li.productCode || li.productId;
        const prodEntry = byProduct.get(prodKey) || {
          code: li.productCode,
          name: li.productName,
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
    }

    const netProfitMad = totalRevenueMad - totalCostMad;
    const marginPct =
      totalRevenueMad > 0 ? Math.round((netProfitMad / totalRevenueMad) * 1000) / 10 : 0;
    const avgInvoiceMad =
      filteredInvoices.length > 0 ? totalRevenueMad / filteredInvoices.length : 0;

    return {
      totalCostMad,
      netProfitMad,
      marginPct,
      avgInvoiceMad,
      paymentRows: Array.from(byPayment.entries()),
      productRows: Array.from(byProduct.values()).sort((a, b) => b.revenueMad - a.revenueMad),
    };
  }, [filteredInvoices]);

  if (!isOpen) return null;

  const cartTotalUnits = cartItems.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  const cartGrandTotalDisplay =
    Math.round(cartItems.reduce((sum, item) => sum + calcLineTotalDisplay(item), 0) * 100) / 100;

  const paymentLabel = (method: string) => {
    if (method === 'transfer') return t.paymentTransfer;
    if (method === 'check') return t.paymentCheck;
    if (method === 'bill_of_exchange') return t.paymentBillOfExchange;
    if (method === 'card') return t.paymentCard;
    if (method === 'credit') return t.paymentCredit;
    if (method === 'mixed') return t.posPaymentMixed;
    if (method === 'other') return t.paymentOther;
    return t.paymentCash;
  };

  const handleSaveBlSeq = async () => {
    if (!onUpdateBlSequence || savingBlSeq) return;
    const raw = blSeqInput.trim();
    if (!raw) {
      setEditingBlSeq(false);
      return;
    }
    setSavingBlSeq(true);
    try {
      const updated = await onUpdateBlSequence(raw);
      setBlSeqInput(updated.blNumber);
      setEditingBlSeq(false);
      onNotify?.(`${t.posBlUpdatedToast} ${updated.blNumber}`);
    } finally {
      setSavingBlSeq(false);
    }
  };

  const handleProductSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const q = productSearchInput.trim().toLowerCase();
    if (!q) return;
    const exact = availableProducts.find(
      (p) => p.code.toLowerCase() === q || (p.qrToken || '').toLowerCase() === q
    );
    const hit = exact || filteredAvailableProducts[0];
    if (hit) {
      addOrIncrementProductInBl(hit);
    }
  };

  const handleUpdateCartItemQty = (productId: string, newQty: number) => {
    setCartItems((prev) =>
      prev.map((item) =>
        item.productId === productId
          ? { ...item, quantity: Math.min(item.availableQty, Math.max(1, Math.floor(newQty || 1))) }
          : item
      )
    );
  };

  const handleUpdateCartItemPrice = (productId: string, newPrice: number) => {
    setCartItems((prev) =>
      prev.map((item) =>
        item.productId === productId
          ? { ...item, unitPriceDisplay: Math.max(0, Number(newPrice) || 0) }
          : item
      )
    );
  };

  const handleUpdateCartItemDiscount = (productId: string, newDisc: number) => {
    setCartItems((prev) =>
      prev.map((item) =>
        item.productId === productId
          ? { ...item, discountPercent: Math.min(100, Math.max(0, Number(newDisc) || 0)) }
          : item
      )
    );
  };

  const handleRemoveCartItem = (productId: string) => {
    setCartItems((prev) => prev.filter((item) => item.productId !== productId));
  };

  const handleClearCurrentBl = () => {
    setCartItems([]);
    setCustomerId('');
    setCustomerName('');
    setCustomerPhone('');
    setProductSearchInput('');
    setSearchDropdownOpen(false);
    setConfirmClearBl(false);
    setPriceEditMode(false);
    setErrorMsg('');
  };

  const handleTriggerDrawerOnly = async () => {
    const res = await openCashDrawer();
    onNotify?.(res === 'bt_sent' ? t.posDrawerOpenedToast : t.posDrawerNoPrinterHint);
  };

  const handleOpenQrPick = () => {
    if (!onPickProductViaQr) return;
    onPickProductViaQr((prod) => {
      addOrIncrementProductInBl(prod);
    });
  };

  const handleCreateQuickCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustName.trim() || !onCreateCustomer || savingNewCustomer) return;
    setSavingNewCustomer(true);
    try {
      const created = await onCreateCustomer({
        name: newCustName.trim(),
        phone: newCustPhone.trim(),
        city: newCustCity.trim(),
        address: '',
        category: newCustCategory,
        notes: '',
      });
      setCustomerId(created.id);
      setCustomerName(created.name);
      setCustomerPhone(created.phone);
      setNewCustName('');
      setNewCustPhone('');
      setNewCustCity('');
      setShowNewCustomerForm(false);
      setCustomerModalOpen(false);
    } finally {
      setSavingNewCustomer(false);
    }
  };

  const splitSumDisplay =
    Math.round(
      (['cash', 'check', 'bill_of_exchange', 'card', 'credit'] as SplitMethod[]).reduce(
        (s, m) => s + Math.max(0, Number(splitAmounts[m]) || 0),
        0
      ) * 100
    ) / 100;
  const splitRemainingDisplay =
    Math.round((cartGrandTotalDisplay - splitSumDisplay) * 100) / 100;

  const handleFillSplitRemaining = (method: SplitMethod) => {
    const current = Math.max(0, Number(splitAmounts[method]) || 0);
    const otherSum = splitSumDisplay - current;
    const fill = Math.max(0, Math.round((cartGrandTotalDisplay - otherSum) * 100) / 100);
    setSplitAmounts((prev) => ({
      ...prev,
      [method]: fill > 0 ? String(fill) : '',
    }));
  };

  const activeInstrumentTypes: Array<{ type: PaymentInstrumentType; amountDisplay: number }> = (() => {
    const tracked: PaymentInstrumentType[] = ['check', 'bill_of_exchange', 'card'];
    if (paymentMode === 'single') {
      if (tracked.includes(singlePaymentMethod as PaymentInstrumentType)) {
        return [
          {
            type: singlePaymentMethod as PaymentInstrumentType,
            amountDisplay: cartGrandTotalDisplay,
          },
        ];
      }
      return [];
    }
    return tracked
      .map((m) => ({
        type: m,
        amountDisplay: Math.max(0, Number(splitAmounts[m]) || 0),
      }))
      .filter((x) => x.amountDisplay > 0);
  })();

  const handleConfirmPaymentAndPrint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cartItems.length === 0 || submitting) return;

    let finalMethod: PurchasePaymentMethod = singlePaymentMethod;
    let breakdown: PosPaymentSplit[] | undefined;

    if (paymentMode === 'mixed') {
      const entries: PosPaymentSplit[] = (
        ['cash', 'check', 'bill_of_exchange', 'card', 'credit'] as SplitMethod[]
      )
        .map((m) => ({
          method: m,
          amountDisplay: Math.max(0, Number(splitAmounts[m]) || 0),
        }))
        .filter((x) => x.amountDisplay > 0)
        .map((x) => ({
          method: x.method,
          amount: Math.round(convertToMad(x.amountDisplay, currency) * 100) / 100,
        }));

      if (entries.length === 0 || Math.abs(splitRemainingDisplay) > 0.05) {
        setErrorMsg(t.posSplitMismatch);
        return;
      }
      if (entries.length === 1) {
        finalMethod = entries[0].method;
      } else {
        finalMethod = 'mixed';
        breakdown = entries;
      }
    }

    const paymentInstrumentsPayload: PosSaleInstrumentInput[] = [];
    for (const item of activeInstrumentTypes) {
      const d = instrumentDrafts[item.type];
      if (item.type === 'check' || item.type === 'bill_of_exchange') {
        if (
          !d.bankName.trim() ||
          !d.instrumentNumber.trim() ||
          !d.holderName.trim() ||
          !d.dueDate.trim()
        ) {
          setErrorMsg(
            `${t.portfolioValidationRequired} ${
              item.type === 'check' ? t.portfolioTypeCheck : t.portfolioTypeBillOfExchange
            }`
          );
          return;
        }
      } else if (item.type === 'card') {
        if (!d.holderName.trim() || !d.instrumentNumber.trim()) {
          setErrorMsg(t.portfolioValidationCardRequired);
          return;
        }
      }

      const recDate = d.receiptDate.trim() || saleDate || new Date().toISOString().slice(0, 10);
      paymentInstrumentsPayload.push({
        instrumentType: item.type,
        holderName: d.holderName.trim(),
        customerPhone: (d.customerPhone || customerPhone).trim(),
        bankName: d.bankName.trim(),
        instrumentNumber: d.instrumentNumber.trim(),
        amount: Math.round(convertToMad(item.amountDisplay, currency) * 100) / 100,
        blNumber: d.blNumber.trim() || currentBlLabel,
        receiptDate: recDate,
        dueDate: d.dueDate.trim() || recDate,
        notes: d.notes.trim() || notes.trim(),
      });
    }

    setSubmitting(true);
    setErrorMsg('');
    try {
      const payloadItems = cartItems.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: convertToMad(item.unitPriceDisplay, currency),
        discountPercent: item.discountPercent || 0,
      }));
      const created = await onCreateSale({
        items: payloadItems,
        productId: payloadItems[0].productId,
        quantity: payloadItems[0].quantity,
        unitPrice: payloadItems[0].unitPrice,
        customerId: customerId || undefined,
        customerName: customerName.trim() || t.posWalkInShort,
        customerPhone: customerPhone.trim(),
        paymentMethod: finalMethod,
        paymentBreakdown: breakdown,
        paymentInstruments:
          paymentInstrumentsPayload.length > 0 ? paymentInstrumentsPayload : undefined,
        documentType: 'bl',
        blNumber: currentBlLabel,
        saleDate: saleDate || new Date().toISOString().slice(0, 10),
        notes: notes.trim(),
        source: 'pos_manual',
      });

      if (created) {
        setLastCreatedInvoice(created);
        setCartItems([]);
        setCustomerId('');
        setCustomerName('');
        setCustomerPhone('');
        setNotes('');
        setSplitAmounts({ cash: '', check: '', bill_of_exchange: '', card: '', credit: '' });
        setInstrumentDrafts(
          createEmptyInstrumentDrafts(
            new Date().toISOString().slice(0, 10),
            currentBlLabel,
            '',
            ''
          )
        );
        setPaymentModalOpen(false);
        setPriceEditMode(false);
        onPortfolioChanged?.();

        // Open drawer + auto print BL ticket
        await openCashDrawer();
        if (onPrintPosTicket) {
          await onPrintPosTicket(created);
        } else if (onPrintInvoice) {
          await onPrintInvoice(created, false);
        }
      }
    } catch (err) {
      if (err instanceof Error && err.message === 'OUT_OF_STOCK') {
        setErrorMsg(t.qrScannerOutOfStock);
      } else {
        setErrorMsg(t.errorSave);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleApplyDailyPreset = (preset: DailyPreset) => {
    setDailyPreset(preset);
    const todayStr = new Date().toISOString().slice(0, 10);
    if (preset === 'today' || preset === 'morning' || preset === 'afternoon') {
      setDailyStartDate(todayStr);
      setDailyEndDate(todayStr);
    } else if (preset === 'week') {
      setDailyStartDate(getDateOffsetIso(-6));
      setDailyEndDate(todayStr);
    } else if (preset === 'month') {
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      setDailyStartDate(firstDay);
      setDailyEndDate(todayStr);
    }
  };

  const handleRunDailyReport = async (mode: 'print' | 'pdf') => {
    if (dailyRunningOutput) return;
    setDailyRunningOutput(true);
    try {
      const stamp = `${dailyStartDate || 'debut'}_${dailyEndDate || 'fin'}`;
      const outcome = await executeReportOutput({
        mode,
        spec: dailyReportSpec,
        filename: `recette-caisse-${stamp}.pdf`,
        lang,
      });
      if (outcome === 'pdf_fallback') {
        onNotify?.(t.reportPrintBlockedPdfToast);
      } else {
        onNotify?.(`${t.reportGeneratedToast} ${dailyReportSpec.title}`);
      }
    } finally {
      setDailyRunningOutput(false);
    }
  };

  const handleExportSalesExcel = async () => {
    if (exportingSales) return;
    setExportingSales(true);
    try {
      const blob = buildSalesReportExcelBlob(filteredInvoices, activeSummary, currency, lang);
      const dateStamp = new Date().toISOString().slice(0, 10);
      await saveOrShareBlob(blob, `bilan-ventes-${dateStamp}.xlsx`, t.salesReportTitle);
    } finally {
      setExportingSales(false);
    }
  };

  const inputClass =
    'min-h-[42px] w-full rounded-xl border border-[#DCE7E0] bg-[#F7FAF8] px-3 py-2 text-xs text-[#0B1F16] placeholder:text-[#6B8A79] focus:border-[#115E3B] focus:bg-white focus:outline-none dark:border-[#1E3A2D] dark:bg-[#091611] dark:text-[#F2F9F5] dark:placeholder:text-[#8FB39E] dark:focus:border-[#10B981] dark:focus:bg-[#0D1E16]';

  return (
    <div
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/55 p-0 backdrop-blur-xs sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[95dvh] w-full max-w-6xl flex-col overflow-hidden rounded-t-3xl border border-[#DCE7E0] bg-white shadow-xl sm:rounded-3xl dark:border-[#1E3A2D] dark:bg-[#0F2119]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#DCE7E0] px-5 py-3.5 dark:border-[#1E3A2D]">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#ECF7F1] text-[#115E3B] dark:bg-[#132B20] dark:text-[#34D399]">
              {isCaisseMode ? <ShoppingBag className="h-5 w-5" /> : <Receipt className="h-5 w-5" />}
            </div>
            <div className="min-w-0">
              <h2 className="truncate font-display text-lg font-bold text-[#0B1F16] sm:text-xl dark:text-[#F2F9F5]">
                {isCaisseMode ? t.launcherCashierLabel : t.launcherInvoicesLabel}
              </h2>
              <p className="truncate text-xs text-[#335947] dark:text-[#9EC0AE]">
                {isCaisseMode ? t.launcherCashierModalSubtitle : t.launcherInvoicesModalSubtitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onOpenPortfolio && (
              <button
                type="button"
                onClick={onOpenPortfolio}
                className="flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[#DCE7E0] bg-[#F7FAF8] px-3 text-xs font-bold text-[#115E3B] hover:bg-[#ECF7F1] whitespace-nowrap dark:border-[#1E3A2D] dark:bg-[#091611] dark:text-[#34D399]"
              >
                <Wallet className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">{t.portfolioNavLabel}</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label={t.close}
              className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl text-[#335947] hover:bg-[#ECF7F1] dark:text-[#9EC0AE] dark:hover:bg-[#162E23]"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
          {/* ================================================================ */}
          {/* MODE CAISSE (POS)                                                */}
          {/* ================================================================ */}
          {isCaisseMode && (
            <>
              {/* A) TOP SECTION: 5 Separate KPI Fields */}
              <section className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
                <div className="rounded-2xl border border-[#DCE7E0] bg-[#F7FAF8] p-3.5 dark:border-[#1E3A2D] dark:bg-[#091611]">
                  <span className="block text-[11px] font-medium text-[#335947] dark:text-[#9EC0AE]">
                    1. {t.caisseTodayBlLabel}
                  </span>
                  <span className="tabular-nums mt-1 block font-display text-xl font-bold text-[#0B1F16] dark:text-[#F2F9F5]">
                    {formatNumber(summary.todayBlCount, lang)}
                  </span>
                </div>

                <div className="rounded-2xl border border-[#DCE7E0] bg-[#F7FAF8] p-3.5 dark:border-[#1E3A2D] dark:bg-[#091611]">
                  <span className="block text-[11px] font-medium text-[#335947] dark:text-[#9EC0AE]">
                    2. {t.caisseFormalInvoicesLabel}
                  </span>
                  <span className="tabular-nums mt-1 block font-display text-xl font-bold text-[#0B1F16] dark:text-[#F2F9F5]">
                    {formatNumber(summary.totalFormalInvoices, lang)}
                  </span>
                </div>

                <div className="rounded-2xl border border-[#DCE7E0] bg-[#F7FAF8] p-3.5 dark:border-[#1E3A2D] dark:bg-[#091611]">
                  <span className="block text-[11px] font-medium text-[#335947] dark:text-[#9EC0AE]">
                    3. {t.posTotalRevenue}
                  </span>
                  <span className="tabular-nums mt-1 block font-display text-xl font-bold text-[#115E3B] dark:text-[#34D399]">
                    {formatCurrency(summary.totalRevenueMad, currency, lang)}
                  </span>
                </div>

                <div className="rounded-2xl border border-[#DCE7E0] bg-[#F7FAF8] p-3.5 dark:border-[#1E3A2D] dark:bg-[#091611]">
                  <span className="block text-[11px] font-medium text-[#335947] dark:text-[#9EC0AE]">
                    4. {t.posTotalProfit}
                  </span>
                  <span className="tabular-nums mt-1 block font-display text-xl font-bold text-[#115E3B] dark:text-[#34D399]">
                    {formatCurrency(summary.totalProfitMad, currency, lang)}
                  </span>
                </div>

                <div className="col-span-2 rounded-2xl border border-[#DCE7E0] bg-[#F7FAF8] p-3.5 sm:col-span-1 dark:border-[#1E3A2D] dark:bg-[#091611]">
                  <span className="block text-[11px] font-medium text-[#335947] dark:text-[#9EC0AE]">
                    5. {t.posTotalUnitsSold}
                  </span>
                  <span className="tabular-nums mt-1 block font-display text-xl font-bold text-[#0B1F16] dark:text-[#F2F9F5]">
                    {formatNumber(summary.totalUnitsSold, lang)}
                  </span>
                </div>
              </section>

              {/* Last validated BL quick confirmation banner */}
              {lastCreatedInvoice &&
                (() => {
                  const freshLast =
                    invoices.find((i) => i.id === lastCreatedInvoice.id) || lastCreatedInvoice;
                  const lastIsCopy = Boolean((freshLast.printCount || 0) > 0);
                  return (
                    <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-2xl border border-[#10B981]/35 bg-[#ECF7F1] px-4 py-2.5 text-xs dark:border-[#10B981]/30 dark:bg-[#132B20]">
                      <div className="flex items-center gap-2 font-semibold text-[#115E3B] dark:text-[#34D399]">
                        <CheckCircle2 className="h-4 w-4 shrink-0" />
                        <span>
                          {t.posSoldReceiptBadge} · {freshLast.invoiceNumber} (
                          {formatCurrency(freshLast.totalPrice, currency, lang)})
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {onPrintInvoice && (
                          <button
                            type="button"
                            onClick={() => void onPrintInvoice(freshLast, lastIsCopy)}
                            className="flex min-h-[36px] items-center gap-1.5 rounded-lg border border-[#DCE7E0] bg-white px-2.5 font-semibold text-[#115E3B] hover:bg-[#F7FAF8] dark:border-[#1E3A2D] dark:bg-[#091611] dark:text-[#34D399]"
                          >
                            <Printer className="h-3.5 w-3.5" />
                            <span>{lastIsCopy ? t.posReprintCopy : t.posPrintInvoice}</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={async () => {
                            const blob = await buildInvoiceReceiptBlob(
                              freshLast,
                              storeName,
                              currency,
                              lang,
                              { isCopy: lastIsCopy, companySettings: shopSettings }
                            );
                            await saveOrShareBlob(
                              blob,
                              `${freshLast.invoiceNumber.toLowerCase()}.png`,
                              freshLast.invoiceNumber
                            );
                          }}
                          className="flex min-h-[36px] items-center gap-1.5 rounded-lg border border-[#DCE7E0] bg-white px-2.5 font-semibold text-[#0B1F16] hover:bg-[#F7FAF8] dark:border-[#1E3A2D] dark:bg-[#091611] dark:text-[#F2F9F5]"
                        >
                          <Download className="h-3.5 w-3.5" />
                          <span>PNG</span>
                        </button>
                      </div>
                    </div>
                  );
                })()}

              {errorMsg && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-semibold text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
                  {errorMsg}
                </div>
              )}

              {/* B) MIDDLE SECTION: BL SHEET WORKSPACE */}
              <section className="overflow-visible rounded-2xl border border-[#DCE7E0] bg-[#F7FAF8] p-3.5 sm:p-4 dark:border-[#1E3A2D] dark:bg-[#091611]">
                {/* Top Strip above BL Table: 00 BL Number (left) + 0 Recette journalière du caisse (right) */}
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2.5">
                  {/* 00 - BL Number Box + Active Customer */}
                  <div className="flex flex-wrap items-center gap-2">
                    {editingBlSeq ? (
                      <div className="flex items-center gap-1.5 rounded-xl border border-[#115E3B] bg-white px-2.5 py-1 dark:border-[#10B981] dark:bg-[#0F2119]">
                        <span className="text-[11px] font-bold text-[#335947] dark:text-[#9EC0AE]">
                          {t.posBlNumberLabel}
                        </span>
                        <input
                          type="text"
                          value={blSeqInput}
                          onChange={(e) => setBlSeqInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              void handleSaveBlSeq();
                            } else if (e.key === 'Escape') {
                              setEditingBlSeq(false);
                            }
                          }}
                          className="font-mono-code w-24 border-b border-[#115E3B] bg-transparent px-1 text-sm font-bold text-[#0B1F16] focus:outline-none dark:border-[#10B981] dark:text-[#F2F9F5]"
                          autoFocus
                        />
                        <button
                          type="button"
                          disabled={savingBlSeq}
                          onClick={() => void handleSaveBlSeq()}
                          className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#115E3B] text-white dark:bg-[#10B981] dark:text-[#052E1C]"
                          aria-label={t.save}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingBlSeq(false)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-[#335947] hover:bg-[#ECF7F1] dark:text-[#9EC0AE]"
                          aria-label={t.cancel}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setBlSeqInput(currentBlLabel);
                          setEditingBlSeq(true);
                        }}
                        title={t.posBlEditTitle}
                        className="flex min-h-[42px] items-center gap-2 rounded-xl border border-[#DCE7E0] bg-white px-3.5 text-xs font-bold text-[#0B1F16] hover:border-[#115E3B] dark:border-[#1E3A2D] dark:bg-[#0F2119] dark:text-[#F2F9F5]"
                      >
                        <span className="text-[#335947] dark:text-[#9EC0AE]">{t.posBlNumberLabel}</span>
                        <span className="font-mono-code text-sm text-[#115E3B] dark:text-[#34D399]">
                          {currentBlLabel}
                        </span>
                        <Pencil className="h-3.5 w-3.5 text-[#335947] dark:text-[#9EC0AE]" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setCustomerModalOpen(true)}
                      className="flex min-h-[42px] items-center gap-2 rounded-xl border border-[#DCE7E0] bg-white px-3 text-xs font-semibold text-[#0B1F16] hover:border-[#115E3B] dark:border-[#1E3A2D] dark:bg-[#0F2119] dark:text-[#F2F9F5]"
                    >
                      <Users className="h-3.5 w-3.5 text-[#115E3B] dark:text-[#34D399]" />
                      <span>
                        {t.posCustomerLabel} :{' '}
                        <strong className="text-[#115E3B] dark:text-[#34D399]">
                          {customerName.trim() || t.posWalkInShort}
                        </strong>
                      </span>
                    </button>
                  </div>

                  {/* Right actions: BL History (Reprint Copy) + Recette journalière du caisse */}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setBlHistoryOpen(true)}
                      className="flex min-h-[42px] items-center gap-2 rounded-xl border border-[#DCE7E0] bg-white px-3.5 text-xs font-bold text-[#0B1F16] hover:border-[#115E3B] hover:bg-[#ECF7F1] whitespace-nowrap dark:border-[#1E3A2D] dark:bg-[#0F2119] dark:text-[#F2F9F5]"
                    >
                      <History className="h-4 w-4 shrink-0 text-[#115E3B] dark:text-[#34D399]" />
                      <span>{t.posBlHistoryBtn}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setDailyValidated(false);
                        setDailySummaryOpen(true);
                      }}
                      className="flex min-h-[42px] items-center gap-2 rounded-xl border border-[#115E3B]/35 bg-[#ECF7F1] px-4 text-xs font-bold text-[#115E3B] hover:bg-[#DCF0E4] whitespace-nowrap dark:border-[#10B981]/35 dark:bg-[#132B20] dark:text-[#34D399]"
                    >
                      <BarChart3 className="h-4 w-4 shrink-0" />
                      <span>{t.posDailySummaryBtn}</span>
                    </button>
                  </div>
                </div>

                {/* Product Search Engine Bar (Item 1) + BL Table (Items 1-6) */}
                <div className="rounded-xl border border-[#DCE7E0] bg-white dark:border-[#1E3A2D] dark:bg-[#0F2119]">
                  {/* Interactive Search Row anchored above/inside column 1 */}
                  <div ref={searchBoxRef} className="relative border-b border-[#DCE7E0] bg-[#ECF7F1]/65 p-2.5 dark:border-[#1E3A2D] dark:bg-[#132B20]/50">
                    <div className="relative">
                      <Search
                        className={`pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-[#115E3B] dark:text-[#34D399] ${
                          lang === 'ar' ? 'right-3.5' : 'left-3.5'
                        }`}
                      />
                      <input
                        ref={searchInputRef}
                        type="text"
                        value={productSearchInput}
                        onFocus={() => setSearchDropdownOpen(true)}
                        onChange={(e) => {
                          setProductSearchInput(e.target.value);
                          setSearchDropdownOpen(true);
                        }}
                        onKeyDown={handleProductSearchKeyDown}
                        placeholder={t.posSearchProductCol}
                        className={`min-h-[44px] w-full rounded-xl border border-[#115E3B]/35 bg-white py-2 text-sm font-medium text-[#0B1F16] placeholder:text-[#6B8A79] focus:border-[#115E3B] focus:outline-none dark:border-[#10B981]/35 dark:bg-[#091611] dark:text-[#F2F9F5] dark:placeholder:text-[#8FB39E] ${
                          lang === 'ar' ? 'pl-10 pr-10' : 'pl-10 pr-10'
                        }`}
                      />
                      {productSearchInput && (
                        <button
                          type="button"
                          onClick={() => {
                            setProductSearchInput('');
                            searchInputRef.current?.focus();
                          }}
                          aria-label={t.clearSearch}
                          className={`absolute top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-[#335947] hover:bg-[#ECF7F1] dark:text-[#9EC0AE] ${
                            lang === 'ar' ? 'left-2' : 'right-2'
                          }`}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>

                    {/* Floating Search Results Dropdown */}
                    {searchDropdownOpen && (
                      <div className="absolute left-2.5 right-2.5 top-[calc(100%-2px)] z-30 max-h-60 overflow-y-auto rounded-b-xl border border-[#115E3B]/30 bg-white shadow-xl dark:border-[#10B981]/35 dark:bg-[#091611]">
                        {filteredAvailableProducts.length === 0 ? (
                          <p className="px-4 py-3 text-xs text-[#6B8A79]">
                            {t.posNoMatchingProduct}
                          </p>
                        ) : (
                          <div className="divide-y divide-[#DCE7E0] dark:divide-[#1E3A2D]">
                            {filteredAvailableProducts.map((p) => (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => addOrIncrementProductInBl(p)}
                                className="flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-start text-xs hover:bg-[#ECF7F1] dark:hover:bg-[#132B20]"
                              >
                                <div className="min-w-0 flex-1">
                                  <span className="font-mono-code font-bold text-[#115E3B] dark:text-[#34D399]">
                                    {p.code}
                                  </span>{' '}
                                  <span className="font-semibold text-[#0B1F16] dark:text-[#F2F9F5]">
                                    {p.name}
                                  </span>
                                  {p.warehouseName && (
                                    <span className="ms-2 text-[11px] text-[#335947] dark:text-[#9EC0AE]">
                                      · {p.warehouseName}
                                    </span>
                                  )}
                                </div>
                                <div className="tabular-nums flex shrink-0 items-center gap-3">
                                  <span className="text-[11px] text-[#335947] dark:text-[#9EC0AE]">
                                    ({formatNumber(p.quantity, lang)})
                                  </span>
                                  <span className="font-bold text-[#115E3B] dark:text-[#34D399]">
                                    {formatCurrency(p.sellingPrice, currency, lang)}
                                  </span>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* BL Lines Table (Columns 1-6) */}
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px] border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-[#DCE7E0] bg-[#115E3B] text-white dark:border-[#1E3A2D] dark:bg-[#132B20]">
                          <th className="px-3 py-2.5 text-start font-bold">
                            {t.posSearchProductCol}
                          </th>
                          <th className="w-24 px-2 py-2.5 text-center font-bold">{t.posColQty}</th>
                          <th className="w-28 px-2 py-2.5 text-center font-bold">
                            {t.posColUnitPrice} ({currency})
                          </th>
                          <th className="w-20 px-2 py-2.5 text-center font-bold">
                            {t.posColDiscountPct}
                          </th>
                          <th className="w-28 px-3 py-2.5 text-end font-bold">{t.posColTotal}</th>
                          <th className="w-20 px-2 py-2.5 text-center font-bold">
                            {t.posColActions}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#DCE7E0] dark:divide-[#1E3A2D]">
                        {cartItems.length === 0 ? (
                          <tr>
                            <td
                              colSpan={6}
                              className="px-4 py-8 text-center text-xs text-[#6B8A79] dark:text-[#9EC0AE]"
                            >
                              {t.posEmptyBlHint}
                            </td>
                          </tr>
                        ) : (
                          cartItems.map((item, idx) => {
                            const lineTotalDisp = calcLineTotalDisplay(item);
                            return (
                              <tr
                                key={item.productId}
                                className="hover:bg-[#F7FAF8] dark:hover:bg-[#0B1913]"
                              >
                                {/* 1. Product Code + Name */}
                                <td className="px-3 py-2">
                                  <span className="font-mono-code font-bold text-[#115E3B] dark:text-[#34D399]">
                                    {item.productCode}
                                  </span>{' '}
                                  <span className="font-semibold text-[#0B1F16] dark:text-[#F2F9F5]">
                                    — {item.productName}
                                  </span>
                                </td>

                                {/* 2. QTe */}
                                <td className="px-2 py-2 text-center">
                                  <input
                                    type="number"
                                    min="1"
                                    max={item.availableQty}
                                    step="1"
                                    value={item.quantity}
                                    onChange={(e) =>
                                      handleUpdateCartItemQty(
                                        item.productId,
                                        Number(e.target.value)
                                      )
                                    }
                                    aria-label={t.posColQty}
                                    className="tabular-nums h-9 w-16 rounded-lg border border-[#DCE7E0] bg-[#F7FAF8] px-2 text-center text-xs font-bold text-[#0B1F16] focus:border-[#115E3B] focus:outline-none dark:border-[#1E3A2D] dark:bg-[#091611] dark:text-[#F2F9F5]"
                                  />
                                </td>

                                {/* 3. P.U. */}
                                <td className="px-2 py-2 text-center">
                                  <input
                                    ref={idx === 0 ? firstPriceInputRef : undefined}
                                    type="number"
                                    min="0"
                                    step="any"
                                    value={item.unitPriceDisplay}
                                    onChange={(e) =>
                                      handleUpdateCartItemPrice(
                                        item.productId,
                                        Number(e.target.value)
                                      )
                                    }
                                    aria-label={t.posColUnitPrice}
                                    className={`tabular-nums h-9 w-24 rounded-lg border px-2 text-end text-xs font-semibold focus:outline-none ${
                                      priceEditMode
                                        ? 'border-amber-500 bg-amber-50 text-[#0B1F16] dark:border-amber-400 dark:bg-amber-950/35 dark:text-[#F2F9F5]'
                                        : 'border-[#DCE7E0] bg-[#F7FAF8] text-[#0B1F16] focus:border-[#115E3B] dark:border-[#1E3A2D] dark:bg-[#091611] dark:text-[#F2F9F5]'
                                    }`}
                                  />
                                </td>

                                {/* 4. R % */}
                                <td className="px-2 py-2 text-center">
                                  <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="any"
                                    value={item.discountPercent}
                                    onChange={(e) =>
                                      handleUpdateCartItemDiscount(
                                        item.productId,
                                        Number(e.target.value)
                                      )
                                    }
                                    aria-label={t.posColDiscountPct}
                                    className={`tabular-nums h-9 w-16 rounded-lg border px-2 text-center text-xs font-semibold focus:outline-none ${
                                      priceEditMode
                                        ? 'border-amber-500 bg-amber-50 text-[#0B1F16] dark:border-amber-400 dark:bg-amber-950/35 dark:text-[#F2F9F5]'
                                        : 'border-[#DCE7E0] bg-[#F7FAF8] text-[#0B1F16] focus:border-[#115E3B] dark:border-[#1E3A2D] dark:bg-[#091611] dark:text-[#F2F9F5]'
                                    }`}
                                  />
                                </td>

                                {/* 5. P.TOTAL */}
                                <td className="tabular-nums px-3 py-2 text-end font-bold text-[#115E3B] dark:text-[#34D399]">
                                  {formatNumber(lineTotalDisp, lang)} {currency}
                                </td>

                                {/* 6. Edit / Delete */}
                                <td className="px-2 py-2">
                                  <div className="flex items-center justify-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setPriceEditMode(true);
                                        firstPriceInputRef.current?.focus();
                                      }}
                                      title={t.edit}
                                      aria-label={t.edit}
                                      className="flex h-8 w-8 items-center justify-center rounded-lg text-[#115E3B] hover:bg-[#ECF7F1] dark:text-[#34D399] dark:hover:bg-[#132B20]"
                                    >
                                      <Edit3 className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveCartItem(item.productId)}
                                      title={t.posCartRemoveItem}
                                      aria-label={t.posCartRemoveItem}
                                      className="flex h-8 w-8 items-center justify-center rounded-lg text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Totals Bar (Items 7 & 8) */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t-2 border-[#115E3B]/30 bg-[#ECF7F1]/80 px-4 py-3 dark:border-[#10B981]/30 dark:bg-[#132B20]/70">
                    <span className="font-display text-sm font-extrabold tracking-wide text-[#0B1F16] dark:text-[#F2F9F5]">
                      TOTAL :
                    </span>
                    <div className="tabular-nums flex items-center gap-6">
                      {/* 7 - Nbre Art */}
                      <div className="text-xs font-semibold text-[#335947] dark:text-[#9EC0AE]">
                        {t.posNbreArt} :{' '}
                        <span className="text-base font-extrabold text-[#0B1F16] dark:text-[#F2F9F5]">
                          {formatNumber(cartTotalUnits, lang)}
                        </span>
                      </div>
                      {/* 8 - Grand Total */}
                      <div className="text-lg font-extrabold text-[#115E3B] sm:text-xl dark:text-[#34D399]">
                        {formatNumber(cartGrandTotalDisplay, lang)} {currency}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom 6-Action Row (Items 9-14) */}
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                  {/* 9 - Client */}
                  <button
                    type="button"
                    onClick={() => setCustomerModalOpen(true)}
                    className="flex min-h-[48px] items-center justify-center gap-1.5 rounded-xl border border-[#DCE7E0] bg-white px-3 text-xs font-bold text-[#0B1F16] hover:border-[#115E3B] hover:bg-[#ECF7F1] whitespace-nowrap dark:border-[#1E3A2D] dark:bg-[#0F2119] dark:text-[#F2F9F5] dark:hover:bg-[#132B20]"
                  >
                    <Users className="h-4 w-4 shrink-0 text-[#115E3B] dark:text-[#34D399]" />
                    <span className="truncate">
                      {customerName.trim() ? customerName.trim() : t.posCustomerLabel}
                    </span>
                  </button>

                  {/* 10 - Modif Prix */}
                  <button
                    type="button"
                    disabled={cartItems.length === 0}
                    onClick={() => {
                      setPriceEditMode((prev) => !prev);
                      setTimeout(() => firstPriceInputRef.current?.focus(), 40);
                    }}
                    className={`flex min-h-[48px] items-center justify-center gap-1.5 rounded-xl border px-3 text-xs font-bold whitespace-nowrap disabled:opacity-50 ${
                      priceEditMode
                        ? 'border-amber-500 bg-amber-50 text-amber-800 dark:border-amber-400 dark:bg-amber-950/40 dark:text-amber-200'
                        : 'border-[#DCE7E0] bg-white text-[#0B1F16] hover:bg-[#ECF7F1] dark:border-[#1E3A2D] dark:bg-[#0F2119] dark:text-[#F2F9F5]'
                    }`}
                  >
                    <Edit3 className="h-4 w-4 shrink-0" />
                    <span>{t.posModifPrix}</span>
                  </button>

                  {/* 11 - Supprimer (clear BL) */}
                  {confirmClearBl ? (
                    <button
                      type="button"
                      onClick={handleClearCurrentBl}
                      className="flex min-h-[48px] items-center justify-center gap-1.5 rounded-xl bg-red-600 px-3 text-xs font-bold text-white whitespace-nowrap"
                    >
                      <Trash2 className="h-4 w-4 shrink-0" />
                      <span>{t.posClearBlConfirm}</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={cartItems.length === 0 && !customerId && !customerName}
                      onClick={() => setConfirmClearBl(true)}
                      className="flex min-h-[48px] items-center justify-center gap-1.5 rounded-xl border border-[#DCE7E0] bg-white px-3 text-xs font-bold text-red-600 hover:bg-red-50 whitespace-nowrap disabled:opacity-50 dark:border-[#1E3A2D] dark:bg-[#0F2119] dark:text-red-400 dark:hover:bg-red-950/30"
                    >
                      <Trash2 className="h-4 w-4 shrink-0" />
                      <span>{t.posClearBl}</span>
                    </button>
                  )}

                  {/* 12 - QR Code */}
                  <button
                    type="button"
                    onClick={handleOpenQrPick}
                    disabled={!onPickProductViaQr}
                    className="flex min-h-[48px] items-center justify-center gap-1.5 rounded-xl border border-[#115E3B]/35 bg-[#ECF7F1] px-3 text-xs font-bold text-[#115E3B] hover:bg-[#DCF0E4] whitespace-nowrap disabled:opacity-50 dark:border-[#10B981]/35 dark:bg-[#132B20] dark:text-[#34D399]"
                  >
                    <QrCode className="h-4 w-4 shrink-0" />
                    <span>QR Code</span>
                  </button>

                  {/* 13 - Tiroir */}
                  <button
                    type="button"
                    onClick={() => void handleTriggerDrawerOnly()}
                    className="flex min-h-[48px] items-center justify-center gap-1.5 rounded-xl border border-[#DCE7E0] bg-white px-3 text-xs font-bold text-[#0B1F16] hover:bg-[#ECF7F1] whitespace-nowrap dark:border-[#1E3A2D] dark:bg-[#0F2119] dark:text-[#F2F9F5] dark:hover:bg-[#132B20]"
                  >
                    <Vault className="h-4 w-4 shrink-0 text-[#115E3B] dark:text-[#34D399]" />
                    <span>{t.posDrawerBtn}</span>
                  </button>

                  {/* 14 - Valider + Imprimer Ticket + Ouvrir Tiroir */}
                  <button
                    type="button"
                    disabled={cartItems.length === 0 || submitting}
                    onClick={() => {
                      setErrorMsg('');
                      setSplitAmounts({
                        cash: '',
                        check: '',
                        bill_of_exchange: '',
                        card: '',
                        credit: '',
                      });
                      const baseDate = saleDate || new Date().toISOString().slice(0, 10);
                      setInstrumentDrafts(
                        createEmptyInstrumentDrafts(
                          baseDate,
                          currentBlLabel,
                          customerName.trim(),
                          customerPhone.trim()
                        )
                      );
                      setPaymentModalOpen(true);
                    }}
                    className="col-span-2 flex min-h-[48px] items-center justify-center gap-1.5 rounded-xl bg-[#115E3B] px-3 py-2 text-center text-xs font-extrabold text-white hover:bg-[#0D4A2E] disabled:opacity-50 sm:col-span-1 dark:bg-[#10B981] dark:text-[#052E1C]"
                  >
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span className="leading-tight">{t.posValiderTicketBtn}</span>
                  </button>
                </div>
              </section>
            </>
          )}

          {/* ================================================================ */}
          {/* MODE FACTURES (INVOICES & BL ARCHIVE + CONVERSION)               */}
          {/* ================================================================ */}
          {!isCaisseMode && (
            <>
              {/* KPI Strip */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-2xl border border-[#DCE7E0] bg-[#F7FAF8] p-3.5 dark:border-[#1E3A2D] dark:bg-[#091611]">
                  <span className="block text-[11px] font-medium text-[#335947] dark:text-[#9EC0AE]">
                    {t.posTotalInvoices}
                  </span>
                  <span className="tabular-nums mt-1 block font-display text-xl font-bold text-[#0B1F16] dark:text-[#F2F9F5]">
                    {formatNumber(activeSummary.totalInvoices, lang)}
                  </span>
                </div>
                <div className="rounded-2xl border border-[#DCE7E0] bg-[#F7FAF8] p-3.5 dark:border-[#1E3A2D] dark:bg-[#091611]">
                  <span className="block text-[11px] font-medium text-[#335947] dark:text-[#9EC0AE]">
                    {t.posTotalUnitsSold}
                  </span>
                  <span className="tabular-nums mt-1 block font-display text-xl font-bold text-[#0B1F16] dark:text-[#F2F9F5]">
                    {formatNumber(activeSummary.totalUnitsSold, lang)}
                  </span>
                </div>
                <div className="rounded-2xl border border-[#DCE7E0] bg-[#F7FAF8] p-3.5 dark:border-[#1E3A2D] dark:bg-[#091611]">
                  <span className="block text-[11px] font-medium text-[#335947] dark:text-[#9EC0AE]">
                    {t.posTotalRevenue}
                  </span>
                  <span className="tabular-nums mt-1 block font-display text-xl font-bold text-[#115E3B] dark:text-[#34D399]">
                    {formatCurrency(activeSummary.totalRevenueMad, currency, lang)}
                  </span>
                </div>
                <div className="rounded-2xl border border-[#DCE7E0] bg-[#F7FAF8] p-3.5 dark:border-[#1E3A2D] dark:bg-[#091611]">
                  <span className="block text-[11px] font-medium text-[#335947] dark:text-[#9EC0AE]">
                    {t.posTotalProfit}
                  </span>
                  <span className="tabular-nums mt-1 block font-display text-xl font-bold text-[#115E3B] dark:text-[#34D399]">
                    {formatCurrency(activeSummary.totalProfitMad, currency, lang)}
                  </span>
                </div>
              </div>

              {/* Document Type Filter (Tous / BL / Factures) */}
              <div className="flex flex-wrap items-center justify-between gap-2.5">
                <div className="inline-flex rounded-xl border border-[#DCE7E0] bg-[#F7FAF8] p-1 dark:border-[#1E3A2D] dark:bg-[#091611]">
                  {(['all', 'bl', 'facture'] as const).map((dt) => (
                    <button
                      key={dt}
                      type="button"
                      onClick={() => setDocTypeFilter(dt)}
                      className={`min-h-[36px] rounded-lg px-3 text-xs font-semibold transition-colors whitespace-nowrap ${
                        docTypeFilter === dt
                          ? 'bg-[#115E3B] text-white dark:bg-[#10B981] dark:text-[#052E1C]'
                          : 'text-[#335947] hover:bg-[#ECF7F1] dark:text-[#9EC0AE] dark:hover:bg-[#162E23]'
                      }`}
                    >
                      {dt === 'all'
                        ? t.posFilterAll
                        : dt === 'bl'
                        ? t.posInvoicesFilterBl
                        : t.posInvoicesFilterFactures}
                    </button>
                  ))}
                </div>
              </div>

              {/* Toolbar: Search + Filters + Report Toggle + Print + Excel Export */}
              <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                  <Search
                    className={`pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-[#335947] dark:text-[#9EC0AE] ${
                      lang === 'ar' ? 'right-3.5' : 'left-3.5'
                    }`}
                  />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t.searchPlaceholder}
                    className={`min-h-[44px] w-full rounded-xl border border-[#DCE7E0] bg-[#F7FAF8] py-2 text-sm text-[#0B1F16] placeholder:text-[#6B8A79] focus:border-[#115E3B] focus:bg-white focus:outline-none dark:border-[#1E3A2D] dark:bg-[#091611] dark:text-[#F2F9F5] dark:placeholder:text-[#8FB39E] dark:focus:border-[#10B981] dark:focus:bg-[#0D1E16] ${
                      lang === 'ar' ? 'pl-3.5 pr-10' : 'pl-10 pr-3.5'
                    }`}
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowFilters((v) => !v)}
                    className={`flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                      showFilters || hasActiveFilters
                        ? 'border-[#115E3B] bg-[#ECF7F1] text-[#115E3B] dark:border-[#10B981] dark:bg-[#132B20] dark:text-[#34D399]'
                        : 'border-[#DCE7E0] bg-white text-[#0B1F16] hover:bg-[#ECF7F1] dark:border-[#1E3A2D] dark:bg-[#091611] dark:text-[#F2F9F5]'
                    }`}
                  >
                    <Filter className="h-4 w-4" />
                    <span>{t.adjustmentFilterTitle}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowReport((v) => !v)}
                    className={`flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                      showReport
                        ? 'border-[#115E3B] bg-[#ECF7F1] text-[#115E3B] dark:border-[#10B981] dark:bg-[#132B20] dark:text-[#34D399]'
                        : 'border-[#DCE7E0] bg-white text-[#0B1F16] hover:bg-[#ECF7F1] dark:border-[#1E3A2D] dark:bg-[#091611] dark:text-[#F2F9F5]'
                    }`}
                  >
                    <BarChart3 className="h-4 w-4" />
                    <span>{t.salesReportToggle}</span>
                    {showReport ? (
                      <ChevronUp className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5" />
                    )}
                  </button>

                  {onPrintAggregateInvoices && (
                    <button
                      type="button"
                      onClick={() =>
                        onPrintAggregateInvoices({
                          startDate: filterFrom || undefined,
                          endDate: filterTo || undefined,
                          customerId: filterCustomerId || undefined,
                          productId: filterProductId || undefined,
                          category: filterCategory || undefined,
                        })
                      }
                      disabled={filteredInvoices.length === 0}
                      className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-[#DCE7E0] bg-white px-3 text-xs font-semibold text-[#115E3B] hover:bg-[#ECF7F1] disabled:opacity-60 whitespace-nowrap shrink-0 dark:border-[#1E3A2D] dark:bg-[#091611] dark:text-[#34D399]"
                    >
                      <Printer className="h-4 w-4" />
                      <span>{t.reportType2Title}</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => void handleExportSalesExcel()}
                    disabled={exportingSales}
                    className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-[#DCE7E0] bg-white px-3 text-xs font-semibold text-[#115E3B] hover:bg-[#ECF7F1] disabled:opacity-60 whitespace-nowrap shrink-0 dark:border-[#1E3A2D] dark:bg-[#091611] dark:text-[#34D399]"
                  >
                    <FileSpreadsheet className="h-4 w-4" />
                    <span>{t.salesReportExportExcel}</span>
                  </button>
                </div>
              </div>

              {/* Invoices Filter Panel */}
              {showFilters && (
                <section className="space-y-3 rounded-2xl border border-[#DCE7E0] bg-[#F7FAF8] p-4 dark:border-[#1E3A2D] dark:bg-[#091611]">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-[#0B1F16] dark:text-[#F2F9F5]">
                      {t.posFiltersTitle}
                    </p>
                    {hasActiveFilters && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearchQuery('');
                          setDocTypeFilter('all');
                          setFilterFrom('');
                          setFilterTo('');
                          setFilterProductId('');
                          setFilterCategory('');
                          setFilterCustomerId('');
                          setFilterWarehouseId('');
                        }}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[#115E3B] hover:underline dark:text-[#34D399]"
                      >
                        <RotateCcw className="h-3 w-3" />
                        <span>{t.purchasesFilterReset}</span>
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold text-[#335947] dark:text-[#9EC0AE]">
                        {t.adjustmentFilterFrom}
                      </label>
                      <input
                        type="date"
                        value={filterFrom}
                        onChange={(e) => setFilterFrom(e.target.value)}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold text-[#335947] dark:text-[#9EC0AE]">
                        {t.adjustmentFilterTo}
                      </label>
                      <input
                        type="date"
                        value={filterTo}
                        onChange={(e) => setFilterTo(e.target.value)}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold text-[#335947] dark:text-[#9EC0AE]">
                        {t.adjustmentFilterCustomer}
                      </label>
                      <select
                        value={filterCustomerId}
                        onChange={(e) => setFilterCustomerId(e.target.value)}
                        className={inputClass}
                      >
                        <option value="">{t.posFilterAll}</option>
                        {customers.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.code} — {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold text-[#335947] dark:text-[#9EC0AE]">
                        {t.adjustmentFilterProduct}
                      </label>
                      <select
                        value={filterProductId}
                        onChange={(e) => setFilterProductId(e.target.value)}
                        className={inputClass}
                      >
                        <option value="">{t.posFilterAll}</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.code} — {p.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold text-[#335947] dark:text-[#9EC0AE]">
                        {t.adjustmentFilterCategory}
                      </label>
                      <select
                        value={filterCategory}
                        onChange={(e) => setFilterCategory(e.target.value)}
                        className={inputClass}
                      >
                        <option value="">{t.posFilterAll}</option>
                        {categories.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>
                    {warehouses.length > 0 && (
                      <div>
                        <label className="mb-1 block text-[11px] font-semibold text-[#335947] dark:text-[#9EC0AE]">
                          {t.adjustmentFilterWarehouse}
                        </label>
                        <select
                          value={filterWarehouseId}
                          onChange={(e) => setFilterWarehouseId(e.target.value)}
                          className={inputClass}
                        >
                          <option value="">{t.posFilterAll}</option>
                          {warehouses.map((w) => (
                            <option key={w.id} value={w.id}>
                              {w.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* Detailed Sales Balance / Report Card */}
              {showReport && (
                <section className="space-y-4 rounded-2xl border border-[#115E3B]/25 bg-[#F7FAF8] p-4 dark:border-[#10B981]/30 dark:bg-[#091611]">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#DCE7E0] pb-3 dark:border-[#1E3A2D]">
                    <h3 className="flex items-center gap-2 text-sm font-bold text-[#0B1F16] dark:text-[#F2F9F5]">
                      <BarChart3 className="h-4 w-4 text-[#115E3B] dark:text-[#34D399]" />
                      <span>{t.salesReportTitle}</span>
                    </h3>
                    <div className="flex flex-wrap items-center gap-2">
                      {onPrintSalesReport && (
                        <button
                          type="button"
                          onClick={() =>
                            onPrintSalesReport({
                              startDate: filterFrom || undefined,
                              endDate: filterTo || undefined,
                              customerId: filterCustomerId || undefined,
                              productId: filterProductId || undefined,
                              category: filterCategory || undefined,
                            })
                          }
                          className="flex min-h-[38px] items-center gap-1.5 rounded-xl border border-[#DCE7E0] bg-white px-3 text-xs font-semibold text-[#115E3B] hover:bg-[#ECF7F1] dark:border-[#1E3A2D] dark:bg-[#0F2119] dark:text-[#34D399]"
                        >
                          <Printer className="h-3.5 w-3.5" />
                          <span>{t.reportPrintNow}</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => void handleExportSalesExcel()}
                        disabled={exportingSales}
                        className="flex min-h-[38px] items-center gap-1.5 rounded-xl bg-[#115E3B] px-3 text-xs font-semibold text-white hover:bg-[#0D4A2E] disabled:opacity-60 dark:bg-[#10B981] dark:text-[#052E1C]"
                      >
                        <FileSpreadsheet className="h-3.5 w-3.5" />
                        <span>{t.salesReportExportExcel}</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                    <div className="rounded-xl border border-[#DCE7E0] bg-white p-3 dark:border-[#1E3A2D] dark:bg-[#0F2119]">
                      <span className="block text-[11px] text-[#335947] dark:text-[#9EC0AE]">
                        {t.salesReportCostTotal}
                      </span>
                      <span className="tabular-nums mt-0.5 block text-sm font-bold text-[#0B1F16] dark:text-[#F2F9F5]">
                        {formatCurrency(salesBreakdown.totalCostMad, currency, lang)}
                      </span>
                    </div>
                    <div className="rounded-xl border border-[#DCE7E0] bg-white p-3 dark:border-[#1E3A2D] dark:bg-[#0F2119]">
                      <span className="block text-[11px] text-[#335947] dark:text-[#9EC0AE]">
                        {t.posTotalProfit}
                      </span>
                      <span className="tabular-nums mt-0.5 block text-sm font-bold text-[#115E3B] dark:text-[#34D399]">
                        {formatCurrency(salesBreakdown.netProfitMad, currency, lang)}
                      </span>
                    </div>
                    <div className="rounded-xl border border-[#DCE7E0] bg-white p-3 dark:border-[#1E3A2D] dark:bg-[#0F2119]">
                      <span className="block text-[11px] text-[#335947] dark:text-[#9EC0AE]">
                        {t.salesReportMarginRate}
                      </span>
                      <span className="tabular-nums mt-0.5 block text-sm font-bold text-[#115E3B] dark:text-[#34D399]">
                        {formatNumber(salesBreakdown.marginPct, lang)}%
                      </span>
                    </div>
                    <div className="rounded-xl border border-[#DCE7E0] bg-white p-3 dark:border-[#1E3A2D] dark:bg-[#0F2119]">
                      <span className="block text-[11px] text-[#335947] dark:text-[#9EC0AE]">
                        {t.salesReportAvgInvoice}
                      </span>
                      <span className="tabular-nums mt-0.5 block text-sm font-bold text-[#0B1F16] dark:text-[#F2F9F5]">
                        {formatCurrency(salesBreakdown.avgInvoiceMad, currency, lang)}
                      </span>
                    </div>
                  </div>

                  {salesBreakdown.paymentRows.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-bold uppercase tracking-wider text-[#335947] dark:text-[#9EC0AE]">
                        {t.salesReportByPayment}
                      </p>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                        {salesBreakdown.paymentRows.map(([method, data]) => (
                          <div
                            key={method}
                            className="flex items-center justify-between rounded-xl border border-[#DCE7E0] bg-white px-3 py-2 text-xs dark:border-[#1E3A2D] dark:bg-[#0F2119]"
                          >
                            <div>
                              <span className="block font-semibold text-[#0B1F16] dark:text-[#F2F9F5]">
                                {paymentLabel(method)}
                              </span>
                              <span className="tabular-nums text-[11px] text-[#335947] dark:text-[#9EC0AE]">
                                {formatNumber(data.count, lang)} · {formatNumber(data.units, lang)}{' '}
                                {t.articlesUnit}
                              </span>
                            </div>
                            <span className="tabular-nums font-bold text-[#115E3B] dark:text-[#34D399]">
                              {formatCurrency(data.revenueMad, currency, lang)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {salesBreakdown.productRows.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-bold uppercase tracking-wider text-[#335947] dark:text-[#9EC0AE]">
                        {t.salesReportByProduct}
                      </p>
                      <div className="divide-y divide-[#DCE7E0] rounded-xl border border-[#DCE7E0] bg-white dark:divide-[#1E3A2D] dark:border-[#1E3A2D] dark:bg-[#0F2119]">
                        {salesBreakdown.productRows.map((row) => (
                          <div
                            key={row.code}
                            className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs"
                          >
                            <div className="min-w-0">
                              <span className="font-mono-code font-bold text-[#115E3B] dark:text-[#34D399]">
                                {row.code}
                              </span>{' '}
                              <span className="font-semibold text-[#0B1F16] dark:text-[#F2F9F5]">
                                {row.name}
                              </span>
                            </div>
                            <div className="tabular-nums flex items-center gap-3 text-[#335947] dark:text-[#9EC0AE]">
                              <span>
                                {formatNumber(row.units, lang)} {t.articlesUnit}
                              </span>
                              <span className="font-bold text-[#115E3B] dark:text-[#34D399]">
                                {formatCurrency(row.revenueMad, currency, lang)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </section>
              )}

              {/* Invoices & BL List */}
              {filteredInvoices.length === 0 ? (
                <div className="rounded-2xl border border-[#DCE7E0] bg-[#F7FAF8] px-5 py-10 text-center dark:border-[#1E3A2D] dark:bg-[#091611]">
                  <Receipt className="mx-auto mb-2 h-8 w-8 text-[#115E3B]/45 dark:text-[#34D399]/45" />
                  <p className="text-sm font-medium text-[#335947] dark:text-[#9EC0AE]">
                    {t.posEmptyInvoices}
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {filteredInvoices.map((inv) => {
                    const items = getInvoiceLineItems(inv);
                    const isCopy = (inv.printCount || 0) > 0;
                    const isBl = (inv.documentType || 'facture') === 'bl';

                    return (
                      <div
                        key={inv.id}
                        className="flex flex-col justify-between gap-3 rounded-2xl border border-[#DCE7E0] bg-white p-4 sm:flex-row sm:items-center dark:border-[#1E3A2D] dark:bg-[#091611]"
                      >
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                            <span
                              className={`rounded-lg px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${
                                isBl
                                  ? 'border border-amber-500/35 bg-amber-50 text-amber-800 dark:border-amber-400/35 dark:bg-amber-950/40 dark:text-amber-200'
                                  : 'border border-[#115E3B]/35 bg-[#ECF7F1] text-[#115E3B] dark:border-[#10B981]/35 dark:bg-[#132B20] dark:text-[#34D399]'
                              }`}
                            >
                              {isBl ? t.posBlBadge : t.posFactureBadge}
                            </span>

                            <span className="font-mono-code text-sm font-bold text-[#115E3B] dark:text-[#34D399]">
                              {inv.invoiceNumber}
                            </span>

                            {!isBl && inv.blNumber && (
                              <span className="font-mono-code text-[11px] font-medium text-[#335947] dark:text-[#9EC0AE]">
                                ({t.posConvertedFromBlPrefix} {inv.blNumber})
                              </span>
                            )}

                            <span aria-hidden="true" className="text-[#6B8A79]">
                              ·
                            </span>
                            <span className="tabular-nums text-xs text-[#335947] dark:text-[#9EC0AE]">
                              {inv.saleDate}
                            </span>
                            {isCopy && (
                              <>
                                <span aria-hidden="true" className="text-[#6B8A79]">
                                  ·
                                </span>
                                <span className="text-[11px] font-bold text-amber-700 dark:text-amber-300">
                                  {`${t.invoiceCopyBadge} (${inv.printCount})`}
                                </span>
                              </>
                            )}
                          </div>

                          {/* Line items */}
                          <div className="space-y-0.5">
                            {items.map((li, idx) => (
                              <div
                                key={`${li.productId}-${idx}`}
                                className="flex flex-wrap items-center gap-x-2 text-xs text-[#0B1F16] dark:text-[#F2F9F5]"
                              >
                                <span className="font-mono-code font-semibold text-[#115E3B] dark:text-[#34D399]">
                                  {li.productCode}
                                </span>
                                <span className="font-semibold">{li.productName}</span>
                                <span className="tabular-nums text-[#335947] dark:text-[#9EC0AE]">
                                  ({formatNumber(li.quantity, lang)} ×{' '}
                                  {formatCurrency(li.unitPrice, currency, lang)}
                                  {li.discountPercent && li.discountPercent > 0
                                    ? ` · -${li.discountPercent}%`
                                    : ''}
                                  )
                                </span>
                              </div>
                            ))}
                          </div>

                          <div className="tabular-nums flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#335947] dark:text-[#9EC0AE]">
                            <span>
                              {formatNumber(items.length, lang)} {t.posItemCountUnit} ·{' '}
                              {formatNumber(inv.quantity, lang)} {t.articlesUnit}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>
                              {inv.paymentBreakdown && inv.paymentBreakdown.length > 0
                                ? inv.paymentBreakdown
                                    .map(
                                      (s) =>
                                        `${paymentLabel(s.method)} (${formatCurrency(s.amount, currency, lang)})`
                                    )
                                    .join(' + ')
                                : paymentLabel(inv.paymentMethod)}
                            </span>
                            {inv.customerName && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="font-medium text-[#0B1F16] dark:text-[#F2F9F5]">
                                  {inv.customerName}
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 sm:justify-end">
                          <span className="tabular-nums text-base font-bold text-[#115E3B] dark:text-[#34D399]">
                            {formatCurrency(inv.totalPrice, currency, lang)}
                          </span>

                          <div className="flex flex-wrap items-center gap-1.5">
                            {isBl && onConvertBlToInvoice && (
                              <button
                                type="button"
                                disabled={convertingId === inv.id}
                                onClick={async () => {
                                  setConvertingId(inv.id);
                                  try {
                                    await onConvertBlToInvoice(inv.id);
                                  } finally {
                                    setConvertingId(null);
                                  }
                                }}
                                className="flex min-h-[40px] items-center gap-1.5 rounded-xl bg-[#115E3B] px-3 text-xs font-bold text-white hover:bg-[#0D4A2E] disabled:opacity-60 whitespace-nowrap dark:bg-[#10B981] dark:text-[#052E1C]"
                              >
                                <FileCheck2 className="h-3.5 w-3.5" />
                                <span>{t.posConvertToInvoice}</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() =>
                                onOpenProductDigitalFile(items[0]?.productId || inv.productId)
                              }
                              title={t.qrDigitalFileButton}
                              className="flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[#DCE7E0] bg-[#ECF7F1] px-2.5 text-xs font-semibold text-[#115E3B] hover:bg-[#DCF0E4] dark:border-[#1E3A2D] dark:bg-[#132B20] dark:text-[#34D399]"
                            >
                              <FileText className="h-3.5 w-3.5" />
                              <span>{t.qrDigitalFileButton}</span>
                            </button>

                            {onPrintInvoice && (
                              <button
                                type="button"
                                disabled={printingId === inv.id}
                                onClick={async () => {
                                  setPrintingId(inv.id);
                                  try {
                                    await onPrintInvoice(inv, isCopy);
                                  } finally {
                                    setPrintingId(null);
                                  }
                                }}
                                title={isCopy ? t.posReprintCopy : t.posPrintInvoice}
                                className="flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[#DCE7E0] bg-white px-2.5 text-xs font-semibold text-[#115E3B] hover:bg-[#ECF7F1] disabled:opacity-60 dark:border-[#1E3A2D] dark:bg-[#0F2119] dark:text-[#34D399]"
                              >
                                <Printer className="h-3.5 w-3.5" />
                                <span>{isCopy ? t.posReprintCopy : t.posPrintInvoice}</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={async () => {
                                const blob = await buildInvoiceReceiptBlob(
                                  inv,
                                  storeName,
                                  currency,
                                  lang,
                                  { isCopy, companySettings: shopSettings }
                                );
                                await saveOrShareBlob(
                                  blob,
                                  `${inv.invoiceNumber.toLowerCase()}.png`,
                                  inv.invoiceNumber
                                );
                              }}
                              title={t.posDownloadReceipt}
                              className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl border border-[#DCE7E0] text-[#0B1F16] hover:bg-[#F7FAF8] dark:border-[#1E3A2D] dark:text-[#F2F9F5] dark:hover:bg-[#162E23]"
                            >
                              <Download className="h-4 w-4" />
                            </button>

                            {cancelingId === inv.id ? (
                              <button
                                type="button"
                                onClick={async () => {
                                  await onCancelInvoice(inv.id);
                                  setCancelingId(null);
                                }}
                                className="min-h-[40px] rounded-xl bg-red-600 px-3 text-xs font-semibold text-white"
                              >
                                {t.confirmDeleteAction}
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setCancelingId(inv.id)}
                                title={t.posCancelInvoice}
                                className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl border border-[#DCE7E0] text-red-600 hover:bg-red-50 dark:border-[#1E3A2D] dark:text-red-400 dark:hover:bg-red-950/40"
                              >
                                <RotateCcw className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ================================================================== */}
      {/* SUB-MODAL 0: Recette Journalière de la Caisse                      */}
      {/* ================================================================== */}
      {dailySummaryOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-xs sm:items-center sm:p-4"
          onClick={() => setDailySummaryOpen(false)}
        >
          <div
            className="flex max-h-[92dvh] w-full max-w-4xl flex-col overflow-hidden rounded-t-3xl border border-[#DCE7E0] bg-white shadow-2xl sm:rounded-3xl dark:border-[#1E3A2D] dark:bg-[#0F2119]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#DCE7E0] px-5 py-3.5 dark:border-[#1E3A2D]">
              <div className="flex items-center gap-2.5">
                <BarChart3 className="h-5 w-5 text-[#115E3B] dark:text-[#34D399]" />
                <h3 className="font-display text-base font-bold text-[#0B1F16] sm:text-lg dark:text-[#F2F9F5]">
                  {t.posDailySummaryTitle}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDailySummaryOpen(false)}
                className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl text-[#335947] hover:bg-[#ECF7F1] dark:text-[#9EC0AE]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              {/* Period Quick Presets */}
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    ['today', t.posPeriodToday],
                    ['morning', t.posPeriodMorning],
                    ['afternoon', t.posPeriodAfternoon],
                    ['week', t.posPeriodWeek],
                    ['month', t.posPeriodMonth],
                    ['custom', t.posPeriodCustom],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleApplyDailyPreset(key)}
                    className={`min-h-[38px] rounded-xl border px-3 text-xs font-semibold transition-colors whitespace-nowrap ${
                      dailyPreset === key
                        ? 'border-[#115E3B] bg-[#115E3B] text-white dark:border-[#10B981] dark:bg-[#10B981] dark:text-[#052E1C]'
                        : 'border-[#DCE7E0] bg-[#F7FAF8] text-[#0B1F16] hover:bg-[#ECF7F1] dark:border-[#1E3A2D] dark:bg-[#091611] dark:text-[#F2F9F5]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Start / End Dates + Valider Button */}
              <div className="grid grid-cols-1 gap-3 rounded-2xl border border-[#DCE7E0] bg-[#F7FAF8] p-3.5 sm:grid-cols-3 sm:items-end dark:border-[#1E3A2D] dark:bg-[#091611]">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#0B1F16] dark:text-[#F2F9F5]">
                    {t.adjustmentFilterFrom}
                  </label>
                  <input
                    type="date"
                    value={dailyStartDate}
                    onChange={(e) => {
                      setDailyPreset('custom');
                      setDailyStartDate(e.target.value);
                    }}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#0B1F16] dark:text-[#F2F9F5]">
                    {t.adjustmentFilterTo}
                  </label>
                  <input
                    type="date"
                    value={dailyEndDate}
                    onChange={(e) => {
                      setDailyPreset('custom');
                      setDailyEndDate(e.target.value);
                    }}
                    className={inputClass}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setDailyValidated(true)}
                  className="flex min-h-[42px] items-center justify-center gap-2 rounded-xl bg-[#115E3B] px-4 text-xs font-bold text-white hover:bg-[#0D4A2E] dark:bg-[#10B981] dark:text-[#052E1C]"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>{t.posDailySummaryValidate}</span>
                </button>
              </div>

              {/* Preview + Print / Download once Validated */}
              {dailyValidated && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-2.5">
                    {dailyReportSpec.kpis.map((kpi, idx) => (
                      <div
                        key={idx}
                        className="rounded-xl border border-[#DCE7E0] bg-[#ECF7F1]/70 p-3 dark:border-[#1E3A2D] dark:bg-[#132B20]/70"
                      >
                        <span className="block text-[11px] font-semibold text-[#335947] dark:text-[#9EC0AE]">
                          {kpi.label}
                        </span>
                        <span className="tabular-nums mt-0.5 block text-base font-extrabold text-[#115E3B] dark:text-[#34D399]">
                          {kpi.value}
                        </span>
                      </div>
                    ))}
                  </div>

                  {dailyReportSpec.tables.map((tbl, tIdx) => (
                    <div key={tIdx} className="space-y-1.5">
                      {tbl.heading && (
                        <h4 className="text-xs font-bold uppercase tracking-wider text-[#335947] dark:text-[#9EC0AE]">
                          {tbl.heading}
                        </h4>
                      )}
                      <div className="max-h-56 overflow-auto rounded-xl border border-[#DCE7E0] dark:border-[#1E3A2D]">
                        <table className="w-full border-collapse text-xs">
                          <thead className="sticky top-0 bg-[#115E3B] text-white dark:bg-[#132B20]">
                            <tr>
                              {tbl.columns.map((col, cIdx) => (
                                <th
                                  key={cIdx}
                                  className={`px-3 py-2 font-bold whitespace-nowrap ${
                                    col.align === 'right' ? 'text-end' : 'text-start'
                                  }`}
                                >
                                  {col.label}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#DCE7E0] dark:divide-[#1E3A2D]">
                            {tbl.rows.length === 0 ? (
                              <tr>
                                <td
                                  colSpan={tbl.columns.length}
                                  className="px-4 py-4 text-center text-[#6B8A79]"
                                >
                                  {t.reportNoDataForFilters}
                                </td>
                              </tr>
                            ) : (
                              tbl.rows.map((row, rIdx) => (
                                <tr
                                  key={rIdx}
                                  className="hover:bg-[#F7FAF8] dark:hover:bg-[#0B1913]"
                                >
                                  {row.map((cell, cIdx) => (
                                    <td
                                      key={cIdx}
                                      className={`tabular-nums px-3 py-2 text-[#0B1F16] dark:text-[#F2F9F5] ${
                                        tbl.columns[cIdx]?.align === 'right'
                                          ? 'text-end font-semibold'
                                          : 'text-start'
                                      }`}
                                    >
                                      {cell}
                                    </td>
                                  ))}
                                </tr>
                              ))
                            )}
                          </tbody>
                          {tbl.totalsRow && (
                            <tfoot className="bg-[#ECF7F1] font-extrabold text-[#115E3B] dark:bg-[#132B20] dark:text-[#34D399]">
                              <tr>
                                {tbl.totalsRow.map((cell, cIdx) => (
                                  <td
                                    key={cIdx}
                                    className={`tabular-nums px-3 py-2 ${
                                      tbl.columns[cIdx]?.align === 'right'
                                        ? 'text-end'
                                        : 'text-start'
                                    }`}
                                  >
                                    {cell}
                                  </td>
                                ))}
                              </tr>
                            </tfoot>
                          )}
                        </table>
                      </div>
                    </div>
                  ))}

                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    <button
                      type="button"
                      disabled={dailyRunningOutput}
                      onClick={() => void handleRunDailyReport('print')}
                      className="flex min-h-[46px] items-center justify-center gap-2 rounded-xl bg-[#115E3B] px-4 text-xs font-bold text-white hover:bg-[#0D4A2E] disabled:opacity-60 dark:bg-[#10B981] dark:text-[#052E1C]"
                    >
                      <Printer className="h-4 w-4" />
                      <span>{t.reportPrintNow}</span>
                    </button>
                    <button
                      type="button"
                      disabled={dailyRunningOutput}
                      onClick={() => void handleRunDailyReport('pdf')}
                      className="flex min-h-[46px] items-center justify-center gap-2 rounded-xl border border-[#DCE7E0] bg-white px-4 text-xs font-bold text-[#115E3B] hover:bg-[#ECF7F1] disabled:opacity-60 dark:border-[#1E3A2D] dark:bg-[#091611] dark:text-[#34D399]"
                    >
                      <Download className="h-4 w-4" />
                      <span>{t.reportDownloadPdf}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* SUB-MODAL 9: Customer Picker & Quick New Customer                  */}
      {/* ================================================================== */}
      {customerModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-xs sm:items-center sm:p-4"
          onClick={() => setCustomerModalOpen(false)}
        >
          <div
            className="flex max-h-[88dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-[#DCE7E0] bg-white shadow-2xl sm:rounded-3xl dark:border-[#1E3A2D] dark:bg-[#0F2119]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#DCE7E0] px-5 py-3.5 dark:border-[#1E3A2D]">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-[#115E3B] dark:text-[#34D399]" />
                <h3 className="font-display text-base font-bold text-[#0B1F16] dark:text-[#F2F9F5]">
                  {t.posSelectCustomer}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setCustomerModalOpen(false)}
                className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl text-[#335947] hover:bg-[#ECF7F1] dark:text-[#9EC0AE]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-5">
              {/* Walk-in Default + Quick Create Toggle */}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => {
                    setCustomerId('');
                    setCustomerName('');
                    setCustomerPhone('');
                    setCustomerModalOpen(false);
                  }}
                  className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-[#DCE7E0] bg-[#F7FAF8] px-3 text-xs font-bold text-[#0B1F16] hover:bg-[#ECF7F1] dark:border-[#1E3A2D] dark:bg-[#091611] dark:text-[#F2F9F5]"
                >
                  <UserCheck className="h-4 w-4 text-[#115E3B] dark:text-[#34D399]" />
                  <span>{t.posWalkInShort}</span>
                </button>

                {onCreateCustomer && (
                  <button
                    type="button"
                    onClick={() => setShowNewCustomerForm((v) => !v)}
                    className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-[#115E3B]/35 bg-[#ECF7F1] px-3 text-xs font-bold text-[#115E3B] hover:bg-[#DCF0E4] dark:border-[#10B981]/35 dark:bg-[#132B20] dark:text-[#34D399]"
                  >
                    <UserPlus className="h-4 w-4" />
                    <span>{t.posQuickNewCustomer}</span>
                  </button>
                )}
              </div>

              {showNewCustomerForm && onCreateCustomer && (
                <form
                  onSubmit={handleCreateQuickCustomer}
                  className="space-y-2.5 rounded-2xl border border-[#115E3B]/30 bg-[#ECF7F1]/60 p-3.5 dark:border-[#10B981]/30 dark:bg-[#132B20]/50"
                >
                  <input
                    type="text"
                    required
                    value={newCustName}
                    onChange={(e) => setNewCustName(e.target.value)}
                    placeholder={t.customerNamePlaceholder}
                    className={inputClass}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="tel"
                      value={newCustPhone}
                      onChange={(e) => setNewCustPhone(e.target.value)}
                      placeholder={t.customerPhonePlaceholder}
                      className={inputClass}
                    />
                    <input
                      type="text"
                      value={newCustCity}
                      onChange={(e) => setNewCustCity(e.target.value)}
                      placeholder={t.customerCityPlaceholder}
                      className={inputClass}
                    />
                  </div>
                  <select
                    value={newCustCategory}
                    onChange={(e) => setNewCustCategory(e.target.value as CustomerCategory)}
                    className={inputClass}
                  >
                    <option value="regular">{t.customerCategoryRegular}</option>
                    <option value="seller">{t.customerCategorySeller}</option>
                    <option value="hobbyist">{t.customerCategoryHobbyist}</option>
                    <option value="other">{t.customerCategoryOther}</option>
                  </select>
                  <button
                    type="submit"
                    disabled={savingNewCustomer || !newCustName.trim()}
                    className="min-h-[42px] w-full rounded-xl bg-[#115E3B] text-xs font-bold text-white hover:bg-[#0D4A2E] disabled:opacity-50 dark:bg-[#10B981] dark:text-[#052E1C]"
                  >
                    {savingNewCustomer ? t.saving : t.save}
                  </button>
                </form>
              )}

              {/* Search Existing Customers */}
              <div className="relative">
                <Search
                  className={`pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-[#335947] dark:text-[#9EC0AE] ${
                    lang === 'ar' ? 'right-3.5' : 'left-3.5'
                  }`}
                />
                <input
                  type="text"
                  value={customerSearchInput}
                  onChange={(e) => setCustomerSearchInput(e.target.value)}
                  placeholder={t.posCustomerCodeSearchPlaceholder}
                  className={`${inputClass} ${lang === 'ar' ? 'pl-3 pr-10' : 'pl-10 pr-3'}`}
                />
              </div>

              <div className="max-h-64 divide-y divide-[#DCE7E0] overflow-y-auto rounded-xl border border-[#DCE7E0] dark:divide-[#1E3A2D] dark:border-[#1E3A2D]">
                {filteredCustomers.length === 0 ? (
                  <p className="px-4 py-4 text-center text-xs text-[#6B8A79]">
                    {t.posNoMatchingCustomer}
                  </p>
                ) : (
                  filteredCustomers.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setCustomerId(c.id);
                        setCustomerName(c.name);
                        setCustomerPhone(c.phone);
                        setCustomerModalOpen(false);
                      }}
                      className={`flex w-full items-center justify-between gap-2 px-3.5 py-2.5 text-start text-xs hover:bg-[#ECF7F1] dark:hover:bg-[#132B20] ${
                        customerId === c.id ? 'bg-[#ECF7F1] dark:bg-[#132B20]' : ''
                      }`}
                    >
                      <div>
                        <span className="font-mono-code font-bold text-[#115E3B] dark:text-[#34D399]">
                          {c.code}
                        </span>{' '}
                        <span className="font-semibold text-[#0B1F16] dark:text-[#F2F9F5]">
                          {c.name}
                        </span>
                      </div>
                      {c.phone && (
                        <span className="tabular-nums text-[11px] text-[#335947] dark:text-[#9EC0AE]">
                          {c.phone}
                        </span>
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* SUB-MODAL 14: Payment & Validation (Simple + Combined Split)       */}
      {/* ================================================================== */}
      {paymentModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-xs sm:items-center sm:p-4"
          onClick={() => setPaymentModalOpen(false)}
        >
          <form
            onSubmit={handleConfirmPaymentAndPrint}
            className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-[#DCE7E0] bg-white shadow-2xl sm:rounded-3xl dark:border-[#1E3A2D] dark:bg-[#0F2119]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#DCE7E0] px-5 py-3.5 dark:border-[#1E3A2D]">
              <div className="flex items-center gap-2.5">
                <Banknote className="h-5 w-5 text-[#115E3B] dark:text-[#34D399]" />
                <div>
                  <h3 className="font-display text-base font-bold text-[#0B1F16] dark:text-[#F2F9F5]">
                    {t.posPaymentModalTitle}
                  </h3>
                  <p className="text-[11px] text-[#335947] dark:text-[#9EC0AE]">
                    {currentBlLabel} · {customerName.trim() || t.posWalkInShort} · {cartTotalUnits}{' '}
                    {t.articlesUnit}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPaymentModalOpen(false)}
                className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl text-[#335947] hover:bg-[#ECF7F1] dark:text-[#9EC0AE]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              {/* Total Banner */}
              <div className="flex items-center justify-between rounded-2xl border border-[#115E3B]/30 bg-[#ECF7F1] px-4 py-3 dark:border-[#10B981]/30 dark:bg-[#132B20]">
                <span className="text-xs font-bold text-[#335947] dark:text-[#9EC0AE]">
                  TOTAL ({t.posNbreArt}: {formatNumber(cartTotalUnits, lang)})
                </span>
                <span className="tabular-nums font-display text-2xl font-extrabold text-[#115E3B] dark:text-[#34D399]">
                  {formatNumber(cartGrandTotalDisplay, lang)} {currency}
                </span>
              </div>

              {/* Payment Mode Switcher: Simple vs Combined */}
              <div className="grid grid-cols-2 gap-2 rounded-xl border border-[#DCE7E0] bg-[#F7FAF8] p-1 dark:border-[#1E3A2D] dark:bg-[#091611]">
                <button
                  type="button"
                  onClick={() => setPaymentMode('single')}
                  className={`min-h-[40px] rounded-lg px-3 text-xs font-bold transition-colors ${
                    paymentMode === 'single'
                      ? 'bg-[#115E3B] text-white dark:bg-[#10B981] dark:text-[#052E1C]'
                      : 'text-[#335947] dark:text-[#9EC0AE]'
                  }`}
                >
                  {t.posPaymentSingleMode}
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMode('mixed')}
                  className={`min-h-[40px] rounded-lg px-3 text-xs font-bold transition-colors ${
                    paymentMode === 'mixed'
                      ? 'bg-[#115E3B] text-white dark:bg-[#10B981] dark:text-[#052E1C]'
                      : 'text-[#335947] dark:text-[#9EC0AE]'
                  }`}
                >
                  {t.posPaymentMixedMode}
                </button>
              </div>

              {paymentMode === 'single' ? (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {(
                    [
                      ['cash', t.paymentCash, Banknote],
                      ['card', t.paymentCard, CreditCard],
                      ['check', t.paymentCheck, Receipt],
                      ['bill_of_exchange', t.paymentBillOfExchange, FileCheck2],
                      ['credit', t.paymentCredit, FileText],
                      ['transfer', t.paymentTransfer, Landmark],
                      ['other', t.paymentOther, FileText],
                    ] as const
                  ).map(([pm, label, Icon]) => {
                    const active = singlePaymentMethod === pm;
                    return (
                      <button
                        key={pm}
                        type="button"
                        onClick={() => setSinglePaymentMethod(pm)}
                        className={`flex min-h-[48px] items-center justify-center gap-2 rounded-xl border px-3 text-xs font-bold transition-colors ${
                          active
                            ? 'border-[#115E3B] bg-[#115E3B] text-white dark:border-[#10B981] dark:bg-[#10B981] dark:text-[#052E1C]'
                            : 'border-[#DCE7E0] bg-[#F7FAF8] text-[#0B1F16] hover:bg-[#ECF7F1] dark:border-[#1E3A2D] dark:bg-[#091611] dark:text-[#F2F9F5]'
                        }`}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span>{label}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-2.5 rounded-2xl border border-[#DCE7E0] bg-[#F7FAF8] p-3.5 dark:border-[#1E3A2D] dark:bg-[#091611]">
                  {(
                    [
                      ['cash', t.paymentCash],
                      ['card', t.paymentCard],
                      ['check', t.paymentCheck],
                      ['bill_of_exchange', t.paymentBillOfExchange],
                      ['credit', t.paymentCredit],
                    ] as const
                  ).map(([method, label]) => (
                    <div key={method} className="flex items-center gap-2">
                      <span className="w-32 shrink-0 text-xs font-bold text-[#0B1F16] dark:text-[#F2F9F5]">
                        {label}
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={splitAmounts[method]}
                        onChange={(e) =>
                          setSplitAmounts((prev) => ({ ...prev, [method]: e.target.value }))
                        }
                        placeholder="0.00"
                        className={`${inputClass} tabular-nums flex-1 text-end font-bold`}
                      />
                      <button
                        type="button"
                        onClick={() => handleFillSplitRemaining(method)}
                        className="min-h-[42px] shrink-0 rounded-xl border border-[#115E3B]/35 bg-[#ECF7F1] px-2.5 text-[11px] font-bold text-[#115E3B] hover:bg-[#DCF0E4] dark:border-[#10B981]/35 dark:bg-[#132B20] dark:text-[#34D399]"
                      >
                        = Reste
                      </button>
                    </div>
                  ))}
                  <div className="flex items-center justify-between border-t border-[#DCE7E0] pt-2 text-xs font-bold dark:border-[#1E3A2D]">
                    <span className="text-[#335947] dark:text-[#9EC0AE]">
                      {t.posSplitRemaining}
                    </span>
                    <span
                      className={`tabular-nums ${
                        Math.abs(splitRemainingDisplay) <= 0.05
                          ? 'text-[#115E3B] dark:text-[#34D399]'
                          : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {formatNumber(splitRemainingDisplay, lang)} {currency}
                    </span>
                  </div>
                </div>
              )}

              {/* Required Check / Bill of Exchange / Card Portfolio Capture */}
              {activeInstrumentTypes.map(({ type: instType, amountDisplay }) => {
                const draft = instrumentDrafts[instType];
                const isCard = instType === 'card';
                const heading =
                  instType === 'check'
                    ? t.portfolioTypeCheck
                    : instType === 'bill_of_exchange'
                    ? t.portfolioTypeBillOfExchange
                    : t.portfolioTypeCard;

                const updateField = (field: keyof InstrumentDraft, val: string) => {
                  setInstrumentDrafts((prev) => ({
                    ...prev,
                    [instType]: {
                      ...prev[instType],
                      [field]: val,
                    },
                  }));
                };

                return (
                  <div
                    key={instType}
                    className="space-y-2.5 rounded-2xl border border-[#115E3B]/30 bg-[#ECF7F1]/70 p-3.5 dark:border-[#10B981]/30 dark:bg-[#132B20]/60"
                  >
                    <div className="flex items-center justify-between gap-2 border-b border-[#DCE7E0] pb-2 dark:border-[#1E3A2D]">
                      <div className="flex items-center gap-2">
                        <Wallet className="h-4 w-4 text-[#115E3B] dark:text-[#34D399]" />
                        <span className="text-xs font-extrabold text-[#0B1F16] dark:text-[#F2F9F5]">
                          {heading} — {t.posInstrumentSectionTitle}
                        </span>
                      </div>
                      <span className="tabular-nums text-xs font-extrabold text-[#115E3B] dark:text-[#34D399]">
                        {formatNumber(amountDisplay, lang)} {currency}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-[11px] font-semibold text-[#335947] dark:text-[#9EC0AE]">
                          {isCard ? t.portfolioBankCardLabel : `${t.portfolioBankLabel} *`}
                        </label>
                        <input
                          type="text"
                          required={!isCard}
                          value={draft.bankName}
                          onChange={(e) => updateField('bankName', e.target.value)}
                          placeholder={isCard ? 'Visa / Mastercard / CMI / CIH...' : 'Attijariwafa, BP, BMCE...'}
                          className={inputClass}
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-[11px] font-semibold text-[#335947] dark:text-[#9EC0AE]">
                          {isCard ? `${t.portfolioCardNumberLabel} *` : `${t.portfolioNumberLabel} *`}
                        </label>
                        <input
                          type="text"
                          required
                          value={draft.instrumentNumber}
                          onChange={(e) => updateField('instrumentNumber', e.target.value)}
                          placeholder={isCard ? 'Ex: **** 4821 / Auth #104' : 'Ex: CHQ-904812'}
                          className={inputClass}
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-[11px] font-semibold text-[#335947] dark:text-[#9EC0AE]">
                          {isCard ? `${t.portfolioCardHolderLabel} *` : `${t.portfolioHolderLabel} *`}
                        </label>
                        <input
                          type="text"
                          required
                          value={draft.holderName}
                          onChange={(e) => updateField('holderName', e.target.value)}
                          placeholder={customerName.trim() || t.customerNamePlaceholder}
                          className={inputClass}
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-[11px] font-semibold text-[#335947] dark:text-[#9EC0AE]">
                          {t.portfolioCustomerPhoneLabel}
                        </label>
                        <input
                          type="tel"
                          value={draft.customerPhone}
                          onChange={(e) => updateField('customerPhone', e.target.value)}
                          placeholder={customerPhone.trim() || t.customerPhonePlaceholder}
                          className={inputClass}
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-[11px] font-semibold text-[#335947] dark:text-[#9EC0AE]">
                          {t.portfolioBlNumberLabel}
                        </label>
                        <input
                          type="text"
                          value={draft.blNumber}
                          onChange={(e) => updateField('blNumber', e.target.value)}
                          placeholder={currentBlLabel}
                          className={`${inputClass} font-mono-code font-bold`}
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-[11px] font-semibold text-[#335947] dark:text-[#9EC0AE]">
                          {t.portfolioAmountLabel} ({currency})
                        </label>
                        <input
                          type="text"
                          readOnly
                          value={formatNumber(amountDisplay, lang)}
                          className={`${inputClass} tabular-nums font-bold opacity-85`}
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-[11px] font-semibold text-[#335947] dark:text-[#9EC0AE]">
                          {t.portfolioReceiptDateLabel}
                        </label>
                        <input
                          type="date"
                          value={draft.receiptDate}
                          onChange={(e) => updateField('receiptDate', e.target.value)}
                          className={inputClass}
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-[11px] font-semibold text-[#335947] dark:text-[#9EC0AE]">
                          {isCard
                            ? t.portfolioCardSettlementDateLabel
                            : `${t.portfolioDueDateLabel} *`}
                        </label>
                        <input
                          type="date"
                          required={!isCard}
                          value={draft.dueDate}
                          onChange={(e) => updateField('dueDate', e.target.value)}
                          className={inputClass}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}

              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#335947] dark:text-[#9EC0AE]">
                    {t.addedDateLabel.replace(/^9\.\s*/, '')}
                  </label>
                  <input
                    type="date"
                    value={saleDate}
                    onChange={(e) => setSaleDate(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#335947] dark:text-[#9EC0AE]">
                    {t.purchaseNotesLabel}
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={t.purchaseNotesPlaceholder}
                    className={inputClass}
                  />
                </div>
              </div>

              {errorMsg && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
                  {errorMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="flex min-h-[50px] w-full items-center justify-center gap-2 rounded-xl bg-[#115E3B] px-5 text-sm font-extrabold text-white hover:bg-[#0D4A2E] disabled:opacity-60 dark:bg-[#10B981] dark:text-[#052E1C]"
              >
                <Printer className="h-4 w-4 shrink-0" />
                <span>{submitting ? t.saving : t.posValiderTicketBtn}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* SUB-MODAL: BL HISTORY & REPRINT COPY (INSIDE CAISSE) */}
      {blHistoryOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-[#06150E]/65 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={() => setBlHistoryOpen(false)}
        >
          <div
            className="flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl border border-[#DCE7E0] bg-white shadow-2xl sm:rounded-3xl dark:border-[#1E3A2D] dark:bg-[#0F2119]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-[#DCE7E0] px-5 py-3.5 dark:border-[#1E3A2D]">
              <div className="flex items-start gap-2.5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#ECF7F1] text-[#115E3B] dark:bg-[#132B20] dark:text-[#34D399]">
                  <History className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-display text-base font-bold text-[#0B1F16] dark:text-[#F2F9F5]">
                    {t.posBlHistoryTitle}
                  </h3>
                  <p className="mt-0.5 text-[11px] text-[#335947] dark:text-[#9EC0AE]">
                    {t.posBlHistorySubtitle}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setBlHistoryOpen(false)}
                className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl text-[#335947] hover:bg-[#ECF7F1] dark:text-[#9EC0AE]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 space-y-3.5 overflow-y-auto p-4 sm:p-5">
              {/* Search & Criteria Controls */}
              <div className="space-y-2.5 rounded-2xl border border-[#DCE7E0] bg-[#F7FAF8] p-3.5 dark:border-[#1E3A2D] dark:bg-[#091611]">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <div className="relative flex-1">
                    <Search
                      className={`pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B8A79] ${
                        lang === 'ar' ? 'right-3.5' : 'left-3.5'
                      }`}
                    />
                    <input
                      type="text"
                      value={blHistorySearch}
                      onChange={(e) => setBlHistorySearch(e.target.value)}
                      placeholder={t.posBlHistorySearchPlaceholder}
                      className={`${inputClass} ${lang === 'ar' ? 'pr-10' : 'pl-10'}`}
                      autoFocus
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-1 rounded-xl border border-[#DCE7E0] bg-white p-1 dark:border-[#1E3A2D] dark:bg-[#0F2119]">
                    <button
                      type="button"
                      onClick={() => setBlHistoryPrintedOnly(false)}
                      className={`min-h-[38px] rounded-lg px-2.5 text-xs font-bold whitespace-nowrap transition-colors ${
                        !blHistoryPrintedOnly
                          ? 'bg-[#115E3B] text-white dark:bg-[#10B981] dark:text-[#052E1C]'
                          : 'text-[#335947] dark:text-[#9EC0AE]'
                      }`}
                    >
                      {t.posBlHistoryAll}
                    </button>
                    <button
                      type="button"
                      onClick={() => setBlHistoryPrintedOnly(true)}
                      className={`min-h-[38px] rounded-lg px-2.5 text-xs font-bold whitespace-nowrap transition-colors ${
                        blHistoryPrintedOnly
                          ? 'bg-[#115E3B] text-white dark:bg-[#10B981] dark:text-[#052E1C]'
                          : 'text-[#335947] dark:text-[#9EC0AE]'
                      }`}
                    >
                      {t.posBlHistoryPrintedOnly}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold text-[#335947] dark:text-[#9EC0AE]">
                      {t.addedDateLabel.replace(/^9\.\s*/, '')}
                    </label>
                    <input
                      type="date"
                      value={blHistoryDate}
                      onChange={(e) => setBlHistoryDate(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold text-[#335947] dark:text-[#9EC0AE]">
                      {t.adjustmentFilterProduct}
                    </label>
                    <select
                      value={blHistoryProductId}
                      onChange={(e) => setBlHistoryProductId(e.target.value)}
                      className={inputClass}
                    >
                      <option value="">{t.posFilterAll}</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.code} — {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold text-[#335947] dark:text-[#9EC0AE]">
                      {t.adjustmentFilterCustomer}
                    </label>
                    <select
                      value={blHistoryCustomerId}
                      onChange={(e) => setBlHistoryCustomerId(e.target.value)}
                      className={inputClass}
                    >
                      <option value="">{t.posFilterAll}</option>
                      <option value="__walk_in__">{t.posWalkInShort}</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.code} — {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {(blHistorySearch ||
                  blHistoryDate ||
                  blHistoryProductId ||
                  blHistoryCustomerId ||
                  blHistoryPrintedOnly) && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setBlHistorySearch('');
                        setBlHistoryDate('');
                        setBlHistoryProductId('');
                        setBlHistoryCustomerId('');
                        setBlHistoryPrintedOnly(false);
                      }}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[#115E3B] hover:underline dark:text-[#34D399]"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>{t.purchasesFilterReset}</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Matching BLs List */}
              {blHistoryMatches.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#DCE7E0] bg-white px-4 py-10 text-center text-sm text-[#6B8A79] dark:border-[#1E3A2D] dark:bg-[#091611]">
                  {t.posBlHistoryEmpty}
                </div>
              ) : (
                <div className="space-y-2.5">
                  {blHistoryMatches.map((inv) => {
                    const items = getInvoiceLineItems(inv);
                    const blNumDisplay = inv.blNumber || inv.invoiceNumber;
                    return (
                      <div
                        key={inv.id}
                        className="flex flex-col gap-3 rounded-2xl border border-[#DCE7E0] bg-white p-3.5 sm:flex-row sm:items-center sm:justify-between dark:border-[#1E3A2D] dark:bg-[#091611]"
                      >
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono-code rounded-md bg-[#ECF7F1] px-2 py-0.5 text-xs font-bold text-[#115E3B] dark:bg-[#132B20] dark:text-[#34D399]">
                              {blNumDisplay}
                            </span>
                            {inv.documentType === 'facture' && inv.invoiceNumber !== blNumDisplay && (
                              <span className="font-mono-code text-[11px] font-semibold text-[#335947] dark:text-[#9EC0AE]">
                                ({inv.invoiceNumber})
                              </span>
                            )}
                            <span className="tabular-nums text-xs font-medium text-[#335947] dark:text-[#9EC0AE]">
                              {inv.saleDate}
                            </span>
                            <span className="text-xs font-semibold text-[#0B1F16] dark:text-[#F2F9F5]">
                              · {inv.customerName || t.posWalkInShort}
                            </span>
                            {(inv.printCount || 0) > 0 && (
                              <span className="text-[11px] font-bold text-amber-700 dark:text-amber-300">
                                · {t.posBlHistoryPrintedCount} ({inv.printCount})
                              </span>
                            )}
                          </div>

                          <div className="space-y-0.5">
                            {items.map((li, idx) => (
                              <div
                                key={`${li.productId}-${idx}`}
                                className="flex flex-wrap items-center gap-x-2 text-xs text-[#0B1F16] dark:text-[#F2F9F5]"
                              >
                                <span className="font-mono-code font-semibold text-[#115E3B] dark:text-[#34D399]">
                                  {li.productCode}
                                </span>
                                <span className="font-medium">{li.productName}</span>
                                <span className="tabular-nums text-[#335947] dark:text-[#9EC0AE]">
                                  ({formatNumber(li.quantity, lang)} ×{' '}
                                  {formatCurrency(li.unitPrice, currency, lang)})
                                </span>
                              </div>
                            ))}
                          </div>

                          <div className="tabular-nums text-xs text-[#335947] dark:text-[#9EC0AE]">
                            {inv.paymentBreakdown && inv.paymentBreakdown.length > 0
                              ? inv.paymentBreakdown
                                  .map(
                                    (s) =>
                                      `${paymentLabel(s.method)}: ${formatCurrency(s.amount, currency, lang)}`
                                  )
                                  .join(' + ')
                              : paymentLabel(inv.paymentMethod)}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 sm:flex-col sm:items-end">
                          <span className="tabular-nums text-base font-extrabold text-[#115E3B] dark:text-[#34D399]">
                            {formatCurrency(inv.totalPrice, currency, lang)}
                          </span>

                          <div className="flex items-center gap-1.5">
                            {onPrintInvoice && (
                              <button
                                type="button"
                                disabled={printingId === inv.id}
                                onClick={async () => {
                                  setPrintingId(inv.id);
                                  try {
                                    await onPrintInvoice(inv, true);
                                  } finally {
                                    setPrintingId(null);
                                  }
                                }}
                                className="flex min-h-[42px] items-center gap-1.5 rounded-xl bg-[#115E3B] px-3 text-xs font-bold text-white hover:bg-[#0D4A2E] disabled:opacity-60 whitespace-nowrap dark:bg-[#10B981] dark:text-[#052E1C]"
                              >
                                <Printer className="h-3.5 w-3.5 shrink-0" />
                                <span>{t.posBlHistoryReprintCopy}</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={async () => {
                                const blob = await buildInvoiceReceiptBlob(
                                  inv,
                                  storeName,
                                  currency,
                                  lang,
                                  { isCopy: true, companySettings: shopSettings }
                                );
                                await saveOrShareBlob(
                                  blob,
                                  `${blNumDisplay.toLowerCase()}-copie.png`,
                                  `${blNumDisplay} (${t.invoiceCopyBadge})`
                                );
                              }}
                              title={`${t.posDownloadReceipt} (${t.invoiceCopyBadge})`}
                              className="flex min-h-[42px] min-w-[42px] items-center justify-center rounded-xl border border-[#DCE7E0] bg-white text-[#0B1F16] hover:bg-[#ECF7F1] dark:border-[#1E3A2D] dark:bg-[#0F2119] dark:text-[#F2F9F5]"
                            >
                              <Download className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
