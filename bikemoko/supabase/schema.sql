-- Bikemoko cloud schema (Supabase / Postgres 15).
-- Mirrors src/domain/types.ts. Run the whole file once in the Supabase SQL editor.
-- It can be re-run safely: tables use IF NOT EXISTS, functions CREATE OR REPLACE, policies are dropped and recreated.
--
-- Design notes
--  * Money is bigint centavos. Ids are text because the app generates them on the device (uid()).
--  * Appointments are folded into work_orders (scheduled_start / scheduled_end / bay / mechanic_id).
--  * Staff, customer and document references to staff are "soft" (no foreign key) so rows can arrive in any order.
--  * stock_levels, stock_movements, sales, sale_items, payments, work_orders and work_order_items are written ONLY by the
--    SECURITY DEFINER functions below. Direct insert/update/delete is revoked, so the ledger cannot be bypassed.
--  * Every RPC takes p_idem (a client generated uuid). The first call stores its result in sync_log; replaying the same
--    key returns that stored result and changes nothing, so an offline outbox can be re-sent safely.
--  * Roles come from public.staff.user_id = auth.uid(). RLS and the RPCs both check them.
--  * Adjustments (physical counts) may leave quantity below reserved, because the shelf is the truth. Sales, transfers,
--    reservations and billing never take available (quantity - reserved) below zero.

create schema if not exists extensions;
create schema if not exists app;
create extension if not exists btree_gist with schema extensions;
create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------- enums
do $$ begin create type public.staff_role as enum ('owner','cashier','advisor','mechanic','warehouse'); exception when duplicate_object then null; end $$;
do $$ begin create type public.location_code as enum ('STORE','WAREHOUSE'); exception when duplicate_object then null; end $$;
do $$ begin create type public.movement_reason as enum ('sale','po_receive','transfer','repair','adjustment','return','opening'); exception when duplicate_object then null; end $$;
do $$ begin create type public.po_status as enum ('draft','sent','partial','received','cancelled'); exception when duplicate_object then null; end $$;
do $$ begin create type public.channel as enum ('sms','messenger','viber'); exception when duplicate_object then null; end $$;
do $$ begin create type public.line_kind as enum ('labor','part'); exception when duplicate_object then null; end $$;
do $$ begin create type public.estimate_status as enum ('draft','sent','approved','declined','converted'); exception when duplicate_object then null; end $$;
do $$ begin create type public.job_status as enum ('scheduled','checked_in','in_repair','waiting_parts','quality_check','ready','completed','cancelled'); exception when duplicate_object then null; end $$;
do $$ begin create type public.pay_method as enum ('cash','gcash','maya','bank','card'); exception when duplicate_object then null; end $$;
do $$ begin create type public.notify_trigger as enum ('appointment_confirmed','estimate_ready','waiting_parts','ready_for_pickup','follow_up'); exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------- tables
create table if not exists public.staff (
  id text primary key,
  user_id uuid unique references auth.users (id) on delete set null,
  name text not null,
  role public.staff_role not null,
  pin text not null default '',            -- 4-digit quick-switch PIN on shared devices (not a login credential)
  skills text[] not null default '{}',
  daily_capacity_mins int not null default 0 check (daily_capacity_mins >= 0),
  color text not null default '#888888',
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id text primary key,
  sku text not null unique,
  barcode text not null default '',
  name text not null,
  category text not null default '',
  brand text not null default '',
  is_serialized boolean not null default false,
  is_bundle boolean not null default false,
  bundle_items jsonb not null default '[]',   -- [{productId, qty}]
  cost bigint not null default 0 check (cost >= 0),
  price bigint not null default 0 check (price >= 0),
  unit text not null default 'pc',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists products_barcode_idx on public.products (barcode) where barcode <> '';

create table if not exists public.stock_levels (
  product_id text not null references public.products (id),
  location public.location_code not null,
  quantity int not null default 0 check (quantity >= 0),   -- on hand
  reserved int not null default 0 check (reserved >= 0),   -- held for approved repair jobs
  reorder_point int not null default 0 check (reorder_point >= 0),
  bin text not null default '',
  updated_at timestamptz not null default now(),
  primary key (product_id, location)
);

create table if not exists public.stock_movements (   -- immutable ledger
  id text primary key,
  product_id text not null references public.products (id),
  from_location public.location_code,
  to_location public.location_code,
  qty int not null check (qty > 0),
  reason public.movement_reason not null,
  ref_id text,
  staff_id text,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (from_location is not null or to_location is not null)
);
create index if not exists stock_movements_product_idx on public.stock_movements (product_id, created_at);
create index if not exists stock_movements_ref_idx on public.stock_movements (ref_id);

create table if not exists public.suppliers (
  id text primary key,
  name text not null,
  contact text not null default '',
  phone text not null default '',
  avg_lead_days int not null default 0,
  reliability numeric(4,2) not null default 1 check (reliability between 0 and 1),
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.supplier_products (
  id text primary key,
  supplier_id text not null references public.suppliers (id) on delete cascade,
  product_id text not null references public.products (id) on delete cascade,
  supplier_sku text not null default '',
  unit_cost bigint not null default 0 check (unit_cost >= 0),
  lead_days int not null default 0,
  moq int not null default 1,
  updated_at timestamptz not null default now()
);

create table if not exists public.purchase_orders (
  id text primary key,
  po_no text not null,
  supplier_id text not null references public.suppliers (id),
  status public.po_status not null default 'draft',
  notes text not null default '',
  created_at timestamptz not null default now(),
  expected_date timestamptz,
  received_date timestamptz,
  updated_at timestamptz not null default now()
);
create index if not exists purchase_orders_supplier_idx on public.purchase_orders (supplier_id);

create table if not exists public.purchase_order_items (
  po_id text not null references public.purchase_orders (id) on delete cascade,
  line_no int not null,
  product_id text not null references public.products (id),
  qty int not null check (qty > 0),
  unit_cost bigint not null default 0 check (unit_cost >= 0),
  received_qty int not null default 0 check (received_qty >= 0),
  primary key (po_id, line_no)
);

create table if not exists public.customers (
  id text primary key,
  name text not null,
  phone text not null default '',
  messenger text not null default '',
  channel public.channel not null default 'sms',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customer_bikes (
  id text primary key,
  customer_id text not null references public.customers (id) on delete cascade,
  brand text not null default '',
  model text not null default '',
  serial text not null default '',
  color text not null default '',
  notes text not null default '',
  updated_at timestamptz not null default now()
);
create index if not exists customer_bikes_customer_idx on public.customer_bikes (customer_id);

create table if not exists public.services (
  id text primary key,
  name text not null,
  category text not null default '',
  labor_fee bigint not null default 0 check (labor_fee >= 0),
  duration_mins int not null default 30,
  checklist jsonb not null default '[]',
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.work_estimates (
  id text primary key,
  est_no text not null,
  customer_id text not null references public.customers (id),
  bike_id text,
  status public.estimate_status not null default 'draft',
  complaint text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.work_estimate_items (
  id text primary key,
  estimate_id text not null references public.work_estimates (id) on delete cascade,
  line_no int not null,
  kind public.line_kind not null,
  ref_id text not null default '',
  name text not null default '',
  qty int not null check (qty > 0),
  unit_price bigint not null default 0 check (unit_price >= 0),
  duration_mins int not null default 0,
  short boolean not null default false
);
create index if not exists work_estimate_items_est_idx on public.work_estimate_items (estimate_id);

create table if not exists public.work_orders (
  id text primary key,
  job_no text not null,
  estimate_id text references public.work_estimates (id),
  customer_id text not null references public.customers (id),
  bike_id text,
  mechanic_id text,
  bay text not null default '',
  scheduled_start timestamptz not null,
  scheduled_end timestamptz not null,
  actual_start timestamptz,
  actual_end timestamptz,
  timer_since timestamptz,
  worked_mins int not null default 0 check (worked_mins >= 0),
  status public.job_status not null default 'scheduled',
  checklist jsonb not null default '[]',
  complaint text not null default '',
  intake_notes text not null default '',
  photos jsonb not null default '[]',
  deposit bigint not null default 0 check (deposit >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (scheduled_end > scheduled_start),
  -- One mechanic cannot be in two open jobs at once, and one bay cannot hold two open jobs at once.
  constraint work_orders_mechanic_no_overlap exclude using gist (
    mechanic_id with =, tstzrange(scheduled_start, scheduled_end, '[)') with &&
  ) where (mechanic_id is not null and status in ('scheduled','checked_in','in_repair','waiting_parts','quality_check')),
  constraint work_orders_bay_no_overlap exclude using gist (
    bay with =, tstzrange(scheduled_start, scheduled_end, '[)') with &&
  ) where (bay <> '' and status in ('scheduled','checked_in','in_repair','waiting_parts','quality_check'))
);
create index if not exists work_orders_mechanic_idx on public.work_orders (mechanic_id, scheduled_start);
create index if not exists work_orders_customer_idx on public.work_orders (customer_id);

create table if not exists public.work_order_items (
  id text primary key,
  work_order_id text not null references public.work_orders (id) on delete cascade,
  line_no int not null,
  kind public.line_kind not null,
  ref_id text not null default '',
  name text not null default '',
  qty int not null check (qty > 0),
  unit_price bigint not null default 0 check (unit_price >= 0),
  duration_mins int not null default 0,
  short boolean not null default false     -- part was out of stock when booked: not reserved
);
create index if not exists work_order_items_wo_idx on public.work_order_items (work_order_id);

create table if not exists public.shifts (
  id text primary key,
  staff_id text not null,
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  opening_cash bigint not null default 0 check (opening_cash >= 0),
  counted_cash bigint check (counted_cash is null or counted_cash >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.sales (
  id text primary key,
  receipt_no text not null,
  subtotal bigint not null default 0,
  discount bigint not null default 0 check (discount >= 0),
  total bigint not null default 0 check (total >= 0),
  change bigint not null default 0 check (change >= 0),
  work_order_id text references public.work_orders (id),
  customer_id text,
  staff_id text,
  shift_id text,
  voided boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists sales_created_idx on public.sales (created_at);
create index if not exists sales_receipt_idx on public.sales (receipt_no);

create table if not exists public.sale_items (
  sale_id text not null references public.sales (id) on delete cascade,
  line_no int not null,
  product_id text references public.products (id),   -- null for labour lines
  name text not null default '',
  qty int not null check (qty > 0),
  unit_price bigint not null default 0 check (unit_price >= 0),
  serial text not null default '',
  kind public.line_kind not null default 'part',
  primary key (sale_id, line_no)
);

create table if not exists public.payments (
  sale_id text not null references public.sales (id) on delete cascade,
  line_no int not null,
  method public.pay_method not null,
  amount bigint not null check (amount >= 0),
  ref text not null default '',
  primary key (sale_id, line_no)
);

create table if not exists public.notification_logs (
  id text primary key,
  customer_id text not null,
  work_order_id text,
  channel public.channel not null,
  "trigger" public.notify_trigger not null,
  body text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.settings (
  id text primary key check (id = 'shop'),
  shop_name text not null default 'Bikemoko',
  address text not null default '',
  phone text not null default '',
  facebook_page text not null default '',
  receipt_footer text not null default '',
  warranty_days int not null default 30,
  dead_stock_days int not null default 90,
  follow_up_days int not null default 7,
  open_hour int not null default 8,
  close_hour int not null default 18,
  updated_at timestamptz not null default now()
);

-- Idempotency ledger: one row per RPC call the server has accepted.
create table if not exists public.sync_log (
  idem_key uuid primary key,
  rpc text not null,
  user_id uuid,
  result jsonb,
  created_at timestamptz not null default now()
);

-- updated_at is what devices pull by. Stamp it on every write.
create or replace function app.touch() returns trigger language plpgsql as $$
begin new.updated_at := clock_timestamp(); return new; end $$;

do $$
declare t text;
begin
  foreach t in array array['staff','products','stock_levels','stock_movements','suppliers','supplier_products','purchase_orders',
    'customers','customer_bikes','services','work_estimates','work_orders','shifts','sales','notification_logs','settings'] loop
    execute format('drop trigger if exists touch on public.%I', t);
    execute format('create trigger touch before insert or update on public.%I for each row execute function app.touch()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------- role helpers (used by RLS and RPCs)
create or replace function app.my_role() returns public.staff_role
language sql stable security definer set search_path = public, pg_temp as $$
  select role from public.staff where user_id = auth.uid() and active limit 1 $$;

create or replace function app.my_staff_id() returns text
language sql stable security definer set search_path = public, pg_temp as $$
  select id from public.staff where user_id = auth.uid() and active limit 1 $$;

create or replace function app.require_role(p_roles text[]) returns text
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare r text := app.my_role()::text;
begin
  if r is null or not (r = any (p_roles)) then
    raise exception 'Your role (%) cannot do this', coalesce(r, 'not signed in') using errcode = '42501';
  end if;
  return r;
end $$;

-- ---------------------------------------------------------------- internal helpers
create or replace function app.snake(j jsonb) returns jsonb language sql immutable as $$
  select coalesce(jsonb_object_agg(lower(regexp_replace(k, '([A-Z])', '_\1', 'g')), v), '{}'::jsonb) from jsonb_each(j) as t(k, v) $$;

-- Idempotency: returns the stored result when this key was already used, otherwise claims the key and returns null.
create or replace function app.idem_begin(p_idem uuid, p_rpc text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare r jsonb;
begin
  if p_idem is null then raise exception 'p_idem is required' using errcode = 'BK010'; end if;
  insert into public.sync_log (idem_key, rpc, user_id) values (p_idem, p_rpc, auth.uid()) on conflict do nothing;
  if found then return null; end if;
  select result into r from public.sync_log where idem_key = p_idem;
  return coalesce(r, jsonb_build_object('ok', true, 'replayed', true));
end $$;

create or replace function app.idem_end(p_idem uuid, p_result jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
begin update public.sync_log set result = p_result where idem_key = p_idem; return p_result; end $$;

-- Insert or merge one row from a JSON object (camelCase or snake_case keys). Only the keys given are written.
create or replace function app.upsert_json(p_table text, p_row jsonb) returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_new jsonb := app.snake(p_row); v_cur jsonb; v_cols text; v_sets text; v_id text := app.snake(p_row)->>'id';
begin
  if v_id is null then raise exception 'Row has no id' using errcode = 'BK011'; end if;
  execute format('select to_jsonb(t) from public.%I t where id = $1', p_table) into v_cur using v_id;
  v_new := coalesce(v_cur, '{}'::jsonb) || v_new;
  select string_agg(quote_ident(attname), ', '),
         string_agg(format('%1$I = excluded.%1$I', attname), ', ') filter (where attname <> 'id')
    into v_cols, v_sets
  from pg_attribute
  where attrelid = ('public.' || quote_ident(p_table))::regclass and attnum > 0 and not attisdropped
    and attname in (select jsonb_object_keys(v_new));
  execute format('insert into public.%1$I (%2$s) select %2$s from jsonb_populate_record(null::public.%1$I, $1) on conflict (id) do update set %3$s',
                 p_table, v_cols, v_sets) using v_new;
  return v_id;
end $$;

create or replace function app.expand_bundle(p_product text, p_qty int, p_depth int default 0)
returns table (product_id text, qty int) language plpgsql stable strict security definer set search_path = public, pg_temp as $$
declare p public.products; b jsonb;
begin
  select * into p from public.products where id = p_product;
  if not found then raise exception 'Unknown product %', p_product using errcode = 'BK005'; end if;
  if p.is_bundle and jsonb_array_length(p.bundle_items) > 0 and p_depth < 4 then
    for b in select value from jsonb_array_elements(p.bundle_items) loop
      return query select * from app.expand_bundle(b->>'productId', (b->>'qty')::int * p_qty, p_depth + 1);
    end loop;
  else
    return query select p_product, p_qty;
  end if;
end $$;

-- The only place stock quantities change. Writes the ledger row and updates the level together.
create or replace function app.apply_move(
  p_id text, p_product text, p_from public.location_code, p_to public.location_code, p_qty int,
  p_reason public.movement_reason, p_ref text, p_staff text, p_note text, p_at timestamptz,
  p_from_reserved boolean default false, p_allow_negative boolean default false
) returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v public.stock_levels;
begin
  if p_qty is null or p_qty <= 0 then raise exception 'Quantity must be a whole number above 0' using errcode = 'BK002'; end if;
  if p_from is null and p_to is null then raise exception 'A movement needs a from or a to location' using errcode = 'BK002'; end if;
  if p_from is not null and p_from = p_to then raise exception 'Pick two different locations' using errcode = 'BK002'; end if;
  if exists (select 1 from public.stock_movements where id = p_id) then return; end if;   -- already applied

  insert into public.stock_levels (product_id, location)
    select p_product, x from unnest(array[p_from, p_to]) x where x is not null on conflict do nothing;
  perform 1 from public.stock_levels where product_id = p_product and location in (p_from, p_to) order by location for update;

  if p_from is not null then
    select * into v from public.stock_levels where product_id = p_product and location = p_from;
    if p_from_reserved then
      if v.reserved < p_qty then raise exception 'Not enough reserved stock' using errcode = 'BK001'; end if;
      update public.stock_levels set quantity = quantity - p_qty, reserved = reserved - p_qty where product_id = p_product and location = p_from;
    else
      if not p_allow_negative and v.quantity - v.reserved < p_qty then
        raise exception 'Only % available in %', greatest(v.quantity - v.reserved, 0), lower(p_from::text) using errcode = 'BK001';
      end if;
      update public.stock_levels set quantity = quantity - p_qty where product_id = p_product and location = p_from;
    end if;
  end if;
  if p_to is not null then
    update public.stock_levels set quantity = quantity + p_qty where product_id = p_product and location = p_to;
  end if;
  insert into public.stock_movements (id, product_id, from_location, to_location, qty, reason, ref_id, staff_id, note, created_at)
    values (p_id, p_product, p_from, p_to, p_qty, p_reason, p_ref, p_staff, coalesce(p_note, ''), coalesce(p_at, now()))
    on conflict (id) do nothing;
end $$;

create or replace function app.reserve(p_product text, p_loc public.location_code, p_qty int) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v public.stock_levels;
begin
  if p_qty is null or p_qty <= 0 then raise exception 'Quantity must be a whole number above 0' using errcode = 'BK002'; end if;
  select * into v from public.stock_levels where product_id = p_product and location = p_loc for update;
  if not found or v.quantity - v.reserved < p_qty then
    raise exception 'Only % available to reserve', greatest(coalesce(v.quantity - v.reserved, 0), 0) using errcode = 'BK001';
  end if;
  update public.stock_levels set reserved = reserved + p_qty where product_id = p_product and location = p_loc;
end $$;

create or replace function app.release(p_product text, p_loc public.location_code, p_qty int) returns void
language sql security definer set search_path = public, pg_temp as $$
  update public.stock_levels set reserved = greatest(0, reserved - p_qty) where product_id = p_product and location = p_loc $$;

create or replace function app.job_can_move(f public.job_status, t public.job_status) returns boolean
language sql immutable as $$
  select case f
    when 'scheduled' then t in ('checked_in','cancelled')
    when 'checked_in' then t in ('in_repair','waiting_parts','cancelled')
    when 'in_repair' then t in ('waiting_parts','quality_check')
    when 'waiting_parts' then t in ('in_repair','cancelled')
    when 'quality_check' then t in ('in_repair','ready')
    when 'ready' then t = 'completed'
    else false end $$;

-- Owner, cashier and advisor may touch any job; a mechanic only the jobs assigned to them.
create or replace function app.job_access(p_mechanic text) returns text
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare r text := app.require_role(array['owner','cashier','advisor','mechanic']);
begin
  if r = 'mechanic' and p_mechanic is distinct from app.my_staff_id() then
    raise exception 'That job is assigned to another mechanic' using errcode = '42501';
  end if;
  return r;
end $$;

-- Money rule shared with the app: only cash may exceed the amount due.
create or replace function app.settle(p_due bigint, p_payments jsonb, out ok boolean, out change bigint)
language plpgsql immutable as $$
declare v_paid bigint; v_noncash bigint;
begin
  select coalesce(sum((p->>'amount')::bigint), 0), coalesce(sum((p->>'amount')::bigint) filter (where p->>'method' <> 'cash'), 0)
    into v_paid, v_noncash from jsonb_array_elements(coalesce(p_payments, '[]')) p;
  if v_noncash > p_due then ok := false; change := 0;
  else ok := v_paid >= p_due; change := greatest(0, v_paid - p_due); end if;
end $$;

-- Writes a work order and its lines, reserves Store parts. Parts that are short are flagged, not reserved,
-- unless p_allow_short is false (walk-in jobs), in which case the whole call fails.
create or replace function app.create_work_order(p_wo jsonb, p_allow_short boolean, p_at timestamptz) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id text := p_wo->>'id'; r record; v_any_short boolean := false; v_short boolean; v_status public.job_status;
begin
  if exists (select 1 from public.work_orders where id = v_id) then return jsonb_build_object('ok', true, 'id', v_id, 'duplicate', true); end if;
  v_status := coalesce(nullif(p_wo->>'status', ''), 'scheduled')::public.job_status;
  begin
    insert into public.work_orders (id, job_no, estimate_id, customer_id, bike_id, mechanic_id, bay, scheduled_start, scheduled_end,
      actual_start, actual_end, timer_since, worked_mins, status, checklist, complaint, intake_notes, photos, deposit, created_at)
    values (v_id, p_wo->>'jobNo', nullif(p_wo->>'estimateId', ''), p_wo->>'customerId', nullif(p_wo->>'bikeId', ''),
      nullif(p_wo->>'mechanicId', ''), coalesce(p_wo->>'bay', ''), (p_wo->>'scheduledStart')::timestamptz, (p_wo->>'scheduledEnd')::timestamptz,
      (p_wo->>'actualStart')::timestamptz, (p_wo->>'actualEnd')::timestamptz, (p_wo->>'timerSince')::timestamptz,
      coalesce((p_wo->>'workedMins')::int, 0), v_status, coalesce(p_wo->'checklist', '[]'), coalesce(p_wo->>'complaint', ''),
      coalesce(p_wo->>'intakeNotes', ''), coalesce(p_wo->'photos', '[]'), coalesce((p_wo->>'deposit')::bigint, 0),
      coalesce((p_wo->>'createdAt')::timestamptz, p_at));
  exception when exclusion_violation then
    raise exception 'Time clash: that mechanic or bay is already booked for this time' using errcode = 'BK003';
  end;
  for r in select value as l, ord::int as n from jsonb_array_elements(coalesce(p_wo->'lines', '[]')) with ordinality as t(value, ord) order by ord loop
    v_short := false;
    if r.l->>'kind' = 'part' then
      begin
        perform app.reserve(r.l->>'refId', 'STORE', (r.l->>'qty')::int);
      exception when sqlstate 'BK001' then
        if not p_allow_short then raise; end if;
        v_short := true; v_any_short := true;
      end;
    end if;
    insert into public.work_order_items (id, work_order_id, line_no, kind, ref_id, name, qty, unit_price, duration_mins, short)
      values (coalesce(r.l->>'id', gen_random_uuid()::text), v_id, r.n, (r.l->>'kind')::public.line_kind, coalesce(r.l->>'refId', ''),
        coalesce(r.l->>'name', ''), (r.l->>'qty')::int, coalesce((r.l->>'unitPrice')::bigint, 0),
        coalesce((r.l->>'durationMins')::int, 0), v_short);
  end loop;
  if v_any_short then update public.work_orders set status = 'waiting_parts' where id = v_id and status = 'scheduled'; end if;
  return jsonb_build_object('ok', true, 'id', v_id, 'short', v_any_short);
end $$;

-- ================================================================ RPCs (all take p_idem)

-- POS sale. Payload mirrors the app outbox: p_sale = Sale, p_movements = the ledger rows made on the device.
-- The server recomputes what leaves the shelf from the sale lines (bundles expand to parts); the device's movement ids are reused.
create or replace function public.record_sale(p_idem uuid, p_sale jsonb, p_movements jsonb default '[]',
  p_location public.location_code default 'STORE', p_client_at timestamptz default null) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_prev jsonb := app.idem_begin(p_idem, 'record_sale');
  v_id text := p_sale->>'id'; v_at timestamptz := coalesce(p_client_at, now()); v_staff text;
  r record; v_subtotal bigint := 0; v_discount bigint := coalesce((p_sale->>'discount')::bigint, 0); v_total bigint; v_settle record;
  v_prod public.products; v_res jsonb;
begin
  if v_prev is not null then return v_prev; end if;
  perform app.require_role(array['owner','cashier','advisor']);
  v_staff := coalesce(nullif(p_sale->>'staffId', ''), app.my_staff_id());

  for r in select value as l from jsonb_array_elements(coalesce(p_sale->'lines', '[]')) loop
    if (r.l->>'qty')::int <= 0 then raise exception 'Quantity must be a whole number above 0' using errcode = 'BK002'; end if;
    v_subtotal := v_subtotal + (r.l->>'qty')::int * (r.l->>'unitPrice')::bigint;
    if r.l->>'productId' is not null then
      select * into v_prod from public.products where id = r.l->>'productId';
      if not found then raise exception 'Unknown product' using errcode = 'BK005'; end if;
      if v_prod.is_serialized and coalesce(r.l->>'serial', '') = '' then
        raise exception 'Enter the frame serial number for %', v_prod.name using errcode = 'BK006';
      end if;
    end if;
  end loop;
  if v_subtotal = 0 and jsonb_array_length(coalesce(p_sale->'lines', '[]')) = 0 then raise exception 'Sale has no lines' using errcode = 'BK006'; end if;
  v_total := greatest(0, v_subtotal - v_discount);
  select * into v_settle from app.settle(v_total, p_sale->'payments');
  if not v_settle.ok then raise exception 'Payment is short or non-cash is over the total' using errcode = 'BK007'; end if;

  insert into public.sales (id, receipt_no, subtotal, discount, total, change, work_order_id, customer_id, staff_id, shift_id, voided, created_at)
    values (v_id, p_sale->>'receiptNo', v_subtotal, v_discount, v_total, v_settle.change, null, nullif(p_sale->>'customerId', ''),
      v_staff, nullif(p_sale->>'shiftId', ''), false, coalesce((p_sale->>'createdAt')::timestamptz, v_at));
  insert into public.sale_items (sale_id, line_no, product_id, name, qty, unit_price, serial, kind)
    select v_id, ord::int, l->>'productId', coalesce(l->>'name', ''), (l->>'qty')::int, (l->>'unitPrice')::bigint,
      coalesce(l->>'serial', ''), coalesce(l->>'kind', 'part')::public.line_kind
    from jsonb_array_elements(p_sale->'lines') with ordinality as t(l, ord);
  insert into public.payments (sale_id, line_no, method, amount, ref)
    select v_id, ord::int, (p->>'method')::public.pay_method, (p->>'amount')::bigint, coalesce(p->>'ref', '')
    from jsonb_array_elements(coalesce(p_sale->'payments', '[]')) with ordinality as t(p, ord);

  for r in
    select e.product_id, sum(e.qty)::int as qty,
      (select m->>'id' from jsonb_array_elements(coalesce(p_movements, '[]')) m where m->>'productId' = e.product_id limit 1) as mv_id
    from (select value as l from jsonb_array_elements(p_sale->'lines')) s
      cross join lateral app.expand_bundle(s.l->>'productId', (s.l->>'qty')::int) e
    where s.l->>'kind' = 'part' group by e.product_id order by e.product_id
  loop
    perform app.apply_move(coalesce(r.mv_id, gen_random_uuid()::text), r.product_id, p_location, null, r.qty, 'sale', v_id, v_staff, '', v_at);
  end loop;

  v_res := jsonb_build_object('ok', true, 'id', v_id, 'total', v_total, 'change', v_settle.change);
  return app.idem_end(p_idem, v_res);
end $$;

-- Move stock between Store and Warehouse. p_movements = the ledger rows from the app (reason 'transfer').
create or replace function public.transfer_stock(p_idem uuid, p_movements jsonb, p_client_at timestamptz default null) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_prev jsonb := app.idem_begin(p_idem, 'transfer_stock'); m record; v_at timestamptz := coalesce(p_client_at, now()); v_n int := 0;
begin
  if v_prev is not null then return v_prev; end if;
  perform app.require_role(array['owner','warehouse']);
  for m in select value as j from jsonb_array_elements(p_movements) order by value->>'productId' loop
    if m.j->>'from' is null or m.j->>'to' is null then raise exception 'A transfer needs a from and a to location' using errcode = 'BK002'; end if;
    perform app.apply_move(coalesce(m.j->>'id', gen_random_uuid()::text), m.j->>'productId', (m.j->>'from')::public.location_code,
      (m.j->>'to')::public.location_code, (m.j->>'qty')::int, 'transfer', m.j->>'refId',
      coalesce(nullif(m.j->>'staffId', ''), app.my_staff_id()), coalesce(m.j->>'note', ''), coalesce((m.j->>'createdAt')::timestamptz, v_at));
    v_n := v_n + 1;
  end loop;
  return app.idem_end(p_idem, jsonb_build_object('ok', true, 'moved', v_n));
end $$;

-- Physical count corrections. p_movements are reason 'adjustment' rows: either a "to" (found stock) or a "from" (missing stock).
create or replace function public.adjust_stock(p_idem uuid, p_movements jsonb, p_client_at timestamptz default null) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_prev jsonb := app.idem_begin(p_idem, 'adjust_stock'); m record; v_at timestamptz := coalesce(p_client_at, now()); v_n int := 0;
begin
  if v_prev is not null then return v_prev; end if;
  perform app.require_role(array['owner','warehouse']);
  for m in select value as j from jsonb_array_elements(p_movements) order by value->>'productId' loop
    if (m.j->>'from' is null) = (m.j->>'to' is null) then raise exception 'An adjustment is either stock found or stock missing' using errcode = 'BK002'; end if;
    perform app.apply_move(coalesce(m.j->>'id', gen_random_uuid()::text), m.j->>'productId', (m.j->>'from')::public.location_code,
      (m.j->>'to')::public.location_code, (m.j->>'qty')::int, 'adjustment', m.j->>'refId',
      coalesce(nullif(m.j->>'staffId', ''), app.my_staff_id()), coalesce(m.j->>'note', ''), coalesce((m.j->>'createdAt')::timestamptz, v_at),
      false, true);
    v_n := v_n + 1;
  end loop;
  return app.idem_end(p_idem, jsonb_build_object('ok', true, 'adjusted', v_n));
end $$;

-- Reorder point and bin only. Quantities never change here.
create or replace function public.update_level(p_idem uuid, p_level jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_prev jsonb := app.idem_begin(p_idem, 'update_level'); v_id text := p_level->>'id'; v_prod text; v_loc public.location_code;
begin
  if v_prev is not null then return v_prev; end if;
  perform app.require_role(array['owner','warehouse']);
  v_prod := substring(v_id from '^(.*):[A-Z]+$'); v_loc := substring(v_id from ':([A-Z]+)$')::public.location_code;
  insert into public.stock_levels (product_id, location, reorder_point, bin)
    values (v_prod, v_loc, coalesce((p_level->>'reorderPoint')::int, 0), coalesce(p_level->>'bin', ''))
  on conflict (product_id, location) do update set
    reorder_point = coalesce((p_level->>'reorderPoint')::int, public.stock_levels.reorder_point),
    bin = coalesce(p_level->>'bin', public.stock_levels.bin);
  return app.idem_end(p_idem, jsonb_build_object('ok', true));
end $$;

-- New products with opening stock (create_product and the CSV import).
create or replace function public.create_products(p_idem uuid, p_products jsonb, p_levels jsonb default '[]', p_movements jsonb default '[]',
  p_client_at timestamptz default null) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_prev jsonb := app.idem_begin(p_idem, 'create_products'); r record; v_at timestamptz := coalesce(p_client_at, now()); v_n int := 0;
begin
  if v_prev is not null then return v_prev; end if;
  perform app.require_role(array['owner','warehouse']);
  for r in select value as j from jsonb_array_elements(coalesce(p_products, '[]')) loop
    perform app.upsert_json('products', r.j); v_n := v_n + 1;
  end loop;
  for r in select value as j from jsonb_array_elements(coalesce(p_levels, '[]')) loop
    insert into public.stock_levels (product_id, location, reorder_point, bin)
      values (r.j->>'productId', (r.j->>'location')::public.location_code, coalesce((r.j->>'reorderPoint')::int, 0), coalesce(r.j->>'bin', ''))
    on conflict (product_id, location) do update set reorder_point = excluded.reorder_point, bin = excluded.bin;
  end loop;
  for r in select value as j from jsonb_array_elements(coalesce(p_movements, '[]')) loop
    perform app.apply_move(coalesce(r.j->>'id', gen_random_uuid()::text), r.j->>'productId', (r.j->>'from')::public.location_code,
      (r.j->>'to')::public.location_code, (r.j->>'qty')::int, coalesce(r.j->>'reason', 'opening')::public.movement_reason, r.j->>'refId',
      coalesce(nullif(r.j->>'staffId', ''), app.my_staff_id()), coalesce(r.j->>'note', ''), coalesce((r.j->>'createdAt')::timestamptz, v_at));
  end loop;
  return app.idem_end(p_idem, jsonb_build_object('ok', true, 'products', v_n));
end $$;

create or replace function public.create_po(p_idem uuid, p_po jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_prev jsonb := app.idem_begin(p_idem, 'create_po'); v_id text := p_po->>'id';
begin
  if v_prev is not null then return v_prev; end if;
  perform app.require_role(array['owner','warehouse']);
  insert into public.purchase_orders (id, po_no, supplier_id, status, notes, created_at, expected_date, received_date)
    values (v_id, p_po->>'poNo', p_po->>'supplierId', coalesce(p_po->>'status', 'draft')::public.po_status, coalesce(p_po->>'notes', ''),
      coalesce((p_po->>'createdAt')::timestamptz, now()), (p_po->>'expectedDate')::timestamptz, (p_po->>'receivedDate')::timestamptz)
    on conflict (id) do nothing;
  insert into public.purchase_order_items (po_id, line_no, product_id, qty, unit_cost, received_qty)
    select v_id, ord::int, i->>'productId', (i->>'qty')::int, coalesce((i->>'unitCost')::bigint, 0), coalesce((i->>'receivedQty')::int, 0)
    from jsonb_array_elements(coalesce(p_po->'items', '[]')) with ordinality as t(i, ord)
    on conflict do nothing;
  return app.idem_end(p_idem, jsonb_build_object('ok', true, 'id', v_id));
end $$;

create or replace function public.set_po_status(p_idem uuid, p_id text, p_status public.po_status) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_prev jsonb := app.idem_begin(p_idem, 'set_po_status'); v_cur public.po_status;
begin
  if v_prev is not null then return v_prev; end if;
  perform app.require_role(array['owner','warehouse']);
  if p_status not in ('sent','cancelled') then raise exception 'A PO can only be sent or cancelled here' using errcode = 'BK006'; end if;
  select status into v_cur from public.purchase_orders where id = p_id for update;
  if not found then raise exception 'PO not found' using errcode = 'BK005'; end if;
  if v_cur in ('received','cancelled') then raise exception 'This PO is already %', v_cur using errcode = 'BK004'; end if;
  update public.purchase_orders set status = p_status where id = p_id;
  return app.idem_end(p_idem, jsonb_build_object('ok', true));
end $$;

-- Receive a delivery into the Warehouse. Partial deliveries are fine. p_movements = the app's 'po_receive' ledger rows.
create or replace function public.receive_po(p_idem uuid, p_po_id text, p_movements jsonb, p_client_at timestamptz default null) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_prev jsonb := app.idem_begin(p_idem, 'receive_po'); v_at timestamptz := coalesce(p_client_at, now()); v_po public.purchase_orders;
  m record; v_line public.purchase_order_items; v_done boolean; v_on_time numeric; v_total numeric;
begin
  if v_prev is not null then return v_prev; end if;
  perform app.require_role(array['owner','warehouse']);
  select * into v_po from public.purchase_orders where id = p_po_id for update;
  if not found then raise exception 'PO not found' using errcode = 'BK005'; end if;
  if v_po.status in ('cancelled') then raise exception 'This PO was cancelled' using errcode = 'BK004'; end if;
  for m in select value as j from jsonb_array_elements(p_movements) order by value->>'productId' loop
    select * into v_line from public.purchase_order_items where po_id = p_po_id and product_id = m.j->>'productId' order by line_no limit 1 for update;
    if not found then raise exception 'Item not on this PO' using errcode = 'BK005'; end if;
    update public.purchase_order_items set received_qty = received_qty + (m.j->>'qty')::int where po_id = p_po_id and line_no = v_line.line_no;
    perform app.apply_move(coalesce(m.j->>'id', gen_random_uuid()::text), m.j->>'productId', null, 'WAREHOUSE', (m.j->>'qty')::int,
      'po_receive', p_po_id, coalesce(nullif(m.j->>'staffId', ''), app.my_staff_id()), coalesce(m.j->>'note', ''),
      coalesce((m.j->>'createdAt')::timestamptz, v_at));
    update public.products set cost = v_line.unit_cost where id = m.j->>'productId';   -- keep cost at the latest buy price
  end loop;
  select bool_and(received_qty >= qty) into v_done from public.purchase_order_items where po_id = p_po_id;
  update public.purchase_orders set status = case when coalesce(v_done, false) then 'received' else 'partial' end::public.po_status,
    received_date = case when coalesce(v_done, false) then v_at else received_date end where id = p_po_id;
  if coalesce(v_done, false) then   -- supplier reliability = share of received POs delivered on or before the expected date
    select count(*) filter (where received_date::date <= expected_date::date), count(*) into v_on_time, v_total
      from public.purchase_orders where supplier_id = v_po.supplier_id and status = 'received' and expected_date is not null and received_date is not null;
    if v_total > 0 then update public.suppliers set reliability = round(v_on_time / v_total, 2) where id = v_po.supplier_id; end if;
  end if;
  return app.idem_end(p_idem, jsonb_build_object('ok', true, 'complete', coalesce(v_done, false)));
end $$;

create or replace function public.save_estimate(p_idem uuid, p_est jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_prev jsonb := app.idem_begin(p_idem, 'save_estimate'); v_id text := p_est->>'id'; v_cur public.estimate_status;
begin
  if v_prev is not null then return v_prev; end if;
  perform app.require_role(array['owner','cashier','advisor']);
  select status into v_cur from public.work_estimates where id = v_id for update;
  if v_cur = 'converted' and coalesce(p_est->>'status', 'converted') <> 'converted' then
    raise exception 'This estimate was already converted to a job' using errcode = 'BK004';
  end if;
  insert into public.work_estimates (id, est_no, customer_id, bike_id, status, complaint, created_at)
    values (v_id, p_est->>'estNo', p_est->>'customerId', nullif(p_est->>'bikeId', ''), coalesce(p_est->>'status', 'draft')::public.estimate_status,
      coalesce(p_est->>'complaint', ''), coalesce((p_est->>'createdAt')::timestamptz, now()))
  on conflict (id) do update set customer_id = excluded.customer_id, bike_id = excluded.bike_id, status = excluded.status, complaint = excluded.complaint;
  delete from public.work_estimate_items where estimate_id = v_id;
  insert into public.work_estimate_items (id, estimate_id, line_no, kind, ref_id, name, qty, unit_price, duration_mins, short)
    select coalesce(l->>'id', gen_random_uuid()::text), v_id, ord::int, (l->>'kind')::public.line_kind, coalesce(l->>'refId', ''), coalesce(l->>'name', ''),
      (l->>'qty')::int, coalesce((l->>'unitPrice')::bigint, 0), coalesce((l->>'durationMins')::int, 0), coalesce((l->>'short')::boolean, false)
    from jsonb_array_elements(coalesce(p_est->'lines', '[]')) with ordinality as t(l, ord);
  return app.idem_end(p_idem, jsonb_build_object('ok', true, 'id', v_id));
end $$;

-- Approve an estimate and book the calendar: overlap check (exclusion constraints), reserve Store parts, mark estimate converted.
-- p_wo is the WorkOrder built on the device; the server decides which parts are short and the starting status.
create or replace function public.approve_estimate_to_job(p_idem uuid, p_wo jsonb, p_client_at timestamptz default null) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_prev jsonb := app.idem_begin(p_idem, 'approve_estimate_to_job'); v_est text := nullif(p_wo->>'estimateId', ''); v_status public.estimate_status; v_res jsonb;
begin
  if v_prev is not null then return v_prev; end if;
  perform app.require_role(array['owner','cashier','advisor']);
  if v_est is not null then
    select status into v_status from public.work_estimates where id = v_est for update;
    if not found then raise exception 'Estimate not found' using errcode = 'BK005'; end if;
    if v_status = 'converted' then raise exception 'Already converted' using errcode = 'BK004'; end if;
  end if;
  v_res := app.create_work_order(p_wo, true, coalesce(p_client_at, now()));
  if v_est is not null then update public.work_estimates set status = 'converted' where id = v_est; end if;
  return app.idem_end(p_idem, v_res);
end $$;

-- Walk-in job without an estimate. Every part must be reservable.
create or replace function public.create_job(p_idem uuid, p_wo jsonb, p_client_at timestamptz default null) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_prev jsonb := app.idem_begin(p_idem, 'create_job');
begin
  if v_prev is not null then return v_prev; end if;
  perform app.require_role(array['owner','cashier','advisor']);
  return app.idem_end(p_idem, app.create_work_order(p_wo, false, coalesce(p_client_at, now())));
end $$;

create or replace function public.reschedule_job(p_idem uuid, p_id text, p_mechanic_id text, p_bay text, p_start timestamptz, p_end timestamptz) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_prev jsonb := app.idem_begin(p_idem, 'reschedule_job');
begin
  if v_prev is not null then return v_prev; end if;
  perform app.require_role(array['owner','cashier','advisor']);
  if not p_end > p_start then raise exception 'End time must be after start time' using errcode = 'BK006'; end if;
  begin
    update public.work_orders set mechanic_id = nullif(p_mechanic_id, ''), bay = coalesce(p_bay, ''), scheduled_start = p_start, scheduled_end = p_end where id = p_id;
  exception when exclusion_violation then
    raise exception 'Time clash: that mechanic or bay is already booked for this time' using errcode = 'BK003';
  end;
  if not found then raise exception 'Job not found' using errcode = 'BK005'; end if;
  return app.idem_end(p_idem, jsonb_build_object('ok', true));
end $$;

-- Status flow, timer settlement and reservation release on cancel. Times come from the device (p_client_at), not from when it synced.
create or replace function public.set_job_status(p_idem uuid, p_id text, p_to public.job_status, p_client_at timestamptz default null) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_prev jsonb := app.idem_begin(p_idem, 'set_job_status'); w public.work_orders; v_at timestamptz := coalesce(p_client_at, now()); l record;
begin
  if v_prev is not null then return v_prev; end if;
  select * into w from public.work_orders where id = p_id for update;
  if not found then raise exception 'Job not found' using errcode = 'BK005'; end if;
  perform app.job_access(w.mechanic_id);
  if not app.job_can_move(w.status, p_to) then raise exception 'Can''t move from % to %', w.status, p_to using errcode = 'BK004'; end if;
  update public.work_orders set
    status = p_to,
    actual_start = case when p_to = 'in_repair' and actual_start is null then v_at else actual_start end,
    worked_mins = case when p_to in ('ready','quality_check') and timer_since is not null
                       then worked_mins + greatest(0, floor(extract(epoch from (v_at - timer_since)) / 60)::int) else worked_mins end,
    timer_since = case when p_to in ('ready','quality_check') then null else timer_since end,
    actual_end = case when p_to = 'ready' then v_at else actual_end end
  where id = p_id;
  if p_to = 'cancelled' then
    for l in select ref_id, qty from public.work_order_items where work_order_id = p_id and kind = 'part' and not short order by ref_id loop
      perform app.release(l.ref_id, 'STORE', l.qty);
    end loop;
  end if;
  return app.idem_end(p_idem, jsonb_build_object('ok', true, 'status', p_to));
end $$;

create or replace function public.toggle_timer(p_idem uuid, p_id text, p_client_at timestamptz default null) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_prev jsonb := app.idem_begin(p_idem, 'toggle_timer'); w public.work_orders; v_at timestamptz := coalesce(p_client_at, now());
begin
  if v_prev is not null then return v_prev; end if;
  select * into w from public.work_orders where id = p_id for update;
  if not found then return app.idem_end(p_idem, jsonb_build_object('ok', true, 'missing', true)); end if;
  perform app.job_access(w.mechanic_id);
  if w.timer_since is not null then
    update public.work_orders set timer_since = null,
      worked_mins = worked_mins + greatest(0, floor(extract(epoch from (v_at - w.timer_since)) / 60)::int) where id = p_id;
  else
    update public.work_orders set timer_since = v_at,
      status = case when status in ('scheduled','checked_in') then 'in_repair' else status end,
      actual_start = case when status in ('scheduled','checked_in') then coalesce(actual_start, v_at) else actual_start end
    where id = p_id;
  end if;
  return app.idem_end(p_idem, jsonb_build_object('ok', true));
end $$;

-- Mechanic adds a part mid-repair: reserved now. Fails if it is not available.
create or replace function public.add_job_part(p_idem uuid, p_id text, p_product_id text, p_qty int, p_item_id text default null) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_prev jsonb := app.idem_begin(p_idem, 'add_job_part'); w public.work_orders; p public.products; v_line int;
begin
  if v_prev is not null then return v_prev; end if;
  select * into w from public.work_orders where id = p_id for update;
  if not found then raise exception 'Job not found' using errcode = 'BK005'; end if;
  perform app.job_access(w.mechanic_id);
  select * into p from public.products where id = p_product_id;
  if not found then raise exception 'Product not found' using errcode = 'BK005'; end if;
  perform app.reserve(p_product_id, 'STORE', p_qty);
  select coalesce(max(line_no), 0) + 1 into v_line from public.work_order_items where work_order_id = p_id;
  insert into public.work_order_items (id, work_order_id, line_no, kind, ref_id, name, qty, unit_price, duration_mins, short)
    values (coalesce(p_item_id, gen_random_uuid()::text), p_id, v_line, 'part', p_product_id, p.name, p_qty, p.price, 0, false);
  update public.work_orders set updated_at = clock_timestamp() where id = p_id;
  return app.idem_end(p_idem, jsonb_build_object('ok', true));
end $$;

create or replace function public.update_job(p_idem uuid, p_id text, p_patch jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_prev jsonb := app.idem_begin(p_idem, 'update_job'); w public.work_orders; v_role text;
begin
  if v_prev is not null then return v_prev; end if;
  select * into w from public.work_orders where id = p_id for update;
  if not found then raise exception 'Job not found' using errcode = 'BK005'; end if;
  v_role := app.job_access(w.mechanic_id);
  update public.work_orders set
    checklist = case when p_patch ? 'checklist' then p_patch->'checklist' else checklist end,
    intake_notes = case when p_patch ? 'intakeNotes' then p_patch->>'intakeNotes' else intake_notes end,
    photos = case when p_patch ? 'photos' then p_patch->'photos' else photos end,
    complaint = case when p_patch ? 'complaint' then p_patch->>'complaint' else complaint end,
    deposit = case when p_patch ? 'deposit' and v_role <> 'mechanic' then (p_patch->>'deposit')::bigint else deposit end
  where id = p_id;
  return app.idem_end(p_idem, jsonb_build_object('ok', true));
end $$;

-- Bill a finished job. Reserved parts leave the shelf for good (ledger 'repair'); short parts are taken from available stock.
-- p_sale / p_movements are the app's outbox payload; amounts are recomputed from the job lines.
create or replace function public.complete_repair_billing(p_idem uuid, p_sale jsonb, p_movements jsonb default '[]', p_client_at timestamptz default null) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_prev jsonb := app.idem_begin(p_idem, 'complete_repair_billing'); v_sale_id text := p_sale->>'id'; v_at timestamptz := coalesce(p_client_at, now());
  w public.work_orders; r record; v_subtotal bigint; v_discount bigint := coalesce((p_sale->>'discount')::bigint, 0); v_total bigint; v_due bigint;
  v_pay jsonb := coalesce(p_sale->'payments', '[]'); v_staff text; v_settle record; v_n int;
begin
  if v_prev is not null then return v_prev; end if;
  perform app.require_role(array['owner','cashier','advisor']);
  select * into w from public.work_orders where id = p_sale->>'workOrderId' for update;
  if not found then raise exception 'Job not found' using errcode = 'BK005'; end if;
  if w.status <> 'ready' then raise exception 'Only jobs marked Ready can be billed' using errcode = 'BK004'; end if;
  v_staff := coalesce(nullif(p_sale->>'staffId', ''), app.my_staff_id());

  select coalesce(sum(qty * unit_price), 0) into v_subtotal from public.work_order_items where work_order_id = w.id;
  v_total := greatest(0, v_subtotal - v_discount);
  v_due := greatest(0, v_total - w.deposit);
  -- The app prepends the deposit as a first payment line; settle only what is paid now.
  if w.deposit > 0 and v_pay->0->>'ref' = 'Deposit' then v_pay := v_pay - 0; end if;
  select * into v_settle from app.settle(v_due, v_pay);
  if not v_settle.ok then raise exception 'Payment is short or non-cash is over the balance' using errcode = 'BK007'; end if;

  insert into public.sales (id, receipt_no, subtotal, discount, total, change, work_order_id, customer_id, staff_id, shift_id, voided, created_at)
    values (v_sale_id, p_sale->>'receiptNo', v_subtotal, v_discount, v_total, v_settle.change, w.id, w.customer_id, v_staff,
      nullif(p_sale->>'shiftId', ''), false, coalesce((p_sale->>'createdAt')::timestamptz, v_at));
  insert into public.sale_items (sale_id, line_no, product_id, name, qty, unit_price, serial, kind)
    select v_sale_id, line_no, case when kind = 'part' then ref_id end, name, qty, unit_price, '', kind from public.work_order_items where work_order_id = w.id;
  insert into public.payments (sale_id, line_no, method, amount, ref)
    select v_sale_id, ord::int, (p->>'method')::public.pay_method, (p->>'amount')::bigint, coalesce(p->>'ref', '')
    from jsonb_array_elements(coalesce(p_sale->'payments', '[]')) with ordinality as t(p, ord);

  for r in select i.ref_id, i.qty, i.short,
      (select m->>'id' from jsonb_array_elements(coalesce(p_movements, '[]')) m where m->>'productId' = i.ref_id and (m->>'qty')::int = i.qty limit 1) as mv_id
    from public.work_order_items i where i.work_order_id = w.id and i.kind = 'part' order by i.ref_id, i.line_no
  loop
    -- A movement id can only be used once, so a repeated product gets a fresh id after the first.
    perform app.apply_move(case when exists (select 1 from public.stock_movements where id = r.mv_id) then gen_random_uuid()::text else coalesce(r.mv_id, gen_random_uuid()::text) end,
      r.ref_id, 'STORE', null, r.qty, 'repair', v_sale_id, v_staff, w.job_no, v_at, not r.short, false);
  end loop;
  update public.work_orders set status = 'completed' where id = w.id;
  return app.idem_end(p_idem, jsonb_build_object('ok', true, 'id', v_sale_id, 'total', v_total, 'change', v_settle.change));
end $$;

create or replace function public.log_notification(p_idem uuid, p_row jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_prev jsonb := app.idem_begin(p_idem, 'log_notification');
begin
  if v_prev is not null then return v_prev; end if;
  perform app.require_role(array['owner','cashier','advisor']);
  insert into public.notification_logs (id, customer_id, work_order_id, channel, "trigger", body, created_at)
    values (p_row->>'id', p_row->>'customerId', nullif(p_row->>'workOrderId', ''), (p_row->>'channel')::public.channel,
      (p_row->>'trigger')::public.notify_trigger, coalesce(p_row->>'body', ''), coalesce((p_row->>'createdAt')::timestamptz, now()))
    on conflict (id) do nothing;
  return app.idem_end(p_idem, jsonb_build_object('ok', true));
end $$;

create or replace function public.open_shift(p_idem uuid, p_row jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_prev jsonb := app.idem_begin(p_idem, 'open_shift');
begin
  if v_prev is not null then return v_prev; end if;
  perform app.require_role(array['owner','cashier']);
  insert into public.shifts (id, staff_id, opened_at, closed_at, opening_cash, counted_cash)
    values (p_row->>'id', p_row->>'staffId', coalesce((p_row->>'openedAt')::timestamptz, now()), null, coalesce((p_row->>'openingCash')::bigint, 0), null)
    on conflict (id) do nothing;
  return app.idem_end(p_idem, jsonb_build_object('ok', true));
end $$;

create or replace function public.close_shift(p_idem uuid, p_id text, p_counted bigint, p_client_at timestamptz default null) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_prev jsonb := app.idem_begin(p_idem, 'close_shift');
begin
  if v_prev is not null then return v_prev; end if;
  perform app.require_role(array['owner','cashier']);
  update public.shifts set closed_at = coalesce(p_client_at, now()), counted_cash = p_counted where id = p_id;
  if not found then raise exception 'Shift not found' using errcode = 'BK005'; end if;
  return app.idem_end(p_idem, jsonb_build_object('ok', true));
end $$;

-- Catalogue edits (customers, bikes, services, suppliers, supplier prices, products, staff, settings). Partial rows are merged.
create or replace function public.upsert_row(p_idem uuid, p_table text, p_row jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_prev jsonb := app.idem_begin(p_idem, 'upsert_row'); v_roles text[];
begin
  if v_prev is not null then return v_prev; end if;
  v_roles := case
    when p_table in ('customers','customer_bikes') then array['owner','cashier','advisor']
    when p_table = 'services' then array['owner','advisor']
    when p_table in ('suppliers','supplier_products','products') then array['owner','warehouse']
    when p_table in ('staff','settings') then array['owner']
    else null end;
  if v_roles is null then raise exception 'Table % cannot be written this way', p_table using errcode = 'BK006'; end if;
  perform app.require_role(v_roles);
  perform app.upsert_json(p_table, p_row);
  return app.idem_end(p_idem, jsonb_build_object('ok', true));
end $$;

create or replace function public.delete_row(p_idem uuid, p_table text, p_id text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_prev jsonb := app.idem_begin(p_idem, 'delete_row');
begin
  if v_prev is not null then return v_prev; end if;
  if p_table <> 'supplier_products' then raise exception 'Table % cannot be deleted from this way', p_table using errcode = 'BK006'; end if;
  perform app.require_role(array['owner','warehouse']);
  delete from public.supplier_products where id = p_id;
  return app.idem_end(p_idem, jsonb_build_object('ok', true));
end $$;

-- First-time upload of a device's local catalogue and opening stock (owner only, only while the cloud has no products).
-- p_data keys: settings[], staff[], suppliers[], services[], customers[], bikes[], products[], supplierProducts[], stock[].
create or replace function public.bootstrap_import(p_idem uuid, p_data jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_prev jsonb := app.idem_begin(p_idem, 'bootstrap_import'); r record; k record; v_n int := 0;
begin
  if v_prev is not null then return v_prev; end if;
  perform app.require_role(array['owner']);
  if exists (select 1 from public.products) then raise exception 'The cloud already has products, so nothing was imported' using errcode = 'BK004'; end if;
  for k in select * from (values ('settings','settings'),('staff','staff'),('suppliers','suppliers'),('services','services'),('customers','customers'),
      ('bikes','customer_bikes'),('products','products'),('supplierProducts','supplier_products')) as t(key, tbl) loop
    for r in select value as j from jsonb_array_elements(coalesce(p_data->k.key, '[]')) loop
      perform app.upsert_json(k.tbl, r.j); v_n := v_n + 1;
    end loop;
  end loop;
  insert into public.stock_levels (product_id, location, quantity, reserved, reorder_point, bin)
    select s->>'productId', (s->>'location')::public.location_code, coalesce((s->>'quantity')::int, 0), coalesce((s->>'reserved')::int, 0),
      coalesce((s->>'reorderPoint')::int, 0), coalesce(s->>'bin', '')
    from jsonb_array_elements(coalesce(p_data->'stock', '[]')) s
    on conflict (product_id, location) do nothing;
  return app.idem_end(p_idem, jsonb_build_object('ok', true, 'rows', v_n));
end $$;

-- ---------------------------------------------------------------- privileges
revoke all on all tables in schema public from anon;
revoke all on all tables in schema public from authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
-- Ledger, money and job tables are written only by the RPCs above.
revoke insert, update, delete, truncate on public.stock_levels, public.stock_movements, public.sales, public.sale_items,
  public.payments, public.work_orders, public.work_order_items from authenticated;
revoke insert, update, delete, truncate on public.sync_log from authenticated;
-- Mechanics (and everyone else) may only edit these job fields directly; status, schedule and parts go through RPCs.
grant update (checklist, intake_notes, photos, complaint) on public.work_orders to authenticated;

grant usage on schema app to authenticated;
revoke all on all functions in schema app from public, anon, authenticated;
grant execute on function app.my_role(), app.my_staff_id() to authenticated;

do $$
declare r record;
begin
  for r in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.prokind = 'f' and p.prosecdef loop
    execute format('revoke all on function %s from public, anon', r.sig);
    execute format('grant execute on function %s to authenticated', r.sig);
  end loop;
end $$;

-- ---------------------------------------------------------------- row level security
do $$
declare t text;
begin
  foreach t in array array['staff','products','stock_levels','stock_movements','suppliers','supplier_products','purchase_orders','purchase_order_items',
    'customers','customer_bikes','services','work_estimates','work_estimate_items','work_orders','work_order_items','sales','sale_items','payments',
    'shifts','notification_logs','settings','sync_log'] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

create or replace procedure app.pol(p_table text, p_name text, p_cmd text, p_roles text[], p_expr text default 'true')
language plpgsql as $$
declare v_cond text := format('app.my_role()::text = any (%L::text[]) and (%s)', p_roles, p_expr);
begin
  execute format('drop policy if exists %I on public.%I', p_name, p_table);
  if p_cmd = 'insert' then
    execute format('create policy %I on public.%I for insert to authenticated with check (%s)', p_name, p_table, v_cond);
  elsif p_cmd in ('update', 'all') then
    execute format('create policy %I on public.%I for %s to authenticated using (%s) with check (%s)', p_name, p_table, p_cmd, v_cond, v_cond);
  else
    execute format('create policy %I on public.%I for %s to authenticated using (%s)', p_name, p_table, p_cmd, v_cond);
  end if;
end $$;

do $$
declare t text;
begin
  -- Owner: everything (ledger tables are still RPC-only because their write privileges are revoked).
  foreach t in array array['staff','products','stock_levels','stock_movements','suppliers','supplier_products','purchase_orders','purchase_order_items',
    'customers','customer_bikes','services','work_estimates','work_estimate_items','work_orders','work_order_items','sales','sale_items','payments',
    'shifts','notification_logs','settings','sync_log'] loop
    call app.pol(t, 'owner_all', 'all', array['owner']);
  end loop;
end $$;

-- Reference data everyone signed in can read.
call app.pol('staff', 'staff_read', 'select', array['cashier','advisor','mechanic','warehouse']);
call app.pol('settings', 'settings_read', 'select', array['cashier','advisor','mechanic','warehouse']);
call app.pol('services', 'services_read', 'select', array['cashier','advisor','mechanic','warehouse']);
call app.pol('products', 'products_read', 'select', array['cashier','advisor','mechanic','warehouse']);
call app.pol('stock_levels', 'stock_levels_read', 'select', array['cashier','advisor','mechanic','warehouse']);
call app.pol('stock_movements', 'stock_movements_read', 'select', array['cashier','advisor','warehouse']);
-- Warehouse: catalogue of parts, suppliers and purchase orders.
call app.pol('products', 'products_warehouse_write', 'insert', array['warehouse']);
call app.pol('products', 'products_warehouse_update', 'update', array['warehouse']);
call app.pol('suppliers', 'suppliers_warehouse', 'all', array['warehouse']);
call app.pol('supplier_products', 'supplier_products_warehouse', 'all', array['warehouse']);
call app.pol('purchase_orders', 'purchase_orders_warehouse', 'all', array['warehouse']);
call app.pol('purchase_order_items', 'purchase_order_items_warehouse', 'all', array['warehouse']);

-- Cashier and advisor: customers, bikes, estimates, jobs, sales, notifications.
call app.pol('customers', 'customers_front_read', 'select', array['cashier','advisor']);
call app.pol('customers', 'customers_front_insert', 'insert', array['cashier','advisor']);
call app.pol('customers', 'customers_front_update', 'update', array['cashier','advisor']);
call app.pol('customer_bikes', 'bikes_front_read', 'select', array['cashier','advisor']);
call app.pol('customer_bikes', 'bikes_front_insert', 'insert', array['cashier','advisor']);
call app.pol('customer_bikes', 'bikes_front_update', 'update', array['cashier','advisor']);
call app.pol('work_estimates', 'estimates_front_read', 'select', array['cashier','advisor']);
call app.pol('work_estimates', 'estimates_front_insert', 'insert', array['cashier','advisor']);
call app.pol('work_estimates', 'estimates_front_update', 'update', array['cashier','advisor']);
call app.pol('work_estimate_items', 'estimate_items_front_all', 'all', array['cashier','advisor']);
call app.pol('work_orders', 'jobs_front_read', 'select', array['cashier','advisor']);
call app.pol('work_orders', 'jobs_front_update', 'update', array['cashier','advisor']);
call app.pol('work_order_items', 'job_items_front_read', 'select', array['cashier','advisor']);
call app.pol('sales', 'sales_front_read', 'select', array['cashier','advisor']);
call app.pol('sale_items', 'sale_items_front_read', 'select', array['cashier','advisor']);
call app.pol('payments', 'payments_front_read', 'select', array['cashier','advisor']);
call app.pol('shifts', 'shifts_cashier_read', 'select', array['cashier','advisor'], 'staff_id = app.my_staff_id()');
call app.pol('shifts', 'shifts_cashier_insert', 'insert', array['cashier'], 'staff_id = app.my_staff_id()');
call app.pol('shifts', 'shifts_cashier_update', 'update', array['cashier'], 'staff_id = app.my_staff_id()');
call app.pol('notification_logs', 'notifications_front_read', 'select', array['cashier','advisor']);
call app.pol('notification_logs', 'notifications_front_insert', 'insert', array['cashier','advisor']);

-- Mechanic: reads and updates only jobs assigned to them, plus the customer and bike on those jobs.
call app.pol('work_orders', 'jobs_mechanic_read', 'select', array['mechanic'], 'mechanic_id = app.my_staff_id()');
call app.pol('work_orders', 'jobs_mechanic_update', 'update', array['mechanic'], 'mechanic_id = app.my_staff_id()');
call app.pol('work_order_items', 'job_items_mechanic_read', 'select', array['mechanic'],
  'exists (select 1 from public.work_orders w where w.id = work_order_items.work_order_id and w.mechanic_id = app.my_staff_id())');
call app.pol('customers', 'customers_mechanic_read', 'select', array['mechanic'],
  'exists (select 1 from public.work_orders w where w.customer_id = customers.id and w.mechanic_id = app.my_staff_id())');
call app.pol('customer_bikes', 'bikes_mechanic_read', 'select', array['mechanic'],
  'exists (select 1 from public.work_orders w where w.customer_id = customer_bikes.customer_id and w.mechanic_id = app.my_staff_id())');

-- ---------------------------------------------------------------- realtime
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then create publication supabase_realtime; end if;
  begin alter publication supabase_realtime add table public.stock_levels; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.work_orders; exception when duplicate_object then null; end;
end $$;
