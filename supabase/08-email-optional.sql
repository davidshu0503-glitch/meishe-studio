-- =====================================================================
--  即美創畫攝影｜08：預約時 Email 改為選填
--  ・選「Email 聯絡」也可以不填 Email（有填才檢查格式）
--  使用方式：Supabase → SQL Editor → 貼上 → Run（可重複執行，需先執行過 05）
-- =====================================================================
do $$
declare
  d text;
begin
  d := pg_get_functiondef('public.create_booking(text, date, text, text, text, text, text, text, text, text)'::regprocedure);
  d := replace(d,
    $o$if p_contact_method = 'email' and (v_email is null or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') then raise exception '請填寫正確的 Email'; end if;$o$,
    $n$if v_email is not null and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception '請填寫正確的 Email'; end if;$n$);
  execute d;
end $$;
