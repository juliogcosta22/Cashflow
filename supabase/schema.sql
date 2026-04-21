-- ============================================================
-- Caixa — Supabase Schema
-- Run this in the Supabase SQL Editor
-- ============================================================

-- Enable RLS
-- Each user (auth.uid()) IS the company — one account per company

-- ── Cash Transactions ──────────────────────────────────────
create table if not exists cash_transactions (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references auth.users(id) on delete cascade,
  type          text not null check (type in ('entrada', 'saida')),
  category      text not null default 'Outros',
  description   text not null,
  amount        numeric(14,2) not null check (amount > 0),
  date          date not null,
  created_at    timestamptz default now()
);

alter table cash_transactions enable row level security;

create policy "Users see own transactions"
  on cash_transactions for all
  using (auth.uid() = company_id)
  with check (auth.uid() = company_id);

create index on cash_transactions (company_id, date desc);

-- ── Products ───────────────────────────────────────────────
create table if not exists products (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references auth.users(id) on delete cascade,
  name            text not null,
  sku             text,
  unit            text not null default 'un',
  cost_price      numeric(14,2) not null default 0 check (cost_price >= 0),
  sale_price      numeric(14,2) not null default 0 check (sale_price >= 0),
  stock_quantity  numeric(14,3) not null default 0,
  created_at      timestamptz default now()
);

alter table products enable row level security;

create policy "Users see own products"
  on products for all
  using (auth.uid() = company_id)
  with check (auth.uid() = company_id);

create index on products (company_id, name);

-- ── Stock Movements ────────────────────────────────────────
create table if not exists stock_movements (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references auth.users(id) on delete cascade,
  product_id  uuid not null references products(id) on delete cascade,
  type        text not null check (type in ('entrada', 'saida')),
  quantity    numeric(14,3) not null check (quantity > 0),
  unit_cost   numeric(14,2),
  reason      text,
  date        date not null,
  created_at  timestamptz default now()
);

alter table stock_movements enable row level security;

create policy "Users see own movements"
  on stock_movements for all
  using (auth.uid() = company_id)
  with check (auth.uid() = company_id);

create index on stock_movements (company_id, product_id, date desc);
