export type Product = {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  category: string | null;
  price: number;
  stock_on_hand: number;
  low_stock_threshold: number;
  is_active: boolean;
};

export type Branch = {
  id: string;
  name: string;
  is_default: boolean;
};
