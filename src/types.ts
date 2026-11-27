export type Language = 'fr' | 'ar';

export interface ProductPhoto {
  id: string;
  productId: string;
  photoCode: string;
  imageData: string;
  sortOrder: number;
  createdAt: string;
}

export interface Product {
  id: string;
  code: string;
  qrToken?: string;
  name: string;
  nameFr?: string;
  nameAr?: string;
  description: string;
  descriptionFr?: string;
  descriptionAr?: string;
  category?: string;
  categoryFr?: string;
  categoryAr?: string;
  color?: string;
  colorFr?: string;
  colorAr?: string;
  warehouseId?: string;
  warehouseName?: string;
  supplierId?: string;
  supplier?: string;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  thicknessCm: number;
  piecesCount: number;
  quantity: number;
  referencePrice: number;
  expenses: number;
  sellingPrice: number;
  addedDate: string;
  createdAt: string;
  updatedAt: string;
  photos: ProductPhoto[];
}

export interface InventorySummary {
  totalReferences: number;
  totalUnits: number;
  totalSellingValue: number;
  totalReferenceCost: number;
}

export type PrinterMode = 'pdf_system' | 'thermal_bt' | 'browser';
export type PrinterPaperFormat = 'a4' | 'label_50x30' | 'label_40x30' | 'roll_58' | 'roll_80';

export interface SavedPrinterProfile {
  id: string;
  name: string;
  mode: PrinterMode;
  paper: PrinterPaperFormat;
  isBluetooth?: boolean;
}

export interface ShopSettings {
  customLogo: string;
  storeName?: string;
  currency: string;
  facebookHandle?: string;
  instagramHandle?: string;
  whatsappPhone?: string;
  companyAddress?: string;
  companyMobile?: string;
  companyPhone?: string;
  companyWebsite?: string;
  companyRc?: string;
  companyIce?: string;
  companyIf?: string;
  companyCnss?: string;
  printerMode?: PrinterMode;
  printerPaper?: PrinterPaperFormat;
  printerName?: string;
  printerLinked?: boolean;
  savedPrinters?: SavedPrinterProfile[];
  activePrinterId?: string;
  publicAppUrl?: string;
}

export interface ProductPayload {
  code?: string;
  name: string;
  nameFr?: string;
  nameAr?: string;
  description: string;
  descriptionFr?: string;
  descriptionAr?: string;
  category?: string;
  categoryFr?: string;
  categoryAr?: string;
  color?: string;
  colorFr?: string;
  colorAr?: string;
  warehouseId?: string;
  warehouseName?: string;
  supplierId?: string;
  supplier?: string;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  thicknessCm: number;
  piecesCount: number;
  quantity: number;
  referencePrice: number;
  expenses: number;
  sellingPrice: number;
  addedDate: string;
  photos: Array<{ id?: string; imageData: string }>;
  regenerateCode?: boolean;
}

export type ExcelImportMode = 'skip' | 'update';

export interface ExcelImportResult {
  addedCount: number;
  updatedCount: number;
  skippedCount: number;
  products: Product[];
  summary: InventorySummary;
}

export type ProductHistoryEventType =
  | 'created'
  | 'updated'
  | 'qr_scanned'
  | 'sold'
  | 'restocked'
  | 'invoice_created'
  | 'adjusted'
  | 'transferred';

export interface ProductHistoryEvent {
  id: string;
  productId: string;
  eventType: ProductHistoryEventType;
  summary: string;
  details: string;
  quantityDelta: number;
  quantityAfter: number;
  createdAt: string;
}

export type PosDocumentType = 'bl' | 'facture';

export interface PosPaymentSplit {
  method: Exclude<PurchasePaymentMethod, 'mixed'>;
  amount: number;
}

export interface PosSummary {
  totalInvoices: number;
  totalFormalInvoices: number;
  totalBlCount: number;
  todayBlCount: number;
  totalUnitsSold: number;
  totalRevenueMad: number;
  totalProfitMad: number;
  nextBlSeq: number;
}

export interface PosInvoiceItem {
  productId: string;
  productCode: string;
  productName: string;
  category?: string;
  color?: string;
  warehouseId?: string;
  warehouseName?: string;
  supplier?: string;
  quantity: number;
  unitPrice: number;
  discountPercent?: number;
  totalPrice: number;
  purchasePrice: number;
}

export interface PosInvoice {
  id: string;
  invoiceNumber: string;
  documentType?: PosDocumentType;
  blNumber?: string;
  productId: string;
  productCode: string;
  productName: string;
  category?: string;
  warehouseId?: string;
  warehouseName?: string;
  items?: PosInvoiceItem[];
  customerId: string;
  customerName: string;
  customerPhone: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  purchasePrice: number;
  paymentMethod: PurchasePaymentMethod;
  paymentBreakdown?: PosPaymentSplit[];
  saleDate: string;
  notes: string;
  printCount?: number;
  createdAt: string;
}

export interface PosSaleItemPayload {
  productId: string;
  quantity: number;
  unitPrice: number;
  discountPercent?: number;
}

export interface PosSalePayload {
  productId?: string;
  quantity?: number;
  unitPrice?: number;
  items?: PosSaleItemPayload[];
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  paymentMethod?: PurchasePaymentMethod;
  paymentBreakdown?: PosPaymentSplit[];
  documentType?: PosDocumentType;
  blNumber?: string;
  saleDate?: string;
  notes?: string;
  source?: 'qr_scan' | 'pos_manual';
}

export interface ProductDigitalFile {
  product: Product;
  invoices: PosInvoice[];
  history: ProductHistoryEvent[];
  salesStats: {
    totalUnitsSold: number;
    totalRevenueMad: number;
    totalInvoices: number;
    lastSaleDate: string;
  };
}

export interface MetaIgAccount {
  id: string;
  username: string;
  name?: string;
  profilePictureUrl?: string;
}

export interface MetaPageAccount {
  id: string;
  name: string;
  pictureUrl?: string;
  igAccount?: MetaIgAccount;
}

export interface MetaAuthStatus {
  configured: boolean;
  callbackUrl: string;
  connected: boolean;
  userName?: string;
  userPicture?: string;
  pages: MetaPageAccount[];
  selectedPageId?: string;
  selectedIgId?: string;
}

export interface FacebookPublishPayload {
  message: string;
  mediaDataUrl?: string;
  mediaType?: 'image' | 'video' | 'none';
  pageId?: string;
}

export interface InstagramPublishPayload {
  caption: string;
  mediaDataUrl: string;
  publishMode: 'post' | 'reel';
  shareToFeed?: boolean;
  location?: string;
  igAccountId?: string;
}

export type CustomerCategory = 'seller' | 'hobbyist' | 'regular' | 'other';

export type PurchasePaymentMethod =
  | 'cash'
  | 'transfer'
  | 'check'
  | 'card'
  | 'credit'
  | 'mixed'
  | 'other';

export type CustomerImageSource = 'facebook' | 'instagram' | 'website' | 'upload';

export interface CustomerGalleryImage {
  id: string;
  customerId: string;
  title: string;
  source: CustomerImageSource;
  sourceUrl: string;
  imageData: string;
  createdAt: string;
}

export interface CustomerGalleryPayload {
  title?: string;
  source: CustomerImageSource;
  sourceUrl?: string;
  imageData?: string;
  imageUrl?: string;
}

export interface CustomerPurchase {
  id: string;
  customerId: string;
  productId?: string;
  productCode: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  purchaseDate: string;
  paymentMethod: PurchasePaymentMethod;
  notes: string;
  createdAt: string;
}

export interface Customer {
  id: string;
  code: string;
  name: string;
  phone: string;
  address: string;
  city: string;
  category: CustomerCategory;
  notes: string;
  facebookUrl?: string;
  instagramUrl?: string;
  websiteUrl?: string;
  createdAt: string;
  updatedAt: string;
  purchases: CustomerPurchase[];
  gallery: CustomerGalleryImage[];
}

export interface CustomerSummary {
  totalCustomers: number;
  totalPurchases: number;
  totalRevenueMad: number;
}

export interface CustomerPayload {
  name: string;
  phone: string;
  address: string;
  city: string;
  category: CustomerCategory;
  notes: string;
  facebookUrl?: string;
  instagramUrl?: string;
  websiteUrl?: string;
}

export interface CustomerPurchasePayload {
  productId?: string;
  productCode: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  purchaseDate: string;
  paymentMethod: PurchasePaymentMethod;
  notes: string;
}

export interface Warehouse {
  id: string;
  code: string;
  name: string;
  location: string;
  address: string;
  phone: string;
  managerName: string;
  notes: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WarehousePayload {
  name: string;
  location: string;
  address: string;
  phone: string;
  managerName: string;
  notes: string;
  isDefault?: boolean;
}

export type SupplierCategory = 'artisan' | 'wholesaler' | 'collector' | 'other';

export interface SupplierGalleryImage {
  id: string;
  supplierId: string;
  title: string;
  source: CustomerImageSource;
  sourceUrl: string;
  imageData: string;
  createdAt: string;
}

export interface SupplierGalleryPayload {
  title?: string;
  source: CustomerImageSource;
  sourceUrl?: string;
  imageData?: string;
  imageUrl?: string;
}

export interface SupplierPurchase {
  id: string;
  supplierId: string;
  productId?: string;
  productCode: string;
  productName: string;
  category?: string;
  warehouseId?: string;
  warehouseName?: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  purchaseDate: string;
  paymentMethod: PurchasePaymentMethod;
  notes: string;
  createdAt: string;
}

export interface Supplier {
  id: string;
  code: string;
  name: string;
  phone: string;
  address: string;
  city: string;
  category: SupplierCategory;
  notes: string;
  facebookUrl?: string;
  instagramUrl?: string;
  websiteUrl?: string;
  createdAt: string;
  updatedAt: string;
  purchases: SupplierPurchase[];
  gallery: SupplierGalleryImage[];
}

export interface SupplierSummary {
  totalSuppliers: number;
  totalPurchases: number;
  totalSpentMad: number;
}

export interface SupplierPayload {
  name: string;
  phone: string;
  address: string;
  city: string;
  category: SupplierCategory;
  notes: string;
  facebookUrl?: string;
  instagramUrl?: string;
  websiteUrl?: string;
}

export interface SupplierPurchasePayload {
  productId?: string;
  productCode: string;
  productName: string;
  category?: string;
  warehouseId?: string;
  warehouseName?: string;
  quantity: number;
  unitCost: number;
  purchaseDate: string;
  paymentMethod: PurchasePaymentMethod;
  notes: string;
}

export type AdjustmentType =
  | 'deduction'
  | 'restock'
  | 'damage'
  | 'loss'
  | 'transfer'
  | 'correction';

export interface InventoryAdjustment {
  id: string;
  referenceNumber: string;
  adjustmentType: AdjustmentType;
  warehouseId: string;
  warehouseName: string;
  targetWarehouseId: string;
  targetWarehouseName: string;
  productId: string;
  productCode: string;
  productName: string;
  category: string;
  color: string;
  supplierId: string;
  supplierName: string;
  quantityBefore: number;
  quantityDelta: number;
  quantityAfter: number;
  unitCost: number;
  totalValue: number;
  reason: string;
  notes: string;
  adjustmentDate: string;
  createdAt: string;
}

export interface InventoryAdjustmentPayload {
  adjustmentType: AdjustmentType;
  warehouseId?: string;
  targetWarehouseId?: string;
  productId: string;
  quantityDelta: number;
  supplierId?: string;
  reason: string;
  notes?: string;
  adjustmentDate?: string;
}

export type ReportType =
  | 'invoice_single'
  | 'invoices_aggregate'
  | 'inventory'
  | 'customers'
  | 'suppliers'
  | 'purchases'
  | 'sales'
  | 'products'
  | 'product_single'
  | 'warehouses'
  | 'cash_register_summary';

export interface ReportFilters {
  reportType: ReportType;
  startDate?: string;
  endDate?: string;
  timeOfDay?: 'all' | 'morning' | 'afternoon';
  warehouseId?: string;
  category?: string;
  productId?: string;
  customerId?: string;
  supplierId?: string;
  invoiceId?: string;
  isCopy?: boolean;
}

