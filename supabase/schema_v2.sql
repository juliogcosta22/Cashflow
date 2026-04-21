-- ============================================================
-- Caixa — Schema v2
-- Run this in the Supabase SQL Editor (after schema.sql)
-- ============================================================

-- ── Product Components (BOM / Ficha Técnica) ───────────────
create table if not exists product_components (
  id                   uuid primary key default gen_random_uuid(),
  company_id           uuid not null references auth.users(id) on delete cascade,
  parent_product_id    uuid not null references products(id) on delete cascade,
  component_product_id uuid not null references products(id) on delete cascade,
  quantity             numeric(14,3) not null check (quantity > 0),
  created_at           timestamptz default now(),
  constraint no_self_reference check (parent_product_id <> component_product_id)
);

alter table product_components enable row level security;

create policy "Users see own components"
  on product_components for all
  using (auth.uid() = company_id)
  with check (auth.uid() = company_id);

create index on product_components (company_id, parent_product_id);

-- ── Sales (PDV) ────────────────────────────────────────────
create table if not exists sales (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references auth.users(id) on delete cascade,
  payment_method text not null check (payment_method in ('dinheiro', 'debito', 'credito', 'pix')),
  total          numeric(14,2) not null check (total >= 0),
  discount       numeric(14,2) not null default 0,
  note           text,
  date           date not null default current_date,
  created_at     timestamptz default now()
);

alter table sales enable row level security;

create policy "Users see own sales"
  on sales for all
  using (auth.uid() = company_id)
  with check (auth.uid() = company_id);

create index on sales (company_id, date desc);
create index on sales (company_id, payment_method);

-- ── Sale Items ─────────────────────────────────────────────
create table if not exists sale_items (
  id           uuid primary key default gen_random_uuid(),
  sale_id      uuid not null references sales(id) on delete cascade,
  product_id   uuid references products(id) on delete set null,
  product_name text not null,
  quantity     numeric(14,3) not null check (quantity > 0),
  unit_price   numeric(14,2) not null check (unit_price >= 0),
  total        numeric(14,2) not null check (total >= 0),
  created_at   timestamptz default now()
);

alter table sale_items enable row level security;

create policy "Users see own sale items"
  on sale_items for all
  using (
    exists (
      select 1 from sales s
      where s.id = sale_items.sale_id
        and s.company_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from sales s
      where s.id = sale_items.sale_id
        and s.company_id = auth.uid()
    )
  );

create index on sale_items (sale_id);
