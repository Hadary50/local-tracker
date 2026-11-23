import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AppData, Brand, Movement, Product, Settings } from './types';
import { emptyData, sanitizeData, type Result } from './lib/logic';
import { supabase } from './lib/supabase';

/* ------------------------------------------------------------------ */
/* Supabase <-> AppData mapping helpers                                */
/* ------------------------------------------------------------------ */

function dbBrandToApp(row: Record<string, unknown>): Brand {
  return { id: String(row.id), name: String(row.name ?? '') };
}

function dbProductToApp(row: Record<string, unknown>): Product {
  return {
    id: String(row.id),
    brandId: String(row.brand_id ?? ''),
    name: String(row.name ?? ''),
    size: String(row.size ?? ''),
    color: String(row.color ?? ''),
    sku: String(row.sku ?? ''),
    image: String(row.image ?? ''),
    qty: Number(row.qty ?? 0),
  };
}

function dbMovementToApp(row: Record<string, unknown>): Movement {
  return {
    id: String(row.id),
    createdAt: Number(row.created_at ?? 0),
    type: row.type as Movement['type'],
    productId: String(row.product_id ?? ''),
    brandId: String(row.brand_id ?? ''),
    productName: String(row.product_name ?? ''),
    brandName: String(row.brand_name ?? ''),
    size: String(row.size ?? ''),
    color: String(row.color ?? ''),
    qty: Number(row.qty ?? 0),
    date: String(row.date ?? ''),
    user: String(row.user ?? ''),
    notes: String(row.notes ?? ''),
  };
}

function dbSettingsToApp(row: Record<string, unknown>): Settings {
  return {
    shopName: String(row.shop_name ?? 'متجري'),
    userName: String(row.user_name ?? 'المستخدم'),
    lowStockThreshold: Number(row.low_stock_threshold ?? 2),
  };
}

/* ------------------------------------------------------------------ */
/* Load all data from Supabase                                        */
/* ------------------------------------------------------------------ */

async function loadFromSupabase(): Promise<AppData> {
  const [brandsRes, productsRes, movementsRes, settingsRes] = await Promise.all([
    supabase.from('brands').select('*').order('name'),
    supabase.from('products').select('*').order('name'),
    supabase.from('movements').select('*').order('created_at', { ascending: false }),
    supabase.from('settings').select('*').eq('id', 1).single(),
  ]);

  const brands: Brand[] = (brandsRes.data ?? []).map(dbBrandToApp);
  const products: Product[] = (productsRes.data ?? []).map(dbProductToApp);
  const movements: Movement[] = (movementsRes.data ?? []).map(dbMovementToApp);
  const settings: Settings = settingsRes.data ? dbSettingsToApp(settingsRes.data) : { shopName: 'متجري', userName: 'المستخدم', lowStockThreshold: 2 };

  return { brands, products, movements, settings };
}

/* ------------------------------------------------------------------ */
/* Save full diff to Supabase (smart sync)                            */
/* ------------------------------------------------------------------ */

async function syncToSupabase(prev: AppData, next: AppData): Promise<boolean> {
  try {
    const promises: PromiseLike<any>[] = [];

    // ---- Brands ----
    const prevBrandIds = new Set(prev.brands.map((b) => b.id));
    const nextBrandIds = new Set(next.brands.map((b) => b.id));

    // deleted brands
    const deletedBrands = prev.brands.filter((b) => !nextBrandIds.has(b.id));
    if (deletedBrands.length) {
      promises.push(supabase.from('brands').delete().in('id', deletedBrands.map((b) => b.id)));
    }

    // upsert brands (new + changed)
    const upsertBrands = next.brands.filter((nb) => {
      const ob = prev.brands.find((b) => b.id === nb.id);
      return !ob || ob.name !== nb.name;
    });
    if (upsertBrands.length) {
      promises.push(
        supabase.from('brands').upsert(
          upsertBrands.map((b) => ({ id: b.id, name: b.name })),
        ),
      );
    }

    // ---- Products ----
    const prevProductIds = new Set(prev.products.map((p) => p.id));
    const nextProductIds = new Set(next.products.map((p) => p.id));

    const deletedProducts = prev.products.filter((p) => !nextProductIds.has(p.id));
    if (deletedProducts.length) {
      promises.push(supabase.from('products').delete().in('id', deletedProducts.map((p) => p.id)));
    }

    const upsertProducts = next.products.filter((np) => {
      const op = prev.products.find((p) => p.id === np.id);
      return !op || JSON.stringify(op) !== JSON.stringify(np);
    });
    if (upsertProducts.length) {
      promises.push(
        supabase.from('products').upsert(
          upsertProducts.map((p) => ({
            id: p.id,
            brand_id: p.brandId,
            name: p.name,
            size: p.size,
            color: p.color,
            sku: p.sku,
            image: p.image ?? '',
            qty: p.qty,
          })),
        ),
      );
    }

    // ---- Movements (append only - new ones) ----
    const prevMovementIds = new Set(prev.movements.map((m) => m.id));
    const newMovements = next.movements.filter((m) => !prevMovementIds.has(m.id));
    if (newMovements.length) {
      promises.push(
        supabase.from('movements').insert(
          newMovements.map((m) => ({
            id: m.id,
            created_at: m.createdAt,
            type: m.type,
            product_id: m.productId,
            brand_id: m.brandId,
            product_name: m.productName,
            brand_name: m.brandName,
            size: m.size,
            color: m.color,
            qty: m.qty,
            date: m.date,
            user: m.user,
            notes: m.notes,
          })),
        ),
      );
    }

    // ---- Settings ----
    const s = next.settings;
    if (JSON.stringify(prev.settings) !== JSON.stringify(s)) {
      promises.push(
        supabase.from('settings').upsert({
          id: 1,
          shop_name: s.shopName,
          user_name: s.userName,
          low_stock_threshold: s.lowStockThreshold,
        }),
      );
    }

    await Promise.all(promises);
    return true;
  } catch (err) {
    console.error('Supabase sync error:', err);
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Full replace (for restore / wipe)                                  */
/* ------------------------------------------------------------------ */

async function replaceAllInSupabase(next: AppData): Promise<boolean> {
  try {
    // Delete everything first (order matters: movements -> products -> brands)
    await supabase.from('movements').delete().neq('id', '');
    await supabase.from('products').delete().neq('id', '');
    await supabase.from('brands').delete().neq('id', '');

    // Insert all data
    if (next.brands.length) {
      await supabase.from('brands').insert(next.brands.map((b) => ({ id: b.id, name: b.name })));
    }
    if (next.products.length) {
      await supabase.from('products').insert(
        next.products.map((p) => ({
          id: p.id,
          brand_id: p.brandId,
          name: p.name,
          size: p.size,
          color: p.color,
          sku: p.sku,
          image: p.image ?? '',
          qty: p.qty,
        })),
      );
    }
    if (next.movements.length) {
      // Insert in batches of 500 to avoid payload limits
      const batch = 500;
      for (let i = 0; i < next.movements.length; i += batch) {
        const chunk = next.movements.slice(i, i + batch);
        await supabase.from('movements').insert(
          chunk.map((m) => ({
            id: m.id,
            created_at: m.createdAt,
            type: m.type,
            product_id: m.productId,
            brand_id: m.brandId,
            product_name: m.productName,
            brand_name: m.brandName,
            size: m.size,
            color: m.color,
            qty: m.qty,
            date: m.date,
            user: m.user,
            notes: m.notes,
          })),
        );
      }
    }

    // Settings
    await supabase.from('settings').upsert({
      id: 1,
      shop_name: next.settings.shopName,
      user_name: next.settings.userName,
      low_stock_threshold: next.settings.lowStockThreshold,
    });

    return true;
  } catch (err) {
    console.error('Supabase replaceAll error:', err);
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Store Provider (React Context)                                     */
/* ------------------------------------------------------------------ */

interface Store {
  data: AppData;
  /** Runs a change; saves it only if it succeeds. Returns the result so the UI can show errors. */
  mutate: <E>(fn: (d: AppData) => Result<E>) => Result<E>;
  replaceAll: (d: AppData) => void;
  saveFailed: boolean;
  loading: boolean;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [saveFailed, setSaveFailed] = useState(false);
  const ref = useRef(data);

  // Load from Supabase on mount
  useEffect(() => {
    loadFromSupabase()
      .then((d) => {
        // Also try to merge any existing localStorage data for migration
        try {
          const localText = localStorage.getItem('brand-stock-tracker:v1');
          if (localText && d.brands.length === 0) {
            const localData = sanitizeData(JSON.parse(localText));
            if (localData && localData.brands.length > 0) {
              // Migrate local data to Supabase
              ref.current = localData;
              setData(localData);
              replaceAllInSupabase(localData).then((ok) => {
                if (ok) localStorage.removeItem('brand-stock-tracker:v1');
              });
              setLoading(false);
              return;
            }
          }
        } catch {
          /* ignore */
        }
        ref.current = d;
        setData(d);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
        setSaveFailed(true);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const commit = useCallback((next: AppData) => {
    const prev = ref.current;
    ref.current = next;
    setData(next);
    // Fire and forget sync
    syncToSupabase(prev, next).then((ok) => setSaveFailed(!ok));
  }, []);

  const replaceAll = useCallback((next: AppData) => {
    ref.current = next;
    setData(next);
    replaceAllInSupabase(next).then((ok) => setSaveFailed(!ok));
  }, []);

  const mutate = useCallback(
    <E,>(fn: (d: AppData) => Result<E>): Result<E> => {
      const r = fn(ref.current);
      if (r.ok) commit(r.data);
      return r;
    },
    [commit],
  );

  const value = useMemo<Store>(
    () => ({ data, mutate, replaceAll, saveFailed, loading }),
    [data, mutate, replaceAll, saveFailed, loading],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore must be used inside StoreProvider');
  return s;
}
