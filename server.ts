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
`);

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
      currency: map.get('currency') || 'MAD',
    });
  });

  app.put('/api/settings', (req: Request, res: Response) => {
    const body = req.body as { customLogo?: string; currency?: string };
    if (typeof body.customLogo === 'string') {
      db.prepare("INSERT OR REPLACE INTO shop_settings (key, value) VALUES ('custom_logo', ?)").run(body.customLogo);
    }
    if (typeof body.currency === 'string' && body.currency.trim()) {
      db.prepare("INSERT OR REPLACE INTO shop_settings (key, value) VALUES ('currency', ?)").run(
        body.currency.trim().slice(0, 8)
      );
    }
    const rows = db.prepare('SELECT key, value FROM shop_settings').all() as Array<{ key: string; value: string }>;
    const map = new Map(rows.map((r) => [r.key, r.value]));
    res.json({
      customLogo: map.get('custom_logo') ?? '',
      currency: map.get('currency') || 'MAD',
    });
  });

  app.get('/api/export/excel', (req: Request, res: Response) => {
    const lang = req.query.lang === 'ar' ? 'ar' : 'fr';
    const settingsRow = db.prepare("SELECT value FROM shop_settings WHERE key = 'currency'").get() as
      | { value: string }
      | undefined;
    const currency = settingsRow?.value || 'MAD';

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
        item.referencePrice,
        item.expenses,
        item.sellingPrice,
        item.sellingPrice * item.quantity,
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
      summary.totalReferenceCost,
      '',
      '',
      summary.totalSellingValue,
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
