import { Capacitor } from '@capacitor/core';
import type {
  Customer,
  CustomerGalleryPayload,
  CustomerPayload,
  CustomerPurchasePayload,
  CustomerSummary,
  FacebookPublishPayload,
  FetchCustomerSourceImagesResult,
  InstagramPublishPayload,
  InventorySummary,
  MetaAuthStatus,
  Product,
  ProductPayload,
  ShopSettings,
} from '../types';
import {
  localAddCustomerGalleryImages,
  localAddPurchase,
  localCreateCustomer,
  localCreateProduct,
  localDeleteCustomer,
  localDeleteCustomerGalleryImage,
  localDeleteProduct,
  localDeletePurchase,
  localGetSettings,
  localListCustomers,
  localListProducts,
  localNextCode,
  localSaveSettings,
  localUpdateCustomer,
  localUpdateProduct,
  localUpdatePurchase,
} from './storage';
import { getExchangeRates, setExchangeRates } from './currency';
import { compressImageBlob } from './image';

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

export async function saveProductApi(payload: ProductPayload, editingId?: string): Promise<void> {
  if (isNative()) {
    if (editingId) {
      await localUpdateProduct(editingId, payload);
    } else {
      await localCreateProduct(payload);
    }
    return;
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
}

export async function deleteProductApi(productId: string): Promise<void> {
  if (isNative()) {
    await localDeleteProduct(productId);
    return;
  }
  const res = await fetch(`/api/products/${productId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Delete failed');
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

export async function fetchCustomerSourceImagesApi(
  customerId: string,
  source: 'facebook' | 'instagram' | 'website',
  customUrl?: string
): Promise<FetchCustomerSourceImagesResult> {
  if (isNative()) {
    const trimmed = (customUrl || '').trim();
    if (trimmed && /^https?:\/\//i.test(trimmed)) {
      try {
        const res = await fetch(trimmed);
        if (res.ok && (res.headers.get('content-type') || '').startsWith('image/')) {
          const blob = await res.blob();
          const dataUrl = await compressImageBlob(blob, 1280, 0.86);
          return {
            targetUrl: trimmed,
            source,
            images: [
              {
                id: `${Date.now()}`,
                imageUrl: trimmed,
                previewDataUrl: dataUrl,
                title: '',
                source,
              },
            ],
          };
        }
      } catch {
        // fall through to blocked hint
      }
    }
    return {
      targetUrl: trimmed,
      source,
      images: [],
      blockedOrEmptyReason: 'BLOCKED_OR_LOGIN_REQUIRED',
    };
  }

  const res = await fetch(`/api/customers/${customerId}/gallery/fetch-source`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source, customUrl }),
  });
  if (!res.ok) {
    const errData = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(errData.error || 'Fetch source failed');
  }
  return (await res.json()) as FetchCustomerSourceImagesResult;
}

export async function saveCustomerGalleryImagesApi(
  customerId: string,
  items: CustomerGalleryPayload[]
): Promise<{ customer: Customer; addedCount: number }> {
  if (isNative()) {
    const customer = await localAddCustomerGalleryImages(customerId, items);
    return { customer, addedCount: items.length };
  }
  const res = await fetch(`/api/customers/${customerId}/gallery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
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

