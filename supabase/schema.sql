create extension if not exists "pgcrypto";

do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type app_role as enum ('admin', 'manager', 'cashier');
  end if;
  if not exists (select 1 from pg_type where typname = 'stock_movement_type') then
    create type stock_movement_type as enum (
      'sale',
      'receive',
      'adjustment',
      'return_customer',
      'return_supplier'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'return_type') then
    create type return_type as enum ('customer', 'supplier');
  end if;
end$$;

create table if not exists profiles (
  user_id uuid primary key references auth.users on delete cascade,
  full_name text,
  phone text,
  avatar_url text,
  role app_role not null default 'cashier',
  created_at timestamptz not null default now()
);

alter table profiles
  add column if not exists phone text;

alter table profiles
  add column if not exists avatar_url text;

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sku text unique,
  barcode text unique,
  category text,
  price numeric(12, 2) not null default 0,
  cost numeric(12, 2) not null default 0,
  stock_on_hand integer not null default 0,
  low_stock_threshold integer not null default 5,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists branches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

insert into branches (name, is_default)
select 'Main Branch', true
where not exists (select 1 from branches where is_default = true);

create table if not exists product_stock (
  product_id uuid not null references products on delete cascade,
  branch_id uuid not null references branches on delete cascade,
  stock_on_hand integer not null default 0,
  low_stock_threshold integer not null default 5,
  updated_at timestamptz not null default now(),
  primary key (product_id, branch_id)
);

create table if not exists sales (
  id uuid primary key default gen_random_uuid(),
  receipt_no text not null unique,
  payment_method text not null,
  total numeric(12, 2) not null default 0,
  branch_id uuid references branches,
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references sales on delete cascade,
  product_id uuid not null references products,
  quantity integer not null,
  price numeric(12, 2) not null,
  cost numeric(12, 2) not null,
  line_total numeric(12, 2) not null
);

create table if not exists stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products,
  qty_change integer not null,
  movement_type stock_movement_type not null,
  reason text,
  reference_id uuid,
  branch_id uuid references branches,
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  created_at timestamptz not null default now()
);

create table if not exists purchase_orders (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid references suppliers,
  status text not null default 'open',
  reference text,
  branch_id uuid references branches,
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references purchase_orders on delete cascade,
  product_id uuid not null references products,
  quantity integer not null,
  cost numeric(12, 2) not null default 0
);

create table if not exists returns (
  id uuid primary key default gen_random_uuid(),
  return_type return_type not null,
  reason text,
  branch_id uuid references branches,
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists return_items (
  id uuid primary key default gen_random_uuid(),
  return_id uuid not null references returns on delete cascade,
  product_id uuid not null references products,
  quantity integer not null,
  price numeric(12, 2) not null default 0
);

create sequence if not exists receipt_seq;

create or replace function touch_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists products_touch_updated_at on products;
create trigger products_touch_updated_at
before update on products
for each row execute procedure touch_updated_at();

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (user_id, full_name, phone)
  values (new.id, new.raw_user_meta_data->>'full_name', new.phone)
  on conflict (user_id) do nothing;
  return new;
end;
$$;


drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure handle_new_user();

create or replace function has_role(required_roles app_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from profiles
    where user_id = auth.uid()
      and role = any (required_roles)
  );
$$;

create or replace function product_upsert(
  p_id uuid default null,
  p_name text default null,
  p_sku text default null,
  p_barcode text default null,
  p_category text default null,
  p_price numeric default null,
  p_cost numeric default null,
  p_stock_on_hand integer default 0,
  p_low_stock_threshold integer default 0,
  p_is_active boolean default true,
  p_branch_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_branch_id uuid;
  v_product_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if not has_role(array['admin', 'manager']::app_role[]) then
    raise exception 'Not allowed';
  end if;

  if p_name is null or btrim(p_name) = '' then
    raise exception 'Name is required';
  end if;

  if p_price is null then
    raise exception 'Price is required';
  end if;

  if p_branch_id is null then
    select id into v_branch_id from branches where is_default = true limit 1;
  else
    v_branch_id := p_branch_id;
  end if;

  if p_id is null then
    insert into products (
      name,
      sku,
      barcode,
      category,
      price,
      cost,
      stock_on_hand,
      low_stock_threshold,
      is_active
    )
    values (
      btrim(p_name),
      p_sku,
      p_barcode,
      p_category,
      p_price,
      coalesce(p_cost, 0),
      coalesce(p_stock_on_hand, 0),
      coalesce(p_low_stock_threshold, 0),
      coalesce(p_is_active, true)
    )
    returning id into v_product_id;
  else
    update products
      set name = btrim(p_name),
          sku = p_sku,
          barcode = p_barcode,
          category = p_category,
          price = p_price,
          cost = coalesce(p_cost, cost),
          stock_on_hand = coalesce(p_stock_on_hand, 0),
          low_stock_threshold = coalesce(p_low_stock_threshold, 0),
          is_active = coalesce(p_is_active, true)
      where id = p_id
      returning id into v_product_id;

    if v_product_id is null then
      raise exception 'Product not found';
    end if;
  end if;

  if v_branch_id is not null then
    insert into product_stock (
      product_id,
      branch_id,
      stock_on_hand,
      low_stock_threshold
    )
    values (
      v_product_id,
      v_branch_id,
      coalesce(p_stock_on_hand, 0),
      coalesce(p_low_stock_threshold, 0)
    )
    on conflict (product_id, branch_id)
    do update set
      stock_on_hand = excluded.stock_on_hand,
      low_stock_threshold = excluded.low_stock_threshold,
      updated_at = now();
  end if;

  return v_product_id;
end;
$$;

alter table profiles enable row level security;
alter table products enable row level security;
alter table branches enable row level security;
alter table product_stock enable row level security;
alter table sales enable row level security;
alter table sale_items enable row level security;
alter table stock_movements enable row level security;
alter table suppliers enable row level security;
alter table purchase_orders enable row level security;
alter table purchase_order_items enable row level security;
alter table returns enable row level security;
alter table return_items enable row level security;

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  title text not null,
  body text not null,
  created_at timestamptz not null default now()
);

alter table notifications enable row level security;

drop policy if exists "profiles_select_own" on profiles;
create policy "profiles_select_own"
on profiles for select
to authenticated
using (user_id = (select auth.uid()) or has_role(array['admin']::app_role[]));

drop policy if exists "profiles_update" on profiles;
create policy "profiles_update"
on profiles for update
to authenticated
using (user_id = (select auth.uid()) or has_role(array['admin']::app_role[]))
with check (user_id = (select auth.uid()) or has_role(array['admin']::app_role[]));

drop policy if exists "products_select" on products;
create policy "products_select"
on products for select
to authenticated
using (true);

drop policy if exists "branches_select" on branches;
create policy "branches_select"
on branches for select
to authenticated
using (true);

drop policy if exists "product_stock_select" on product_stock;
create policy "product_stock_select"
on product_stock for select
to authenticated
using (true);

drop policy if exists "products_manage" on products;
create policy "products_manage"
on products for insert
to authenticated
with check (has_role(array['admin', 'manager']::app_role[]));

drop policy if exists "products_manage_update" on products;
create policy "products_manage_update"
on products for update
to authenticated
using (has_role(array['admin', 'manager']::app_role[]))
with check (has_role(array['admin', 'manager']::app_role[]));

drop policy if exists "products_manage_delete" on products;
create policy "products_manage_delete"
on products for delete
to authenticated
using (has_role(array['admin', 'manager']::app_role[]));

drop policy if exists "sales_select" on sales;
create policy "sales_select"
on sales for select
to authenticated
using (created_by = (select auth.uid()) or has_role(array['admin', 'manager']::app_role[]));

drop policy if exists "sale_items_select" on sale_items;
create policy "sale_items_select"
on sale_items for select
to authenticated
using (
  exists (
    select 1 from sales
    where sales.id = sale_items.sale_id
      and (sales.created_by = (select auth.uid()) or has_role(array['admin', 'manager']::app_role[]))
  )
);

drop policy if exists "stock_movements_select" on stock_movements;
create policy "stock_movements_select"
on stock_movements for select
to authenticated
using (created_by = (select auth.uid()) or has_role(array['admin', 'manager']::app_role[]));

drop policy if exists "suppliers_select" on suppliers;
create policy "suppliers_select"
on suppliers for select
to authenticated
using (has_role(array['admin', 'manager']::app_role[]));

drop policy if exists "purchase_orders_select" on purchase_orders;
create policy "purchase_orders_select"
on purchase_orders for select
to authenticated
using (created_by = (select auth.uid()) or has_role(array['admin', 'manager']::app_role[]));

drop policy if exists "purchase_order_items_select" on purchase_order_items;
create policy "purchase_order_items_select"
on purchase_order_items for select
to authenticated
using (
  exists (
    select 1 from purchase_orders
    where purchase_orders.id = purchase_order_items.purchase_order_id
      and (purchase_orders.created_by = (select auth.uid()) or has_role(array['admin', 'manager']::app_role[]))
  )
);

drop policy if exists "returns_select" on returns;
create policy "returns_select"
on returns for select
to authenticated
using (created_by = (select auth.uid()) or has_role(array['admin', 'manager']::app_role[]));

drop policy if exists "return_items_select" on return_items;
create policy "return_items_select"
on return_items for select
to authenticated
using (
  exists (
    select 1 from returns
    where returns.id = return_items.return_id
      and (returns.created_by = (select auth.uid()) or has_role(array['admin', 'manager']::app_role[]))
  )
);

drop policy if exists "notifications_select" on notifications;
create policy "notifications_select"
on notifications for select
to authenticated
using (user_id = (select auth.uid()) or has_role(array['admin', 'manager']::app_role[]));

drop policy if exists "notifications_insert" on notifications;
create policy "notifications_insert"
on notifications for insert
to authenticated
with check (user_id = (select auth.uid()));

create or replace function checkout_sale(
  p_payment_method text,
  p_items jsonb,
  p_branch_id uuid default null
)
returns table (sale_id uuid, receipt_no text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cashier_id uuid := auth.uid();
  v_sale_id uuid := gen_random_uuid();
  v_receipt_no text;
  v_now timestamptz := now();
  v_total numeric(12, 2) := 0;
  v_item jsonb;
  v_product_id uuid;
  v_qty integer;
  v_price numeric(12, 2);
  v_price_db numeric(12, 2);
  v_cost numeric(12, 2);
  v_branch_id uuid;
begin
  if v_cashier_id is null then
    raise exception 'Not authenticated';
  end if;

  if not has_role(array['cashier', 'manager', 'admin']::app_role[]) then
    raise exception 'Not allowed';
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'No items provided';
  end if;

  if p_branch_id is null then
    select id into v_branch_id from branches where is_default = true limit 1;
  else
    v_branch_id := p_branch_id;
  end if;

  if v_branch_id is null then
    raise exception 'Branch not set';
  end if;

  v_receipt_no := 'PX-' || to_char(v_now, 'YYYYMMDD') || '-' ||
    lpad(nextval('receipt_seq')::text, 4, '0');

  insert into sales (id, receipt_no, payment_method, total, branch_id, created_by, created_at)
  values (v_sale_id, v_receipt_no, p_payment_method, 0, v_branch_id, v_cashier_id, v_now);

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_id := (v_item->>'product_id')::uuid;
    v_qty := (v_item->>'quantity')::integer;
    v_price := nullif(v_item->>'price', '')::numeric;

    if v_product_id is null or v_qty is null or v_qty <= 0 then
      raise exception 'Invalid item payload';
    end if;

    select price, cost
      into v_price_db, v_cost
      from products
      where id = v_product_id and is_active = true;

    if not found then
      raise exception 'Product not found';
    end if;

    if v_price is null or v_price <= 0 then
      v_price := v_price_db;
    end if;

    update product_stock
      set stock_on_hand = stock_on_hand - v_qty
      where product_id = v_product_id
        and branch_id = v_branch_id
        and stock_on_hand >= v_qty;

    if not found then
      raise exception 'Insufficient stock';
    end if;

    update products
      set stock_on_hand = stock_on_hand - v_qty
      where id = v_product_id
        and stock_on_hand >= v_qty;

    insert into sale_items (sale_id, product_id, quantity, price, cost, line_total)
    values (v_sale_id, v_product_id, v_qty, v_price, v_cost, v_price * v_qty);

    insert into stock_movements (product_id, qty_change, movement_type, reason, reference_id, branch_id, created_by)
    values (v_product_id, -v_qty, 'sale', 'sale', v_sale_id, v_branch_id, v_cashier_id);

    v_total := v_total + (v_price * v_qty);
  end loop;

  update sales set total = v_total where id = v_sale_id;

  return query select v_sale_id, v_receipt_no;
end;
$$;

create or replace function manual_sale(
  p_items jsonb,
  p_branch_id uuid default null
)
returns table (sale_id uuid, receipt_no text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cashier_id uuid := auth.uid();
  v_sale_id uuid := gen_random_uuid();
  v_receipt_no text;
  v_now timestamptz := now();
  v_total numeric(12, 2) := 0;
  v_item jsonb;
  v_product_id uuid;
  v_qty integer;
  v_price numeric(12, 2);
  v_cost numeric(12, 2);
  v_branch_id uuid;
begin
  if v_cashier_id is null then
    raise exception 'Not authenticated';
  end if;

  if not has_role(array['cashier', 'manager', 'admin']::app_role[]) then
    raise exception 'Not allowed';
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'No items provided';
  end if;

  if p_branch_id is null then
    select id into v_branch_id from branches where is_default = true limit 1;
  else
    v_branch_id := p_branch_id;
  end if;

  if v_branch_id is null then
    raise exception 'Branch not set';
  end if;

  v_receipt_no := 'PX-' || to_char(v_now, 'YYYYMMDD') || '-' ||
    lpad(nextval('receipt_seq')::text, 4, '0');

  insert into sales (id, receipt_no, payment_method, total, branch_id, created_by, created_at)
  values (v_sale_id, v_receipt_no, 'cash', 0, v_branch_id, v_cashier_id, v_now);

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_id := (v_item->>'product_id')::uuid;
    v_qty := (v_item->>'quantity')::integer;
    v_price := nullif(v_item->>'price', '')::numeric;

    if v_product_id is null or v_qty is null or v_qty <= 0 or v_price is null or v_price <= 0 then
      raise exception 'Invalid item payload';
    end if;

    select cost
      into v_cost
      from products
      where id = v_product_id and is_active = true;

    if not found then
      raise exception 'Product not found';
    end if;

    update product_stock
      set stock_on_hand = stock_on_hand - v_qty
      where product_id = v_product_id
        and branch_id = v_branch_id
        and stock_on_hand >= v_qty;

    if not found then
      raise exception 'Insufficient stock';
    end if;

    update products
      set stock_on_hand = stock_on_hand - v_qty
      where id = v_product_id
        and stock_on_hand >= v_qty;

    insert into sale_items (sale_id, product_id, quantity, price, cost, line_total)
    values (v_sale_id, v_product_id, v_qty, v_price, v_cost, v_price * v_qty);

    insert into stock_movements (product_id, qty_change, movement_type, reason, reference_id, branch_id, created_by)
    values (v_product_id, -v_qty, 'sale', 'manual sale', v_sale_id, v_branch_id, v_cashier_id);

    v_total := v_total + (v_price * v_qty);
  end loop;

  update sales set total = v_total where id = v_sale_id;

  return query select v_sale_id, v_receipt_no;
end;
$$;

create or replace function stock_receive(
  p_items jsonb,
  p_reference text default null,
  p_branch_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_item jsonb;
  v_product_id uuid;
  v_qty integer;
  v_cost numeric(12, 2);
  v_branch_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if not has_role(array['admin', 'manager']::app_role[]) then
    raise exception 'Not allowed';
  end if;

  if p_branch_id is null then
    select id into v_branch_id from branches where is_default = true limit 1;
  else
    v_branch_id := p_branch_id;
  end if;

  if v_branch_id is null then
    raise exception 'Branch not set';
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'No items provided';
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_id := (v_item->>'product_id')::uuid;
    v_qty := (v_item->>'quantity')::integer;
    v_cost := nullif(v_item->>'cost', '')::numeric;

    if v_product_id is null or v_qty is null or v_qty <= 0 then
      raise exception 'Invalid item payload';
    end if;

    insert into product_stock (product_id, branch_id, stock_on_hand, low_stock_threshold)
      values (v_product_id, v_branch_id, v_qty, 5)
      on conflict (product_id, branch_id)
      do update set stock_on_hand = product_stock.stock_on_hand + v_qty;

    update products
      set stock_on_hand = stock_on_hand + v_qty,
          cost = coalesce(v_cost, cost)
      where id = v_product_id;

    if not found then
      raise exception 'Product not found';
    end if;

    insert into stock_movements (product_id, qty_change, movement_type, reason, reference_id, branch_id, created_by)
    values (v_product_id, v_qty, 'receive', p_reference, null, v_branch_id, v_user_id);
  end loop;
end;
$$;

create or replace function stock_adjust(
  p_items jsonb,
  p_branch_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_item jsonb;
  v_product_id uuid;
  v_qty integer;
  v_reason text;
  v_branch_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if not has_role(array['admin', 'manager']::app_role[]) then
    raise exception 'Not allowed';
  end if;

  if p_branch_id is null then
    select id into v_branch_id from branches where is_default = true limit 1;
  else
    v_branch_id := p_branch_id;
  end if;

  if v_branch_id is null then
    raise exception 'Branch not set';
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'No items provided';
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_id := (v_item->>'product_id')::uuid;
    v_qty := (v_item->>'quantity')::integer;
    v_reason := v_item->>'reason';

    if v_product_id is null or v_qty is null or v_qty = 0 then
      raise exception 'Invalid item payload';
    end if;

    insert into product_stock (product_id, branch_id, stock_on_hand, low_stock_threshold)
      values (v_product_id, v_branch_id, v_qty, 5)
      on conflict (product_id, branch_id)
      do update set stock_on_hand = product_stock.stock_on_hand + v_qty;

    update products
      set stock_on_hand = stock_on_hand + v_qty
      where id = v_product_id;

    if not found then
      raise exception 'Product not found';
    end if;

    insert into stock_movements (product_id, qty_change, movement_type, reason, reference_id, branch_id, created_by)
    values (v_product_id, v_qty, 'adjustment', v_reason, null, v_branch_id, v_user_id);
  end loop;
end;
$$;

create or replace function create_purchase_order(
  p_supplier_id uuid,
  p_reference text,
  p_items jsonb,
  p_branch_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_po_id uuid := gen_random_uuid();
  v_item jsonb;
  v_product_id uuid;
  v_qty integer;
  v_cost numeric(12, 2);
  v_branch_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if not has_role(array['admin', 'manager']::app_role[]) then
    raise exception 'Not allowed';
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'No items provided';
  end if;

  if p_branch_id is null then
    select id into v_branch_id from branches where is_default = true limit 1;
  else
    v_branch_id := p_branch_id;
  end if;

  insert into purchase_orders (id, supplier_id, status, reference, branch_id, created_by)
  values (v_po_id, p_supplier_id, 'open', p_reference, v_branch_id, v_user_id);

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_id := (v_item->>'product_id')::uuid;
    v_qty := (v_item->>'quantity')::integer;
    v_cost := nullif(v_item->>'cost', '')::numeric;

    if v_product_id is null or v_qty is null or v_qty <= 0 then
      raise exception 'Invalid item payload';
    end if;

    insert into purchase_order_items (purchase_order_id, product_id, quantity, cost)
    values (v_po_id, v_product_id, v_qty, coalesce(v_cost, 0));
  end loop;

  return v_po_id;
end;
$$;

create or replace function receive_purchase_order(
  p_purchase_order_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_branch_id uuid;
  v_item record;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if not has_role(array['admin', 'manager']::app_role[]) then
    raise exception 'Not allowed';
  end if;

  select branch_id into v_branch_id from purchase_orders where id = p_purchase_order_id;
  update purchase_orders set status = 'received' where id = p_purchase_order_id;

  for v_item in
    select product_id, quantity, cost from purchase_order_items
    where purchase_order_id = p_purchase_order_id
  loop
    insert into product_stock (product_id, branch_id, stock_on_hand, low_stock_threshold)
      values (v_item.product_id, v_branch_id, v_item.quantity, 5)
      on conflict (product_id, branch_id)
      do update set stock_on_hand = product_stock.stock_on_hand + v_item.quantity;

    update products
      set stock_on_hand = stock_on_hand + v_item.quantity,
          cost = coalesce(v_item.cost, cost)
      where id = v_item.product_id;

    insert into stock_movements (product_id, qty_change, movement_type, reason, reference_id, branch_id, created_by)
    values (v_item.product_id, v_item.quantity, 'receive', 'purchase order', p_purchase_order_id, v_branch_id, v_user_id);
  end loop;
end;
$$;

create or replace function process_return(
  p_return_type return_type,
  p_reason text,
  p_items jsonb,
  p_branch_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_return_id uuid := gen_random_uuid();
  v_item jsonb;
  v_product_id uuid;
  v_qty integer;
  v_price numeric(12, 2);
  v_branch_id uuid;
  v_movement text;
  v_qty_change integer;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if not has_role(array['admin', 'manager']::app_role[]) then
    raise exception 'Not allowed';
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'No items provided';
  end if;

  if p_branch_id is null then
    select id into v_branch_id from branches where is_default = true limit 1;
  else
    v_branch_id := p_branch_id;
  end if;

  insert into returns (id, return_type, reason, branch_id, created_by)
  values (v_return_id, p_return_type, p_reason, v_branch_id, v_user_id);

  v_movement := case when p_return_type = 'customer' then 'return_customer' else 'return_supplier' end;
  v_qty_change := case when p_return_type = 'customer' then 1 else -1 end;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_id := (v_item->>'product_id')::uuid;
    v_qty := (v_item->>'quantity')::integer;
    v_price := nullif(v_item->>'price', '')::numeric;

    if v_product_id is null or v_qty is null or v_qty <= 0 then
      raise exception 'Invalid item payload';
    end if;

    insert into return_items (return_id, product_id, quantity, price)
    values (v_return_id, v_product_id, v_qty, coalesce(v_price, 0));

    insert into product_stock (product_id, branch_id, stock_on_hand, low_stock_threshold)
      values (v_product_id, v_branch_id, v_qty * v_qty_change, 5)
      on conflict (product_id, branch_id)
      do update set stock_on_hand = product_stock.stock_on_hand + (v_qty * v_qty_change);

    update products
      set stock_on_hand = stock_on_hand + (v_qty * v_qty_change)
      where id = v_product_id;

    insert into stock_movements (product_id, qty_change, movement_type, reason, reference_id, branch_id, created_by)
    values (v_product_id, v_qty * v_qty_change, v_movement::stock_movement_type, p_reason, v_return_id, v_branch_id, v_user_id);
  end loop;

  return v_return_id;
end;
$$;

revoke insert, update, delete on products from authenticated;
revoke insert, update, delete on sales from authenticated;
revoke insert, update, delete on sale_items from authenticated;
revoke insert, update, delete on stock_movements from authenticated;

revoke select on products from authenticated;
grant select (
  id,
  name,
  sku,
  barcode,
  category,
  price,
  stock_on_hand,
  low_stock_threshold,
  is_active,
  created_at,
  updated_at
) on products to authenticated;

create or replace view products_public as
select
  id, name, sku, barcode, category,
  price,
  stock_on_hand,
  low_stock_threshold,
  is_active,
  created_at,
  updated_at
from products;

grant select on products_public to authenticated;

drop policy if exists "stock_movements_select" on stock_movements;
create policy "stock_movements_select"
on stock_movements for select
to authenticated
using (created_by = auth.uid() or has_role(array['admin', 'manager']::app_role[]));

revoke all on function checkout_sale(text, jsonb, uuid) from public;
revoke all on function manual_sale(jsonb, uuid) from public;
revoke all on function stock_receive(jsonb, text, uuid) from public;
revoke all on function stock_adjust(jsonb, uuid) from public;
revoke all on function create_purchase_order(uuid, text, jsonb, uuid) from public;
revoke all on function receive_purchase_order(uuid) from public;
revoke all on function process_return(return_type, text, jsonb, uuid) from public;
revoke all on function product_upsert(uuid, text, text, text, text, numeric, numeric, integer, integer, boolean, uuid) from public;

grant execute on function checkout_sale(text, jsonb, uuid) to authenticated;
grant execute on function manual_sale(jsonb, uuid) to authenticated;
grant execute on function stock_receive(jsonb, text, uuid) to authenticated;
grant execute on function stock_adjust(jsonb, uuid) to authenticated;
grant execute on function create_purchase_order(uuid, text, jsonb, uuid) to authenticated;
grant execute on function receive_purchase_order(uuid) to authenticated;
grant execute on function process_return(return_type, text, jsonb, uuid) to authenticated;
grant execute on function product_upsert(uuid, text, text, text, text, numeric, numeric, integer, integer, boolean, uuid) to authenticated;
