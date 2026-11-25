import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRightLeft,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Edit3,
  FileSpreadsheet,
  Image as ImageIcon,
  Package,
  Play,
  Plus,
  Printer,
  QrCode,
  Receipt,
  RotateCcw,
  Search,
  Share2,
  Trash2,
  Truck,
  Upload,
  UserPlus,
  Users,
  Video,
  Warehouse as WarehouseIcon,
  X,
} from 'lucide-react';
import type {
  Customer,
  CustomerCategory,
  CustomerGalleryPayload,
  CustomerPayload,
  CustomerPurchasePayload,
  CustomerSummary,
  ExcelImportMode,
  InventoryAdjustment,
  InventoryAdjustmentPayload,
  InventorySummary,
  Language,
  MetaAuthStatus,
  PosInvoice,
  PosSalePayload,
  Product,
  ProductDigitalFile,
  ProductPayload,
  ReportFilters,
  ShopSettings,
  Supplier,
  SupplierCategory,
  SupplierGalleryPayload,
  SupplierPayload,
  SupplierPurchasePayload,
  SupplierSummary,
  Warehouse,
  WarehousePayload,
} from './types';
import { formatCurrency, formatNumber, translations } from './i18n';
import {
  buildCustomersExcelBlob,
  buildExcelBlob,
  buildStockPurchasesExcelBlob,
  buildSuppliersExcelBlob,
} from './utils/excel';
import {
  createAdjustmentApi,
  createPosSaleApi,
  deleteAdjustmentApi,
  deleteCustomerApi,
  deleteCustomerGalleryImageApi,
  deleteCustomerPurchaseApi,
  deletePosSaleApi,
  deleteProductApi,
  deleteSupplierApi,
  deleteSupplierGalleryImageApi,
  deleteSupplierPurchaseApi,
  deleteWarehouseApi,
  fetchAdjustmentsApi,
  fetchCustomersApi,
  fetchExchangeRatesApi,
  fetchMetaAuthStatusApi,
  fetchPosSalesApi,
  fetchProductDigitalFileApi,
  fetchProductsApi,
  fetchSettingsApi,
  fetchSuppliersApi,
  fetchWarehousesApi,
  importProductsExcelApi,
  lookupProductByQrApi,
  markInvoicePrintedApi,
  saveCustomerApi,
  saveCustomerGalleryImagesApi,
  saveCustomerPurchaseApi,
  saveProductApi,
  saveSettingsApi,
  saveSupplierApi,
  saveSupplierGalleryImagesApi,
  saveSupplierPurchaseApi,
  saveWarehouseApi,
} from './utils/api';
import { saveOrShareBlob } from './utils/download';
import { isVideoMedia } from './utils/image';
import { extractQrParamFromLocation, extractSnapshotExtrasFromQrInput } from './utils/qr';
import { buildReportSpec, executeReportOutput } from './utils/printReports';
import { Header } from './components/Header';
import { ProductFormModal } from './components/ProductFormModal';
import { ProductDetailSheet } from './components/ProductDetailSheet';
import { ShareModal } from './components/ShareModal';
import { LogoModal } from './components/LogoModal';
import { InitialSetupModal } from './components/InitialSetupModal';
import { GuideModal } from './components/GuideModal';
import { CustomersView } from './components/CustomersView';
import { CustomerFormModal } from './components/CustomerFormModal';
import { CustomerDetailModal } from './components/CustomerDetailModal';
import { SuppliersView } from './components/SuppliersView';
import { SupplierFormModal } from './components/SupplierFormModal';
import { SupplierDetailModal } from './components/SupplierDetailModal';
import { WarehousesModal } from './components/WarehousesModal';
import { InventoryAdjustmentModal } from './components/InventoryAdjustmentModal';
import { ReportsPrintModal } from './components/ReportsPrintModal';
import { CalculatorModal } from './components/CalculatorModal';
import { QrScannerModal, type QrScanMode } from './components/QrScannerModal';
import { ProductDigitalFileModal } from './components/ProductDigitalFileModal';
import { QrCodeDisplayModal } from './components/QrCodeDisplayModal';
import { PosSalesModal } from './components/PosSalesModal';
import { ImportProductsExcelModal } from './components/ImportProductsExcelModal';

export default function App() {
  const [lang, setLang] = useState<Language>(() => {
    const saved = localStorage.getItem('babsaida_lang');
    return saved === 'ar' ? 'ar' : 'fr';
  });

  const [isDark, setIsDark] = useState<boolean>(() => {
    const saved = localStorage.getItem('babsaida_theme');
    return saved === 'dark';
  });

  const [products, setProducts] = useState<Product[]>([]);
  const [summary, setSummary] = useState<InventorySummary>({
    totalReferences: 0,
    totalUnits: 0,
    totalSellingValue: 0,
    totalReferenceCost: 0,
  });
  const [settings, setSettings] = useState<ShopSettings>({
    customLogo: '',
    storeName: '',
    currency: 'MAD',
    facebookHandle: '',
    instagramHandle: '',
    whatsappPhone: '',
    printerMode: 'pdf_system',
    printerPaper: 'a4',
    printerName: '',
    printerLinked: false,
    publicAppUrl: '',
  });
  const [metaStatus, setMetaStatus] = useState<MetaAuthStatus>({
    configured: false,
    callbackUrl: `${typeof window !== 'undefined' ? window.location.origin : ''}/auth/meta/callback`,
    connected: false,
    pages: [],
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [inventoryFilter, setInventoryFilter] = useState<'in_stock' | 'sold' | 'all'>('in_stock');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedColor, setSelectedColor] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);
  const [shareProduct, setShareProduct] = useState<Product | null>(null);
  const [qrCodeProduct, setQrCodeProduct] = useState<Product | null>(null);
  const [qrScannerOpen, setQrScannerOpen] = useState(false);
  const [qrScannerInitialMode, setQrScannerInitialMode] = useState<QrScanMode>('view');
  const [qrScannerClientOnly, setQrScannerClientOnly] = useState(false);
  const [qrScannerLockedCustomer, setQrScannerLockedCustomer] = useState<Customer | null>(null);
  const [importExcelOpen, setImportExcelOpen] = useState(false);
  const [digitalFileData, setDigitalFileData] = useState<ProductDigitalFile | null>(null);
  const [digitalFileView, setDigitalFileView] = useState<'client' | 'management'>('client');
  const [digitalFileLockedClient, setDigitalFileLockedClient] = useState(false);
  const [clientPortalMode, setClientPortalMode] = useState<boolean>(() => {
    return (
      typeof window !== 'undefined' &&
      Boolean(extractQrParamFromLocation(window.location).qrCode)
    );
  });
  const [qrSnapshotExtras, setQrSnapshotExtras] = useState<{
    storeName?: string;
    whatsappPhone?: string;
  }>({});
  const [showStockPurchasesReport, setShowStockPurchasesReport] = useState(false);
  const [exportingStockPurchases, setExportingStockPurchases] = useState(false);
  const [posModalOpen, setPosModalOpen] = useState(false);
  const [posInvoices, setPosInvoices] = useState<PosInvoice[]>([]);
  const [posSummary, setPosSummary] = useState({
    totalInvoices: 0,
    totalUnitsSold: 0,
    totalRevenueMad: 0,
    totalProfitMad: 0,
  });
  const [logoModalOpen, setLogoModalOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const [setupOpen, setSetupOpen] = useState<boolean>(() => {
    const hasQrParam =
      typeof window !== 'undefined' &&
      Boolean(extractQrParamFromLocation(window.location).qrCode);
    if (hasQrParam) return false;
    return localStorage.getItem('babsaida_onboarding_done') !== '1';
  });
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [, setRatesVersion] = useState(0);
  const [toastMessage, setToastMessage] = useState('');
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Module Navigation & Customers / Suppliers / Warehouses / Adjustments / Reports state
  const [activeTab, setActiveTab] = useState<'inventory' | 'customers' | 'suppliers'>('inventory');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerSummary, setCustomerSummary] = useState<CustomerSummary>({
    totalCustomers: 0,
    totalPurchases: 0,
    totalRevenueMad: 0,
  });
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerCategory, setCustomerCategory] = useState<'all' | CustomerCategory>('all');
  const [customersLoading, setCustomersLoading] = useState(true);
  const [customerFormOpen, setCustomerFormOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [detailCustomer, setDetailCustomer] = useState<Customer | null>(null);
  const [detailStartAddPurchase, setDetailStartAddPurchase] = useState(false);
  const [detailInitialTab, setDetailInitialTab] = useState<'purchases' | 'gallery'>('purchases');
  const [exportingCustomers, setExportingCustomers] = useState(false);

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehousesModalOpen, setWarehousesModalOpen] = useState(false);

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierSummary, setSupplierSummary] = useState<SupplierSummary>({
    totalSuppliers: 0,
    totalPurchases: 0,
    totalSpentMad: 0,
  });
  const [supplierSearch, setSupplierSearch] = useState('');
  const [supplierCategory, setSupplierCategory] = useState<'all' | SupplierCategory>('all');
  const [suppliersLoading, setSuppliersLoading] = useState(true);
  const [supplierFormOpen, setSupplierFormOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [detailSupplier, setDetailSupplier] = useState<Supplier | null>(null);
  const [detailSupStartAdd, setDetailSupStartAdd] = useState(false);
  const [detailSupInitialTab, setDetailSupInitialTab] = useState<'purchases' | 'gallery'>('purchases');
  const [exportingSuppliers, setExportingSuppliers] = useState(false);

  const [adjustments, setAdjustments] = useState<InventoryAdjustment[]>([]);
  const [adjustmentsModalOpen, setAdjustmentsModalOpen] = useState(false);

  const [reportsModalOpen, setReportsModalOpen] = useState(false);
  const [reportsInitialFilters, setReportsInitialFilters] = useState<Partial<ReportFilters>>({
    reportType: 'inventory',
  });

  const showToast = useCallback((message: string) => {
    if (!message) return;
    setToastMessage(message);
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = setTimeout(() => {
      setToastMessage('');
    }, 5500);
  }, []);

  const linkedAccountLabel = (() => {
    if (metaStatus.connected) {
      const activePage =
        metaStatus.pages.find((p) => p.id === metaStatus.selectedPageId) || metaStatus.pages[0];
      const igList = metaStatus.pages.filter((p) => p.igAccount).map((p) => p.igAccount!);
      const activeIg = igList.find((ig) => ig.id === metaStatus.selectedIgId) || igList[0];
      if (activeIg?.username) return `@${activeIg.username}`;
      if (activePage?.name) return activePage.name;
      if (metaStatus.userName) return metaStatus.userName;
    }
    const handles = [settings.instagramHandle?.trim(), settings.facebookHandle?.trim()].filter(
      Boolean
    );
    return handles.join(' · ');
  })();

  const t = translations[lang];

  useEffect(() => {
    document.documentElement.lang = lang;
    localStorage.setItem('babsaida_lang', lang);
  }, [lang]);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('babsaida_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('babsaida_theme', 'light');
    }
  }, [isDark]);

  const fetchSettings = useCallback(async () => {
    try {
      const data = await fetchSettingsApi();
      setSettings(data);
    } catch {
      // keep defaults
    }
  }, []);

  const refreshMetaStatus = useCallback(async () => {
    try {
      const status = await fetchMetaAuthStatusApi();
      setMetaStatus(status);
    } catch {
      // keep default unlinked state
    }
  }, []);

  const fetchProducts = useCallback(
    async (query: string) => {
      try {
        const data = await fetchProductsApi(query);
        setProducts(data.products);
        setSummary(data.summary);
        setError('');
      } catch {
        setError(translations[lang].errorLoad);
      } finally {
        setLoading(false);
      }
    },
    [lang]
  );

  const fetchPosSales = useCallback(async () => {
    try {
      const data = await fetchPosSalesApi();
      setPosInvoices(data.invoices);
      setPosSummary(data.summary);
    } catch {
      // keep existing invoices
    }
  }, []);

  const fetchWarehouses = useCallback(async () => {
    try {
      const data = await fetchWarehousesApi();
      setWarehouses(data.warehouses);
    } catch {
      // keep current warehouses
    }
  }, []);

  const fetchAdjustments = useCallback(async () => {
    try {
      const data = await fetchAdjustmentsApi();
      setAdjustments(data.adjustments);
    } catch {
      // keep current adjustments
    }
  }, []);

  const qrHandledOnMountRef = useRef(false);

  useEffect(() => {
    void fetchSettings();
    void refreshMetaStatus();
    void fetchPosSales();
    void fetchWarehouses();
    void fetchAdjustments();
    void fetchExchangeRatesApi().then(() => setRatesVersion((v) => v + 1));
  }, [fetchSettings, refreshMetaStatus, fetchPosSales, fetchWarehouses, fetchAdjustments]);

  useEffect(() => {
    if (qrHandledOnMountRef.current) return;
    const { qrCode } = extractQrParamFromLocation(window.location);
    if (!qrCode) return;

    qrHandledOnMountRef.current = true;
    setClientPortalMode(true);
    const fullHref = window.location.href;
    const snapExtras = extractSnapshotExtrasFromQrInput(fullHref);
    if (snapExtras.storeName || snapExtras.whatsappPhone) {
      setQrSnapshotExtras(snapExtras);
    }
    void lookupProductByQrApi(fullHref, true)
      .then((file) => {
        setDigitalFileLockedClient(true);
        setDigitalFileView('client');
        setDigitalFileData(file);
      })
      .catch(() => {
        showToast(translations[lang].qrScannerNotFound);
      });
  }, [lang, showToast]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchProducts(searchQuery);
    }, 150);
    return () => clearTimeout(timer);
  }, [searchQuery, fetchProducts]);

  const fetchCustomers = useCallback(
    async (query: string, category: 'all' | CustomerCategory) => {
      try {
        const data = await fetchCustomersApi(query, category);
        setCustomers(data.customers);
        setCustomerSummary(data.summary);
        setDetailCustomer((prev) =>
          prev ? data.customers.find((c) => c.id === prev.id) || prev : null
        );
      } catch {
        // keep current customers
      } finally {
        setCustomersLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchCustomers(customerSearch, customerCategory);
    }, 150);
    return () => clearTimeout(timer);
  }, [customerSearch, customerCategory, fetchCustomers]);

  const fetchSuppliers = useCallback(
    async (query: string, category: 'all' | SupplierCategory) => {
      try {
        const data = await fetchSuppliersApi(query, category);
        setSuppliers(data.suppliers);
        setSupplierSummary(data.summary);
        setDetailSupplier((prev) =>
          prev ? data.suppliers.find((s) => s.id === prev.id) || prev : null
        );
      } catch {
        // keep current suppliers
      } finally {
        setSuppliersLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchSuppliers(supplierSearch, supplierCategory);
    }, 150);
    return () => clearTimeout(timer);
  }, [supplierSearch, supplierCategory, fetchSuppliers]);

  const handleSaveWarehouse = async (payload: WarehousePayload, editingId?: string) => {
    await saveWarehouseApi(payload, editingId);
    showToast(t.warehouseSavedToast);
    await Promise.all([fetchWarehouses(), fetchProducts(searchQuery)]);
  };

  const handleDeleteWarehouse = async (warehouseId: string) => {
    await deleteWarehouseApi(warehouseId);
    showToast(t.warehouseDeletedToast);
    await Promise.all([fetchWarehouses(), fetchProducts(searchQuery)]);
  };

  const handleSaveSupplier = async (payload: SupplierPayload, editingId?: string) => {
    const saved = await saveSupplierApi(payload, editingId);
    if (detailSupplier?.id === saved.id) {
      setDetailSupplier(saved);
    }
    showToast(t.supplierSavedToast);
    await fetchSuppliers(supplierSearch, supplierCategory);
  };

  const handleDeleteSupplier = async (supplierId: string) => {
    await deleteSupplierApi(supplierId);
    if (detailSupplier?.id === supplierId) {
      setDetailSupplier(null);
    }
    showToast(t.supplierDeletedToast);
    await fetchSuppliers(supplierSearch, supplierCategory);
  };

  const handleSaveSupplierPurchase = async (
    supplierId: string,
    payload: SupplierPurchasePayload,
    editingPurchaseId?: string
  ) => {
    const updated = await saveSupplierPurchaseApi(supplierId, payload, editingPurchaseId);
    setDetailSupplier(updated);
    showToast(t.supplierPurchaseSavedToast);
    await fetchSuppliers(supplierSearch, supplierCategory);
  };

  const handleDeleteSupplierPurchase = async (supplierId: string, purchaseId: string) => {
    const updated = await deleteSupplierPurchaseApi(supplierId, purchaseId);
    setDetailSupplier(updated);
    await fetchSuppliers(supplierSearch, supplierCategory);
  };

  const handleSaveSupplierGalleryImages = async (
    supplierId: string,
    items: SupplierGalleryPayload[]
  ) => {
    const { supplier: updated } = await saveSupplierGalleryImagesApi(supplierId, items);
    setDetailSupplier(updated);
    showToast(t.supplierGallerySavedToast);
    await fetchSuppliers(supplierSearch, supplierCategory);
  };

  const handleDeleteSupplierGalleryImage = async (supplierId: string, imageId: string) => {
    const updated = await deleteSupplierGalleryImageApi(supplierId, imageId);
    setDetailSupplier(updated);
    await fetchSuppliers(supplierSearch, supplierCategory);
  };

  const handleExportSuppliersExcel = async (singleSupplier?: Supplier) => {
    if (exportingSuppliers) return;
    setExportingSuppliers(true);
    try {
      const dateStamp = new Date().toISOString().slice(0, 10);
      const label = singleSupplier ? singleSupplier.code.toLowerCase() : 'tous';
      const filename = `fournisseurs-approvisionnements-${label}-${dateStamp}.xlsx`;
      let targetList: Supplier[];
      if (singleSupplier) {
        targetList = [singleSupplier];
      } else if (supplierSearch.trim() || supplierCategory !== 'all') {
        try {
          const full = await fetchSuppliersApi('', 'all');
          targetList = full.suppliers;
        } catch {
          targetList = suppliers;
        }
      } else {
        targetList = suppliers;
      }
      const xlsxBlob = buildSuppliersExcelBlob(targetList, settings.currency, lang);
      await saveOrShareBlob(
        xlsxBlob,
        filename,
        singleSupplier ? `${singleSupplier.code} — ${singleSupplier.name}` : t.supplierExportExcel
      );
    } finally {
      setExportingSuppliers(false);
    }
  };

  const handleCreateAdjustment = async (payload: InventoryAdjustmentPayload) => {
    await createAdjustmentApi(payload);
    showToast(t.adjustmentSavedToast);
    await Promise.all([fetchAdjustments(), fetchProducts(searchQuery), fetchWarehouses()]);
  };

  const handleDeleteAdjustment = async (adjustmentId: string) => {
    await deleteAdjustmentApi(adjustmentId);
    showToast(t.adjustmentDeletedToast);
    await Promise.all([fetchAdjustments(), fetchProducts(searchQuery)]);
  };

  const openReportsHub = useCallback((filters: Partial<ReportFilters>) => {
    setReportsInitialFilters({ ...filters });
    setReportsModalOpen(true);
  }, []);

  const handleMarkInvoicePrinted = useCallback(
    async (invoiceId: string) => {
      try {
        await markInvoicePrintedApi(invoiceId);
        await fetchPosSales();
      } catch {
        // ignore if already printed locally
      }
    },
    [fetchPosSales]
  );

  const handlePrintInvoice = useCallback(
    async (invoice: PosInvoice, isCopy: boolean) => {
      const spec = buildReportSpec(
        {
          reportType: 'invoice_single',
          invoiceId: invoice.id,
          isCopy,
        },
        {
          products,
          warehouses,
          customers,
          suppliers,
          invoices: posInvoices.some((i) => i.id === invoice.id)
            ? posInvoices
            : [invoice, ...posInvoices],
          adjustments,
          storeName: settings.storeName || qrSnapshotExtras.storeName || '',
          currency: settings.currency,
          lang,
        }
      );
      const outcome = await executeReportOutput({
        mode: 'print',
        spec,
        filename: `${invoice.invoiceNumber.toLowerCase()}${isCopy ? '-copie' : ''}.pdf`,
        lang,
      });
      await handleMarkInvoicePrinted(invoice.id);
      if (outcome === 'pdf_fallback') {
        showToast(t.reportPrintBlockedPdfToast);
      } else {
        showToast(`${t.invoicePrintedToast} ${invoice.invoiceNumber}`);
      }
    },
    [
      products,
      warehouses,
      customers,
      suppliers,
      posInvoices,
      adjustments,
      settings.storeName,
      settings.currency,
      qrSnapshotExtras.storeName,
      lang,
      handleMarkInvoicePrinted,
      showToast,
      t.reportPrintBlockedPdfToast,
      t.invoicePrintedToast,
    ]
  );

  const handleSaveCustomer = async (payload: CustomerPayload, editingId?: string) => {
    const saved = await saveCustomerApi(payload, editingId);
    if (detailCustomer?.id === saved.id) {
      setDetailCustomer(saved);
    }
    showToast(t.customerSavedToast);
    await fetchCustomers(customerSearch, customerCategory);
  };

  const handleDeleteCustomer = async (customerId: string) => {
    await deleteCustomerApi(customerId);
    if (detailCustomer?.id === customerId) {
      setDetailCustomer(null);
    }
    await fetchCustomers(customerSearch, customerCategory);
  };

  const handleSavePurchase = async (
    customerId: string,
    payload: CustomerPurchasePayload,
    editingPurchaseId?: string
  ) => {
    const updatedCustomer = await saveCustomerPurchaseApi(
      customerId,
      payload,
      editingPurchaseId
    );
    setDetailCustomer(updatedCustomer);
    showToast(t.purchaseSavedToast);
    await fetchCustomers(customerSearch, customerCategory);
  };

  const handleDeletePurchase = async (customerId: string, purchaseId: string) => {
    const updatedCustomer = await deleteCustomerPurchaseApi(customerId, purchaseId);
    setDetailCustomer(updatedCustomer);
    await fetchCustomers(customerSearch, customerCategory);
  };

  const handleSaveGalleryImages = async (customerId: string, items: CustomerGalleryPayload[]) => {
    const snap =
      detailCustomer?.id === customerId
        ? detailCustomer
        : customers.find((c) => c.id === customerId);
    const { customer: updatedCustomer } = await saveCustomerGalleryImagesApi(
      customerId,
      items,
      snap
    );
    setDetailCustomer(updatedCustomer);
    showToast(t.customerGallerySavedToast);
    await fetchCustomers(customerSearch, customerCategory);
  };

  const handleDeleteGalleryImage = async (customerId: string, imageId: string) => {
    const updatedCustomer = await deleteCustomerGalleryImageApi(customerId, imageId);
    setDetailCustomer(updatedCustomer);
    await fetchCustomers(customerSearch, customerCategory);
  };

  const handleExportCustomersExcel = async (singleCustomer?: Customer) => {
    if (exportingCustomers) return;
    setExportingCustomers(true);
    try {
      const dateStamp = new Date().toISOString().slice(0, 10);
      const label = singleCustomer ? singleCustomer.code.toLowerCase() : 'tous';
      const filename = `clients-achats-${label}-${dateStamp}.xlsx`;
      let xlsxBlob: Blob | null = null;

      try {
        const params = new URLSearchParams({ lang });
        if (singleCustomer) params.set('customerId', singleCustomer.id);
        const res = await fetch(`/api/export/customers/excel?${params.toString()}`, {
          credentials: 'same-origin',
          cache: 'no-store',
        });
        if (res.ok) {
          const buf = await res.arrayBuffer();
          const bytes = new Uint8Array(buf);
          if (bytes.length > 100 && bytes[0] === 0x50 && bytes[1] === 0x4b) {
            xlsxBlob = new Blob([buf], {
              type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            });
          }
        }
      } catch {
        // Fallback to client-side XLSX generation
      }

      if (!xlsxBlob) {
        let targetList: Customer[];
        if (singleCustomer) {
          targetList = [singleCustomer];
        } else if (customerSearch.trim() || customerCategory !== 'all') {
          try {
            const full = await fetchCustomersApi('', 'all');
            targetList = full.customers;
          } catch {
            targetList = customers;
          }
        } else {
          targetList = customers;
        }
        xlsxBlob = buildCustomersExcelBlob(targetList, settings.currency, lang);
      }

      await saveOrShareBlob(
        xlsxBlob,
        filename,
        singleCustomer ? `${singleCustomer.code} — ${singleCustomer.name}` : t.exportAllCustomersExcel
      );
    } finally {
      setExportingCustomers(false);
    }
  };

  const handleSaveProduct = async (payload: ProductPayload, editingId?: string) => {
    const savedProduct = await saveProductApi(payload, editingId);
    await fetchProducts(searchQuery);
    if (!editingId && savedProduct) {
      setQrCodeProduct(savedProduct);
      showToast(`${t.qrGeneratedToast} (${savedProduct.code})`);
    }
    if (editingId && digitalFileData?.product.id === editingId) {
      try {
        const refreshed = await fetchProductDigitalFileApi(editingId, false);
        setDigitalFileData(refreshed);
      } catch {
        // ignore
      }
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    await deleteProductApi(productId);
    setPendingDeleteId(null);
    if (detailProduct?.id === productId) {
      setDetailProduct(null);
    }
    if (digitalFileData?.product.id === productId) {
      setDigitalFileData(null);
    }
    await fetchProducts(searchQuery);
  };

  const openDigitalFileForProduct = useCallback(
    async (productId: string, view: 'client' | 'management' = 'management') => {
      try {
        const file = await fetchProductDigitalFileApi(productId, false);
        setDigitalFileLockedClient(false);
        setDigitalFileView(view);
        setDigitalFileData(file);
      } catch {
        showToast(t.qrScannerNotFound);
      }
    },
    [showToast, t.qrScannerNotFound]
  );

  const handleRecordPosSale = useCallback(
    async (payload: PosSalePayload): Promise<PosInvoice | null> => {
      const result = await createPosSaleApi(payload);
      await Promise.all([
        fetchProducts(searchQuery),
        fetchPosSales(),
        fetchCustomers(customerSearch, customerCategory),
      ]);
      const matchedOpenProduct =
        digitalFileData?.product.id &&
        (digitalFileData.product.id === payload.productId ||
          payload.items?.some((it) => it.productId === digitalFileData.product.id));
      if (matchedOpenProduct) {
        setDigitalFileData(result.digitalFile);
      }
      showToast(`${t.qrScannerSoldSuccess} ${result.invoice.invoiceNumber}`);
      return result.invoice;
    },
    [
      fetchProducts,
      searchQuery,
      fetchPosSales,
      fetchCustomers,
      customerSearch,
      customerCategory,
      digitalFileData?.product.id,
      showToast,
      t.qrScannerSoldSuccess,
    ]
  );

  const handleExecuteQrSale = useCallback(
    async (payload: PosSalePayload) => {
      const result = await createPosSaleApi({
        ...payload,
        source: payload.source || 'qr_scan',
      });
      await Promise.all([
        fetchProducts(searchQuery),
        fetchPosSales(),
        fetchCustomers(customerSearch, customerCategory),
      ]);
      const matchedOpenProduct =
        digitalFileData?.product.id &&
        (digitalFileData.product.id === payload.productId ||
          payload.items?.some((it) => it.productId === digitalFileData.product.id));
      if (matchedOpenProduct) {
        setDigitalFileData(result.digitalFile);
      }
      showToast(`${t.qrScannerSoldSuccess} ${result.invoice.invoiceNumber}`);
      return {
        invoice: result.invoice,
        digitalFile: result.digitalFile,
      };
    },
    [
      fetchProducts,
      searchQuery,
      fetchPosSales,
      fetchCustomers,
      customerSearch,
      customerCategory,
      digitalFileData?.product.id,
      showToast,
      t.qrScannerSoldSuccess,
    ]
  );

  const handleImportProductsExcel = useCallback(
    async (items: ProductPayload[], mode: ExcelImportMode) => {
      const result = await importProductsExcelApi(items, mode);
      await fetchProducts(searchQuery);
      showToast(
        `${t.importExcelSuccessToast} +${result.addedCount} / ~${result.updatedCount}`
      );
    },
    [fetchProducts, searchQuery, showToast, t.importExcelSuccessToast]
  );

  const handleCancelPosInvoice = useCallback(
    async (invoiceId: string) => {
      await deletePosSaleApi(invoiceId);
      await Promise.all([
        fetchProducts(searchQuery),
        fetchPosSales(),
        fetchCustomers(customerSearch, customerCategory),
      ]);
      if (digitalFileData) {
        try {
          const refreshed = await fetchProductDigitalFileApi(digitalFileData.product.id, false);
          setDigitalFileData(refreshed);
        } catch {
          // ignore
        }
      }
      showToast(t.posInvoiceCanceledToast);
    },
    [
      fetchProducts,
      searchQuery,
      fetchPosSales,
      fetchCustomers,
      customerSearch,
      customerCategory,
      digitalFileData,
      showToast,
      t.posInvoiceCanceledToast,
    ]
  );

  const handleSaveSettings = async (nextSettings: ShopSettings) => {
    const updated = await saveSettingsApi(nextSettings);
    setSettings(updated);
  };

  const handleExportExcel = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const filename = `gestion-antiquites-${new Date().toISOString().slice(0, 10)}.xlsx`;
      let xlsxBlob: Blob | null = null;

      try {
        const res = await fetch(`/api/export/excel?lang=${lang}`, {
          credentials: 'same-origin',
          cache: 'no-store',
        });
        if (res.ok) {
          const buf = await res.arrayBuffer();
          const bytes = new Uint8Array(buf);
          // Verify valid ZIP/XLSX magic signature ("PK")
          if (bytes.length > 100 && bytes[0] === 0x50 && bytes[1] === 0x4b) {
            xlsxBlob = new Blob([buf], {
              type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            });
          }
        }
      } catch {
        // Fallback to client-side generation below
      }

      if (!xlsxBlob) {
        let allProducts = products;
        let allSummary = summary;
        if (searchQuery.trim()) {
          try {
            const fullData = await fetchProductsApi('');
            allProducts = fullData.products;
            allSummary = fullData.summary;
          } catch {
            // use current list
          }
        }
        xlsxBlob = buildExcelBlob(allProducts, allSummary, settings.currency, lang);
      }

      await saveOrShareBlob(xlsxBlob, filename, t.exportExcel);
    } finally {
      setExporting(false);
    }
  };

  const handleExportStockPurchasesExcel = async () => {
    if (exportingStockPurchases) return;
    setExportingStockPurchases(true);
    try {
      let targetProducts = products;
      if (searchQuery.trim()) {
        try {
          const full = await fetchProductsApi('');
          targetProducts = full.products;
        } catch {
          // use current products
        }
      }
      const blob = buildStockPurchasesExcelBlob(targetProducts, settings.currency, lang);
      const dateStamp = new Date().toISOString().slice(0, 10);
      await saveOrShareBlob(
        blob,
        `bilan-achats-stock-${dateStamp}.xlsx`,
        t.stockPurchasesReportTitle
      );
    } finally {
      setExportingStockPurchases(false);
    }
  };

  const stockPurchasesSummary = useMemo(() => {
    let baseCostMad = 0;
    let expensesMad = 0;
    let totalInvestedMad = 0;
    let sellingValueMad = 0;
    const bySupplier = new Map<
      string,
      { refs: number; units: number; totalCostMad: number }
    >();

    for (const prod of products) {
      const qty = Math.max(0, Number(prod.quantity) || 0);
      const refUnit = Number(prod.referencePrice) || 0;
      const expUnit = Number(prod.expenses) || 0;
      const unitCost = refUnit + expUnit;
      const calcQty = qty > 0 ? qty : 1;

      baseCostMad += refUnit * qty;
      expensesMad += expUnit * qty;
      totalInvestedMad += unitCost * qty;
      sellingValueMad += (Number(prod.sellingPrice) || 0) * qty;

      const supName = (prod.supplier || '').trim() || t.digitalMgmtNotSpecified;
      const supEntry = bySupplier.get(supName) || { refs: 0, units: 0, totalCostMad: 0 };
      supEntry.refs += 1;
      supEntry.units += qty;
      supEntry.totalCostMad += unitCost * calcQty;
      bySupplier.set(supName, supEntry);
    }

    return {
      baseCostMad,
      expensesMad,
      totalInvestedMad,
      sellingValueMad,
      supplierRows: Array.from(bySupplier.entries()).sort(
        (a, b) => b[1].totalCostMad - a[1].totalCostMad
      ),
    };
  }, [products, t.digitalMgmtNotSpecified]);

  const availableCategories = useMemo(
    () =>
      Array.from(
        new Set(products.map((p) => (p.category || '').trim()).filter(Boolean))
      ).sort(),
    [products]
  );

  const availableColors = useMemo(
    () =>
      Array.from(
        new Set(products.map((p) => (p.color || '').trim()).filter(Boolean))
      ).sort(),
    [products]
  );

  const inStockCount = products.filter((p) => (Number(p.quantity) || 0) > 0).length;
  const soldCount = products.filter((p) => (Number(p.quantity) || 0) <= 0).length;
  const hasAttributeFilters =
    selectedWarehouseId !== 'all' || selectedCategory !== 'all' || selectedColor !== 'all';

  const displayedProducts = products.filter((p) => {
    if (inventoryFilter === 'in_stock' && (Number(p.quantity) || 0) <= 0) return false;
    if (inventoryFilter === 'sold' && (Number(p.quantity) || 0) > 0) return false;
    if (selectedWarehouseId !== 'all' && (p.warehouseId || '') !== selectedWarehouseId) return false;
    if (selectedCategory !== 'all' && (p.category || '').trim() !== selectedCategory) return false;
    if (selectedColor !== 'all' && (p.color || '').trim() !== selectedColor) return false;
    return true;
  });

  if (clientPortalMode) {
    const portalStoreName = (settings.storeName || qrSnapshotExtras.storeName || '').trim() || t.brandName;
    return (
      <div
        dir={lang === 'ar' ? 'rtl' : 'ltr'}
        className="flex min-h-dvh flex-col items-center justify-center bg-[#F7FAF8] p-5 text-[#0B1F16] dark:bg-[#08130E] dark:text-[#F2F9F5]"
      >
        <div className="w-full max-w-md space-y-5 rounded-3xl border border-[#DCE7E0] bg-white p-6 text-center shadow-lg dark:border-[#1E3A2D] dark:bg-[#0F2119]">
          <div className="mx-auto flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-[#DCE7E0] bg-[#ECF7F1] text-[#115E3B] dark:border-[#1E3A2D] dark:bg-[#132B20] dark:text-[#34D399]">
            {settings.customLogo ? (
              <img src={settings.customLogo} alt={portalStoreName} className="h-full w-full object-cover" />
            ) : (
              <QrCode className="h-8 w-8" />
            )}
          </div>
          <div className="space-y-1.5">
            <h1 className="font-display text-xl font-bold">{portalStoreName}</h1>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#115E3B] dark:text-[#34D399]">
              {t.clientPortalTitle}
            </p>
            <p className="text-xs leading-relaxed text-[#335947] dark:text-[#9EC0AE]">
              {t.clientPortalSubtitle}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setQrScannerLockedCustomer(null);
              setQrScannerInitialMode('view');
              setQrScannerClientOnly(true);
              setQrScannerOpen(true);
            }}
            className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[#115E3B] px-5 text-sm font-bold text-white hover:bg-[#0D4A2E] dark:bg-[#10B981] dark:text-[#052E1C]"
          >
            <QrCode className="h-5 w-5" />
            <span>{t.clientPortalScanButton}</span>
          </button>
        </div>

        <QrScannerModal
          isOpen={qrScannerOpen}
          lang={lang}
          currency={settings.currency}
          storeName={settings.storeName || qrSnapshotExtras.storeName || ''}
          initialMode="view"
          clientOnly
          onClose={() => {
            setQrScannerOpen(false);
            setQrScannerClientOnly(false);
          }}
          onLookupQr={lookupProductByQrApi}
          onExecuteQrSale={handleExecuteQrSale}
          onOpenDigitalFile={(file) => {
            setDigitalFileLockedClient(true);
            setDigitalFileView('client');
            setDigitalFileData(file);
          }}
        />

        <ProductDigitalFileModal
          digitalFile={digitalFileData}
          initialView="client"
          lockedToClient
          lang={lang}
          currency={settings.currency}
          storeName={settings.storeName || qrSnapshotExtras.storeName || ''}
          whatsappPhone={settings.whatsappPhone || qrSnapshotExtras.whatsappPhone || ''}
          publicAppUrl={settings.publicAppUrl}
          customers={[]}
          onClose={() => setDigitalFileData(null)}
          onEditProduct={() => undefined}
          onRecordSale={handleRecordPosSale}
          onCancelInvoice={handleCancelPosInvoice}
          onOpenClientQrScanner={() => {
            setDigitalFileData(null);
            setQrScannerLockedCustomer(null);
            setQrScannerInitialMode('view');
            setQrScannerClientOnly(true);
            setQrScannerOpen(true);
          }}
          onNotify={showToast}
        />

        {toastMessage && (
          <div
            role="status"
            aria-live="polite"
            className="fixed bottom-6 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-center justify-between gap-3 rounded-2xl border border-[#10B981]/40 bg-[#115E3B] px-4 py-3 text-xs font-semibold text-white shadow-xl"
          >
            <span>{toastMessage}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-[#F7FAF8] text-[#0B1F16] dark:bg-[#08130E] dark:text-[#F2F9F5]">
      <Header
        lang={lang}
        onChangeLang={setLang}
        isDark={isDark}
        onToggleTheme={() => setIsDark((d) => !d)}
        customLogo={settings.customLogo}
        storeName={settings.storeName}
        linkedAccountLabel={linkedAccountLabel}
        onOpenLogoSettings={() => setLogoModalOpen(true)}
        onOpenGuide={() => setGuideOpen(true)}
        onOpenCalculator={() => setCalculatorOpen(true)}
        onOpenQrScanner={() => {
          setQrScannerLockedCustomer(null);
          setQrScannerInitialMode('view');
          setQrScannerClientOnly(false);
          setQrScannerOpen(true);
        }}
      />

      <main
        dir={lang === 'ar' ? 'rtl' : 'ltr'}
        className="mx-auto max-w-7xl px-4 pb-28 pt-5 sm:px-6 sm:pb-12"
      >
        {/* Top Module Switcher & Operations Toolbar */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-2.5">
          <nav
            aria-label="Sections"
            className="grid w-full grid-cols-3 gap-1.5 rounded-2xl border border-[#DCE7E0] bg-white p-1.5 sm:inline-grid sm:w-auto sm:gap-2 dark:border-[#1E3A2D] dark:bg-[#0F2119]"
          >
            <button
              type="button"
              onClick={() => setActiveTab('inventory')}
              className={`flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl px-2.5 text-xs font-bold transition-colors whitespace-nowrap sm:gap-2 sm:px-4 sm:text-sm ${
                activeTab === 'inventory'
                  ? 'bg-[#115E3B] text-white dark:bg-[#10B981] dark:text-[#052E1C]'
                  : 'text-[#335947] hover:bg-[#ECF7F1] dark:text-[#9EC0AE] dark:hover:bg-[#162E23]'
              }`}
            >
              <Package className="h-4 w-4 shrink-0" />
              <span className="truncate">{t.tabInventory}</span>
              <span className="tabular-nums opacity-80">({formatNumber(summary.totalReferences, lang)})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('customers')}
              className={`flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl px-2.5 text-xs font-bold transition-colors whitespace-nowrap sm:gap-2 sm:px-4 sm:text-sm ${
                activeTab === 'customers'
                  ? 'bg-[#115E3B] text-white dark:bg-[#10B981] dark:text-[#052E1C]'
                  : 'text-[#335947] hover:bg-[#ECF7F1] dark:text-[#9EC0AE] dark:hover:bg-[#162E23]'
              }`}
            >
              <Users className="h-4 w-4 shrink-0" />
              <span className="truncate">{t.tabCustomers}</span>
              <span className="tabular-nums opacity-80">
                ({formatNumber(customerSummary.totalCustomers, lang)})
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('suppliers')}
              className={`flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl px-2.5 text-xs font-bold transition-colors whitespace-nowrap sm:gap-2 sm:px-4 sm:text-sm ${
                activeTab === 'suppliers'
                  ? 'bg-[#115E3B] text-white dark:bg-[#10B981] dark:text-[#052E1C]'
                  : 'text-[#335947] hover:bg-[#ECF7F1] dark:text-[#9EC0AE] dark:hover:bg-[#162E23]'
              }`}
            >
              <Truck className="h-4 w-4 shrink-0" />
              <span className="truncate">{t.suppliersNavLabel}</span>
              <span className="tabular-nums opacity-80">
                ({formatNumber(supplierSummary.totalSuppliers, lang)})
              </span>
            </button>
          </nav>

          <div className="grid w-full grid-cols-2 gap-1.5 sm:flex sm:w-auto sm:flex-wrap sm:items-center sm:gap-2">
            <button
              type="button"
              onClick={() => setPosModalOpen(true)}
              className="flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl border border-[#DCE7E0] bg-white px-3 text-xs font-bold text-[#0B1F16] transition-colors hover:bg-[#ECF7F1] whitespace-nowrap dark:border-[#1E3A2D] dark:bg-[#0F2119] dark:text-[#F2F9F5] dark:hover:bg-[#162E23]"
            >
              <Receipt className="h-4 w-4 shrink-0 text-[#115E3B] dark:text-[#34D399]" />
              <span className="truncate">{t.posTabLabel}</span>
              <span className="tabular-nums opacity-75">({formatNumber(posSummary.totalInvoices, lang)})</span>
            </button>

            <button
              type="button"
              onClick={() => setWarehousesModalOpen(true)}
              className="flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl border border-[#DCE7E0] bg-white px-3 text-xs font-bold text-[#0B1F16] transition-colors hover:bg-[#ECF7F1] whitespace-nowrap dark:border-[#1E3A2D] dark:bg-[#0F2119] dark:text-[#F2F9F5] dark:hover:bg-[#162E23]"
            >
              <WarehouseIcon className="h-4 w-4 shrink-0 text-[#115E3B] dark:text-[#34D399]" />
              <span className="truncate">{t.warehousesNavLabel}</span>
              <span className="tabular-nums opacity-75">({formatNumber(warehouses.length, lang)})</span>
            </button>

            <button
              type="button"
              onClick={() => setAdjustmentsModalOpen(true)}
              className="flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl border border-[#DCE7E0] bg-white px-3 text-xs font-bold text-[#0B1F16] transition-colors hover:bg-[#ECF7F1] whitespace-nowrap dark:border-[#1E3A2D] dark:bg-[#0F2119] dark:text-[#F2F9F5] dark:hover:bg-[#162E23]"
            >
              <ArrowRightLeft className="h-4 w-4 shrink-0 text-[#115E3B] dark:text-[#34D399]" />
              <span className="truncate">{t.adjustmentsNavLabel}</span>
            </button>

            <button
              type="button"
              onClick={() => openReportsHub({ reportType: 'inventory' })}
              className="flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl bg-[#ECF7F1] px-3 text-xs font-bold text-[#115E3B] transition-colors hover:bg-[#DCF0E4] whitespace-nowrap dark:bg-[#132B20] dark:text-[#34D399]"
            >
              <Printer className="h-4 w-4 shrink-0" />
              <span className="truncate">{t.reportsNavLabel}</span>
            </button>
          </div>
        </div>

        {activeTab === 'customers' ? (
          <CustomersView
            lang={lang}
            currency={settings.currency}
            customers={customers}
            summary={customerSummary}
            loading={customersLoading}
            searchQuery={customerSearch}
            onChangeSearch={setCustomerSearch}
            selectedCategory={customerCategory}
            onChangeCategory={setCustomerCategory}
            exporting={exportingCustomers}
            onExportAllExcel={() => void handleExportCustomersExcel()}
            onExportSingleExcel={(cust) => void handleExportCustomersExcel(cust)}
            onAddCustomer={() => {
              setEditingCustomer(null);
              setCustomerFormOpen(true);
            }}
            onEditCustomer={(cust) => {
              setEditingCustomer(cust);
              setCustomerFormOpen(true);
            }}
            onViewCustomer={(cust, startAddPurchase = false, initialTab = 'purchases') => {
              setDetailStartAddPurchase(startAddPurchase);
              setDetailInitialTab(initialTab);
              setDetailCustomer(cust);
            }}
            onDeleteCustomer={handleDeleteCustomer}
            onPrintCustomersList={() =>
              openReportsHub({
                reportType: 'customers',
              })
            }
            onPrintPurchasesReport={(filters) =>
              openReportsHub({
                reportType: 'purchases',
                customerId: filters.customerId,
                startDate: filters.startDate,
                endDate: filters.endDate,
              })
            }
          />
        ) : activeTab === 'suppliers' ? (
          <SuppliersView
            lang={lang}
            currency={settings.currency}
            suppliers={suppliers}
            summary={supplierSummary}
            loading={suppliersLoading}
            searchQuery={supplierSearch}
            onChangeSearch={setSupplierSearch}
            selectedCategory={supplierCategory}
            onChangeCategory={setSupplierCategory}
            exporting={exportingSuppliers}
            onExportAllExcel={() => void handleExportSuppliersExcel()}
            onExportSingleExcel={(sup) => void handleExportSuppliersExcel(sup)}
            onAddSupplier={() => {
              setEditingSupplier(null);
              setSupplierFormOpen(true);
            }}
            onEditSupplier={(sup) => {
              setEditingSupplier(sup);
              setSupplierFormOpen(true);
            }}
            onViewSupplier={(sup, startAdd = false, initialTab = 'purchases') => {
              setDetailSupStartAdd(startAdd);
              setDetailSupInitialTab(initialTab);
              setDetailSupplier(sup);
            }}
            onDeleteSupplier={handleDeleteSupplier}
            onPrintSuppliersList={() =>
              openReportsHub({
                reportType: 'suppliers',
              })
            }
            onPrintPurchasesReport={() =>
              openReportsHub({
                reportType: 'purchases',
              })
            }
          />
        ) : (
          <>
            {/* KPI Summary Strip: Total Items & Global Monetary Value */}
        <section className="mb-5 grid grid-cols-2 gap-3 sm:gap-4">
          <div className="rounded-2xl border border-[#DCE7E0] bg-white p-4 sm:p-5 dark:border-[#1E3A2D] dark:bg-[#0F2119]">
            <p className="text-xs font-medium text-[#335947] dark:text-[#9EC0AE]">
              {t.totalArticlesLabel}
            </p>
            <p className="tabular-nums mt-1.5 font-display text-2xl font-bold text-[#0B1F16] sm:text-3xl dark:text-[#F2F9F5]">
              {formatNumber(summary.totalUnits, lang)}
            </p>
            <p className="tabular-nums mt-1 text-xs text-[#335947] dark:text-[#9EC0AE]">
              {formatNumber(summary.totalReferences, lang)} {t.referencesUnit}
            </p>
          </div>

          <div className="rounded-2xl border border-[#DCE7E0] bg-white p-4 sm:p-5 dark:border-[#1E3A2D] dark:bg-[#0F2119]">
            <p className="text-xs font-medium text-[#335947] dark:text-[#9EC0AE]">
              {t.globalValueLabel}
            </p>
            <p className="tabular-nums mt-1.5 font-display text-2xl font-bold text-[#115E3B] sm:text-3xl dark:text-[#34D399]">
              {formatCurrency(summary.totalSellingValue, settings.currency, lang)}
            </p>
            <p className="tabular-nums mt-1 text-xs text-[#335947] dark:text-[#9EC0AE]">
              {t.costBasisPrefix} {formatCurrency(summary.totalReferenceCost, settings.currency, lang)}
            </p>
          </div>
        </section>

        {/* Search & Action Toolbar */}
        <section className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center">
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
              aria-label={t.searchPlaceholder}
              className={`min-h-[48px] w-full rounded-2xl border border-[#DCE7E0] bg-white py-2.5 text-sm text-[#0B1F16] placeholder:text-[#6B8A79] focus:border-[#115E3B] focus:outline-none dark:border-[#1E3A2D] dark:bg-[#0F2119] dark:text-[#F2F9F5] dark:placeholder:text-[#8FB39E] dark:focus:border-[#10B981] ${
                lang === 'ar' ? 'pl-11 pr-10' : 'pl-10 pr-11'
              }`}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label={t.clearSearch}
                className={`absolute top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-[#335947] hover:bg-[#ECF7F1] dark:text-[#9EC0AE] dark:hover:bg-[#162E23] ${
                  lang === 'ar' ? 'left-2' : 'right-2'
                }`}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="hidden items-center gap-2 sm:flex">
            <button
              type="button"
              onClick={() => setImportExcelOpen(true)}
              className="flex min-h-[48px] items-center justify-center gap-2 rounded-2xl border border-[#DCE7E0] bg-white px-4 text-sm font-semibold text-[#115E3B] transition-colors hover:bg-[#ECF7F1] whitespace-nowrap shrink-0 dark:border-[#1E3A2D] dark:bg-[#0F2119] dark:text-[#34D399] dark:hover:bg-[#162E23]"
            >
              <Upload className="h-4 w-4" />
              <span>{t.importExcelButton}</span>
            </button>

            <button
              type="button"
              onClick={() => void handleExportExcel()}
              disabled={exporting}
              className="flex min-h-[48px] items-center justify-center gap-2 rounded-2xl border border-[#DCE7E0] bg-white px-4 text-sm font-semibold text-[#115E3B] transition-colors hover:bg-[#ECF7F1] disabled:opacity-60 whitespace-nowrap shrink-0 dark:border-[#1E3A2D] dark:bg-[#0F2119] dark:text-[#34D399] dark:hover:bg-[#162E23]"
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span>{t.exportExcel}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setEditingProduct(null);
                setFormOpen(true);
              }}
              className="flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-[#115E3B] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#0D4A2E] whitespace-nowrap shrink-0 dark:bg-[#10B981] dark:text-[#052E1C] dark:hover:bg-[#059669]"
            >
              <Plus className="h-4 w-4" />
              <span>{t.addProduct}</span>
            </button>
          </div>
        </section>

        {/* Inventory Stock Status Filter (En stock / Vendus / Tous) + Attribute Filters + Reports */}
        <section className="mb-4 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="inline-flex rounded-xl border border-[#DCE7E0] bg-white p-1 dark:border-[#1E3A2D] dark:bg-[#0F2119]">
              <button
                type="button"
                onClick={() => setInventoryFilter('in_stock')}
                className={`min-h-[38px] rounded-lg px-3 text-xs font-semibold transition-colors whitespace-nowrap ${
                  inventoryFilter === 'in_stock'
                    ? 'bg-[#115E3B] text-white dark:bg-[#10B981] dark:text-[#052E1C]'
                    : 'text-[#335947] hover:bg-[#ECF7F1] dark:text-[#9EC0AE] dark:hover:bg-[#162E23]'
                }`}
              >
                {t.inventoryFilterInStock}{' '}
                <span className="tabular-nums opacity-80">({formatNumber(inStockCount, lang)})</span>
              </button>
              <button
                type="button"
                onClick={() => setInventoryFilter('sold')}
                className={`min-h-[38px] rounded-lg px-3 text-xs font-semibold transition-colors whitespace-nowrap ${
                  inventoryFilter === 'sold'
                    ? 'bg-[#115E3B] text-white dark:bg-[#10B981] dark:text-[#052E1C]'
                    : 'text-[#335947] hover:bg-[#ECF7F1] dark:text-[#9EC0AE] dark:hover:bg-[#162E23]'
                }`}
              >
                {t.inventoryFilterSold}{' '}
                <span className="tabular-nums opacity-80">({formatNumber(soldCount, lang)})</span>
              </button>
              <button
                type="button"
                onClick={() => setInventoryFilter('all')}
                className={`min-h-[38px] rounded-lg px-3 text-xs font-semibold transition-colors whitespace-nowrap ${
                  inventoryFilter === 'all'
                    ? 'bg-[#115E3B] text-white dark:bg-[#10B981] dark:text-[#052E1C]'
                    : 'text-[#335947] hover:bg-[#ECF7F1] dark:text-[#9EC0AE] dark:hover:bg-[#162E23]'
                }`}
              >
                {t.inventoryFilterAll}{' '}
                <span className="tabular-nums opacity-80">({formatNumber(products.length, lang)})</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowStockPurchasesReport((v) => !v)}
                className={`flex min-h-[40px] items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  showStockPurchasesReport
                    ? 'border-[#115E3B] bg-[#ECF7F1] text-[#115E3B] dark:border-[#10B981] dark:bg-[#132B20] dark:text-[#34D399]'
                    : 'border-[#DCE7E0] bg-white text-[#0B1F16] hover:bg-[#ECF7F1] dark:border-[#1E3A2D] dark:bg-[#0F2119] dark:text-[#F2F9F5]'
                }`}
              >
                <BarChart3 className="h-4 w-4" />
                <span>{t.stockPurchasesReportToggle}</span>
                {showStockPurchasesReport ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
              </button>

              <button
                type="button"
                onClick={() => void handleExportStockPurchasesExcel()}
                disabled={exportingStockPurchases || products.length === 0}
                className="flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[#DCE7E0] bg-white px-3 text-xs font-semibold text-[#115E3B] hover:bg-[#ECF7F1] disabled:opacity-60 whitespace-nowrap shrink-0 dark:border-[#1E3A2D] dark:bg-[#0F2119] dark:text-[#34D399]"
              >
                <FileSpreadsheet className="h-4 w-4" />
                <span>{t.stockPurchasesExportExcel}</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  openReportsHub({
                    reportType: 'products',
                    warehouseId: selectedWarehouseId !== 'all' ? selectedWarehouseId : undefined,
                    category: selectedCategory !== 'all' ? selectedCategory : undefined,
                  })
                }
                className="flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[#DCE7E0] bg-white px-3 text-xs font-semibold text-[#115E3B] hover:bg-[#ECF7F1] whitespace-nowrap shrink-0 dark:border-[#1E3A2D] dark:bg-[#0F2119] dark:text-[#34D399]"
              >
                <Printer className="h-4 w-4" />
                <span>{t.reportPrintNow}</span>
              </button>
            </div>
          </div>

          {/* Warehouse / Category / Color Attribute Filters */}
          {(warehouses.length > 0 || availableCategories.length > 0 || availableColors.length > 0) && (
            <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[#DCE7E0] bg-white p-2.5 dark:border-[#1E3A2D] dark:bg-[#0F2119]">
              {warehouses.length > 0 && (
                <select
                  value={selectedWarehouseId}
                  onChange={(e) => setSelectedWarehouseId(e.target.value)}
                  aria-label={t.productWarehouseLabel}
                  className="min-h-[38px] rounded-xl border border-[#DCE7E0] bg-[#F7FAF8] px-3 text-xs font-medium text-[#0B1F16] focus:border-[#115E3B] focus:outline-none dark:border-[#1E3A2D] dark:bg-[#091611] dark:text-[#F2F9F5]"
                >
                  <option value="all">{t.productAllWarehouses}</option>
                  {warehouses.map((wh) => (
                    <option key={wh.id} value={wh.id}>
                      {wh.code} — {wh.name}
                    </option>
                  ))}
                </select>
              )}

              {availableCategories.length > 0 && (
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  aria-label={t.productCategoryLabel}
                  className="min-h-[38px] rounded-xl border border-[#DCE7E0] bg-[#F7FAF8] px-3 text-xs font-medium text-[#0B1F16] focus:border-[#115E3B] focus:outline-none dark:border-[#1E3A2D] dark:bg-[#091611] dark:text-[#F2F9F5]"
                >
                  <option value="all">{t.productAllCategories}</option>
                  {availableCategories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              )}

              {availableColors.length > 0 && (
                <select
                  value={selectedColor}
                  onChange={(e) => setSelectedColor(e.target.value)}
                  aria-label={t.productColorLabel}
                  className="min-h-[38px] rounded-xl border border-[#DCE7E0] bg-[#F7FAF8] px-3 text-xs font-medium text-[#0B1F16] focus:border-[#115E3B] focus:outline-none dark:border-[#1E3A2D] dark:bg-[#091611] dark:text-[#F2F9F5]"
                >
                  <option value="all">{t.productAllColors}</option>
                  {availableColors.map((col) => (
                    <option key={col} value={col}>
                      {col}
                    </option>
                  ))}
                </select>
              )}

              {hasAttributeFilters && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedWarehouseId('all');
                    setSelectedCategory('all');
                    setSelectedColor('all');
                  }}
                  className="inline-flex min-h-[38px] items-center gap-1 rounded-xl px-2.5 text-xs font-semibold text-[#115E3B] hover:bg-[#ECF7F1] dark:text-[#34D399]"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>{t.purchasesFilterReset}</span>
                </button>
              )}
            </div>
          )}
        </section>

        {/* Detailed Inventory Stock Purchases Balance / Report */}
        {showStockPurchasesReport && (
          <section className="mb-6 space-y-4 rounded-2xl border border-[#115E3B]/25 bg-white p-4 sm:p-5 dark:border-[#10B981]/30 dark:bg-[#0F2119]">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#DCE7E0] pb-3 dark:border-[#1E3A2D]">
              <h2 className="flex items-center gap-2 font-display text-base font-bold text-[#0B1F16] dark:text-[#F2F9F5]">
                <BarChart3 className="h-4 w-4 text-[#115E3B] dark:text-[#34D399]" />
                <span>{t.stockPurchasesReportTitle}</span>
              </h2>
              <button
                type="button"
                onClick={() => void handleExportStockPurchasesExcel()}
                disabled={exportingStockPurchases}
                className="flex min-h-[38px] items-center gap-1.5 rounded-xl bg-[#115E3B] px-3 text-xs font-semibold text-white hover:bg-[#0D4A2E] disabled:opacity-60 dark:bg-[#10B981] dark:text-[#052E1C]"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                <span>{t.stockPurchasesExportExcel}</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-[#DCE7E0] bg-[#F7FAF8] p-3 dark:border-[#1E3A2D] dark:bg-[#091611]">
                <span className="block text-[11px] text-[#335947] dark:text-[#9EC0AE]">
                  {t.stockPurchasesBaseCost}
                </span>
                <span className="tabular-nums mt-0.5 block text-base font-bold text-[#0B1F16] dark:text-[#F2F9F5]">
                  {formatCurrency(stockPurchasesSummary.baseCostMad, settings.currency, lang)}
                </span>
              </div>
              <div className="rounded-xl border border-[#DCE7E0] bg-[#F7FAF8] p-3 dark:border-[#1E3A2D] dark:bg-[#091611]">
                <span className="block text-[11px] text-[#335947] dark:text-[#9EC0AE]">
                  {t.stockPurchasesExpenses}
                </span>
                <span className="tabular-nums mt-0.5 block text-base font-bold text-[#0B1F16] dark:text-[#F2F9F5]">
                  {formatCurrency(stockPurchasesSummary.expensesMad, settings.currency, lang)}
                </span>
              </div>
              <div className="rounded-xl border border-[#DCE7E0] bg-[#F7FAF8] p-3 dark:border-[#1E3A2D] dark:bg-[#091611]">
                <span className="block text-[11px] text-[#335947] dark:text-[#9EC0AE]">
                  {t.stockPurchasesTotalInvested}
                </span>
                <span className="tabular-nums mt-0.5 block text-base font-bold text-[#115E3B] dark:text-[#34D399]">
                  {formatCurrency(stockPurchasesSummary.totalInvestedMad, settings.currency, lang)}
                </span>
              </div>
              <div className="rounded-xl border border-[#DCE7E0] bg-[#F7FAF8] p-3 dark:border-[#1E3A2D] dark:bg-[#091611]">
                <span className="block text-[11px] text-[#335947] dark:text-[#9EC0AE]">
                  {t.stockPurchasesSellingValue}
                </span>
                <span className="tabular-nums mt-0.5 block text-base font-bold text-[#115E3B] dark:text-[#34D399]">
                  {formatCurrency(stockPurchasesSummary.sellingValueMad, settings.currency, lang)}
                </span>
              </div>
            </div>

            {stockPurchasesSummary.supplierRows.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-[#335947] dark:text-[#9EC0AE]">
                  {t.stockPurchasesBySupplier}
                </p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {stockPurchasesSummary.supplierRows.map(([supplierName, data]) => (
                    <div
                      key={supplierName}
                      className="flex items-center justify-between gap-2 rounded-xl border border-[#DCE7E0] bg-[#F7FAF8] px-3 py-2 text-xs dark:border-[#1E3A2D] dark:bg-[#091611]"
                    >
                      <div className="min-w-0">
                        <span className="block truncate font-semibold text-[#0B1F16] dark:text-[#F2F9F5]">
                          {supplierName}
                        </span>
                        <span className="tabular-nums text-[11px] text-[#335947] dark:text-[#9EC0AE]">
                          {formatNumber(data.refs, lang)} {t.referencesUnit} ·{' '}
                          {formatNumber(data.units, lang)} {t.articlesUnit}
                        </span>
                      </div>
                      <span className="tabular-nums shrink-0 font-bold text-[#115E3B] dark:text-[#34D399]">
                        {formatCurrency(data.totalCostMad, settings.currency, lang)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* States */}
        {error && (
          <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((item) => (
              <div
                key={item}
                className="h-80 rounded-2xl border border-[#DCE7E0] bg-white p-4 opacity-70 dark:border-[#1E3A2D] dark:bg-[#0F2119]"
              />
            ))}
          </div>
        ) : displayedProducts.length === 0 ? (
          <div className="rounded-3xl border border-[#DCE7E0] bg-white px-6 py-14 text-center dark:border-[#1E3A2D] dark:bg-[#0F2119]">
            <h2 className="font-display text-xl font-bold text-[#0B1F16] dark:text-[#F2F9F5]">
              {t.emptyTitle}
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-[#335947] dark:text-[#9EC0AE]">
              {t.emptyDescription}
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              {(searchQuery || inventoryFilter !== 'all' || hasAttributeFilters) && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setInventoryFilter('all');
                    setSelectedWarehouseId('all');
                    setSelectedCategory('all');
                    setSelectedColor('all');
                  }}
                  className="min-h-[44px] rounded-xl border border-[#DCE7E0] px-4 text-sm font-semibold text-[#115E3B] hover:bg-[#ECF7F1] dark:border-[#1E3A2D] dark:text-[#34D399]"
                >
                  {t.resetFilter}
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setEditingProduct(null);
                  setFormOpen(true);
                }}
                className="flex min-h-[44px] items-center gap-2 rounded-xl bg-[#115E3B] px-5 text-sm font-semibold text-white hover:bg-[#0D4A2E] dark:bg-[#10B981] dark:text-[#052E1C]"
              >
                <Plus className="h-4 w-4" />
                <span>{t.addProduct}</span>
              </button>
            </div>
          </div>
        ) : (
          /* Product Grid: Detailed Product Cards */
          <section className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {displayedProducts.map((product) => {
              const primaryPhoto = product.photos[0]?.imageData;
              const videoCount = product.photos.filter((p) => isVideoMedia(p.imageData)).length;
              const isDeletingThis = pendingDeleteId === product.id;

              return (
                <article
                  key={product.id}
                  className="flex flex-col overflow-hidden rounded-2xl border border-[#DCE7E0] bg-white transition-colors hover:border-[#115E3B]/40 dark:border-[#1E3A2D] dark:bg-[#0F2119] dark:hover:border-[#10B981]/50"
                >
                  {/* Unique code displayed right ABOVE the image */}
                  <div className="flex items-center justify-between border-b border-[#DCE7E0] bg-[#F7FAF8] px-4 py-2 dark:border-[#1E3A2D] dark:bg-[#0B1913]">
                    <span className="font-mono-code text-sm font-bold tracking-wider text-[#115E3B] dark:text-[#34D399]">
                      {product.code}
                    </span>
                    <span className="tabular-nums flex items-center gap-1.5 text-xs text-[#335947] dark:text-[#9EC0AE]">
                      {videoCount > 0 && (
                        <Video className="h-3.5 w-3.5 text-[#115E3B] dark:text-[#34D399]" />
                      )}
                      {product.photos.length > 0
                        ? `${product.photos.length} ${t.mediaLabel}${product.photos.length > 1 && lang === 'fr' ? 's' : ''}`
                        : '0'}
                      {' · '}
                      {product.addedDate}
                    </span>
                  </div>

                  {/* Clickable Media area -> opens full detailed product sheet */}
                  <button
                    type="button"
                    onClick={() => setDetailProduct(product)}
                    className="group relative aspect-[4/3] w-full overflow-hidden bg-[#E8F2EC] text-left focus-visible:outline-2 focus-visible:outline-[#115E3B] dark:bg-[#091611]"
                  >
                    {primaryPhoto ? (
                      isVideoMedia(primaryPhoto) ? (
                        <div className="relative h-full w-full bg-black">
                          <video
                            src={primaryPhoto}
                            muted
                            playsInline
                            preload="auto"
                            onLoadedData={(e) => {
                              const v = e.currentTarget;
                              if (v.currentTime === 0) {
                                try {
                                  v.currentTime = 0.05;
                                } catch {
                                  // ignore
                                }
                              }
                            }}
                            className="h-full w-full object-cover"
                          />
                          <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/25">
                            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/65 text-white ring-2 ring-white/80">
                              <Play className="h-5 w-5 fill-white" />
                            </span>
                          </span>
                        </div>
                      ) : (
                        <img
                          src={primaryPhoto}
                          alt={product.name}
                          referrerPolicy="no-referrer"
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                        />
                      )
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center text-[#335947] dark:text-[#9EC0AE]">
                        <ImageIcon className="mb-1.5 h-8 w-8 opacity-45" />
                        <span className="text-xs">{product.code}</span>
                      </div>
                    )}
                  </button>

                  {/* Product Summary Body */}
                  <div className="flex flex-1 flex-col p-4">
                    <button
                      type="button"
                      onClick={() => setDetailProduct(product)}
                      className="text-start focus:outline-none"
                    >
                      <h3 className="font-display text-lg font-bold leading-snug text-[#0B1F16] hover:text-[#115E3B] dark:text-[#F2F9F5] dark:hover:text-[#34D399]">
                        {product.name}
                      </h3>
                    </button>

                    {product.description && (
                      <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-[#335947] dark:text-[#9EC0AE]">
                        {product.description}
                      </p>
                    )}

                    {/* Clean unboxed metadata separators */}
                    <div className="tabular-nums mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#335947] dark:text-[#9EC0AE]">
                      <span>
                        {formatNumber(product.lengthCm, lang)} × {formatNumber(product.widthCm, lang)} ×{' '}
                        {formatNumber(product.heightCm, lang)} {t.cmUnit}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {formatNumber(product.piecesCount, lang)} {t.piecesUnit}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span
                        className={
                          product.quantity <= 0
                            ? 'font-semibold text-red-600 dark:text-red-400'
                            : undefined
                        }
                      >
                        {product.quantity <= 0
                          ? t.digitalStatusSold
                          : `${t.quantityLabel.replace(/^5\.\s*/, '')} : ${formatNumber(product.quantity, lang)}`}
                      </span>
                      {product.category && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{product.category}</span>
                        </>
                      )}
                      {product.color && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{product.color}</span>
                        </>
                      )}
                      {product.warehouseName && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="truncate">{product.warehouseName}</span>
                        </>
                      )}
                      {product.supplier && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="truncate">{product.supplier}</span>
                        </>
                      )}
                    </div>

                    {/* Price row */}
                    <div className="mt-4 flex items-baseline justify-between border-t border-[#DCE7E0] pt-3 dark:border-[#1E3A2D]">
                      <div>
                        <span className="block text-[11px] text-[#335947] dark:text-[#9EC0AE]">
                          {t.sellingPriceLabel.replace(/^8\.\s*/, '')}
                        </span>
                        <span className="tabular-nums text-lg font-bold text-[#115E3B] dark:text-[#34D399]">
                          {formatCurrency(product.sellingPrice, settings.currency, lang)}
                        </span>
                      </div>

                      <div className="text-end">
                        <span className="block text-[11px] text-[#335947] dark:text-[#9EC0AE]">
                          {t.referencePriceLabel.replace(/^6\.\s*/, '')}
                        </span>
                        <span className="tabular-nums text-xs font-medium text-[#0B1F16] dark:text-[#D1E7DA]">
                          {formatCurrency(product.referencePrice, settings.currency, lang)}
                        </span>
                      </div>
                    </div>

                    {/* Inline Delete Confirm or Action Buttons */}
                    {isDeletingThis ? (
                      <div className="mt-3 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-2 dark:border-red-900/60 dark:bg-red-950/40">
                        <button
                          type="button"
                          onClick={() => setPendingDeleteId(null)}
                          className="min-h-[38px] flex-1 rounded-lg bg-white text-xs font-semibold text-[#0B1F16] dark:bg-[#0F2119] dark:text-[#F2F9F5]"
                        >
                          {t.cancel}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteProduct(product.id)}
                          className="min-h-[38px] flex-1 rounded-lg bg-red-600 text-xs font-semibold text-white"
                        >
                          {t.delete}
                        </button>
                      </div>
                    ) : (
                      <div className="mt-3 grid grid-cols-5 gap-1.5">
                        <button
                          type="button"
                          onClick={() => setDetailProduct(product)}
                          className="col-span-1 flex min-h-[44px] items-center justify-center rounded-xl bg-[#ECF7F1] px-1.5 text-xs font-semibold text-[#115E3B] hover:bg-[#DCF0E4] dark:bg-[#132B20] dark:text-[#34D399]"
                          title={t.viewDetails}
                        >
                          <span className="truncate">{t.viewDetails.split(' ')[0]}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setQrCodeProduct(product)}
                          aria-label={t.qrLabelButton}
                          title={t.qrLabelButton}
                          className="flex min-h-[44px] items-center justify-center rounded-xl border border-[#DCE7E0] text-[#115E3B] hover:bg-[#ECF7F1] dark:border-[#1E3A2D] dark:text-[#34D399] dark:hover:bg-[#162E23]"
                        >
                          <QrCode className="h-4 w-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setEditingProduct(product);
                            setFormOpen(true);
                          }}
                          aria-label={t.edit}
                          title={t.edit}
                          className="flex min-h-[44px] items-center justify-center rounded-xl border border-[#DCE7E0] text-[#0B1F16] hover:bg-[#F7FAF8] dark:border-[#1E3A2D] dark:text-[#F2F9F5] dark:hover:bg-[#162E23]"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => setShareProduct(product)}
                          aria-label={t.share}
                          title={t.share}
                          className="flex min-h-[44px] items-center justify-center rounded-xl border border-[#DCE7E0] text-[#115E3B] hover:bg-[#ECF7F1] dark:border-[#1E3A2D] dark:text-[#34D399] dark:hover:bg-[#162E23]"
                        >
                          <Share2 className="h-4 w-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => setPendingDeleteId(product.id)}
                          aria-label={t.delete}
                          title={t.delete}
                          className="flex min-h-[44px] items-center justify-center rounded-xl border border-[#DCE7E0] text-red-600 hover:bg-red-50 dark:border-[#1E3A2D] dark:text-red-400 dark:hover:bg-red-950/40"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </section>
        )}
          </>
        )}
      </main>

      {/* Mobile Sticky Bottom Action Bar (Thumb Zone) */}
      <div
        dir={lang === 'ar' ? 'rtl' : 'ltr'}
        className="pb-safe fixed bottom-0 left-0 right-0 z-30 border-t border-[#DCE7E0] bg-white/95 px-4 pt-2.5 backdrop-blur-md sm:hidden dark:border-[#1E3A2D] dark:bg-[#0A1812]/95"
      >
        {activeTab === 'customers' ? (
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => void handleExportCustomersExcel()}
              disabled={exportingCustomers || customerSummary.totalCustomers === 0}
              className="flex min-h-[46px] items-center justify-center gap-2 rounded-xl border border-[#DCE7E0] bg-[#F7FAF8] px-4 text-xs font-semibold text-[#115E3B] disabled:opacity-60 whitespace-nowrap shrink-0 dark:border-[#1E3A2D] dark:bg-[#102119] dark:text-[#34D399]"
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span>{t.exportExcel}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setEditingCustomer(null);
                setCustomerFormOpen(true);
              }}
              className="flex min-h-[46px] flex-1 items-center justify-center gap-2 rounded-xl bg-[#115E3B] px-4 text-sm font-semibold text-white whitespace-nowrap dark:bg-[#10B981] dark:text-[#052E1C]"
            >
              <UserPlus className="h-4 w-4" />
              <span>{t.addCustomer}</span>
            </button>
          </div>
        ) : activeTab === 'suppliers' ? (
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => void handleExportSuppliersExcel()}
              disabled={exportingSuppliers || supplierSummary.totalSuppliers === 0}
              className="flex min-h-[46px] items-center justify-center gap-2 rounded-xl border border-[#DCE7E0] bg-[#F7FAF8] px-4 text-xs font-semibold text-[#115E3B] disabled:opacity-60 whitespace-nowrap shrink-0 dark:border-[#1E3A2D] dark:bg-[#102119] dark:text-[#34D399]"
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span>{t.exportExcel}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setEditingSupplier(null);
                setSupplierFormOpen(true);
              }}
              className="flex min-h-[46px] flex-1 items-center justify-center gap-2 rounded-xl bg-[#115E3B] px-4 text-sm font-semibold text-white whitespace-nowrap dark:bg-[#10B981] dark:text-[#052E1C]"
            >
              <Truck className="h-4 w-4" />
              <span>{t.newSupplierButton}</span>
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setImportExcelOpen(true)}
              aria-label={t.importExcelButton}
              title={t.importExcelButton}
              className="flex min-h-[46px] items-center justify-center gap-1 rounded-xl border border-[#DCE7E0] bg-[#F7FAF8] px-2.5 text-xs font-semibold text-[#115E3B] whitespace-nowrap shrink-0 dark:border-[#1E3A2D] dark:bg-[#102119] dark:text-[#34D399]"
            >
              <Upload className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => void handleExportExcel()}
              disabled={exporting}
              className="flex min-h-[46px] items-center justify-center gap-1.5 rounded-xl border border-[#DCE7E0] bg-[#F7FAF8] px-2.5 text-xs font-semibold text-[#115E3B] disabled:opacity-60 whitespace-nowrap shrink-0 dark:border-[#1E3A2D] dark:bg-[#102119] dark:text-[#34D399]"
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span>{t.exportExcel}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setQrScannerLockedCustomer(null);
                setQrScannerInitialMode('view');
                setQrScannerClientOnly(false);
                setQrScannerOpen(true);
              }}
              aria-label={t.qrScanButtonLabel}
              className="flex min-h-[46px] items-center justify-center gap-1.5 rounded-xl border border-[#115E3B]/35 bg-[#ECF7F1] px-2.5 text-xs font-bold text-[#115E3B] whitespace-nowrap shrink-0 dark:border-[#10B981]/40 dark:bg-[#132B20] dark:text-[#34D399]"
            >
              <QrCode className="h-4 w-4" />
              <span>QR</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setEditingProduct(null);
                setFormOpen(true);
              }}
              className="flex min-h-[46px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#115E3B] px-3 text-sm font-semibold text-white whitespace-nowrap dark:bg-[#10B981] dark:text-[#052E1C]"
            >
              <Plus className="h-4 w-4" />
              <span>{t.addProduct}</span>
            </button>
          </div>
        )}
      </div>

      {/* Modals */}
      <ProductFormModal
        isOpen={formOpen}
        lang={lang}
        currency={settings.currency}
        editingProduct={editingProduct}
        warehouses={warehouses}
        suppliers={suppliers}
        existingCategories={availableCategories}
        onClose={() => {
          setFormOpen(false);
          setEditingProduct(null);
        }}
        onSubmit={handleSaveProduct}
      />

      <ProductDetailSheet
        product={detailProduct}
        lang={lang}
        currency={settings.currency}
        onClose={() => setDetailProduct(null)}
        onEdit={(prod) => {
          setEditingProduct(prod);
          setFormOpen(true);
        }}
        onDelete={handleDeleteProduct}
        onShare={(prod) => setShareProduct(prod)}
        onOpenQrLabel={(prod) => setQrCodeProduct(prod)}
        onOpenDigitalFile={(prod) => void openDigitalFileForProduct(prod.id, 'management')}
        onPrintProductReport={(prod) =>
          openReportsHub({
            reportType: 'product_single',
            productId: prod.id,
          })
        }
      />

      <ShareModal
        product={shareProduct}
        lang={lang}
        currency={settings.currency}
        metaStatus={metaStatus}
        facebookHandle={settings.facebookHandle}
        instagramHandle={settings.instagramHandle}
        onRefreshMetaStatus={refreshMetaStatus}
        onSaveHandles={async (next) => {
          await handleSaveSettings({
            ...settings,
            facebookHandle: next.facebookHandle,
            instagramHandle: next.instagramHandle,
          });
        }}
        onNotify={showToast}
        onClose={() => setShareProduct(null)}
      />

      <LogoModal
        isOpen={logoModalOpen}
        lang={lang}
        customLogo={settings.customLogo}
        storeName={settings.storeName}
        currency={settings.currency}
        facebookHandle={settings.facebookHandle}
        instagramHandle={settings.instagramHandle}
        whatsappPhone={settings.whatsappPhone}
        printerMode={settings.printerMode}
        printerPaper={settings.printerPaper}
        printerName={settings.printerName}
        printerLinked={settings.printerLinked}
        publicAppUrl={settings.publicAppUrl}
        metaStatus={metaStatus}
        onRefreshMetaStatus={refreshMetaStatus}
        onNotify={showToast}
        onOpenGuide={() => setGuideOpen(true)}
        onClose={() => setLogoModalOpen(false)}
        onSave={handleSaveSettings}
      />

      <InitialSetupModal
        isOpen={setupOpen}
        lang={lang}
        onChangeLang={setLang}
        settings={settings}
        metaStatus={metaStatus}
        onRefreshMetaStatus={refreshMetaStatus}
        onSaveSettings={(next) =>
          handleSaveSettings({
            whatsappPhone: settings.whatsappPhone,
            ...next,
          })
        }
        onNotify={showToast}
        onOpenGuide={() => setGuideOpen(true)}
        onClose={() => setSetupOpen(false)}
      />

      <GuideModal
        isOpen={guideOpen}
        lang={lang}
        onClose={() => setGuideOpen(false)}
        onQuickAction={(action) => {
          if (action === 'add-product') {
            setActiveTab('inventory');
            setEditingProduct(null);
            setFormOpen(true);
          } else if (action === 'open-settings') {
            setLogoModalOpen(true);
          } else if (action === 'open-calculator') {
            setCalculatorOpen(true);
          } else if (action === 'open-qr-scanner') {
            setQrScannerLockedCustomer(null);
            setQrScannerInitialMode('view');
            setQrScannerClientOnly(false);
            setQrScannerOpen(true);
          }
        }}
      />

      <CustomerFormModal
        isOpen={customerFormOpen}
        lang={lang}
        editingCustomer={editingCustomer}
        onClose={() => {
          setCustomerFormOpen(false);
          setEditingCustomer(null);
        }}
        onSubmit={handleSaveCustomer}
      />

      <CustomerDetailModal
        customer={detailCustomer}
        lang={lang}
        currency={settings.currency}
        products={products}
        initialAddPurchase={detailStartAddPurchase}
        initialTab={detailInitialTab}
        onClose={() => {
          setDetailCustomer(null);
          setDetailStartAddPurchase(false);
          setDetailInitialTab('purchases');
        }}
        onEditProfile={(cust) => {
          setEditingCustomer(cust);
          setCustomerFormOpen(true);
        }}
        onExportCustomerExcel={(cust) => void handleExportCustomersExcel(cust)}
        onSavePurchase={handleSavePurchase}
        onCreateMultiSale={handleRecordPosSale}
        onPrintInvoice={handlePrintInvoice}
        onDeletePurchase={handleDeletePurchase}
        onSaveGalleryImages={handleSaveGalleryImages}
        onDeleteGalleryImage={handleDeleteGalleryImage}
        onOpenQrSellForCustomer={(cust) => {
          setQrScannerLockedCustomer(cust);
          setQrScannerInitialMode('sell');
          setQrScannerClientOnly(false);
          setQrScannerOpen(true);
        }}
      />

      <SupplierFormModal
        isOpen={supplierFormOpen}
        lang={lang}
        editingSupplier={editingSupplier}
        onClose={() => {
          setSupplierFormOpen(false);
          setEditingSupplier(null);
        }}
        onSubmit={handleSaveSupplier}
      />

      <SupplierDetailModal
        supplier={detailSupplier}
        lang={lang}
        currency={settings.currency}
        products={products}
        warehouses={warehouses}
        initialAddPurchase={detailSupStartAdd}
        initialTab={detailSupInitialTab}
        onClose={() => {
          setDetailSupplier(null);
          setDetailSupStartAdd(false);
          setDetailSupInitialTab('purchases');
        }}
        onEditProfile={(sup) => {
          setEditingSupplier(sup);
          setSupplierFormOpen(true);
        }}
        onExportSupplierExcel={(sup) => void handleExportSuppliersExcel(sup)}
        onSavePurchase={handleSaveSupplierPurchase}
        onDeletePurchase={handleDeleteSupplierPurchase}
        onSaveGalleryImages={handleSaveSupplierGalleryImages}
        onDeleteGalleryImage={handleDeleteSupplierGalleryImage}
      />

      <WarehousesModal
        isOpen={warehousesModalOpen}
        lang={lang}
        currency={settings.currency}
        warehouses={warehouses}
        products={products}
        onClose={() => setWarehousesModalOpen(false)}
        onSaveWarehouse={handleSaveWarehouse}
        onDeleteWarehouse={handleDeleteWarehouse}
        onPrintWarehouseReport={(whId) =>
          openReportsHub({
            reportType: 'warehouses',
            warehouseId: whId,
          })
        }
      />

      <InventoryAdjustmentModal
        isOpen={adjustmentsModalOpen}
        lang={lang}
        currency={settings.currency}
        products={products}
        warehouses={warehouses}
        suppliers={suppliers}
        adjustments={adjustments}
        onClose={() => setAdjustmentsModalOpen(false)}
        onCreateAdjustment={handleCreateAdjustment}
        onDeleteAdjustment={handleDeleteAdjustment}
        onPrintInventoryReport={(filters) =>
          openReportsHub({
            reportType: 'inventory',
            warehouseId: filters.warehouseId,
            category: filters.category,
            productId: filters.productId,
          })
        }
      />

      <ReportsPrintModal
        isOpen={reportsModalOpen}
        lang={lang}
        currency={settings.currency}
        storeName={settings.storeName || ''}
        initialFilters={reportsInitialFilters}
        products={products}
        warehouses={warehouses}
        customers={customers}
        suppliers={suppliers}
        invoices={posInvoices}
        adjustments={adjustments}
        onClose={() => setReportsModalOpen(false)}
        onMarkInvoicePrinted={handleMarkInvoicePrinted}
        onNotify={showToast}
      />

      <CalculatorModal
        isOpen={calculatorOpen}
        lang={lang}
        currency={settings.currency}
        onClose={() => setCalculatorOpen(false)}
      />

      <QrScannerModal
        isOpen={qrScannerOpen}
        lang={lang}
        currency={settings.currency}
        storeName={settings.storeName || qrSnapshotExtras.storeName || ''}
        initialMode={qrScannerInitialMode}
        clientOnly={qrScannerClientOnly}
        customers={customers}
        lockedCustomer={qrScannerLockedCustomer}
        onClose={() => {
          setQrScannerOpen(false);
          setQrScannerLockedCustomer(null);
          setQrScannerInitialMode('view');
          setQrScannerClientOnly(false);
        }}
        onLookupQr={lookupProductByQrApi}
        onExecuteQrSale={handleExecuteQrSale}
        onPrintInvoice={handlePrintInvoice}
        onOpenDigitalFile={(file, view) => {
          const keepClientLock = qrScannerClientOnly;
          setQrScannerClientOnly(false);
          setDigitalFileLockedClient(keepClientLock);
          setDigitalFileView(keepClientLock ? 'client' : view);
          setDigitalFileData(file);
        }}
      />

      <ImportProductsExcelModal
        isOpen={importExcelOpen}
        lang={lang}
        currency={settings.currency}
        onClose={() => setImportExcelOpen(false)}
        onImport={handleImportProductsExcel}
      />

      <QrCodeDisplayModal
        product={qrCodeProduct}
        lang={lang}
        currency={settings.currency}
        storeName={settings.storeName}
        whatsappPhone={settings.whatsappPhone}
        publicAppUrl={settings.publicAppUrl}
        printerMode={settings.printerMode}
        printerPaper={settings.printerPaper}
        printerName={settings.printerName}
        printerLinked={settings.printerLinked}
        onSavePrinterSettings={async (next) => {
          await handleSaveSettings({
            ...settings,
            ...next,
          });
        }}
        onClose={() => setQrCodeProduct(null)}
        onOpenDigitalFile={(prod) => void openDigitalFileForProduct(prod.id, 'management')}
        onNotify={showToast}
      />

      <ProductDigitalFileModal
        digitalFile={digitalFileData}
        initialView={digitalFileView}
        lockedToClient={digitalFileLockedClient}
        lang={lang}
        currency={settings.currency}
        storeName={settings.storeName || qrSnapshotExtras.storeName || ''}
        whatsappPhone={settings.whatsappPhone || qrSnapshotExtras.whatsappPhone || ''}
        publicAppUrl={settings.publicAppUrl}
        customers={customers}
        onClose={() => {
          setDigitalFileData(null);
          setDigitalFileLockedClient(false);
        }}
        onEditProduct={(prod) => {
          setDigitalFileData(null);
          setDigitalFileLockedClient(false);
          setEditingProduct(prod);
          setFormOpen(true);
        }}
        onRecordSale={handleRecordPosSale}
        onCancelInvoice={handleCancelPosInvoice}
        onPrintInvoice={handlePrintInvoice}
        onPrintProductReport={(prod) =>
          openReportsHub({
            reportType: 'product_single',
            productId: prod.id,
          })
        }
        onOpenClientQrScanner={() => {
          setDigitalFileData(null);
          setQrScannerLockedCustomer(null);
          setQrScannerInitialMode('view');
          setQrScannerClientOnly(true);
          setQrScannerOpen(true);
        }}
        onNotify={showToast}
      />

      <PosSalesModal
        isOpen={posModalOpen}
        lang={lang}
        currency={settings.currency}
        storeName={settings.storeName}
        products={products}
        customers={customers}
        warehouses={warehouses}
        invoices={posInvoices}
        summary={posSummary}
        onClose={() => setPosModalOpen(false)}
        onCreateSale={handleRecordPosSale}
        onCancelInvoice={handleCancelPosInvoice}
        onPrintInvoice={handlePrintInvoice}
        onOpenProductDigitalFile={(productId) => {
          setPosModalOpen(false);
          void openDigitalFileForProduct(productId, 'management');
        }}
        onPrintAggregateInvoices={(filters) =>
          openReportsHub({
            reportType: 'invoices_aggregate',
            startDate: filters.startDate,
            endDate: filters.endDate,
            customerId: filters.customerId,
            productId: filters.productId,
            category: filters.category,
          })
        }
        onPrintSalesReport={(filters) =>
          openReportsHub({
            reportType: 'sales',
            startDate: filters.startDate,
            endDate: filters.endDate,
            customerId: filters.customerId,
            productId: filters.productId,
            category: filters.category,
          })
        }
      />

      {/* Global Confirmation Toast */}
      {toastMessage && (
        <div
          dir={lang === 'ar' ? 'rtl' : 'ltr'}
          role="status"
          aria-live="polite"
          className="fixed bottom-20 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-center justify-between gap-3 rounded-2xl border border-[#10B981]/40 bg-[#115E3B] px-4 py-3 text-xs font-semibold text-white shadow-xl sm:bottom-6 dark:border-[#34D399]/40 dark:bg-[#10B981] dark:text-[#052E1C]"
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span className="leading-snug">{toastMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastMessage('')}
            aria-label={t.close}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg hover:bg-white/15 dark:hover:bg-black/10"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
