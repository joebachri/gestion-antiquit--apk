import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  Plus,
  Printer,
  Receipt,
  RotateCcw,
  Search,
  ShoppingBag,
  Trash2,
  X,
} from 'lucide-react';
import type {
  Customer,
  Language,
  PosInvoice,
  PosInvoiceItem,
  PosSalePayload,
  Product,
  PurchasePaymentMethod,
  Warehouse,
} from '../types';
import { formatCurrency, formatNumber, translations } from '../i18n';
import { convertFromMad, convertToMad } from '../utils/currency';
import { buildInvoiceReceiptBlob } from '../utils/qr';
import { buildSalesReportExcelBlob } from '../utils/excel';
import { saveOrShareBlob } from '../utils/download';

interface PosSalesModalProps {
  isOpen: boolean;
  lang: Language;
  currency: string;
  storeName?: string;
  products: Product[];
  customers: Customer[];
  warehouses?: Warehouse[];
  invoices: PosInvoice[];
  summary: {
    totalInvoices: number;
    totalUnitsSold: number;
    totalRevenueMad: number;
    totalProfitMad: number;
  };
  onClose: () => void;
  onCreateSale: (payload: PosSalePayload) => Promise<PosInvoice | null>;
  onCancelInvoice: (invoiceId: string) => Promise<void>;
  onPrintInvoice?: (invoice: PosInvoice, isCopy: boolean) => Promise<void>;
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
}

interface CartLineItem {
  productId: string;
  productCode: string;
  productName: string;
  availableQty: number;
  quantity: number;
  unitPriceDisplay: number;
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
      totalPrice: inv.totalPrice,
      purchasePrice: inv.purchasePrice,
    },
  ];
}

export function PosSalesModal({
  isOpen,
  lang,
  currency,
  storeName = '',
  products,
  customers,
  warehouses = [],
  invoices,
  summary,
  onClose,
  onCreateSale,
  onCancelInvoice,
  onPrintInvoice,
  onOpenProductDigitalFile,
  onPrintAggregateInvoices,
  onPrintSalesReport,
}: PosSalesModalProps) {
  const t = translations[lang];
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

  const [showNewSale, setShowNewSale] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [exportingSales, setExportingSales] = useState(false);

  // Cart & New Sale form states
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unitPriceDisplay, setUnitPriceDisplay] = useState('');
  const [cartItems, setCartItems] = useState<CartLineItem[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PurchasePaymentMethod>('cash');
  const [saleDate, setSaleDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [productSearchInput, setProductSearchInput] = useState('');
  const [customerSearchInput, setCustomerSearchInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [printingId, setPrintingId] = useState<string | null>(null);

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [filterProductId, setFilterProductId] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterCustomerId, setFilterCustomerId] = useState('');
  const [filterWarehouseId, setFilterWarehouseId] = useState('');

  const filteredInvoices = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return invoices.filter((inv) => {
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
    for (const inv of filteredInvoices) {
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
      totalUnitsSold,
      totalRevenueMad,
      totalProfitMad: totalRevenueMad - totalCostMad,
    };
  }, [filteredInvoices]);

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

      const pKey = inv.paymentMethod || 'cash';
      const pEntry = byPayment.get(pKey) || { count: 0, units: 0, revenueMad: 0 };
      pEntry.count += 1;
      pEntry.units += invUnits;
      pEntry.revenueMad += invRev;
      byPayment.set(pKey, pEntry);

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

  const prevIsOpenRef = useRef(false);

  useEffect(() => {
    const justOpened = isOpen && !prevIsOpenRef.current;
    prevIsOpenRef.current = isOpen;
    if (!justOpened) return;

    setErrorMsg('');
    if (availableProducts.length > 0) {
      const first = availableProducts[0];
      setSelectedProductId(first.id);
      setUnitPriceDisplay(String(convertFromMad(first.sellingPrice, currency)));
    } else {
      setSelectedProductId('');
      setUnitPriceDisplay('');
    }
    setQuantity('1');
    setCartItems([]);
    setCustomerId('');
    setCustomerName('');
    setCustomerPhone('');
    setPaymentMethod('cash');
    setSaleDate(new Date().toISOString().slice(0, 10));
    setNotes('');
    setProductSearchInput('');
    setCustomerSearchInput('');
  }, [isOpen, availableProducts, currency]);

  const filteredAvailableProducts = useMemo(() => {
    const q = productSearchInput.trim().toLowerCase();
    if (!q) return availableProducts;
    return availableProducts.filter(
      (p) =>
        p.code.toLowerCase().includes(q) ||
        (p.qrToken || '').toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q)
    );
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

  if (!isOpen) return null;

  const selectedProduct = availableProducts.find((p) => p.id === selectedProductId);

  const handleSelectProduct = (id: string) => {
    setSelectedProductId(id);
    const prod = availableProducts.find((p) => p.id === id);
    if (prod) {
      setUnitPriceDisplay(String(convertFromMad(prod.sellingPrice, currency)));
      setQuantity('1');
    } else {
      setUnitPriceDisplay('');
    }
  };

  const handleProductSearchChange = (val: string) => {
    setProductSearchInput(val);
    const q = val.trim().toLowerCase();
    if (!q) {
      if (availableProducts.length > 0 && !availableProducts.some((p) => p.id === selectedProductId)) {
        handleSelectProduct(availableProducts[0].id);
      }
      return;
    }
    const exact = availableProducts.find(
      (p) => p.code.toLowerCase() === q || (p.qrToken || '').toLowerCase() === q
    );
    if (exact) {
      handleSelectProduct(exact.id);
      return;
    }
    const matches = availableProducts.filter(
      (p) =>
        p.code.toLowerCase().includes(q) ||
        (p.qrToken || '').toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q)
    );
    if (matches.length === 0) {
      handleSelectProduct('');
    } else if (!matches.some((p) => p.id === selectedProductId)) {
      handleSelectProduct(matches[0].id);
    }
  };

  const handleSelectCustomer = (id: string) => {
    setCustomerId(id);
    if (!id) {
      setCustomerName('');
      setCustomerPhone('');
      return;
    }
    const cust = customers.find((c) => c.id === id);
    if (cust) {
      setCustomerName(cust.name);
      setCustomerPhone(cust.phone);
    }
  };

  const handleCustomerSearchChange = (val: string) => {
    setCustomerSearchInput(val);
    const q = val.trim().toLowerCase();
    if (!q) return;
    const exact = customers.find((c) => c.code.toLowerCase() === q);
    if (exact) {
      handleSelectCustomer(exact.id);
      return;
    }
    const matches = customers.filter(
      (c) =>
        c.code.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        (c.phone || '').toLowerCase().includes(q)
    );
    if (matches.length === 0) {
      handleSelectCustomer('');
    } else if (matches.length === 1) {
      handleSelectCustomer(matches[0].id);
    } else if (customerId && !matches.some((c) => c.id === customerId)) {
      handleSelectCustomer(matches[0].id);
    }
  };

  const handleAddToCart = () => {
    if (!selectedProduct) return;
    setErrorMsg('');
    const maxQty = Math.max(1, Number(selectedProduct.quantity) || 1);
    const addQty = Math.max(1, Math.floor(Number(quantity) || 1));
    const unitPriceNum =
      unitPriceDisplay.trim() !== ''
        ? Math.max(0, Number(unitPriceDisplay) || 0)
        : convertFromMad(selectedProduct.sellingPrice, currency);

    setCartItems((prev) => {
      const idx = prev.findIndex((item) => item.productId === selectedProduct.id);
      if (idx >= 0) {
        const next = [...prev];
        const mergedQty = Math.min(maxQty, next[idx].quantity + addQty);
        next[idx] = {
          ...next[idx],
          quantity: mergedQty,
          unitPriceDisplay: unitPriceNum,
        };
        return next;
      }
      return [
        ...prev,
        {
          productId: selectedProduct.id,
          productCode: selectedProduct.code,
          productName: selectedProduct.name,
          availableQty: maxQty,
          quantity: Math.min(maxQty, addQty),
          unitPriceDisplay: unitPriceNum,
        },
      ];
    });
    setQuantity('1');
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
        item.productId === productId ? { ...item, unitPriceDisplay: Math.max(0, newPrice || 0) } : item
      )
    );
  };

  const handleRemoveCartItem = (productId: string) => {
    setCartItems((prev) => prev.filter((item) => item.productId !== productId));
  };

  const handleSubmitSale = async (e: React.FormEvent) => {
    e.preventDefault();
    let targetItems = cartItems;
    if (targetItems.length === 0) {
      if (!selectedProduct) {
        setErrorMsg(t.posCartValidationEmpty);
        return;
      }
      const maxQty = Math.max(1, Number(selectedProduct.quantity) || 1);
      const qty = Math.min(maxQty, Math.max(1, Math.floor(Number(quantity) || 1)));
      const priceDisp =
        unitPriceDisplay.trim() !== ''
          ? Math.max(0, Number(unitPriceDisplay) || 0)
          : convertFromMad(selectedProduct.sellingPrice, currency);
      targetItems = [
        {
          productId: selectedProduct.id,
          productCode: selectedProduct.code,
          productName: selectedProduct.name,
          availableQty: maxQty,
          quantity: qty,
          unitPriceDisplay: priceDisp,
        },
      ];
    }

    setSubmitting(true);
    setErrorMsg('');
    try {
      const payloadItems = targetItems.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: convertToMad(item.unitPriceDisplay, currency),
      }));
      const created = await onCreateSale({
        items: payloadItems,
        productId: payloadItems[0].productId,
        quantity: payloadItems[0].quantity,
        unitPrice: payloadItems[0].unitPrice,
        customerId: customerId || undefined,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        paymentMethod,
        saleDate: saleDate || new Date().toISOString().slice(0, 10),
        notes: notes.trim(),
        source: 'pos_manual',
      });
      if (created) {
        setShowNewSale(false);
        setCartItems([]);
        setNotes('');
        setProductSearchInput('');
        setCustomerSearchInput('');
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

  const cartGrandTotalDisplay = cartItems.reduce(
    (sum, item) => sum + item.quantity * item.unitPriceDisplay,
    0
  );

  const paymentLabel = (method: string) => {
    if (method === 'transfer') return t.paymentTransfer;
    if (method === 'check') return t.paymentCheck;
    if (method === 'card') return t.paymentCard;
    if (method === 'other') return t.paymentOther;
    return t.paymentCash;
  };

  const inputClass =
    'min-h-[44px] w-full rounded-xl border border-[#DCE7E0] bg-[#F7FAF8] px-3.5 py-2 text-sm text-[#0B1F16] placeholder:text-[#6B8A79] focus:border-[#115E3B] focus:bg-white focus:outline-none dark:border-[#1E3A2D] dark:bg-[#091611] dark:text-[#F2F9F5] dark:placeholder:text-[#8FB39E] dark:focus:border-[#10B981] dark:focus:bg-[#0D1E16]';

  return (
    <div
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/55 p-0 backdrop-blur-xs sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[94dvh] w-full max-w-5xl flex-col overflow-hidden rounded-t-3xl border border-[#DCE7E0] bg-white shadow-xl sm:rounded-3xl dark:border-[#1E3A2D] dark:bg-[#0F2119]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#DCE7E0] px-5 py-4 dark:border-[#1E3A2D]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#ECF7F1] text-[#115E3B] dark:bg-[#132B20] dark:text-[#34D399]">
              <Receipt className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate font-display text-lg font-bold text-[#0B1F16] sm:text-xl dark:text-[#F2F9F5]">
                {t.posTitle}
              </h2>
              <p className="truncate text-xs text-[#335947] dark:text-[#9EC0AE]">{t.posSubtitle}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={t.close}
            className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl text-[#335947] hover:bg-[#ECF7F1] dark:text-[#9EC0AE] dark:hover:bg-[#162E23]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 space-y-5 overflow-y-auto p-5">
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

          {/* Toolbar: Search + Filters + Report Toggle + Print + Excel Export + New Sale */}
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
                {showReport ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
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

              <button
                type="button"
                onClick={() => setShowNewSale((v) => !v)}
                className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl bg-[#115E3B] px-4 text-sm font-semibold text-white hover:bg-[#0D4A2E] whitespace-nowrap shrink-0 sm:flex-initial dark:bg-[#10B981] dark:text-[#052E1C]"
              >
                <Plus className="h-4 w-4" />
                <span>{t.posNewSale}</span>
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
                            {formatNumber(data.count, lang)} · {formatNumber(data.units, lang)} {t.articlesUnit}
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

          {/* Multi-Product New POS Sale Form */}
          {showNewSale && (
            <form
              onSubmit={handleSubmitSale}
              className="space-y-4 rounded-2xl border border-[#115E3B]/30 bg-[#ECF7F1]/50 p-4 dark:border-[#10B981]/30 dark:bg-[#132B20]/40"
            >
              <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-sm font-bold text-[#0B1F16] dark:text-[#F2F9F5]">
                  <ShoppingBag className="h-4 w-4 text-[#115E3B] dark:text-[#34D399]" />
                  <span>{t.posNewSale}</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setShowNewSale(false)}
                  className="text-xs font-semibold text-[#335947] hover:underline dark:text-[#9EC0AE]"
                >
                  {t.cancel}
                </button>
              </div>

              {errorMsg && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
                  {errorMsg}
                </div>
              )}

              {availableProducts.length === 0 ? (
                <p className="text-xs font-medium text-[#335947] dark:text-[#9EC0AE]">
                  {t.qrScannerOutOfStock}
                </p>
              ) : (
                <>
                  {/* Product Picker Row + Add to Invoice Cart */}
                  <div className="rounded-2xl border border-[#DCE7E0] bg-white p-3.5 space-y-3 dark:border-[#1E3A2D] dark:bg-[#091611]">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-12 sm:items-end">
                      <div className="sm:col-span-6">
                        <label className="mb-1 block text-xs font-semibold text-[#335947] dark:text-[#9EC0AE]">
                          {t.posSelectProduct}
                        </label>
                        <div className="space-y-2">
                          <div className="relative">
                            <Search
                              className={`pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-[#335947] dark:text-[#9EC0AE] ${
                                lang === 'ar' ? 'right-3.5' : 'left-3.5'
                              }`}
                            />
                            <input
                              type="text"
                              value={productSearchInput}
                              onChange={(e) => handleProductSearchChange(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') e.preventDefault();
                              }}
                              placeholder={t.posProductCodeSearchPlaceholder}
                              className={`${inputClass} ${
                                lang === 'ar' ? 'pl-9 pr-10' : 'pl-10 pr-9'
                              }`}
                            />
                            {productSearchInput && (
                              <button
                                type="button"
                                onClick={() => handleProductSearchChange('')}
                                aria-label={t.clearSearch}
                                className={`absolute top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-[#335947] hover:bg-[#ECF7F1] dark:text-[#9EC0AE] dark:hover:bg-[#162E23] ${
                                  lang === 'ar' ? 'left-2' : 'right-2'
                                }`}
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                          <select
                            value={
                              filteredAvailableProducts.some((p) => p.id === selectedProductId)
                                ? selectedProductId
                                : filteredAvailableProducts[0]?.id || ''
                            }
                            onChange={(e) => handleSelectProduct(e.target.value)}
                            className={inputClass}
                          >
                            {filteredAvailableProducts.length === 0 ? (
                              <option value="">{t.posNoMatchingProduct}</option>
                            ) : (
                              filteredAvailableProducts.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.code} — {p.name} ({p.quantity})
                                  {p.warehouseName ? ` · ${p.warehouseName}` : ''}
                                </option>
                              ))
                            )}
                          </select>
                        </div>
                      </div>

                      <div className="sm:col-span-2">
                        <label className="mb-1 block text-xs font-semibold text-[#335947] dark:text-[#9EC0AE]">
                          {t.purchaseQuantityLabel}
                        </label>
                        <input
                          type="number"
                          min="1"
                          max={selectedProduct?.quantity || 1}
                          value={quantity}
                          onChange={(e) => setQuantity(e.target.value)}
                          className={`${inputClass} tabular-nums`}
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="mb-1 block text-xs font-semibold text-[#335947] dark:text-[#9EC0AE]">
                          {t.purchaseUnitPriceLabel} ({currency})
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={unitPriceDisplay}
                          onChange={(e) => setUnitPriceDisplay(e.target.value)}
                          className={`${inputClass} tabular-nums`}
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <button
                          type="button"
                          onClick={handleAddToCart}
                          disabled={!selectedProduct}
                          className="flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl border border-[#115E3B] bg-[#ECF7F1] px-3 text-xs font-bold text-[#115E3B] hover:bg-[#DCF0E4] disabled:opacity-50 dark:border-[#10B981] dark:bg-[#132B20] dark:text-[#34D399]"
                        >
                          <Plus className="h-4 w-4 shrink-0" />
                          <span>{t.posCartAddItem}</span>
                        </button>
                      </div>
                    </div>

                    {/* Invoice Multi-Item Cart Table */}
                    <div className="rounded-xl border border-[#DCE7E0] bg-[#F7FAF8] p-3 dark:border-[#1E3A2D] dark:bg-[#0B1913]">
                      <div className="mb-2 flex items-center justify-between text-xs font-bold text-[#0B1F16] dark:text-[#F2F9F5]">
                        <span>
                          {t.posCartTitle} ({formatNumber(cartItems.length, lang)})
                        </span>
                        {cartItems.length > 0 && (
                          <span className="tabular-nums text-[#115E3B] dark:text-[#34D399]">
                            {t.posCartGrandTotal}: {formatNumber(cartGrandTotalDisplay, lang)} {currency}
                          </span>
                        )}
                      </div>

                      {cartItems.length === 0 ? (
                        <p className="text-[11px] text-[#335947] dark:text-[#9EC0AE]">
                          {t.posCartEmptyHint}
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {cartItems.map((item) => (
                            <div
                              key={item.productId}
                              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#DCE7E0] bg-white px-3 py-2 text-xs dark:border-[#1E3A2D] dark:bg-[#0F2119]"
                            >
                              <div className="min-w-0 flex-1">
                                <span className="font-mono-code font-bold text-[#115E3B] dark:text-[#34D399]">
                                  {item.productCode}
                                </span>{' '}
                                <span className="font-semibold text-[#0B1F16] dark:text-[#F2F9F5]">
                                  {item.productName}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  min="1"
                                  max={item.availableQty}
                                  value={item.quantity}
                                  onChange={(e) =>
                                    handleUpdateCartItemQty(item.productId, Number(e.target.value))
                                  }
                                  aria-label={t.purchaseQuantityLabel}
                                  className="tabular-nums h-9 w-16 rounded-lg border border-[#DCE7E0] bg-[#F7FAF8] px-2 text-center text-xs font-bold dark:border-[#1E3A2D] dark:bg-[#091611]"
                                />
                                <span className="text-[#6B8A79]">×</span>
                                <input
                                  type="number"
                                  min="0"
                                  step="any"
                                  value={item.unitPriceDisplay}
                                  onChange={(e) =>
                                    handleUpdateCartItemPrice(item.productId, Number(e.target.value))
                                  }
                                  aria-label={t.purchaseUnitPriceLabel}
                                  className="tabular-nums h-9 w-24 rounded-lg border border-[#DCE7E0] bg-[#F7FAF8] px-2 text-end text-xs font-semibold dark:border-[#1E3A2D] dark:bg-[#091611]"
                                />
                                <span className="tabular-nums min-w-[70px] text-end font-bold text-[#115E3B] dark:text-[#34D399]">
                                  {formatNumber(item.quantity * item.unitPriceDisplay, lang)} {currency}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveCartItem(item.productId)}
                                  title={t.posCartRemoveItem}
                                  aria-label={t.posCartRemoveItem}
                                  className="flex h-8 w-8 items-center justify-center rounded-lg text-red-600 hover:bg-red-50 dark:text-red-400"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Customer, Payment, Date & Notes */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="sm:col-span-2">
                      <label className="mb-1 block text-xs font-semibold text-[#335947] dark:text-[#9EC0AE]">
                        {t.posSelectCustomer}
                      </label>
                      <div className="space-y-2">
                        <div className="relative">
                          <Search
                            className={`pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-[#335947] dark:text-[#9EC0AE] ${
                              lang === 'ar' ? 'right-3.5' : 'left-3.5'
                            }`}
                          />
                          <input
                            type="text"
                            value={customerSearchInput}
                            onChange={(e) => handleCustomerSearchChange(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') e.preventDefault();
                            }}
                            placeholder={t.posCustomerCodeSearchPlaceholder}
                            className={`${inputClass} ${
                              lang === 'ar' ? 'pl-9 pr-10' : 'pl-10 pr-9'
                            }`}
                          />
                          {customerSearchInput && (
                            <button
                              type="button"
                              onClick={() => handleCustomerSearchChange('')}
                              aria-label={t.clearSearch}
                              className={`absolute top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-[#335947] hover:bg-[#ECF7F1] dark:text-[#9EC0AE] dark:hover:bg-[#162E23] ${
                                lang === 'ar' ? 'left-2' : 'right-2'
                              }`}
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                        <select
                          value={customerId}
                          onChange={(e) => handleSelectCustomer(e.target.value)}
                          className={inputClass}
                        >
                          <option value="">{t.posWalkInCustomer}</option>
                          {filteredCustomers.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.code} — {c.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-[#335947] dark:text-[#9EC0AE]">
                          {t.purchasePaymentLabel}
                        </label>
                        <select
                          value={paymentMethod}
                          onChange={(e) => setPaymentMethod(e.target.value as PurchasePaymentMethod)}
                          className={inputClass}
                        >
                          <option value="cash">{t.paymentCash}</option>
                          <option value="transfer">{t.paymentTransfer}</option>
                          <option value="card">{t.paymentCard}</option>
                          <option value="check">{t.paymentCheck}</option>
                          <option value="other">{t.paymentOther}</option>
                        </select>
                      </div>
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
                    </div>

                    {!customerId && (
                      <>
                        <div>
                          <label className="mb-1 block text-xs font-semibold text-[#335947] dark:text-[#9EC0AE]">
                            {t.customerNameLabel}
                          </label>
                          <input
                            type="text"
                            value={customerName}
                            onChange={(e) => setCustomerName(e.target.value)}
                            placeholder={t.posCustomerNamePlaceholder}
                            className={inputClass}
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-semibold text-[#335947] dark:text-[#9EC0AE]">
                            {t.customerPhoneLabel}
                          </label>
                          <input
                            type="tel"
                            value={customerPhone}
                            onChange={(e) => setCustomerPhone(e.target.value)}
                            placeholder={t.posCustomerPhonePlaceholder}
                            className={inputClass}
                          />
                        </div>
                      </>
                    )}

                    <div className={!customerId ? 'sm:col-span-1' : 'sm:col-span-3'}>
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

                  <button
                    type="submit"
                    disabled={submitting || (cartItems.length === 0 && !selectedProduct)}
                    className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[#115E3B] px-5 text-sm font-semibold text-white hover:bg-[#0D4A2E] disabled:opacity-60 dark:bg-[#10B981] dark:text-[#052E1C]"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    <span>
                      {submitting
                        ? t.saving
                        : cartItems.length > 0
                        ? `${t.posConfirmSale} (${formatNumber(cartGrandTotalDisplay, lang)} ${currency})`
                        : t.posConfirmSale}
                    </span>
                  </button>
                </>
              )}
            </form>
          )}

          {/* Invoices List */}
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
                return (
                  <div
                    key={inv.id}
                    className="flex flex-col justify-between gap-3 rounded-2xl border border-[#DCE7E0] bg-white p-4 sm:flex-row sm:items-center dark:border-[#1E3A2D] dark:bg-[#091611]"
                  >
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                        <span className="font-mono-code text-sm font-bold text-[#115E3B] dark:text-[#34D399]">
                          {inv.invoiceNumber}
                        </span>
                        <span aria-hidden="true" className="text-[#6B8A79]">·</span>
                        <span className="tabular-nums text-xs text-[#335947] dark:text-[#9EC0AE]">
                          {inv.saleDate}
                        </span>
                        <span aria-hidden="true" className="text-[#6B8A79]">·</span>
                        <span
                          className={`text-[11px] font-bold ${
                            isCopy
                              ? 'text-amber-700 dark:text-amber-300'
                              : 'text-[#115E3B] dark:text-[#34D399]'
                          }`}
                        >
                          {isCopy
                            ? `${t.invoiceCopyBadge} (${inv.printCount})`
                            : t.invoiceOriginalBadge}
                        </span>
                      </div>

                      {/* Multi-product line items */}
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
                              ({formatNumber(li.quantity, lang)} × {formatCurrency(li.unitPrice, currency, lang)})
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
                        <span>{paymentLabel(inv.paymentMethod)}</span>
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
                        <button
                          type="button"
                          onClick={() => onOpenProductDigitalFile(items[0]?.productId || inv.productId)}
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
                            const blob = await buildInvoiceReceiptBlob(inv, storeName, currency, lang, {
                              isCopy,
                            });
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
        </div>
      </div>
    </div>
  );
}
