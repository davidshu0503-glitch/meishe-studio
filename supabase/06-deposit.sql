-- =====================================================================
--  即美創畫攝影 GIME STUDIO — 升級腳本 06：預付訂金制
--  ・預約成立時自動計算訂金與付款期限（依後台「預約設定 → 訂金」）
--  ・後台「確認已收訂金」→ 預約確認，並自動通知客戶（Email＋LINE）
--  ・預約成功通知會附上訂金金額、付款期限與匯款資訊
--
--  使用方式：Supabase 後台 → SQL Editor → New query → 貼上本檔全部內容 → Run
--  ・可重複執行，不會刪除既有資料；需先執行過 01（建議 03–05 也已執行）
-- =====================================================================

-- 1. 訂單：訂金、付款期限、訂金付款時間
alter table public.orders add column if not exists deposit_amount int not null default 0;
alter table public.orders add column if not exists deposit_due date;
alter table public.orders add column if not exists deposit_paid_at timestamptz;

-- 2. 預設訂金規則（只在還沒設定時寫入；請到後台「網站內容 → 預約設定」調整）
--    type：percent＝訂金比例（value＝百分比）、amount＝固定金額（value＝元）、none＝不收訂金
update public.settings
   set value = value || jsonb_build_object('deposit', jsonb_build_object('type', 'percent', 'value', 30, 'days', 3, 'policy', ''))
 where key = 'booking' and not (value ? 'deposit');

-- 3. 計算訂金
create or replace function public.deposit_for(p_amount int) returns int
language plpgsql stable security definer set search_path = public as $$
declare
  d jsonb;
  v int;
begin
  select value -> 'deposit' into d from public.settings where key = 'booking';
  if d is null or coalesce(p_amount, 0) <= 0 then return 0; end if;
  v := coalesce((d ->> 'value')::int, 0);
  if d ->> 'type' = 'percent' and v > 0 then return least(p_amount, greatest(1, round(p_amount * v / 100.0)::int)); end if;
  if d ->> 'type' = 'amount' and v > 0 then return least(p_amount, v); end if;
  return 0;
end $$;

-- 新訂單自動帶入訂金與付款期限（期限最晚到拍攝前一天）
create or replace function public.order_set_deposit() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_days int;
begin
  if coalesce(new.deposit_amount, 0) = 0 and coalesce(new.amount, 0) > 0 and new.status = '待付款' then
    new.deposit_amount := public.deposit_for(new.amount);
    if new.deposit_amount > 0 then
      select coalesce((value -> 'deposit' ->> 'days')::int, 3) into v_days from public.settings where key = 'booking';
      new.deposit_due := least(public.tw_today() + greatest(v_days, 0),
                               greatest(coalesce(new.date, public.tw_today() + v_days) - 1, public.tw_today()));
    end if;
  end if;
  return new;
end $$;
drop trigger if exists t_order_deposit on public.orders;
create trigger t_order_deposit before insert on public.orders for each row execute function public.order_set_deposit();

-- 收到訂金（狀態 待付款 → 已預約）時記錄時間
create or replace function public.before_order_update() returns trigger
language plpgsql as $$
begin
  if new.status is distinct from old.status and new.status = '已付款' and new.paid_at is null then
    new.paid_at := now();
  end if;
  if new.status is distinct from old.status and old.status = '待付款' and new.status in ('已預約','已付款')
     and new.deposit_amount > 0 and new.deposit_paid_at is null then
    new.deposit_paid_at := now();
  end if;
  return new;
end $$;

-- 4. 通知內容可用的訂金變數：{{deposit}} {{deposit_due}} {{balance}} {{deposit_text}} {{payment_info}}
create or replace function public.deposit_vars(o public.orders) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_info text;
  v_policy text;
begin
  select coalesce(value ->> 'payment_info', ''), coalesce(value -> 'deposit' ->> 'policy', '')
    into v_info, v_policy from public.settings where key = 'booking';
  return jsonb_build_object(
    'deposit', coalesce(o.deposit_amount, 0),
    'deposit_due', coalesce(to_char(o.deposit_due, 'YYYY-MM-DD'), ''),
    'balance', greatest(coalesce(o.amount, 0) - greatest(coalesce(o.paid_amount, 0), case when o.status in ('已預約') then coalesce(o.deposit_amount, 0) else 0 end), 0),
    'payment_info', coalesce(v_info, ''),
    'deposit_text', case when coalesce(o.deposit_amount, 0) > 0 then
        format(E'訂金：NT$ %s（請於 %s 前完成付款，以確認預約）\n尾款：NT$ %s（拍攝當天支付）%s%s\n',
               o.deposit_amount, coalesce(to_char(o.deposit_due, 'YYYY-MM-DD'), '3 天內'), greatest(o.amount - o.deposit_amount, 0),
               case when coalesce(v_info, '') <> '' then E'\n\n【訂金付款方式】\n' || v_info else '' end,
               case when coalesce(v_policy, '') <> '' then E'\n\n【訂金說明】\n' || v_policy else '' end)
      else '' end
  );
end $$;

-- 5. 訂單事件 → 通知（新增「已收到訂金」，並把訂金資訊放進通知內容）
create or replace function public.on_order_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_payload jsonb;
  v_event text;
  v_aud text[] := array['customer'];
  v_dep jsonb := public.deposit_vars(new);
begin
  if tg_op = 'INSERT' then
    v_payload := jsonb_build_object('name', new.customer_name, 'phone', new.phone, 'order_id', new.id,
      'booking_id', new.booking_id, 'service', new.service_name, 'date', to_char(new.date,'YYYY-MM-DD'),
      'time', new.time, 'amount', new.amount,
      'note', coalesce((select note from public.bookings where id = new.booking_id), '')) || v_dep;
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
      when '已預約' then case when old.status = '待付款' and new.deposit_amount > 0 then 'deposit_received' end
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
                           where al.order_id = new.id and p.selected)) || v_dep;
      perform public.enqueue_notification(v_event, new.id, new.customer_id, new.id, new.booking_id, v_payload, v_aud);
    end if;
  end if;
  return new;
end $$;

-- 6. 通知範本：新增「已收到訂金」；預約成功通知加上訂金資訊（只在你沒改過範本時更新）
update public.settings
   set value = value || jsonb_build_object('deposit_received', '{"subject": "【即美創畫攝影】已收到訂金，預約已確認 {{booking_id}}", "body": "{{name}} 您好，\n\n我們已收到您的訂金 NT$ {{deposit}}，預約正式確認！\n\n服務項目：{{service}}\n拍攝時間：{{date}} {{time}}\n尾款：NT$ {{balance}}（拍攝當天支付）\n\n拍攝前一天會再提醒您，期待見面！\n\n{{studio_name}}"}'::jsonb)
 where key = 'templates' and not (value ? 'deposit_received');
update public.settings
   set value = jsonb_set(value, '{booking_created,body}', to_jsonb('{{name}} 您好，

感謝您預約即美創畫攝影！

預約編號：{{booking_id}}
訂單編號：{{order_id}}
服務項目：{{service}}
拍攝時間：{{date}} {{time}}
費用：NT$ {{amount}}
{{deposit_text}}
工作室將盡快與您確認細節。如需改期或取消，請來電 {{studio_phone}}。

{{studio_name}}
{{site_url}}'::text))
 where key = 'templates' and value -> 'booking_created' ->> 'body' = '{{name}} 您好，

感謝您預約即美創畫攝影！

預約編號：{{booking_id}}
訂單編號：{{order_id}}
服務項目：{{service}}
拍攝時間：{{date}} {{time}}
費用：NT$ {{amount}}

工作室將盡快與您確認細節。如需改期或取消，請來電 {{studio_phone}}。

{{studio_name}}
{{site_url}}';

-- 完成！到後台「網站內容 → 預約設定」確認訂金比例、付款期限與匯款資訊。
