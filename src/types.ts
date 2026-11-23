export type MovementType = 'received' | 'sold' | 'missing' | 'returned';

export interface Brand {
  id: string;
  name: string;
}

export interface Product {
  id: string;
  brandId: string;
  name: string;
  size: string;
  color: string;
  sku: string;
  image?: string;
  qty: number;
}

export interface Movement {
  id: string;
  createdAt: number;
  type: MovementType;
  productId: string;
  brandId: string;
  // Snapshots, so history stays readable even if a product is later deleted.
  productName: string;
  brandName: string;
  size: string;
  color: string;
  qty: number;
  date: string; // YYYY-MM-DD
  user: string;
  notes: string;
}

export interface Settings {
  shopName: string;
  userName: string;
  lowStockThreshold: number;
}

export interface AppData {
  brands: Brand[];
  products: Product[];
  movements: Movement[];
  settings: Settings;
}
