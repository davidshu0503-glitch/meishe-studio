-- =====================================================================
--  即美創畫攝影 GIME STUDIO — 升級腳本 03
--  一拍多風格 → 主力 → 加值 → 引流　＋　後台整理／刪除紀錄
--
--  使用方式：Supabase 後台 → SQL Editor → New query → 貼上本檔全部內容 → Run
--  ・可重複執行，不會刪除任何既有資料
--  ・必須先執行過 01-setup.sql
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. 作品分類：分層（tier）、英文名稱、說明
--    tier：main＝主力、addon＝加值、entry＝引流、hidden＝不在網站顯示
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='categories' and column_name='tier') then
    alter table public.categories add column tier text not null default 'addon';
    -- 既有分類依性質先自動歸類，之後可在後台「網站內容 → 作品分類」調整
    update public.categories set tier = 'entry' where slug in ('portrait','wedding','commercial');
    update public.categories set tier = 'addon' where slug in ('cinematic','mixed_media','ai_art');
  end if;
end $$;
alter table public.categories add column if not exists name_en text not null default '';
alter table public.categories add column if not exists description text not null default '';
alter table public.categories drop constraint if exists categories_tier_chk;
alter table public.categories add constraint categories_tier_chk check (tier in ('main','addon','entry','hidden'));

-- 新的風格分類（已存在的代碼只補上分層，不覆蓋你改過的名稱）
insert into public.categories (slug, name, name_en, tier, description, sort) values
  ('gold_leaf', '金箔華麗', 'Gold Leaf', 'main', '克林姆風金箔與金色光絲。結婚週年、長輩壽宴最受歡迎的典藏肖像。', 1),
  ('impasto_oil', '厚塗油畫', 'Impasto Oil', 'main', '厚塗筆觸、花海、梵谷式漩渦。全家福與親子最動人的一種。', 2),
  ('sculpture', '雕塑材質', 'Sculpture & Mosaic', 'main', '銅雕浮雕、大理石、馬賽克。市面少見、辨識度最高的材質肖像。', 3),
  ('fantasy_light', '奇幻光效', 'Fantasy Light', 'addon', '發光蝴蝶、星空、紙雕花。孕婦、新生兒、情侶最常加購。', 4),
  ('watercolor', '水彩柔光', 'Watercolor', 'addon', '淡彩暈染、花瓣與柔光，溫柔討喜的插畫感。', 5),
  ('ink_sketch', '水墨素描', 'Ink & Sketch', 'addon', '筆墨、炭筆、線稿與版畫。適合男性、商務與文青。', 6),
  ('pop_art', '普普插畫', 'Pop Art', 'addon', '普普色塊、卡通、人魚與寵物畫，社群頭像最吸睛。', 7),
  ('portrait', '形象照・證件', 'Portrait & ID', 'entry', '商務形象、證件照、個人寫真。專業燈光與引導，第一次來也能拍得自在。', 8),
  ('maternity', '孕婦寫真', 'Maternity', 'entry', '超音波照、夫妻合照、黑白孕照。也能一起轉成浮雕或奇幻風格。', 9),
  ('family', '全家福・親子', 'Family', 'entry', '全家福、閨蜜團、寶寶。最適合再做成油畫掛畫。', 10),
  ('bw_studio', '黑白人像', 'Black & White', 'entry', '高反差光影的黑白棚拍，也是藝術轉繪最好的原片。', 11)
on conflict (slug) do nothing;
-- 舊分類排到新分類後面
update public.categories set sort = sort + 20 where slug in ('wedding','commercial','cinematic','mixed_media','ai_art') and sort < 20;

-- ---------------------------------------------------------------------
-- 2. 服務：分層
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='services' and column_name='tier') then
    alter table public.services add column tier text not null default 'entry';
    update public.services set tier = 'addon' where id in ('ai_portrait','ai_creation');
  end if;
end $$;
alter table public.services drop constraint if exists services_tier_chk;
alter table public.services add constraint services_tier_chk check (tier in ('main','addon','entry','hidden'));

-- 主力商品：典藏掛畫、典藏套組（價格 0＝網站顯示「洽詢報價」，請到後台填入實際價格）
insert into public.services (id, tier, name, subtitle, description, price, price_note, duration_label, features, featured, bookable, active, sort) values
  ('art_print', 'main', '典藏藝術掛畫', 'SIGNATURE ART PRINT', '把最喜歡的一張做成金箔、厚塗油畫或雕塑材質風格，輸出成可以掛在客廳的大幅作品。', 0, '依尺寸報價', '',
   array['尺寸 8×12 至 24×30 吋','無框畫或實體畫框','可搭配任一拍攝方案'], true, false, true, 0),
  ('art_collection', 'main', '典藏故事套組', 'STORY COLLECTION', '全家福、孕期、壽宴的完整紀錄：拍攝原片、多種風格轉繪，加上大幅掛畫與小相本。', 0, '', '',
   array['拍攝＋精修原片','多種藝術風格轉繪','大幅掛畫＋小相本'], true, false, true, 0)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- 3. 一拍多風格：同一張原片 → 多種藝術風格
-- ---------------------------------------------------------------------
create table if not exists public.style_sets (
  id uuid primary key default gen_random_uuid(),
  title text not null default '',
  description text not null default '',
  original text not null default '',            -- 原片（storage 路徑或網址，可留空）
  styles jsonb not null default '[]'::jsonb,    -- [{"image": "...", "label": "金箔華麗"}, ...]
  published boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.style_sets enable row level security;
drop policy if exists "admin all" on public.style_sets;
create policy "admin all" on public.style_sets for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "public read" on public.style_sets;
create policy "public read" on public.style_sets for select using (published);
drop trigger if exists t_style_sets_audit on public.style_sets;
create trigger t_style_sets_audit after update or delete on public.style_sets for each row execute function public.audit_row();

-- ---------------------------------------------------------------------
-- 4. 預設作品（圖片在網站的 public/works/ 資料夾，可在後台隨時刪除或替換）
--    用固定編號，重複執行不會重複新增；在後台刪掉後也不會再被加回來，除非重跑本腳本
-- ---------------------------------------------------------------------
insert into public.portfolio (id, category, title, images, featured, sort) values
  ('a30c731f-5abd-5622-9d54-3cbe0216329c', 'gold_leaf', '金箔華麗・01', array['/works/gold-01.jpg']::text[], true, 0),
  ('33b52d9c-f138-530b-a6a0-e5bf5c01c263', 'gold_leaf', '金箔華麗・02', array['/works/gold-02.jpg']::text[], true, 1),
  ('b354894f-16a4-5507-b4a1-03bb81583d53', 'gold_leaf', '金箔華麗・03', array['/works/gold-03.jpg']::text[], false, 2),
  ('f5bd0d7b-41c4-5240-bb74-258e59675480', 'gold_leaf', '金箔華麗・04', array['/works/gold-04.jpg']::text[], false, 3),
  ('4232a62a-cf00-5444-b440-63f3b42029e9', 'gold_leaf', '金箔華麗・05', array['/works/gold-05.jpg']::text[], false, 4),
  ('d4f9f599-8ce5-5791-9786-cfffc939dfc4', 'gold_leaf', '金箔華麗・06', array['/works/gold-06.jpg']::text[], false, 5),
  ('c82dfdea-f8ef-5bbd-bbfe-a899523de79d', 'impasto_oil', '厚塗油畫・01', array['/works/oil-01.jpg']::text[], true, 0),
  ('80bea8a9-8aab-5e1a-a01c-d97255bcce85', 'impasto_oil', '厚塗油畫・02', array['/works/oil-02.jpg']::text[], true, 1),
  ('b0f0650f-a0d7-570f-a184-8ad7074773ce', 'impasto_oil', '厚塗油畫・03', array['/works/oil-03.jpg']::text[], false, 2),
  ('2bd61931-58ce-51ce-b97e-253861f23753', 'impasto_oil', '厚塗油畫・04', array['/works/oil-04.jpg']::text[], false, 3),
  ('097d7038-611a-594c-b7bc-bd16cc39a2fa', 'impasto_oil', '厚塗油畫・05', array['/works/oil-05.jpg']::text[], false, 4),
  ('788dcb67-c066-52c1-a002-a42b279e7eff', 'impasto_oil', '厚塗油畫・06', array['/works/oil-06.jpg']::text[], false, 5),
  ('ec80a8e4-029e-5931-8417-887e6463eb9d', 'sculpture', '雕塑材質・01', array['/works/sculpture-01.jpg']::text[], true, 0),
  ('ebf3126f-13ba-515e-ae74-5ac530448a4e', 'sculpture', '雕塑材質・02', array['/works/sculpture-02.jpg']::text[], true, 1),
  ('d1e0672e-1670-56a1-8c9a-ddee224c214c', 'sculpture', '雕塑材質・03', array['/works/sculpture-03.jpg']::text[], false, 2),
  ('55d3f157-37ed-5fb9-9d06-3c361772ff35', 'sculpture', '雕塑材質・04', array['/works/sculpture-04.jpg']::text[], false, 3),
  ('991a162c-8b5d-5993-931a-0b8279f20f30', 'sculpture', '雕塑材質・05', array['/works/sculpture-05.jpg']::text[], false, 4),
  ('319f7ee3-378e-532c-9c09-6e22f919068b', 'sculpture', '雕塑材質・06', array['/works/sculpture-06.jpg']::text[], false, 5),
  ('cd4f0788-0da7-51c6-b76d-ece82492be0b', 'fantasy_light', '奇幻光效・01', array['/works/fantasy-01.jpg']::text[], true, 0),
  ('b5442e52-ed07-586b-97c6-6bed64aeabf0', 'fantasy_light', '奇幻光效・02', array['/works/fantasy-02.jpg']::text[], false, 1),
  ('ab033f52-ea41-5ab3-8f5d-80648e902ca0', 'fantasy_light', '奇幻光效・03', array['/works/fantasy-03.jpg']::text[], false, 2),
  ('6c99e1d6-66b3-5d7e-a46c-d9c7ab553172', 'fantasy_light', '奇幻光效・04', array['/works/fantasy-04.jpg']::text[], false, 3),
  ('b0ee7f37-958a-5e8b-a3e5-9cfbb964f735', 'fantasy_light', '奇幻光效・05', array['/works/fantasy-05.jpg']::text[], false, 4),
  ('3bfa7acb-844e-5b33-8f55-2cdab5e78dd3', 'fantasy_light', '奇幻光效・06', array['/works/fantasy-06.jpg']::text[], false, 5),
  ('422c7c8f-2deb-5a12-8cac-7af9a3e0aa7a', 'watercolor', '水彩柔光・01', array['/works/watercolor-01.jpg']::text[], true, 0),
  ('114345a0-7b4c-529f-b99c-5b8cdf04a0ca', 'watercolor', '水彩柔光・02', array['/works/watercolor-02.jpg']::text[], false, 1),
  ('447723bd-e1b4-5e91-9d04-cfe4c3733af1', 'watercolor', '水彩柔光・03', array['/works/watercolor-03.jpg']::text[], false, 2),
  ('bdd7f750-6198-5363-bd27-42a30befccee', 'watercolor', '水彩柔光・04', array['/works/watercolor-04.jpg']::text[], false, 3),
  ('3c72534c-c04a-543d-bef7-8cdd050f2bb7', 'watercolor', '水彩柔光・05', array['/works/watercolor-05.jpg']::text[], false, 4),
  ('803bfd6c-b0e5-5cfe-9388-49ed95d64d2e', 'watercolor', '水彩柔光・06', array['/works/watercolor-06.jpg']::text[], false, 5),
  ('2a8e49e1-5150-54b9-9599-6946d211c074', 'ink_sketch', '水墨素描・01', array['/works/ink-01.jpg']::text[], true, 0),
  ('0bf43374-63e2-5be1-9482-18e1d04aecec', 'ink_sketch', '水墨素描・02', array['/works/ink-02.jpg']::text[], false, 1),
  ('3b96064f-b651-59eb-b67e-55b16e02923d', 'ink_sketch', '水墨素描・03', array['/works/ink-03.jpg']::text[], false, 2),
  ('df521e9a-c562-5eb7-b6a8-4a4704c667b7', 'ink_sketch', '水墨素描・04', array['/works/ink-04.jpg']::text[], false, 3),
  ('93583075-6eb6-5c14-9c43-bc224cefb591', 'ink_sketch', '水墨素描・05', array['/works/ink-05.jpg']::text[], false, 4),
  ('f6ae0891-4c9c-5739-9951-67513e6680d2', 'ink_sketch', '水墨素描・06', array['/works/ink-06.jpg']::text[], false, 5),
  ('e53afb0f-5f22-584c-8b59-d9a468dd7390', 'pop_art', '普普插畫・01', array['/works/pop-01.jpg']::text[], true, 0),
  ('74b43e56-8542-55d5-9269-d00db88d69ff', 'pop_art', '普普插畫・02', array['/works/pop-02.jpg']::text[], false, 1),
  ('46c58456-7049-5ab7-8056-19c510682012', 'pop_art', '普普插畫・03', array['/works/pop-03.jpg']::text[], false, 2),
  ('dd253eb0-0db0-555f-981e-76ce74fca91c', 'pop_art', '普普插畫・04', array['/works/pop-04.jpg']::text[], false, 3),
  ('3568a2b9-a822-5cc4-a304-bfc2ecf25913', 'pop_art', '普普插畫・05', array['/works/pop-05.jpg']::text[], false, 4),
  ('56c8359e-08b2-59d6-a7cd-ee39af29ddf1', 'pop_art', '普普插畫・06', array['/works/pop-06.jpg']::text[], false, 5),
  ('df9c05fa-5907-547f-a5d6-69faed31758e', 'portrait', '形象照・證件・01', array['/works/portrait-01.jpg']::text[], false, 0),
  ('0c768ba9-5fe5-559a-8890-2fa9023f90af', 'portrait', '形象照・證件・02', array['/works/portrait-02.jpg']::text[], false, 1),
  ('66e9551b-5937-5eb3-9317-5fe4a94ff8ec', 'portrait', '形象照・證件・03', array['/works/portrait-03.jpg']::text[], false, 2),
  ('902e00e7-45d3-50ef-b3ef-79de3984bc5c', 'portrait', '形象照・證件・04', array['/works/portrait-04.jpg']::text[], false, 3),
  ('49409c9d-b875-5965-b585-41c4b59fefe9', 'portrait', '形象照・證件・05', array['/works/portrait-05.jpg']::text[], false, 4),
  ('127a2241-c103-5135-9973-d78a26fc4cf0', 'portrait', '形象照・證件・06', array['/works/portrait-06.jpg']::text[], false, 5),
  ('578a8fb4-b239-55ca-978c-a55ea79b55d2', 'maternity', '孕婦寫真・01', array['/works/maternity-01.jpg']::text[], false, 0),
  ('16201ec7-5324-551c-8af8-a53b1120956e', 'maternity', '孕婦寫真・02', array['/works/maternity-02.jpg']::text[], false, 1),
  ('551ba01c-2c15-593c-9855-9da044fe7211', 'maternity', '孕婦寫真・03', array['/works/maternity-03.jpg']::text[], false, 2),
  ('2c720429-d76f-501a-bf12-7d56915c5cef', 'maternity', '孕婦寫真・04', array['/works/maternity-04.jpg']::text[], false, 3),
  ('7676184b-316e-571a-9098-a629d5c8c8f0', 'maternity', '孕婦寫真・05', array['/works/maternity-05.jpg']::text[], false, 4),
  ('36ee7993-26c9-51cb-8e0e-d0b5d88f5fac', 'maternity', '孕婦寫真・06', array['/works/maternity-06.jpg']::text[], false, 5),
  ('c7bc122e-492e-5e2a-b9ae-8b46aca39b92', 'family', '全家福・親子・01', array['/works/family-01.jpg']::text[], false, 0),
  ('4d99980e-349f-549a-9ee0-1cab3085c15d', 'family', '全家福・親子・02', array['/works/family-02.jpg']::text[], false, 1),
  ('d56a3485-5920-58eb-9163-aa78a5b6922e', 'family', '全家福・親子・03', array['/works/family-03.jpg']::text[], false, 2),
  ('0fafe7ec-8bd9-5212-aaf1-fb1ed4de4fc9', 'family', '全家福・親子・04', array['/works/family-04.jpg']::text[], false, 3),
  ('8cc214e0-1560-59d3-a369-6a5a93533ec9', 'family', '全家福・親子・05', array['/works/family-05.jpg']::text[], false, 4),
  ('82f9ab58-a7c6-5dc7-8b1e-cbbc9ef76e4a', 'family', '全家福・親子・06', array['/works/family-06.jpg']::text[], false, 5),
  ('d0ba61a5-c271-5d44-ba43-8341c1ababaf', 'bw_studio', '黑白人像・01', array['/works/bw-01.jpg']::text[], false, 0),
  ('a6efc444-77e4-507c-a448-7507e0a0fbd6', 'bw_studio', '黑白人像・02', array['/works/bw-02.jpg']::text[], false, 1),
  ('8675da6d-a99e-5e4c-82e9-56dcf1d34a5f', 'bw_studio', '黑白人像・03', array['/works/bw-03.jpg']::text[], false, 2),
  ('5a38c880-b8e5-5ee7-b1a5-54b2301beecd', 'bw_studio', '黑白人像・04', array['/works/bw-04.jpg']::text[], false, 3),
  ('ecb0fe63-dc4c-5a82-858d-f218c03a7bfb', 'bw_studio', '黑白人像・05', array['/works/bw-05.jpg']::text[], false, 4),
  ('eb3a77dc-5078-557e-b2be-75974446ff94', 'bw_studio', '黑白人像・06', array['/works/bw-06.jpg']::text[], false, 5)
on conflict (id) do nothing;

insert into public.style_sets (id, title, description, original, styles, sort) values
  ('69f77ce3-94ba-5b29-8241-deff1a93b3ed', '商務形象照，延伸出 7 種藝術風格', '一張形象照，轉成普普、素描、版畫、網點、馬賽克等不同版本。名片、社群頭像、辦公室掛畫一次備齊。', '/works/portrait-06.jpg', '[{"image": "/works/setA-01.jpg", "label": "普普紫調"}, {"image": "/works/pop-05.jpg", "label": "普普色塊"}, {"image": "/works/setA-02.jpg", "label": "素描線稿"}, {"image": "/works/ink-06.jpg", "label": "版畫雕刻"}, {"image": "/works/setA-03.jpg", "label": "網點漩渦"}, {"image": "/works/setA-04.jpg", "label": "貝殼馬賽克"}, {"image": "/works/setA-05.jpg", "label": "線條版畫"}]'::jsonb, 0),
  ('b843ab27-1df5-5ac5-b1f3-2d47f847a579', '一張黑白側臉，7 種奇幻風格', '同一張棚拍原片，做成金色光絲、紙雕、發光蝴蝶與星塵。', '/works/bw-01.jpg', '[{"image": "/works/setC-01.jpg", "label": "金色光絲"}, {"image": "/works/setC-02.jpg", "label": "藍調紙雕"}, {"image": "/works/setC-03.jpg", "label": "花朵紙雕"}, {"image": "/works/fantasy-02.jpg", "label": "紫色蝴蝶"}, {"image": "/works/fantasy-03.jpg", "label": "藍蝶夜空"}, {"image": "/works/fantasy-04.jpg", "label": "彩虹星塵"}, {"image": "/works/setC-04.jpg", "label": "白花紙雕"}]'::jsonb, 1),
  ('f6d69dfd-7283-5092-8127-2593e3f1c40f', '黑白雙人照，變成金箔與油畫', '最受歡迎的兩種典藏風格，做成大幅掛畫最有份量。', '/works/bw-05.jpg', '[{"image": "/works/gold-04.jpg", "label": "金箔華麗"}, {"image": "/works/oil-04.jpg", "label": "厚塗油畫框"}]'::jsonb, 2),
  ('267bcb55-5461-5fe4-a7b6-4492c532f2a2', '孕婦寫真，加做浮雕與奇幻版', '孕期只有一次。原片之外，再留一幅浮雕和一幅奇幻水彩。', '/works/maternity-05.jpg', '[{"image": "/works/sculpture-03.jpg", "label": "石膏浮雕"}, {"image": "/works/fantasy-06.jpg", "label": "奇幻水彩"}]'::jsonb, 3),
  ('dc2be792-3bbc-5ea1-9ed8-a266b5e9533e', '長輩肖像，4 種典藏風格', '同一位長輩、同一次拍攝，做成梵谷筆觸與金色蝴蝶系列。', '', '[{"image": "/works/setF-01.jpg", "label": "梵谷筆觸"}, {"image": "/works/setF-02.jpg", "label": "金蝶夕光"}, {"image": "/works/setF-03.jpg", "label": "花園金蝶"}, {"image": "/works/setF-04.jpg", "label": "金箔蝴蝶"}]'::jsonb, 4)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- 5. 刪除紀錄的效能索引（資料整理用）
-- ---------------------------------------------------------------------
create index if not exists bookings_status_created_idx on public.bookings (status, created_at);
create index if not exists orders_status_created_idx on public.orders (status, created_at);
create index if not exists notifications_created_idx on public.notifications (created_at);
create index if not exists audit_logs_created_idx on public.audit_logs (created_at);

-- 完成！回到網站重新整理即可看到新版首頁與作品集。
