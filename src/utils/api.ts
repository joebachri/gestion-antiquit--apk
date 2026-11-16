import { Capacitor } from '@capacitor/core';
import type { InventorySummary, Product, ProductPayload, ShopSettings } from '../types';
import {
  localCreateProduct,
  localDeleteProduct,
  localGetSettings,
  localListProducts,
  localNextCode,
  localSaveSettings,
  localUpdateProduct,
} from './storage';

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
