-- =====================================================================
--  即美創畫攝影｜第 7 版：工作室 LINE + Email 同步通知
--
--  1. admin_send_test_notification()：後台「傳送測試通知」按鈕用，
--     同時排入一則工作室 Email 與一則工作室 LINE 測試通知
--  2. 「給工作室的新預約通知」加上訂金資訊（只有還是預設內容時才更新）
--
--  使用方式：Supabase 後台 → SQL Editor → 貼上 → Run（可重複執行）
--  需先執行過 01～06。
-- =====================================================================

create or replace function public.admin_send_test_notification()
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_ref text := 'test-' || to_char(now() at time zone 'Asia/Taipei', 'YYYYMMDDHH24MISS') || '-' || substr(md5(random()::text), 1, 4);
  v_payload jsonb := jsonb_build_object('time', to_char(now() at time zone 'Asia/Taipei', 'MM/DD HH24:MI'));
  c text;
begin
  if not public.is_admin() then
    raise exception '只有管理員可以傳送測試通知';
  end if;
  foreach c in array array['email','line'] loop
    insert into public.notifications (event, ref_id, channel, audience, payload)
    values ('test', v_ref, c, 'studio', v_payload);
  end loop;
  return v_ref;
end $$;

revoke all on function public.admin_send_test_notification() from public, anon;
grant execute on function public.admin_send_test_notification() to authenticated;

-- 給工作室的新預約通知：加上訂金（僅更新仍為預設內容的範本，不覆蓋您改過的內容）
update public.settings
   set value = jsonb_set(value, '{studio_booking_created,body}', to_jsonb('新預約進來了！

客戶：{{name}}（{{phone}}）
服務：{{service}}
時間：{{date}} {{time}}
預約編號：{{booking_id}}
訂單編號：{{order_id}}
金額：NT$ {{amount}}
訂金：NT$ {{deposit}}（期限 {{deposit_due}}）
備註：{{note}}

後台：{{site_url}}/admin'::text))
 where key = 'templates'
   and value -> 'studio_booking_created' ->> 'body' = '新預約進來了！

客戶：{{name}}（{{phone}}）
服務：{{service}}
時間：{{date}} {{time}}
預約編號：{{booking_id}}
訂單編號：{{order_id}}
金額：NT$ {{amount}}
備註：{{note}}

後台：{{site_url}}/admin';

-- 檢查：工作室通知收件設定
select value ->> 'studio_email' as "工作室收件 Email",
       coalesce(nullif(value ->> 'line_admin_ids', ''), '（尚未綁定）') as "工作室 LINE"
  from public.settings where key = 'notify';
