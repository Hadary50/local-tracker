import type { AppData, Brand, Movement, MovementType, Product, Settings } from '../types';

/* ------------------------------------------------------------------ */
/* Basics                                                              */
/* ------------------------------------------------------------------ */

export type Result<E = {}> = ({ ok: true; data: AppData } & E) | { ok: false; error: string };

export const MOVEMENT_LABELS: Record<MovementType, string> = {
  received: 'استلام',
  sold: 'مبيع',
  missing: 'مفقود',
  returned: 'مرتجع',
};

// +1 adds to stock, -1 removes from stock
export const MOVEMENT_SIGN: Record<MovementType, 1 | -1> = {
  received: 1,
  sold: -1,
  missing: -1,
  returned: 1,
};

export const MOVEMENT_TYPES: MovementType[] = ['received', 'sold', 'missing', 'returned'];

export const DEFAULT_SETTINGS: Settings = {
  shopName: 'متجري',
  userName: 'المستخدم',
  lowStockThreshold: 2,
};

export const emptyData = (): AppData => ({
  brands: [],
  products: [],
  movements: [],
  settings: { ...DEFAULT_SETTINGS },
});

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export function todayStr(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

const validDate = (s: string | undefined) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : todayStr());

/** Normalises text for comparing / searching (Arabic-friendly). */
export function norm(s: unknown): string {
  return String(s ?? '')
    .normalize('NFKC')
    .replace(/[ً-ٰٟـ]/g, '') // tashkeel + tatweel
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** Every word typed must appear somewhere in the haystack. */
export function matchesQuery(haystack: string, query: string): boolean {
  const tokens = norm(query).split(' ').filter(Boolean);
  if (tokens.length === 0) return true;
  const h = norm(haystack);
  return tokens.every((t) => h.includes(t));
}

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

export function parseQty(v: unknown): number | null {
  let s = String(v ?? '').trim();
  if (!s) return null;
  s = s
    .replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String(FA_DIGITS.indexOf(d)))
    .replace(/٫/g, '.')
    .replace(/[,٬\s]/g, '');
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  return Number(s);
}

/* ------------------------------------------------------------------ */
/* Brands                                                              */
/* ------------------------------------------------------------------ */

export function addBrand(data: AppData, name: string): Result<{ brand: Brand }> {
  const n = name.trim();
  if (!n) return { ok: false, error: 'اكتب اسم العلامة التجارية' };
  if (data.brands.some((b) => norm(b.name) === norm(n))) {
    return { ok: false, error: 'هذه العلامة موجودة بالفعل' };
  }
  const brand: Brand = { id: uid(), name: n };
  return { ok: true, data: { ...data, brands: [...data.brands, brand] }, brand };
}

export function renameBrand(data: AppData, id: string, name: string): Result {
  const n = name.trim();
  if (!n) return { ok: false, error: 'اكتب اسم العلامة التجارية' };
  if (data.brands.some((b) => b.id !== id && norm(b.name) === norm(n))) {
    return { ok: false, error: 'هذه العلامة موجودة بالفعل' };
  }
  return { ok: true, data: { ...data, brands: data.brands.map((b) => (b.id === id ? { ...b, name: n } : b)) } };
}

export function deleteBrand(data: AppData, id: string, cascade = false): Result {
  if (!cascade && data.products.some((p) => p.brandId === id)) {
    return { ok: false, error: 'لا يمكن حذف علامة لها منتجات بدون تأكيد الحذف الشامل' };
  }
  return {
    ok: true,
    data: {
      ...data,
      brands: data.brands.filter((b) => b.id !== id),
      products: cascade ? data.products.filter((p) => p.brandId !== id) : data.products,
    },
  };
}

/* ------------------------------------------------------------------ */
/* Products                                                            */
/* ------------------------------------------------------------------ */

export interface ProductFields {
  name: string;
  size: string;
  color: string;
  sku: string;
  image?: string;
}

function findDuplicate(data: AppData, brandId: string, f: ProductFields, excludeId?: string): Product | undefined {
  return data.products.find(
    (p) =>
      p.id !== excludeId &&
      p.brandId === brandId &&
      ((f.sku.trim() && p.sku && norm(p.sku) === norm(f.sku)) ||
        (norm(p.name) === norm(f.name) && norm(p.size) === norm(f.size) && norm(p.color) === norm(f.color))),
  );
}

export function addProduct(
  data: AppData,
  input: ProductFields & { brandId: string },
  openingQty: number,
  date: string,
  user: string,
): Result<{ product: Product }> {
  if (!data.brands.some((b) => b.id === input.brandId)) return { ok: false, error: 'اختر العلامة التجارية' };
  if (!input.name.trim()) return { ok: false, error: 'اكتب اسم المنتج' };
  if (!Number.isInteger(openingQty) || openingQty < 0) return { ok: false, error: 'الكمية يجب أن تكون عدداً صحيحاً (صفر أو أكثر)' };
  const fields: ProductFields = {
    name: input.name.trim(),
    size: input.size.trim(),
    color: input.color.trim(),
    sku: input.sku.trim(),
    image: (input.image ?? '').trim(),
  };
  if (findDuplicate(data, input.brandId, fields)) {
    return { ok: false, error: 'هذا المنتج (بنفس المقاس واللون) موجود بالفعل لهذه العلامة' };
  }
  const product: Product = { id: uid(), brandId: input.brandId, ...fields, qty: 0 };
  let next: AppData = { ...data, products: [...data.products, product] };
  if (openingQty > 0) {
    const r = applyMovement(next, {
      type: 'received',
      productId: product.id,
      qty: openingQty,
      date,
      user,
      notes: 'رصيد افتتاحي',
    });
    if (!r.ok) return r;
    next = r.data;
  }
  return { ok: true, data: next, product };
}

export function updateProduct(data: AppData, id: string, f: ProductFields): Result {
  const p = data.products.find((x) => x.id === id);
  if (!p) return { ok: false, error: 'المنتج غير موجود' };
  if (!f.name.trim()) return { ok: false, error: 'اكتب اسم المنتج' };
  const fields: ProductFields = {
    name: f.name.trim(),
    size: f.size.trim(),
    color: f.color.trim(),
    sku: f.sku.trim(),
    image: (f.image ?? '').trim(),
  };
  if (findDuplicate(data, p.brandId, fields, id)) {
    return { ok: false, error: 'يوجد منتج آخر بنفس الاسم والمقاس واللون' };
  }
  return { ok: true, data: { ...data, products: data.products.map((x) => (x.id === id ? { ...x, ...fields } : x)) } };
}

export function deleteProduct(data: AppData, id: string): Result {
  return { ok: true, data: { ...data, products: data.products.filter((p) => p.id !== id) } };
}

/* ------------------------------------------------------------------ */
/* Movements                                                           */
/* ------------------------------------------------------------------ */

export interface MovementInput {
  type: MovementType;
  productId: string;
  qty: number;
  date: string;
  user: string;
  notes?: string;
}

/** Records a movement AND updates the product quantity in one step. */
export function applyMovement(data: AppData, input: MovementInput): Result<{ movement: Movement }> {
  const product = data.products.find((p) => p.id === input.productId);
  if (!product) return { ok: false, error: 'اختر المنتج أولاً' };
  if (!Number.isInteger(input.qty) || input.qty <= 0) {
    return { ok: false, error: 'الكمية يجب أن تكون رقماً صحيحاً أكبر من صفر' };
  }
  const newQty = product.qty + MOVEMENT_SIGN[input.type] * input.qty;
  if (newQty < 0) {
    return { ok: false, error: `الكمية أكبر من الرصيد الحالي (${product.qty})` };
  }
  const brand = data.brands.find((b) => b.id === product.brandId);
  const movement: Movement = {
    id: uid(),
    createdAt: Date.now(),
    type: input.type,
    productId: product.id,
    brandId: product.brandId,
    productName: product.name,
    brandName: brand?.name ?? '',
    size: product.size,
    color: product.color,
    qty: input.qty,
    date: validDate(input.date),
    user: input.user.trim() || data.settings.userName,
    notes: (input.notes ?? '').trim(),
  };
  return {
    ok: true,
    data: {
      ...data,
      products: data.products.map((p) => (p.id === product.id ? { ...p, qty: newQty } : p)),
      movements: [...data.movements, movement],
    },
    movement,
  };
}

/** Current names for display (falls back to the snapshot if the product/brand was deleted). */
export function describeMovement(data: AppData, m: Movement) {
  const p = data.products.find((x) => x.id === m.productId);
  const b = data.brands.find((x) => x.id === m.brandId);
  return {
    brandName: b?.name ?? m.brandName,
    productName: p?.name ?? m.productName,
    size: p?.size ?? m.size,
    color: p?.color ?? m.color,
  };
}

export interface MovementFilter {
  type?: MovementType | '';
  brandId?: string;
  from?: string;
  to?: string;
  q?: string;
}

export function filterMovements(data: AppData, f: MovementFilter): Movement[] {
  return data.movements
    .filter((m) => {
      if (f.type && m.type !== f.type) return false;
      if (f.brandId && m.brandId !== f.brandId) return false;
      if (f.from && m.date < f.from) return false;
      if (f.to && m.date > f.to) return false;
      if (f.q) {
        const d = describeMovement(data, m);
        if (!matchesQuery(`${d.brandName} ${d.productName} ${d.size} ${d.color} ${m.notes} ${m.user}`, f.q)) return false;
      }
      return true;
    })
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
}

/* ------------------------------------------------------------------ */
/* Stats                                                               */
/* ------------------------------------------------------------------ */

export function totals(data: AppData) {
  const sum = (t: MovementType) => data.movements.filter((m) => m.type === t).reduce((s, m) => s + m.qty, 0);
  return {
    stock: data.products.reduce((s, p) => s + p.qty, 0),
    sold: sum('sold'),
    missing: sum('missing'),
    returned: sum('returned'),
    received: sum('received'),
  };
}

export interface BrandStat {
  brand: Brand;
  products: number;
  stock: number;
  sold: number;
  missing: number;
  returned: number;
}

export function brandStats(data: AppData): BrandStat[] {
  const map = new Map<string, BrandStat>();
  for (const b of data.brands) {
    map.set(b.id, { brand: b, products: 0, stock: 0, sold: 0, missing: 0, returned: 0 });
  }
  for (const p of data.products) {
    const s = map.get(p.brandId);
    if (s) {
      s.products += 1;
      s.stock += p.qty;
    }
  }
  for (const m of data.movements) {
    const s = map.get(m.brandId);
    if (!s) continue;
    if (m.type === 'sold') s.sold += m.qty;
    else if (m.type === 'missing') s.missing += m.qty;
    else if (m.type === 'returned') s.returned += m.qty;
  }
  return [...map.values()].sort((a, b) => a.brand.name.localeCompare(b.brand.name, 'ar'));
}

export function sortProducts(data: AppData, products: Product[]): Product[] {
  const brandName = (id: string) => data.brands.find((b) => b.id === id)?.name ?? '';
  return [...products].sort(
    (a, b) =>
      brandName(a.brandId).localeCompare(brandName(b.brandId), 'ar') ||
      a.name.localeCompare(b.name, 'ar') ||
      a.size.localeCompare(b.size, 'ar', { numeric: true }) ||
      a.color.localeCompare(b.color, 'ar'),
  );
}

/* ------------------------------------------------------------------ */
/* Excel import planning (pure; reading the file lives in excel.ts)    */
/* ------------------------------------------------------------------ */

export interface ImportMapping {
  name: number;
  size: number;
  color: number;
  sku: number;
  image: number;
  qty: number; // -1 = not mapped
}

export type ImportMode = 'received' | 'update';

export interface ImportLine {
  key: string;
  name: string;
  size: string;
  color: string;
  sku: string;
  image?: string;
  importedQty: number;
  productId: string | null; // null = new product
  currentQty: number;
  rows: number[]; // Excel row numbers that were merged into this line
}

export interface ImportPlan {
  lines: ImportLine[];
  skipped: { row: number; reason: string }[];
}

const SYNONYMS: Record<keyof ImportMapping, string[]> = {
  qty: ['الكمية', 'كمية', 'العدد', 'عدد', 'qty', 'quantity', 'stock', 'رصيد', 'pcs', 'قطع'],
  size: ['مقاس', 'size', 'سايز', 'حجم'],
  color: ['لون', 'color', 'colour'],
  sku: ['sku', 'كود', 'باركود', 'barcode', 'code'],
  image: ['صورة', 'صوره', 'image', 'photo', 'picture', 'img', 'url', 'رابط'],
  name: ['اسم', 'منتج', 'صنف', 'موديل', 'name', 'product', 'item', 'article', 'وصف', 'بيان', 'description'],
};

/** Guess which column is which, from the header names. */
export function guessMapping(headers: string[]): ImportMapping {
  const result: ImportMapping = { name: -1, size: -1, color: -1, sku: -1, image: -1, qty: -1 };
  const used = new Set<number>();
  const order: (keyof ImportMapping)[] = ['qty', 'image', 'size', 'color', 'sku', 'name'];
  const normHeaders = headers.map(norm);
  for (const field of order) {
    const syns = SYNONYMS[field].map(norm);
    const idx = normHeaders.findIndex((h, i) => !used.has(i) && h && syns.some((s) => h.includes(s)));
    if (idx >= 0) {
      result[field] = idx;
      used.add(idx);
    }
  }
  return result;
}

/** First row that looks like a header (at least 2 filled cells). */
export function detectHeaderRow(rows: string[][]): number {
  const i = rows.findIndex((r) => r.filter((c) => String(c).trim()).length >= 2);
  return i >= 0 ? i : 0;
}

function findExisting(products: Product[], f: ProductFields): Product | undefined {
  if (f.sku) {
    const bySku = products.find((p) => p.sku && norm(p.sku) === norm(f.sku));
    if (bySku) return bySku;
  }
  return products.find((p) => norm(p.name) === norm(f.name) && norm(p.size) === norm(f.size) && norm(p.color) === norm(f.color));
}

/**
 * Turns Excel rows into import lines. Nothing is changed here — this is only
 * the preview. `firstRowNumber` is the Excel row number of rows[0].
 */
export function planImport(
  rows: string[][],
  m: ImportMapping,
  brandProducts: Product[],
  firstRowNumber: number,
): ImportPlan {
  const cell = (r: string[], i: number) => (i >= 0 ? String(r[i] ?? '').trim() : '');
  const lines = new Map<string, ImportLine>();
  const skipped: ImportPlan['skipped'] = [];

  rows.forEach((r, idx) => {
    const rowNo = firstRowNumber + idx;
    if (r.every((c) => !String(c ?? '').trim())) return; // empty row

    const name = cell(r, m.name);
    if (!name) {
      skipped.push({ row: rowNo, reason: 'اسم المنتج فارغ' });
      return;
    }
    const qtyRaw = cell(r, m.qty);
    const qty = parseQty(qtyRaw);
    if (qty === null) {
      skipped.push({ row: rowNo, reason: qtyRaw ? `كمية غير صالحة: "${qtyRaw}"` : 'الكمية فارغة' });
      return;
    }
    if (!Number.isInteger(qty) || qty < 0) {
      skipped.push({ row: rowNo, reason: `الكمية يجب أن تكون عدداً صحيحاً موجباً: "${qtyRaw}"` });
      return;
    }

    const fields: ProductFields = {
      name,
      size: cell(r, m.size),
      color: cell(r, m.color),
      sku: cell(r, m.sku),
      image: cell(r, m.image),
    };
    const existing = findExisting(brandProducts, fields);
    const key = existing
      ? existing.id
      : fields.sku
        ? `new|sku|${norm(fields.sku)}`
        : `new|${norm(fields.name)}|${norm(fields.size)}|${norm(fields.color)}`;

    const line = lines.get(key);
    if (line) {
      line.importedQty += qty;
      line.rows.push(rowNo);
    } else {
      lines.set(key, {
        key,
        ...fields,
        importedQty: qty,
        productId: existing?.id ?? null,
        currentQty: existing?.qty ?? 0,
        rows: [rowNo],
      });
    }
  });

  return { lines: [...lines.values()], skipped };
}

/** received: file quantity is ADDED to stock. update: file quantity BECOMES the stock. */
export function lineResult(l: ImportLine, mode: ImportMode) {
  const newQty = mode === 'received' ? l.currentQty + l.importedQty : l.importedQty;
  return { newQty, delta: newQty - l.currentQty };
}

export function applyImport(
  data: AppData,
  p: { brandId: string; lines: ImportLine[]; mode: ImportMode; user: string; date: string; source: string },
): Result<{ created: number; updated: number }> {
  let d = data;
  let created = 0;
  let updated = 0;
  for (const l of p.lines) {
    let productId = l.productId;
    if (!productId) {
      const product: Product = {
        id: uid(),
        brandId: p.brandId,
        name: l.name,
        size: l.size,
        color: l.color,
        sku: l.sku,
        image: l.image,
        qty: 0,
      };
      d = { ...d, products: [...d.products, product] };
      productId = product.id;
      created += 1;
    } else if (l.image) {
      // update image if provided in import
      d = {
        ...d,
        products: d.products.map((prod) => (prod.id === productId && !prod.image ? { ...prod, image: l.image } : prod)),
      };
    }
    const { delta } = lineResult(l, p.mode);
    if (delta === 0) continue;
    const notes =
      p.mode === 'received'
        ? `استيراد من Excel: ${p.source}`
        : `تحديث مخزون من Excel (${delta > 0 ? 'زيادة' : 'نقص'}): ${p.source}`;
    const r = applyMovement(d, {
      type: delta > 0 ? 'received' : 'missing',
      productId,
      qty: Math.abs(delta),
      date: p.date,
      user: p.user,
      notes,
    });
    if (!r.ok) return r;
    d = r.data;
    if (l.productId) updated += 1;
  }
  return { ok: true, data: d, created, updated };
}

/* ------------------------------------------------------------------ */
/* Loading / validating saved data                                     */
/* ------------------------------------------------------------------ */

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const str = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v));
const int = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
};

export function sanitizeData(raw: unknown): AppData | null {
  if (!isObj(raw)) return null;
  if (!Array.isArray(raw.brands) || !Array.isArray(raw.products) || !Array.isArray(raw.movements)) return null;

  const brands: Brand[] = raw.brands
    .filter(isObj)
    .map((b) => ({ id: str(b.id), name: str(b.name) }))
    .filter((b) => b.id && b.name);

  const products: Product[] = raw.products
    .filter(isObj)
    .map((p) => ({
      id: str(p.id),
      brandId: str(p.brandId),
      name: str(p.name),
      size: str(p.size),
      color: str(p.color),
      sku: str(p.sku),
      image: str(p.image),
      qty: int(p.qty),
    }))
    .filter((p) => p.id && p.name && brands.some((b) => b.id === p.brandId));

  const movements: Movement[] = raw.movements
    .filter(isObj)
    .filter((m) => MOVEMENT_TYPES.includes(m.type as MovementType))
    .map((m) => ({
      id: str(m.id),
      createdAt: Number(m.createdAt) || 0,
      type: m.type as MovementType,
      productId: str(m.productId),
      brandId: str(m.brandId),
      productName: str(m.productName),
      brandName: str(m.brandName),
      size: str(m.size),
      color: str(m.color),
      qty: int(m.qty),
      date: validDate(str(m.date)),
      user: str(m.user),
      notes: str(m.notes),
    }))
    .filter((m) => m.id && m.qty > 0);

  const s = isObj(raw.settings) ? raw.settings : {};
  const settings: Settings = {
    shopName: str(s.shopName) || DEFAULT_SETTINGS.shopName,
    userName: str(s.userName) || DEFAULT_SETTINGS.userName,
    lowStockThreshold: s.lowStockThreshold === undefined ? DEFAULT_SETTINGS.lowStockThreshold : int(s.lowStockThreshold),
  };

  return { brands, products, movements, settings };
}
