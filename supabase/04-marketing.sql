-- =====================================================================
--  即美創畫攝影 GIME STUDIO — 升級腳本 04：行銷管理
--  首頁橫幅／公告列／優惠活動／彈出視窗，可設定期間自動上下架
--
--  使用方式：Supabase 後台 → SQL Editor → New query → 貼上本檔全部內容 → Run
--  ・可重複執行，不會刪除既有資料
--  ・需先執行過 01-setup.sql（03-upgrade.sql 建議也先執行）
-- =====================================================================

create table if not exists public.promotions (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'offer',        -- hero＝首頁橫幅、bar＝公告列、offer＝優惠活動、popup＝彈出視窗
  title text not null default '',
  subtitle text not null default '',
  body text not null default '',              -- 活動詳情（優惠活動頁顯示）
  image text not null default '',
  badge text not null default '',             -- 角標，例如「限時」「85 折」
  code text not null default '',              -- 優惠代碼：客人預約時會自動帶入備註
  cta_label text not null default '',
  cta_link text not null default '',          -- 站內路徑（/booking?service=portrait）或完整網址
  service_ids text[] not null default '{}',   -- 適用服務（服務頁會顯示「優惠中」）
  start_at timestamptz,                       -- 空白＝立即開始
  end_at timestamptz,                         -- 空白＝不會自動結束
  published boolean not null default false,   -- 上架開關；未上架＝草稿
  sort int not null default 0,
  clicks int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.promotions drop constraint if exists promotions_kind_chk;
alter table public.promotions add constraint promotions_kind_chk check (kind in ('hero','bar','offer','popup'));
create unique index if not exists promotions_code_uq on public.promotions (upper(code)) where code <> '';
create index if not exists promotions_live_idx on public.promotions (published, start_at, end_at);

drop trigger if exists t_promotions_touch on public.promotions;
create trigger t_promotions_touch before update on public.promotions for each row execute function public.touch_updated_at();

-- 權限：管理員可全部操作；一般訪客只看得到「已上架且在期間內」的活動（時間到自動上架、過期自動下架）
alter table public.promotions enable row level security;
drop policy if exists "admin all" on public.promotions;
create policy "admin all" on public.promotions for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "public read live" on public.promotions;
create policy "public read live" on public.promotions for select using (
  published and (start_at is null or start_at <= now()) and (end_at is null or end_at > now())
);

-- 變更紀錄（只記錄內容修改與刪除；點擊數變動不記錄）
drop function if exists public.audit_promotions();
drop trigger if exists t_promotions_audit on public.promotions;
drop trigger if exists t_promotions_audit_upd on public.promotions;
drop trigger if exists t_promotions_audit_del on public.promotions;
create trigger t_promotions_audit_upd after update on public.promotions for each row
  when ((to_jsonb(old) - 'clicks' - 'updated_at') is distinct from (to_jsonb(new) - 'clicks' - 'updated_at'))
  execute function public.audit_row();
create trigger t_promotions_audit_del after delete on public.promotions for each row execute function public.audit_row();

-- 點擊統計：訪客點擊活動按鈕時 +1（只對進行中的活動有效）
create or replace function public.promo_click(p_id uuid) returns void
language sql security definer set search_path = public as $$
  update public.promotions set clicks = clicks + 1
  where id = p_id and published and (start_at is null or start_at <= now()) and (end_at is null or end_at > now());
$$;
revoke all on function public.promo_click(uuid) from public;
grant execute on function public.promo_click(uuid) to anon, authenticated;

-- 完成！到後台「行銷管理」新增第一個活動。
