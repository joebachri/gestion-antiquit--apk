import type {
  AdjustmentType,
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
  InventoryAdjustment,
  InventoryAdjustmentPayload,
  InventorySummary,
  PaymentInstrument,
  PaymentInstrumentPayload,
  PaymentInstrumentStatus,
  PaymentInstrumentType,
  PaymentPortfolioSummary,
  PosInvoice,
  PosInvoiceItem,
  PosPaymentSplit,
  PosSalePayload,
  PosSummary,
  Product,
  ProductDigitalFile,
  ProductHistoryEvent,
  ProductHistoryEventType,
  ProductPayload,
  ProductPhoto,
  PurchasePaymentMethod,
  SavedPrinterProfile,
  ShopSettings,
  Supplier,
  SupplierCategory,
  SupplierGalleryImage,
  SupplierGalleryPayload,
  SupplierPayload,
  SupplierPurchase,
  SupplierPurchasePayload,
  SupplierSummary,
  Warehouse,
  WarehousePayload,
} from '../types';
import { extractPrefixLetter } from './image';
import { populateBilingualProductFields } from './productTranslation';
import lanternImg from '../assets/images/antique_copper_lantern_1794787509666.jpg';
import chestImg from '../assets/images/antique_berber_chest_1794787509355.jpg';
import ceramicImg from '../assets/images/antique_fez_ceramic_1794787509914.jpg';
import teaServiceImg from '../assets/images/antique_silver_tea_service_1794787510384.jpg';

const DB_NAME = 'gestion_antiquites_db';
const DB_VERSION = 5;
const STORE_PRODUCTS = 'products';
const STORE_SETTINGS = 'settings';
const STORE_CUSTOMERS = 'customers';
const STORE_INVOICES = 'sales_invoices';
const STORE_HISTORY = 'product_history';
const STORE_WAREHOUSES = 'warehouses';
const STORE_SUPPLIERS = 'suppliers';
const STORE_ADJUSTMENTS = 'inventory_adjustments';
const STORE_PAYMENT_INSTRUMENTS = 'payment_instruments';

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
      if (!db.objectStoreNames.contains(STORE_WAREHOUSES)) {
        db.createObjectStore(STORE_WAREHOUSES, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_SUPPLIERS)) {
        db.createObjectStore(STORE_SUPPLIERS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_ADJUSTMENTS)) {
        db.createObjectStore(STORE_ADJUSTMENTS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_PAYMENT_INSTRUMENTS)) {
        db.createObjectStore(STORE_PAYMENT_INSTRUMENTS, { keyPath: 'id' });
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
  const needsBilingual =
    !p.nameFr ||
    !p.nameAr ||
    (Boolean(p.description) && (!p.descriptionFr || !p.descriptionAr)) ||
    (Boolean(p.category) && (!p.categoryFr || !p.categoryAr)) ||
    (Boolean(p.color) && (!p.colorFr || !p.colorAr));

  const bilingual = needsBilingual
    ? populateBilingualProductFields({
        name: p.name || '',
        nameFr: p.nameFr || '',
        nameAr: p.nameAr || '',
        description: p.description || '',
        descriptionFr: p.descriptionFr || '',
        descriptionAr: p.descriptionAr || '',
        category: p.category || '',
        categoryFr: p.categoryFr || '',
        categoryAr: p.categoryAr || '',
        color: p.color || '',
        colorFr: p.colorFr || '',
        colorAr: p.colorAr || '',
        sellingPrice: p.sellingPrice || 0,
      })
    : p;

  return {
    ...p,
    qrToken: p.qrToken || `GA-QR-${p.code}`,
    nameFr: bilingual.nameFr || p.nameFr || '',
    nameAr: bilingual.nameAr || p.nameAr || '',
    descriptionFr: bilingual.descriptionFr || p.descriptionFr || '',
    descriptionAr: bilingual.descriptionAr || p.descriptionAr || '',
    category: p.category || '',
    categoryFr: bilingual.categoryFr || p.categoryFr || '',
    categoryAr: bilingual.categoryAr || p.categoryAr || '',
    color: p.color || '',
    colorFr: bilingual.colorFr || p.colorFr || '',
    colorAr: bilingual.colorAr || p.colorAr || '',
    warehouseId: p.warehouseId || '',
    warehouseName: p.warehouseName || '',
    supplierId: p.supplierId || '',
    supplier: p.supplier || '',
  };
}

async function ensureDefaultLocalWarehouse(db: IDBDatabase): Promise<Warehouse> {
  const all = await getAllFromStore<Warehouse>(db, STORE_WAREHOUSES);
  const def = all.find((w) => w.isDefault) || all[0];
  if (def) return def;
  const now = new Date().toISOString();
  const created: Warehouse = {
    id: crypto.randomUUID ? crypto.randomUUID() : `wh-${Date.now()}`,
    code: 'WH0001',
    name: 'Magasin Principal',
    location: 'Fès',
    address: '',
    phone: '',
    managerName: '',
    notes: '',
    isDefault: true,
    createdAt: now,
    updatedAt: now,
  };
  await putInStore(db, STORE_WAREHOUSES, created);
  return created;
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

  const defWh = await ensureDefaultLocalWarehouse(db);
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
      category: '',
      color: '',
      warehouseId: defWh.id,
      warehouseName: defWh.name,
      supplierId: '',
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
      summary: `${code}`,
      details: s.supplier || '',
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
          (p.nameFr || '').toLowerCase().includes(q) ||
          (p.nameAr || '').toLowerCase().includes(q) ||
          p.code.toLowerCase().includes(q) ||
          (p.supplier || '').toLowerCase().includes(q) ||
          (p.category || '').toLowerCase().includes(q) ||
          (p.categoryFr || '').toLowerCase().includes(q) ||
          (p.categoryAr || '').toLowerCase().includes(q) ||
          (p.color || '').toLowerCase().includes(q) ||
          (p.colorFr || '').toLowerCase().includes(q) ||
          (p.colorAr || '').toLowerCase().includes(q) ||
          (p.warehouseName || '').toLowerCase().includes(q) ||
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
  const defWh = await ensureDefaultLocalWarehouse(db);
  const warehouses = await getAllFromStore<Warehouse>(db, STORE_WAREHOUSES);
  const suppliers = await getAllFromStore<Supplier>(db, STORE_SUPPLIERS);

  const now = new Date().toISOString();
  const id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
  const customCode = payload.code ? ensureUniqueCustomCode(all, payload.code) : '';
  const code = customCode || computeNextCode(all, payload.name);

  let supplierId = (payload.supplierId || '').trim();
  let supplier = (payload.supplier || '').trim();
  if (supplierId) {
    const matchedSup = suppliers.find((s) => s.id === supplierId);
    if (matchedSup && !supplier) supplier = matchedSup.name;
  }

  let warehouseId = (payload.warehouseId || '').trim() || defWh.id;
  const matchedWh = warehouses.find((w) => w.id === warehouseId);
  const warehouseName = matchedWh?.name || (payload.warehouseName || '').trim() || defWh.name;
  const initialQty = Math.max(0, payload.quantity ?? 1);

  const photos: ProductPhoto[] = (payload.photos || []).map((p, idx) => ({
    id: p.id || (crypto.randomUUID ? crypto.randomUUID() : `${id}-p${idx}`),
    productId: id,
    photoCode: buildPhotoCode(code, idx),
    imageData: p.imageData,
    sortOrder: idx,
    createdAt: now,
  }));

  const bilingual = populateBilingualProductFields(payload);

  const product: Product = {
    id,
    code,
    qrToken: `GA-QR-${code}`,
    name: bilingual.name.trim(),
    nameFr: bilingual.nameFr || '',
    nameAr: bilingual.nameAr || '',
    description: bilingual.description.trim(),
    descriptionFr: bilingual.descriptionFr || '',
    descriptionAr: bilingual.descriptionAr || '',
    category: (bilingual.category || '').trim(),
    categoryFr: bilingual.categoryFr || '',
    categoryAr: bilingual.categoryAr || '',
    color: (bilingual.color || '').trim(),
    colorFr: bilingual.colorFr || '',
    colorAr: bilingual.colorAr || '',
    warehouseId,
    warehouseName,
    supplierId,
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
    summary: `${code}`,
    details: [warehouseName, supplier, product.color].filter(Boolean).join(' · '),
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

  const warehouses = await getAllFromStore<Warehouse>(db, STORE_WAREHOUSES);
  const suppliers = await getAllFromStore<Supplier>(db, STORE_SUPPLIERS);
  const defWh = await ensureDefaultLocalWarehouse(db);

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

  const supplierId = (payload.supplierId ?? existing.supplierId ?? '').trim();
  let supplier = (payload.supplier ?? existing.supplier ?? '').trim();
  if (supplierId) {
    const matchedSup = suppliers.find((s) => s.id === supplierId);
    if (matchedSup && !supplier) supplier = matchedSup.name;
  }

  const warehouseId = (payload.warehouseId ?? existing.warehouseId ?? '').trim() || defWh.id;
  const matchedWh = warehouses.find((w) => w.id === warehouseId);
  const warehouseName =
    matchedWh?.name || (payload.warehouseName ?? existing.warehouseName ?? '').trim() || defWh.name;

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

  const bilingual = populateBilingualProductFields({
    ...payload,
    category: payload.category ?? existing.category ?? '',
    color: payload.color ?? existing.color ?? '',
  });

  const updated: Product = {
    ...existing,
    code,
    qrToken,
    name: bilingual.name.trim(),
    nameFr: bilingual.nameFr || '',
    nameAr: bilingual.nameAr || '',
    description: bilingual.description.trim(),
    descriptionFr: bilingual.descriptionFr || '',
    descriptionAr: bilingual.descriptionAr || '',
    category: (bilingual.category ?? existing.category ?? '').trim(),
    categoryFr: bilingual.categoryFr || '',
    categoryAr: bilingual.categoryAr || '',
    color: (bilingual.color ?? existing.color ?? '').trim(),
    colorFr: bilingual.colorFr || '',
    colorAr: bilingual.colorAr || '',
    warehouseId,
    warehouseName,
    supplierId,
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
    summary: qtyDelta > 0 ? `+${qtyDelta}` : `${code}`,
    details: qtyDelta !== 0 ? `${existing.quantity} → ${nextQty}` : '',
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
  const warehouses = await getAllFromStore<Warehouse>(db, STORE_WAREHOUSES);
  const defWh = await ensureDefaultLocalWarehouse(db);
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

    const rawWhName = (rawItem.warehouseName || '').trim();
    const matchedWh = rawWhName
      ? warehouses.find((w) => w.name.toLowerCase() === rawWhName.toLowerCase())
      : undefined;
    const resolvedWhId = matchedWh?.id || rawItem.warehouseId || defWh.id;
    const resolvedWhName = matchedWh?.name || rawWhName || defWh.name;

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
      const bilingual = populateBilingualProductFields({
        ...rawItem,
        name: cleanName,
        description: (rawItem.description ?? existing.description ?? '').trim(),
        category: (rawItem.category ?? existing.category ?? '').trim(),
        color: (rawItem.color ?? existing.color ?? '').trim(),
      });
      const updated: Product = {
        ...existing,
        name: bilingual.name,
        nameFr: bilingual.nameFr || '',
        nameAr: bilingual.nameAr || '',
        description: bilingual.description,
        descriptionFr: bilingual.descriptionFr || '',
        descriptionAr: bilingual.descriptionAr || '',
        category: (bilingual.category || '').trim(),
        categoryFr: bilingual.categoryFr || '',
        categoryAr: bilingual.categoryAr || '',
        color: (bilingual.color || '').trim(),
        colorFr: bilingual.colorFr || '',
        colorAr: bilingual.colorAr || '',
        warehouseId: resolvedWhId || existing.warehouseId,
        warehouseName: resolvedWhName || existing.warehouseName,
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
        summary: `Excel (${existing.code})`,
        details: qtyDelta !== 0 ? `${existing.quantity} → ${nextQty}` : '',
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
    const bilingualCreated = populateBilingualProductFields({
      ...rawItem,
      name: cleanName,
      description: (rawItem.description || '').trim(),
      category: (rawItem.category || '').trim(),
      color: (rawItem.color || '').trim(),
    });
    const created: Product = {
      id,
      code: finalCode,
      qrToken: `GA-QR-${finalCode}`,
      name: bilingualCreated.name,
      nameFr: bilingualCreated.nameFr || '',
      nameAr: bilingualCreated.nameAr || '',
      description: bilingualCreated.description,
      descriptionFr: bilingualCreated.descriptionFr || '',
      descriptionAr: bilingualCreated.descriptionAr || '',
      category: (bilingualCreated.category || '').trim(),
      categoryFr: bilingualCreated.categoryFr || '',
      categoryAr: bilingualCreated.categoryAr || '',
      color: (bilingualCreated.color || '').trim(),
      colorFr: bilingualCreated.colorFr || '',
      colorAr: bilingualCreated.colorAr || '',
      warehouseId: resolvedWhId,
      warehouseName: resolvedWhName,
      supplierId: '',
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
      summary: `Excel (${finalCode})`,
      details: supplier || resolvedWhName || '',
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
  const companyAddress = await getFromStore<{ key: string; value: string }>(
    db,
    STORE_SETTINGS,
    'companyAddress'
  );
  const companyMobile = await getFromStore<{ key: string; value: string }>(
    db,
    STORE_SETTINGS,
    'companyMobile'
  );
  const companyPhone = await getFromStore<{ key: string; value: string }>(
    db,
    STORE_SETTINGS,
    'companyPhone'
  );
  const companyWebsite = await getFromStore<{ key: string; value: string }>(
    db,
    STORE_SETTINGS,
    'companyWebsite'
  );
  const companyRc = await getFromStore<{ key: string; value: string }>(
    db,
    STORE_SETTINGS,
    'companyRc'
  );
  const companyIce = await getFromStore<{ key: string; value: string }>(
    db,
    STORE_SETTINGS,
    'companyIce'
  );
  const companyIf = await getFromStore<{ key: string; value: string }>(
    db,
    STORE_SETTINGS,
    'companyIf'
  );
  const companyCnss = await getFromStore<{ key: string; value: string }>(
    db,
    STORE_SETTINGS,
    'companyCnss'
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
  const savedPrintersRaw = await getFromStore<{ key: string; value: string }>(
    db,
    STORE_SETTINGS,
    'savedPrinters'
  );
  const activePrinterId = await getFromStore<{ key: string; value: string }>(
    db,
    STORE_SETTINGS,
    'activePrinterId'
  );
  let savedPrinters: SavedPrinterProfile[] = [];
  if (savedPrintersRaw?.value) {
    try {
      const parsed = JSON.parse(savedPrintersRaw.value);
      if (Array.isArray(parsed)) savedPrinters = parsed;
    } catch {
      savedPrinters = [];
    }
  }
  return {
    customLogo: logo?.value ?? '',
    storeName: storeName?.value ?? '',
    currency: currency?.value || 'MAD',
    facebookHandle: facebookHandle?.value ?? '',
    instagramHandle: instagramHandle?.value ?? '',
    whatsappPhone: whatsappPhone?.value ?? '',
    companyAddress: companyAddress?.value ?? '',
    companyMobile: companyMobile?.value ?? '',
    companyPhone: companyPhone?.value ?? '',
    companyWebsite: companyWebsite?.value ?? '',
    companyRc: companyRc?.value ?? '',
    companyIce: companyIce?.value ?? '',
    companyIf: companyIf?.value ?? '',
    companyCnss: companyCnss?.value ?? '',
    printerMode: (printerMode?.value as ShopSettings['printerMode']) || 'pdf_system',
    printerPaper: (printerPaper?.value as ShopSettings['printerPaper']) || 'a4',
    printerName: printerName?.value ?? '',
    printerLinked: printerLinked?.value === '1',
    savedPrinters,
    activePrinterId: activePrinterId?.value ?? '',
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
  if (typeof settings.companyAddress === 'string') {
    await putInStore(db, STORE_SETTINGS, {
      key: 'companyAddress',
      value: settings.companyAddress.trim().slice(0, 240),
    });
  }
  if (typeof settings.companyMobile === 'string') {
    await putInStore(db, STORE_SETTINGS, {
      key: 'companyMobile',
      value: settings.companyMobile.trim().slice(0, 40),
    });
  }
  if (typeof settings.companyPhone === 'string') {
    await putInStore(db, STORE_SETTINGS, {
      key: 'companyPhone',
      value: settings.companyPhone.trim().slice(0, 40),
    });
  }
  if (typeof settings.companyWebsite === 'string') {
    await putInStore(db, STORE_SETTINGS, {
      key: 'companyWebsite',
      value: settings.companyWebsite.trim().slice(0, 240),
    });
  }
  if (typeof settings.companyRc === 'string') {
    await putInStore(db, STORE_SETTINGS, {
      key: 'companyRc',
      value: settings.companyRc.trim().slice(0, 60),
    });
  }
  if (typeof settings.companyIce === 'string') {
    await putInStore(db, STORE_SETTINGS, {
      key: 'companyIce',
      value: settings.companyIce.trim().slice(0, 60),
    });
  }
  if (typeof settings.companyIf === 'string') {
    await putInStore(db, STORE_SETTINGS, {
      key: 'companyIf',
      value: settings.companyIf.trim().slice(0, 60),
    });
  }
  if (typeof settings.companyCnss === 'string') {
    await putInStore(db, STORE_SETTINGS, {
      key: 'companyCnss',
      value: settings.companyCnss.trim().slice(0, 60),
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
  if (Array.isArray(settings.savedPrinters)) {
    await putInStore(db, STORE_SETTINGS, {
      key: 'savedPrinters',
      value: JSON.stringify(settings.savedPrinters),
    });
  }
  if (typeof settings.activePrinterId === 'string') {
    await putInStore(db, STORE_SETTINGS, {
      key: 'activePrinterId',
      value: settings.activePrinterId.trim().slice(0, 64),
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
    .filter(
      (inv) =>
        inv.productId === product.id ||
        (Array.isArray(inv.items) && inv.items.some((item) => item.productId === product.id))
    )
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
      summary: `${product.code}`,
      details: product.supplier || '',
      quantityDelta: product.quantity,
      quantityAfter: product.quantity,
      createdAt: product.createdAt,
    };
    history = [fallbackEv];
  }

  let totalUnitsSold = 0;
  let totalRevenueMad = 0;
  for (const inv of invoices) {
    const matched = (inv.items || []).filter((item) => item.productId === product.id);
    if (matched.length > 0) {
      for (const item of matched) {
        totalUnitsSold += Number(item.quantity) || 0;
        totalRevenueMad += Number(item.totalPrice) || 0;
      }
    } else if (inv.productId === product.id) {
      totalUnitsSold += Number(inv.quantity) || 0;
      totalRevenueMad += Number(inv.totalPrice) || 0;
    }
  }

  return {
    product,
    invoices,
    history,
    salesStats: {
      totalUnitsSold,
      totalRevenueMad,
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
      summary: `QR (${found.code})`,
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
      summary: `QR (${found.code})`,
      details: '',
      quantityDelta: 0,
      quantityAfter: found.quantity,
      createdAt: new Date().toISOString(),
    });
  }
  return buildLocalDigitalFile(db, found);
}

function formatLocalBlNumber(seq: number): string {
  return `BL-${String(Math.max(1, Math.floor(seq))).padStart(4, '0')}`;
}

function parseLocalBlSeq(raw: string | number | undefined): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 1) {
    return Math.floor(raw);
  }
  if (typeof raw === 'string') {
    const m = raw.trim().match(/(\d+)/);
    if (m) {
      const n = Number.parseInt(m[1], 10);
      if (Number.isFinite(n) && n >= 1) return n;
    }
  }
  return null;
}

async function getLocalNextBlSeq(db: IDBDatabase, existingInvoices?: PosInvoice[]): Promise<number> {
  const row = await getFromStore<{ key: string; value: number }>(db, STORE_SETTINGS, 'next_bl_seq');
  if (row && Number.isFinite(Number(row.value)) && Number(row.value) >= 1) {
    return Math.floor(Number(row.value));
  }
  const all = existingInvoices || (await getAllFromStore<PosInvoice>(db, STORE_INVOICES));
  let maxNum = 0;
  for (const inv of all) {
    for (const candidate of [inv.invoiceNumber, inv.blNumber]) {
      if (candidate && candidate.startsWith('BL-')) {
        const n = Number.parseInt(candidate.slice(3), 10);
        if (Number.isFinite(n) && n > maxNum) maxNum = n;
      }
    }
  }
  return maxNum + 1;
}

export async function localSetNextBlSequence(
  nextSeqOrLabel: number | string
): Promise<{ nextBlSeq: number; blNumber: string }> {
  const db = await openDb();
  const parsed = parseLocalBlSeq(nextSeqOrLabel) || 1;
  const nextBlSeq = Math.max(1, parsed);
  await putInStore(db, STORE_SETTINGS, { key: 'next_bl_seq', value: nextBlSeq });
  return { nextBlSeq, blNumber: formatLocalBlNumber(nextBlSeq) };
}

export async function localListPosSales(): Promise<{
  invoices: PosInvoice[];
  summary: PosSummary;
}> {
  const db = await openDb();
  await ensureSeeded(db);
  const invoices = (await getAllFromStore<PosInvoice>(db, STORE_INVOICES)).map((inv) => {
    const docType = inv.documentType === 'bl' ? 'bl' : 'facture';
    return {
      ...inv,
      documentType: docType as 'bl' | 'facture',
      blNumber: inv.blNumber || (docType === 'bl' ? inv.invoiceNumber : ''),
      paymentBreakdown: Array.isArray(inv.paymentBreakdown) ? inv.paymentBreakdown : [],
      printCount: Number(inv.printCount) || 0,
      items:
        Array.isArray(inv.items) && inv.items.length > 0
          ? inv.items
          : [
              {
                productId: inv.productId,
                productCode: inv.productCode,
                productName: inv.productName,
                category: inv.category || '',
                warehouseId: inv.warehouseId || '',
                warehouseName: inv.warehouseName || '',
                quantity: Number(inv.quantity) || 1,
                unitPrice: Number(inv.unitPrice) || 0,
                discountPercent: 0,
                totalPrice: Number(inv.totalPrice) || 0,
                purchasePrice: Number(inv.purchasePrice) || 0,
              },
            ],
    };
  });
  invoices.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const totalRevenueMad = invoices.reduce((s, inv) => s + (Number(inv.totalPrice) || 0), 0);
  const totalCostMad = invoices.reduce((s, inv) => {
    if (Array.isArray(inv.items) && inv.items.length > 0) {
      return (
        s +
        inv.items.reduce(
          (sum, item) => sum + (Number(item.purchasePrice) || 0) * (Number(item.quantity) || 1),
          0
        )
      );
    }
    return s + (Number(inv.purchasePrice) || 0) * (Number(inv.quantity) || 1);
  }, 0);
  const totalUnitsSold = invoices.reduce((s, inv) => s + (Number(inv.quantity) || 0), 0);
  const today = new Date().toISOString().slice(0, 10);
  const totalFormalInvoices = invoices.filter((inv) => inv.documentType === 'facture').length;
  const totalBlCount = invoices.filter((inv) => inv.documentType === 'bl').length;
  const todayBlCount = invoices.filter(
    (inv) =>
      (inv.saleDate || '').slice(0, 10) === today &&
      (inv.documentType === 'bl' || Boolean(inv.blNumber))
  ).length;
  const nextBlSeq = await getLocalNextBlSeq(db, invoices);
  return {
    invoices,
    summary: {
      totalInvoices: invoices.length,
      totalFormalInvoices,
      totalBlCount,
      todayBlCount,
      totalUnitsSold,
      totalRevenueMad,
      totalProfitMad: totalRevenueMad - totalCostMad,
      nextBlSeq,
    },
  };
}

export async function localCreatePosSale(payload: PosSalePayload): Promise<{
  invoice: PosInvoice;
  digitalFile: ProductDigitalFile;
  summary: InventorySummary;
  nextBlSeq: number;
}> {
  const db = await openDb();
  await ensureSeeded(db);
  const allProducts = (await getAllFromStore<Product>(db, STORE_PRODUCTS)).map(normalizeProductRecord);
  const rawLineItems =
    Array.isArray(payload.items) && payload.items.length > 0
      ? payload.items
      : payload.productId
        ? [{ productId: payload.productId, quantity: payload.quantity ?? 1, unitPrice: payload.unitPrice, discountPercent: 0 }]
        : [];
  if (rawLineItems.length === 0) throw new Error('At least one product is required');

  const resolved: Array<{
    product: Product;
    quantity: number;
    unitPrice: number;
    discountPercent: number;
    totalPrice: number;
    purchasePrice: number;
  }> = [];

  const neededByProduct = new Map<string, number>();
  for (const item of rawLineItems) {
    const prod = allProducts.find((p) => p.id === item.productId);
    if (!prod) throw new Error('Product not found');
    const qty = Math.max(1, Math.floor(Number(item.quantity) || 1));
    const totalNeeded = (neededByProduct.get(prod.id) || 0) + qty;
    if (prod.quantity < totalNeeded) throw new Error('OUT_OF_STOCK');
    neededByProduct.set(prod.id, totalNeeded);
    const unitPrice =
      typeof item.unitPrice === 'number' && Number.isFinite(item.unitPrice)
        ? Math.max(0, item.unitPrice)
        : prod.sellingPrice;
    const discountPercent =
      typeof item.discountPercent === 'number' && Number.isFinite(item.discountPercent)
        ? Math.max(0, Math.min(100, item.discountPercent))
        : 0;
    resolved.push({
      product: prod,
      quantity: qty,
      unitPrice,
      discountPercent,
      totalPrice: Math.round(qty * unitPrice * (1 - discountPercent / 100) * 100) / 100,
      purchasePrice: (Number(prod.referencePrice) || 0) + (Number(prod.expenses) || 0),
    });
  }

  const allInvoices = await getAllFromStore<PosInvoice>(db, STORE_INVOICES);
  const documentType: 'bl' | 'facture' = payload.documentType === 'facture' ? 'facture' : 'bl';
  let invoiceNumber = '';
  let blNumber = '';
  let nextBlSeq = await getLocalNextBlSeq(db, allInvoices);

  if (documentType === 'bl') {
    let seqCandidate = parseLocalBlSeq(payload.blNumber) ?? nextBlSeq;
    while (
      allInvoices.some(
        (inv) =>
          inv.invoiceNumber === formatLocalBlNumber(seqCandidate) ||
          inv.blNumber === formatLocalBlNumber(seqCandidate)
      )
    ) {
      seqCandidate += 1;
    }
    blNumber = formatLocalBlNumber(seqCandidate);
    invoiceNumber = blNumber;
    nextBlSeq = seqCandidate + 1;
    await putInStore(db, STORE_SETTINGS, { key: 'next_bl_seq', value: nextBlSeq });
  } else {
    let maxInv = 0;
    for (const inv of allInvoices) {
      if (inv.invoiceNumber.startsWith('FAC-')) {
        const n = Number.parseInt(inv.invoiceNumber.slice(4), 10);
        if (Number.isFinite(n) && n > maxInv) maxInv = n;
      }
    }
    invoiceNumber = `FAC-${String(maxInv + 1).padStart(4, '0')}`;
    blNumber = payload.blNumber || '';
  }

  const now = new Date().toISOString();

  let customerName = (payload.customerName || '').trim();
  let customerPhone = (payload.customerPhone || '').trim();
  const customerId = (payload.customerId || '').trim();
  const customerRecord = customerId ? await getFromStore<Customer>(db, STORE_CUSTOMERS, customerId) : undefined;
  if (customerRecord) {
    if (!customerName) customerName = customerRecord.name;
    if (!customerPhone) customerPhone = customerRecord.phone;
  }

  const updatedProductsMap = new Map<string, Product>();
  const newCustomerPurchases: CustomerPurchase[] = [];

  for (const entry of resolved) {
    const baseProd = updatedProductsMap.get(entry.product.id) || entry.product;
    const nextQty = Math.max(0, baseProd.quantity - entry.quantity);
    const updatedProduct: Product = {
      ...baseProd,
      quantity: nextQty,
      updatedAt: now,
    };
    updatedProductsMap.set(entry.product.id, updatedProduct);

    if (customerRecord) {
      newCustomerPurchases.push({
        id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
        customerId,
        productId: entry.product.id,
        productCode: entry.product.code,
        productName: entry.product.name,
        quantity: entry.quantity,
        unitPrice: entry.unitPrice,
        totalPrice: entry.totalPrice,
        purchaseDate: payload.saleDate || now.slice(0, 10),
        paymentMethod: (payload.paymentMethod || 'cash') as PurchasePaymentMethod,
        notes: payload.notes ? `${invoiceNumber} · ${payload.notes}` : invoiceNumber,
        createdAt: now,
      });
    }

    await appendHistoryEvent(db, {
      productId: entry.product.id,
      eventType: 'sold',
      summary: `${invoiceNumber} (-${entry.quantity})`,
      details: customerName ? `${customerName} · ${entry.totalPrice} MAD` : `${entry.totalPrice} MAD`,
      quantityDelta: -entry.quantity,
      quantityAfter: nextQty,
      createdAt: now,
    });
    await appendHistoryEvent(db, {
      productId: entry.product.id,
      eventType: 'invoice_created',
      summary: `${invoiceNumber}`,
      details: `${entry.totalPrice} MAD`,
      quantityDelta: 0,
      quantityAfter: nextQty,
      createdAt: now,
    });
  }

  for (const updatedProd of updatedProductsMap.values()) {
    await putInStore(db, STORE_PRODUCTS, updatedProd);
  }

  if (customerRecord && newCustomerPurchases.length > 0) {
    await putInStore<Customer>(db, STORE_CUSTOMERS, {
      ...customerRecord,
      updatedAt: now,
      purchases: [...newCustomerPurchases, ...(customerRecord.purchases || [])],
    });
  }

  const invoiceItems: PosInvoiceItem[] = resolved.map((entry) => ({
    productId: entry.product.id,
    productCode: entry.product.code,
    productName: entry.product.name,
    category: entry.product.category || '',
    color: entry.product.color || '',
    warehouseId: entry.product.warehouseId || '',
    warehouseName: entry.product.warehouseName || '',
    supplier: entry.product.supplier || '',
    quantity: entry.quantity,
    unitPrice: entry.unitPrice,
    discountPercent: entry.discountPercent,
    totalPrice: entry.totalPrice,
    purchasePrice: entry.purchasePrice,
  }));

  const primaryProduct = resolved[0].product;
  const totalQuantity = invoiceItems.reduce((s, i) => s + i.quantity, 0);
  const grandTotalPrice = Math.round(invoiceItems.reduce((s, i) => s + i.totalPrice, 0) * 100) / 100;
  const avgUnitPrice = totalQuantity > 0 ? Math.round((grandTotalPrice / totalQuantity) * 100) / 100 : 0;
  const totalPurchaseCost = invoiceItems.reduce((s, i) => s + i.purchasePrice * i.quantity, 0);
  const avgPurchaseCost = totalQuantity > 0 ? Math.round((totalPurchaseCost / totalQuantity) * 100) / 100 : 0;
  const payMethod = (payload.paymentMethod || 'cash') as PurchasePaymentMethod;
  const cleanBreakdown: PosPaymentSplit[] =
    Array.isArray(payload.paymentBreakdown) && payload.paymentBreakdown.length > 0
      ? payload.paymentBreakdown.filter((b) => Number(b.amount) > 0)
      : [{ method: payMethod === 'mixed' ? 'cash' : payMethod, amount: grandTotalPrice }];

  const invoice: PosInvoice = {
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    invoiceNumber,
    documentType,
    blNumber,
    productId: primaryProduct.id,
    productCode:
      invoiceItems.length === 1 ? primaryProduct.code : invoiceItems.map((i) => i.productCode).join(', '),
    productName:
      invoiceItems.length === 1
        ? primaryProduct.name
        : `${primaryProduct.name} (+${invoiceItems.length - 1})`,
    category: primaryProduct.category || '',
    warehouseId: primaryProduct.warehouseId || '',
    warehouseName: primaryProduct.warehouseName || '',
    items: invoiceItems,
    customerId,
    customerName,
    customerPhone,
    quantity: totalQuantity,
    unitPrice: avgUnitPrice,
    totalPrice: grandTotalPrice,
    purchasePrice: avgPurchaseCost,
    paymentMethod: payMethod,
    paymentBreakdown: cleanBreakdown,
    saleDate: payload.saleDate || now.slice(0, 10),
    notes: (payload.notes || '').trim(),
    printCount: 0,
    createdAt: now,
  };
  await putInStore(db, STORE_INVOICES, invoice);

  const trackedTypes = new Set<PaymentInstrumentType>(['check', 'bill_of_exchange', 'card']);
  const explicitInstruments = Array.isArray(payload.paymentInstruments)
    ? payload.paymentInstruments.filter(
        (inst) => trackedTypes.has(inst.instrumentType) && Number(inst.amount) > 0
      )
    : [];
  const toPersist = [...explicitInstruments];
  for (const split of cleanBreakdown) {
    if (trackedTypes.has(split.method as PaymentInstrumentType)) {
      const exists = toPersist.some((i) => i.instrumentType === split.method);
      if (!exists) {
        toPersist.push({
          instrumentType: split.method as PaymentInstrumentType,
          holderName: customerName || 'Client de passage',
          customerPhone,
          bankName: '',
          instrumentNumber: '',
          amount: split.amount,
          blNumber: blNumber || invoiceNumber,
          receiptDate: invoice.saleDate,
          dueDate: invoice.saleDate,
          notes: invoice.notes,
        });
      }
    }
  }
  for (const inst of toPersist) {
    const recDate = (inst.receiptDate || invoice.saleDate).trim() || now.slice(0, 10);
    const dueDate = (inst.dueDate || recDate).trim() || recDate;
    const instrument: PaymentInstrument = {
      id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
      instrumentType: inst.instrumentType,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      blNumber: (inst.blNumber || blNumber || invoiceNumber).trim(),
      customerId,
      customerName: customerName || (inst.holderName || '').trim(),
      customerPhone: (inst.customerPhone || customerPhone || '').trim(),
      holderName: (inst.holderName || customerName || '').trim(),
      bankName: (inst.bankName || '').trim(),
      instrumentNumber: (inst.instrumentNumber || '').trim(),
      amount: Math.round((Number(inst.amount) || 0) * 100) / 100,
      receiptDate: recDate,
      dueDate,
      status: 'pending',
      notes: (inst.notes || invoice.notes || '').trim(),
      createdAt: now,
      updatedAt: now,
    };
    await putInStore(db, STORE_PAYMENT_INSTRUMENTS, instrument);
  }

  const nextProducts = allProducts.map((p) => updatedProductsMap.get(p.id) || p);
  const primaryUpdated = updatedProductsMap.get(primaryProduct.id) || primaryProduct;
  return {
    invoice,
    digitalFile: await buildLocalDigitalFile(db, primaryUpdated),
    summary: computeSummary(nextProducts),
    nextBlSeq,
  };
}

export async function localConvertBlToInvoice(invoiceId: string): Promise<PosInvoice> {
  const db = await openDb();
  const inv = await getFromStore<PosInvoice>(db, STORE_INVOICES, invoiceId);
  if (!inv) throw new Error('BL not found');
  if (inv.documentType === 'facture' && inv.invoiceNumber.startsWith('FAC-')) {
    return inv;
  }
  const allInvoices = await getAllFromStore<PosInvoice>(db, STORE_INVOICES);
  let maxInv = 0;
  for (const row of allInvoices) {
    if (row.invoiceNumber.startsWith('FAC-')) {
      const n = Number.parseInt(row.invoiceNumber.slice(4), 10);
      if (Number.isFinite(n) && n > maxInv) maxInv = n;
    }
  }
  const formalNumber = `FAC-${String(maxInv + 1).padStart(4, '0')}`;
  const updated: PosInvoice = {
    ...inv,
    invoiceNumber: formalNumber,
    documentType: 'facture',
    blNumber: inv.blNumber || inv.invoiceNumber,
  };
  await putInStore(db, STORE_INVOICES, updated);
  const allInst = await getAllFromStore<PaymentInstrument>(db, STORE_PAYMENT_INSTRUMENTS);
  const now = new Date().toISOString();
  for (const inst of allInst) {
    if (inst.invoiceId === invoiceId) {
      await putInStore(db, STORE_PAYMENT_INSTRUMENTS, {
        ...inst,
        invoiceNumber: formalNumber,
        blNumber: updated.blNumber || inst.blNumber,
        updatedAt: now,
      });
    }
  }
  return updated;
}

export async function localMarkInvoicePrinted(invoiceId: string): Promise<PosInvoice> {
  const db = await openDb();
  const inv = await getFromStore<PosInvoice>(db, STORE_INVOICES, invoiceId);
  if (!inv) throw new Error('Invoice not found');
  const updated: PosInvoice = {
    ...inv,
    printCount: (Number(inv.printCount) || 0) + 1,
  };
  await putInStore(db, STORE_INVOICES, updated);
  return updated;
}

export async function localDeletePosSale(invoiceId: string): Promise<void> {
  const db = await openDb();
  const inv = await getFromStore<PosInvoice>(db, STORE_INVOICES, invoiceId);
  if (!inv) return;
  await deleteFromStore(db, STORE_INVOICES, invoiceId);
  const items: PosInvoiceItem[] =
    Array.isArray(inv.items) && inv.items.length > 0
      ? inv.items
      : [
          {
            productId: inv.productId,
            productCode: inv.productCode,
            productName: inv.productName,
            quantity: Number(inv.quantity) || 1,
            unitPrice: Number(inv.unitPrice) || 0,
            totalPrice: Number(inv.totalPrice) || 0,
            purchasePrice: Number(inv.purchasePrice) || 0,
          },
        ];

  const now = new Date().toISOString();
  for (const item of items) {
    const product = await getFromStore<Product>(db, STORE_PRODUCTS, item.productId);
    if (product) {
      const qtyToRestore = Number(item.quantity) || 1;
      const restoredQty = (Number(product.quantity) || 0) + qtyToRestore;
      await putInStore(db, STORE_PRODUCTS, {
        ...product,
        quantity: restoredQty,
        updatedAt: now,
      });
      await appendHistoryEvent(db, {
        productId: product.id,
        eventType: 'restocked',
        summary: `${inv.invoiceNumber} (+${qtyToRestore})`,
        details: `+${qtyToRestore}`,
        quantityDelta: qtyToRestore,
        quantityAfter: restoredQty,
        createdAt: now,
      });
    }
  }
  const allInst = await getAllFromStore<PaymentInstrument>(db, STORE_PAYMENT_INSTRUMENTS);
  for (const inst of allInst) {
    if (inst.invoiceId === invoiceId) {
      await deleteFromStore(db, STORE_PAYMENT_INSTRUMENTS, inst.id);
    }
  }
}

function computeLocalPortfolioSummary(instruments: PaymentInstrument[]): PaymentPortfolioSummary {
  const today = new Date().toISOString().slice(0, 10);
  const in7 = new Date();
  in7.setDate(in7.getDate() + 7);
  const in7Iso = in7.toISOString().slice(0, 10);
  let pendingCount = 0;
  let pendingAmountMad = 0;
  let dueSoonCount = 0;
  let dueSoonAmountMad = 0;
  let collectedCount = 0;
  let collectedAmountMad = 0;
  let bouncedCount = 0;
  let bouncedAmountMad = 0;

  for (const inst of instruments) {
    const amt = Number(inst.amount) || 0;
    if (inst.status === 'pending' || inst.status === 'deposited') {
      pendingCount += 1;
      pendingAmountMad += amt;
      const due = (inst.dueDate || inst.receiptDate || today).slice(0, 10);
      if (due <= in7Iso) {
        dueSoonCount += 1;
        dueSoonAmountMad += amt;
      }
    } else if (inst.status === 'collected') {
      collectedCount += 1;
      collectedAmountMad += amt;
    } else if (inst.status === 'bounced') {
      bouncedCount += 1;
      bouncedAmountMad += amt;
    }
  }

  return {
    totalCount: instruments.length,
    pendingCount,
    pendingAmountMad: Math.round(pendingAmountMad * 100) / 100,
    dueSoonCount,
    dueSoonAmountMad: Math.round(dueSoonAmountMad * 100) / 100,
    collectedCount,
    collectedAmountMad: Math.round(collectedAmountMad * 100) / 100,
    bouncedCount,
    bouncedAmountMad: Math.round(bouncedAmountMad * 100) / 100,
  };
}

export async function localListPaymentInstruments(): Promise<{
  instruments: PaymentInstrument[];
  summary: PaymentPortfolioSummary;
}> {
  const db = await openDb();
  await ensureSeeded(db);
  const instruments = await getAllFromStore<PaymentInstrument>(db, STORE_PAYMENT_INSTRUMENTS);
  instruments.sort(
    (a, b) =>
      (a.dueDate || '').localeCompare(b.dueDate || '') ||
      (b.receiptDate || '').localeCompare(a.receiptDate || '')
  );
  return { instruments, summary: computeLocalPortfolioSummary(instruments) };
}

export async function localCreatePaymentInstrument(
  payload: PaymentInstrumentPayload
): Promise<{ instrument: PaymentInstrument; summary: PaymentPortfolioSummary }> {
  const db = await openDb();
  const now = new Date().toISOString();
  const recDate = (payload.receiptDate || '').trim() || now.slice(0, 10);
  const dueDate = (payload.dueDate || '').trim() || recDate;
  const instrument: PaymentInstrument = {
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    instrumentType: payload.instrumentType,
    invoiceId: (payload.invoiceId || '').trim(),
    invoiceNumber: (payload.invoiceNumber || '').trim(),
    blNumber: (payload.blNumber || '').trim(),
    customerId: (payload.customerId || '').trim(),
    customerName: (payload.customerName || payload.holderName || '').trim(),
    customerPhone: (payload.customerPhone || '').trim(),
    holderName: (payload.holderName || '').trim(),
    bankName: (payload.bankName || '').trim(),
    instrumentNumber: (payload.instrumentNumber || '').trim(),
    amount: Math.round((Number(payload.amount) || 0) * 100) / 100,
    receiptDate: recDate,
    dueDate,
    status: (payload.status || 'pending') as PaymentInstrumentStatus,
    notes: (payload.notes || '').trim(),
    createdAt: now,
    updatedAt: now,
  };
  await putInStore(db, STORE_PAYMENT_INSTRUMENTS, instrument);
  const all = await getAllFromStore<PaymentInstrument>(db, STORE_PAYMENT_INSTRUMENTS);
  return { instrument, summary: computeLocalPortfolioSummary(all) };
}

export async function localUpdatePaymentInstrument(
  id: string,
  payload: Partial<PaymentInstrumentPayload>
): Promise<{ instrument: PaymentInstrument; summary: PaymentPortfolioSummary }> {
  const db = await openDb();
  const existing = await getFromStore<PaymentInstrument>(db, STORE_PAYMENT_INSTRUMENTS, id);
  if (!existing) throw new Error('Payment instrument not found');
  const updated: PaymentInstrument = {
    ...existing,
    instrumentType: payload.instrumentType ?? existing.instrumentType,
    blNumber: payload.blNumber !== undefined ? payload.blNumber.trim() : existing.blNumber,
    customerName: payload.customerName !== undefined ? payload.customerName.trim() : existing.customerName,
    customerPhone: payload.customerPhone !== undefined ? payload.customerPhone.trim() : existing.customerPhone,
    holderName: payload.holderName !== undefined ? payload.holderName.trim() : existing.holderName,
    bankName: payload.bankName !== undefined ? payload.bankName.trim() : existing.bankName,
    instrumentNumber:
      payload.instrumentNumber !== undefined ? payload.instrumentNumber.trim() : existing.instrumentNumber,
    amount:
      typeof payload.amount === 'number' && Number.isFinite(payload.amount) && payload.amount > 0
        ? Math.round(payload.amount * 100) / 100
        : existing.amount,
    receiptDate: payload.receiptDate !== undefined ? payload.receiptDate.trim() : existing.receiptDate,
    dueDate: payload.dueDate !== undefined ? payload.dueDate.trim() : existing.dueDate,
    status: payload.status ?? existing.status,
    notes: payload.notes !== undefined ? payload.notes.trim() : existing.notes,
    updatedAt: new Date().toISOString(),
  };
  await putInStore(db, STORE_PAYMENT_INSTRUMENTS, updated);
  const all = await getAllFromStore<PaymentInstrument>(db, STORE_PAYMENT_INSTRUMENTS);
  return { instrument: updated, summary: computeLocalPortfolioSummary(all) };
}

export async function localDeletePaymentInstrument(
  id: string
): Promise<{ summary: PaymentPortfolioSummary }> {
  const db = await openDb();
  await deleteFromStore(db, STORE_PAYMENT_INSTRUMENTS, id);
  const all = await getAllFromStore<PaymentInstrument>(db, STORE_PAYMENT_INSTRUMENTS);
  return { summary: computeLocalPortfolioSummary(all) };
}

// Local Warehouses CRUD
function computeNextWarehouseCode(warehouses: Warehouse[]): string {
  let maxNum = 0;
  for (const w of warehouses) {
    if (w.code.startsWith('WH')) {
      const n = Number.parseInt(w.code.slice(2), 10);
      if (Number.isFinite(n) && n > maxNum) maxNum = n;
    }
  }
  return `WH${String(maxNum + 1).padStart(4, '0')}`;
}

export async function localListWarehouses(): Promise<{ warehouses: Warehouse[] }> {
  const db = await openDb();
  await ensureSeeded(db);
  await ensureDefaultLocalWarehouse(db);
  const all = await getAllFromStore<Warehouse>(db, STORE_WAREHOUSES);
  all.sort((a, b) => (b.isDefault ? 1 : 0) - (a.isDefault ? 1 : 0) || a.createdAt.localeCompare(b.createdAt));
  return { warehouses: all };
}

export async function localCreateWarehouse(payload: WarehousePayload): Promise<Warehouse> {
  const db = await openDb();
  const all = await getAllFromStore<Warehouse>(db, STORE_WAREHOUSES);
  const now = new Date().toISOString();
  const id = crypto.randomUUID ? crypto.randomUUID() : `wh-${Date.now()}`;
  const isDefault = Boolean(payload.isDefault) || all.length === 0;
  if (isDefault) {
    for (const w of all) {
      if (w.isDefault) await putInStore(db, STORE_WAREHOUSES, { ...w, isDefault: false });
    }
  }
  const warehouse: Warehouse = {
    id,
    code: computeNextWarehouseCode(all),
    name: payload.name.trim(),
    location: payload.location.trim(),
    address: payload.address.trim(),
    phone: payload.phone.trim(),
    managerName: payload.managerName.trim(),
    notes: payload.notes.trim(),
    isDefault,
    createdAt: now,
    updatedAt: now,
  };
  await putInStore(db, STORE_WAREHOUSES, warehouse);
  return warehouse;
}

export async function localUpdateWarehouse(id: string, payload: WarehousePayload): Promise<Warehouse> {
  const db = await openDb();
  const all = await getAllFromStore<Warehouse>(db, STORE_WAREHOUSES);
  const existing = all.find((w) => w.id === id);
  if (!existing) throw new Error('Warehouse not found');
  const now = new Date().toISOString();
  const isDefault = payload.isDefault !== undefined ? Boolean(payload.isDefault) : existing.isDefault;
  if (isDefault) {
    for (const w of all) {
      if (w.id !== id && w.isDefault) {
        await putInStore(db, STORE_WAREHOUSES, { ...w, isDefault: false });
      }
    }
  }
  const updated: Warehouse = {
    ...existing,
    name: payload.name.trim(),
    location: payload.location.trim(),
    address: payload.address.trim(),
    phone: payload.phone.trim(),
    managerName: payload.managerName.trim(),
    notes: payload.notes.trim(),
    isDefault,
    updatedAt: now,
  };
  await putInStore(db, STORE_WAREHOUSES, updated);
  const allProducts = await getAllFromStore<Product>(db, STORE_PRODUCTS);
  for (const prod of allProducts) {
    if (prod.warehouseId === id) {
      await putInStore(db, STORE_PRODUCTS, { ...prod, warehouseName: updated.name });
    }
  }
  return updated;
}

export async function localDeleteWarehouse(id: string): Promise<void> {
  const db = await openDb();
  await deleteFromStore(db, STORE_WAREHOUSES, id);
  const defWh = await ensureDefaultLocalWarehouse(db);
  const allProducts = await getAllFromStore<Product>(db, STORE_PRODUCTS);
  for (const prod of allProducts) {
    if (prod.warehouseId === id) {
      await putInStore(db, STORE_PRODUCTS, {
        ...prod,
        warehouseId: defWh.id,
        warehouseName: defWh.name,
      });
    }
  }
}

// Local Suppliers CRUD
function computeNextSupplierCode(suppliers: Supplier[]): string {
  let maxNum = 0;
  for (const s of suppliers) {
    if (s.code.startsWith('FR')) {
      const n = Number.parseInt(s.code.slice(2), 10);
      if (Number.isFinite(n) && n > maxNum) maxNum = n;
    }
  }
  return `FR${String(maxNum + 1).padStart(4, '0')}`;
}

function computeSupplierSummary(suppliers: Supplier[]): SupplierSummary {
  let totalPurchases = 0;
  let totalSpentMad = 0;
  for (const s of suppliers) {
    const purchases = s.purchases || [];
    totalPurchases += purchases.length;
    for (const p of purchases) {
      totalSpentMad += Number(p.totalCost) || 0;
    }
  }
  return {
    totalSuppliers: suppliers.length,
    totalPurchases,
    totalSpentMad,
  };
}

export async function localListSuppliers(
  query: string,
  category?: string
): Promise<{ suppliers: Supplier[]; summary: SupplierSummary }> {
  const db = await openDb();
  await ensureSeeded(db);
  const all = await getAllFromStore<Supplier>(db, STORE_SUPPLIERS);
  all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const q = query.trim().toLowerCase();
  const filtered = all.filter((s) => {
    if (category && category !== 'all' && s.category !== category) return false;
    if (!q) return true;
    return (
      s.name.toLowerCase().includes(q) ||
      s.code.toLowerCase().includes(q) ||
      s.phone.toLowerCase().includes(q) ||
      s.city.toLowerCase().includes(q) ||
      s.address.toLowerCase().includes(q) ||
      (s.purchases || []).some(
        (p) =>
          p.productName.toLowerCase().includes(q) ||
          (p.productCode || '').toLowerCase().includes(q)
      )
    );
  });

  return {
    suppliers: filtered.map((s) => ({ ...s, gallery: s.gallery || [] })),
    summary: computeSupplierSummary(all),
  };
}

export async function localCreateSupplier(payload: SupplierPayload): Promise<Supplier> {
  const db = await openDb();
  const all = await getAllFromStore<Supplier>(db, STORE_SUPPLIERS);
  const now = new Date().toISOString();
  const id = crypto.randomUUID ? crypto.randomUUID() : `sup-${Date.now()}`;
  const supplier: Supplier = {
    id,
    code: computeNextSupplierCode(all),
    name: payload.name.trim(),
    phone: payload.phone.trim(),
    address: payload.address.trim(),
    city: payload.city.trim(),
    category: (payload.category || 'artisan') as SupplierCategory,
    notes: payload.notes.trim(),
    facebookUrl: (payload.facebookUrl || '').trim(),
    instagramUrl: (payload.instagramUrl || '').trim(),
    websiteUrl: (payload.websiteUrl || '').trim(),
    createdAt: now,
    updatedAt: now,
    purchases: [],
    gallery: [],
  };
  await putInStore(db, STORE_SUPPLIERS, supplier);
  return supplier;
}

export async function localUpdateSupplier(id: string, payload: SupplierPayload): Promise<Supplier> {
  const db = await openDb();
  const existing = await getFromStore<Supplier>(db, STORE_SUPPLIERS, id);
  if (!existing) throw new Error('Supplier not found');
  const updated: Supplier = {
    ...existing,
    name: payload.name.trim(),
    phone: payload.phone.trim(),
    address: payload.address.trim(),
    city: payload.city.trim(),
    category: (payload.category || 'artisan') as SupplierCategory,
    notes: payload.notes.trim(),
    facebookUrl: (payload.facebookUrl || '').trim(),
    instagramUrl: (payload.instagramUrl || '').trim(),
    websiteUrl: (payload.websiteUrl || '').trim(),
    updatedAt: new Date().toISOString(),
  };
  await putInStore(db, STORE_SUPPLIERS, updated);
  return updated;
}

export async function localDeleteSupplier(id: string): Promise<void> {
  const db = await openDb();
  await deleteFromStore(db, STORE_SUPPLIERS, id);
}

export async function localAddSupplierPurchase(
  supplierId: string,
  payload: SupplierPurchasePayload
): Promise<Supplier> {
  const db = await openDb();
  const existing = await getFromStore<Supplier>(db, STORE_SUPPLIERS, supplierId);
  if (!existing) throw new Error('Supplier not found');
  const now = new Date().toISOString();
  const qty = Math.max(1, Math.floor(Number(payload.quantity) || 1));
  const unitCost = Math.max(0, Number(payload.unitCost) || 0);
  const purchase: SupplierPurchase = {
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    supplierId,
    productId: payload.productId || '',
    productCode: payload.productCode.trim(),
    productName: payload.productName.trim(),
    category: (payload.category || '').trim(),
    warehouseId: payload.warehouseId || '',
    warehouseName: (payload.warehouseName || '').trim(),
    quantity: qty,
    unitCost,
    totalCost: Math.round(qty * unitCost * 100) / 100,
    purchaseDate: payload.purchaseDate || now.slice(0, 10),
    paymentMethod: (payload.paymentMethod || 'cash') as PurchasePaymentMethod,
    notes: payload.notes.trim(),
    createdAt: now,
  };
  const updated: Supplier = {
    ...existing,
    updatedAt: now,
    purchases: [purchase, ...(existing.purchases || [])],
  };
  await putInStore(db, STORE_SUPPLIERS, updated);
  return updated;
}

export async function localUpdateSupplierPurchase(
  supplierId: string,
  purchaseId: string,
  payload: SupplierPurchasePayload
): Promise<Supplier> {
  const db = await openDb();
  const existing = await getFromStore<Supplier>(db, STORE_SUPPLIERS, supplierId);
  if (!existing) throw new Error('Supplier not found');
  const now = new Date().toISOString();
  const qty = Math.max(1, Math.floor(Number(payload.quantity) || 1));
  const unitCost = Math.max(0, Number(payload.unitCost) || 0);
  const purchases = (existing.purchases || []).map((p) =>
    p.id === purchaseId
      ? {
          ...p,
          productId: payload.productId || '',
          productCode: payload.productCode.trim(),
          productName: payload.productName.trim(),
          category: (payload.category || '').trim(),
          warehouseId: payload.warehouseId || '',
          warehouseName: (payload.warehouseName || '').trim(),
          quantity: qty,
          unitCost,
          totalCost: Math.round(qty * unitCost * 100) / 100,
          purchaseDate: payload.purchaseDate || p.purchaseDate,
          paymentMethod: (payload.paymentMethod || 'cash') as PurchasePaymentMethod,
          notes: payload.notes.trim(),
        }
      : p
  );
  const updated: Supplier = {
    ...existing,
    updatedAt: now,
    purchases,
  };
  await putInStore(db, STORE_SUPPLIERS, updated);
  return updated;
}

export async function localDeleteSupplierPurchase(
  supplierId: string,
  purchaseId: string
): Promise<Supplier> {
  const db = await openDb();
  const existing = await getFromStore<Supplier>(db, STORE_SUPPLIERS, supplierId);
  if (!existing) throw new Error('Supplier not found');
  const updated: Supplier = {
    ...existing,
    updatedAt: new Date().toISOString(),
    purchases: (existing.purchases || []).filter((p) => p.id !== purchaseId),
    gallery: existing.gallery || [],
  };
  await putInStore(db, STORE_SUPPLIERS, updated);
  return updated;
}

export async function localAddSupplierGalleryImages(
  supplierId: string,
  items: SupplierGalleryPayload[]
): Promise<Supplier> {
  const db = await openDb();
  const existing = await getFromStore<Supplier>(db, STORE_SUPPLIERS, supplierId);
  if (!existing) throw new Error('Supplier not found');
  const now = new Date().toISOString();
  const newImages: SupplierGalleryImage[] = items
    .filter((item) =>
      Boolean(
        item.imageData &&
          (item.imageData.startsWith('data:image/') || item.imageData.startsWith('data:video/'))
      )
    )
    .map((item) => ({
      id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
      supplierId,
      title: (item.title || '').trim(),
      source: (item.source || 'upload') as CustomerImageSource,
      sourceUrl: (item.sourceUrl || '').trim(),
      imageData: String(item.imageData),
      createdAt: now,
    }));

  const updated: Supplier = {
    ...existing,
    updatedAt: now,
    gallery: [...newImages, ...(existing.gallery || [])],
  };
  await putInStore(db, STORE_SUPPLIERS, updated);
  return updated;
}

export async function localDeleteSupplierGalleryImage(
  supplierId: string,
  imageId: string
): Promise<Supplier> {
  const db = await openDb();
  const existing = await getFromStore<Supplier>(db, STORE_SUPPLIERS, supplierId);
  if (!existing) throw new Error('Supplier not found');
  const updated: Supplier = {
    ...existing,
    updatedAt: new Date().toISOString(),
    gallery: (existing.gallery || []).filter((img) => img.id !== imageId),
  };
  await putInStore(db, STORE_SUPPLIERS, updated);
  return updated;
}

// Local Inventory Adjustments
export async function localListAdjustments(): Promise<{ adjustments: InventoryAdjustment[] }> {
  const db = await openDb();
  const all = await getAllFromStore<InventoryAdjustment>(db, STORE_ADJUSTMENTS);
  all.sort(
    (a, b) =>
      b.adjustmentDate.localeCompare(a.adjustmentDate) || b.createdAt.localeCompare(a.createdAt)
  );
  return { adjustments: all };
}

export async function localCreateAdjustment(
  payload: InventoryAdjustmentPayload
): Promise<{ adjustment: InventoryAdjustment; summary: InventorySummary }> {
  const db = await openDb();
  const allProducts = (await getAllFromStore<Product>(db, STORE_PRODUCTS)).map(normalizeProductRecord);
  const product = allProducts.find((p) => p.id === payload.productId);
  if (!product) throw new Error('Product not found');

  const warehouses = await getAllFromStore<Warehouse>(db, STORE_WAREHOUSES);
  const suppliers = await getAllFromStore<Supplier>(db, STORE_SUPPLIERS);
  const allAdj = await getAllFromStore<InventoryAdjustment>(db, STORE_ADJUSTMENTS);

  let maxAdj = 0;
  for (const a of allAdj) {
    if (a.referenceNumber.startsWith('ADJ-')) {
      const n = Number.parseInt(a.referenceNumber.slice(4), 10);
      if (Number.isFinite(n) && n > maxAdj) maxAdj = n;
    }
  }
  const refNumber = `ADJ-${String(maxAdj + 1).padStart(4, '0')}`;

  const rawDelta = Math.trunc(Number(payload.quantityDelta) || 0);
  if (rawDelta === 0) throw new Error('Non-zero quantity required');

  let signedDelta = rawDelta;
  if (
    payload.adjustmentType === 'deduction' ||
    payload.adjustmentType === 'damage' ||
    payload.adjustmentType === 'loss'
  ) {
    signedDelta = -Math.abs(rawDelta);
  } else if (payload.adjustmentType === 'restock') {
    signedDelta = Math.abs(rawDelta);
  }

  const qtyBefore = Number(product.quantity) || 0;
  const qtyAfter =
    payload.adjustmentType === 'transfer' ? qtyBefore : Math.max(0, qtyBefore + signedDelta);
  const effectiveDelta = payload.adjustmentType === 'transfer' ? 0 : qtyAfter - qtyBefore;

  const warehouseId = (payload.warehouseId || product.warehouseId || '').trim();
  const wh = warehouses.find((w) => w.id === warehouseId);
  const warehouseName = wh?.name || product.warehouseName || '';

  const targetWarehouseId = (payload.targetWarehouseId || '').trim();
  const targetWh = warehouses.find((w) => w.id === targetWarehouseId);
  const targetWarehouseName = targetWh?.name || '';

  const supplierId = (payload.supplierId || product.supplierId || '').trim();
  const sup = suppliers.find((s) => s.id === supplierId);
  const supplierName = sup?.name || product.supplier || '';

  const unitCost = (Number(product.referencePrice) || 0) + (Number(product.expenses) || 0);
  const now = new Date().toISOString();
  const adjustmentDate = (payload.adjustmentDate || now.slice(0, 10)).trim();

  const adjustment: InventoryAdjustment = {
    id: crypto.randomUUID ? crypto.randomUUID() : `adj-${Date.now()}`,
    referenceNumber: refNumber,
    adjustmentType: (payload.adjustmentType || 'deduction') as AdjustmentType,
    warehouseId,
    warehouseName,
    targetWarehouseId,
    targetWarehouseName,
    productId: product.id,
    productCode: product.code,
    productName: product.name,
    category: product.category || '',
    color: product.color || '',
    supplierId,
    supplierName,
    quantityBefore: qtyBefore,
    quantityDelta: payload.adjustmentType === 'transfer' ? Math.abs(rawDelta) : effectiveDelta,
    quantityAfter: qtyAfter,
    unitCost,
    totalValue: Math.round(Math.abs(rawDelta) * unitCost * 100) / 100,
    reason: (payload.reason || '').trim(),
    notes: (payload.notes || '').trim(),
    adjustmentDate,
    createdAt: now,
  };

  await putInStore(db, STORE_ADJUSTMENTS, adjustment);

  const updatedProduct: Product =
    payload.adjustmentType === 'transfer' && targetWarehouseId && targetWarehouseName
      ? {
          ...product,
          warehouseId: targetWarehouseId,
          warehouseName: targetWarehouseName,
          updatedAt: now,
        }
      : {
          ...product,
          quantity: qtyAfter,
          updatedAt: now,
        };

  await putInStore(db, STORE_PRODUCTS, updatedProduct);
  await appendHistoryEvent(db, {
    productId: product.id,
    eventType: payload.adjustmentType === 'transfer' ? 'transferred' : 'adjusted',
    summary:
      payload.adjustmentType === 'transfer'
        ? `${refNumber} (${targetWarehouseName})`
        : `${refNumber} (${effectiveDelta >= 0 ? `+${effectiveDelta}` : effectiveDelta})`,
    details: adjustment.reason || warehouseName,
    quantityDelta: effectiveDelta,
    quantityAfter: qtyAfter,
    createdAt: now,
  });

  const nextProducts = allProducts.map((p) => (p.id === updatedProduct.id ? updatedProduct : p));
  return {
    adjustment,
    summary: computeSummary(nextProducts),
  };
}

export async function localDeleteAdjustment(id: string): Promise<void> {
  const db = await openDb();
  await deleteFromStore(db, STORE_ADJUSTMENTS, id);
}


