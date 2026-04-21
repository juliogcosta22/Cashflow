export type TransactionType = "entrada" | "saida";
export type MovementType = "entrada" | "saida";
export type PaymentMethod = "dinheiro" | "debito" | "credito" | "pix";

export interface Company {
  id: string;
  name: string;
  email: string;
  created_at: string;
}

export interface CashTransaction {
  id: string;
  company_id: string;
  type: TransactionType;
  category: string;
  description: string;
  amount: number;
  date: string;
  created_at: string;
}

export interface Product {
  id: string;
  company_id: string;
  name: string;
  sku: string | null;
  unit: string;
  cost_price: number;
  sale_price: number;
  stock_quantity: number;
  created_at: string;
  components?: ProductComponent[];
}

export interface ProductComponent {
  id: string;
  company_id: string;
  parent_product_id: string;
  component_product_id: string;
  quantity: number;
  created_at: string;
  component?: Product;
}

export interface StockMovement {
  id: string;
  company_id: string;
  product_id: string;
  product?: Product;
  type: MovementType;
  quantity: number;
  unit_cost: number | null;
  reason: string | null;
  date: string;
  created_at: string;
}

export interface Sale {
  id: string;
  company_id: string;
  payment_method: PaymentMethod;
  total: number;
  discount: number;
  note: string | null;
  date: string;
  created_at: string;
  items?: SaleItem[];
}

export interface SaleItem {
  id: string;
  sale_id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  total: number;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface DashboardStats {
  totalIncome: number;
  totalExpense: number;
  balance: number;
  productCount: number;
  lowStockCount: number;
  monthlyData: { month: string; income: number; expense: number }[];
}
