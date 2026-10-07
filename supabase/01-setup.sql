-- =====================================================================
--  即美創畫攝影 GIME STUDIO • PHOTO × AI
--  Supabase 資料庫完整設定腳本（可重複執行）
--
--  使用方式：Supabase 後台 → SQL Editor → New query → 貼上本檔全部內容 → Run
--
--  ⚠ 注意：本腳本會移除舊版（美攝影 P8-3B）的測試用 customers 資料表，
--    以新的正式架構重建。profiles（管理員角色）會保留。
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 0. 清除舊版測試資料表（只在舊結構存在時執行）
-- ---------------------------------------------------------------------
do $$
begin
  -- 舊版 customers 以 auth 使用者 UUID 當主鍵、沒有 phone_norm 欄位；偵測到就移除
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='customers')
     and not exists (select 1 from information_schema.columns where table_schema='public' and table_name='customers' and column_name='phone_norm') then
    execute 'drop table public.customers cascade';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1. 共用工具函式
-- ---------------------------------------------------------------------
create or replace function public.tw_today() returns date
language sql stable as $$ select (now() at time zone 'Asia/Taipei')::date $$;

create or replace function public.norm_phone(p text) returns text
language sql immutable as $$ select nullif(regexp_replace(coalesce(p,''), '\D', '', 'g'), '') $$;

create or replace function public.norm_email(p text) returns text
language sql immutable as $$ select nullif(lower(trim(coalesce(p,''))), '') $$;

-- 產生好讀的編號，例如 GS260924-7KQ3
create or replace function public.gen_code(prefix text) returns text
language plpgsql volatile as $$
declare
  alphabet text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  s text := '';
  i int;
begin
  for i in 1..4 loop
    s := s || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  end loop;
  return prefix || to_char(now() at time zone 'Asia/Taipei', 'YYMMDD') || '-' || s;
end $$;

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at := now(); return new; end $$;

-- ---------------------------------------------------------------------
-- 2. 角色：profiles（沿用舊表，不存在才建立）
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now()
);
alter table public.profiles add column if not exists created_at timestamptz not null default now();
alter table public.profiles enable row level security;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
$$;

drop policy if exists "profiles self read" on public.profiles;
create policy "profiles self read" on public.profiles for select using (id = auth.uid() or public.is_admin());
drop policy if exists "profiles admin all" on public.profiles;
create policy "profiles admin all" on public.profiles for all using (public.is_admin()) with check (public.is_admin());

-- 新註冊帳號自動建立 member 角色
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, role) values (new.id, 'member') on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- 3. 網站內容：設定 / 分類 / 作品集 / 服務 / 公休日
-- ---------------------------------------------------------------------
create table if not exists public.settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  is_public boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.categories (
  slug text primary key,
  name text not null,
  sort int not null default 0
);

create table if not exists public.portfolio (
  id uuid primary key default gen_random_uuid(),
  category text references public.categories(slug) on update cascade on delete set null,
  title text not null default '',
  description text not null default '',
  images text[] not null default '{}',     -- 第一張為封面；可為完整網址或 storage 路徑
  featured boolean not null default false,  -- 顯示在首頁精選
  published boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists portfolio_cat_idx on public.portfolio (category, sort);

create table if not exists public.services (
  id text primary key,
  name text not null,
  subtitle text not null default '',
  description text not null default '',
  price int not null default 0,
  price_note text not null default '',        -- 例如「起」、「／2 小時」
  duration_label text not null default '',
  features text[] not null default '{}',
  image text not null default '',
  featured boolean not null default false,
  bookable boolean not null default true,     -- 可線上預約
  active boolean not null default true,
  sort int not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.blocked_dates (
  date date primary key,
  reason text not null default ''
);

-- ---------------------------------------------------------------------
-- 4. 營運資料：客戶 / 預約 / 訂單 / 相簿 / 照片
-- ---------------------------------------------------------------------
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  name text not null,
  phone text not null default '',
  phone_norm text generated always as (public.norm_phone(phone)) stored,
  email text,
  email_norm text generated always as (public.norm_email(email)) stored,
  line_id text,                 -- 客戶填寫的 LINE ID（顯示用）
  line_user_id text,            -- 透過官方帳號綁定後取得，可推播
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists customers_phone_uq on public.customers (phone_norm) where phone_norm is not null;
create unique index if not exists customers_email_uq on public.customers (email_norm) where email_norm is not null;

create table if not exists public.bookings (
  id text primary key,
  customer_id uuid references public.customers(id) on delete set null,
  service_id text references public.services(id) on update cascade on delete set null,
  service_name text not null,
  date date not null,
  time text not null,
  status text not null default '已預約' check (status in ('已預約','已完成','已取消')),
  name text not null,
  phone text not null,
  contact_method text not null default 'email' check (contact_method in ('email','line')),
  email text,
  line_id text,
  note text not null default '',
  source text not null default 'web',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- 資料庫層級保證：同日期同時段只能有一筆有效預約
create unique index if not exists bookings_slot_uq on public.bookings (date, time) where status <> '已取消';
create index if not exists bookings_date_idx on public.bookings (date);

create table if not exists public.orders (
  id text primary key,
  booking_id text unique references public.bookings(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  customer_name text not null,
  phone text not null default '',
  service_id text,
  service_name text not null,
  date date,
  time text,
  amount int not null default 0,
  paid_amount int not null default 0,
  payment_method text not null default '',   -- 預留金流：現金 / 轉帳 / 信用卡 / LINE Pay ...
  payment_ref text not null default '',
  paid_at timestamptz,
  status text not null default '待付款'
    check (status in ('待付款','已付款','已預約','拍攝完成','待選片','客戶已選片','修圖中','已完成','已取消')),
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists orders_status_idx on public.orders (status);
create index if not exists orders_customer_idx on public.orders (customer_id);

create table if not exists public.albums (
  id uuid primary key default gen_random_uuid(),
  order_id text not null unique references public.orders(id) on delete cascade,
  title text not null default '',
  max_select int not null default 0,          -- 0 = 不限張數
  message text not null default '',
  selection_confirmed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  album_id uuid not null references public.albums(id) on delete cascade,
  path text not null,            -- 選片用預覽圖（storage 路徑或網址）
  final_path text,               -- 修圖完成的交件檔
  filename text not null default '',
  selected boolean not null default false,
  retouch_status text not null default '未修圖' check (retouch_status in ('未修圖','修圖中','已完成')),
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists photos_album_idx on public.photos (album_id, sort);

-- ---------------------------------------------------------------------
-- 5. 通知佇列 / 稽核紀錄
-- ---------------------------------------------------------------------
create table if not exists public.notifications (
  id bigserial primary key,
  event text not null,
  ref_id text not null,                       -- 用於去重的事件參考編號
  channel text not null check (channel in ('email','line')),
  audience text not null check (audience in ('customer','studio')),
  customer_id uuid references public.customers(id) on delete set null,
  order_id text,
  booking_id text,
  payload jsonb not null default '{}'::jsonb,
  recipient text not null default '',
  subject text not null default '',
  body text not null default '',
  status text not null default 'queued' check (status in ('queued','sending','sent','failed','skipped')),
  error text not null default '',
  attempts int not null default 0,
  processed boolean not null default false,   -- 後台人員「已處理」
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  claimed_at timestamptz,
  unique (event, ref_id, channel, audience)
);
alter table public.notifications add column if not exists claimed_at timestamptz;
create index if not exists notifications_status_idx on public.notifications (status, created_at);

create table if not exists public.audit_logs (
  id bigserial primary key,
  actor uuid,
  actor_email text,
  action text not null,
  entity text not null,
  entity_id text,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);

-- updated_at 觸發器
drop trigger if exists t_customers_touch on public.customers;
create trigger t_customers_touch before update on public.customers for each row execute function public.touch_updated_at();
drop trigger if exists t_bookings_touch on public.bookings;
create trigger t_bookings_touch before update on public.bookings for each row execute function public.touch_updated_at();
drop trigger if exists t_orders_touch on public.orders;
create trigger t_orders_touch before update on public.orders for each row execute function public.touch_updated_at();
drop trigger if exists t_services_touch on public.services;
create trigger t_services_touch before update on public.services for each row execute function public.touch_updated_at();
drop trigger if exists t_settings_touch on public.settings;
create trigger t_settings_touch before update on public.settings for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- 6. 稽核紀錄觸發器（記錄誰改了什麼、改前改後）
-- ---------------------------------------------------------------------
create or replace function public.audit_row() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_email text;
  v_id text;
begin
  begin
    v_email := nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email';
  exception when others then v_email := null;
  end;
  if tg_op = 'DELETE' then
    v_id := coalesce(to_jsonb(old) ->> 'id', to_jsonb(old) ->> 'key', to_jsonb(old) ->> 'slug', to_jsonb(old) ->> 'date');
    insert into public.audit_logs (actor, actor_email, action, entity, entity_id, before, after)
    values (auth.uid(), v_email, 'delete', tg_table_name, v_id, to_jsonb(old), null);
    return old;
  elsif tg_op = 'UPDATE' then
    if to_jsonb(old) - 'updated_at' = to_jsonb(new) - 'updated_at' then return new; end if;
    v_id := coalesce(to_jsonb(new) ->> 'id', to_jsonb(new) ->> 'key', to_jsonb(new) ->> 'slug', to_jsonb(new) ->> 'date');
    insert into public.audit_logs (actor, actor_email, action, entity, entity_id, before, after)
    values (auth.uid(), v_email, 'update', tg_table_name, v_id, to_jsonb(old), to_jsonb(new));
    return new;
  else
    v_id := coalesce(to_jsonb(new) ->> 'id', to_jsonb(new) ->> 'key', to_jsonb(new) ->> 'slug', to_jsonb(new) ->> 'date');
    insert into public.audit_logs (actor, actor_email, action, entity, entity_id, before, after)
    values (auth.uid(), v_email, 'insert', tg_table_name, v_id, null, to_jsonb(new));
    return new;
  end if;
end $$;

do $$
declare t text;
begin
  foreach t in array array['customers','bookings','orders','services','portfolio','settings','categories','blocked_dates'] loop
    execute format('drop trigger if exists t_%1$s_audit on public.%1$I', t);
    execute format('create trigger t_%1$s_audit after update or delete on public.%1$I for each row execute function public.audit_row()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 7. 通知：事件 → 自動排入佇列
-- ---------------------------------------------------------------------
create or replace function public.enqueue_notification(
  p_event text, p_ref text, p_customer uuid, p_order text, p_booking text, p_payload jsonb, p_audiences text[]
) returns void
language plpgsql security definer set search_path = public as $$
declare
  a text; c text;
  v_enabled jsonb;
begin
  select value -> 'enabled' into v_enabled from public.settings where key = 'notify';
  if v_enabled is not null and coalesce((v_enabled ->> p_event)::boolean, true) = false then
    return;
  end if;
  foreach a in array p_audiences loop
    foreach c in array array['email','line'] loop
      insert into public.notifications (event, ref_id, channel, audience, customer_id, order_id, booking_id, payload)
      values (p_event, p_ref, c, a, p_customer, p_order, p_booking, coalesce(p_payload, '{}'::jsonb))
      on conflict (event, ref_id, channel, audience) do nothing;
    end loop;
  end loop;
end $$;

create or replace function public.booking_payload(b public.bookings) returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'name', b.name, 'phone', b.phone, 'booking_id', b.id, 'service', b.service_name,
    'date', to_char(b.date, 'YYYY-MM-DD'), 'time', b.time, 'note', b.note,
    'order_id', (select o.id from public.orders o where o.booking_id = b.id),
    'amount', (select o.amount from public.orders o where o.booking_id = b.id)
  )
$$;

create or replace function public.on_booking_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- 改期：同步訂單日期時間
  if tg_op = 'UPDATE' and (new.date is distinct from old.date or new.time is distinct from old.time) then
    update public.orders set date = new.date, time = new.time where booking_id = new.id;
  end if;
  if tg_op = 'UPDATE' and new.status = '已取消' and old.status <> '已取消' then
    -- 取消預約：同步取消訂單並釋放時段（時段由唯一索引自動釋放）
    update public.orders set status = '已取消'
      where booking_id = new.id and status not in ('已取消','已完成');
    perform public.enqueue_notification('booking_cancelled', new.id, new.customer_id,
      (select id from public.orders where booking_id = new.id), new.id,
      public.booking_payload(new), array['customer','studio']);
  end if;
  return new;
end $$;
drop trigger if exists t_booking_change on public.bookings;
create trigger t_booking_change after update on public.bookings for each row execute function public.on_booking_change();

create or replace function public.before_order_update() returns trigger
language plpgsql as $$
begin
  if new.status is distinct from old.status and new.status = '已付款' and new.paid_at is null then
    new.paid_at := now();
  end if;
  return new;
end $$;

create or replace function public.on_order_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_payload jsonb;
  v_event text;
  v_aud text[] := array['customer'];
begin
  if tg_op = 'INSERT' then
    v_payload := jsonb_build_object('name', new.customer_name, 'phone', new.phone, 'order_id', new.id,
      'booking_id', new.booking_id, 'service', new.service_name, 'date', to_char(new.date,'YYYY-MM-DD'),
      'time', new.time, 'amount', new.amount,
      'note', coalesce((select note from public.bookings where id = new.booking_id), ''));
    perform public.enqueue_notification('booking_created', new.id, new.customer_id, new.id, new.booking_id,
      v_payload, array['customer','studio']);
    return new;
  end if;

  if new.status is distinct from old.status then
    -- 訂單取消 → 同步取消預約（釋放時段）
    if new.status = '已取消' and new.booking_id is not null then
      update public.bookings set status = '已取消' where id = new.booking_id and status <> '已取消';
    end if;
    -- 拍攝完成 / 已完成 → 預約標記完成
    if new.status in ('拍攝完成','待選片','客戶已選片','修圖中','已完成') and new.booking_id is not null then
      update public.bookings set status = '已完成' where id = new.booking_id and status = '已預約';
    end if;

    v_event := case new.status
      when '已付款' then 'payment_received'
      when '待選片' then 'album_ready'
      when '客戶已選片' then 'selection_done'
      when '修圖中' then 'retouch_started'
      when '已完成' then 'delivered'
      else null end;
    if new.status = '客戶已選片' then v_aud := array['customer','studio']; end if;

    if v_event is not null then
      v_payload := jsonb_build_object('name', new.customer_name, 'phone', new.phone, 'order_id', new.id,
        'booking_id', new.booking_id, 'service', new.service_name, 'date', to_char(new.date,'YYYY-MM-DD'),
        'time', new.time, 'amount', new.amount,
        'selected_count', (select count(*) from public.photos p join public.albums al on al.id = p.album_id
                           where al.order_id = new.id and p.selected));
      perform public.enqueue_notification(v_event, new.id, new.customer_id, new.id, new.booking_id, v_payload, v_aud);
    end if;
  end if;
  return new;
end $$;
drop trigger if exists t_order_insert on public.orders;
create trigger t_order_insert after insert on public.orders for each row execute function public.on_order_change();
drop trigger if exists t_order_before_update on public.orders;
create trigger t_order_before_update before update on public.orders for each row execute function public.before_order_update();
drop trigger if exists t_order_update on public.orders;
create trigger t_order_update after update on public.orders for each row execute function public.on_order_change();

-- 每日自動：明天拍攝的提醒（由 02-automation.sql 排程每天執行）
create or replace function public.enqueue_tomorrow_reminders() returns int
language plpgsql security definer set search_path = public as $$
declare b public.bookings; n int := 0;
begin
  for b in select * from public.bookings where date = public.tw_today() + 1 and status = '已預約' loop
    perform public.enqueue_notification('shoot_reminder', b.id || '@' || b.date, b.customer_id,
      (select id from public.orders where booking_id = b.id), b.id, public.booking_payload(b), array['customer']);
    n := n + 1;
  end loop;
  return n;
end $$;

-- 寄送程式（Edge Function）使用：一次領取一批待寄通知，避免重複寄送
create or replace function public.claim_notifications(p_limit int default 30)
returns setof public.notifications
language plpgsql security definer set search_path = public as $$
begin
  return query
  update public.notifications n set status = 'sending', attempts = n.attempts + 1, claimed_at = now()
  where n.id in (
    select id from public.notifications
    where (status = 'queued'
           or (status in ('failed','sending') and attempts < 3 and created_at > now() - interval '2 days'
               and (status = 'failed' or claimed_at < now() - interval '10 minutes')))
    order by id
    limit p_limit
    for update skip locked
  )
  returning n.*;
end $$;
revoke all on function public.claim_notifications(int) from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on function public.claim_notifications(int) to service_role';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 8. 前台公開 API（RPC）
-- ---------------------------------------------------------------------

-- 查詢已被預約的時段（不含個資）
create or replace function public.get_booked_slots(p_from date, p_to date)
returns table (date date, "time" text)
language sql stable security definer set search_path = public as $$
  select b.date, b.time from public.bookings b
  where b.date between p_from and p_to and b.status <> '已取消'
$$;

-- 建立預約（自動建檔客戶、建立訂單、排入通知）
create or replace function public.create_booking(
  p_service_id text, p_date date, p_time text, p_name text, p_phone text,
  p_contact_method text, p_email text, p_line_id text, p_note text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_service public.services;
  v_cfg jsonb;
  v_slots jsonb;
  v_customer public.customers;
  v_booking_id text;
  v_order_id text;
  v_phone text := public.norm_phone(p_phone);
  v_email text := public.norm_email(p_email);
  v_try int := 0;
begin
  -- 基本驗證
  if coalesce(trim(p_name), '') = '' or length(p_name) > 40 then raise exception '請填寫姓名（40 字以內）'; end if;
  if v_phone is null or length(v_phone) < 8 or length(v_phone) > 15 then raise exception '請填寫正確的電話號碼'; end if;
  if p_contact_method not in ('email','line') then raise exception '聯絡方式錯誤'; end if;
  if p_contact_method = 'email' and (v_email is null or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') then raise exception '請填寫正確的 Email'; end if;
  if p_contact_method = 'line' and coalesce(trim(p_line_id), '') = '' then raise exception '請填寫 LINE ID'; end if;
  if length(coalesce(p_note, '')) > 500 then raise exception '備註請在 500 字以內'; end if;

  select * into v_service from public.services where id = p_service_id and ((active and bookable) or public.is_admin());
  if not found then raise exception '此服務目前無法線上預約'; end if;

  select value into v_cfg from public.settings where key = 'booking';
  v_slots := coalesce(v_cfg -> 'slots', '["10:00","11:00","13:00","14:00","15:00","16:00","17:00"]'::jsonb);
  if public.is_admin() then
    -- 管理員代客預約：允許任何時段格式 HH:MM 與今天以後的日期
    if p_time !~ '^\d{2}:\d{2}$' then raise exception '時間格式錯誤'; end if;
    if p_date < public.tw_today() then raise exception '不能預約過去的日期'; end if;
  else
    if not (v_slots ? p_time) then raise exception '此時段不開放預約'; end if;
    if p_date <= public.tw_today() then raise exception '請選擇明天以後的日期'; end if;
    if p_date > public.tw_today() + coalesce((v_cfg ->> 'max_days_ahead')::int, 90) then raise exception '超過可預約的日期範圍'; end if;
    if coalesce(v_cfg -> 'closed_weekdays', '[]'::jsonb) @> to_jsonb(extract(dow from p_date)::int) then raise exception '當天為公休日'; end if;
    if exists (select 1 from public.blocked_dates where date = p_date) then raise exception '當天為公休日'; end if;
    -- 防濫用：同一支電話最多 3 筆未來有效預約
    if (select count(*) from public.bookings where public.norm_phone(phone) = v_phone and status = '已預約' and date >= public.tw_today()) >= 3 then
      raise exception '此電話已有 3 筆以上的有效預約，如需再預約請直接與工作室聯繫';
    end if;
  end if;

  -- 找出既有客戶：登入會員 → 電話 → Email
  if auth.uid() is not null then
    select * into v_customer from public.customers where auth_user_id = auth.uid();
  end if;
  if v_customer.id is null then
    select * into v_customer from public.customers where phone_norm = v_phone;
  end if;
  if v_customer.id is null and v_email is not null then
    select * into v_customer from public.customers where email_norm = v_email;
  end if;
  if v_customer.id is null then
    insert into public.customers (name, phone, email, line_id)
    values (trim(p_name), trim(p_phone),
            case when v_email is not null and not exists (select 1 from public.customers where email_norm = v_email) then trim(p_email) end,
            nullif(trim(coalesce(p_line_id,'')), ''))
    returning * into v_customer;
  else
    update public.customers set
      email = coalesce(email, case when v_email is not null and not exists (select 1 from public.customers where email_norm = v_email) then trim(p_email) end),
      line_id = coalesce(nullif(trim(coalesce(p_line_id,'')), ''), line_id)
    where id = v_customer.id;
  end if;

  -- 建立預約（唯一索引保證同時段不重複）
  loop
    begin
      v_booking_id := public.gen_code('GS');
      insert into public.bookings (id, customer_id, service_id, service_name, date, time, name, phone, contact_method, email, line_id, note, source)
      values (v_booking_id, v_customer.id, v_service.id, v_service.name, p_date, p_time, trim(p_name), trim(p_phone),
              p_contact_method, nullif(trim(coalesce(p_email,'')), ''), nullif(trim(coalesce(p_line_id,'')), ''), coalesce(p_note, ''),
              case when public.is_admin() then 'admin' else 'web' end);
      exit;
    exception when unique_violation then
      if exists (select 1 from public.bookings where date = p_date and time = p_time and status <> '已取消') then
        raise exception '很抱歉，此時段剛剛已被預約，請選擇其他時段';
      end if;
      v_try := v_try + 1;
      if v_try > 5 then raise; end if;
    end;
  end loop;

  v_try := 0;
  loop
    begin
      v_order_id := public.gen_code('OD');
      insert into public.orders (id, booking_id, customer_id, customer_name, phone, service_id, service_name, date, time, amount)
      values (v_order_id, v_booking_id, v_customer.id, trim(p_name), trim(p_phone), v_service.id, v_service.name, p_date, p_time, v_service.price);
      exit;
    exception when unique_violation then
      v_try := v_try + 1;
      if v_try > 5 then raise; end if;
    end;
  end loop;

  return jsonb_build_object('booking_id', v_booking_id, 'order_id', v_order_id, 'service', v_service.name,
    'date', p_date, 'time', p_time, 'amount', v_service.price, 'name', trim(p_name));
end $$;

-- 選片：驗證訂單編號＋電話（或登入會員本人）
create or replace function public.gallery_auth(p_order_id text, p_phone text)
returns public.orders
language plpgsql stable security definer set search_path = public as $$
declare o public.orders; c public.customers;
begin
  select * into o from public.orders where id = upper(trim(p_order_id));
  if not found then raise exception '查無此訂單，請確認訂單編號與電話'; end if;
  select * into c from public.customers where id = o.customer_id;
  if (public.norm_phone(p_phone) is not null and (public.norm_phone(p_phone) = public.norm_phone(o.phone) or public.norm_phone(p_phone) = c.phone_norm))
     or (auth.uid() is not null and c.auth_user_id = auth.uid())
     or public.is_admin() then
    return o;
  end if;
  raise exception '查無此訂單，請確認訂單編號與電話';
end $$;

create or replace function public.gallery_get(p_order_id text, p_phone text)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare o public.orders; al public.albums;
begin
  o := public.gallery_auth(p_order_id, p_phone);
  select * into al from public.albums where order_id = o.id;
  return jsonb_build_object(
    'order', jsonb_build_object('id', o.id, 'status', o.status, 'service', o.service_name, 'date', o.date, 'time', o.time, 'name', o.customer_name),
    'album', case when al.id is null then null else jsonb_build_object('id', al.id, 'title', al.title, 'max_select', al.max_select,
             'message', al.message, 'confirmed_at', al.selection_confirmed_at) end,
    'photos', coalesce((select jsonb_agg(jsonb_build_object(
                'id', p.id, 'path', p.path, 'filename', p.filename, 'selected', p.selected, 'retouch_status', p.retouch_status,
                'final_path', case when o.status = '已完成' then p.final_path end) order by p.sort, p.created_at)
              from public.photos p where p.album_id = al.id), '[]'::jsonb)
  );
end $$;

create or replace function public.gallery_toggle(p_order_id text, p_phone text, p_photo_id uuid, p_selected boolean)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare o public.orders; al public.albums; v_count int;
begin
  o := public.gallery_auth(p_order_id, p_phone);
  if o.status <> '待選片' then raise exception '目前不在選片階段，如需調整請聯繫工作室'; end if;
  select * into al from public.albums where order_id = o.id;
  if al.id is null then raise exception '相簿尚未建立'; end if;
  if p_selected and al.max_select > 0 then
    select count(*) into v_count from public.photos where album_id = al.id and selected and id <> p_photo_id;
    if v_count >= al.max_select then raise exception '已達可選張數上限（% 張）', al.max_select; end if;
  end if;
  update public.photos set selected = p_selected where id = p_photo_id and album_id = al.id;
  return public.gallery_get(p_order_id, p_phone);
end $$;

create or replace function public.gallery_confirm(p_order_id text, p_phone text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare o public.orders; al public.albums;
begin
  o := public.gallery_auth(p_order_id, p_phone);
  if o.status <> '待選片' then raise exception '目前不在選片階段'; end if;
  select * into al from public.albums where order_id = o.id;
  if not exists (select 1 from public.photos where album_id = al.id and selected) then raise exception '請至少選擇一張照片'; end if;
  update public.albums set selection_confirmed_at = now() where id = al.id;
  update public.orders set status = '客戶已選片' where id = o.id;
  return public.gallery_get(p_order_id, p_phone);
end $$;

-- 會員：登入後連結（或建立）客戶資料
create or replace function public.member_link(p_name text, p_phone text)
returns public.customers
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  c public.customers;
begin
  if v_uid is null then raise exception '請先登入'; end if;
  select * into c from public.customers where auth_user_id = v_uid;
  if found then return c; end if;

  select public.norm_email(email) into v_email from auth.users where id = v_uid;

  select * into c from public.customers where email_norm = v_email and auth_user_id is null;
  if c.id is null and public.norm_phone(p_phone) is not null then
    select * into c from public.customers where phone_norm = public.norm_phone(p_phone);
    if c.id is not null and (c.auth_user_id is not null or (c.email_norm is not null and c.email_norm <> v_email)) then
      raise exception '此電話已綁定其他帳號，請聯繫工作室協助處理';
    end if;
  end if;

  if c.id is not null then
    update public.customers set auth_user_id = v_uid,
      email = coalesce(email, v_email),
      name = case when coalesce(trim(name),'') = '' then coalesce(nullif(trim(p_name),''), name) else name end
    where id = c.id returning * into c;
    return c;
  end if;

  if coalesce(trim(p_name),'') = '' then raise exception '請填寫姓名'; end if;
  insert into public.customers (auth_user_id, name, phone, email)
  values (v_uid, trim(p_name), coalesce(trim(p_phone), ''), v_email)
  returning * into c;
  return c;
end $$;

-- 會員：修改自己的基本資料（電話不可與他人重複）
create or replace function public.member_update_profile(p_name text, p_phone text, p_line_id text)
returns public.customers
language plpgsql security definer set search_path = public as $$
declare c public.customers; v_phone text := public.norm_phone(p_phone);
begin
  select * into c from public.customers where auth_user_id = auth.uid();
  if not found then raise exception '找不到您的會員資料'; end if;
  if coalesce(trim(p_name),'') = '' or length(p_name) > 40 then raise exception '請填寫姓名（40 字以內）'; end if;
  if v_phone is null or length(v_phone) < 8 or length(v_phone) > 15 then raise exception '請填寫正確的電話號碼'; end if;
  if exists (select 1 from public.customers where phone_norm = v_phone and id <> c.id) then
    raise exception '此電話已被其他帳號使用';
  end if;
  update public.customers set name = trim(p_name), phone = trim(p_phone), line_id = nullif(trim(coalesce(p_line_id,'')), '')
  where id = c.id returning * into c;
  return c;
end $$;

grant execute on function public.get_booked_slots(date, date) to anon, authenticated;
grant execute on function public.create_booking(text, date, text, text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.gallery_get(text, text) to anon, authenticated;
grant execute on function public.gallery_toggle(text, text, uuid, boolean) to anon, authenticated;
grant execute on function public.gallery_confirm(text, text) to anon, authenticated;
grant execute on function public.member_link(text, text) to authenticated;
grant execute on function public.member_update_profile(text, text, text) to authenticated;
revoke all on function public.gallery_auth(text, text) from public, anon, authenticated;
revoke all on function public.enqueue_notification(text, text, uuid, text, text, jsonb, text[]) from public, anon, authenticated;
revoke all on function public.enqueue_tomorrow_reminders() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 9. 資料列安全（RLS）
-- ---------------------------------------------------------------------
alter table public.settings enable row level security;
alter table public.categories enable row level security;
alter table public.portfolio enable row level security;
alter table public.services enable row level security;
alter table public.blocked_dates enable row level security;
alter table public.customers enable row level security;
alter table public.bookings enable row level security;
alter table public.orders enable row level security;
alter table public.albums enable row level security;
alter table public.photos enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;

do $$
declare t text;
begin
  foreach t in array array['settings','categories','portfolio','services','blocked_dates','customers','bookings','orders','albums','photos','notifications','audit_logs'] loop
    execute format('drop policy if exists "admin all" on public.%I', t);
    execute format('create policy "admin all" on public.%I for all using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

-- 公開讀取：網站內容
drop policy if exists "public read" on public.settings;
create policy "public read" on public.settings for select using (is_public);
drop policy if exists "public read" on public.categories;
create policy "public read" on public.categories for select using (true);
drop policy if exists "public read" on public.portfolio;
create policy "public read" on public.portfolio for select using (published);
drop policy if exists "public read" on public.services;
create policy "public read" on public.services for select using (active);
drop policy if exists "public read" on public.blocked_dates;
create policy "public read" on public.blocked_dates for select using (true);

-- 會員：只能讀自己的資料（修改一律透過 RPC）
drop policy if exists "member own" on public.customers;
create policy "member own" on public.customers for select using (auth_user_id = auth.uid());
drop policy if exists "member own" on public.bookings;
create policy "member own" on public.bookings for select using (customer_id in (select id from public.customers where auth_user_id = auth.uid()));
drop policy if exists "member own" on public.orders;
create policy "member own" on public.orders for select using (customer_id in (select id from public.customers where auth_user_id = auth.uid()));
drop policy if exists "member own" on public.albums;
create policy "member own" on public.albums for select using (order_id in (
  select o.id from public.orders o join public.customers c on c.id = o.customer_id where c.auth_user_id = auth.uid()));

-- ---------------------------------------------------------------------
-- 10. 照片儲存空間（Storage）
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('portfolio', 'portfolio', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('albums', 'albums', true) on conflict (id) do nothing;

drop policy if exists "gime admin read" on storage.objects;
create policy "gime admin read" on storage.objects for select to authenticated
  using (bucket_id in ('portfolio','albums') and public.is_admin());
drop policy if exists "gime admin upload" on storage.objects;
create policy "gime admin upload" on storage.objects for insert to authenticated
  with check (bucket_id in ('portfolio','albums') and public.is_admin());
drop policy if exists "gime admin update" on storage.objects;
create policy "gime admin update" on storage.objects for update to authenticated
  using (bucket_id in ('portfolio','albums') and public.is_admin());
drop policy if exists "gime admin delete" on storage.objects;
create policy "gime admin delete" on storage.objects for delete to authenticated
  using (bucket_id in ('portfolio','albums') and public.is_admin());

-- ---------------------------------------------------------------------
-- 11. 預設內容（只在尚未存在時寫入，之後請在網站後台修改）
-- ---------------------------------------------------------------------
insert into public.settings (key, value, is_public) values
('studio', jsonb_build_object(
  'name', '即美創畫攝影',
  'name_en', 'GIME STUDIO',
  'tagline', 'PHOTO × AI',
  'hero_title', '創畫攝影',
  'slogan', '以光影記錄真實，以 AI 延展想像',
  'intro', '即美創畫攝影是一間位於新北市的預約制攝影工作室。我們結合專業人像攝影與 AI 影像創作，從證件照、個人寫真、全家福到商業形象與藝術肖像，為每一位來訪者留下兼具真實溫度與創意想像的影像。',
  'phone', '02-8972-8189',
  'address', '新北市',
  'email', '',
  'hours', '預約制｜每日 10:00 – 18:00',
  'line_url', '',
  'instagram', '',
  'facebook', '',
  'map_embed', '',
  'story', '',
  'site_url', '',
  'watermark', '© 即美創畫攝影 GIME STUDIO'
), true),
('hero', '[
  {"image":"https://images.unsplash.com/photo-1519741497674-611481863552?w=1800&q=80","headline":"用光線，顯影","sub":"生命中值得記住的瞬間","cat":"婚紗攝影"},
  {"image":"https://images.unsplash.com/photo-1500048993953-d23a436266cf?w=1800&q=80","headline":"看見最好的自己","sub":"形象攝影・個人寫真","cat":"形象攝影"},
  {"image":"https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=1800&q=80","headline":"攝影 × AI 創畫","sub":"把真實影像延展成藝術作品","cat":"影畫創作"},
  {"image":"https://images.unsplash.com/photo-1523293182086-7651a899d37f?w=1800&q=80","headline":"讓影像說出品牌故事","sub":"商業攝影・形象照","cat":"商業攝影"}
]'::jsonb, true),
('booking', '{"slots":["10:00","11:00","13:00","14:00","15:00","16:00","17:00"],"closed_weekdays":[],"max_days_ahead":90,"payment_info":"","notice":"預約送出後，工作室將於 1 個工作天內與您確認。如需改期請於拍攝前 2 天來電。"}'::jsonb, true),
('notify', jsonb_build_object(
  'studio_email', 'davidshu0503@gmail.com',
  'enabled', jsonb_build_object('booking_created', true, 'booking_cancelled', true, 'payment_received', true, 'album_ready', true,
                                'selection_done', true, 'retouch_started', true, 'delivered', true, 'shoot_reminder', true)
), false),
('templates', '{
  "booking_created": {"subject":"【即美創畫攝影】預約成功 {{booking_id}}","body":"{{name}} 您好，\n\n感謝您預約即美創畫攝影！\n\n預約編號：{{booking_id}}\n訂單編號：{{order_id}}\n服務項目：{{service}}\n拍攝時間：{{date}} {{time}}\n費用：NT$ {{amount}}\n\n工作室將盡快與您確認細節。如需改期或取消，請來電 {{studio_phone}}。\n\n{{studio_name}}\n{{site_url}}"},
  "booking_cancelled": {"subject":"【即美創畫攝影】預約已取消 {{booking_id}}","body":"{{name}} 您好，\n\n您於 {{date}} {{time}} 的「{{service}}」預約（編號 {{booking_id}}）已取消。\n如有任何問題，歡迎來電 {{studio_phone}}，期待下次為您服務。\n\n{{studio_name}}"},
  "payment_received": {"subject":"【即美創畫攝影】已收到您的款項 {{order_id}}","body":"{{name}} 您好，\n\n我們已收到訂單 {{order_id}} 的款項，謝謝您！\n拍攝時間：{{date}} {{time}}（{{service}}）\n\n{{studio_name}}"},
  "album_ready": {"subject":"【即美創畫攝影】您的照片可以選片了！","body":"{{name}} 您好，\n\n您的「{{service}}」照片已上傳完成，歡迎線上選片：\n{{site_url}}/gallery?order={{order_id}}\n\n請以訂單編號 {{order_id}} 與預約電話登入。\n\n{{studio_name}}"},
  "selection_done": {"subject":"【即美創畫攝影】已收到您的選片 {{order_id}}","body":"{{name}} 您好，\n\n我們已收到您選擇的 {{selected_count}} 張照片，接下來將進入修圖流程，完成後會再通知您。\n\n{{studio_name}}"},
  "retouch_started": {"subject":"【即美創畫攝影】照片修圖中","body":"{{name}} 您好，\n\n您訂單 {{order_id}} 的照片已開始精修，完成後會立即通知您下載。\n\n{{studio_name}}"},
  "delivered": {"subject":"【即美創畫攝影】精修照片已完成，可以下載了！","body":"{{name}} 您好，\n\n您的精修照片已完成交件，請至以下網址下載：\n{{site_url}}/gallery?order={{order_id}}\n\n感謝您選擇即美創畫攝影，期待再次相見！\n\n{{studio_name}}"},
  "shoot_reminder": {"subject":"【即美創畫攝影】明天拍攝提醒","body":"{{name}} 您好，\n\n提醒您明天 {{date}} {{time}} 有「{{service}}」拍攝預約（編號 {{booking_id}}）。\n如需調整請來電 {{studio_phone}}，明天見！\n\n{{studio_name}}"},
  "studio_booking_created": {"subject":"🔔 新預約｜{{date}} {{time}} {{service}}","body":"新預約進來了！\n\n客戶：{{name}}（{{phone}}）\n服務：{{service}}\n時間：{{date}} {{time}}\n預約編號：{{booking_id}}\n訂單編號：{{order_id}}\n金額：NT$ {{amount}}\n備註：{{note}}\n\n後台：{{site_url}}/admin"},
  "studio_booking_cancelled": {"subject":"❌ 預約取消｜{{date}} {{time}} {{name}}","body":"預約已取消，時段已自動釋放。\n\n客戶：{{name}}（{{phone}}）\n服務：{{service}}\n時間：{{date}} {{time}}\n預約編號：{{booking_id}}"},
  "studio_selection_done": {"subject":"✅ 客戶完成選片｜{{name}} {{order_id}}","body":"客戶 {{name}} 已完成選片，共 {{selected_count}} 張，可以開始修圖了。\n\n訂單：{{order_id}}（{{service}}）\n後台：{{site_url}}/admin/orders/{{order_id}}"}
}'::jsonb, false)
on conflict (key) do nothing;

insert into public.categories (slug, name, sort) values
  ('portrait','形象攝影',1), ('wedding','婚紗攝影',2), ('commercial','商業攝影',3),
  ('cinematic','影畫創作',4), ('mixed_media','拍畫品',5), ('ai_art','AI 影像創畫',6)
on conflict (slug) do nothing;

insert into public.services (id, name, subtitle, description, price, price_note, duration_label, features, featured, bookable, sort) values
  ('id_photo','證件照','ID PHOTO','專業燈光與修圖，符合各式證件規格。',300,'','約 30 分鐘', array['現場挑選','基礎修圖','電子檔交付'],false,true,1),
  ('portrait','個人寫真','PORTRAIT','一對一引導拍攝，找到最自在、最好看的自己。',6800,'／2 小時','約 2 小時', array['1 位攝影師','1 個場景','精修 15 張','線上選片交件'],true,true,2),
  ('family','全家福','FAMILY','為家人留下溫暖自然的合影。',4500,'','約 1.5 小時', array['最多 8 人','精修 10 張','線上選片交件'],false,true,3),
  ('business','商業形象照','BUSINESS','個人品牌、企業主管、履歷形象照。',3500,'','約 1 小時', array['2 套服裝','精修 5 張','商用授權'],false,true,4),
  ('ai_portrait','AI 藝術肖像','AI PORTRAIT','以您的照片為基礎，AI 生成多種藝術風格肖像。',1200,'','約 15 分鐘', array['3 種風格','高解析檔案','線上交件'],true,true,5),
  ('ai_creation','影像創畫','PHOTO × AI ART','攝影結合 AI 數位藝術創作，打造獨一無二的影像作品。',2800,'起','約 1 小時', array['實拍 + AI 創作','客製風格','高解析檔案'],true,true,6),
  ('wedding_pkg','婚紗方案','WEDDING','全天婚紗拍攝，多場景外拍。',28000,'／全天','全天', array['2 位攝影師','多場景外拍','精修 60 張','婚紗相本一本','線上選片交件'],true,false,7),
  ('commercial_pkg','商業方案','COMMERCIAL','商品、空間、品牌形象拍攝。',12000,'／半天','半天', array['1 位攝影師','棚拍或到府','精修 20 張','商用授權'],false,false,8)
on conflict (id) do nothing;

-- 作品集示範資料（只在作品集是空的時候寫入；上傳正式作品後可在後台刪除）
do $$
declare
  pools jsonb := '{
    "portrait":["photo-1544005313-94ddf0286df2","photo-1500048993953-d23a436266cf","photo-1522673607200-164d1b6ce486","photo-1531123897727-8f129e1688ce","photo-1519699047748-de8e457a634e","photo-1517841905240-472988babdf9"],
    "wedding":["photo-1519741497674-611481863552","photo-1606800052052-a08af7148866","photo-1583939003579-730e3918a45a","photo-1520854221256-17451cc331bf","photo-1533105079780-92b9be482077","photo-1524504388940-b1c1722653e1"],
    "commercial":["photo-1523293182086-7651a899d37f","photo-1441984904996-e0b6ba687e04","photo-1495366691023-cbcabbb87e8b","photo-1580489944761-15a19d654956","photo-1487412720507-e7ab37603c6f","photo-1470075801209-17f9ec0cada6"],
    "cinematic":["photo-1478720568477-152d9b164e26","photo-1508614999368-9260051292e5","photo-1465146344425-f00d5f5c8f07","photo-1516035069371-29a1b244cc32","photo-1524504388940-b1c1722653e1","photo-1495366691023-cbcabbb87e8b"],
    "mixed_media":["photo-1541961017774-22349e4a1262","photo-1579783902614-a3fb3927b6a5","photo-1547891654-e66ed7ebb968","photo-1460661419201-fd4cecdf8a8b","photo-1536924940846-227afb31e2a5","photo-1513364776144-60967b0f800f"],
    "ai_art":["photo-1547891654-e66ed7ebb968","photo-1579783902614-a3fb3927b6a5","photo-1541961017774-22349e4a1262","photo-1536924940846-227afb31e2a5","photo-1460661419201-fd4cecdf8a8b","photo-1513364776144-60967b0f800f"]
  }';
  cat text; i int; arr jsonb; n int; imgs text[]; label text;
begin
  if exists (select 1 from public.portfolio) then return; end if;
  for cat in select jsonb_object_keys(pools) loop
    arr := pools -> cat;
    n := jsonb_array_length(arr);
    select name into label from public.categories where slug = cat;
    for i in 0..11 loop
      imgs := array[
        'https://images.unsplash.com/' || (arr ->> (i % n)) || '?w=1200&q=80',
        'https://images.unsplash.com/' || (arr ->> ((i + 1) % n)) || '?w=1200&q=80',
        'https://images.unsplash.com/' || (arr ->> ((i + 2) % n)) || '?w=1200&q=80'
      ];
      insert into public.portfolio (category, title, images, featured, sort)
      values (cat, label || '・作品 ' || lpad((i + 1)::text, 2, '0'), imgs, i < 2, i);
    end loop;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 12. 設定管理員（將下方 Email 設為 admin；可重複執行）
-- ---------------------------------------------------------------------
insert into public.profiles (id, role)
select id, 'admin' from auth.users where lower(email) = 'davidshu0503@gmail.com'
on conflict (id) do update set role = 'admin';

-- 完成！
select '✅ 即美創畫攝影 資料庫設定完成' as result;
