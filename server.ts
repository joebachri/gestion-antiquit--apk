import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import express from 'express';
import type { Request, Response } from 'express';
import Database from 'better-sqlite3';
import * as XLSX from 'xlsx';

interface ProductRow {
  id: string;
  code: string;
  name: string;
  description: string;
  length_cm: number;
  width_cm: number;
  height_cm: number;
  thickness_cm: number;
  pieces_count: number;
  quantity: number;
  reference_price: number;
  expenses: number;
  selling_price: number;
  added_date: string;
  created_at: string;
  updated_at: string;
}

interface PhotoRow {
  id: string;
  product_id: string;
  photo_code: string;
  image_data: string;
  sort_order: number;
  created_at: string;
}

interface PhotoInput {
  id?: string;
  imageData: string;
}

interface ProductInput {
  name: string;
  description?: string;
  lengthCm?: number;
  widthCm?: number;
  heightCm?: number;
  thicknessCm?: number;
  piecesCount?: number;
  quantity?: number;
  referencePrice?: number;
  expenses?: number;
  sellingPrice?: number;
  addedDate?: string;
  photos?: PhotoInput[];
  regenerateCode?: boolean;
}

const DATA_DIR = path.join(process.cwd(), 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_PATH = path.join(DATA_DIR, 'babsaida.db');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    length_cm REAL NOT NULL DEFAULT 0,
    width_cm REAL NOT NULL DEFAULT 0,
    height_cm REAL NOT NULL DEFAULT 0,
    thickness_cm REAL NOT NULL DEFAULT 0,
    pieces_count INTEGER NOT NULL DEFAULT 1,
    quantity INTEGER NOT NULL DEFAULT 1,
    reference_price REAL NOT NULL DEFAULT 0,
    expenses REAL NOT NULL DEFAULT 0,
    selling_price REAL NOT NULL DEFAULT 0,
    added_date TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS product_photos (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    photo_code TEXT UNIQUE NOT NULL,
    image_data TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS shop_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS oauth_states (
    state TEXT PRIMARY KEY,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS meta_connections (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL DEFAULT '',
    user_picture TEXT NOT NULL DEFAULT '',
    user_access_token TEXT NOT NULL,
    pages_json TEXT NOT NULL DEFAULT '[]',
    selected_page_id TEXT NOT NULL DEFAULT '',
    selected_ig_id TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    phone TEXT NOT NULL DEFAULT '',
    address TEXT NOT NULL DEFAULT '',
    city TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT 'regular',
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS customer_purchases (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    product_id TEXT NOT NULL DEFAULT '',
    product_code TEXT NOT NULL DEFAULT '',
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price REAL NOT NULL DEFAULT 0,
    total_price REAL NOT NULL DEFAULT 0,
    purchase_date TEXT NOT NULL,
    payment_method TEXT NOT NULL DEFAULT 'cash',
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
  );
`);

interface CustomerRow {
  id: string;
  code: string;
  name: string;
  phone: string;
  address: string;
  city: string;
  category: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

interface CustomerPurchaseRow {
  id: string;
  customer_id: string;
  product_id: string;
  product_code: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  purchase_date: string;
  payment_method: string;
  notes: string;
  created_at: string;
}

interface StoredMetaPage {
  id: string;
  name: string;
  accessToken: string;
  pictureUrl?: string;
  igAccount?: {
    id: string;
    username: string;
    name?: string;
    profilePictureUrl?: string;
  };
}

interface MetaConnectionRow {
  id: string;
  user_id: string;
  user_name: string;
  user_picture: string;
  user_access_token: string;
  pages_json: string;
  selected_page_id: string;
  selected_ig_id: string;
  updated_at: string;
}

const tempMediaStore = new Map<
  string,
  { buffer: Buffer; mimeType: string; expiresAt: number }
>();

function pruneTempMedia(): void {
  const now = Date.now();
  for (const [token, entry] of tempMediaStore.entries()) {
    if (entry.expiresAt <= now) {
      tempMediaStore.delete(token);
    }
  }
}

function getBaseAppUrl(req?: Request): string {
  const envUrl = (process.env.APP_URL || '').trim().replace(/\/+$/, '');
  if (envUrl) return envUrl;
  if (req) {
    const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    const host = req.get('host') || 'localhost:3000';
    return `${String(proto).split(',')[0].trim()}://${host}`;
  }
  return 'http://localhost:3000';
}

function decodeDataUrlToBuffer(dataUrl: string): { buffer: Buffer; mimeType: string } | null {
  const match = /^data:([^;,]+)(?:;[^,]*)?;base64,(.+)$/s.exec(dataUrl.trim());
  if (!match) return null;
  return {
    mimeType: match[1].trim(),
    buffer: Buffer.from(match[2], 'base64'),
  };
}

const DEFAULT_RATES_FROM_MAD: Record<string, number> = {
  MAD: 1,
  DH: 1,
  USD: 0.1,
  EUR: 0.1,
  TND: 0.3,
  DZD: 13.5,
};

async function getActiveRatesFromMad(): Promise<Record<string, number>> {
  return { ...DEFAULT_RATES_FROM_MAD };
}

function convertServerAmountFromMad(
  amountInMad: number,
  targetCurrency: string,
  rates: Record<string, number>
): number {
  const code = (targetCurrency || 'MAD').toUpperCase();
  const rate = rates[code] ?? DEFAULT_RATES_FROM_MAD[code] ?? 1;
  return Math.round((Number(amountInMad) || 0) * rate * 100) / 100;
}

function extractPrefixLetter(name: string): string {
  const normalized = name.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const match = normalized.match(/[A-Za-z0-9\u0600-\u06FF]/);
  if (!match) return 'A';
  const char = match[0];
  return /[a-z]/.test(char) ? char.toUpperCase() : char;
}

function generateNextProductCode(name: string, excludeProductId?: string): string {
  const prefix = extractPrefixLetter(name);
  const rows = db
    .prepare('SELECT id, code FROM products WHERE code LIKE ?')
    .all(`${prefix}%`) as Array<{ id: string; code: string }>;

  let maxNum = 0;
  for (const row of rows) {
    if (excludeProductId && row.id === excludeProductId) continue;
    const suffix = row.code.slice(prefix.length);
    if (/^\d+$/.test(suffix)) {
      const parsed = Number.parseInt(suffix, 10);
      if (parsed > maxNum) maxNum = parsed;
    }
  }
  const nextNum = maxNum + 1;
  return `${prefix}${String(nextNum).padStart(4, '0')}`;
}

function buildPhotoCode(productCode: string, index: number): string {
  return index === 0 ? productCode : `${productCode}-${index + 1}`;
}

function seedInitialData(): void {
  const seededFlag = db
    .prepare("SELECT value FROM shop_settings WHERE key = 'seeded'")
    .get() as { value: string } | undefined;

  if (seededFlag?.value === '1') return;

  const countRow = db.prepare('SELECT COUNT(*) as cnt FROM products').get() as { cnt: number };
  if (countRow.cnt > 0) {
    db.prepare("INSERT OR REPLACE INTO shop_settings (key, value) VALUES ('seeded', '1')").run();
    return;
  }

  const now = new Date().toISOString();
  const today = now.slice(0, 10);

  const initialItems = [
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
      addedDate: today,
      image: '/src/assets/images/antique_copper_lantern_1794787509666.jpg',
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
      addedDate: today,
      image: '/src/assets/images/antique_berber_chest_1794787509355.jpg',
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
      addedDate: today,
      image: '/src/assets/images/antique_fez_ceramic_1794787509914.jpg',
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
      addedDate: today,
      image: '/src/assets/images/antique_silver_tea_service_1794787510384.jpg',
    },
  ];

  const insertProduct = db.prepare(`
    INSERT INTO products (
      id, code, name, description,
      length_cm, width_cm, height_cm, thickness_cm, pieces_count,
      quantity, reference_price, expenses, selling_price,
      added_date, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertPhoto = db.prepare(`
    INSERT INTO product_photos (id, product_id, photo_code, image_data, sort_order, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const transaction = db.transaction(() => {
    for (const item of initialItems) {
      const id = crypto.randomUUID();
      const code = generateNextProductCode(item.name);
      insertProduct.run(
        id,
        code,
        item.name,
        item.description,
        item.lengthCm,
        item.widthCm,
        item.heightCm,
        item.thicknessCm,
        item.piecesCount,
        item.quantity,
        item.referencePrice,
        item.expenses,
        item.sellingPrice,
        item.addedDate,
        now,
        now
      );
      insertPhoto.run(crypto.randomUUID(), id, buildPhotoCode(code, 0), item.image, 0, now);
    }
    db.prepare("INSERT OR REPLACE INTO shop_settings (key, value) VALUES ('seeded', '1')").run();
    db.prepare("INSERT OR IGNORE INTO shop_settings (key, value) VALUES ('currency', 'MAD')").run();
    db.prepare("INSERT OR IGNORE INTO shop_settings (key, value) VALUES ('custom_logo', '')").run();
    db.prepare("INSERT OR IGNORE INTO shop_settings (key, value) VALUES ('store_name', '')").run();
  });

  transaction();
}

seedInitialData();

function mapProductsWithPhotos(rows: ProductRow[]) {
  const photosStmt = db.prepare(
    'SELECT * FROM product_photos WHERE product_id = ? ORDER BY sort_order ASC, created_at ASC'
  );
  return rows.map((row) => {
    const photos = (photosStmt.all(row.id) as PhotoRow[]).map((p) => ({
      id: p.id,
      productId: p.product_id,
      photoCode: p.photo_code,
      imageData: p.image_data,
      sortOrder: p.sort_order,
      createdAt: p.created_at,
    }));
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      description: row.description,
      lengthCm: row.length_cm,
      widthCm: row.width_cm,
      heightCm: row.height_cm,
      thicknessCm: row.thickness_cm,
      piecesCount: row.pieces_count,
      quantity: row.quantity,
      referencePrice: row.reference_price,
      expenses: row.expenses,
      sellingPrice: row.selling_price,
      addedDate: row.added_date,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      photos,
    };
  });
}

function getInventorySummary() {
  const allProducts = db.prepare('SELECT quantity, reference_price, expenses, selling_price FROM products').all() as Array<{
    quantity: number;
    reference_price: number;
    expenses: number;
    selling_price: number;
  }>;

  let totalUnits = 0;
  let totalSellingValue = 0;
  let totalReferenceCost = 0;

  for (const item of allProducts) {
    const qty = Math.max(0, Number(item.quantity) || 0);
    totalUnits += qty;
    totalSellingValue += qty * (Number(item.selling_price) || 0);
    totalReferenceCost += qty * ((Number(item.reference_price) || 0) + (Number(item.expenses) || 0));
  }

  return {
    totalReferences: allProducts.length,
    totalUnits,
    totalSellingValue,
    totalReferenceCost,
  };
}

function toNumber(value: unknown, fallback = 0): number {
  const num = Number(value);
  return Number.isFinite(num) && num >= 0 ? num : fallback;
}

function toInt(value: unknown, fallback = 1): number {
  const num = Math.floor(Number(value));
  return Number.isFinite(num) && num >= 0 ? num : fallback;
}

function generateNextCustomerCode(): string {
  const rows = db.prepare("SELECT code FROM customers WHERE code LIKE 'CL%'").all() as Array<{
    code: string;
  }>;
  let maxNum = 0;
  for (const row of rows) {
    const suffix = row.code.slice(2);
    if (/^\d+$/.test(suffix)) {
      const parsed = Number.parseInt(suffix, 10);
      if (parsed > maxNum) maxNum = parsed;
    }
  }
  return `CL${String(maxNum + 1).padStart(4, '0')}`;
}

function mapCustomersWithPurchases(rows: CustomerRow[]) {
  const purchaseStmt = db.prepare(
    'SELECT * FROM customer_purchases WHERE customer_id = ? ORDER BY purchase_date DESC, created_at DESC'
  );
  return rows.map((row) => {
    const purchases = (purchaseStmt.all(row.id) as CustomerPurchaseRow[]).map((p) => ({
      id: p.id,
      customerId: p.customer_id,
      productId: p.product_id || '',
      productCode: p.product_code,
      productName: p.product_name,
      quantity: p.quantity,
      unitPrice: p.unit_price,
      totalPrice: p.total_price,
      purchaseDate: p.purchase_date,
      paymentMethod: p.payment_method || 'cash',
      notes: p.notes || '',
      createdAt: p.created_at,
    }));
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      phone: row.phone || '',
      address: row.address || '',
      city: row.city || '',
      category: row.category || 'regular',
      notes: row.notes || '',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      purchases,
    };
  });
}

function getCustomerSummary() {
  const customersCount = (db.prepare('SELECT COUNT(*) as cnt FROM customers').get() as { cnt: number })
    .cnt;
  const stats = db
    .prepare(
      'SELECT COUNT(*) as totalPurchases, COALESCE(SUM(total_price), 0) as totalRevenue FROM customer_purchases'
    )
    .get() as { totalPurchases: number; totalRevenue: number };
  return {
    totalCustomers: customersCount,
    totalPurchases: Number(stats.totalPurchases) || 0,
    totalRevenueMad: Number(stats.totalRevenue) || 0,
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '100mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  app.get('/api/next-code', (req: Request, res: Response) => {
    const name = typeof req.query.name === 'string' ? req.query.name : '';
    const excludeId = typeof req.query.excludeId === 'string' ? req.query.excludeId : undefined;
    const code = generateNextProductCode(name, excludeId);
    res.json({ code });
  });

  app.get('/api/products', (req: Request, res: Response) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    let rows: ProductRow[];

    if (q) {
      const pattern = `%${q}%`;
      rows = db
        .prepare(
          `SELECT DISTINCT p.* FROM products p
           LEFT JOIN product_photos ph ON ph.product_id = p.id
           WHERE p.name LIKE ? COLLATE NOCASE
              OR p.code LIKE ? COLLATE NOCASE
              OR ph.photo_code LIKE ? COLLATE NOCASE
           ORDER BY p.created_at DESC`
        )
        .all(pattern, pattern, pattern) as ProductRow[];
    } else {
      rows = db.prepare('SELECT * FROM products ORDER BY created_at DESC').all() as ProductRow[];
    }

    res.json({
      products: mapProductsWithPhotos(rows),
      summary: getInventorySummary(),
    });
  });

  app.post('/api/products', (req: Request, res: Response) => {
    const body = req.body as ProductInput;
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    if (!name) {
      res.status(400).json({ error: 'Product name is required' });
      return;
    }

    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const code = generateNextProductCode(name);
    const addedDate =
      typeof body.addedDate === 'string' && body.addedDate.trim() ? body.addedDate.trim() : now.slice(0, 10);

    const photos = Array.isArray(body.photos) ? body.photos.filter((p) => p && typeof p.imageData === 'string' && p.imageData) : [];

    const insertProduct = db.prepare(`
      INSERT INTO products (
        id, code, name, description,
        length_cm, width_cm, height_cm, thickness_cm, pieces_count,
        quantity, reference_price, expenses, selling_price,
        added_date, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertPhoto = db.prepare(`
      INSERT INTO product_photos (id, product_id, photo_code, image_data, sort_order, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const transaction = db.transaction(() => {
      insertProduct.run(
        id,
        code,
        name,
        typeof body.description === 'string' ? body.description.trim() : '',
        toNumber(body.lengthCm, 0),
        toNumber(body.widthCm, 0),
        toNumber(body.heightCm, 0),
        toNumber(body.thicknessCm, 0),
        Math.max(1, toInt(body.piecesCount, 1)),
        toInt(body.quantity, 1),
        toNumber(body.referencePrice, 0),
        toNumber(body.expenses, 0),
        toNumber(body.sellingPrice, 0),
        addedDate,
        now,
        now
      );

      photos.forEach((photo, idx) => {
        insertPhoto.run(
          crypto.randomUUID(),
          id,
          buildPhotoCode(code, idx),
          photo.imageData,
          idx,
          now
        );
      });
    });

    transaction();

    const createdRow = db.prepare('SELECT * FROM products WHERE id = ?').get(id) as ProductRow;
    res.status(201).json({
      product: mapProductsWithPhotos([createdRow])[0],
      summary: getInventorySummary(),
    });
  });

  app.put('/api/products/:id', (req: Request, res: Response) => {
    const productId = req.params.id;
    const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(productId) as ProductRow | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    const body = req.body as ProductInput;
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    if (!name) {
      res.status(400).json({ error: 'Product name is required' });
      return;
    }

    const now = new Date().toISOString();
    const shouldRegen =
      Boolean(body.regenerateCode) || extractPrefixLetter(name) !== extractPrefixLetter(existing.name);
    const code = shouldRegen ? generateNextProductCode(name, productId) : existing.code;

    const addedDate =
      typeof body.addedDate === 'string' && body.addedDate.trim() ? body.addedDate.trim() : existing.added_date;

    const photos = Array.isArray(body.photos) ? body.photos.filter((p) => p && typeof p.imageData === 'string' && p.imageData) : [];

    const updateProduct = db.prepare(`
      UPDATE products SET
        code = ?,
        name = ?,
        description = ?,
        length_cm = ?,
        width_cm = ?,
        height_cm = ?,
        thickness_cm = ?,
        pieces_count = ?,
        quantity = ?,
        reference_price = ?,
        expenses = ?,
        selling_price = ?,
        added_date = ?,
        updated_at = ?
      WHERE id = ?
    `);

    const deletePhotos = db.prepare('DELETE FROM product_photos WHERE product_id = ?');
    const insertPhoto = db.prepare(`
      INSERT INTO product_photos (id, product_id, photo_code, image_data, sort_order, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const transaction = db.transaction(() => {
      updateProduct.run(
        code,
        name,
        typeof body.description === 'string' ? body.description.trim() : '',
        toNumber(body.lengthCm, 0),
        toNumber(body.widthCm, 0),
        toNumber(body.heightCm, 0),
        toNumber(body.thicknessCm, 0),
        Math.max(1, toInt(body.piecesCount, 1)),
        toInt(body.quantity, 1),
        toNumber(body.referencePrice, 0),
        toNumber(body.expenses, 0),
        toNumber(body.sellingPrice, 0),
        addedDate,
        now,
        productId
      );

      deletePhotos.run(productId);
      photos.forEach((photo, idx) => {
        insertPhoto.run(
          crypto.randomUUID(),
          productId,
          buildPhotoCode(code, idx),
          photo.imageData,
          idx,
          now
        );
      });
    });

    transaction();

    const updatedRow = db.prepare('SELECT * FROM products WHERE id = ?').get(productId) as ProductRow;
    res.json({
      product: mapProductsWithPhotos([updatedRow])[0],
      summary: getInventorySummary(),
    });
  });

  app.delete('/api/products/:id', (req: Request, res: Response) => {
    const result = db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
    if (result.changes === 0) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }
    res.json({ ok: true, summary: getInventorySummary() });
  });

  app.get('/api/settings', (_req: Request, res: Response) => {
    const rows = db.prepare('SELECT key, value FROM shop_settings').all() as Array<{ key: string; value: string }>;
    const map = new Map(rows.map((r) => [r.key, r.value]));
    res.json({
      customLogo: map.get('custom_logo') ?? '',
      storeName: map.get('store_name') ?? '',
      currency: map.get('currency') || 'MAD',
      facebookHandle: map.get('facebook_handle') ?? '',
      instagramHandle: map.get('instagram_handle') ?? '',
    });
  });

  app.put('/api/settings', (req: Request, res: Response) => {
    const body = req.body as {
      customLogo?: string;
      storeName?: string;
      currency?: string;
      facebookHandle?: string;
      instagramHandle?: string;
    };
    if (typeof body.customLogo === 'string') {
      db.prepare("INSERT OR REPLACE INTO shop_settings (key, value) VALUES ('custom_logo', ?)").run(body.customLogo);
    }
    if (typeof body.storeName === 'string') {
      db.prepare("INSERT OR REPLACE INTO shop_settings (key, value) VALUES ('store_name', ?)").run(
        body.storeName.trim().slice(0, 80)
      );
    }
    if (typeof body.currency === 'string' && body.currency.trim()) {
      db.prepare("INSERT OR REPLACE INTO shop_settings (key, value) VALUES ('currency', ?)").run(
        body.currency.trim().slice(0, 8)
      );
    }
    if (typeof body.facebookHandle === 'string') {
      db.prepare("INSERT OR REPLACE INTO shop_settings (key, value) VALUES ('facebook_handle', ?)").run(
        body.facebookHandle.trim().slice(0, 120)
      );
    }
    if (typeof body.instagramHandle === 'string') {
      db.prepare("INSERT OR REPLACE INTO shop_settings (key, value) VALUES ('instagram_handle', ?)").run(
        body.instagramHandle.trim().slice(0, 120)
      );
    }
    const rows = db.prepare('SELECT key, value FROM shop_settings').all() as Array<{ key: string; value: string }>;
    const map = new Map(rows.map((r) => [r.key, r.value]));
    res.json({
      customLogo: map.get('custom_logo') ?? '',
      storeName: map.get('store_name') ?? '',
      currency: map.get('currency') || 'MAD',
      facebookHandle: map.get('facebook_handle') ?? '',
      instagramHandle: map.get('instagram_handle') ?? '',
    });
  });

  // Meta (Facebook & Instagram) OAuth + Graph API Publishing
  app.get('/api/auth/meta/status', (req: Request, res: Response) => {
    const configured = Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET);
    const callbackUrl = `${getBaseAppUrl(req)}/auth/meta/callback`;
    const row = db
      .prepare("SELECT * FROM meta_connections WHERE id = 'primary'")
      .get() as MetaConnectionRow | undefined;

    if (!row) {
      res.json({
        configured,
        callbackUrl,
        connected: false,
        pages: [],
      });
      return;
    }

    let pages: StoredMetaPage[] = [];
    try {
      pages = JSON.parse(row.pages_json) as StoredMetaPage[];
    } catch {
      pages = [];
    }

    res.json({
      configured,
      callbackUrl,
      connected: true,
      userName: row.user_name,
      userPicture: row.user_picture,
      pages: pages.map((p) => ({
        id: p.id,
        name: p.name,
        pictureUrl: p.pictureUrl,
        igAccount: p.igAccount,
      })),
      selectedPageId: row.selected_page_id,
      selectedIgId: row.selected_ig_id,
    });
  });

  app.get('/api/auth/meta/url', (req: Request, res: Response) => {
    const clientId = (process.env.META_APP_ID || '').trim();
    const clientSecret = (process.env.META_APP_SECRET || '').trim();
    const callbackUrl = `${getBaseAppUrl(req)}/auth/meta/callback`;

    if (!clientId || !clientSecret) {
      res.status(400).json({
        error: 'META_OAUTH_NOT_CONFIGURED',
        callbackUrl,
      });
      return;
    }

    // Prune stale states older than 15 minutes
    db.prepare('DELETE FROM oauth_states WHERE created_at < ?').run(Date.now() - 15 * 60 * 1000);
    const state = crypto.randomBytes(24).toString('hex');
    db.prepare('INSERT INTO oauth_states (state, created_at) VALUES (?, ?)').run(state, Date.now());

    res.cookie('meta_oauth_state', state, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 15 * 60 * 1000,
    });

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: callbackUrl,
      state,
      response_type: 'code',
      scope:
        'public_profile,pages_show_list,pages_read_engagement,pages_manage_posts,instagram_basic,instagram_content_publish',
    });

    res.json({
      url: `https://www.facebook.com/v21.0/dialog/oauth?${params.toString()}`,
      callbackUrl,
    });
  });

  const handleMetaOAuthCallback = async (req: Request, res: Response) => {
    const sendPopupResult = (payload: { type: 'META_OAUTH_SUCCESS' | 'META_OAUTH_ERROR'; error?: string }) => {
      const safeJson = JSON.stringify(payload);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(`<!doctype html>
<html>
  <body style="font-family:sans-serif;padding:24px;text-align:center;background:#F7FAF8;color:#0B1F16;">
    <script>
      if (window.opener) {
        window.opener.postMessage(${safeJson}, '*');
        window.close();
      } else {
        window.location.href = '/';
      }
    </script>
    <p>${payload.type === 'META_OAUTH_SUCCESS' ? 'Connexion réussie. Vous pouvez fermer cette fenêtre.' : 'Erreur de connexion Meta.'}</p>
  </body>
</html>`);
    };

    const oauthError = typeof req.query.error_description === 'string'
      ? req.query.error_description
      : typeof req.query.error === 'string'
        ? req.query.error
        : '';
    if (oauthError) {
      sendPopupResult({ type: 'META_OAUTH_ERROR', error: oauthError });
      return;
    }

    const code = typeof req.query.code === 'string' ? req.query.code : '';
    const state = typeof req.query.state === 'string' ? req.query.state : '';

    if (!code || !state) {
      sendPopupResult({ type: 'META_OAUTH_ERROR', error: 'Missing OAuth code or state' });
      return;
    }

    const stateRow = db
      .prepare('SELECT state FROM oauth_states WHERE state = ?')
      .get(state) as { state: string } | undefined;
    db.prepare('DELETE FROM oauth_states WHERE state = ?').run(state);

    if (!stateRow) {
      sendPopupResult({ type: 'META_OAUTH_ERROR', error: 'Invalid or expired OAuth state' });
      return;
    }

    const clientId = (process.env.META_APP_ID || '').trim();
    const clientSecret = (process.env.META_APP_SECRET || '').trim();
    const redirectUri = `${getBaseAppUrl(req)}/auth/meta/callback`;

    if (!clientId || !clientSecret) {
      sendPopupResult({ type: 'META_OAUTH_ERROR', error: 'META_OAUTH_NOT_CONFIGURED' });
      return;
    }

    try {
      const tokenParams = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        code,
      });
      const tokenRes = await fetch(
        `https://graph.facebook.com/v21.0/oauth/access_token?${tokenParams.toString()}`
      );
      const tokenJson = (await tokenRes.json()) as {
        access_token?: string;
        error?: { message?: string };
      };
      if (!tokenRes.ok || !tokenJson.access_token) {
        sendPopupResult({
          type: 'META_OAUTH_ERROR',
          error: tokenJson.error?.message || 'Failed to exchange OAuth token',
        });
        return;
      }

      let accessToken = tokenJson.access_token;

      // Exchange for a 60-day long-lived user token when supported
      try {
        const longParams = new URLSearchParams({
          grant_type: 'fb_exchange_token',
          client_id: clientId,
          client_secret: clientSecret,
          fb_exchange_token: accessToken,
        });
        const longRes = await fetch(
          `https://graph.facebook.com/v21.0/oauth/access_token?${longParams.toString()}`
        );
        if (longRes.ok) {
          const longJson = (await longRes.json()) as { access_token?: string };
          if (longJson.access_token) accessToken = longJson.access_token;
        }
      } catch {
        // Keep short-lived token if exchange fails
      }

      const meRes = await fetch(
        `https://graph.facebook.com/v21.0/me?fields=id,name,picture.type(normal)&access_token=${encodeURIComponent(
          accessToken
        )}`
      );
      const meJson = (await meRes.json()) as {
        id?: string;
        name?: string;
        picture?: { data?: { url?: string } };
      };

      const pagesRes = await fetch(
        `https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token,picture{url},instagram_business_account{id,username,name,profile_picture_url}&access_token=${encodeURIComponent(
          accessToken
        )}`
      );
      const pagesJson = (await pagesRes.json()) as {
        data?: Array<{
          id: string;
          name: string;
          access_token: string;
          picture?: { data?: { url?: string } };
          instagram_business_account?: {
            id: string;
            username?: string;
            name?: string;
            profile_picture_url?: string;
          };
        }>;
      };

      const pages: StoredMetaPage[] = (pagesJson.data || []).map((p) => ({
        id: p.id,
        name: p.name,
        accessToken: p.access_token,
        pictureUrl: p.picture?.data?.url,
        igAccount: p.instagram_business_account
          ? {
              id: p.instagram_business_account.id,
              username:
                p.instagram_business_account.username ||
                p.instagram_business_account.name ||
                p.name,
              name: p.instagram_business_account.name,
              profilePictureUrl: p.instagram_business_account.profile_picture_url,
            }
          : undefined,
      }));

      const firstPageId = pages[0]?.id || '';
      const firstIgId = pages.find((p) => p.igAccount)?.igAccount?.id || '';
      const now = new Date().toISOString();

      db.prepare(
        `INSERT OR REPLACE INTO meta_connections (
          id, user_id, user_name, user_picture, user_access_token,
          pages_json, selected_page_id, selected_ig_id, updated_at
        ) VALUES ('primary', ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        meJson.id || 'meta-user',
        meJson.name || 'Meta Account',
        meJson.picture?.data?.url || '',
        accessToken,
        JSON.stringify(pages),
        firstPageId,
        firstIgId,
        now
      );

      res.cookie('meta_linked', '1', {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        maxAge: 60 * 24 * 60 * 60 * 1000,
      });

      sendPopupResult({ type: 'META_OAUTH_SUCCESS' });
    } catch (err) {
      sendPopupResult({
        type: 'META_OAUTH_ERROR',
        error: err instanceof Error ? err.message : 'Meta OAuth failed',
      });
    }
  };

  app.get(['/auth/meta/callback', '/auth/meta/callback/'], (req: Request, res: Response) => {
    void handleMetaOAuthCallback(req, res);
  });

  app.post('/api/auth/meta/select', (req: Request, res: Response) => {
    const body = req.body as { selectedPageId?: string; selectedIgId?: string };
    const existing = db
      .prepare("SELECT * FROM meta_connections WHERE id = 'primary'")
      .get() as MetaConnectionRow | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Not connected' });
      return;
    }

    const nextPageId =
      typeof body.selectedPageId === 'string' ? body.selectedPageId : existing.selected_page_id;
    const nextIgId =
      typeof body.selectedIgId === 'string' ? body.selectedIgId : existing.selected_ig_id;

    db.prepare(
      "UPDATE meta_connections SET selected_page_id = ?, selected_ig_id = ?, updated_at = ? WHERE id = 'primary'"
    ).run(nextPageId, nextIgId, new Date().toISOString());

    res.json({ ok: true, selectedPageId: nextPageId, selectedIgId: nextIgId });
  });

  app.post('/api/auth/meta/disconnect', (_req: Request, res: Response) => {
    db.prepare("DELETE FROM meta_connections WHERE id = 'primary'").run();
    res.clearCookie('meta_linked', { httpOnly: true, secure: true, sameSite: 'none' });
    res.json({ ok: true });
  });

  app.get('/api/media/temp/:token', (req: Request, res: Response) => {
    pruneTempMedia();
    const entry = tempMediaStore.get(req.params.token);
    if (!entry) {
      res.status(404).end();
      return;
    }
    const total = entry.buffer.length;
    res.setHeader('Content-Type', entry.mimeType);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'no-store');

    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = Number.parseInt(parts[0], 10);
      const end = parts[1] ? Number.parseInt(parts[1], 10) : total - 1;
      if (!Number.isNaN(start) && !Number.isNaN(end) && start <= end && end < total) {
        res.status(206);
        res.setHeader('Content-Range', `bytes ${start}-${end}/${total}`);
        res.setHeader('Content-Length', String(end - start + 1));
        res.end(entry.buffer.subarray(start, end + 1));
        return;
      }
    }

    res.setHeader('Content-Length', String(total));
    res.end(entry.buffer);
  });

  app.post('/api/social/publish/facebook', async (req: Request, res: Response) => {
    const row = db
      .prepare("SELECT * FROM meta_connections WHERE id = 'primary'")
      .get() as MetaConnectionRow | undefined;
    if (!row) {
      res.status(401).json({ error: 'Facebook account not linked' });
      return;
    }

    let pages: StoredMetaPage[] = [];
    try {
      pages = JSON.parse(row.pages_json) as StoredMetaPage[];
    } catch {
      pages = [];
    }

    const body = req.body as {
      message?: string;
      mediaDataUrl?: string;
      mediaType?: 'image' | 'video' | 'none';
      pageId?: string;
    };
    const targetPageId = body.pageId || row.selected_page_id || pages[0]?.id;
    const targetPage = pages.find((p) => p.id === targetPageId);
    if (!targetPage || !targetPage.accessToken) {
      res.status(400).json({
        error: 'No Facebook Page found on your linked Meta account.',
      });
      return;
    }

    const message = (body.message || '').trim();
    const decoded =
      body.mediaType !== 'none' && typeof body.mediaDataUrl === 'string' && body.mediaDataUrl
        ? decodeDataUrlToBuffer(body.mediaDataUrl)
        : null;

    try {
      let graphRes: globalThis.Response;
      if (decoded && (body.mediaType === 'video' || decoded.mimeType.startsWith('video/'))) {
        const form = new FormData();
        form.append('access_token', targetPage.accessToken);
        if (message) form.append('description', message);
        const ext = decoded.mimeType.includes('webm') ? 'webm' : 'mp4';
        form.append(
          'source',
          new Blob([new Uint8Array(decoded.buffer)], { type: decoded.mimeType }),
          `product.${ext}`
        );
        graphRes = await fetch(
          `https://graph.facebook.com/v21.0/${encodeURIComponent(targetPage.id)}/videos`,
          { method: 'POST', body: form }
        );
      } else if (decoded) {
        const form = new FormData();
        form.append('access_token', targetPage.accessToken);
        if (message) form.append('caption', message);
        const ext = decoded.mimeType === 'image/png' ? 'png' : 'jpg';
        form.append(
          'source',
          new Blob([new Uint8Array(decoded.buffer)], { type: decoded.mimeType }),
          `product.${ext}`
        );
        graphRes = await fetch(
          `https://graph.facebook.com/v21.0/${encodeURIComponent(targetPage.id)}/photos`,
          { method: 'POST', body: form }
        );
      } else {
        const params = new URLSearchParams({
          access_token: targetPage.accessToken,
          message,
        });
        graphRes = await fetch(
          `https://graph.facebook.com/v21.0/${encodeURIComponent(targetPage.id)}/feed`,
          { method: 'POST', body: params }
        );
      }

      const graphJson = (await graphRes.json()) as {
        id?: string;
        post_id?: string;
        error?: { message?: string };
      };
      if (!graphRes.ok || (!graphJson.id && !graphJson.post_id)) {
        res.status(400).json({
          error: graphJson.error?.message || 'Facebook Graph API publish failed',
        });
        return;
      }

      const postId = graphJson.post_id || graphJson.id || '';
      res.json({
        ok: true,
        postId,
        postUrl: postId ? `https://www.facebook.com/${postId}` : 'https://www.facebook.com/',
      });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Facebook publish error',
      });
    }
  });

  app.post('/api/social/publish/instagram', async (req: Request, res: Response) => {
    const row = db
      .prepare("SELECT * FROM meta_connections WHERE id = 'primary'")
      .get() as MetaConnectionRow | undefined;
    if (!row) {
      res.status(401).json({ error: 'Instagram account not linked' });
      return;
    }

    let pages: StoredMetaPage[] = [];
    try {
      pages = JSON.parse(row.pages_json) as StoredMetaPage[];
    } catch {
      pages = [];
    }

    const body = req.body as {
      caption?: string;
      mediaDataUrl?: string;
      publishMode?: 'post' | 'reel';
      shareToFeed?: boolean;
      igAccountId?: string;
    };

    const targetIgId =
      body.igAccountId || row.selected_ig_id || pages.find((p) => p.igAccount)?.igAccount?.id;
    const owningPage = pages.find((p) => p.igAccount?.id === targetIgId);
    const accessToken = owningPage?.accessToken || row.user_access_token;

    if (!targetIgId || !accessToken) {
      res.status(400).json({
        error:
          'No Instagram Business/Creator account linked to your Facebook Pages was found.',
      });
      return;
    }

    const decoded =
      typeof body.mediaDataUrl === 'string' ? decodeDataUrlToBuffer(body.mediaDataUrl) : null;
    if (!decoded) {
      res.status(400).json({ error: 'Missing or invalid media payload' });
      return;
    }

    pruneTempMedia();
    const token = crypto.randomUUID();
    tempMediaStore.set(token, {
      buffer: decoded.buffer,
      mimeType: decoded.mimeType,
      expiresAt: Date.now() + 10 * 60 * 1000,
    });

    const publicMediaUrl = `${getBaseAppUrl(req)}/api/media/temp/${token}`;
    const caption = (body.caption || '').trim();
    const isReel = body.publishMode === 'reel';

    try {
      const containerParams = new URLSearchParams({
        access_token: accessToken,
        caption,
      });

      if (isReel) {
        containerParams.set('media_type', 'REELS');
        containerParams.set('video_url', publicMediaUrl);
        containerParams.set('share_to_feed', body.shareToFeed === false ? 'false' : 'true');
      } else {
        containerParams.set('image_url', publicMediaUrl);
      }

      const containerRes = await fetch(
        `https://graph.facebook.com/v21.0/${encodeURIComponent(targetIgId)}/media`,
        { method: 'POST', body: containerParams }
      );
      const containerJson = (await containerRes.json()) as {
        id?: string;
        error?: { message?: string };
      };

      if (!containerRes.ok || !containerJson.id) {
        tempMediaStore.delete(token);
        res.status(400).json({
          error: containerJson.error?.message || 'Instagram media container creation failed',
        });
        return;
      }

      const creationId = containerJson.id;
      const maxAttempts = isReel ? 15 : 5;
      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        await new Promise((r) => setTimeout(r, isReel ? 1800 : 800));
        const statusRes = await fetch(
          `https://graph.facebook.com/v21.0/${encodeURIComponent(
            creationId
          )}?fields=status_code,status&access_token=${encodeURIComponent(accessToken)}`
        );
        if (statusRes.ok) {
          const statusJson = (await statusRes.json()) as {
            status_code?: string;
            status?: string;
          };
          if (statusJson.status_code === 'FINISHED' || statusJson.status_code === 'PUBLISHED') {
            break;
          }
          if (statusJson.status_code === 'ERROR' || statusJson.status_code === 'EXPIRED') {
            tempMediaStore.delete(token);
            res.status(400).json({
              error: `Instagram processing failed (${statusJson.status || statusJson.status_code})`,
            });
            return;
          }
        }
      }

      const publishParams = new URLSearchParams({
        creation_id: creationId,
        access_token: accessToken,
      });
      const publishRes = await fetch(
        `https://graph.facebook.com/v21.0/${encodeURIComponent(targetIgId)}/media_publish`,
        { method: 'POST', body: publishParams }
      );
      const publishJson = (await publishRes.json()) as {
        id?: string;
        error?: { message?: string };
      };

      tempMediaStore.delete(token);

      if (!publishRes.ok || !publishJson.id) {
        res.status(400).json({
          error: publishJson.error?.message || 'Instagram publish failed',
        });
        return;
      }

      let permalink = 'https://www.instagram.com/';
      try {
        const linkRes = await fetch(
          `https://graph.facebook.com/v21.0/${encodeURIComponent(
            publishJson.id
          )}?fields=permalink&access_token=${encodeURIComponent(accessToken)}`
        );
        if (linkRes.ok) {
          const linkJson = (await linkRes.json()) as { permalink?: string };
          if (linkJson.permalink) permalink = linkJson.permalink;
        }
      } catch {
        // fallback to instagram.com
      }

      res.json({ ok: true, mediaId: publishJson.id, permalink });
    } catch (err) {
      tempMediaStore.delete(token);
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Instagram publish error',
      });
    }
  });

  app.get('/api/exchange-rates', async (_req: Request, res: Response) => {
    const rates = await getActiveRatesFromMad();
    res.json({ base: 'MAD', rates });
  });

  app.get('/api/export/excel', async (req: Request, res: Response) => {
    const lang = req.query.lang === 'ar' ? 'ar' : 'fr';
    const settingsRow = db.prepare("SELECT value FROM shop_settings WHERE key = 'currency'").get() as
      | { value: string }
      | undefined;
    const currency = settingsRow?.value || 'MAD';
    const rates = await getActiveRatesFromMad();

    const rows = db.prepare('SELECT * FROM products ORDER BY code ASC').all() as ProductRow[];
    const products = mapProductsWithPhotos(rows);
    const summary = getInventorySummary();

    const headers =
      lang === 'ar'
        ? [
            'الرمز',
            'اسم المنتج',
            'الوصف',
            'الطول (سم)',
            'العرض (سم)',
            'الارتفاع (سم)',
            'السماكة (سم)',
            'عدد القطع',
            'الكمية',
            `السعر المرجعي (${currency})`,
            `المصاريف (${currency})`,
            `سعر البيع (${currency})`,
            `القيمة الإجمالية (${currency})`,
            'عدد الصور',
            'تاريخ الإضافة',
          ]
        : [
            'Code',
            'Nom',
            'Description',
            'Longueur (cm)',
            'Largeur (cm)',
            'Hauteur (cm)',
            'Épaisseur (cm)',
            'Nombre de pièces',
            'Quantité',
            `Prix de référence (${currency})`,
            `Frais (${currency})`,
            `Prix de vente (${currency})`,
            `Valeur totale (${currency})`,
            'Nombre de photos',
            "Date d'ajout",
          ];

    const sheetRows: Array<Array<string | number>> = [headers];
    let totalPhotos = 0;

    for (const item of products) {
      totalPhotos += item.photos.length;
      sheetRows.push([
        item.code,
        item.name,
        item.description || '',
        item.lengthCm,
        item.widthCm,
        item.heightCm,
        item.thicknessCm,
        item.piecesCount,
        item.quantity,
        convertServerAmountFromMad(item.referencePrice, currency, rates),
        convertServerAmountFromMad(item.expenses, currency, rates),
        convertServerAmountFromMad(item.sellingPrice, currency, rates),
        convertServerAmountFromMad(item.sellingPrice * item.quantity, currency, rates),
        item.photos.length,
        item.addedDate,
      ]);
    }

    sheetRows.push([
      lang === 'ar' ? 'المجموع' : 'TOTAL',
      lang === 'ar' ? `${summary.totalReferences} أصناف` : `${summary.totalReferences} références`,
      '',
      '',
      '',
      '',
      '',
      '',
      summary.totalUnits,
      convertServerAmountFromMad(summary.totalReferenceCost, currency, rates),
      '',
      '',
      convertServerAmountFromMad(summary.totalSellingValue, currency, rates),
      totalPhotos,
      '',
    ]);

    const workbook = XLSX.utils.book_new();
    if (lang === 'ar') {
      workbook.Workbook = { Views: [{ RTL: true }] };
    }

    const worksheet = XLSX.utils.aoa_to_sheet(sheetRows);
    worksheet['!cols'] = [
      { wch: 12 },
      { wch: 32 },
      { wch: 44 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
      { wch: 16 },
      { wch: 12 },
      { wch: 22 },
      { wch: 16 },
      { wch: 20 },
      { wch: 22 },
      { wch: 14 },
      { wch: 14 },
    ];
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Gestion Antiquites');

    const raw = XLSX.write(workbook, {
      type: 'buffer',
      bookType: 'xlsx',
      compression: true,
    }) as Buffer;
    const buffer = Buffer.from(raw);
    const dateStamp = new Date().toISOString().slice(0, 10);

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="gestion-antiquites-${dateStamp}.xlsx"`
    );
    res.setHeader('Content-Length', String(buffer.length));
    res.setHeader('Cache-Control', 'no-store');
    res.end(buffer);
  });

  // Customer Management & Purchase History Routes
  app.get('/api/customers', (req: Request, res: Response) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const category = typeof req.query.category === 'string' ? req.query.category.trim() : '';

    let rows: CustomerRow[];
    if (q && category && category !== 'all') {
      const pattern = `%${q}%`;
      rows = db
        .prepare(
          `SELECT DISTINCT c.* FROM customers c
           LEFT JOIN customer_purchases cp ON cp.customer_id = c.id
           WHERE c.category = ?
             AND (
               c.name LIKE ? COLLATE NOCASE
               OR c.code LIKE ? COLLATE NOCASE
               OR c.phone LIKE ? COLLATE NOCASE
               OR c.city LIKE ? COLLATE NOCASE
               OR c.address LIKE ? COLLATE NOCASE
               OR cp.product_name LIKE ? COLLATE NOCASE
               OR cp.product_code LIKE ? COLLATE NOCASE
             )
           ORDER BY c.created_at DESC`
        )
        .all(category, pattern, pattern, pattern, pattern, pattern, pattern, pattern) as CustomerRow[];
    } else if (q) {
      const pattern = `%${q}%`;
      rows = db
        .prepare(
          `SELECT DISTINCT c.* FROM customers c
           LEFT JOIN customer_purchases cp ON cp.customer_id = c.id
           WHERE c.name LIKE ? COLLATE NOCASE
              OR c.code LIKE ? COLLATE NOCASE
              OR c.phone LIKE ? COLLATE NOCASE
              OR c.city LIKE ? COLLATE NOCASE
              OR c.address LIKE ? COLLATE NOCASE
              OR cp.product_name LIKE ? COLLATE NOCASE
              OR cp.product_code LIKE ? COLLATE NOCASE
           ORDER BY c.created_at DESC`
        )
        .all(pattern, pattern, pattern, pattern, pattern, pattern, pattern) as CustomerRow[];
    } else if (category && category !== 'all') {
      rows = db
        .prepare('SELECT * FROM customers WHERE category = ? ORDER BY created_at DESC')
        .all(category) as CustomerRow[];
    } else {
      rows = db.prepare('SELECT * FROM customers ORDER BY created_at DESC').all() as CustomerRow[];
    }

    res.json({
      customers: mapCustomersWithPurchases(rows),
      summary: getCustomerSummary(),
    });
  });

  app.post('/api/customers', (req: Request, res: Response) => {
    const body = req.body as {
      name?: string;
      phone?: string;
      address?: string;
      city?: string;
      category?: string;
      notes?: string;
    };
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    if (!name) {
      res.status(400).json({ error: 'Customer name is required' });
      return;
    }

    const validCategories = new Set(['seller', 'hobbyist', 'regular', 'other']);
    const category =
      typeof body.category === 'string' && validCategories.has(body.category)
        ? body.category
        : 'regular';
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const code = generateNextCustomerCode();

    db.prepare(
      `INSERT INTO customers (
        id, code, name, phone, address, city, category, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      code,
      name,
      typeof body.phone === 'string' ? body.phone.trim() : '',
      typeof body.address === 'string' ? body.address.trim() : '',
      typeof body.city === 'string' ? body.city.trim() : '',
      category,
      typeof body.notes === 'string' ? body.notes.trim() : '',
      now,
      now
    );

    const row = db.prepare('SELECT * FROM customers WHERE id = ?').get(id) as CustomerRow;
    res.status(201).json({
      customer: mapCustomersWithPurchases([row])[0],
      summary: getCustomerSummary(),
    });
  });

  app.put('/api/customers/:id', (req: Request, res: Response) => {
    const existing = db
      .prepare('SELECT * FROM customers WHERE id = ?')
      .get(req.params.id) as CustomerRow | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Customer not found' });
      return;
    }

    const body = req.body as {
      name?: string;
      phone?: string;
      address?: string;
      city?: string;
      category?: string;
      notes?: string;
    };
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    if (!name) {
      res.status(400).json({ error: 'Customer name is required' });
      return;
    }

    const validCategories = new Set(['seller', 'hobbyist', 'regular', 'other']);
    const category =
      typeof body.category === 'string' && validCategories.has(body.category)
        ? body.category
        : existing.category;
    const now = new Date().toISOString();

    db.prepare(
      `UPDATE customers SET
        name = ?, phone = ?, address = ?, city = ?, category = ?, notes = ?, updated_at = ?
       WHERE id = ?`
    ).run(
      name,
      typeof body.phone === 'string' ? body.phone.trim() : '',
      typeof body.address === 'string' ? body.address.trim() : '',
      typeof body.city === 'string' ? body.city.trim() : '',
      category,
      typeof body.notes === 'string' ? body.notes.trim() : '',
      now,
      req.params.id
    );

    const updated = db
      .prepare('SELECT * FROM customers WHERE id = ?')
      .get(req.params.id) as CustomerRow;
    res.json({
      customer: mapCustomersWithPurchases([updated])[0],
      summary: getCustomerSummary(),
    });
  });

  app.delete('/api/customers/:id', (req: Request, res: Response) => {
    const result = db.prepare('DELETE FROM customers WHERE id = ?').run(req.params.id);
    if (result.changes === 0) {
      res.status(404).json({ error: 'Customer not found' });
      return;
    }
    res.json({ ok: true, summary: getCustomerSummary() });
  });

  app.post('/api/customers/:id/purchases', (req: Request, res: Response) => {
    const customer = db
      .prepare('SELECT * FROM customers WHERE id = ?')
      .get(req.params.id) as CustomerRow | undefined;
    if (!customer) {
      res.status(404).json({ error: 'Customer not found' });
      return;
    }

    const body = req.body as {
      productId?: string;
      productCode?: string;
      productName?: string;
      quantity?: number;
      unitPrice?: number;
      purchaseDate?: string;
      paymentMethod?: string;
      notes?: string;
    };
    const productName = typeof body?.productName === 'string' ? body.productName.trim() : '';
    if (!productName) {
      res.status(400).json({ error: 'Product name is required' });
      return;
    }

    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const qty = Math.max(1, toInt(body.quantity, 1));
    const unitPrice = toNumber(body.unitPrice, 0);
    const totalPrice = Math.round(qty * unitPrice * 100) / 100;
    const purchaseDate =
      typeof body.purchaseDate === 'string' && body.purchaseDate.trim()
        ? body.purchaseDate.trim()
        : now.slice(0, 10);
    const validPayments = new Set(['cash', 'transfer', 'check', 'card', 'other']);
    const paymentMethod =
      typeof body.paymentMethod === 'string' && validPayments.has(body.paymentMethod)
        ? body.paymentMethod
        : 'cash';

    db.prepare(
      `INSERT INTO customer_purchases (
        id, customer_id, product_id, product_code, product_name,
        quantity, unit_price, total_price, purchase_date, payment_method, notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      customer.id,
      typeof body.productId === 'string' ? body.productId.trim() : '',
      typeof body.productCode === 'string' ? body.productCode.trim() : '',
      productName,
      qty,
      unitPrice,
      totalPrice,
      purchaseDate,
      paymentMethod,
      typeof body.notes === 'string' ? body.notes.trim() : '',
      now
    );

    db.prepare('UPDATE customers SET updated_at = ? WHERE id = ?').run(now, customer.id);

    const updated = db
      .prepare('SELECT * FROM customers WHERE id = ?')
      .get(customer.id) as CustomerRow;
    res.status(201).json({
      customer: mapCustomersWithPurchases([updated])[0],
      summary: getCustomerSummary(),
    });
  });

  app.put('/api/customers/:id/purchases/:purchaseId', (req: Request, res: Response) => {
    const existingPurchase = db
      .prepare('SELECT * FROM customer_purchases WHERE id = ? AND customer_id = ?')
      .get(req.params.purchaseId, req.params.id) as CustomerPurchaseRow | undefined;
    if (!existingPurchase) {
      res.status(404).json({ error: 'Purchase record not found' });
      return;
    }

    const body = req.body as {
      productId?: string;
      productCode?: string;
      productName?: string;
      quantity?: number;
      unitPrice?: number;
      purchaseDate?: string;
      paymentMethod?: string;
      notes?: string;
    };
    const productName = typeof body?.productName === 'string' ? body.productName.trim() : '';
    if (!productName) {
      res.status(400).json({ error: 'Product name is required' });
      return;
    }

    const qty = Math.max(1, toInt(body.quantity, 1));
    const unitPrice = toNumber(body.unitPrice, 0);
    const totalPrice = Math.round(qty * unitPrice * 100) / 100;
    const purchaseDate =
      typeof body.purchaseDate === 'string' && body.purchaseDate.trim()
        ? body.purchaseDate.trim()
        : existingPurchase.purchase_date;
    const validPayments = new Set(['cash', 'transfer', 'check', 'card', 'other']);
    const paymentMethod =
      typeof body.paymentMethod === 'string' && validPayments.has(body.paymentMethod)
        ? body.paymentMethod
        : existingPurchase.payment_method;
    const now = new Date().toISOString();

    db.prepare(
      `UPDATE customer_purchases SET
        product_id = ?, product_code = ?, product_name = ?,
        quantity = ?, unit_price = ?, total_price = ?,
        purchase_date = ?, payment_method = ?, notes = ?
       WHERE id = ? AND customer_id = ?`
    ).run(
      typeof body.productId === 'string' ? body.productId.trim() : '',
      typeof body.productCode === 'string' ? body.productCode.trim() : '',
      productName,
      qty,
      unitPrice,
      totalPrice,
      purchaseDate,
      paymentMethod,
      typeof body.notes === 'string' ? body.notes.trim() : '',
      req.params.purchaseId,
      req.params.id
    );

    db.prepare('UPDATE customers SET updated_at = ? WHERE id = ?').run(now, req.params.id);

    const updated = db
      .prepare('SELECT * FROM customers WHERE id = ?')
      .get(req.params.id) as CustomerRow;
    res.json({
      customer: mapCustomersWithPurchases([updated])[0],
      summary: getCustomerSummary(),
    });
  });

  app.delete('/api/customers/:id/purchases/:purchaseId', (req: Request, res: Response) => {
    const result = db
      .prepare('DELETE FROM customer_purchases WHERE id = ? AND customer_id = ?')
      .run(req.params.purchaseId, req.params.id);
    if (result.changes === 0) {
      res.status(404).json({ error: 'Purchase record not found' });
      return;
    }

    const updated = db
      .prepare('SELECT * FROM customers WHERE id = ?')
      .get(req.params.id) as CustomerRow;
    res.json({
      customer: mapCustomersWithPurchases([updated])[0],
      summary: getCustomerSummary(),
    });
  });

  app.get('/api/export/customers/excel', async (req: Request, res: Response) => {
    const lang = req.query.lang === 'ar' ? 'ar' : 'fr';
    const customerId = typeof req.query.customerId === 'string' ? req.query.customerId.trim() : '';

    const settingsRow = db.prepare("SELECT value FROM shop_settings WHERE key = 'currency'").get() as
      | { value: string }
      | undefined;
    const currency = settingsRow?.value || 'MAD';
    const rates = await getActiveRatesFromMad();

    const rows = customerId
      ? (db.prepare('SELECT * FROM customers WHERE id = ?').all(customerId) as CustomerRow[])
      : (db.prepare('SELECT * FROM customers ORDER BY code ASC').all() as CustomerRow[]);

    const customers = mapCustomersWithPurchases(rows);

    const catLabel = (cat: string) => {
      if (lang === 'ar') {
        if (cat === 'seller') return 'بائع / تاجر';
        if (cat === 'hobbyist') return 'هاوٍ / جامع تحف';
        if (cat === 'regular') return 'عميل دائم';
        return 'أخرى';
      }
      if (cat === 'seller') return 'Vendeur / Revendeur';
      if (cat === 'hobbyist') return 'Amateur / Collectionneur';
      if (cat === 'regular') return 'Client régulier';
      return 'Autre';
    };

    const payLabel = (method: string) => {
      if (lang === 'ar') {
        if (method === 'cash') return 'نقداً';
        if (method === 'transfer') return 'تحويل بنكي';
        if (method === 'check') return 'شيك';
        if (method === 'card') return 'بطاقة بنكية';
        return 'أخرى';
      }
      if (method === 'cash') return 'Espèces';
      if (method === 'transfer') return 'Virement';
      if (method === 'check') return 'Chèque';
      if (method === 'card') return 'Carte bancaire';
      return 'Autre';
    };

    const profileHeaders =
      lang === 'ar'
        ? [
            'رمز العميل',
            'الاسم الكامل',
            'الفئة',
            'رقم الهاتف',
            'المدينة',
            'العنوان',
            'عدد المشتريات',
            `إجمالي المشتريات (${currency})`,
            'آخر شراء',
            'ملاحظات',
          ]
        : [
            'Code Client',
            'Nom complet',
            'Catégorie',
            'Téléphone',
            'Ville',
            'Adresse',
            "Nb d'achats",
            `Total acheté (${currency})`,
            'Dernier achat',
            'Notes',
          ];

    const profileRows: Array<Array<string | number>> = [profileHeaders];
    let grandPurchasesCount = 0;
    let grandRevenueMad = 0;

    for (const cust of customers) {
      const totalMad = cust.purchases.reduce((sum, p) => sum + (Number(p.totalPrice) || 0), 0);
      const lastDate =
        cust.purchases
          .map((p) => p.purchaseDate)
          .filter(Boolean)
          .sort()
          .pop() || '';
      grandPurchasesCount += cust.purchases.length;
      grandRevenueMad += totalMad;

      profileRows.push([
        cust.code,
        cust.name,
        catLabel(cust.category),
        cust.phone || '',
        cust.city || '',
        cust.address || '',
        cust.purchases.length,
        convertServerAmountFromMad(totalMad, currency, rates),
        lastDate,
        cust.notes || '',
      ]);
    }

    profileRows.push([
      lang === 'ar' ? 'المجموع' : 'TOTAL',
      lang === 'ar' ? `${customers.length} عملاء` : `${customers.length} client(s)`,
      '',
      '',
      '',
      '',
      grandPurchasesCount,
      convertServerAmountFromMad(grandRevenueMad, currency, rates),
      '',
      '',
    ]);

    const purchaseHeaders =
      lang === 'ar'
        ? [
            'رمز العميل',
            'اسم العميل',
            'رقم الهاتف',
            'المدينة',
            'الفئة',
            'تاريخ الشراء',
            'رمز المنتج',
            'اسم المنتج',
            'الكمية',
            `سعر الوحدة (${currency})`,
            `المجموع (${currency})`,
            'طريقة الدفع',
            'تفاصيل',
          ]
        : [
            'Code Client',
            'Nom Client',
            'Téléphone',
            'Ville',
            'Catégorie',
            "Date d'achat",
            'Code Produit',
            'Nom Produit',
            'Quantité',
            `Prix unitaire (${currency})`,
            `Total (${currency})`,
            'Paiement',
            'Détails',
          ];

    const purchaseRows: Array<Array<string | number>> = [purchaseHeaders];
    let totalQty = 0;
    let totalPurchasesMad = 0;

    for (const cust of customers) {
      for (const p of cust.purchases) {
        totalQty += Number(p.quantity) || 0;
        totalPurchasesMad += Number(p.totalPrice) || 0;
        purchaseRows.push([
          cust.code,
          cust.name,
          cust.phone || '',
          cust.city || '',
          catLabel(cust.category),
          p.purchaseDate,
          p.productCode || '',
          p.productName,
          p.quantity,
          convertServerAmountFromMad(p.unitPrice, currency, rates),
          convertServerAmountFromMad(p.totalPrice, currency, rates),
          payLabel(p.paymentMethod),
          p.notes || '',
        ]);
      }
    }

    purchaseRows.push([
      lang === 'ar' ? 'المجموع' : 'TOTAL',
      '',
      '',
      '',
      '',
      '',
      '',
      lang === 'ar' ? `${grandPurchasesCount} عمليات` : `${grandPurchasesCount} achat(s)`,
      totalQty,
      '',
      convertServerAmountFromMad(totalPurchasesMad, currency, rates),
      '',
      '',
    ]);

    const workbook = XLSX.utils.book_new();
    if (lang === 'ar') {
      workbook.Workbook = { Views: [{ RTL: true }] };
    }

    const profileSheet = XLSX.utils.aoa_to_sheet(profileRows);
    profileSheet['!cols'] = [
      { wch: 13 },
      { wch: 24 },
      { wch: 22 },
      { wch: 18 },
      { wch: 16 },
      { wch: 30 },
      { wch: 14 },
      { wch: 20 },
      { wch: 14 },
      { wch: 30 },
    ];

    const purchaseSheet = XLSX.utils.aoa_to_sheet(purchaseRows);
    purchaseSheet['!cols'] = [
      { wch: 13 },
      { wch: 22 },
      { wch: 18 },
      { wch: 15 },
      { wch: 20 },
      { wch: 14 },
      { wch: 13 },
      { wch: 28 },
      { wch: 10 },
      { wch: 18 },
      { wch: 18 },
      { wch: 16 },
      { wch: 28 },
    ];

    XLSX.utils.book_append_sheet(
      workbook,
      profileSheet,
      lang === 'ar' ? 'ملفات العملاء' : 'Profils Clients'
    );
    XLSX.utils.book_append_sheet(
      workbook,
      purchaseSheet,
      lang === 'ar' ? 'سجل المشتريات' : 'Historique Achats'
    );

    const raw = XLSX.write(workbook, {
      type: 'buffer',
      bookType: 'xlsx',
      compression: true,
    }) as Buffer;
    const buffer = Buffer.from(raw);
    const dateStamp = new Date().toISOString().slice(0, 10);
    const fileLabel = customers.length === 1 && customerId ? customers[0].code.toLowerCase() : 'tous';

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="clients-achats-${fileLabel}-${dateStamp}.xlsx"`
    );
    res.setHeader('Content-Length', String(buffer.length));
    res.setHeader('Cache-Control', 'no-store');
    res.end(buffer);
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve generated/seeded local images in production builds
    app.use('/src/assets/images', express.static(path.join(process.cwd(), 'src', 'assets', 'images')));
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`Gestion Antiquités server listening on port ${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
