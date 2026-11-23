-- =============================================
-- Supabase Schema for Brand Stock Tracker
-- Run this in the SQL Editor of your Supabase project
-- =============================================

-- 1. Brands table
CREATE TABLE IF NOT EXISTS brands (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Products table
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  size TEXT DEFAULT '',
  color TEXT DEFAULT '',
  sku TEXT DEFAULT '',
  image TEXT DEFAULT '',
  qty INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Movements table
CREATE TABLE IF NOT EXISTS movements (
  id TEXT PRIMARY KEY,
  created_at BIGINT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('received', 'sold', 'missing', 'returned')),
  product_id TEXT NOT NULL,
  brand_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  brand_name TEXT DEFAULT '',
  size TEXT DEFAULT '',
  color TEXT DEFAULT '',
  qty INTEGER NOT NULL,
  date TEXT NOT NULL,
  "user" TEXT DEFAULT '',
  notes TEXT DEFAULT ''
);

-- 4. Settings table (single row)
CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  shop_name TEXT DEFAULT 'متجري',
  user_name TEXT DEFAULT 'المستخدم',
  low_stock_threshold INTEGER DEFAULT 2
);

-- Insert default settings row
INSERT INTO settings (id, shop_name, user_name, low_stock_threshold)
VALUES (1, 'متجري', 'المستخدم', 2)
ON CONFLICT (id) DO NOTHING;

-- 5. Enable Row Level Security (RLS) but allow public access via anon key
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Allow public read/write for all tables (since we use anon key and no auth)
CREATE POLICY "Allow all on brands" ON brands FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on products" ON products FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on movements" ON movements FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on settings" ON settings FOR ALL USING (true) WITH CHECK (true);

-- 6. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_products_brand_id ON products(brand_id);
CREATE INDEX IF NOT EXISTS idx_movements_product_id ON movements(product_id);
CREATE INDEX IF NOT EXISTS idx_movements_brand_id ON movements(brand_id);
CREATE INDEX IF NOT EXISTS idx_movements_date ON movements(date);
