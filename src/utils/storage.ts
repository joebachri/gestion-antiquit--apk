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
  ExcelImportMode,
  ExcelImportResult,
  InventorySummary,
  PosInvoice,
  PosSalePayload,
  Product,
  ProductDigitalFile,
  ProductHistoryEvent,
  ProductHistoryEventType,
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
const DB_VERSION = 3;
const STORE_PRODUCTS = 'products';
const STORE_SETTINGS = 'settings';
const STORE_CUSTOMERS = 'customers';
const STORE_INVOICES = 'sales_invoices';
const STORE_HISTORY = 'product_history';

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
      if (!db.objectStoreNames.contains(STORE_INVOICES)) {
        db.createObjectStore(STORE_INVOICES, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_HISTORY)) {
        db.createObjectStore(STORE_HISTORY, { keyPath: 'id' });
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
  let activeReferences = 0;
  let totalUnits = 0;
  let totalSellingValue = 0;
  let totalReferenceCost = 0;

  for (const item of products) {
    const qty = Math.max(0, Number(item.quantity) || 0);
    if (qty > 0) activeReferences += 1;
    totalUnits += qty;
    totalSellingValue += qty * (Number(item.sellingPrice) || 0);
    totalReferenceCost += qty * ((Number(item.referencePrice) || 0) + (Number(item.expenses) || 0));
  }

  return {
    totalReferences: activeReferences,
    totalUnits,
    totalSellingValue,
    totalReferenceCost,
  };
}

async function appendHistoryEvent(
  db: IDBDatabase,
  event: Omit<ProductHistoryEvent, 'id'>
): Promise<void> {
  const id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
  await putInStore<ProductHistoryEvent>(db, STORE_HISTORY, { id, ...event });
}

function normalizeProductRecord(p: Product): Product {
  return {
    ...p,
    qrToken: p.qrToken || `GA-QR-${p.code}`,
    supplier: p.supplier || '',
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
    supplier: string;
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
      supplier: 'Atelier Dinanderie Fès',
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
      supplier: 'Artisanat Moyen-Atlas',
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
      supplier: 'Poterie Traditionnelle Fès',
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
      supplier: 'Orfèvrerie Bab Guissa',
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
      qrToken: `GA-QR-${code}`,
      name: s.name,
      description: s.description,
      supplier: s.supplier,
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
    await appendHistoryEvent(db, {
      productId: id,
      eventType: 'created',
      summary: `Article créé (${code})`,
      details: s.supplier ? `Fournisseur: ${s.supplier}` : '',
      quantityDelta: s.quantity,
      quantityAfter: s.quantity,
      createdAt: now,
    });
  }

  await putInStore(db, STORE_SETTINGS, { key: 'seeded', value: '1' });
  await putInStore(db, STORE_SETTINGS, { key: 'currency', value: 'MAD' });
  await putInStore(db, STORE_SETTINGS, { key: 'customLogo', value: '' });
  await putInStore(db, STORE_SETTINGS, { key: 'storeName', value: '' });
  await putInStore(db, STORE_SETTINGS, { key: 'whatsappPhone', value: '' });
}

export async function localListProducts(
  query: string
): Promise<{ products: Product[]; summary: InventorySummary }> {
  const db = await openDb();
  await ensureSeeded(db);
  const all = (await getAllFromStore<Product>(db, STORE_PRODUCTS)).map(normalizeProductRecord);
  all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const q = query.trim().toLowerCase();
  const filtered = q
    ? all.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.code.toLowerCase().includes(q) ||
          (p.supplier || '').toLowerCase().includes(q) ||
          (p.qrToken || '').toLowerCase().includes(q) ||
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

function sanitizeCustomCode(raw: string): string {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '-')
    .replace(/[^A-Z0-9\-_/.]/g, '')
    .slice(0, 32);
}

function ensureUniqueCustomCode(
  all: Product[],
  candidate: string,
  excludeId?: string
): string {
  const base = sanitizeCustomCode(candidate);
  if (!base) return '';
  let next = base;
  let suffix = 2;
  while (
    all.some((p) => p.id !== excludeId && p.code.toUpperCase() === next.toUpperCase())
  ) {
    next = `${base}-${suffix}`;
    suffix += 1;
  }
  return next;
}

export async function localCreateProduct(payload: ProductPayload): Promise<Product> {
  const db = await openDb();
  await ensureSeeded(db);
  const all = await getAllFromStore<Product>(db, STORE_PRODUCTS);
  const now = new Date().toISOString();
  const id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
  const customCode = payload.code ? ensureUniqueCustomCode(all, payload.code) : '';
  const code = customCode || computeNextCode(all, payload.name);
  const supplier = (payload.supplier || '').trim();
  const initialQty = Math.max(0, payload.quantity ?? 1);

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
    qrToken: `GA-QR-${code}`,
    name: payload.name.trim(),
    description: payload.description.trim(),
    supplier,
    lengthCm: payload.lengthCm || 0,
    widthCm: payload.widthCm || 0,
    heightCm: payload.heightCm || 0,
    thicknessCm: payload.thicknessCm || 0,
    piecesCount: Math.max(1, payload.piecesCount || 1),
    quantity: initialQty,
    referencePrice: payload.referencePrice || 0,
    expenses: payload.expenses || 0,
    sellingPrice: payload.sellingPrice || 0,
    addedDate: payload.addedDate || now.slice(0, 10),
    createdAt: now,
    updatedAt: now,
    photos,
  };

  await putInStore(db, STORE_PRODUCTS, product);
  await appendHistoryEvent(db, {
    productId: id,
    eventType: 'created',
    summary: `Article créé (${code})`,
    details: supplier ? `Fournisseur: ${supplier}` : '',
    quantityDelta: initialQty,
    quantityAfter: initialQty,
    createdAt: now,
  });
  return product;
}

export async function localUpdateProduct(id: string, payload: ProductPayload): Promise<Product> {
  const db = await openDb();
  await ensureSeeded(db);
  const all = await getAllFromStore<Product>(db, STORE_PRODUCTS);
  const existing = all.find((p) => p.id === id);
  if (!existing) throw new Error('Product not found');

  const now = new Date().toISOString();
  const explicitCode = payload.code ? sanitizeCustomCode(payload.code) : '';
  const isAutoFormatCode = /^[A-Z]\d{4}$/.test(existing.code);
  const shouldRegen =
    Boolean(payload.regenerateCode) ||
    (isAutoFormatCode && extractPrefixLetter(payload.name) !== extractPrefixLetter(existing.name));
  const code =
    explicitCode && explicitCode !== existing.code
      ? ensureUniqueCustomCode(all, explicitCode, id)
      : shouldRegen
        ? computeNextCode(all, payload.name, id)
        : existing.code;
  const qrToken = code !== existing.code ? `GA-QR-${code}` : existing.qrToken || `GA-QR-${code}`;
  const supplier = (payload.supplier ?? existing.supplier ?? '').trim();
  const nextQty = Math.max(0, payload.quantity ?? 1);
  const qtyDelta = nextQty - (Number(existing.quantity) || 0);

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
    qrToken,
    name: payload.name.trim(),
    description: payload.description.trim(),
    supplier,
    lengthCm: payload.lengthCm || 0,
    widthCm: payload.widthCm || 0,
    heightCm: payload.heightCm || 0,
    thicknessCm: payload.thicknessCm || 0,
    piecesCount: Math.max(1, payload.piecesCount || 1),
    quantity: nextQty,
    referencePrice: payload.referencePrice || 0,
    expenses: payload.expenses || 0,
    sellingPrice: payload.sellingPrice || 0,
    addedDate: payload.addedDate || existing.addedDate,
    updatedAt: now,
    photos,
  };

  await putInStore(db, STORE_PRODUCTS, updated);
  await appendHistoryEvent(db, {
    productId: id,
    eventType: qtyDelta > 0 ? 'restocked' : 'updated',
    summary: qtyDelta > 0 ? `Réapprovisionnement (+${qtyDelta})` : `Fiche mise à jour (${code})`,
    details: qtyDelta !== 0 ? `Stock: ${existing.quantity} → ${nextQty}` : '',
    quantityDelta: qtyDelta,
    quantityAfter: nextQty,
    createdAt: now,
  });
  return updated;
}

export async function localImportProducts(
  items: ProductPayload[],
  mode: ExcelImportMode = 'skip'
): Promise<ExcelImportResult> {
  const db = await openDb();
  await ensureSeeded(db);
  const all = (await getAllFromStore<Product>(db, STORE_PRODUCTS)).map(normalizeProductRecord);
  const now = new Date().toISOString();

  let addedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;

  for (const rawItem of items) {
    const cleanCode = sanitizeCustomCode(rawItem.code || '');
    const cleanName = (rawItem.name || '').trim() || cleanCode;
    if (!cleanName) {
      skippedCount += 1;
      continue;
    }

    const existing = cleanCode
      ? all.find((p) => p.code.toUpperCase() === cleanCode.toUpperCase())
      : undefined;

    if (existing) {
      if (mode === 'skip') {
        skippedCount += 1;
        continue;
      }

      const nextQty = Math.max(0, Math.floor(Number(rawItem.quantity ?? existing.quantity) || 0));
      const qtyDelta = nextQty - (Number(existing.quantity) || 0);
      const updated: Product = {
        ...existing,
        name: cleanName,
        description: (rawItem.description ?? existing.description ?? '').trim(),
        supplier: (rawItem.supplier ?? existing.supplier ?? '').trim(),
        lengthCm: rawItem.lengthCm ?? existing.lengthCm,
        widthCm: rawItem.widthCm ?? existing.widthCm,
        heightCm: rawItem.heightCm ?? existing.heightCm,
        thicknessCm: rawItem.thicknessCm ?? existing.thicknessCm,
        piecesCount: Math.max(1, rawItem.piecesCount ?? existing.piecesCount),
        quantity: nextQty,
        referencePrice: rawItem.referencePrice ?? existing.referencePrice,
        expenses: rawItem.expenses ?? existing.expenses,
        sellingPrice: rawItem.sellingPrice ?? existing.sellingPrice,
        addedDate: rawItem.addedDate || existing.addedDate,
        updatedAt: now,
      };
      await putInStore(db, STORE_PRODUCTS, updated);
      const idx = all.findIndex((p) => p.id === existing.id);
      if (idx >= 0) all[idx] = updated;
      await appendHistoryEvent(db, {
        productId: existing.id,
        eventType: qtyDelta > 0 ? 'restocked' : 'updated',
        summary: `Import Excel (${existing.code})`,
        details: qtyDelta !== 0 ? `Stock: ${existing.quantity} → ${nextQty}` : '',
        quantityDelta: qtyDelta,
        quantityAfter: nextQty,
        createdAt: now,
      });
      updatedCount += 1;
      continue;
    }

    const id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    const finalCode = cleanCode || computeNextCode(all, cleanName);
    const initialQty = Math.max(0, Math.floor(Number(rawItem.quantity ?? 1) || 0));
    const supplier = (rawItem.supplier || '').trim();
    const created: Product = {
      id,
      code: finalCode,
      qrToken: `GA-QR-${finalCode}`,
      name: cleanName,
      description: (rawItem.description || '').trim(),
      supplier,
      lengthCm: rawItem.lengthCm || 0,
      widthCm: rawItem.widthCm || 0,
      heightCm: rawItem.heightCm || 0,
      thicknessCm: rawItem.thicknessCm || 0,
      piecesCount: Math.max(1, rawItem.piecesCount || 1),
      quantity: initialQty,
      referencePrice: rawItem.referencePrice || 0,
      expenses: rawItem.expenses || 0,
      sellingPrice: rawItem.sellingPrice || 0,
      addedDate: rawItem.addedDate || now.slice(0, 10),
      createdAt: now,
      updatedAt: now,
      photos: [],
    };
    await putInStore(db, STORE_PRODUCTS, created);
    all.unshift(created);
    await appendHistoryEvent(db, {
      productId: id,
      eventType: 'created',
      summary: `Import Excel (${finalCode})`,
      details: supplier ? `Fournisseur: ${supplier}` : '',
      quantityDelta: initialQty,
      quantityAfter: initialQty,
      createdAt: now,
    });
    addedCount += 1;
  }

  all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return {
    addedCount,
    updatedCount,
    skippedCount,
    products: all,
    summary: computeSummary(all),
  };
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
  const whatsappPhone = await getFromStore<{ key: string; value: string }>(
    db,
    STORE_SETTINGS,
    'whatsappPhone'
  );
  const printerMode = await getFromStore<{ key: string; value: string }>(
    db,
    STORE_SETTINGS,
    'printerMode'
  );
  const printerPaper = await getFromStore<{ key: string; value: string }>(
    db,
    STORE_SETTINGS,
    'printerPaper'
  );
  const printerName = await getFromStore<{ key: string; value: string }>(
    db,
    STORE_SETTINGS,
    'printerName'
  );
  const printerLinked = await getFromStore<{ key: string; value: string }>(
    db,
    STORE_SETTINGS,
    'printerLinked'
  );
  const publicAppUrl = await getFromStore<{ key: string; value: string }>(
    db,
    STORE_SETTINGS,
    'publicAppUrl'
  );
  return {
    customLogo: logo?.value ?? '',
    storeName: storeName?.value ?? '',
    currency: currency?.value || 'MAD',
    facebookHandle: facebookHandle?.value ?? '',
    instagramHandle: instagramHandle?.value ?? '',
    whatsappPhone: whatsappPhone?.value ?? '',
    printerMode: (printerMode?.value as ShopSettings['printerMode']) || 'pdf_system',
    printerPaper: (printerPaper?.value as ShopSettings['printerPaper']) || 'a4',
    printerName: printerName?.value ?? '',
    printerLinked: printerLinked?.value === '1',
    publicAppUrl: publicAppUrl?.value ?? '',
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
  if (typeof settings.whatsappPhone === 'string') {
    await putInStore(db, STORE_SETTINGS, {
      key: 'whatsappPhone',
      value: settings.whatsappPhone.trim().slice(0, 40),
    });
  }
  if (settings.printerMode) {
    await putInStore(db, STORE_SETTINGS, {
      key: 'printerMode',
      value: settings.printerMode,
    });
  }
  if (settings.printerPaper) {
    await putInStore(db, STORE_SETTINGS, {
      key: 'printerPaper',
      value: settings.printerPaper,
    });
  }
  if (typeof settings.printerName === 'string') {
    await putInStore(db, STORE_SETTINGS, {
      key: 'printerName',
      value: settings.printerName.trim().slice(0, 80),
    });
  }
  if (typeof settings.printerLinked === 'boolean') {
    await putInStore(db, STORE_SETTINGS, {
      key: 'printerLinked',
      value: settings.printerLinked ? '1' : '0',
    });
  }
  if (typeof settings.publicAppUrl === 'string') {
    await putInStore(db, STORE_SETTINGS, {
      key: 'publicAppUrl',
      value: settings.publicAppUrl.trim().replace(/\/+$/, '').slice(0, 240),
    });
  }
  return localGetSettings();
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
    .filter((item) =>
      Boolean(
        item.imageData &&
          (item.imageData.startsWith('data:image/') || item.imageData.startsWith('data:video/'))
      )
    )
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

function resolveQrTokenFromInput(rawInput: string): string {
  let token = (rawInput || '').trim();
  if (!token) return '';
  try {
    if (/^https?:\/\//i.test(token)) {
      const parsed = new URL(token);
      let qrParam =
        parsed.searchParams.get('qr') ||
        parsed.searchParams.get('code') ||
        parsed.searchParams.get('product');
      if (!qrParam && parsed.hash) {
        const qIdx = parsed.hash.indexOf('?');
        if (qIdx >= 0) {
          const hp = new URLSearchParams(parsed.hash.slice(qIdx));
          qrParam = hp.get('qr') || hp.get('code') || hp.get('product');
        }
      }
      if (qrParam) token = qrParam.trim();
    } else if (token.includes('?qr=')) {
      const idx = token.indexOf('?qr=');
      const qEnd = token.indexOf('#', idx);
      const queryPart = qEnd >= 0 ? token.slice(idx, qEnd) : token.slice(idx);
      const params = new URLSearchParams(queryPart);
      const qrParam = params.get('qr');
      if (qrParam) token = qrParam.trim();
    }
  } catch {
    // ignore URL parse error
  }
  if (token.toUpperCase().startsWith('GA-QR:')) {
    token = token.slice(6).trim();
  }
  return token.replace(/\/+$/, '');
}

async function buildLocalDigitalFile(db: IDBDatabase, rawProduct: Product): Promise<ProductDigitalFile> {
  const product = normalizeProductRecord(rawProduct);
  const allInvoices = await getAllFromStore<PosInvoice>(db, STORE_INVOICES);
  const invoices = allInvoices
    .filter((inv) => inv.productId === product.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const allHistory = await getAllFromStore<ProductHistoryEvent>(db, STORE_HISTORY);
  let history = allHistory
    .filter((ev) => ev.productId === product.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  if (history.length === 0) {
    const fallbackEv: ProductHistoryEvent = {
      id: `${product.id}-init`,
      productId: product.id,
      eventType: 'created',
      summary: `Article initialisé (${product.code})`,
      details: product.supplier ? `Fournisseur: ${product.supplier}` : '',
      quantityDelta: product.quantity,
      quantityAfter: product.quantity,
      createdAt: product.createdAt,
    };
    history = [fallbackEv];
  }

  return {
    product,
    invoices,
    history,
    salesStats: {
      totalUnitsSold: invoices.reduce((s, inv) => s + (Number(inv.quantity) || 0), 0),
      totalRevenueMad: invoices.reduce((s, inv) => s + (Number(inv.totalPrice) || 0), 0),
      totalInvoices: invoices.length,
      lastSaleDate: invoices[0]?.saleDate || '',
    },
  };
}

export async function localGetProductDigitalFileByQr(
  qrInput: string,
  logScan = false
): Promise<ProductDigitalFile> {
  const db = await openDb();
  await ensureSeeded(db);
  const token = resolveQrTokenFromInput(qrInput);
  const stripped = token.toUpperCase().startsWith('GA-QR-') ? token.slice(6).trim() : token;
  const all = (await getAllFromStore<Product>(db, STORE_PRODUCTS)).map(normalizeProductRecord);
  const found = all.find(
    (p) =>
      p.id === token ||
      (p.qrToken || '').toLowerCase() === token.toLowerCase() ||
      p.code.toLowerCase() === stripped.toLowerCase() ||
      p.photos.some((ph) => ph.photoCode.toLowerCase() === stripped.toLowerCase())
  );
  if (!found) throw new Error('Product not found for QR code');
  if (logScan) {
    await appendHistoryEvent(db, {
      productId: found.id,
      eventType: 'qr_scanned' as ProductHistoryEventType,
      summary: `QR scanné (consultation ${found.code})`,
      details: '',
      quantityDelta: 0,
      quantityAfter: found.quantity,
      createdAt: new Date().toISOString(),
    });
  }
  return buildLocalDigitalFile(db, found);
}

export async function localGetProductDigitalFile(
  productId: string,
  logScan = false
): Promise<ProductDigitalFile> {
  const db = await openDb();
  await ensureSeeded(db);
  const found = await getFromStore<Product>(db, STORE_PRODUCTS, productId);
  if (!found) throw new Error('Product not found');
  if (logScan) {
    await appendHistoryEvent(db, {
      productId: found.id,
      eventType: 'qr_scanned' as ProductHistoryEventType,
      summary: `Fiche numérique ouverte (${found.code})`,
      details: '',
      quantityDelta: 0,
      quantityAfter: found.quantity,
      createdAt: new Date().toISOString(),
    });
  }
  return buildLocalDigitalFile(db, found);
}

export async function localListPosSales(): Promise<{
  invoices: PosInvoice[];
  summary: {
    totalInvoices: number;
    totalUnitsSold: number;
    totalRevenueMad: number;
    totalProfitMad: number;
  };
}> {
  const db = await openDb();
  await ensureSeeded(db);
  const invoices = await getAllFromStore<PosInvoice>(db, STORE_INVOICES);
  invoices.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const totalRevenueMad = invoices.reduce((s, inv) => s + (Number(inv.totalPrice) || 0), 0);
  const totalCostMad = invoices.reduce(
    (s, inv) => s + (Number(inv.purchasePrice) || 0) * (Number(inv.quantity) || 1),
    0
  );
  const totalUnitsSold = invoices.reduce((s, inv) => s + (Number(inv.quantity) || 0), 0);
  return {
    invoices,
    summary: {
      totalInvoices: invoices.length,
      totalUnitsSold,
      totalRevenueMad,
      totalProfitMad: totalRevenueMad - totalCostMad,
    },
  };
}

export async function localCreatePosSale(payload: PosSalePayload): Promise<{
  invoice: PosInvoice;
  digitalFile: ProductDigitalFile;
  summary: InventorySummary;
}> {
  const db = await openDb();
  await ensureSeeded(db);
  const allProducts = (await getAllFromStore<Product>(db, STORE_PRODUCTS)).map(normalizeProductRecord);
  const product = allProducts.find((p) => p.id === payload.productId);
  if (!product) throw new Error('Product not found');

  const qty = Math.max(1, Math.floor(Number(payload.quantity) || 1));
  if (product.quantity < qty) {
    throw new Error('OUT_OF_STOCK');
  }

  const allInvoices = await getAllFromStore<PosInvoice>(db, STORE_INVOICES);
  let maxInv = 0;
  for (const inv of allInvoices) {
    if (inv.invoiceNumber.startsWith('FAC-')) {
      const n = Number.parseInt(inv.invoiceNumber.slice(4), 10);
      if (Number.isFinite(n) && n > maxInv) maxInv = n;
    }
  }
  const invoiceNumber = `FAC-${String(maxInv + 1).padStart(4, '0')}`;
  const now = new Date().toISOString();
  const unitPrice =
    typeof payload.unitPrice === 'number' && Number.isFinite(payload.unitPrice)
      ? Math.max(0, payload.unitPrice)
      : product.sellingPrice;
  const totalPrice = Math.round(qty * unitPrice * 100) / 100;
  const purchasePrice = (Number(product.referencePrice) || 0) + (Number(product.expenses) || 0);
  const nextQty = Math.max(0, product.quantity - qty);

  let customerName = (payload.customerName || '').trim();
  let customerPhone = (payload.customerPhone || '').trim();
  const customerId = (payload.customerId || '').trim();
  if (customerId) {
    const cust = await getFromStore<Customer>(db, STORE_CUSTOMERS, customerId);
    if (cust) {
      if (!customerName) customerName = cust.name;
      if (!customerPhone) customerPhone = cust.phone;
      const purchase: CustomerPurchase = {
        id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
        customerId,
        productId: product.id,
        productCode: product.code,
        productName: product.name,
        quantity: qty,
        unitPrice,
        totalPrice,
        purchaseDate: payload.saleDate || now.slice(0, 10),
        paymentMethod: (payload.paymentMethod || 'cash') as PurchasePaymentMethod,
        notes: payload.notes ? `${invoiceNumber} · ${payload.notes}` : invoiceNumber,
        createdAt: now,
      };
      await putInStore<Customer>(db, STORE_CUSTOMERS, {
        ...cust,
        updatedAt: now,
        purchases: [purchase, ...(cust.purchases || [])],
      });
    }
  }

  const updatedProduct: Product = {
    ...product,
    quantity: nextQty,
    updatedAt: now,
  };
  await putInStore(db, STORE_PRODUCTS, updatedProduct);

  const invoice: PosInvoice = {
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    invoiceNumber,
    productId: product.id,
    productCode: product.code,
    productName: product.name,
    customerId,
    customerName,
    customerPhone,
    quantity: qty,
    unitPrice,
    totalPrice,
    purchasePrice,
    paymentMethod: (payload.paymentMethod || 'cash') as PurchasePaymentMethod,
    saleDate: payload.saleDate || now.slice(0, 10),
    notes: (payload.notes || '').trim(),
    createdAt: now,
  };
  await putInStore(db, STORE_INVOICES, invoice);

  await appendHistoryEvent(db, {
    productId: product.id,
    eventType: 'sold',
    summary: `${payload.source === 'qr_scan' ? 'Vente instantanée QR' : 'Vente POS'} — ${qty} u. (${invoiceNumber})`,
    details: customerName ? `Client: ${customerName} · ${totalPrice} MAD` : `${totalPrice} MAD`,
    quantityDelta: -qty,
    quantityAfter: nextQty,
    createdAt: now,
  });
  await appendHistoryEvent(db, {
    productId: product.id,
    eventType: 'invoice_created',
    summary: `Facture ${invoiceNumber} générée`,
    details: `Montant: ${totalPrice} MAD`,
    quantityDelta: 0,
    quantityAfter: nextQty,
    createdAt: now,
  });

  const nextProducts = allProducts.map((p) => (p.id === updatedProduct.id ? updatedProduct : p));
  return {
    invoice,
    digitalFile: await buildLocalDigitalFile(db, updatedProduct),
    summary: computeSummary(nextProducts),
  };
}

export async function localDeletePosSale(invoiceId: string): Promise<void> {
  const db = await openDb();
  const inv = await getFromStore<PosInvoice>(db, STORE_INVOICES, invoiceId);
  if (!inv) return;
  await deleteFromStore(db, STORE_INVOICES, invoiceId);
  const product = await getFromStore<Product>(db, STORE_PRODUCTS, inv.productId);
  if (product) {
    const restoredQty = (Number(product.quantity) || 0) + (Number(inv.quantity) || 1);
    const now = new Date().toISOString();
    await putInStore(db, STORE_PRODUCTS, {
      ...product,
      quantity: restoredQty,
      updatedAt: now,
    });
    await appendHistoryEvent(db, {
      productId: product.id,
      eventType: 'restocked',
      summary: `Annulation facture ${inv.invoiceNumber}`,
      details: `Stock restauré (+${inv.quantity})`,
      quantityDelta: Number(inv.quantity) || 1,
      quantityAfter: restoredQty,
      createdAt: now,
    });
  }
}

