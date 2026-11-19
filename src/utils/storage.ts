import type {
  Customer,
  CustomerCategory,
  CustomerGalleryImage,
  CustomerGalleryPayload,
  CustomerImageSource,
  CustomerPayload,
  CustomerPurchase,
  CustomerPurchasePayload,
  CustomerSummary,
  InventorySummary,
  Product,
  ProductPayload,
  ProductPhoto,
  PurchasePaymentMethod,
  ShopSettings,
} from '../types';
import { extractPrefixLetter } from './image';
import lanternImg from '../assets/images/antique_copper_lantern_1794787509666.jpg';
import chestImg from '../assets/images/antique_berber_chest_1794787509355.jpg';
import ceramicImg from '../assets/images/antique_fez_ceramic_1794787509914.jpg';
import teaServiceImg from '../assets/images/antique_silver_tea_service_1794787510384.jpg';

const DB_NAME = 'gestion_antiquites_db';
const DB_VERSION = 2;
const STORE_PRODUCTS = 'products';
const STORE_SETTINGS = 'settings';
const STORE_CUSTOMERS = 'customers';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_PRODUCTS)) {
        db.createObjectStore(STORE_PRODUCTS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
        db.createObjectStore(STORE_SETTINGS, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(STORE_CUSTOMERS)) {
        db.createObjectStore(STORE_CUSTOMERS, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getAllFromStore<T>(db: IDBDatabase, storeName: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.getAll();
    req.onsuccess = () => resolve((req.result || []) as T[]);
    req.onerror = () => reject(req.error);
  });
}

function getFromStore<T>(db: IDBDatabase, storeName: string, key: string): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

function putInStore<T>(db: IDBDatabase, storeName: string, value: T): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).put(value);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function deleteFromStore(db: IDBDatabase, storeName: string, key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function buildPhotoCode(productCode: string, index: number): string {
  return index === 0 ? productCode : `${productCode}-${index + 1}`;
}

function computeNextCode(products: Product[], name: string, excludeId?: string): string {
  const prefix = extractPrefixLetter(name);
  let maxNum = 0;
  for (const item of products) {
    if (excludeId && item.id === excludeId) continue;
    if (!item.code.startsWith(prefix)) continue;
    const suffix = item.code.slice(prefix.length);
    if (/^\d+$/.test(suffix)) {
      const n = Number.parseInt(suffix, 10);
      if (n > maxNum) maxNum = n;
    }
  }
  return `${prefix}${String(maxNum + 1).padStart(4, '0')}`;
}

function computeSummary(products: Product[]): InventorySummary {
  let totalUnits = 0;
  let totalSellingValue = 0;
  let totalReferenceCost = 0;

  for (const item of products) {
    const qty = Math.max(0, Number(item.quantity) || 0);
    totalUnits += qty;
    totalSellingValue += qty * (Number(item.sellingPrice) || 0);
    totalReferenceCost += qty * ((Number(item.referencePrice) || 0) + (Number(item.expenses) || 0));
  }

  return {
    totalReferences: products.length,
    totalUnits,
    totalSellingValue,
    totalReferenceCost,
  };
}

async function ensureSeeded(db: IDBDatabase): Promise<void> {
  const seeded = await getFromStore<{ key: string; value: string }>(db, STORE_SETTINGS, 'seeded');
  if (seeded?.value === '1') return;

  const existing = await getAllFromStore<Product>(db, STORE_PRODUCTS);
  if (existing.length > 0) {
    await putInStore(db, STORE_SETTINGS, { key: 'seeded', value: '1' });
    return;
  }

  const now = new Date().toISOString();
  const today = now.slice(0, 10);

  const seeds: Array<{
    name: string;
    description: string;
    lengthCm: number;
    widthCm: number;
    heightCm: number;
    thicknessCm: number;
    piecesCount: number;
    quantity: number;
    referencePrice: number;
    expenses: number;
    sellingPrice: number;
    image: string;
  }> = [
    {
      name: 'Lanterne Fassi en Cuivre Cisélé',
      description:
        "Lanterne octogonale ancienne en laiton et cuivre ajouré à motifs géométriques traditionnels de Fès, patine authentique d'époque.",
      lengthCm: 28,
      widthCm: 28,
      heightCm: 62,
      thicknessCm: 0.4,
      piecesCount: 1,
      quantity: 2,
      referencePrice: 1800,
      expenses: 250,
      sellingPrice: 3200,
      image: lanternImg,
    },
    {
      name: 'Coffre Berbère en Bois de Cèdre Sculpté',
      description:
        'Coffre de mariage ancien du Moyen-Atlas en bois de cèdre massif sculpté à la main, ferrures et moraillon en laiton oxydé.',
      lengthCm: 94,
      widthCm: 48,
      heightCm: 52,
      thicknessCm: 2.5,
      piecesCount: 1,
      quantity: 1,
      referencePrice: 4500,
      expenses: 600,
      sellingPrice: 7800,
      image: chestImg,
    },
    {
      name: 'Plat Ancien en Céramique de Fès',
      description:
        'Grand plat décoratif ancien de Fès émaillé vert émeraude et bleu de cobalt, motif floral étoilé peint à la main.',
      lengthCm: 42,
      widthCm: 42,
      heightCm: 8,
      thicknessCm: 1.2,
      piecesCount: 1,
      quantity: 3,
      referencePrice: 950,
      expenses: 120,
      sellingPrice: 1750,
      image: ceramicImg,
    },
    {
      name: 'Service à Thé Royal en Argent Ciselé',
      description:
        "Théière ancienne gravée à la main sur plateau circulaire ciselé en maillechort argenté, accompagnée de son sucrier d'époque.",
      lengthCm: 46,
      widthCm: 46,
      heightCm: 29,
      thicknessCm: 0.3,
      piecesCount: 3,
      quantity: 1,
      referencePrice: 2600,
      expenses: 300,
      sellingPrice: 4600,
      image: teaServiceImg,
    },
  ];

  const createdList: Product[] = [];
  for (const s of seeds) {
    const id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    const code = computeNextCode(createdList, s.name);
    const product: Product = {
      id,
      code,
      name: s.name,
      description: s.description,
      lengthCm: s.lengthCm,
      widthCm: s.widthCm,
      heightCm: s.heightCm,
      thicknessCm: s.thicknessCm,
      piecesCount: s.piecesCount,
      quantity: s.quantity,
      referencePrice: s.referencePrice,
      expenses: s.expenses,
      sellingPrice: s.sellingPrice,
      addedDate: today,
      createdAt: now,
      updatedAt: now,
      photos: [
        {
          id: crypto.randomUUID ? crypto.randomUUID() : `${id}-p0`,
          productId: id,
          photoCode: buildPhotoCode(code, 0),
          imageData: s.image,
          sortOrder: 0,
          createdAt: now,
        },
      ],
    };
    createdList.push(product);
    await putInStore(db, STORE_PRODUCTS, product);
  }

  await putInStore(db, STORE_SETTINGS, { key: 'seeded', value: '1' });
  await putInStore(db, STORE_SETTINGS, { key: 'currency', value: 'MAD' });
  await putInStore(db, STORE_SETTINGS, { key: 'customLogo', value: '' });
  await putInStore(db, STORE_SETTINGS, { key: 'storeName', value: '' });
}

export async function localListProducts(
  query: string
): Promise<{ products: Product[]; summary: InventorySummary }> {
  const db = await openDb();
  await ensureSeeded(db);
  const all = await getAllFromStore<Product>(db, STORE_PRODUCTS);
  all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const q = query.trim().toLowerCase();
  const filtered = q
    ? all.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.code.toLowerCase().includes(q) ||
          p.photos.some((ph) => ph.photoCode.toLowerCase().includes(q))
      )
    : all;

  return {
    products: filtered,
    summary: computeSummary(all),
  };
}

export async function localNextCode(name: string, excludeId?: string): Promise<string> {
  const db = await openDb();
  await ensureSeeded(db);
  const all = await getAllFromStore<Product>(db, STORE_PRODUCTS);
  return computeNextCode(all, name, excludeId);
}

export async function localCreateProduct(payload: ProductPayload): Promise<Product> {
  const db = await openDb();
  await ensureSeeded(db);
  const all = await getAllFromStore<Product>(db, STORE_PRODUCTS);
  const now = new Date().toISOString();
  const id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
  const code = computeNextCode(all, payload.name);

  const photos: ProductPhoto[] = (payload.photos || []).map((p, idx) => ({
    id: p.id || (crypto.randomUUID ? crypto.randomUUID() : `${id}-p${idx}`),
    productId: id,
    photoCode: buildPhotoCode(code, idx),
    imageData: p.imageData,
    sortOrder: idx,
    createdAt: now,
  }));

  const product: Product = {
    id,
    code,
    name: payload.name.trim(),
    description: payload.description.trim(),
    lengthCm: payload.lengthCm || 0,
    widthCm: payload.widthCm || 0,
    heightCm: payload.heightCm || 0,
    thicknessCm: payload.thicknessCm || 0,
    piecesCount: Math.max(1, payload.piecesCount || 1),
    quantity: Math.max(0, payload.quantity ?? 1),
    referencePrice: payload.referencePrice || 0,
    expenses: payload.expenses || 0,
    sellingPrice: payload.sellingPrice || 0,
    addedDate: payload.addedDate || now.slice(0, 10),
    createdAt: now,
    updatedAt: now,
    photos,
  };

  await putInStore(db, STORE_PRODUCTS, product);
  return product;
}

export async function localUpdateProduct(id: string, payload: ProductPayload): Promise<Product> {
  const db = await openDb();
  await ensureSeeded(db);
  const all = await getAllFromStore<Product>(db, STORE_PRODUCTS);
  const existing = all.find((p) => p.id === id);
  if (!existing) throw new Error('Product not found');

  const now = new Date().toISOString();
  const shouldRegen =
    Boolean(payload.regenerateCode) ||
    extractPrefixLetter(payload.name) !== extractPrefixLetter(existing.name);
  const code = shouldRegen ? computeNextCode(all, payload.name, id) : existing.code;

  const photos: ProductPhoto[] = (payload.photos || []).map((p, idx) => ({
    id: p.id || (crypto.randomUUID ? crypto.randomUUID() : `${id}-p${idx}`),
    productId: id,
    photoCode: buildPhotoCode(code, idx),
    imageData: p.imageData,
    sortOrder: idx,
    createdAt: now,
  }));

  const updated: Product = {
    ...existing,
    code,
    name: payload.name.trim(),
    description: payload.description.trim(),
    lengthCm: payload.lengthCm || 0,
    widthCm: payload.widthCm || 0,
    heightCm: payload.heightCm || 0,
    thicknessCm: payload.thicknessCm || 0,
    piecesCount: Math.max(1, payload.piecesCount || 1),
    quantity: Math.max(0, payload.quantity ?? 1),
    referencePrice: payload.referencePrice || 0,
    expenses: payload.expenses || 0,
    sellingPrice: payload.sellingPrice || 0,
    addedDate: payload.addedDate || existing.addedDate,
    updatedAt: now,
    photos,
  };

  await putInStore(db, STORE_PRODUCTS, updated);
  return updated;
}

export async function localDeleteProduct(id: string): Promise<void> {
  const db = await openDb();
  await deleteFromStore(db, STORE_PRODUCTS, id);
}

export async function localGetSettings(): Promise<ShopSettings> {
  const db = await openDb();
  await ensureSeeded(db);
  const logo = await getFromStore<{ key: string; value: string }>(db, STORE_SETTINGS, 'customLogo');
  const storeName = await getFromStore<{ key: string; value: string }>(
    db,
    STORE_SETTINGS,
    'storeName'
  );
  const currency = await getFromStore<{ key: string; value: string }>(
    db,
    STORE_SETTINGS,
    'currency'
  );
  const facebookHandle = await getFromStore<{ key: string; value: string }>(
    db,
    STORE_SETTINGS,
    'facebookHandle'
  );
  const instagramHandle = await getFromStore<{ key: string; value: string }>(
    db,
    STORE_SETTINGS,
    'instagramHandle'
  );
  return {
    customLogo: logo?.value ?? '',
    storeName: storeName?.value ?? '',
    currency: currency?.value || 'MAD',
    facebookHandle: facebookHandle?.value ?? '',
    instagramHandle: instagramHandle?.value ?? '',
  };
}

export async function localSaveSettings(settings: ShopSettings): Promise<ShopSettings> {
  const db = await openDb();
  await putInStore(db, STORE_SETTINGS, { key: 'customLogo', value: settings.customLogo ?? '' });
  if (typeof settings.storeName === 'string') {
    await putInStore(db, STORE_SETTINGS, {
      key: 'storeName',
      value: settings.storeName.trim().slice(0, 80),
    });
  }
  await putInStore(db, STORE_SETTINGS, { key: 'currency', value: settings.currency || 'MAD' });
  if (typeof settings.facebookHandle === 'string') {
    await putInStore(db, STORE_SETTINGS, {
      key: 'facebookHandle',
      value: settings.facebookHandle.trim(),
    });
  }
  if (typeof settings.instagramHandle === 'string') {
    await putInStore(db, STORE_SETTINGS, {
      key: 'instagramHandle',
      value: settings.instagramHandle.trim(),
    });
  }
  return settings;
}

function computeNextCustomerCode(customers: Customer[]): string {
  let maxNum = 0;
  for (const c of customers) {
    if (c.code.startsWith('CL')) {
      const suffix = c.code.slice(2);
      if (/^\d+$/.test(suffix)) {
        const n = Number.parseInt(suffix, 10);
        if (n > maxNum) maxNum = n;
      }
    }
  }
  return `CL${String(maxNum + 1).padStart(4, '0')}`;
}

function computeCustomerSummary(customers: Customer[]): CustomerSummary {
  let totalPurchases = 0;
  let totalRevenueMad = 0;
  for (const cust of customers) {
    const purchases = cust.purchases || [];
    totalPurchases += purchases.length;
    for (const p of purchases) {
      totalRevenueMad += Number(p.totalPrice) || 0;
    }
  }
  return {
    totalCustomers: customers.length,
    totalPurchases,
    totalRevenueMad,
  };
}

export async function localListCustomers(
  query: string,
  category?: string
): Promise<{ customers: Customer[]; summary: CustomerSummary }> {
  const db = await openDb();
  const all = await getAllFromStore<Customer>(db, STORE_CUSTOMERS);
  all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const q = query.trim().toLowerCase();
  const cat = (category || '').trim().toLowerCase();

  const filtered = all.filter((c) => {
    if (cat && cat !== 'all' && c.category !== cat) return false;
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) ||
      c.code.toLowerCase().includes(q) ||
      c.phone.toLowerCase().includes(q) ||
      c.city.toLowerCase().includes(q) ||
      c.address.toLowerCase().includes(q) ||
      (c.facebookUrl || '').toLowerCase().includes(q) ||
      (c.instagramUrl || '').toLowerCase().includes(q) ||
      (c.websiteUrl || '').toLowerCase().includes(q) ||
      (c.purchases || []).some(
        (p) => p.productName.toLowerCase().includes(q) || p.productCode.toLowerCase().includes(q)
      )
    );
  });

  return {
    customers: filtered.map((c) => ({ ...c, gallery: c.gallery || [] })),
    summary: computeCustomerSummary(all),
  };
}

export async function localCreateCustomer(payload: CustomerPayload): Promise<Customer> {
  const db = await openDb();
  const all = await getAllFromStore<Customer>(db, STORE_CUSTOMERS);
  const now = new Date().toISOString();
  const id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
  const customer: Customer = {
    id,
    code: computeNextCustomerCode(all),
    name: payload.name.trim(),
    phone: payload.phone.trim(),
    address: payload.address.trim(),
    city: payload.city.trim(),
    category: (payload.category || 'regular') as CustomerCategory,
    notes: payload.notes.trim(),
    facebookUrl: (payload.facebookUrl || '').trim(),
    instagramUrl: (payload.instagramUrl || '').trim(),
    websiteUrl: (payload.websiteUrl || '').trim(),
    createdAt: now,
    updatedAt: now,
    purchases: [],
    gallery: [],
  };
  await putInStore(db, STORE_CUSTOMERS, customer);
  return customer;
}

export async function localUpdateCustomer(id: string, payload: CustomerPayload): Promise<Customer> {
  const db = await openDb();
  const existing = await getFromStore<Customer>(db, STORE_CUSTOMERS, id);
  if (!existing) throw new Error('Customer not found');
  const updated: Customer = {
    ...existing,
    name: payload.name.trim(),
    phone: payload.phone.trim(),
    address: payload.address.trim(),
    city: payload.city.trim(),
    category: (payload.category || 'regular') as CustomerCategory,
    notes: payload.notes.trim(),
    facebookUrl: (payload.facebookUrl || '').trim(),
    instagramUrl: (payload.instagramUrl || '').trim(),
    websiteUrl: (payload.websiteUrl || '').trim(),
    updatedAt: new Date().toISOString(),
  };
  await putInStore(db, STORE_CUSTOMERS, updated);
  return updated;
}

export async function localDeleteCustomer(id: string): Promise<void> {
  const db = await openDb();
  await deleteFromStore(db, STORE_CUSTOMERS, id);
}

export async function localAddPurchase(
  customerId: string,
  payload: CustomerPurchasePayload
): Promise<Customer> {
  const db = await openDb();
  const existing = await getFromStore<Customer>(db, STORE_CUSTOMERS, customerId);
  if (!existing) throw new Error('Customer not found');
  const now = new Date().toISOString();
  const qty = Math.max(1, Math.floor(Number(payload.quantity) || 1));
  const unitPrice = Math.max(0, Number(payload.unitPrice) || 0);
  const purchase: CustomerPurchase = {
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    customerId,
    productId: payload.productId || '',
    productCode: payload.productCode.trim(),
    productName: payload.productName.trim(),
    quantity: qty,
    unitPrice,
    totalPrice: Math.round(qty * unitPrice * 100) / 100,
    purchaseDate: payload.purchaseDate || now.slice(0, 10),
    paymentMethod: (payload.paymentMethod || 'cash') as PurchasePaymentMethod,
    notes: payload.notes.trim(),
    createdAt: now,
  };
  const updated: Customer = {
    ...existing,
    updatedAt: now,
    purchases: [purchase, ...(existing.purchases || [])],
  };
  await putInStore(db, STORE_CUSTOMERS, updated);
  return updated;
}

export async function localUpdatePurchase(
  customerId: string,
  purchaseId: string,
  payload: CustomerPurchasePayload
): Promise<Customer> {
  const db = await openDb();
  const existing = await getFromStore<Customer>(db, STORE_CUSTOMERS, customerId);
  if (!existing) throw new Error('Customer not found');
  const now = new Date().toISOString();
  const qty = Math.max(1, Math.floor(Number(payload.quantity) || 1));
  const unitPrice = Math.max(0, Number(payload.unitPrice) || 0);
  const purchases = (existing.purchases || []).map((p) =>
    p.id === purchaseId
      ? {
          ...p,
          productId: payload.productId || '',
          productCode: payload.productCode.trim(),
          productName: payload.productName.trim(),
          quantity: qty,
          unitPrice,
          totalPrice: Math.round(qty * unitPrice * 100) / 100,
          purchaseDate: payload.purchaseDate || p.purchaseDate,
          paymentMethod: (payload.paymentMethod || 'cash') as PurchasePaymentMethod,
          notes: payload.notes.trim(),
        }
      : p
  );
  const updated: Customer = {
    ...existing,
    updatedAt: now,
    purchases,
  };
  await putInStore(db, STORE_CUSTOMERS, updated);
  return updated;
}

export async function localDeletePurchase(
  customerId: string,
  purchaseId: string
): Promise<Customer> {
  const db = await openDb();
  const existing = await getFromStore<Customer>(db, STORE_CUSTOMERS, customerId);
  if (!existing) throw new Error('Customer not found');
  const updated: Customer = {
    ...existing,
    updatedAt: new Date().toISOString(),
    purchases: (existing.purchases || []).filter((p) => p.id !== purchaseId),
    gallery: existing.gallery || [],
  };
  await putInStore(db, STORE_CUSTOMERS, updated);
  return updated;
}

export async function localAddCustomerGalleryImages(
  customerId: string,
  items: CustomerGalleryPayload[]
): Promise<Customer> {
  const db = await openDb();
  const existing = await getFromStore<Customer>(db, STORE_CUSTOMERS, customerId);
  if (!existing) throw new Error('Customer not found');
  const now = new Date().toISOString();
  const newImages: CustomerGalleryImage[] = items
    .filter((item) => Boolean(item.imageData && item.imageData.startsWith('data:image/')))
    .map((item) => ({
      id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
      customerId,
      title: (item.title || '').trim(),
      source: (item.source || 'upload') as CustomerImageSource,
      sourceUrl: (item.sourceUrl || '').trim(),
      imageData: String(item.imageData),
      createdAt: now,
    }));

  const updated: Customer = {
    ...existing,
    updatedAt: now,
    gallery: [...newImages, ...(existing.gallery || [])],
  };
  await putInStore(db, STORE_CUSTOMERS, updated);
  return updated;
}

export async function localDeleteCustomerGalleryImage(
  customerId: string,
  imageId: string
): Promise<Customer> {
  const db = await openDb();
  const existing = await getFromStore<Customer>(db, STORE_CUSTOMERS, customerId);
  if (!existing) throw new Error('Customer not found');
  const updated: Customer = {
    ...existing,
    updatedAt: new Date().toISOString(),
    gallery: (existing.gallery || []).filter((img) => img.id !== imageId),
  };
  await putInStore(db, STORE_CUSTOMERS, updated);
  return updated;
}

