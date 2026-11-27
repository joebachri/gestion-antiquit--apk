import { Capacitor } from '@capacitor/core';
import type {
  Customer,
  CustomerGalleryPayload,
  CustomerPayload,
  CustomerPurchasePayload,
  CustomerSummary,
  ExcelImportMode,
  ExcelImportResult,
  FacebookPublishPayload,
  InstagramPublishPayload,
  InventoryAdjustment,
  InventoryAdjustmentPayload,
  InventorySummary,
  MetaAuthStatus,
  PosInvoice,
  PosSalePayload,
  PosSummary,
  Product,
  ProductDigitalFile,
  ProductPayload,
  ShopSettings,
  Supplier,
  SupplierGalleryPayload,
  SupplierPayload,
  SupplierPurchasePayload,
  SupplierSummary,
  Warehouse,
  WarehousePayload,
} from '../types';
import {
  localAddCustomerGalleryImages,
  localAddPurchase,
  localAddSupplierGalleryImages,
  localAddSupplierPurchase,
  localConvertBlToInvoice,
  localCreateAdjustment,
  localCreateCustomer,
  localCreatePosSale,
  localCreateProduct,
  localCreateSupplier,
  localCreateWarehouse,
  localDeleteAdjustment,
  localDeleteCustomer,
  localDeleteCustomerGalleryImage,
  localDeletePosSale,
  localDeleteProduct,
  localDeletePurchase,
  localDeleteSupplier,
  localDeleteSupplierGalleryImage,
  localDeleteSupplierPurchase,
  localDeleteWarehouse,
  localGetProductDigitalFile,
  localGetProductDigitalFileByQr,
  localGetSettings,
  localImportProducts,
  localListAdjustments,
  localListCustomers,
  localListPosSales,
  localListProducts,
  localListSuppliers,
  localListWarehouses,
  localMarkInvoicePrinted,
  localNextCode,
  localSaveSettings,
  localSetNextBlSequence,
  localUpdateCustomer,
  localUpdateProduct,
  localUpdatePurchase,
  localUpdateSupplier,
  localUpdateSupplierPurchase,
  localUpdateWarehouse,
} from './storage';
import { getExchangeRates, setExchangeRates } from './currency';
import { buildDigitalFileFromQrSnapshot } from './qr';

const isNative = () => Capacitor.isNativePlatform();

export async function fetchProductsApi(
  query: string
): Promise<{ products: Product[]; summary: InventorySummary }> {
  if (isNative()) {
    return localListProducts(query);
  }
  try {
    const params = new URLSearchParams();
    if (query.trim()) params.set('q', query.trim());
    const res = await fetch(`/api/products?${params.toString()}`);
    if (!res.ok) throw new Error('HTTP error');
    return (await res.json()) as { products: Product[]; summary: InventorySummary };
  } catch {
    return localListProducts(query);
  }
}

export async function fetchNextCodeApi(name: string, excludeId?: string): Promise<string> {
  if (isNative()) {
    return localNextCode(name, excludeId);
  }
  try {
    const params = new URLSearchParams({ name: name || 'A' });
    if (excludeId) params.set('excludeId', excludeId);
    const res = await fetch(`/api/next-code?${params.toString()}`);
    if (!res.ok) throw new Error('HTTP error');
    const data = (await res.json()) as { code: string };
    return data.code;
  } catch {
    return localNextCode(name, excludeId);
  }
}

export async function saveProductApi(payload: ProductPayload, editingId?: string): Promise<Product> {
  if (isNative()) {
    return editingId ? localUpdateProduct(editingId, payload) : localCreateProduct(payload);
  }
  const url = editingId ? `/api/products/${editingId}` : '/api/products';
  const method = editingId ? 'PUT' : 'POST';
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error('Save failed');
  }
  const data = (await res.json()) as { product: Product };
  return data.product;
}

export async function deleteProductApi(productId: string): Promise<void> {
  if (isNative()) {
    await localDeleteProduct(productId);
    return;
  }
  const res = await fetch(`/api/products/${productId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Delete failed');
}

export async function importProductsExcelApi(
  items: ProductPayload[],
  mode: ExcelImportMode = 'skip'
): Promise<ExcelImportResult> {
  if (isNative()) {
    return localImportProducts(items, mode);
  }
  const res = await fetch('/api/products/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items, mode }),
  });
  if (!res.ok) {
    throw new Error('Import failed');
  }
  return (await res.json()) as ExcelImportResult;
}

export async function fetchSettingsApi(): Promise<ShopSettings> {
  if (isNative()) {
    return localGetSettings();
  }
  try {
    const res = await fetch('/api/settings');
    if (!res.ok) throw new Error('HTTP error');
    return (await res.json()) as ShopSettings;
  } catch {
    return localGetSettings();
  }
}

export async function saveSettingsApi(settings: ShopSettings): Promise<ShopSettings> {
  if (isNative()) {
    return localSaveSettings(settings);
  }
  const res = await fetch('/api/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
  if (!res.ok) throw new Error('Settings save failed');
  return (await res.json()) as ShopSettings;
}

export async function fetchMetaAuthStatusApi(): Promise<MetaAuthStatus> {
  const fallback: MetaAuthStatus = {
    configured: false,
    callbackUrl: `${window.location.origin}/auth/meta/callback`,
    connected: false,
    pages: [],
  };
  if (isNative()) return fallback;
  try {
    const res = await fetch('/api/auth/meta/status', { credentials: 'same-origin' });
    if (!res.ok) return fallback;
    return (await res.json()) as MetaAuthStatus;
  } catch {
    return fallback;
  }
}

export async function startMetaOAuthPopup(): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch('/api/auth/meta/url', { credentials: 'same-origin' });
  const data = (await res.json()) as { url?: string; error?: string; callbackUrl?: string };
  if (!res.ok || !data.url) {
    return { ok: false, error: data.error || 'META_OAUTH_NOT_CONFIGURED' };
  }

  return new Promise((resolve) => {
    const authWindow = window.open(data.url, 'meta_oauth_popup', 'width=600,height=720');
    if (!authWindow) {
      resolve({ ok: false, error: 'POPUP_BLOCKED' });
      return;
    }

    let settled = false;
    const cleanup = () => {
      window.removeEventListener('message', onMessage);
      clearInterval(closePoll);
      clearTimeout(timeoutId);
    };

    const finish = (result: { ok: boolean; error?: string }) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(result);
    };

    const onMessage = (event: MessageEvent) => {
      const origin = event.origin || '';
      if (
        origin !== window.location.origin &&
        !origin.endsWith('.run.app') &&
        !origin.includes('localhost')
      ) {
        return;
      }
      if (event.data?.type === 'META_OAUTH_SUCCESS') {
        finish({ ok: true });
      } else if (event.data?.type === 'META_OAUTH_ERROR') {
        finish({ ok: false, error: String(event.data.error || 'OAuth failed') });
      }
    };

    window.addEventListener('message', onMessage);

    const closePoll = setInterval(() => {
      if (authWindow.closed) {
        finish({ ok: false, error: 'CANCELED' });
      }
    }, 500);

    const timeoutId = setTimeout(() => {
      finish({ ok: false, error: 'TIMEOUT' });
    }, 180_000);
  });
}

export async function selectMetaTargetsApi(
  selectedPageId?: string,
  selectedIgId?: string
): Promise<void> {
  if (isNative()) return;
  await fetch('/api/auth/meta/select', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ selectedPageId, selectedIgId }),
  });
}

export async function disconnectMetaAuthApi(): Promise<void> {
  if (isNative()) return;
  await fetch('/api/auth/meta/disconnect', {
    method: 'POST',
    credentials: 'same-origin',
  });
}

export async function publishFacebookApi(
  payload: FacebookPublishPayload
): Promise<{ ok: boolean; postId?: string; postUrl?: string; error?: string }> {
  const res = await fetch('/api/social/publish/facebook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(payload),
  });
  const data = (await res.json()) as {
    ok?: boolean;
    postId?: string;
    postUrl?: string;
    error?: string;
  };
  if (!res.ok || !data.ok) {
    return { ok: false, error: data.error || 'Publish failed' };
  }
  return { ok: true, postId: data.postId, postUrl: data.postUrl };
}

export async function publishInstagramApi(
  payload: InstagramPublishPayload
): Promise<{ ok: boolean; mediaId?: string; permalink?: string; error?: string }> {
  const res = await fetch('/api/social/publish/instagram', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(payload),
  });
  const data = (await res.json()) as {
    ok?: boolean;
    mediaId?: string;
    permalink?: string;
    error?: string;
  };
  if (!res.ok || !data.ok) {
    return { ok: false, error: data.error || 'Publish failed' };
  }
  return { ok: true, mediaId: data.mediaId, permalink: data.permalink };
}

export async function fetchExchangeRatesApi(): Promise<Record<string, number>> {
  if (isNative()) {
    return getExchangeRates();
  }
  try {
    const res = await fetch('/api/exchange-rates');
    if (!res.ok) return getExchangeRates();
    const data = (await res.json()) as { rates?: Record<string, number> };
    if (data.rates) {
      setExchangeRates(data.rates);
    }
  } catch {
    // keep cached/default rates
  }
  return getExchangeRates();
}

export async function fetchCustomersApi(
  query: string,
  category?: string
): Promise<{ customers: Customer[]; summary: CustomerSummary }> {
  if (isNative()) {
    return localListCustomers(query, category);
  }
  try {
    const params = new URLSearchParams();
    if (query.trim()) params.set('q', query.trim());
    if (category && category !== 'all') params.set('category', category);
    const res = await fetch(`/api/customers?${params.toString()}`);
    if (!res.ok) throw new Error('HTTP error');
    return (await res.json()) as { customers: Customer[]; summary: CustomerSummary };
  } catch {
    return localListCustomers(query, category);
  }
}

export async function saveCustomerApi(
  payload: CustomerPayload,
  editingId?: string
): Promise<Customer> {
  if (isNative()) {
    return editingId ? localUpdateCustomer(editingId, payload) : localCreateCustomer(payload);
  }
  const url = editingId ? `/api/customers/${editingId}` : '/api/customers';
  const method = editingId ? 'PUT' : 'POST';
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Customer save failed');
  const data = (await res.json()) as { customer: Customer };
  return data.customer;
}

export async function deleteCustomerApi(customerId: string): Promise<void> {
  if (isNative()) {
    await localDeleteCustomer(customerId);
    return;
  }
  const res = await fetch(`/api/customers/${customerId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Customer delete failed');
}

export async function saveCustomerPurchaseApi(
  customerId: string,
  payload: CustomerPurchasePayload,
  editingPurchaseId?: string
): Promise<Customer> {
  if (isNative()) {
    return editingPurchaseId
      ? localUpdatePurchase(customerId, editingPurchaseId, payload)
      : localAddPurchase(customerId, payload);
  }
  const url = editingPurchaseId
    ? `/api/customers/${customerId}/purchases/${editingPurchaseId}`
    : `/api/customers/${customerId}/purchases`;
  const method = editingPurchaseId ? 'PUT' : 'POST';
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Purchase save failed');
  const data = (await res.json()) as { customer: Customer };
  return data.customer;
}

export async function deleteCustomerPurchaseApi(
  customerId: string,
  purchaseId: string
): Promise<Customer> {
  if (isNative()) {
    return localDeletePurchase(customerId, purchaseId);
  }
  const res = await fetch(`/api/customers/${customerId}/purchases/${purchaseId}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Purchase delete failed');
  const data = (await res.json()) as { customer: Customer };
  return data.customer;
}

export async function saveCustomerGalleryImagesApi(
  customerId: string,
  items: CustomerGalleryPayload[],
  customerSnapshot?: Partial<Customer>
): Promise<{ customer: Customer; addedCount: number }> {
  if (isNative()) {
    const customer = await localAddCustomerGalleryImages(customerId, items);
    return { customer, addedCount: items.length };
  }
  const res = await fetch(`/api/customers/${customerId}/gallery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items, customerSnapshot }),
  });
  if (!res.ok) throw new Error('Gallery save failed');
  const data = (await res.json()) as { customer: Customer; addedCount: number };
  return data;
}

export async function deleteCustomerGalleryImageApi(
  customerId: string,
  imageId: string
): Promise<Customer> {
  if (isNative()) {
    return localDeleteCustomerGalleryImage(customerId, imageId);
  }
  const res = await fetch(`/api/customers/${customerId}/gallery/${imageId}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Gallery delete failed');
  const data = (await res.json()) as { customer: Customer };
  return data.customer;
}

export async function lookupProductByQrApi(
  codeOrUrl: string,
  logScan = false
): Promise<ProductDigitalFile> {
  if (isNative()) {
    try {
      return await localGetProductDigitalFileByQr(codeOrUrl, logScan);
    } catch {
      const snap = buildDigitalFileFromQrSnapshot(codeOrUrl);
      if (snap) return snap;
      throw new Error('QR_NOT_FOUND');
    }
  }
  try {
    const params = new URLSearchParams({ code: codeOrUrl });
    if (logScan) params.set('logScan', '1');
    const res = await fetch(`/api/products/by-qr?${params.toString()}`);
    if (res.ok) {
      return (await res.json()) as ProductDigitalFile;
    }
  } catch {
    // fallback to local IndexedDB below
  }
  try {
    return await localGetProductDigitalFileByQr(codeOrUrl, logScan);
  } catch {
    const snap = buildDigitalFileFromQrSnapshot(codeOrUrl);
    if (snap) return snap;
    throw new Error('QR_NOT_FOUND');
  }
}

export async function fetchProductDigitalFileApi(
  productId: string,
  logScan = false
): Promise<ProductDigitalFile> {
  if (isNative()) {
    return localGetProductDigitalFile(productId, logScan);
  }
  const params = new URLSearchParams();
  if (logScan) params.set('logScan', '1');
  const res = await fetch(`/api/products/${productId}/digital-file?${params.toString()}`);
  if (!res.ok) {
    throw new Error('NOT_FOUND');
  }
  return (await res.json()) as ProductDigitalFile;
}

export async function fetchPosSalesApi(): Promise<{
  invoices: PosInvoice[];
  summary: PosSummary;
}> {
  if (isNative()) {
    return localListPosSales();
  }
  try {
    const res = await fetch('/api/pos/sales');
    if (!res.ok) throw new Error('HTTP error');
    return (await res.json()) as {
      invoices: PosInvoice[];
      summary: PosSummary;
    };
  } catch {
    return localListPosSales();
  }
}

export async function createPosSaleApi(payload: PosSalePayload): Promise<{
  invoice: PosInvoice;
  digitalFile: ProductDigitalFile;
  summary: InventorySummary;
  nextBlSeq?: number;
}> {
  if (isNative()) {
    return localCreatePosSale(payload);
  }
  const res = await fetch('/api/pos/sales', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (res.status === 409) {
    throw new Error('OUT_OF_STOCK');
  }
  if (!res.ok) {
    throw new Error('POS_SALE_FAILED');
  }
  return (await res.json()) as {
    invoice: PosInvoice;
    digitalFile: ProductDigitalFile;
    summary: InventorySummary;
    nextBlSeq?: number;
  };
}

export async function setNextBlSequenceApi(
  nextSeqOrLabel: number | string
): Promise<{ nextBlSeq: number; blNumber: string }> {
  if (isNative()) {
    return localSetNextBlSequence(nextSeqOrLabel);
  }
  try {
    const res = await fetch('/api/pos/bl-sequence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        typeof nextSeqOrLabel === 'number'
          ? { nextSeq: nextSeqOrLabel }
          : { blNumber: nextSeqOrLabel }
      ),
    });
    if (!res.ok) throw new Error('HTTP error');
    return (await res.json()) as { nextBlSeq: number; blNumber: string };
  } catch {
    return localSetNextBlSequence(nextSeqOrLabel);
  }
}

export async function convertBlToInvoiceApi(invoiceId: string): Promise<PosInvoice> {
  if (isNative()) {
    return localConvertBlToInvoice(invoiceId);
  }
  const res = await fetch(`/api/pos/sales/${invoiceId}/convert`, { method: 'POST' });
  if (!res.ok) throw new Error('Convert BL failed');
  const data = (await res.json()) as { invoice: PosInvoice };
  return data.invoice;
}

export async function deletePosSaleApi(invoiceId: string): Promise<void> {
  if (isNative()) {
    await localDeletePosSale(invoiceId);
    return;
  }
  const res = await fetch(`/api/pos/sales/${invoiceId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Delete invoice failed');
}

export async function markInvoicePrintedApi(invoiceId: string): Promise<PosInvoice> {
  if (isNative()) {
    return localMarkInvoicePrinted(invoiceId);
  }
  try {
    const res = await fetch(`/api/pos/sales/${invoiceId}/print`, { method: 'POST' });
    if (!res.ok) throw new Error('HTTP error');
    const data = (await res.json()) as { invoice: PosInvoice };
    return data.invoice;
  } catch {
    return localMarkInvoicePrinted(invoiceId);
  }
}

// Warehouses API
export async function fetchWarehousesApi(): Promise<{ warehouses: Warehouse[] }> {
  if (isNative()) {
    return localListWarehouses();
  }
  try {
    const res = await fetch('/api/warehouses');
    if (!res.ok) throw new Error('HTTP error');
    return (await res.json()) as { warehouses: Warehouse[] };
  } catch {
    return localListWarehouses();
  }
}

export async function saveWarehouseApi(
  payload: WarehousePayload,
  editingId?: string
): Promise<Warehouse> {
  if (isNative()) {
    return editingId ? localUpdateWarehouse(editingId, payload) : localCreateWarehouse(payload);
  }
  const url = editingId ? `/api/warehouses/${editingId}` : '/api/warehouses';
  const method = editingId ? 'PUT' : 'POST';
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Warehouse save failed');
  const data = (await res.json()) as { warehouse: Warehouse };
  return data.warehouse;
}

export async function deleteWarehouseApi(warehouseId: string): Promise<void> {
  if (isNative()) {
    await localDeleteWarehouse(warehouseId);
    return;
  }
  const res = await fetch(`/api/warehouses/${warehouseId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Warehouse delete failed');
}

// Suppliers API
export async function fetchSuppliersApi(
  query: string,
  category?: string
): Promise<{ suppliers: Supplier[]; summary: SupplierSummary }> {
  if (isNative()) {
    return localListSuppliers(query, category);
  }
  try {
    const params = new URLSearchParams();
    if (query.trim()) params.set('q', query.trim());
    if (category && category !== 'all') params.set('category', category);
    const res = await fetch(`/api/suppliers?${params.toString()}`);
    if (!res.ok) throw new Error('HTTP error');
    return (await res.json()) as { suppliers: Supplier[]; summary: SupplierSummary };
  } catch {
    return localListSuppliers(query, category);
  }
}

export async function saveSupplierApi(
  payload: SupplierPayload,
  editingId?: string
): Promise<Supplier> {
  if (isNative()) {
    return editingId ? localUpdateSupplier(editingId, payload) : localCreateSupplier(payload);
  }
  const url = editingId ? `/api/suppliers/${editingId}` : '/api/suppliers';
  const method = editingId ? 'PUT' : 'POST';
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Supplier save failed');
  const data = (await res.json()) as { supplier: Supplier };
  return data.supplier;
}

export async function deleteSupplierApi(supplierId: string): Promise<void> {
  if (isNative()) {
    await localDeleteSupplier(supplierId);
    return;
  }
  const res = await fetch(`/api/suppliers/${supplierId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Supplier delete failed');
}

export async function saveSupplierPurchaseApi(
  supplierId: string,
  payload: SupplierPurchasePayload,
  editingPurchaseId?: string
): Promise<Supplier> {
  if (isNative()) {
    return editingPurchaseId
      ? localUpdateSupplierPurchase(supplierId, editingPurchaseId, payload)
      : localAddSupplierPurchase(supplierId, payload);
  }
  const url = editingPurchaseId
    ? `/api/suppliers/${supplierId}/purchases/${editingPurchaseId}`
    : `/api/suppliers/${supplierId}/purchases`;
  const method = editingPurchaseId ? 'PUT' : 'POST';
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Supplier purchase save failed');
  const data = (await res.json()) as { supplier: Supplier };
  return data.supplier;
}

export async function deleteSupplierPurchaseApi(
  supplierId: string,
  purchaseId: string
): Promise<Supplier> {
  if (isNative()) {
    return localDeleteSupplierPurchase(supplierId, purchaseId);
  }
  const res = await fetch(`/api/suppliers/${supplierId}/purchases/${purchaseId}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Supplier purchase delete failed');
  const data = (await res.json()) as { supplier: Supplier };
  return data.supplier;
}

export async function saveSupplierGalleryImagesApi(
  supplierId: string,
  items: SupplierGalleryPayload[]
): Promise<{ supplier: Supplier; addedCount: number }> {
  if (isNative()) {
    const supplier = await localAddSupplierGalleryImages(supplierId, items);
    return { supplier, addedCount: items.length };
  }
  const res = await fetch(`/api/suppliers/${supplierId}/gallery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  });
  if (!res.ok) throw new Error('Supplier gallery save failed');
  return (await res.json()) as { supplier: Supplier; addedCount: number };
}

export async function deleteSupplierGalleryImageApi(
  supplierId: string,
  imageId: string
): Promise<Supplier> {
  if (isNative()) {
    return localDeleteSupplierGalleryImage(supplierId, imageId);
  }
  const res = await fetch(`/api/suppliers/${supplierId}/gallery/${imageId}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Supplier gallery delete failed');
  const data = (await res.json()) as { supplier: Supplier };
  return data.supplier;
}

// Inventory Adjustments API
export async function fetchAdjustmentsApi(): Promise<{ adjustments: InventoryAdjustment[] }> {
  if (isNative()) {
    return localListAdjustments();
  }
  try {
    const res = await fetch('/api/adjustments');
    if (!res.ok) throw new Error('HTTP error');
    return (await res.json()) as { adjustments: InventoryAdjustment[] };
  } catch {
    return localListAdjustments();
  }
}

export async function createAdjustmentApi(
  payload: InventoryAdjustmentPayload
): Promise<{ adjustment: InventoryAdjustment; summary: InventorySummary }> {
  if (isNative()) {
    return localCreateAdjustment(payload);
  }
  const res = await fetch('/api/adjustments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Adjustment failed');
  return (await res.json()) as { adjustment: InventoryAdjustment; summary: InventorySummary };
}

export async function deleteAdjustmentApi(adjustmentId: string): Promise<void> {
  if (isNative()) {
    await localDeleteAdjustment(adjustmentId);
    return;
  }
  const res = await fetch(`/api/adjustments/${adjustmentId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Adjustment delete failed');
}


