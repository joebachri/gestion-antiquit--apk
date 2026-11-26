import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import dns from 'node:dns/promises';
import net from 'node:net';
import express from 'express';
import type { Request, Response } from 'express';
import Database from 'better-sqlite3';
import * as XLSX from 'xlsx';
import { localizeProduct, populateBilingualProductFields } from './src/utils/productTranslation.ts';

interface ProductRow {
  id: string;
  code: string;
  qr_token: string;
  name: string;
  name_fr: string;
  name_ar: string;
  description: string;
  description_fr: string;
  description_ar: string;
  category: string;
  category_fr: string;
  category_ar: string;
  color: string;
  color_fr: string;
  color_ar: string;
  warehouse_id: string;
  warehouse_name: string;
  supplier_id: string;
  supplier: string;
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
  code?: string;
  name: string;
  nameFr?: string;
  nameAr?: string;
  description?: string;
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

function sanitizeCustomProductCode(raw: string): string {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '-')
    .replace(/[^A-Z0-9\-_/.]/g, '')
    .slice(0, 32);
}

function ensureUniqueProductCode(candidate: string, excludeProductId?: string): string {
  const base = sanitizeCustomProductCode(candidate);
  if (!base) return '';
  let next = base;
  let suffix = 2;
  while (true) {
    const existing = excludeProductId
      ? (db
          .prepare('SELECT id FROM products WHERE UPPER(code) = UPPER(?) AND id != ?')
          .get(next, excludeProductId) as { id: string } | undefined)
      : (db.prepare('SELECT id FROM products WHERE UPPER(code) = UPPER(?)').get(next) as
          | { id: string }
          | undefined);
    if (!existing) return next;
    next = `${base}-${suffix}`;
    suffix += 1;
  }
}

interface SalesInvoiceItem {
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
  totalPrice: number;
  purchasePrice: number;
}

interface SalesInvoiceRow {
  id: string;
  invoice_number: string;
  product_id: string;
  product_code: string;
  product_name: string;
  category: string;
  warehouse_id: string;
  warehouse_name: string;
  items_json: string;
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  purchase_price: number;
  payment_method: string;
  sale_date: string;
  notes: string;
  print_count: number;
  created_at: string;
}

interface WarehouseRow {
  id: string;
  code: string;
  name: string;
  location: string;
  address: string;
  phone: string;
  manager_name: string;
  notes: string;
  is_default: number;
  created_at: string;
  updated_at: string;
}

interface SupplierRow {
  id: string;
  code: string;
  name: string;
  phone: string;
  address: string;
  city: string;
  category: string;
  notes: string;
  facebook_url: string;
  instagram_url: string;
  website_url: string;
  created_at: string;
  updated_at: string;
}

interface SupplierPurchaseRow {
  id: string;
  supplier_id: string;
  product_id: string;
  product_code: string;
  product_name: string;
  category: string;
  warehouse_id: string;
  warehouse_name: string;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  purchase_date: string;
  payment_method: string;
  notes: string;
  created_at: string;
}

interface SupplierGalleryRow {
  id: string;
  supplier_id: string;
  title: string;
  source: string;
  source_url: string;
  image_data: string;
  created_at: string;
}

interface InventoryAdjustmentRow {
  id: string;
  reference_number: string;
  adjustment_type: string;
  warehouse_id: string;
  warehouse_name: string;
  target_warehouse_id: string;
  target_warehouse_name: string;
  product_id: string;
  product_code: string;
  product_name: string;
  category: string;
  color: string;
  supplier_id: string;
  supplier_name: string;
  quantity_before: number;
  quantity_delta: number;
  quantity_after: number;
  unit_cost: number;
  total_value: number;
  reason: string;
  notes: string;
  adjustment_date: string;
  created_at: string;
}

interface ProductHistoryRow {
  id: string;
  product_id: string;
  event_type: string;
  summary: string;
  details: string;
  quantity_delta: number;
  quantity_after: number;
  created_at: string;
}

const DATA_DIR = process.env.DATA_DIR?.trim()
  ? path.resolve(process.env.DATA_DIR.trim())
  : path.join(process.cwd(), 'data');
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
    facebook_url TEXT NOT NULL DEFAULT '',
    instagram_url TEXT NOT NULL DEFAULT '',
    website_url TEXT NOT NULL DEFAULT '',
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

  CREATE TABLE IF NOT EXISTS customer_gallery (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    source TEXT NOT NULL DEFAULT 'upload',
    source_url TEXT NOT NULL DEFAULT '',
    image_data TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS sales_invoices (
    id TEXT PRIMARY KEY,
    invoice_number TEXT UNIQUE NOT NULL,
    product_id TEXT NOT NULL,
    product_code TEXT NOT NULL DEFAULT '',
    product_name TEXT NOT NULL,
    customer_id TEXT NOT NULL DEFAULT '',
    customer_name TEXT NOT NULL DEFAULT '',
    customer_phone TEXT NOT NULL DEFAULT '',
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price REAL NOT NULL DEFAULT 0,
    total_price REAL NOT NULL DEFAULT 0,
    purchase_price REAL NOT NULL DEFAULT 0,
    payment_method TEXT NOT NULL DEFAULT 'cash',
    sale_date TEXT NOT NULL,
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS product_history (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    summary TEXT NOT NULL DEFAULT '',
    details TEXT NOT NULL DEFAULT '',
    quantity_delta INTEGER NOT NULL DEFAULT 0,
    quantity_after INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS warehouses (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    location TEXT NOT NULL DEFAULT '',
    address TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    manager_name TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    is_default INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS suppliers (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    phone TEXT NOT NULL DEFAULT '',
    address TEXT NOT NULL DEFAULT '',
    city TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT 'artisan',
    notes TEXT NOT NULL DEFAULT '',
    facebook_url TEXT NOT NULL DEFAULT '',
    instagram_url TEXT NOT NULL DEFAULT '',
    website_url TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS supplier_purchases (
    id TEXT PRIMARY KEY,
    supplier_id TEXT NOT NULL,
    product_id TEXT NOT NULL DEFAULT '',
    product_code TEXT NOT NULL DEFAULT '',
    product_name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT '',
    warehouse_id TEXT NOT NULL DEFAULT '',
    warehouse_name TEXT NOT NULL DEFAULT '',
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_cost REAL NOT NULL DEFAULT 0,
    total_cost REAL NOT NULL DEFAULT 0,
    purchase_date TEXT NOT NULL,
    payment_method TEXT NOT NULL DEFAULT 'cash',
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS supplier_gallery (
    id TEXT PRIMARY KEY,
    supplier_id TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    source TEXT NOT NULL DEFAULT 'upload',
    source_url TEXT NOT NULL DEFAULT '',
    image_data TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS inventory_adjustments (
    id TEXT PRIMARY KEY,
    reference_number TEXT UNIQUE NOT NULL,
    adjustment_type TEXT NOT NULL DEFAULT 'deduction',
    warehouse_id TEXT NOT NULL DEFAULT '',
    warehouse_name TEXT NOT NULL DEFAULT '',
    target_warehouse_id TEXT NOT NULL DEFAULT '',
    target_warehouse_name TEXT NOT NULL DEFAULT '',
    product_id TEXT NOT NULL,
    product_code TEXT NOT NULL DEFAULT '',
    product_name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT '',
    color TEXT NOT NULL DEFAULT '',
    supplier_id TEXT NOT NULL DEFAULT '',
    supplier_name TEXT NOT NULL DEFAULT '',
    quantity_before INTEGER NOT NULL DEFAULT 0,
    quantity_delta INTEGER NOT NULL DEFAULT 0,
    quantity_after INTEGER NOT NULL DEFAULT 0,
    unit_cost REAL NOT NULL DEFAULT 0,
    total_value REAL NOT NULL DEFAULT 0,
    reason TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    adjustment_date TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`);

const productTableColumns = (
  db.prepare('PRAGMA table_info(products)').all() as Array<{ name: string }>
).map((col) => col.name);
if (!productTableColumns.includes('supplier')) {
  db.exec("ALTER TABLE products ADD COLUMN supplier TEXT NOT NULL DEFAULT ''");
}
if (!productTableColumns.includes('qr_token')) {
  db.exec("ALTER TABLE products ADD COLUMN qr_token TEXT NOT NULL DEFAULT ''");
}
if (!productTableColumns.includes('category')) {
  db.exec("ALTER TABLE products ADD COLUMN category TEXT NOT NULL DEFAULT ''");
}
if (!productTableColumns.includes('color')) {
  db.exec("ALTER TABLE products ADD COLUMN color TEXT NOT NULL DEFAULT ''");
}
if (!productTableColumns.includes('warehouse_id')) {
  db.exec("ALTER TABLE products ADD COLUMN warehouse_id TEXT NOT NULL DEFAULT ''");
}
if (!productTableColumns.includes('warehouse_name')) {
  db.exec("ALTER TABLE products ADD COLUMN warehouse_name TEXT NOT NULL DEFAULT ''");
}
if (!productTableColumns.includes('supplier_id')) {
  db.exec("ALTER TABLE products ADD COLUMN supplier_id TEXT NOT NULL DEFAULT ''");
}
if (!productTableColumns.includes('name_fr')) {
  db.exec("ALTER TABLE products ADD COLUMN name_fr TEXT NOT NULL DEFAULT ''");
}
if (!productTableColumns.includes('name_ar')) {
  db.exec("ALTER TABLE products ADD COLUMN name_ar TEXT NOT NULL DEFAULT ''");
}
if (!productTableColumns.includes('description_fr')) {
  db.exec("ALTER TABLE products ADD COLUMN description_fr TEXT NOT NULL DEFAULT ''");
}
if (!productTableColumns.includes('description_ar')) {
  db.exec("ALTER TABLE products ADD COLUMN description_ar TEXT NOT NULL DEFAULT ''");
}
if (!productTableColumns.includes('category_fr')) {
  db.exec("ALTER TABLE products ADD COLUMN category_fr TEXT NOT NULL DEFAULT ''");
}
if (!productTableColumns.includes('category_ar')) {
  db.exec("ALTER TABLE products ADD COLUMN category_ar TEXT NOT NULL DEFAULT ''");
}
if (!productTableColumns.includes('color_fr')) {
  db.exec("ALTER TABLE products ADD COLUMN color_fr TEXT NOT NULL DEFAULT ''");
}
if (!productTableColumns.includes('color_ar')) {
  db.exec("ALTER TABLE products ADD COLUMN color_ar TEXT NOT NULL DEFAULT ''");
}
db.exec("UPDATE products SET qr_token = 'GA-QR-' || code WHERE qr_token = ''");

const salesInvoiceTableColumns = (
  db.prepare('PRAGMA table_info(sales_invoices)').all() as Array<{ name: string }>
).map((col) => col.name);
if (!salesInvoiceTableColumns.includes('items_json')) {
  db.exec("ALTER TABLE sales_invoices ADD COLUMN items_json TEXT NOT NULL DEFAULT '[]'");
}
if (!salesInvoiceTableColumns.includes('category')) {
  db.exec("ALTER TABLE sales_invoices ADD COLUMN category TEXT NOT NULL DEFAULT ''");
}
if (!salesInvoiceTableColumns.includes('warehouse_id')) {
  db.exec("ALTER TABLE sales_invoices ADD COLUMN warehouse_id TEXT NOT NULL DEFAULT ''");
}
if (!salesInvoiceTableColumns.includes('warehouse_name')) {
  db.exec("ALTER TABLE sales_invoices ADD COLUMN warehouse_name TEXT NOT NULL DEFAULT ''");
}
if (!salesInvoiceTableColumns.includes('print_count')) {
  db.exec('ALTER TABLE sales_invoices ADD COLUMN print_count INTEGER NOT NULL DEFAULT 0');
}

const customerTableColumns = (
  db.prepare('PRAGMA table_info(customers)').all() as Array<{ name: string }>
).map((col) => col.name);
if (!customerTableColumns.includes('facebook_url')) {
  db.exec("ALTER TABLE customers ADD COLUMN facebook_url TEXT NOT NULL DEFAULT ''");
}
if (!customerTableColumns.includes('instagram_url')) {
  db.exec("ALTER TABLE customers ADD COLUMN instagram_url TEXT NOT NULL DEFAULT ''");
}
if (!customerTableColumns.includes('website_url')) {
  db.exec("ALTER TABLE customers ADD COLUMN website_url TEXT NOT NULL DEFAULT ''");
}

interface CustomerRow {
  id: string;
  code: string;
  name: string;
  phone: string;
  address: string;
  city: string;
  category: string;
  notes: string;
  facebook_url: string;
  instagram_url: string;
  website_url: string;
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

interface CustomerGalleryRow {
  id: string;
  customer_id: string;
  title: string;
  source: string;
  source_url: string;
  image_data: string;
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
      addedDate: today,
      image: '/src/assets/images/antique_copper_lantern_1794787509666.jpg',
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
      addedDate: today,
      image: '/src/assets/images/antique_berber_chest_1794787509355.jpg',
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
      addedDate: today,
      image: '/src/assets/images/antique_fez_ceramic_1794787509914.jpg',
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
      addedDate: today,
      image: '/src/assets/images/antique_silver_tea_service_1794787510384.jpg',
    },
  ];

  const insertProduct = db.prepare(`
    INSERT INTO products (
      id, code, qr_token, name, description, supplier,
      length_cm, width_cm, height_cm, thickness_cm, pieces_count,
      quantity, reference_price, expenses, selling_price,
      added_date, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertPhoto = db.prepare(`
    INSERT INTO product_photos (id, product_id, photo_code, image_data, sort_order, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const insertHistory = db.prepare(`
    INSERT INTO product_history (id, product_id, event_type, summary, details, quantity_delta, quantity_after, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const transaction = db.transaction(() => {
    for (const item of initialItems) {
      const id = crypto.randomUUID();
      const code = generateNextProductCode(item.name);
      const qrToken = `GA-QR-${code}`;
      insertProduct.run(
        id,
        code,
        qrToken,
        item.name,
        item.description,
        item.supplier,
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
      insertHistory.run(
        crypto.randomUUID(),
        id,
        'created',
        `Fiche créée (${code})`,
        item.supplier ? `Fournisseur: ${item.supplier}` : '',
        item.quantity,
        item.quantity,
        now
      );
    }
    db.prepare("INSERT OR REPLACE INTO shop_settings (key, value) VALUES ('seeded', '1')").run();
    db.prepare("INSERT OR IGNORE INTO shop_settings (key, value) VALUES ('currency', 'MAD')").run();
    db.prepare("INSERT OR IGNORE INTO shop_settings (key, value) VALUES ('custom_logo', '')").run();
    db.prepare("INSERT OR IGNORE INTO shop_settings (key, value) VALUES ('store_name', '')").run();
    db.prepare("INSERT OR IGNORE INTO shop_settings (key, value) VALUES ('whatsapp_phone', '')").run();
    db.prepare("INSERT OR IGNORE INTO shop_settings (key, value) VALUES ('public_app_url', '')").run();
  });

  transaction();
}

seedInitialData();

function backfillInitialProductHistory(): void {
  const existingProducts = db.prepare('SELECT * FROM products').all() as ProductRow[];
  const countStmt = db.prepare('SELECT COUNT(*) as cnt FROM product_history WHERE product_id = ?');
  const insertHist = db.prepare(
    `INSERT INTO product_history (id, product_id, event_type, summary, details, quantity_delta, quantity_after, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  for (const row of existingProducts) {
    const cnt = (countStmt.get(row.id) as { cnt: number }).cnt;
    if (cnt === 0) {
      insertHist.run(
        crypto.randomUUID(),
        row.id,
        'created',
        `Fiche initialisée (${row.code})`,
        row.supplier ? `Fournisseur: ${row.supplier}` : '',
        row.quantity,
        row.quantity,
        row.created_at || new Date().toISOString()
      );
    }
  }
}

backfillInitialProductHistory();

function backfillBilingualProducts(): void {
  const rows = db.prepare('SELECT * FROM products').all() as ProductRow[];
  const updateStmt = db.prepare(
    `UPDATE products SET
      name_fr = ?,
      name_ar = ?,
      description_fr = ?,
      description_ar = ?,
      category_fr = ?,
      category_ar = ?,
      color_fr = ?,
      color_ar = ?
     WHERE id = ?`
  );
  const tx = db.transaction(() => {
    for (const row of rows) {
      const needsName = !row.name_fr || !row.name_ar;
      const needsDesc = Boolean(row.description) && (!row.description_fr || !row.description_ar);
      const needsCat = Boolean(row.category) && (!row.category_fr || !row.category_ar);
      const needsColor = Boolean(row.color) && (!row.color_fr || !row.color_ar);
      if (!needsName && !needsDesc && !needsCat && !needsColor) continue;

      const populated = populateBilingualProductFields({
        name: row.name || '',
        nameFr: row.name_fr || '',
        nameAr: row.name_ar || '',
        description: row.description || '',
        descriptionFr: row.description_fr || '',
        descriptionAr: row.description_ar || '',
        category: row.category || '',
        categoryFr: row.category_fr || '',
        categoryAr: row.category_ar || '',
        color: row.color || '',
        colorFr: row.color_fr || '',
        colorAr: row.color_ar || '',
        sellingPrice: row.selling_price || 0,
      });

      updateStmt.run(
        populated.nameFr || '',
        populated.nameAr || '',
        populated.descriptionFr || '',
        populated.descriptionAr || '',
        populated.categoryFr || '',
        populated.categoryAr || '',
        populated.colorFr || '',
        populated.colorAr || '',
        row.id
      );
    }
  });
  tx();
}

backfillBilingualProducts();

function logProductHistory(
  productId: string,
  eventType: string,
  summary: string,
  details: string,
  quantityDelta: number,
  quantityAfter: number,
  createdAt = new Date().toISOString()
): void {
  db.prepare(
    `INSERT INTO product_history (
      id, product_id, event_type, summary, details, quantity_delta, quantity_after, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(crypto.randomUUID(), productId, eventType, summary, details, quantityDelta, quantityAfter, createdAt);
}

function ensureDefaultWarehouse(): WarehouseRow {
  const existingDefault = db
    .prepare('SELECT * FROM warehouses WHERE is_default = 1 LIMIT 1')
    .get() as WarehouseRow | undefined;
  if (existingDefault) return existingDefault;

  const first = db.prepare('SELECT * FROM warehouses ORDER BY created_at ASC LIMIT 1').get() as
    | WarehouseRow
    | undefined;
  if (first) {
    db.prepare('UPDATE warehouses SET is_default = 1 WHERE id = ?').run(first.id);
    return { ...first, is_default: 1 };
  }

  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  db.prepare(
    `INSERT INTO warehouses (
      id, code, name, location, address, phone, manager_name, notes, is_default, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
  ).run(id, 'WH0001', 'Magasin Principal', 'Fès', '', '', '', '', now, now);

  return db.prepare('SELECT * FROM warehouses WHERE id = ?').get(id) as WarehouseRow;
}

const defaultWh = ensureDefaultWarehouse();
db.prepare("UPDATE products SET warehouse_id = ?, warehouse_name = ? WHERE warehouse_id = ''").run(
  defaultWh.id,
  defaultWh.name
);

function generateNextInvoiceNumber(): string {
  const rows = db.prepare("SELECT invoice_number FROM sales_invoices WHERE invoice_number LIKE 'FAC-%'").all() as Array<{
    invoice_number: string;
  }>;
  let maxNum = 0;
  for (const row of rows) {
    const suffix = row.invoice_number.slice(4);
    if (/^\d+$/.test(suffix)) {
      const parsed = Number.parseInt(suffix, 10);
      if (parsed > maxNum) maxNum = parsed;
    }
  }
  return `FAC-${String(maxNum + 1).padStart(4, '0')}`;
}

function generateNextWarehouseCode(): string {
  const rows = db.prepare("SELECT code FROM warehouses WHERE code LIKE 'WH%'").all() as Array<{ code: string }>;
  let maxNum = 0;
  for (const row of rows) {
    const suffix = row.code.slice(2);
    if (/^\d+$/.test(suffix)) {
      const parsed = Number.parseInt(suffix, 10);
      if (parsed > maxNum) maxNum = parsed;
    }
  }
  return `WH${String(maxNum + 1).padStart(4, '0')}`;
}

function generateNextSupplierCode(): string {
  const rows = db.prepare("SELECT code FROM suppliers WHERE code LIKE 'FR%'").all() as Array<{ code: string }>;
  let maxNum = 0;
  for (const row of rows) {
    const suffix = row.code.slice(2);
    if (/^\d+$/.test(suffix)) {
      const parsed = Number.parseInt(suffix, 10);
      if (parsed > maxNum) maxNum = parsed;
    }
  }
  return `FR${String(maxNum + 1).padStart(4, '0')}`;
}

function generateNextAdjustmentRef(): string {
  const rows = db
    .prepare("SELECT reference_number FROM inventory_adjustments WHERE reference_number LIKE 'ADJ-%'")
    .all() as Array<{ reference_number: string }>;
  let maxNum = 0;
  for (const row of rows) {
    const suffix = row.reference_number.slice(4);
    if (/^\d+$/.test(suffix)) {
      const parsed = Number.parseInt(suffix, 10);
      if (parsed > maxNum) maxNum = parsed;
    }
  }
  return `ADJ-${String(maxNum + 1).padStart(4, '0')}`;
}

function mapWarehouseRow(row: WarehouseRow) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    location: row.location || '',
    address: row.address || '',
    phone: row.phone || '',
    managerName: row.manager_name || '',
    notes: row.notes || '',
    isDefault: Boolean(row.is_default),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSuppliersWithPurchases(rows: SupplierRow[]) {
  const purchaseStmt = db.prepare(
    'SELECT * FROM supplier_purchases WHERE supplier_id = ? ORDER BY purchase_date DESC, created_at DESC'
  );
  const galleryStmt = db.prepare(
    'SELECT * FROM supplier_gallery WHERE supplier_id = ? ORDER BY created_at DESC'
  );
  return rows.map((row) => {
    const purchases = (purchaseStmt.all(row.id) as SupplierPurchaseRow[]).map((p) => ({
      id: p.id,
      supplierId: p.supplier_id,
      productId: p.product_id || '',
      productCode: p.product_code,
      productName: p.product_name,
      category: p.category || '',
      warehouseId: p.warehouse_id || '',
      warehouseName: p.warehouse_name || '',
      quantity: p.quantity,
      unitCost: p.unit_cost,
      totalCost: p.total_cost,
      purchaseDate: p.purchase_date,
      paymentMethod: p.payment_method || 'cash',
      notes: p.notes || '',
      createdAt: p.created_at,
    }));
    const gallery = (galleryStmt.all(row.id) as SupplierGalleryRow[]).map((g) => ({
      id: g.id,
      supplierId: g.supplier_id,
      title: g.title || '',
      source: g.source || 'upload',
      sourceUrl: g.source_url || '',
      imageData: g.image_data,
      createdAt: g.created_at,
    }));
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      phone: row.phone || '',
      address: row.address || '',
      city: row.city || '',
      category: row.category || 'artisan',
      notes: row.notes || '',
      facebookUrl: row.facebook_url || '',
      instagramUrl: row.instagram_url || '',
      websiteUrl: row.website_url || '',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      purchases,
      gallery,
    };
  });
}

function getSupplierSummary() {
  const suppliersCount = (db.prepare('SELECT COUNT(*) as cnt FROM suppliers').get() as { cnt: number }).cnt;
  const stats = db
    .prepare(
      'SELECT COUNT(*) as totalPurchases, COALESCE(SUM(total_cost), 0) as totalSpent FROM supplier_purchases'
    )
    .get() as { totalPurchases: number; totalSpent: number };
  return {
    totalSuppliers: suppliersCount,
    totalPurchases: Number(stats.totalPurchases) || 0,
    totalSpentMad: Number(stats.totalSpent) || 0,
  };
}

function mapAdjustmentRow(row: InventoryAdjustmentRow) {
  return {
    id: row.id,
    referenceNumber: row.reference_number,
    adjustmentType: row.adjustment_type || 'deduction',
    warehouseId: row.warehouse_id || '',
    warehouseName: row.warehouse_name || '',
    targetWarehouseId: row.target_warehouse_id || '',
    targetWarehouseName: row.target_warehouse_name || '',
    productId: row.product_id,
    productCode: row.product_code || '',
    productName: row.product_name,
    category: row.category || '',
    color: row.color || '',
    supplierId: row.supplier_id || '',
    supplierName: row.supplier_name || '',
    quantityBefore: Number(row.quantity_before) || 0,
    quantityDelta: Number(row.quantity_delta) || 0,
    quantityAfter: Number(row.quantity_after) || 0,
    unitCost: Number(row.unit_cost) || 0,
    totalValue: Number(row.total_value) || 0,
    reason: row.reason || '',
    notes: row.notes || '',
    adjustmentDate: row.adjustment_date,
    createdAt: row.created_at,
  };
}

function parseInvoiceItemsJson(row: SalesInvoiceRow): SalesInvoiceItem[] {
  if (row.items_json && row.items_json.trim().startsWith('[')) {
    try {
      const parsed = JSON.parse(row.items_json) as SalesInvoiceItem[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    } catch {
      // fallback below
    }
  }
  return [
    {
      productId: row.product_id,
      productCode: row.product_code,
      productName: row.product_name,
      category: row.category || '',
      warehouseId: row.warehouse_id || '',
      warehouseName: row.warehouse_name || '',
      quantity: Number(row.quantity) || 1,
      unitPrice: Number(row.unit_price) || 0,
      totalPrice: Number(row.total_price) || 0,
      purchasePrice: Number(row.purchase_price) || 0,
    },
  ];
}

function mapSalesInvoiceRow(row: SalesInvoiceRow) {
  const items = parseInvoiceItemsJson(row);
  return {
    id: row.id,
    invoiceNumber: row.invoice_number,
    productId: row.product_id,
    productCode: row.product_code,
    productName: row.product_name,
    category: row.category || '',
    warehouseId: row.warehouse_id || '',
    warehouseName: row.warehouse_name || '',
    items,
    customerId: row.customer_id || '',
    customerName: row.customer_name || '',
    customerPhone: row.customer_phone || '',
    quantity: row.quantity,
    unitPrice: row.unit_price,
    totalPrice: row.total_price,
    purchasePrice: row.purchase_price,
    paymentMethod: row.payment_method || 'cash',
    saleDate: row.sale_date,
    notes: row.notes || '',
    printCount: Number(row.print_count) || 0,
    createdAt: row.created_at,
  };
}

function mapProductHistoryRow(row: ProductHistoryRow) {
  return {
    id: row.id,
    productId: row.product_id,
    eventType: row.event_type,
    summary: row.summary,
    details: row.details || '',
    quantityDelta: row.quantity_delta,
    quantityAfter: row.quantity_after,
    createdAt: row.created_at,
  };
}

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
      qrToken: row.qr_token || `GA-QR-${row.code}`,
      name: row.name,
      nameFr: row.name_fr || '',
      nameAr: row.name_ar || '',
      description: row.description,
      descriptionFr: row.description_fr || '',
      descriptionAr: row.description_ar || '',
      category: row.category || '',
      categoryFr: row.category_fr || '',
      categoryAr: row.category_ar || '',
      color: row.color || '',
      colorFr: row.color_fr || '',
      colorAr: row.color_ar || '',
      warehouseId: row.warehouse_id || '',
      warehouseName: row.warehouse_name || '',
      supplierId: row.supplier_id || '',
      supplier: row.supplier || '',
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

function resolveProductByQrInput(rawInput: string): ProductRow | undefined {
  let token = (rawInput || '').trim();
  if (!token) return undefined;

  try {
    if (/^https?:\/\//i.test(token)) {
      const parsed = new URL(token);
      let qrParam = parsed.searchParams.get('qr') || parsed.searchParams.get('code') || parsed.searchParams.get('product');
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
    // keep raw token
  }

  if (token.toUpperCase().startsWith('GA-QR:')) {
    token = token.slice(6).trim();
  }
  token = token.replace(/\/+$/, '');
  const strippedCode = token.toUpperCase().startsWith('GA-QR-') ? token.slice(6).trim() : token;

  const byId = db.prepare('SELECT * FROM products WHERE id = ?').get(token) as ProductRow | undefined;
  if (byId) return byId;

  const byQrToken = db
    .prepare('SELECT * FROM products WHERE qr_token = ? COLLATE NOCASE')
    .get(token) as ProductRow | undefined;
  if (byQrToken) return byQrToken;

  const byCode = db
    .prepare('SELECT * FROM products WHERE code = ? COLLATE NOCASE')
    .get(strippedCode) as ProductRow | undefined;
  if (byCode) return byCode;

  const byPhoto = db
    .prepare(
      `SELECT p.* FROM products p
       JOIN product_photos ph ON ph.product_id = p.id
       WHERE ph.photo_code = ? COLLATE NOCASE
       LIMIT 1`
    )
    .get(strippedCode) as ProductRow | undefined;
  return byPhoto;
}

function buildProductDigitalFile(row: ProductRow) {
  const product = mapProductsWithPhotos([row])[0];
  const allInvoiceRows = db
    .prepare('SELECT * FROM sales_invoices ORDER BY created_at DESC')
    .all() as SalesInvoiceRow[];
  const invoices = allInvoiceRows
    .map(mapSalesInvoiceRow)
    .filter(
      (inv) =>
        inv.productId === row.id ||
        (Array.isArray(inv.items) && inv.items.some((item) => item.productId === row.id))
    );
  const history = (
    db
      .prepare('SELECT * FROM product_history WHERE product_id = ? ORDER BY created_at DESC')
      .all(row.id) as ProductHistoryRow[]
  ).map(mapProductHistoryRow);

  let totalUnitsSold = 0;
  let totalRevenueMad = 0;
  for (const inv of invoices) {
    const matchedItems = (inv.items || []).filter((item) => item.productId === row.id);
    if (matchedItems.length > 0) {
      for (const item of matchedItems) {
        totalUnitsSold += Number(item.quantity) || 0;
        totalRevenueMad += Number(item.totalPrice) || 0;
      }
    } else if (inv.productId === row.id) {
      totalUnitsSold += Number(inv.quantity) || 0;
      totalRevenueMad += Number(inv.totalPrice) || 0;
    }
  }
  const lastSaleDate = invoices[0]?.saleDate || '';

  return {
    product,
    invoices,
    history,
    salesStats: {
      totalUnitsSold,
      totalRevenueMad,
      totalInvoices: invoices.length,
      lastSaleDate,
    },
  };
}

function getInventorySummary() {
  const allProducts = db.prepare('SELECT quantity, reference_price, expenses, selling_price FROM products').all() as Array<{
    quantity: number;
    reference_price: number;
    expenses: number;
    selling_price: number;
  }>;

  let activeReferences = 0;
  let totalUnits = 0;
  let totalSellingValue = 0;
  let totalReferenceCost = 0;

  for (const item of allProducts) {
    const qty = Math.max(0, Number(item.quantity) || 0);
    if (qty > 0) activeReferences += 1;
    totalUnits += qty;
    totalSellingValue += qty * (Number(item.selling_price) || 0);
    totalReferenceCost += qty * ((Number(item.reference_price) || 0) + (Number(item.expenses) || 0));
  }

  return {
    totalReferences: activeReferences,
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
  const galleryStmt = db.prepare(
    'SELECT * FROM customer_gallery WHERE customer_id = ? ORDER BY created_at DESC'
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
    const gallery = (galleryStmt.all(row.id) as CustomerGalleryRow[]).map((g) => ({
      id: g.id,
      customerId: g.customer_id,
      title: g.title || '',
      source: g.source || 'upload',
      sourceUrl: g.source_url || '',
      imageData: g.image_data,
      createdAt: g.created_at,
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
      facebookUrl: row.facebook_url || '',
      instagramUrl: row.instagram_url || '',
      websiteUrl: row.website_url || '',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      purchases,
      gallery,
    };
  });
}

function isPrivateIpAddress(ip: string): boolean {
  const normalized = ip.trim().toLowerCase();
  if (!normalized) return true;
  if (normalized === '::1' || normalized === '::') return true;
  if (normalized.startsWith('::ffff:')) {
    return isPrivateIpAddress(normalized.slice(7));
  }
  if (net.isIPv4(normalized)) {
    const parts = normalized.split('.').map((n) => Number.parseInt(n, 10));
    if (parts.length !== 4 || parts.some((p) => Number.isNaN(p))) return true;
    const [a, b] = parts;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a >= 224) return true;
    return false;
  }
  if (net.isIPv6(normalized)) {
    if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
    if (normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb')) {
      return true;
    }
    return false;
  }
  return true;
}

async function assertPublicHttpUrl(rawUrl: string): Promise<URL> {
  const parsed = new URL(rawUrl);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('INVALID_PROTOCOL');
  }
  const host = parsed.hostname.toLowerCase();
  if (
    !host ||
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host === 'metadata.google.internal'
  ) {
    throw new Error('FORBIDDEN_HOST');
  }
  if (net.isIP(host)) {
    if (isPrivateIpAddress(host)) throw new Error('FORBIDDEN_IP');
    return parsed;
  }
  const records = await dns.lookup(host, { all: true });
  if (!records.length || records.some((r) => isPrivateIpAddress(r.address))) {
    throw new Error('FORBIDDEN_IP');
  }
  return parsed;
}

function resolveCustomerSourceUrlServer(
  rawInput: string,
  source: 'facebook' | 'instagram' | 'website'
): string | null {
  const trimmed = (rawInput || '').trim();
  if (!trimmed || /^(javascript|data|vbscript|file):/i.test(trimmed)) return null;

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  if (source === 'instagram' && !trimmed.includes('/') && !trimmed.includes('.')) {
    const handle = trimmed.replace(/^@+/, '').replace(/\s+/g, '');
    return handle ? `https://www.instagram.com/${encodeURIComponent(handle)}/` : null;
  }
  if (source === 'facebook' && !trimmed.includes('/') && !trimmed.includes('.')) {
    const slug = trimmed.replace(/^@+/, '');
    if (!slug || slug.includes(' ')) return null;
    return `https://www.facebook.com/${encodeURIComponent(slug)}`;
  }
  return `https://${trimmed}`;
}

function isLoginWallUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return (
    /instagram\.com\/accounts\/login|facebook\.com\/login|mbasic\.facebook\.com\/login|facebook\.com\/checkpoint|instagram\.com\/challenge/.test(
      lower
    )
  );
}

async function safeFetchWithPublicRedirects(
  targetUrl: string,
  headers: Record<string, string>,
  timeoutMs = 10000,
  options?: { stopOnLoginRedirect?: boolean }
): Promise<{ response: globalThis.Response; finalUrl: string; loginWallRedirected?: boolean }> {
  let currentUrl = targetUrl;
  for (let hop = 0; hop < 4; hop += 1) {
    const validated = await assertPublicHttpUrl(currentUrl);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(validated.toString(), {
        method: 'GET',
        headers,
        redirect: 'manual',
        signal: controller.signal,
      });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) return { response, finalUrl: validated.toString() };
        const nextUrl = new URL(location, validated.toString()).toString();
        if (options?.stopOnLoginRedirect && isLoginWallUrl(nextUrl)) {
          return { response, finalUrl: targetUrl, loginWallRedirected: true };
        }
        currentUrl = nextUrl;
        continue;
      }
      if (options?.stopOnLoginRedirect && isLoginWallUrl(validated.toString())) {
        return { response, finalUrl: targetUrl, loginWallRedirected: true };
      }
      return { response, finalUrl: validated.toString() };
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error('TOO_MANY_REDIRECTS');
}

async function fetchRemoteImageAsDataUrl(
  imageUrl: string,
  referer?: string,
  minBytes = 256
): Promise<{ dataUrl: string; mimeType: string } | null> {
  try {
    const headers: Record<string, string> = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      Accept: 'image/avif,image/webp,image/apng,image/png,image/jpeg,image/*,*/*;q=0.8',
    };
    if (referer) headers.Referer = referer;
    const { response } = await safeFetchWithPublicRedirects(imageUrl, headers, 8000);
    if (!response.ok) return null;

    const rawCt = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (!rawCt.startsWith('image/')) return null;
    if (rawCt === 'image/svg+xml') return null;

    const arrayBuf = await response.arrayBuffer();
    if (arrayBuf.byteLength < minBytes || arrayBuf.byteLength > 6 * 1024 * 1024) {
      return null;
    }
    const base64 = Buffer.from(arrayBuf).toString('base64');
    return {
      dataUrl: `data:${rawCt};base64,${base64}`,
      mimeType: rawCt,
    };
  } catch {
    return null;
  }
}

function decodeHtmlEntitiesMinimal(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x2F;/gi, '/')
    .replace(/&#x3D;/gi, '=')
    .replace(/&#038;/g, '&')
    .replace(/\\u0026/gi, '&')
    .replace(/\\\//g, '/');
}

function isLikelyUiNoiseImageUrl(url: string): boolean {
  const lower = url.toLowerCase();
  if (lower.startsWith('data:')) return true;
  if (/\.svg(\?|$)/i.test(lower)) return true;
  if (
    /rsrc\.php|static\.xx\.fbcdn\.net\/rsrc|static\.cdninstagram\.com\/rsrc|favicon|1x1|pixel|spacer|blank\.gif|sprite|emoji/i.test(
      lower
    )
  ) {
    return true;
  }
  return false;
}

function extractCandidateImageUrlsFromHtml(
  html: string,
  baseUrl: string
): Array<{ imageUrl: string; title: string }> {
  const seen = new Set<string>();
  const results: Array<{ imageUrl: string; title: string }> = [];

  const pushUrl = (raw: string, title = '') => {
    const decoded = decodeHtmlEntitiesMinimal(raw).trim();
    if (!decoded || decoded.startsWith('data:')) return;
    try {
      const abs = new URL(decoded, baseUrl).toString();
      if (!/^https?:\/\//i.test(abs)) return;
      if (isLikelyUiNoiseImageUrl(abs)) return;
      if (seen.has(abs)) return;
      seen.add(abs);
      results.push({ imageUrl: abs, title: title.trim().slice(0, 120) });
    } catch {
      // ignore malformed url
    }
  };

  // 1. OpenGraph & Twitter meta images
  const metaTagRegex = /<meta\b[^>]*>/gi;
  let metaMatch: RegExpExecArray | null;
  while ((metaMatch = metaTagRegex.exec(html)) !== null) {
    const tag = metaMatch[0];
    const propMatch = tag.match(/(?:property|name)\s*=\s*["']([^"']+)["']/i);
    const contentMatch = tag.match(/content\s*=\s*["']([^"']+)["']/i);
    if (propMatch && contentMatch) {
      const prop = propMatch[1].toLowerCase();
      if (
        prop === 'og:image' ||
        prop === 'og:image:secure_url' ||
        prop === 'twitter:image' ||
        prop === 'twitter:image:src'
      ) {
        pushUrl(contentMatch[1], prop);
      }
    }
  }

  // 2. Embedded JSON photo URLs (Instagram / Facebook / Schema.org JSON-LD)
  const jsonFieldRegex =
    /"(?:display_url|profile_pic_url_hd|hd_src|image|thumbnail_src|full_picture|original_image_url)"\s*:\s*"(https?:\\?\/\\?\/[^"]+)"/gi;
  let jsonMatch: RegExpExecArray | null;
  while ((jsonMatch = jsonFieldRegex.exec(html)) !== null) {
    pushUrl(jsonMatch[1]);
  }

  // 3. <img> tags (src, data-src, data-lazy-src, srcset)
  const imgTagRegex = /<img\b[^>]*>/gi;
  let imgMatch: RegExpExecArray | null;
  while ((imgMatch = imgTagRegex.exec(html)) !== null) {
    const tag = imgMatch[0];
    const altMatch = tag.match(/alt\s*=\s*["']([^"']*)["']/i);
    const alt = altMatch ? decodeHtmlEntitiesMinimal(altMatch[1]) : '';

    const dataSrcMatch = tag.match(/(?:data-src|data-lazy-src|data-original)\s*=\s*["']([^"']+)["']/i);
    const srcMatch = tag.match(/\bsrc\s*=\s*["']([^"']+)["']/i);
    const srcsetMatch = tag.match(/\bsrcset\s*=\s*["']([^"']+)["']/i);

    if (srcsetMatch) {
      const candidates = srcsetMatch[1]
        .split(',')
        .map((part) => part.trim().split(/\s+/)[0])
        .filter(Boolean);
      if (candidates.length > 0) {
        pushUrl(candidates[candidates.length - 1], alt);
      }
    }
    if (dataSrcMatch) pushUrl(dataSrcMatch[1], alt);
    if (srcMatch) pushUrl(srcMatch[1], alt);
  }

  // 4. <picture><source srcset="...">
  const sourceTagRegex = /<source\b[^>]*srcset\s*=\s*["']([^"']+)["'][^>]*>/gi;
  let sourceMatch: RegExpExecArray | null;
  while ((sourceMatch = sourceTagRegex.exec(html)) !== null) {
    const candidates = sourceMatch[1]
      .split(',')
      .map((part) => part.trim().split(/\s+/)[0])
      .filter(Boolean);
    if (candidates.length > 0) {
      pushUrl(candidates[candidates.length - 1]);
    }
  }

  // 5. Inline CSS background-image: url(...)
  const bgRegex = /background-image\s*:\s*url\((["']?)(https?:\/\/[^)"'\s]+)\1\)/gi;
  let bgMatch: RegExpExecArray | null;
  while ((bgMatch = bgRegex.exec(html)) !== null) {
    pushUrl(bgMatch[2]);
  }

  return results.slice(0, 18);
}

function extractInstagramUsernameFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (!/instagram\.com$/i.test(parsed.hostname.replace(/^www\./, ''))) return null;
    const segments = parsed.pathname.split('/').filter(Boolean);
    if (segments.length === 0) return null;
    const first = segments[0];
    if (['p', 'reel', 'reels', 'stories', 'explore', 'accounts', 'direct'].includes(first.toLowerCase())) {
      return null;
    }
    return first.replace(/^@+/, '');
  } catch {
    return null;
  }
}

function extractFacebookSlugFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (!/(facebook|fb)\.com$/i.test(parsed.hostname.replace(/^(www|m)\./, ''))) return null;
    const segments = parsed.pathname.split('/').filter(Boolean);
    if (segments.length === 0) return null;
    const first = segments[0];
    if (['login', 'watch', 'marketplace', 'groups', 'events', 'gaming', 'photo', 'story.php'].includes(first.toLowerCase())) {
      return null;
    }
    return first;
  } catch {
    return null;
  }
}

async function tryFetchViaConnectedMetaGraph(
  targetUrl: string,
  source: 'facebook' | 'instagram' | 'website',
  fallbackTitle: string
): Promise<Array<{ imageUrl: string; title: string }>> {
  if (source !== 'instagram' && source !== 'facebook') return [];
  const row = db
    .prepare("SELECT * FROM meta_connections WHERE id = 'primary'")
    .get() as MetaConnectionRow | undefined;
  if (!row || !row.pages_json) return [];

  let pages: StoredMetaPage[] = [];
  try {
    pages = JSON.parse(row.pages_json) as StoredMetaPage[];
  } catch {
    return [];
  }
  if (!Array.isArray(pages) || pages.length === 0) return [];

  const selectedPage =
    pages.find((p) => p.id === row.selected_page_id) ||
    pages.find((p) => p.igAccount) ||
    pages[0];
  if (!selectedPage?.accessToken) return [];

  const collected: Array<{ imageUrl: string; title: string }> = [];

  if (source === 'instagram') {
    const igPage = pages.find((p) => p.igAccount?.id === row.selected_ig_id) || pages.find((p) => p.igAccount);
    const username = extractInstagramUsernameFromUrl(targetUrl);
    if (!igPage?.igAccount?.id || !igPage.accessToken || !username) return [];

    try {
      const fields = `business_discovery.username(${encodeURIComponent(
        username
      )}){username,name,profile_picture_url,media.limit(12){id,caption,media_type,media_url,thumbnail_url,permalink}}`;
      const apiUrl = `https://graph.facebook.com/v21.0/${encodeURIComponent(
        igPage.igAccount.id
      )}?fields=${fields}&access_token=${encodeURIComponent(igPage.accessToken)}`;
      const res = await fetch(apiUrl);
      if (!res.ok) return [];
      const data = (await res.json()) as {
        business_discovery?: {
          name?: string;
          username?: string;
          profile_picture_url?: string;
          media?: {
            data?: Array<{
              caption?: string;
              media_type?: string;
              media_url?: string;
              thumbnail_url?: string;
            }>;
          };
        };
      };
      const disc = data.business_discovery;
      if (!disc) return [];
      for (const m of disc.media?.data || []) {
        const imgUrl = m.media_type === 'VIDEO' ? m.thumbnail_url : m.media_url || m.thumbnail_url;
        if (imgUrl) {
          collected.push({
            imageUrl: imgUrl,
            title: (m.caption || disc.name || fallbackTitle).slice(0, 120),
          });
        }
      }
      if (disc.profile_picture_url && collected.length < 12) {
        collected.push({
          imageUrl: disc.profile_picture_url,
          title: disc.name || `@${username}`,
        });
      }
    } catch {
      return [];
    }
  } else if (source === 'facebook') {
    const slug = extractFacebookSlugFromUrl(targetUrl);
    if (!slug) return [];
    try {
      const apiUrl = `https://graph.facebook.com/v21.0/${encodeURIComponent(
        slug
      )}?fields=name,picture.type(large),posts.limit(12){full_picture,message}&access_token=${encodeURIComponent(
        selectedPage.accessToken
      )}`;
      const res = await fetch(apiUrl);
      if (!res.ok) return [];
      const data = (await res.json()) as {
        name?: string;
        picture?: { data?: { url?: string } };
        posts?: { data?: Array<{ full_picture?: string; message?: string }> };
      };
      for (const p of data.posts?.data || []) {
        if (p.full_picture) {
          collected.push({
            imageUrl: p.full_picture,
            title: (p.message || data.name || fallbackTitle).slice(0, 120),
          });
        }
      }
      if (data.picture?.data?.url && collected.length < 12) {
        collected.push({
          imageUrl: data.picture.data.url,
          title: data.name || fallbackTitle,
        });
      }
    } catch {
      return [];
    }
  }

  return collected.slice(0, 12);
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
              OR p.name_fr LIKE ? COLLATE NOCASE
              OR p.name_ar LIKE ? COLLATE NOCASE
              OR p.code LIKE ? COLLATE NOCASE
              OR p.supplier LIKE ? COLLATE NOCASE
              OR p.category LIKE ? COLLATE NOCASE
              OR p.category_fr LIKE ? COLLATE NOCASE
              OR p.category_ar LIKE ? COLLATE NOCASE
              OR p.color LIKE ? COLLATE NOCASE
              OR p.color_fr LIKE ? COLLATE NOCASE
              OR p.color_ar LIKE ? COLLATE NOCASE
              OR p.warehouse_name LIKE ? COLLATE NOCASE
              OR p.qr_token LIKE ? COLLATE NOCASE
              OR ph.photo_code LIKE ? COLLATE NOCASE
           ORDER BY p.created_at DESC`
        )
        .all(
          pattern,
          pattern,
          pattern,
          pattern,
          pattern,
          pattern,
          pattern,
          pattern,
          pattern,
          pattern,
          pattern,
          pattern,
          pattern,
          pattern
        ) as ProductRow[];
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
    const customCode =
      typeof body.code === 'string' && body.code.trim()
        ? ensureUniqueProductCode(body.code)
        : '';
    const code = customCode || generateNextProductCode(name);
    const qrToken = `GA-QR-${code}`;
    const addedDate =
      typeof body.addedDate === 'string' && body.addedDate.trim() ? body.addedDate.trim() : now.slice(0, 10);
    const category = typeof body.category === 'string' ? body.category.trim() : '';
    const color = typeof body.color === 'string' ? body.color.trim() : '';
    let supplierId = typeof body.supplierId === 'string' ? body.supplierId.trim() : '';
    let supplier = typeof body.supplier === 'string' ? body.supplier.trim() : '';
    if (supplierId) {
      const supRow = db.prepare('SELECT id, name FROM suppliers WHERE id = ?').get(supplierId) as
        | { id: string; name: string }
        | undefined;
      if (supRow) {
        if (!supplier) supplier = supRow.name;
      } else {
        supplierId = '';
      }
    }

    let warehouseId = typeof body.warehouseId === 'string' ? body.warehouseId.trim() : '';
    let warehouseName = typeof body.warehouseName === 'string' ? body.warehouseName.trim() : '';
    if (warehouseId) {
      const whRow = db.prepare('SELECT id, name FROM warehouses WHERE id = ?').get(warehouseId) as
        | { id: string; name: string }
        | undefined;
      if (whRow) {
        warehouseName = whRow.name;
      } else {
        warehouseId = '';
      }
    }
    if (!warehouseId) {
      const def = ensureDefaultWarehouse();
      warehouseId = def.id;
      if (!warehouseName) warehouseName = def.name;
    }

    const initialQty = toInt(body.quantity, 1);
    const photos = Array.isArray(body.photos) ? body.photos.filter((p) => p && typeof p.imageData === 'string' && p.imageData) : [];
    const bilingual = populateBilingualProductFields({
      name,
      nameFr: typeof body.nameFr === 'string' ? body.nameFr : '',
      nameAr: typeof body.nameAr === 'string' ? body.nameAr : '',
      description: typeof body.description === 'string' ? body.description.trim() : '',
      descriptionFr: typeof body.descriptionFr === 'string' ? body.descriptionFr : '',
      descriptionAr: typeof body.descriptionAr === 'string' ? body.descriptionAr : '',
      category,
      categoryFr: typeof body.categoryFr === 'string' ? body.categoryFr : '',
      categoryAr: typeof body.categoryAr === 'string' ? body.categoryAr : '',
      color,
      colorFr: typeof body.colorFr === 'string' ? body.colorFr : '',
      colorAr: typeof body.colorAr === 'string' ? body.colorAr : '',
      sellingPrice: toNumber(body.sellingPrice, 0),
    });

    const insertProduct = db.prepare(`
      INSERT INTO products (
        id, code, qr_token, name, name_fr, name_ar,
        description, description_fr, description_ar,
        category, category_fr, category_ar,
        color, color_fr, color_ar,
        warehouse_id, warehouse_name, supplier_id, supplier,
        length_cm, width_cm, height_cm, thickness_cm, pieces_count,
        quantity, reference_price, expenses, selling_price,
        added_date, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertPhoto = db.prepare(`
      INSERT INTO product_photos (id, product_id, photo_code, image_data, sort_order, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const transaction = db.transaction(() => {
      insertProduct.run(
        id,
        code,
        qrToken,
        bilingual.name,
        bilingual.nameFr || '',
        bilingual.nameAr || '',
        bilingual.description,
        bilingual.descriptionFr || '',
        bilingual.descriptionAr || '',
        bilingual.category || '',
        bilingual.categoryFr || '',
        bilingual.categoryAr || '',
        bilingual.color || '',
        bilingual.colorFr || '',
        bilingual.colorAr || '',
        warehouseId,
        warehouseName,
        supplierId,
        supplier,
        toNumber(body.lengthCm, 0),
        toNumber(body.widthCm, 0),
        toNumber(body.heightCm, 0),
        toNumber(body.thicknessCm, 0),
        Math.max(1, toInt(body.piecesCount, 1)),
        initialQty,
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

      const detailsParts = [
        warehouseName ? `${warehouseName}` : '',
        supplier ? `${supplier}` : '',
        color ? `${color}` : '',
      ].filter(Boolean);

      logProductHistory(
        id,
        'created',
        `Article créé (${code})`,
        detailsParts.join(' · '),
        initialQty,
        initialQty,
        now
      );
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
    const explicitCode =
      typeof body.code === 'string' && body.code.trim()
        ? sanitizeCustomProductCode(body.code)
        : '';
    const isAutoFormatCode = /^[A-Z]\d{4}$/.test(existing.code);
    const shouldRegen =
      Boolean(body.regenerateCode) ||
      (isAutoFormatCode && extractPrefixLetter(name) !== extractPrefixLetter(existing.name));
    const code =
      explicitCode && explicitCode !== existing.code
        ? ensureUniqueProductCode(explicitCode, productId)
        : shouldRegen
          ? generateNextProductCode(name, productId)
          : existing.code;
    const qrToken =
      code !== existing.code ? `GA-QR-${code}` : existing.qr_token || `GA-QR-${code}`;
    const category =
      typeof body.category === 'string' ? body.category.trim() : existing.category || '';
    const color =
      typeof body.color === 'string' ? body.color.trim() : existing.color || '';
    let supplierId =
      typeof body.supplierId === 'string' ? body.supplierId.trim() : existing.supplier_id || '';
    let supplier =
      typeof body.supplier === 'string' ? body.supplier.trim() : existing.supplier || '';
    if (supplierId) {
      const supRow = db.prepare('SELECT id, name FROM suppliers WHERE id = ?').get(supplierId) as
        | { id: string; name: string }
        | undefined;
      if (supRow) {
        if (!supplier) supplier = supRow.name;
      } else {
        supplierId = '';
      }
    }

    let warehouseId =
      typeof body.warehouseId === 'string' ? body.warehouseId.trim() : existing.warehouse_id || '';
    let warehouseName =
      typeof body.warehouseName === 'string' ? body.warehouseName.trim() : existing.warehouse_name || '';
    if (warehouseId) {
      const whRow = db.prepare('SELECT id, name FROM warehouses WHERE id = ?').get(warehouseId) as
        | { id: string; name: string }
        | undefined;
      if (whRow) {
        warehouseName = whRow.name;
      } else {
        warehouseId = '';
      }
    }
    if (!warehouseId) {
      const def = ensureDefaultWarehouse();
      warehouseId = def.id;
      if (!warehouseName) warehouseName = def.name;
    }

    const nextQty = toInt(body.quantity, 1);
    const qtyDelta = nextQty - existing.quantity;

    const addedDate =
      typeof body.addedDate === 'string' && body.addedDate.trim() ? body.addedDate.trim() : existing.added_date;

    const photos = Array.isArray(body.photos) ? body.photos.filter((p) => p && typeof p.imageData === 'string' && p.imageData) : [];
    const bilingual = populateBilingualProductFields({
      name,
      nameFr: typeof body.nameFr === 'string' ? body.nameFr : '',
      nameAr: typeof body.nameAr === 'string' ? body.nameAr : '',
      description: typeof body.description === 'string' ? body.description.trim() : '',
      descriptionFr: typeof body.descriptionFr === 'string' ? body.descriptionFr : '',
      descriptionAr: typeof body.descriptionAr === 'string' ? body.descriptionAr : '',
      category,
      categoryFr: typeof body.categoryFr === 'string' ? body.categoryFr : '',
      categoryAr: typeof body.categoryAr === 'string' ? body.categoryAr : '',
      color,
      colorFr: typeof body.colorFr === 'string' ? body.colorFr : '',
      colorAr: typeof body.colorAr === 'string' ? body.colorAr : '',
      sellingPrice: toNumber(body.sellingPrice, 0),
    });

    const updateProduct = db.prepare(`
      UPDATE products SET
        code = ?,
        qr_token = ?,
        name = ?,
        name_fr = ?,
        name_ar = ?,
        description = ?,
        description_fr = ?,
        description_ar = ?,
        category = ?,
        category_fr = ?,
        category_ar = ?,
        color = ?,
        color_fr = ?,
        color_ar = ?,
        warehouse_id = ?,
        warehouse_name = ?,
        supplier_id = ?,
        supplier = ?,
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
        qrToken,
        bilingual.name,
        bilingual.nameFr || '',
        bilingual.nameAr || '',
        bilingual.description,
        bilingual.descriptionFr || '',
        bilingual.descriptionAr || '',
        bilingual.category || '',
        bilingual.categoryFr || '',
        bilingual.categoryAr || '',
        bilingual.color || '',
        bilingual.colorFr || '',
        bilingual.colorAr || '',
        warehouseId,
        warehouseName,
        supplierId,
        supplier,
        toNumber(body.lengthCm, 0),
        toNumber(body.widthCm, 0),
        toNumber(body.heightCm, 0),
        toNumber(body.thicknessCm, 0),
        Math.max(1, toInt(body.piecesCount, 1)),
        nextQty,
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

      const eventType = qtyDelta > 0 ? 'restocked' : 'updated';
      const detailParts: string[] = [];
      if (warehouseName && warehouseName !== existing.warehouse_name) detailParts.push(warehouseName);
      if (supplier && supplier !== existing.supplier) detailParts.push(supplier);
      if (qtyDelta !== 0) detailParts.push(`${existing.quantity} → ${nextQty}`);
      logProductHistory(
        productId,
        eventType,
        qtyDelta > 0 ? `+${qtyDelta}` : code,
        detailParts.join(' · '),
        qtyDelta,
        nextQty,
        now
      );
    });

    transaction();

    const updatedRow = db.prepare('SELECT * FROM products WHERE id = ?').get(productId) as ProductRow;
    res.json({
      product: mapProductsWithPhotos([updatedRow])[0],
      summary: getInventorySummary(),
    });
  });

  app.post('/api/products/import', (req: Request, res: Response) => {
    const body = req.body as { items?: ProductInput[]; mode?: 'skip' | 'update' };
    const items = Array.isArray(body?.items) ? body.items : [];
    if (items.length === 0) {
      res.status(400).json({ error: 'No items provided' });
      return;
    }

    const mode = body?.mode === 'update' ? 'update' : 'skip';
    const now = new Date().toISOString();
    let addedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    const defWh = ensureDefaultWarehouse();

    const selectByCode = db.prepare('SELECT * FROM products WHERE UPPER(code) = UPPER(?)');
    const selectWhByName = db.prepare('SELECT * FROM warehouses WHERE UPPER(name) = UPPER(?) LIMIT 1');
    const insertProduct = db.prepare(`
      INSERT INTO products (
        id, code, qr_token, name, name_fr, name_ar,
        description, description_fr, description_ar,
        category, category_fr, category_ar,
        color, color_fr, color_ar,
        warehouse_id, warehouse_name, supplier_id, supplier,
        length_cm, width_cm, height_cm, thickness_cm, pieces_count,
        quantity, reference_price, expenses, selling_price,
        added_date, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const updateProduct = db.prepare(`
      UPDATE products SET
        name = ?,
        name_fr = ?,
        name_ar = ?,
        description = ?,
        description_fr = ?,
        description_ar = ?,
        category = ?,
        category_fr = ?,
        category_ar = ?,
        color = ?,
        color_fr = ?,
        color_ar = ?,
        warehouse_id = ?,
        warehouse_name = ?,
        supplier = ?,
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

    const tx = db.transaction(() => {
      for (const rawItem of items) {
        if (!rawItem || typeof rawItem !== 'object') continue;
        const cleanCode = sanitizeCustomProductCode(rawItem.code || '');
        const cleanName = (typeof rawItem.name === 'string' ? rawItem.name.trim() : '') || cleanCode;
        if (!cleanName) {
          skippedCount += 1;
          continue;
        }

        const existingRow = cleanCode
          ? (selectByCode.get(cleanCode) as ProductRow | undefined)
          : undefined;

        const rawWhName = typeof rawItem.warehouseName === 'string' ? rawItem.warehouseName.trim() : '';
        const matchedWh = rawWhName ? (selectWhByName.get(rawWhName) as WarehouseRow | undefined) : undefined;
        const resolvedWhId = matchedWh?.id || (typeof rawItem.warehouseId === 'string' && rawItem.warehouseId.trim() ? rawItem.warehouseId.trim() : defWh.id);
        const resolvedWhName = matchedWh?.name || rawWhName || defWh.name;

        if (existingRow) {
          if (mode === 'skip') {
            skippedCount += 1;
            continue;
          }

          const nextQty =
            typeof rawItem.quantity === 'number' && Number.isFinite(rawItem.quantity)
              ? Math.max(0, Math.floor(rawItem.quantity))
              : existingRow.quantity;
          const qtyDelta = nextQty - existingRow.quantity;
          const bilingual = populateBilingualProductFields({
            name: cleanName,
            nameFr: typeof rawItem.nameFr === 'string' ? rawItem.nameFr : '',
            nameAr: typeof rawItem.nameAr === 'string' ? rawItem.nameAr : '',
            description:
              typeof rawItem.description === 'string'
                ? rawItem.description.trim()
                : existingRow.description,
            descriptionFr: typeof rawItem.descriptionFr === 'string' ? rawItem.descriptionFr : '',
            descriptionAr: typeof rawItem.descriptionAr === 'string' ? rawItem.descriptionAr : '',
            category:
              typeof rawItem.category === 'string' ? rawItem.category.trim() : existingRow.category,
            categoryFr: typeof rawItem.categoryFr === 'string' ? rawItem.categoryFr : '',
            categoryAr: typeof rawItem.categoryAr === 'string' ? rawItem.categoryAr : '',
            color: typeof rawItem.color === 'string' ? rawItem.color.trim() : existingRow.color,
            colorFr: typeof rawItem.colorFr === 'string' ? rawItem.colorFr : '',
            colorAr: typeof rawItem.colorAr === 'string' ? rawItem.colorAr : '',
            sellingPrice:
              typeof rawItem.sellingPrice === 'number'
                ? toNumber(rawItem.sellingPrice, 0)
                : existingRow.selling_price,
          });

          updateProduct.run(
            bilingual.name,
            bilingual.nameFr || '',
            bilingual.nameAr || '',
            bilingual.description,
            bilingual.descriptionFr || '',
            bilingual.descriptionAr || '',
            bilingual.category || '',
            bilingual.categoryFr || '',
            bilingual.categoryAr || '',
            bilingual.color || '',
            bilingual.colorFr || '',
            bilingual.colorAr || '',
            resolvedWhId || existingRow.warehouse_id,
            resolvedWhName || existingRow.warehouse_name,
            typeof rawItem.supplier === 'string' ? rawItem.supplier.trim() : existingRow.supplier,
            typeof rawItem.lengthCm === 'number' ? toNumber(rawItem.lengthCm, 0) : existingRow.length_cm,
            typeof rawItem.widthCm === 'number' ? toNumber(rawItem.widthCm, 0) : existingRow.width_cm,
            typeof rawItem.heightCm === 'number' ? toNumber(rawItem.heightCm, 0) : existingRow.height_cm,
            typeof rawItem.thicknessCm === 'number'
              ? toNumber(rawItem.thicknessCm, 0)
              : existingRow.thickness_cm,
            typeof rawItem.piecesCount === 'number'
              ? Math.max(1, toInt(rawItem.piecesCount, 1))
              : existingRow.pieces_count,
            nextQty,
            typeof rawItem.referencePrice === 'number'
              ? toNumber(rawItem.referencePrice, 0)
              : existingRow.reference_price,
            typeof rawItem.expenses === 'number' ? toNumber(rawItem.expenses, 0) : existingRow.expenses,
            typeof rawItem.sellingPrice === 'number'
              ? toNumber(rawItem.sellingPrice, 0)
              : existingRow.selling_price,
            typeof rawItem.addedDate === 'string' && rawItem.addedDate.trim()
              ? rawItem.addedDate.trim()
              : existingRow.added_date,
            now,
            existingRow.id
          );

          logProductHistory(
            existingRow.id,
            qtyDelta > 0 ? 'restocked' : 'updated',
            `Excel (${existingRow.code})`,
            qtyDelta !== 0 ? `${existingRow.quantity} → ${nextQty}` : '',
            qtyDelta,
            nextQty,
            now
          );
          updatedCount += 1;
          continue;
        }

        const id = crypto.randomUUID();
        const finalCode = cleanCode || generateNextProductCode(cleanName);
        const qrToken = `GA-QR-${finalCode}`;
        const initialQty = Math.max(0, toInt(rawItem.quantity, 1));
        const supplier = typeof rawItem.supplier === 'string' ? rawItem.supplier.trim() : '';
        const category = typeof rawItem.category === 'string' ? rawItem.category.trim() : '';
        const color = typeof rawItem.color === 'string' ? rawItem.color.trim() : '';
        const bilingual = populateBilingualProductFields({
          name: cleanName,
          nameFr: typeof rawItem.nameFr === 'string' ? rawItem.nameFr : '',
          nameAr: typeof rawItem.nameAr === 'string' ? rawItem.nameAr : '',
          description: typeof rawItem.description === 'string' ? rawItem.description.trim() : '',
          descriptionFr: typeof rawItem.descriptionFr === 'string' ? rawItem.descriptionFr : '',
          descriptionAr: typeof rawItem.descriptionAr === 'string' ? rawItem.descriptionAr : '',
          category,
          categoryFr: typeof rawItem.categoryFr === 'string' ? rawItem.categoryFr : '',
          categoryAr: typeof rawItem.categoryAr === 'string' ? rawItem.categoryAr : '',
          color,
          colorFr: typeof rawItem.colorFr === 'string' ? rawItem.colorFr : '',
          colorAr: typeof rawItem.colorAr === 'string' ? rawItem.colorAr : '',
          sellingPrice: toNumber(rawItem.sellingPrice, 0),
        });
        const addedDate =
          typeof rawItem.addedDate === 'string' && rawItem.addedDate.trim()
            ? rawItem.addedDate.trim()
            : now.slice(0, 10);

        insertProduct.run(
          id,
          finalCode,
          qrToken,
          bilingual.name,
          bilingual.nameFr || '',
          bilingual.nameAr || '',
          bilingual.description,
          bilingual.descriptionFr || '',
          bilingual.descriptionAr || '',
          bilingual.category || '',
          bilingual.categoryFr || '',
          bilingual.categoryAr || '',
          bilingual.color || '',
          bilingual.colorFr || '',
          bilingual.colorAr || '',
          resolvedWhId,
          resolvedWhName,
          '',
          supplier,
          toNumber(rawItem.lengthCm, 0),
          toNumber(rawItem.widthCm, 0),
          toNumber(rawItem.heightCm, 0),
          toNumber(rawItem.thicknessCm, 0),
          Math.max(1, toInt(rawItem.piecesCount, 1)),
          initialQty,
          toNumber(rawItem.referencePrice, 0),
          toNumber(rawItem.expenses, 0),
          toNumber(rawItem.sellingPrice, 0),
          addedDate,
          now,
          now
        );

        logProductHistory(
          id,
          'created',
          `Excel (${finalCode})`,
          supplier || resolvedWhName || '',
          initialQty,
          initialQty,
          now
        );
        addedCount += 1;
      }
    });

    tx();

    const rows = db.prepare('SELECT * FROM products ORDER BY created_at DESC').all() as ProductRow[];
    res.status(201).json({
      addedCount,
      updatedCount,
      skippedCount,
      products: mapProductsWithPhotos(rows),
      summary: getInventorySummary(),
    });
  });

  app.get('/api/products/by-qr', (req: Request, res: Response) => {
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    const logScan = req.query.logScan === '1';
    const row = resolveProductByQrInput(code);
    if (!row) {
      res.status(404).json({ error: 'Product not found for QR code' });
      return;
    }
    if (logScan) {
      logProductHistory(
        row.id,
        'qr_scanned',
        `QR (${row.code})`,
        '',
        0,
        row.quantity
      );
    }
    res.json(buildProductDigitalFile(row));
  });

  app.get('/api/products/:id/digital-file', (req: Request, res: Response) => {
    const row = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id) as ProductRow | undefined;
    if (!row) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }
    if (req.query.logScan === '1') {
      logProductHistory(
        row.id,
        'qr_scanned',
        `QR (${row.code})`,
        '',
        0,
        row.quantity
      );
    }
    res.json(buildProductDigitalFile(row));
  });

  app.get('/api/pos/sales', (_req: Request, res: Response) => {
    const rows = db.prepare('SELECT * FROM sales_invoices ORDER BY created_at DESC').all() as SalesInvoiceRow[];
    const invoices = rows.map(mapSalesInvoiceRow);
    const totalRevenueMad = invoices.reduce((sum, inv) => sum + (Number(inv.totalPrice) || 0), 0);
    const totalCostMad = invoices.reduce((sum, inv) => {
      if (Array.isArray(inv.items) && inv.items.length > 0) {
        return (
          sum +
          inv.items.reduce(
            (s, item) => s + (Number(item.purchasePrice) || 0) * (Number(item.quantity) || 1),
            0
          )
        );
      }
      return sum + (Number(inv.purchasePrice) || 0) * (Number(inv.quantity) || 1);
    }, 0);
    const totalUnitsSold = invoices.reduce((sum, inv) => sum + (Number(inv.quantity) || 0), 0);
    res.json({
      invoices,
      summary: {
        totalInvoices: invoices.length,
        totalUnitsSold,
        totalRevenueMad,
        totalProfitMad: totalRevenueMad - totalCostMad,
      },
    });
  });

  app.post('/api/pos/sales', (req: Request, res: Response) => {
    const body = req.body as {
      productId?: string;
      qrCode?: string;
      quantity?: number;
      unitPrice?: number;
      items?: Array<{ productId?: string; quantity?: number; unitPrice?: number }>;
      customerId?: string;
      customerName?: string;
      customerPhone?: string;
      paymentMethod?: string;
      saleDate?: string;
      notes?: string;
      source?: string;
    };

    const rawLineItems =
      Array.isArray(body?.items) && body.items.length > 0
        ? body.items
        : body?.productId || body?.qrCode
          ? [{ productId: body.productId, qrCode: body.qrCode, quantity: body.quantity, unitPrice: body.unitPrice }]
          : [];

    if (rawLineItems.length === 0) {
      res.status(400).json({ error: 'At least one product item is required' });
      return;
    }

    const resolvedItems: Array<{
      productRow: ProductRow;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
      purchasePrice: number;
    }> = [];

    const accumulatedQtyByProduct = new Map<string, number>();

    for (const rawItem of rawLineItems) {
      const targetRow =
        typeof rawItem?.productId === 'string' && rawItem.productId.trim()
          ? (db.prepare('SELECT * FROM products WHERE id = ?').get(rawItem.productId.trim()) as ProductRow | undefined)
          : typeof (rawItem as { qrCode?: string })?.qrCode === 'string'
            ? resolveProductByQrInput((rawItem as { qrCode?: string }).qrCode!.trim())
            : undefined;

      if (!targetRow) {
        res.status(404).json({ error: 'Product not found' });
        return;
      }

      const saleQty = Math.max(1, toInt(rawItem.quantity, 1));
      const runningNeeded = (accumulatedQtyByProduct.get(targetRow.id) || 0) + saleQty;
      if (targetRow.quantity < runningNeeded) {
        res.status(409).json({
          error: 'OUT_OF_STOCK',
          productCode: targetRow.code,
          availableQuantity: targetRow.quantity,
        });
        return;
      }
      accumulatedQtyByProduct.set(targetRow.id, runningNeeded);

      const unitPrice =
        typeof rawItem.unitPrice === 'number' && Number.isFinite(rawItem.unitPrice) && rawItem.unitPrice >= 0
          ? rawItem.unitPrice
          : targetRow.selling_price;
      const totalPrice = Math.round(saleQty * unitPrice * 100) / 100;
      const purchasePrice = (Number(targetRow.reference_price) || 0) + (Number(targetRow.expenses) || 0);

      resolvedItems.push({
        productRow: targetRow,
        quantity: saleQty,
        unitPrice,
        totalPrice,
        purchasePrice,
      });
    }

    const now = new Date().toISOString();
    const saleDate =
      typeof body.saleDate === 'string' && body.saleDate.trim() ? body.saleDate.trim() : now.slice(0, 10);
    const validPayments = new Set(['cash', 'transfer', 'check', 'card', 'other']);
    const paymentMethod =
      typeof body.paymentMethod === 'string' && validPayments.has(body.paymentMethod)
        ? body.paymentMethod
        : 'cash';

    let customerId = typeof body.customerId === 'string' ? body.customerId.trim() : '';
    let customerName = typeof body.customerName === 'string' ? body.customerName.trim() : '';
    let customerPhone = typeof body.customerPhone === 'string' ? body.customerPhone.trim() : '';

    if (customerId) {
      const cust = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId) as CustomerRow | undefined;
      if (cust) {
        if (!customerName) customerName = cust.name;
        if (!customerPhone) customerPhone = cust.phone;
      } else {
        customerId = '';
      }
    }

    const invoiceId = crypto.randomUUID();
    const invoiceNumber = generateNextInvoiceNumber();
    const notes = typeof body.notes === 'string' ? body.notes.trim() : '';

    const invoiceItems: SalesInvoiceItem[] = resolvedItems.map((entry) => ({
      productId: entry.productRow.id,
      productCode: entry.productRow.code,
      productName: entry.productRow.name,
      category: entry.productRow.category || '',
      color: entry.productRow.color || '',
      warehouseId: entry.productRow.warehouse_id || '',
      warehouseName: entry.productRow.warehouse_name || '',
      supplier: entry.productRow.supplier || '',
      quantity: entry.quantity,
      unitPrice: entry.unitPrice,
      totalPrice: entry.totalPrice,
      purchasePrice: entry.purchasePrice,
    }));

    const totalQuantity = invoiceItems.reduce((sum, i) => sum + i.quantity, 0);
    const grandTotalPrice = Math.round(invoiceItems.reduce((sum, i) => sum + i.totalPrice, 0) * 100) / 100;
    const avgUnitPrice = totalQuantity > 0 ? Math.round((grandTotalPrice / totalQuantity) * 100) / 100 : 0;
    const totalPurchaseCost = invoiceItems.reduce((sum, i) => sum + i.purchasePrice * i.quantity, 0);
    const avgPurchaseCost = totalQuantity > 0 ? Math.round((totalPurchaseCost / totalQuantity) * 100) / 100 : 0;
    const primaryItem = resolvedItems[0].productRow;
    const summaryCode =
      invoiceItems.length === 1
        ? primaryItem.code
        : invoiceItems.map((i) => i.productCode).join(', ');
    const summaryName =
      invoiceItems.length === 1
        ? primaryItem.name
        : `${primaryItem.name} (+${invoiceItems.length - 1})`;

    const tx = db.transaction(() => {
      for (const entry of resolvedItems) {
        const fresh = db
          .prepare('SELECT quantity FROM products WHERE id = ?')
          .get(entry.productRow.id) as { quantity: number };
        const nextQty = Math.max(0, fresh.quantity - entry.quantity);
        db.prepare('UPDATE products SET quantity = ?, updated_at = ? WHERE id = ?').run(
          nextQty,
          now,
          entry.productRow.id
        );

        if (customerId) {
          db.prepare(
            `INSERT INTO customer_purchases (
              id, customer_id, product_id, product_code, product_name,
              quantity, unit_price, total_price, purchase_date, payment_method, notes, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).run(
            crypto.randomUUID(),
            customerId,
            entry.productRow.id,
            entry.productRow.code,
            entry.productRow.name,
            entry.quantity,
            entry.unitPrice,
            entry.totalPrice,
            saleDate,
            paymentMethod,
            notes ? `${invoiceNumber} · ${notes}` : invoiceNumber,
            now
          );
        }

        logProductHistory(
          entry.productRow.id,
          'sold',
          `${invoiceNumber} (-${entry.quantity})`,
          customerName ? `${customerName} · ${entry.totalPrice} MAD` : `${entry.totalPrice} MAD`,
          -entry.quantity,
          nextQty,
          now
        );

        logProductHistory(
          entry.productRow.id,
          'invoice_created',
          `${invoiceNumber}`,
          `${entry.totalPrice} MAD · ${paymentMethod}`,
          0,
          nextQty,
          now
        );
      }

      if (customerId) {
        db.prepare('UPDATE customers SET updated_at = ? WHERE id = ?').run(now, customerId);
      }

      db.prepare(
        `INSERT INTO sales_invoices (
          id, invoice_number, product_id, product_code, product_name,
          category, warehouse_id, warehouse_name, items_json,
          customer_id, customer_name, customer_phone,
          quantity, unit_price, total_price, purchase_price,
          payment_method, sale_date, notes, print_count, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`
      ).run(
        invoiceId,
        invoiceNumber,
        primaryItem.id,
        summaryCode,
        summaryName,
        primaryItem.category || '',
        primaryItem.warehouse_id || '',
        primaryItem.warehouse_name || '',
        JSON.stringify(invoiceItems),
        customerId,
        customerName,
        customerPhone,
        totalQuantity,
        avgUnitPrice,
        grandTotalPrice,
        avgPurchaseCost,
        paymentMethod,
        saleDate,
        notes,
        now
      );
    });

    tx();

    const updatedRow = db.prepare('SELECT * FROM products WHERE id = ?').get(primaryItem.id) as ProductRow;
    const invoiceRow = db
      .prepare('SELECT * FROM sales_invoices WHERE id = ?')
      .get(invoiceId) as SalesInvoiceRow;

    res.status(201).json({
      invoice: mapSalesInvoiceRow(invoiceRow),
      digitalFile: buildProductDigitalFile(updatedRow),
      summary: getInventorySummary(),
    });
  });

  app.post('/api/pos/sales/:invoiceId/print', (req: Request, res: Response) => {
    const invoice = db
      .prepare('SELECT * FROM sales_invoices WHERE id = ?')
      .get(req.params.invoiceId) as SalesInvoiceRow | undefined;
    if (!invoice) {
      res.status(404).json({ error: 'Invoice not found' });
      return;
    }
    const nextCount = (Number(invoice.print_count) || 0) + 1;
    db.prepare('UPDATE sales_invoices SET print_count = ? WHERE id = ?').run(nextCount, invoice.id);
    const updated = db.prepare('SELECT * FROM sales_invoices WHERE id = ?').get(invoice.id) as SalesInvoiceRow;
    res.json({ invoice: mapSalesInvoiceRow(updated) });
  });

  app.delete('/api/pos/sales/:invoiceId', (req: Request, res: Response) => {
    const invoice = db
      .prepare('SELECT * FROM sales_invoices WHERE id = ?')
      .get(req.params.invoiceId) as SalesInvoiceRow | undefined;
    if (!invoice) {
      res.status(404).json({ error: 'Invoice not found' });
      return;
    }

    const lineItems = parseInvoiceItemsJson(invoice);
    const now = new Date().toISOString();
    const tx = db.transaction(() => {
      db.prepare('DELETE FROM sales_invoices WHERE id = ?').run(invoice.id);
      for (const item of lineItems) {
        const product = db
          .prepare('SELECT * FROM products WHERE id = ?')
          .get(item.productId) as ProductRow | undefined;
        if (product) {
          const qtyToRestore = Number(item.quantity) || 1;
          const restoredQty = product.quantity + qtyToRestore;
          db.prepare('UPDATE products SET quantity = ?, updated_at = ? WHERE id = ?').run(
            restoredQty,
            now,
            product.id
          );
          logProductHistory(
            product.id,
            'restocked',
            `${invoice.invoice_number} (+${qtyToRestore})`,
            `+${qtyToRestore}`,
            qtyToRestore,
            restoredQty,
            now
          );
        }
      }
    });

    tx();
    res.json({ ok: true, summary: getInventorySummary() });
  });

  app.delete('/api/products/:id', (req: Request, res: Response) => {
    const result = db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
    if (result.changes === 0) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }
    res.json({ ok: true, summary: getInventorySummary() });
  });

  const parseSavedPrinters = (rawJson: string | undefined) => {
    if (!rawJson) return [];
    try {
      const parsed = JSON.parse(rawJson);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter((item) => item && typeof item === 'object' && typeof item.id === 'string' && typeof item.name === 'string')
        .map((item) => ({
          id: String(item.id).slice(0, 64),
          name: String(item.name).trim().slice(0, 80),
          mode: ['pdf_system', 'thermal_bt', 'browser'].includes(item.mode) ? item.mode : 'pdf_system',
          paper: ['a4', 'label_50x30', 'label_40x30', 'roll_58', 'roll_80'].includes(item.paper)
            ? item.paper
            : 'a4',
          isBluetooth: Boolean(item.isBluetooth),
        }));
    } catch {
      return [];
    }
  };

  const buildSettingsPayload = () => {
    const rows = db.prepare('SELECT key, value FROM shop_settings').all() as Array<{ key: string; value: string }>;
    const map = new Map(rows.map((r) => [r.key, r.value]));
    return {
      customLogo: map.get('custom_logo') ?? '',
      storeName: map.get('store_name') ?? '',
      currency: map.get('currency') || 'MAD',
      facebookHandle: map.get('facebook_handle') ?? '',
      instagramHandle: map.get('instagram_handle') ?? '',
      whatsappPhone: map.get('whatsapp_phone') ?? '',
      printerMode: map.get('printer_mode') || 'pdf_system',
      printerPaper: map.get('printer_paper') || 'a4',
      printerName: map.get('printer_name') ?? '',
      printerLinked: map.get('printer_linked') === '1',
      savedPrinters: parseSavedPrinters(map.get('saved_printers_json')),
      activePrinterId: map.get('active_printer_id') ?? '',
      publicAppUrl: map.get('public_app_url') ?? '',
    };
  };

  app.get('/api/settings', (_req: Request, res: Response) => {
    res.json(buildSettingsPayload());
  });

  app.put('/api/settings', (req: Request, res: Response) => {
    const body = req.body as {
      customLogo?: string;
      storeName?: string;
      currency?: string;
      facebookHandle?: string;
      instagramHandle?: string;
      whatsappPhone?: string;
      printerMode?: string;
      printerPaper?: string;
      printerName?: string;
      printerLinked?: boolean;
      savedPrinters?: Array<{
        id?: string;
        name?: string;
        mode?: string;
        paper?: string;
        isBluetooth?: boolean;
      }>;
      activePrinterId?: string;
      publicAppUrl?: string;
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
    if (typeof body.whatsappPhone === 'string') {
      db.prepare("INSERT OR REPLACE INTO shop_settings (key, value) VALUES ('whatsapp_phone', ?)").run(
        body.whatsappPhone.trim().slice(0, 40)
      );
    }
    if (typeof body.printerMode === 'string' && ['pdf_system', 'thermal_bt', 'browser'].includes(body.printerMode)) {
      db.prepare("INSERT OR REPLACE INTO shop_settings (key, value) VALUES ('printer_mode', ?)").run(
        body.printerMode
      );
    }
    if (
      typeof body.printerPaper === 'string' &&
      ['a4', 'label_50x30', 'label_40x30', 'roll_58', 'roll_80'].includes(body.printerPaper)
    ) {
      db.prepare("INSERT OR REPLACE INTO shop_settings (key, value) VALUES ('printer_paper', ?)").run(
        body.printerPaper
      );
    }
    if (typeof body.printerName === 'string') {
      db.prepare("INSERT OR REPLACE INTO shop_settings (key, value) VALUES ('printer_name', ?)").run(
        body.printerName.trim().slice(0, 80)
      );
    }
    if (typeof body.printerLinked === 'boolean') {
      db.prepare("INSERT OR REPLACE INTO shop_settings (key, value) VALUES ('printer_linked', ?)").run(
        body.printerLinked ? '1' : '0'
      );
    }
    if (Array.isArray(body.savedPrinters)) {
      const sanitized = body.savedPrinters
        .filter((p) => p && typeof p.id === 'string' && typeof p.name === 'string' && p.name.trim())
        .map((p) => ({
          id: String(p.id).slice(0, 64),
          name: String(p.name).trim().slice(0, 80),
          mode: ['pdf_system', 'thermal_bt', 'browser'].includes(String(p.mode)) ? p.mode : 'pdf_system',
          paper: ['a4', 'label_50x30', 'label_40x30', 'roll_58', 'roll_80'].includes(String(p.paper))
            ? p.paper
            : 'a4',
          isBluetooth: Boolean(p.isBluetooth),
        }));
      db.prepare("INSERT OR REPLACE INTO shop_settings (key, value) VALUES ('saved_printers_json', ?)").run(
        JSON.stringify(sanitized)
      );
    }
    if (typeof body.activePrinterId === 'string') {
      db.prepare("INSERT OR REPLACE INTO shop_settings (key, value) VALUES ('active_printer_id', ?)").run(
        body.activePrinterId.trim().slice(0, 64)
      );
    }
    if (typeof body.publicAppUrl === 'string') {
      db.prepare("INSERT OR REPLACE INTO shop_settings (key, value) VALUES ('public_app_url', ?)").run(
        body.publicAppUrl.trim().replace(/\/+$/, '').slice(0, 240)
      );
    }
    res.json(buildSettingsPayload());
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
    const products = mapProductsWithPhotos(rows).map((item) => localizeProduct(item, lang));
    const summary = getInventorySummary();

    const headers =
      lang === 'ar'
        ? [
            'الرمز',
            'رمز QR',
            'اسم المنتج',
            'الفئة',
            'اللون',
            'المستودع / المتجر',
            'المورد',
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
            'Code QR',
            'Nom',
            'Catégorie',
            'Couleur',
            'Entrepôt',
            'Fournisseur',
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
        item.qrToken || `GA-QR-${item.code}`,
        item.name,
        item.category || '',
        item.color || '',
        item.warehouseName || '',
        item.supplier || '',
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
      '',
      lang === 'ar' ? `${summary.totalReferences} أصناف` : `${summary.totalReferences} références`,
      '',
      '',
      '',
      '',
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
      { wch: 16 },
      { wch: 30 },
      { wch: 18 },
      { wch: 16 },
      { wch: 22 },
      { wch: 22 },
      { wch: 40 },
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
               OR c.facebook_url LIKE ? COLLATE NOCASE
               OR c.instagram_url LIKE ? COLLATE NOCASE
               OR c.website_url LIKE ? COLLATE NOCASE
               OR cp.product_name LIKE ? COLLATE NOCASE
               OR cp.product_code LIKE ? COLLATE NOCASE
             )
           ORDER BY c.created_at DESC`
        )
        .all(
          category,
          pattern,
          pattern,
          pattern,
          pattern,
          pattern,
          pattern,
          pattern,
          pattern,
          pattern,
          pattern
        ) as CustomerRow[];
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
              OR c.facebook_url LIKE ? COLLATE NOCASE
              OR c.instagram_url LIKE ? COLLATE NOCASE
              OR c.website_url LIKE ? COLLATE NOCASE
              OR cp.product_name LIKE ? COLLATE NOCASE
              OR cp.product_code LIKE ? COLLATE NOCASE
           ORDER BY c.created_at DESC`
        )
        .all(
          pattern,
          pattern,
          pattern,
          pattern,
          pattern,
          pattern,
          pattern,
          pattern,
          pattern,
          pattern
        ) as CustomerRow[];
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
      facebookUrl?: string;
      instagramUrl?: string;
      websiteUrl?: string;
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
        id, code, name, phone, address, city, category, notes, facebook_url, instagram_url, website_url, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      code,
      name,
      typeof body.phone === 'string' ? body.phone.trim() : '',
      typeof body.address === 'string' ? body.address.trim() : '',
      typeof body.city === 'string' ? body.city.trim() : '',
      category,
      typeof body.notes === 'string' ? body.notes.trim() : '',
      typeof body.facebookUrl === 'string' ? body.facebookUrl.trim().slice(0, 240) : '',
      typeof body.instagramUrl === 'string' ? body.instagramUrl.trim().slice(0, 240) : '',
      typeof body.websiteUrl === 'string' ? body.websiteUrl.trim().slice(0, 240) : '',
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
      facebookUrl?: string;
      instagramUrl?: string;
      websiteUrl?: string;
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
        name = ?, phone = ?, address = ?, city = ?, category = ?, notes = ?, facebook_url = ?, instagram_url = ?, website_url = ?, updated_at = ?
       WHERE id = ?`
    ).run(
      name,
      typeof body.phone === 'string' ? body.phone.trim() : '',
      typeof body.address === 'string' ? body.address.trim() : '',
      typeof body.city === 'string' ? body.city.trim() : '',
      category,
      typeof body.notes === 'string' ? body.notes.trim() : '',
      typeof body.facebookUrl === 'string' ? body.facebookUrl.trim().slice(0, 240) : '',
      typeof body.instagramUrl === 'string' ? body.instagramUrl.trim().slice(0, 240) : '',
      typeof body.websiteUrl === 'string' ? body.websiteUrl.trim().slice(0, 240) : '',
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

  app.post('/api/customers/:id/gallery', async (req: Request, res: Response) => {
    const body = req.body as {
      items?: Array<{
        title?: string;
        source?: string;
        sourceUrl?: string;
        imageData?: string;
        imageUrl?: string;
      }>;
      title?: string;
      source?: string;
      sourceUrl?: string;
      imageData?: string;
      imageUrl?: string;
      customerSnapshot?: {
        code?: string;
        name?: string;
        phone?: string;
        address?: string;
        city?: string;
        category?: string;
        notes?: string;
        facebookUrl?: string;
        instagramUrl?: string;
        websiteUrl?: string;
      };
    };

    let customer = db
      .prepare('SELECT * FROM customers WHERE id = ?')
      .get(req.params.id) as CustomerRow | undefined;
    if (!customer && typeof body?.customerSnapshot?.name === 'string' && body.customerSnapshot.name.trim()) {
      const snap = body.customerSnapshot;
      const snapName = snap.name!.trim();
      const nowSnap = new Date().toISOString();
      const validCategories = new Set(['seller', 'hobbyist', 'regular', 'other']);
      const snapCategory =
        typeof snap.category === 'string' && validCategories.has(snap.category)
          ? snap.category
          : 'regular';
      const snapCode =
        typeof snap.code === 'string' && snap.code.trim()
          ? snap.code.trim()
          : generateNextCustomerCode();
      db.prepare(
        `INSERT OR IGNORE INTO customers (
          id, code, name, phone, address, city, category, notes, facebook_url, instagram_url, website_url, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        req.params.id,
        snapCode,
        snapName,
        (snap.phone || '').trim(),
        (snap.address || '').trim(),
        (snap.city || '').trim(),
        snapCategory,
        (snap.notes || '').trim(),
        (snap.facebookUrl || '').trim().slice(0, 240),
        (snap.instagramUrl || '').trim().slice(0, 240),
        (snap.websiteUrl || '').trim().slice(0, 240),
        nowSnap,
        nowSnap
      );
      customer = db
        .prepare('SELECT * FROM customers WHERE id = ?')
        .get(req.params.id) as CustomerRow | undefined;
    }
    if (!customer) {
      res.status(404).json({ error: 'Customer not found' });
      return;
    }

    const rawItems = Array.isArray(body?.items)
      ? body.items
      : body?.imageData || body?.imageUrl
        ? [body]
        : [];

    if (rawItems.length === 0) {
      res.status(400).json({ error: 'No images provided' });
      return;
    }

    const validSources = new Set(['facebook', 'instagram', 'website', 'upload']);
    const insertStmt = db.prepare(
      `INSERT INTO customer_gallery (id, customer_id, title, source, source_url, image_data, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );

    let addedCount = 0;
    const now = new Date().toISOString();

    for (const item of rawItems.slice(0, 20)) {
      const source =
        typeof item.source === 'string' && validSources.has(item.source) ? item.source : 'upload';
      const title = typeof item.title === 'string' ? item.title.trim().slice(0, 140) : '';
      const sourceUrl = typeof item.sourceUrl === 'string' ? item.sourceUrl.trim().slice(0, 500) : '';

      let finalImageData = '';
      if (
        typeof item.imageData === 'string' &&
        (item.imageData.startsWith('data:image/') || item.imageData.startsWith('data:video/')) &&
        item.imageData.length <=
          (item.imageData.startsWith('data:video/') ? 85 * 1024 * 1024 : 8 * 1024 * 1024)
      ) {
        finalImageData = item.imageData;
      } else if (typeof item.imageUrl === 'string' && item.imageUrl.trim()) {
        const downloaded = await fetchRemoteImageAsDataUrl(item.imageUrl.trim(), sourceUrl || undefined, 64);
        if (downloaded) {
          finalImageData = downloaded.dataUrl;
        }
      }

      if (!finalImageData) continue;

      insertStmt.run(
        crypto.randomUUID(),
        customer.id,
        title || customer.name,
        source,
        sourceUrl || (typeof item.imageUrl === 'string' ? item.imageUrl.trim().slice(0, 500) : ''),
        finalImageData,
        now
      );
      addedCount += 1;
    }

    if (addedCount === 0) {
      res.status(400).json({ error: 'No valid images could be saved' });
      return;
    }

    db.prepare('UPDATE customers SET updated_at = ? WHERE id = ?').run(now, customer.id);
    const updated = db
      .prepare('SELECT * FROM customers WHERE id = ?')
      .get(customer.id) as CustomerRow;
    res.status(201).json({
      customer: mapCustomersWithPurchases([updated])[0],
      addedCount,
      summary: getCustomerSummary(),
    });
  });

  app.delete('/api/customers/:id/gallery/:imageId', (req: Request, res: Response) => {
    const result = db
      .prepare('DELETE FROM customer_gallery WHERE id = ? AND customer_id = ?')
      .run(req.params.imageId, req.params.id);
    if (result.changes === 0) {
      res.status(404).json({ error: 'Gallery image not found' });
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
    const startDate = typeof req.query.startDate === 'string' ? req.query.startDate.trim() : '';
    const endDate = typeof req.query.endDate === 'string' ? req.query.endDate.trim() : '';

    const settingsRow = db.prepare("SELECT value FROM shop_settings WHERE key = 'currency'").get() as
      | { value: string }
      | undefined;
    const currency = settingsRow?.value || 'MAD';
    const rates = await getActiveRatesFromMad();

    const rows = customerId
      ? (db.prepare('SELECT * FROM customers WHERE id = ?').all(customerId) as CustomerRow[])
      : (db.prepare('SELECT * FROM customers ORDER BY code ASC').all() as CustomerRow[]);

    const customers = mapCustomersWithPurchases(rows).map((cust) => ({
      ...cust,
      purchases: cust.purchases.filter((p) => {
        if (startDate && p.purchaseDate < startDate) return false;
        if (endDate && p.purchaseDate > endDate) return false;
        return true;
      }),
    }));

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
            'فيسبوك',
            'إنستغرام',
            'الموقع الإلكتروني',
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
            'Facebook',
            'Instagram',
            'Site web',
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
        cust.facebookUrl || '',
        cust.instagramUrl || '',
        cust.websiteUrl || '',
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
      { wch: 24 },
      { wch: 22 },
      { wch: 26 },
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

  // Warehouse Routes
  app.get('/api/warehouses', (_req: Request, res: Response) => {
    ensureDefaultWarehouse();
    const rows = db
      .prepare('SELECT * FROM warehouses ORDER BY is_default DESC, created_at ASC')
      .all() as WarehouseRow[];
    res.json({ warehouses: rows.map(mapWarehouseRow) });
  });

  app.post('/api/warehouses', (req: Request, res: Response) => {
    const body = req.body as {
      name?: string;
      location?: string;
      address?: string;
      phone?: string;
      managerName?: string;
      notes?: string;
      isDefault?: boolean;
    };
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    if (!name) {
      res.status(400).json({ error: 'Warehouse name is required' });
      return;
    }

    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const code = generateNextWarehouseCode();
    const isDefault = Boolean(body.isDefault) ? 1 : 0;

    const tx = db.transaction(() => {
      if (isDefault) {
        db.prepare('UPDATE warehouses SET is_default = 0').run();
      }
      db.prepare(
        `INSERT INTO warehouses (
          id, code, name, location, address, phone, manager_name, notes, is_default, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        id,
        code,
        name,
        typeof body.location === 'string' ? body.location.trim() : '',
        typeof body.address === 'string' ? body.address.trim() : '',
        typeof body.phone === 'string' ? body.phone.trim() : '',
        typeof body.managerName === 'string' ? body.managerName.trim() : '',
        typeof body.notes === 'string' ? body.notes.trim() : '',
        isDefault,
        now,
        now
      );
    });
    tx();

    const row = db.prepare('SELECT * FROM warehouses WHERE id = ?').get(id) as WarehouseRow;
    res.status(201).json({ warehouse: mapWarehouseRow(row) });
  });

  app.put('/api/warehouses/:id', (req: Request, res: Response) => {
    const existing = db
      .prepare('SELECT * FROM warehouses WHERE id = ?')
      .get(req.params.id) as WarehouseRow | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Warehouse not found' });
      return;
    }

    const body = req.body as {
      name?: string;
      location?: string;
      address?: string;
      phone?: string;
      managerName?: string;
      notes?: string;
      isDefault?: boolean;
    };
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    if (!name) {
      res.status(400).json({ error: 'Warehouse name is required' });
      return;
    }

    const now = new Date().toISOString();
    const isDefault = body.isDefault !== undefined ? (body.isDefault ? 1 : 0) : existing.is_default;

    const tx = db.transaction(() => {
      if (isDefault) {
        db.prepare('UPDATE warehouses SET is_default = 0').run();
      }
      db.prepare(
        `UPDATE warehouses SET
          name = ?, location = ?, address = ?, phone = ?, manager_name = ?, notes = ?, is_default = ?, updated_at = ?
         WHERE id = ?`
      ).run(
        name,
        typeof body.location === 'string' ? body.location.trim() : '',
        typeof body.address === 'string' ? body.address.trim() : '',
        typeof body.phone === 'string' ? body.phone.trim() : '',
        typeof body.managerName === 'string' ? body.managerName.trim() : '',
        typeof body.notes === 'string' ? body.notes.trim() : '',
        isDefault,
        now,
        req.params.id
      );
      db.prepare('UPDATE products SET warehouse_name = ? WHERE warehouse_id = ?').run(name, req.params.id);
    });
    tx();

    const updated = db.prepare('SELECT * FROM warehouses WHERE id = ?').get(req.params.id) as WarehouseRow;
    res.json({ warehouse: mapWarehouseRow(updated) });
  });

  app.delete('/api/warehouses/:id', (req: Request, res: Response) => {
    const existing = db
      .prepare('SELECT * FROM warehouses WHERE id = ?')
      .get(req.params.id) as WarehouseRow | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Warehouse not found' });
      return;
    }
    const tx = db.transaction(() => {
      db.prepare('DELETE FROM warehouses WHERE id = ?').run(req.params.id);
      const def = ensureDefaultWarehouse();
      db.prepare('UPDATE products SET warehouse_id = ?, warehouse_name = ? WHERE warehouse_id = ?').run(
        def.id,
        def.name,
        req.params.id
      );
    });
    tx();
    res.json({ ok: true });
  });

  // Supplier Management Routes
  app.get('/api/suppliers', (req: Request, res: Response) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const category = typeof req.query.category === 'string' ? req.query.category.trim() : '';

    let rows: SupplierRow[];
    if (q && category && category !== 'all') {
      const pattern = `%${q}%`;
      rows = db
        .prepare(
          `SELECT DISTINCT s.* FROM suppliers s
           LEFT JOIN supplier_purchases sp ON sp.supplier_id = s.id
           WHERE s.category = ?
             AND (
               s.name LIKE ? COLLATE NOCASE
               OR s.code LIKE ? COLLATE NOCASE
               OR s.phone LIKE ? COLLATE NOCASE
               OR s.city LIKE ? COLLATE NOCASE
               OR s.address LIKE ? COLLATE NOCASE
               OR sp.product_name LIKE ? COLLATE NOCASE
               OR sp.product_code LIKE ? COLLATE NOCASE
             )
           ORDER BY s.created_at DESC`
        )
        .all(category, pattern, pattern, pattern, pattern, pattern, pattern, pattern) as SupplierRow[];
    } else if (q) {
      const pattern = `%${q}%`;
      rows = db
        .prepare(
          `SELECT DISTINCT s.* FROM suppliers s
           LEFT JOIN supplier_purchases sp ON sp.supplier_id = s.id
           WHERE s.name LIKE ? COLLATE NOCASE
              OR s.code LIKE ? COLLATE NOCASE
              OR s.phone LIKE ? COLLATE NOCASE
              OR s.city LIKE ? COLLATE NOCASE
              OR s.address LIKE ? COLLATE NOCASE
              OR sp.product_name LIKE ? COLLATE NOCASE
              OR sp.product_code LIKE ? COLLATE NOCASE
           ORDER BY s.created_at DESC`
        )
        .all(pattern, pattern, pattern, pattern, pattern, pattern, pattern) as SupplierRow[];
    } else if (category && category !== 'all') {
      rows = db
        .prepare('SELECT * FROM suppliers WHERE category = ? ORDER BY created_at DESC')
        .all(category) as SupplierRow[];
    } else {
      rows = db.prepare('SELECT * FROM suppliers ORDER BY created_at DESC').all() as SupplierRow[];
    }

    res.json({
      suppliers: mapSuppliersWithPurchases(rows),
      summary: getSupplierSummary(),
    });
  });

  app.post('/api/suppliers', (req: Request, res: Response) => {
    const body = req.body as {
      name?: string;
      phone?: string;
      address?: string;
      city?: string;
      category?: string;
      notes?: string;
      facebookUrl?: string;
      instagramUrl?: string;
      websiteUrl?: string;
    };
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    if (!name) {
      res.status(400).json({ error: 'Supplier name is required' });
      return;
    }

    const validCategories = new Set(['artisan', 'wholesaler', 'collector', 'other']);
    const category =
      typeof body.category === 'string' && validCategories.has(body.category) ? body.category : 'artisan';
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const code = generateNextSupplierCode();

    db.prepare(
      `INSERT INTO suppliers (
        id, code, name, phone, address, city, category, notes, facebook_url, instagram_url, website_url, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      code,
      name,
      typeof body.phone === 'string' ? body.phone.trim() : '',
      typeof body.address === 'string' ? body.address.trim() : '',
      typeof body.city === 'string' ? body.city.trim() : '',
      category,
      typeof body.notes === 'string' ? body.notes.trim() : '',
      typeof body.facebookUrl === 'string' ? body.facebookUrl.trim().slice(0, 240) : '',
      typeof body.instagramUrl === 'string' ? body.instagramUrl.trim().slice(0, 240) : '',
      typeof body.websiteUrl === 'string' ? body.websiteUrl.trim().slice(0, 240) : '',
      now,
      now
    );

    const row = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(id) as SupplierRow;
    res.status(201).json({
      supplier: mapSuppliersWithPurchases([row])[0],
      summary: getSupplierSummary(),
    });
  });

  app.put('/api/suppliers/:id', (req: Request, res: Response) => {
    const existing = db
      .prepare('SELECT * FROM suppliers WHERE id = ?')
      .get(req.params.id) as SupplierRow | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Supplier not found' });
      return;
    }

    const body = req.body as {
      name?: string;
      phone?: string;
      address?: string;
      city?: string;
      category?: string;
      notes?: string;
      facebookUrl?: string;
      instagramUrl?: string;
      websiteUrl?: string;
    };
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    if (!name) {
      res.status(400).json({ error: 'Supplier name is required' });
      return;
    }

    const validCategories = new Set(['artisan', 'wholesaler', 'collector', 'other']);
    const category =
      typeof body.category === 'string' && validCategories.has(body.category)
        ? body.category
        : existing.category;
    const now = new Date().toISOString();

    const tx = db.transaction(() => {
      db.prepare(
        `UPDATE suppliers SET
          name = ?, phone = ?, address = ?, city = ?, category = ?, notes = ?, facebook_url = ?, instagram_url = ?, website_url = ?, updated_at = ?
         WHERE id = ?`
      ).run(
        name,
        typeof body.phone === 'string' ? body.phone.trim() : '',
        typeof body.address === 'string' ? body.address.trim() : '',
        typeof body.city === 'string' ? body.city.trim() : '',
        category,
        typeof body.notes === 'string' ? body.notes.trim() : '',
        typeof body.facebookUrl === 'string' ? body.facebookUrl.trim().slice(0, 240) : '',
        typeof body.instagramUrl === 'string' ? body.instagramUrl.trim().slice(0, 240) : '',
        typeof body.websiteUrl === 'string' ? body.websiteUrl.trim().slice(0, 240) : '',
        now,
        req.params.id
      );
      db.prepare('UPDATE products SET supplier = ? WHERE supplier_id = ?').run(name, req.params.id);
    });
    tx();

    const updated = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(req.params.id) as SupplierRow;
    res.json({
      supplier: mapSuppliersWithPurchases([updated])[0],
      summary: getSupplierSummary(),
    });
  });

  app.delete('/api/suppliers/:id', (req: Request, res: Response) => {
    const result = db.prepare('DELETE FROM suppliers WHERE id = ?').run(req.params.id);
    if (result.changes === 0) {
      res.status(404).json({ error: 'Supplier not found' });
      return;
    }
    res.json({ ok: true, summary: getSupplierSummary() });
  });

  app.post('/api/suppliers/:id/purchases', (req: Request, res: Response) => {
    const supplier = db
      .prepare('SELECT * FROM suppliers WHERE id = ?')
      .get(req.params.id) as SupplierRow | undefined;
    if (!supplier) {
      res.status(404).json({ error: 'Supplier not found' });
      return;
    }

    const body = req.body as {
      productId?: string;
      productCode?: string;
      productName?: string;
      category?: string;
      warehouseId?: string;
      warehouseName?: string;
      quantity?: number;
      unitCost?: number;
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
    const unitCost = toNumber(body.unitCost, 0);
    const totalCost = Math.round(qty * unitCost * 100) / 100;
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
      `INSERT INTO supplier_purchases (
        id, supplier_id, product_id, product_code, product_name,
        category, warehouse_id, warehouse_name,
        quantity, unit_cost, total_cost, purchase_date, payment_method, notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      supplier.id,
      typeof body.productId === 'string' ? body.productId.trim() : '',
      typeof body.productCode === 'string' ? body.productCode.trim() : '',
      productName,
      typeof body.category === 'string' ? body.category.trim() : '',
      typeof body.warehouseId === 'string' ? body.warehouseId.trim() : '',
      typeof body.warehouseName === 'string' ? body.warehouseName.trim() : '',
      qty,
      unitCost,
      totalCost,
      purchaseDate,
      paymentMethod,
      typeof body.notes === 'string' ? body.notes.trim() : '',
      now
    );

    db.prepare('UPDATE suppliers SET updated_at = ? WHERE id = ?').run(now, supplier.id);
    const updated = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(supplier.id) as SupplierRow;
    res.status(201).json({
      supplier: mapSuppliersWithPurchases([updated])[0],
      summary: getSupplierSummary(),
    });
  });

  app.put('/api/suppliers/:id/purchases/:purchaseId', (req: Request, res: Response) => {
    const existing = db
      .prepare('SELECT * FROM supplier_purchases WHERE id = ? AND supplier_id = ?')
      .get(req.params.purchaseId, req.params.id) as SupplierPurchaseRow | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Purchase record not found' });
      return;
    }

    const body = req.body as {
      productId?: string;
      productCode?: string;
      productName?: string;
      category?: string;
      warehouseId?: string;
      warehouseName?: string;
      quantity?: number;
      unitCost?: number;
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
    const unitCost = toNumber(body.unitCost, 0);
    const totalCost = Math.round(qty * unitCost * 100) / 100;
    const purchaseDate =
      typeof body.purchaseDate === 'string' && body.purchaseDate.trim()
        ? body.purchaseDate.trim()
        : existing.purchase_date;
    const validPayments = new Set(['cash', 'transfer', 'check', 'card', 'other']);
    const paymentMethod =
      typeof body.paymentMethod === 'string' && validPayments.has(body.paymentMethod)
        ? body.paymentMethod
        : existing.payment_method;
    const now = new Date().toISOString();

    db.prepare(
      `UPDATE supplier_purchases SET
        product_id = ?, product_code = ?, product_name = ?,
        category = ?, warehouse_id = ?, warehouse_name = ?,
        quantity = ?, unit_cost = ?, total_cost = ?,
        purchase_date = ?, payment_method = ?, notes = ?
       WHERE id = ? AND supplier_id = ?`
    ).run(
      typeof body.productId === 'string' ? body.productId.trim() : '',
      typeof body.productCode === 'string' ? body.productCode.trim() : '',
      productName,
      typeof body.category === 'string' ? body.category.trim() : existing.category,
      typeof body.warehouseId === 'string' ? body.warehouseId.trim() : existing.warehouse_id,
      typeof body.warehouseName === 'string' ? body.warehouseName.trim() : existing.warehouse_name,
      qty,
      unitCost,
      totalCost,
      purchaseDate,
      paymentMethod,
      typeof body.notes === 'string' ? body.notes.trim() : '',
      req.params.purchaseId,
      req.params.id
    );

    db.prepare('UPDATE suppliers SET updated_at = ? WHERE id = ?').run(now, req.params.id);
    const updated = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(req.params.id) as SupplierRow;
    res.json({
      supplier: mapSuppliersWithPurchases([updated])[0],
      summary: getSupplierSummary(),
    });
  });

  app.delete('/api/suppliers/:id/purchases/:purchaseId', (req: Request, res: Response) => {
    const result = db
      .prepare('DELETE FROM supplier_purchases WHERE id = ? AND supplier_id = ?')
      .run(req.params.purchaseId, req.params.id);
    if (result.changes === 0) {
      res.status(404).json({ error: 'Purchase record not found' });
      return;
    }
    const updated = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(req.params.id) as SupplierRow;
    res.json({
      supplier: mapSuppliersWithPurchases([updated])[0],
      summary: getSupplierSummary(),
    });
  });

  app.post('/api/suppliers/:id/gallery', async (req: Request, res: Response) => {
    const body = req.body as {
      items?: Array<{
        title?: string;
        source?: string;
        sourceUrl?: string;
        imageData?: string;
        imageUrl?: string;
      }>;
      title?: string;
      source?: string;
      sourceUrl?: string;
      imageData?: string;
      imageUrl?: string;
    };

    const supplier = db
      .prepare('SELECT * FROM suppliers WHERE id = ?')
      .get(req.params.id) as SupplierRow | undefined;
    if (!supplier) {
      res.status(404).json({ error: 'Supplier not found' });
      return;
    }

    const rawItems = Array.isArray(body?.items)
      ? body.items
      : body?.imageData || body?.imageUrl
        ? [body]
        : [];
    if (rawItems.length === 0) {
      res.status(400).json({ error: 'No media provided' });
      return;
    }

    const validSources = new Set(['facebook', 'instagram', 'website', 'upload']);
    const insertStmt = db.prepare(
      `INSERT INTO supplier_gallery (id, supplier_id, title, source, source_url, image_data, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );

    let addedCount = 0;
    const now = new Date().toISOString();

    for (const item of rawItems.slice(0, 20)) {
      const source =
        typeof item.source === 'string' && validSources.has(item.source) ? item.source : 'upload';
      const title = typeof item.title === 'string' ? item.title.trim().slice(0, 140) : '';
      const sourceUrl = typeof item.sourceUrl === 'string' ? item.sourceUrl.trim().slice(0, 500) : '';

      let finalImageData = '';
      if (
        typeof item.imageData === 'string' &&
        (item.imageData.startsWith('data:image/') || item.imageData.startsWith('data:video/')) &&
        item.imageData.length <=
          (item.imageData.startsWith('data:video/') ? 85 * 1024 * 1024 : 8 * 1024 * 1024)
      ) {
        finalImageData = item.imageData;
      } else if (typeof item.imageUrl === 'string' && item.imageUrl.trim()) {
        const downloaded = await fetchRemoteImageAsDataUrl(item.imageUrl.trim(), sourceUrl || undefined, 64);
        if (downloaded) finalImageData = downloaded.dataUrl;
      }
      if (!finalImageData) continue;

      insertStmt.run(
        crypto.randomUUID(),
        supplier.id,
        title || supplier.name,
        source,
        sourceUrl || (typeof item.imageUrl === 'string' ? item.imageUrl.trim().slice(0, 500) : ''),
        finalImageData,
        now
      );
      addedCount += 1;
    }

    if (addedCount === 0) {
      res.status(400).json({ error: 'No valid media could be saved' });
      return;
    }

    db.prepare('UPDATE suppliers SET updated_at = ? WHERE id = ?').run(now, supplier.id);
    const updated = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(supplier.id) as SupplierRow;
    res.status(201).json({
      supplier: mapSuppliersWithPurchases([updated])[0],
      addedCount,
      summary: getSupplierSummary(),
    });
  });

  app.delete('/api/suppliers/:id/gallery/:imageId', (req: Request, res: Response) => {
    const result = db
      .prepare('DELETE FROM supplier_gallery WHERE id = ? AND supplier_id = ?')
      .run(req.params.imageId, req.params.id);
    if (result.changes === 0) {
      res.status(404).json({ error: 'Gallery item not found' });
      return;
    }
    const updated = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(req.params.id) as SupplierRow;
    res.json({
      supplier: mapSuppliersWithPurchases([updated])[0],
      summary: getSupplierSummary(),
    });
  });

  // Inventory Deductions & Adjustments Routes
  app.get('/api/adjustments', (_req: Request, res: Response) => {
    const rows = db
      .prepare('SELECT * FROM inventory_adjustments ORDER BY adjustment_date DESC, created_at DESC')
      .all() as InventoryAdjustmentRow[];
    res.json({ adjustments: rows.map(mapAdjustmentRow) });
  });

  app.post('/api/adjustments', (req: Request, res: Response) => {
    const body = req.body as {
      adjustmentType?: string;
      warehouseId?: string;
      targetWarehouseId?: string;
      productId?: string;
      quantityDelta?: number;
      supplierId?: string;
      reason?: string;
      notes?: string;
      adjustmentDate?: string;
    };

    const productId = typeof body?.productId === 'string' ? body.productId.trim() : '';
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(productId) as ProductRow | undefined;
    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    const validTypes = new Set(['deduction', 'restock', 'damage', 'loss', 'transfer', 'correction']);
    const adjustmentType =
      typeof body.adjustmentType === 'string' && validTypes.has(body.adjustmentType)
        ? body.adjustmentType
        : 'deduction';

    const rawDelta = Math.trunc(Number(body.quantityDelta) || 0);
    if (rawDelta === 0) {
      res.status(400).json({ error: 'Non-zero quantity delta is required' });
      return;
    }

    let signedDelta = rawDelta;
    if (adjustmentType === 'deduction' || adjustmentType === 'damage' || adjustmentType === 'loss') {
      signedDelta = -Math.abs(rawDelta);
    } else if (adjustmentType === 'restock') {
      signedDelta = Math.abs(rawDelta);
    }

    const qtyBefore = Number(product.quantity) || 0;
    const qtyAfter =
      adjustmentType === 'transfer' ? qtyBefore : Math.max(0, qtyBefore + signedDelta);
    const effectiveDelta = adjustmentType === 'transfer' ? 0 : qtyAfter - qtyBefore;

    let warehouseId = typeof body.warehouseId === 'string' && body.warehouseId.trim() ? body.warehouseId.trim() : product.warehouse_id;
    let warehouseName = product.warehouse_name || '';
    if (warehouseId) {
      const wh = db.prepare('SELECT id, name FROM warehouses WHERE id = ?').get(warehouseId) as
        | { id: string; name: string }
        | undefined;
      if (wh) warehouseName = wh.name;
    }

    let targetWarehouseId = typeof body.targetWarehouseId === 'string' ? body.targetWarehouseId.trim() : '';
    let targetWarehouseName = '';
    if (adjustmentType === 'transfer' && targetWarehouseId) {
      const twh = db.prepare('SELECT id, name FROM warehouses WHERE id = ?').get(targetWarehouseId) as
        | { id: string; name: string }
        | undefined;
      if (twh) {
        targetWarehouseName = twh.name;
      } else {
        targetWarehouseId = '';
      }
    }

    let supplierId = typeof body.supplierId === 'string' && body.supplierId.trim() ? body.supplierId.trim() : product.supplier_id || '';
    let supplierName = product.supplier || '';
    if (supplierId) {
      const sup = db.prepare('SELECT id, name FROM suppliers WHERE id = ?').get(supplierId) as
        | { id: string; name: string }
        | undefined;
      if (sup) supplierName = sup.name;
    }

    const unitCost = (Number(product.reference_price) || 0) + (Number(product.expenses) || 0);
    const totalValue = Math.round(Math.abs(rawDelta) * unitCost * 100) / 100;
    const now = new Date().toISOString();
    const adjustmentDate =
      typeof body.adjustmentDate === 'string' && body.adjustmentDate.trim()
        ? body.adjustmentDate.trim()
        : now.slice(0, 10);
    const id = crypto.randomUUID();
    const refNumber = generateNextAdjustmentRef();
    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
    const notes = typeof body.notes === 'string' ? body.notes.trim() : '';

    const tx = db.transaction(() => {
      db.prepare(
        `INSERT INTO inventory_adjustments (
          id, reference_number, adjustment_type,
          warehouse_id, warehouse_name, target_warehouse_id, target_warehouse_name,
          product_id, product_code, product_name, category, color,
          supplier_id, supplier_name,
          quantity_before, quantity_delta, quantity_after, unit_cost, total_value,
          reason, notes, adjustment_date, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        id,
        refNumber,
        adjustmentType,
        warehouseId,
        warehouseName,
        targetWarehouseId,
        targetWarehouseName,
        product.id,
        product.code,
        product.name,
        product.category || '',
        product.color || '',
        supplierId,
        supplierName,
        qtyBefore,
        adjustmentType === 'transfer' ? Math.abs(rawDelta) : effectiveDelta,
        qtyAfter,
        unitCost,
        totalValue,
        reason,
        notes,
        adjustmentDate,
        now
      );

      if (adjustmentType === 'transfer' && targetWarehouseId && targetWarehouseName) {
        db.prepare(
          'UPDATE products SET warehouse_id = ?, warehouse_name = ?, updated_at = ? WHERE id = ?'
        ).run(targetWarehouseId, targetWarehouseName, now, product.id);
        logProductHistory(
          product.id,
          'transferred',
          `${refNumber} (${targetWarehouseName})`,
          `${warehouseName} → ${targetWarehouseName}${reason ? ` · ${reason}` : ''}`,
          0,
          qtyAfter,
          now
        );
      } else {
        db.prepare('UPDATE products SET quantity = ?, updated_at = ? WHERE id = ?').run(
          qtyAfter,
          now,
          product.id
        );
        logProductHistory(
          product.id,
          'adjusted',
          `${refNumber} (${effectiveDelta >= 0 ? `+${effectiveDelta}` : effectiveDelta})`,
          `${reason || adjustmentType}${warehouseName ? ` · ${warehouseName}` : ''}`,
          effectiveDelta,
          qtyAfter,
          now
        );
      }
    });

    tx();

    const created = db
      .prepare('SELECT * FROM inventory_adjustments WHERE id = ?')
      .get(id) as InventoryAdjustmentRow;
    res.status(201).json({
      adjustment: mapAdjustmentRow(created),
      summary: getInventorySummary(),
    });
  });

  app.delete('/api/adjustments/:id', (req: Request, res: Response) => {
    const existing = db
      .prepare('SELECT * FROM inventory_adjustments WHERE id = ?')
      .get(req.params.id) as InventoryAdjustmentRow | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Adjustment not found' });
      return;
    }
    db.prepare('DELETE FROM inventory_adjustments WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const appRoot = process.env.APP_ROOT?.trim()
      ? path.resolve(process.env.APP_ROOT.trim())
      : process.cwd();
    // Serve generated/seeded local images in production builds
    app.use('/src/assets/images', express.static(path.join(appRoot, 'src', 'assets', 'images')));
    const distPath = path.join(appRoot, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const port = Number(process.env.PORT) || 3000;
  const host = process.env.HOST?.trim() || '0.0.0.0';
  app.listen(port, host, () => {
    console.log(`Gestion Antiquités server listening on ${host}:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
