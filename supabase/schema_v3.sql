-- ============================================================
-- Caixa — Schema v3
-- Run this in the Supabase SQL Editor (after schema_v2.sql)
-- ============================================================

-- Add product type: 'produto' = sold in PDV, 'insumo' = raw material
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS product_type text NOT NULL DEFAULT 'produto'
    CHECK (product_type IN ('produto', 'insumo'));

-- Allow decimal stock quantities (for L, ml, g, kg insumos)
ALTER TABLE products
  ALTER COLUMN stock_quantity TYPE numeric(14,3) USING stock_quantity::numeric;
