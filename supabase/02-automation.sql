-- =====================================================================
--  即美創畫攝影｜自動化排程（在部署好 Edge Function 之後執行）
--
--  1. 每 5 分鐘自動寄出佇列中的 Email / LINE 通知（也負責失敗重試）
--  2. 每天早上 09:00（台灣時間）自動排入「明天拍攝提醒」
--
--  使用方式：Supabase 後台 → SQL Editor → 貼上 → Run（可重複執行）
--  若您的 Supabase 專案網址不同，請修改下方 project_url。
-- =====================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
declare
  project_url text := 'https://ysfutoqeuicjbjxvksso.supabase.co';
begin
  -- 移除舊的同名排程（可重複執行）
  perform cron.unschedule(jobname) from cron.job where jobname in ('gime-send-notifications', 'gime-shoot-reminders');

  perform cron.schedule(
    'gime-send-notifications',
    '*/5 * * * *',
    format($f$ select net.http_post(url := %L, headers := '{"Content-Type":"application/json"}'::jsonb, body := '{}'::jsonb) $f$,
           project_url || '/functions/v1/send-notifications')
  );

  -- 01:00 UTC = 台灣時間 09:00
  perform cron.schedule(
    'gime-shoot-reminders',
    '0 1 * * *',
    $f$ select public.enqueue_tomorrow_reminders() $f$
  );
end $$;

select jobname, schedule from cron.job where jobname like 'gime-%';
