-- =====================================================================
--  即美創畫攝影 GIME STUDIO — 升級腳本 05：優惠代碼自動折扣
--  客人輸入優惠代碼 → 資料庫自動計算折扣 → 訂單直接是折扣後金額
--
--  使用方式：Supabase 後台 → SQL Editor → New query → 貼上本檔全部內容 → Run
--  ・可重複執行，不會刪除既有資料
--  ・需先執行過 01、04（行銷管理）
-- =====================================================================

-- 1. 活動的折扣設定
--    discount_type：none＝只標記不折扣、percent＝打折（discount_value 85＝85 折，付 85%）、amount＝折抵金額（discount_value＝折多少元）
--    max_uses：名額上限（0＝不限），已取消的訂單不算
alter table public.promotions add column if not exists discount_type text not null default 'none';
alter table public.promotions add column if not exists discount_value int not null default 0;
alter table public.promotions add column if not exists max_uses int not null default 0;
alter table public.promotions drop constraint if exists promotions_discount_chk;
alter table public.promotions add constraint promotions_discount_chk check (
  (discount_type = 'none')
  or (discount_type = 'percent' and discount_value between 1 and 99)
  or (discount_type = 'amount' and discount_value >= 1)
);
alter table public.promotions drop constraint if exists promotions_max_uses_chk;
alter table public.promotions add constraint promotions_max_uses_chk check (max_uses >= 0);

-- 2. 預約與訂單記錄用了哪個優惠
alter table public.bookings add column if not exists promo_code text not null default '';
alter table public.orders add column if not exists list_price int;                 -- 原價
alter table public.orders add column if not exists discount int not null default 0; -- 折扣金額
alter table public.orders add column if not exists promo_code text not null default '';
alter table public.orders add column if not exists promo_title text not null default '';
create index if not exists orders_promo_idx on public.orders (promo_code) where promo_code <> '';

-- 3. 試算：檢查代碼是否有效、是否適用此服務、名額是否已滿，回傳折扣後金額
--    預約頁會先呼叫它顯示價格；真正建立預約時資料庫會再算一次（客人無法竄改）
create or replace function public.promo_quote(p_code text, p_service_id text)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_code text := upper(trim(coalesce(p_code, '')));
  v_p public.promotions;
  v_s public.services;
  v_used int;
  v_amount int;
begin
  if v_code = '' then return jsonb_build_object('ok', false, 'error', '請輸入優惠代碼'); end if;
  select * into v_p from public.promotions
   where upper(code) = v_code and published
     and (start_at is null or start_at <= now()) and (end_at is null or end_at > now())
   limit 1;
  if not found then return jsonb_build_object('ok', false, 'error', '查無此優惠代碼，或活動已結束'); end if;

  select * into v_s from public.services where id = p_service_id;
  if p_service_id is not null and not found then return jsonb_build_object('ok', false, 'error', '找不到此服務'); end if;
  if coalesce(array_length(v_p.service_ids, 1), 0) > 0 and p_service_id is not null and not (p_service_id = any (v_p.service_ids)) then
    return jsonb_build_object('ok', false, 'error', format('優惠「%s」不適用於「%s」', v_p.title, v_s.name), 'title', v_p.title, 'code', v_p.code);
  end if;

  if v_p.max_uses > 0 then
    select count(*) into v_used from public.orders where upper(promo_code) = v_code and status <> '已取消';
    if v_used >= v_p.max_uses then
      return jsonb_build_object('ok', false, 'error', format('優惠「%s」名額已滿', v_p.title), 'title', v_p.title, 'code', v_p.code);
    end if;
  end if;

  v_amount := coalesce(v_s.price, 0);
  if v_amount > 0 then
    if v_p.discount_type = 'percent' then v_amount := round(v_amount * v_p.discount_value / 100.0)::int;
    elsif v_p.discount_type = 'amount' then v_amount := greatest(v_amount - v_p.discount_value, 0);
    end if;
  end if;

  return jsonb_build_object('ok', true, 'code', v_p.code, 'title', v_p.title,
    'discount_type', v_p.discount_type, 'discount_value', v_p.discount_value,
    'list_price', coalesce(v_s.price, 0), 'amount', v_amount, 'discount', coalesce(v_s.price, 0) - v_amount,
    'remaining', case when v_p.max_uses > 0 then v_p.max_uses - coalesce(v_used, 0) end);
end $$;
revoke all on function public.promo_quote(text, text) from public;
grant execute on function public.promo_quote(text, text) to anon, authenticated;

-- 4. 建立預約：多一個選填參數 p_promo_code（沒帶就和以前完全一樣）
drop function if exists public.create_booking(text, date, text, text, text, text, text, text, text);
create or replace function public.create_booking(
  p_service_id text, p_date date, p_time text, p_name text, p_phone text,
  p_contact_method text, p_email text, p_line_id text, p_note text, p_promo_code text default null
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
  v_quote jsonb;
  v_amount int;
  v_code text := upper(trim(coalesce(p_promo_code, '')));
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

  -- 優惠代碼：在資料庫端計算折扣，客人無法自行改價
  v_amount := v_service.price;
  if v_code <> '' then
    perform pg_advisory_xact_lock(hashtext('promo:' || v_code));   -- 避免名額同時被搶超過上限
    v_quote := public.promo_quote(v_code, v_service.id);
    if not (v_quote ->> 'ok')::boolean then raise exception '%', v_quote ->> 'error'; end if;
    v_amount := (v_quote ->> 'amount')::int;
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
      insert into public.bookings (id, customer_id, service_id, service_name, date, time, name, phone, contact_method, email, line_id, note, source, promo_code)
      values (v_booking_id, v_customer.id, v_service.id, v_service.name, p_date, p_time, trim(p_name), trim(p_phone),
              p_contact_method, nullif(trim(coalesce(p_email,'')), ''), nullif(trim(coalesce(p_line_id,'')), ''), coalesce(p_note, ''),
              case when public.is_admin() then 'admin' else 'web' end, v_code);
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
      insert into public.orders (id, booking_id, customer_id, customer_name, phone, service_id, service_name, date, time, amount,
                                 list_price, discount, promo_code, promo_title)
      values (v_order_id, v_booking_id, v_customer.id, trim(p_name), trim(p_phone), v_service.id, v_service.name, p_date, p_time, v_amount,
              v_service.price, v_service.price - v_amount, v_code, coalesce(v_quote ->> 'title', ''));
      exit;
    exception when unique_violation then
      v_try := v_try + 1;
      if v_try > 5 then raise; end if;
    end;
  end loop;

  return jsonb_build_object('booking_id', v_booking_id, 'order_id', v_order_id, 'service', v_service.name,
    'date', p_date, 'time', p_time, 'amount', v_amount, 'list_price', v_service.price, 'discount', v_service.price - v_amount,
    'promo_code', v_code, 'promo_title', coalesce(v_quote ->> 'title', ''), 'name', trim(p_name));
end $$;

revoke all on function public.create_booking(text, date, text, text, text, text, text, text, text, text) from public;
grant execute on function public.create_booking(text, date, text, text, text, text, text, text, text, text) to anon, authenticated;

-- 完成！到後台「行銷管理」編輯活動，設定「折扣方式」即可。
