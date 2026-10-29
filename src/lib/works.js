// 由工作室作品整理而成的預設內容（圖片放在 public/works/）。
// 資料庫連不上時網站會用這些內容；supabase/03-upgrade.sql 也會用同樣的資料建立預設作品。
export const WORK_CATEGORIES = [
 {
  "slug": "gold_leaf",
  "name": "金箔華麗",
  "name_en": "Gold Leaf",
  "tier": "main",
  "description": "克林姆風金箔與金色光絲。結婚週年、長輩壽宴最受歡迎的典藏肖像。",
  "sort": 1
 },
 {
  "slug": "impasto_oil",
  "name": "厚塗油畫",
  "name_en": "Impasto Oil",
  "tier": "main",
  "description": "厚塗筆觸、花海、梵谷式漩渦。全家福與親子最動人的一種。",
  "sort": 2
 },
 {
  "slug": "sculpture",
  "name": "雕塑材質",
  "name_en": "Sculpture & Mosaic",
  "tier": "main",
  "description": "銅雕浮雕、大理石、馬賽克。市面少見、辨識度最高的材質肖像。",
  "sort": 3
 },
 {
  "slug": "fantasy_light",
  "name": "奇幻光效",
  "name_en": "Fantasy Light",
  "tier": "addon",
  "description": "發光蝴蝶、星空、紙雕花。孕婦、新生兒、情侶最常加購。",
  "sort": 4
 },
 {
  "slug": "watercolor",
  "name": "水彩柔光",
  "name_en": "Watercolor",
  "tier": "addon",
  "description": "淡彩暈染、花瓣與柔光，溫柔討喜的插畫感。",
  "sort": 5
 },
 {
  "slug": "ink_sketch",
  "name": "水墨素描",
  "name_en": "Ink & Sketch",
  "tier": "addon",
  "description": "筆墨、炭筆、線稿與版畫。適合男性、商務與文青。",
  "sort": 6
 },
 {
  "slug": "pop_art",
  "name": "普普插畫",
  "name_en": "Pop Art",
  "tier": "addon",
  "description": "普普色塊、卡通、人魚與寵物畫，社群頭像最吸睛。",
  "sort": 7
 },
 {
  "slug": "portrait",
  "name": "形象照・證件",
  "name_en": "Portrait & ID",
  "tier": "entry",
  "description": "商務形象、證件照、個人寫真。專業燈光與引導，第一次來也能拍得自在。",
  "sort": 8
 },
 {
  "slug": "maternity",
  "name": "孕婦寫真",
  "name_en": "Maternity",
  "tier": "entry",
  "description": "超音波照、夫妻合照、黑白孕照。也能一起轉成浮雕或奇幻風格。",
  "sort": 9
 },
 {
  "slug": "family",
  "name": "全家福・親子",
  "name_en": "Family",
  "tier": "entry",
  "description": "全家福、閨蜜團、寶寶。最適合再做成油畫掛畫。",
  "sort": 10
 },
 {
  "slug": "bw_studio",
  "name": "黑白人像",
  "name_en": "Black & White",
  "tier": "entry",
  "description": "高反差光影的黑白棚拍，也是藝術轉繪最好的原片。",
  "sort": 11
 }
];

export const WORK_PORTFOLIO = [{"id": "a30c731f-5abd-5622-9d54-3cbe0216329c", "category": "gold_leaf", "title": "金箔華麗・01", "description": "", "images": ["/works/gold-01.jpg"], "featured": true, "published": true, "sort": 0}, {"id": "33b52d9c-f138-530b-a6a0-e5bf5c01c263", "category": "gold_leaf", "title": "金箔華麗・02", "description": "", "images": ["/works/gold-02.jpg"], "featured": true, "published": true, "sort": 1}, {"id": "b354894f-16a4-5507-b4a1-03bb81583d53", "category": "gold_leaf", "title": "金箔華麗・03", "description": "", "images": ["/works/gold-03.jpg"], "featured": false, "published": true, "sort": 2}, {"id": "f5bd0d7b-41c4-5240-bb74-258e59675480", "category": "gold_leaf", "title": "金箔華麗・04", "description": "", "images": ["/works/gold-04.jpg"], "featured": false, "published": true, "sort": 3}, {"id": "4232a62a-cf00-5444-b440-63f3b42029e9", "category": "gold_leaf", "title": "金箔華麗・05", "description": "", "images": ["/works/gold-05.jpg"], "featured": false, "published": true, "sort": 4}, {"id": "d4f9f599-8ce5-5791-9786-cfffc939dfc4", "category": "gold_leaf", "title": "金箔華麗・06", "description": "", "images": ["/works/gold-06.jpg"], "featured": false, "published": true, "sort": 5}, {"id": "c82dfdea-f8ef-5bbd-bbfe-a899523de79d", "category": "impasto_oil", "title": "厚塗油畫・01", "description": "", "images": ["/works/oil-01.jpg"], "featured": true, "published": true, "sort": 0}, {"id": "80bea8a9-8aab-5e1a-a01c-d97255bcce85", "category": "impasto_oil", "title": "厚塗油畫・02", "description": "", "images": ["/works/oil-02.jpg"], "featured": true, "published": true, "sort": 1}, {"id": "b0f0650f-a0d7-570f-a184-8ad7074773ce", "category": "impasto_oil", "title": "厚塗油畫・03", "description": "", "images": ["/works/oil-03.jpg"], "featured": false, "published": true, "sort": 2}, {"id": "2bd61931-58ce-51ce-b97e-253861f23753", "category": "impasto_oil", "title": "厚塗油畫・04", "description": "", "images": ["/works/oil-04.jpg"], "featured": false, "published": true, "sort": 3}, {"id": "097d7038-611a-594c-b7bc-bd16cc39a2fa", "category": "impasto_oil", "title": "厚塗油畫・05", "description": "", "images": ["/works/oil-05.jpg"], "featured": false, "published": true, "sort": 4}, {"id": "788dcb67-c066-52c1-a002-a42b279e7eff", "category": "impasto_oil", "title": "厚塗油畫・06", "description": "", "images": ["/works/oil-06.jpg"], "featured": false, "published": true, "sort": 5}, {"id": "ec80a8e4-029e-5931-8417-887e6463eb9d", "category": "sculpture", "title": "雕塑材質・01", "description": "", "images": ["/works/sculpture-01.jpg"], "featured": true, "published": true, "sort": 0}, {"id": "ebf3126f-13ba-515e-ae74-5ac530448a4e", "category": "sculpture", "title": "雕塑材質・02", "description": "", "images": ["/works/sculpture-02.jpg"], "featured": true, "published": true, "sort": 1}, {"id": "d1e0672e-1670-56a1-8c9a-ddee224c214c", "category": "sculpture", "title": "雕塑材質・03", "description": "", "images": ["/works/sculpture-03.jpg"], "featured": false, "published": true, "sort": 2}, {"id": "55d3f157-37ed-5fb9-9d06-3c361772ff35", "category": "sculpture", "title": "雕塑材質・04", "description": "", "images": ["/works/sculpture-04.jpg"], "featured": false, "published": true, "sort": 3}, {"id": "991a162c-8b5d-5993-931a-0b8279f20f30", "category": "sculpture", "title": "雕塑材質・05", "description": "", "images": ["/works/sculpture-05.jpg"], "featured": false, "published": true, "sort": 4}, {"id": "319f7ee3-378e-532c-9c09-6e22f919068b", "category": "sculpture", "title": "雕塑材質・06", "description": "", "images": ["/works/sculpture-06.jpg"], "featured": false, "published": true, "sort": 5}, {"id": "cd4f0788-0da7-51c6-b76d-ece82492be0b", "category": "fantasy_light", "title": "奇幻光效・01", "description": "", "images": ["/works/fantasy-01.jpg"], "featured": true, "published": true, "sort": 0}, {"id": "b5442e52-ed07-586b-97c6-6bed64aeabf0", "category": "fantasy_light", "title": "奇幻光效・02", "description": "", "images": ["/works/fantasy-02.jpg"], "featured": false, "published": true, "sort": 1}, {"id": "ab033f52-ea41-5ab3-8f5d-80648e902ca0", "category": "fantasy_light", "title": "奇幻光效・03", "description": "", "images": ["/works/fantasy-03.jpg"], "featured": false, "published": true, "sort": 2}, {"id": "6c99e1d6-66b3-5d7e-a46c-d9c7ab553172", "category": "fantasy_light", "title": "奇幻光效・04", "description": "", "images": ["/works/fantasy-04.jpg"], "featured": false, "published": true, "sort": 3}, {"id": "b0ee7f37-958a-5e8b-a3e5-9cfbb964f735", "category": "fantasy_light", "title": "奇幻光效・05", "description": "", "images": ["/works/fantasy-05.jpg"], "featured": false, "published": true, "sort": 4}, {"id": "3bfa7acb-844e-5b33-8f55-2cdab5e78dd3", "category": "fantasy_light", "title": "奇幻光效・06", "description": "", "images": ["/works/fantasy-06.jpg"], "featured": false, "published": true, "sort": 5}, {"id": "422c7c8f-2deb-5a12-8cac-7af9a3e0aa7a", "category": "watercolor", "title": "水彩柔光・01", "description": "", "images": ["/works/watercolor-01.jpg"], "featured": true, "published": true, "sort": 0}, {"id": "114345a0-7b4c-529f-b99c-5b8cdf04a0ca", "category": "watercolor", "title": "水彩柔光・02", "description": "", "images": ["/works/watercolor-02.jpg"], "featured": false, "published": true, "sort": 1}, {"id": "447723bd-e1b4-5e91-9d04-cfe4c3733af1", "category": "watercolor", "title": "水彩柔光・03", "description": "", "images": ["/works/watercolor-03.jpg"], "featured": false, "published": true, "sort": 2}, {"id": "bdd7f750-6198-5363-bd27-42a30befccee", "category": "watercolor", "title": "水彩柔光・04", "description": "", "images": ["/works/watercolor-04.jpg"], "featured": false, "published": true, "sort": 3}, {"id": "3c72534c-c04a-543d-bef7-8cdd050f2bb7", "category": "watercolor", "title": "水彩柔光・05", "description": "", "images": ["/works/watercolor-05.jpg"], "featured": false, "published": true, "sort": 4}, {"id": "803bfd6c-b0e5-5cfe-9388-49ed95d64d2e", "category": "watercolor", "title": "水彩柔光・06", "description": "", "images": ["/works/watercolor-06.jpg"], "featured": false, "published": true, "sort": 5}, {"id": "2a8e49e1-5150-54b9-9599-6946d211c074", "category": "ink_sketch", "title": "水墨素描・01", "description": "", "images": ["/works/ink-01.jpg"], "featured": true, "published": true, "sort": 0}, {"id": "0bf43374-63e2-5be1-9482-18e1d04aecec", "category": "ink_sketch", "title": "水墨素描・02", "description": "", "images": ["/works/ink-02.jpg"], "featured": false, "published": true, "sort": 1}, {"id": "3b96064f-b651-59eb-b67e-55b16e02923d", "category": "ink_sketch", "title": "水墨素描・03", "description": "", "images": ["/works/ink-03.jpg"], "featured": false, "published": true, "sort": 2}, {"id": "df521e9a-c562-5eb7-b6a8-4a4704c667b7", "category": "ink_sketch", "title": "水墨素描・04", "description": "", "images": ["/works/ink-04.jpg"], "featured": false, "published": true, "sort": 3}, {"id": "93583075-6eb6-5c14-9c43-bc224cefb591", "category": "ink_sketch", "title": "水墨素描・05", "description": "", "images": ["/works/ink-05.jpg"], "featured": false, "published": true, "sort": 4}, {"id": "f6ae0891-4c9c-5739-9951-67513e6680d2", "category": "ink_sketch", "title": "水墨素描・06", "description": "", "images": ["/works/ink-06.jpg"], "featured": false, "published": true, "sort": 5}, {"id": "e53afb0f-5f22-584c-8b59-d9a468dd7390", "category": "pop_art", "title": "普普插畫・01", "description": "", "images": ["/works/pop-01.jpg"], "featured": true, "published": true, "sort": 0}, {"id": "74b43e56-8542-55d5-9269-d00db88d69ff", "category": "pop_art", "title": "普普插畫・02", "description": "", "images": ["/works/pop-02.jpg"], "featured": false, "published": true, "sort": 1}, {"id": "46c58456-7049-5ab7-8056-19c510682012", "category": "pop_art", "title": "普普插畫・03", "description": "", "images": ["/works/pop-03.jpg"], "featured": false, "published": true, "sort": 2}, {"id": "dd253eb0-0db0-555f-981e-76ce74fca91c", "category": "pop_art", "title": "普普插畫・04", "description": "", "images": ["/works/pop-04.jpg"], "featured": false, "published": true, "sort": 3}, {"id": "3568a2b9-a822-5cc4-a304-bfc2ecf25913", "category": "pop_art", "title": "普普插畫・05", "description": "", "images": ["/works/pop-05.jpg"], "featured": false, "published": true, "sort": 4}, {"id": "56c8359e-08b2-59d6-a7cd-ee39af29ddf1", "category": "pop_art", "title": "普普插畫・06", "description": "", "images": ["/works/pop-06.jpg"], "featured": false, "published": true, "sort": 5}, {"id": "df9c05fa-5907-547f-a5d6-69faed31758e", "category": "portrait", "title": "形象照・證件・01", "description": "", "images": ["/works/portrait-01.jpg"], "featured": false, "published": true, "sort": 0}, {"id": "0c768ba9-5fe5-559a-8890-2fa9023f90af", "category": "portrait", "title": "形象照・證件・02", "description": "", "images": ["/works/portrait-02.jpg"], "featured": false, "published": true, "sort": 1}, {"id": "66e9551b-5937-5eb3-9317-5fe4a94ff8ec", "category": "portrait", "title": "形象照・證件・03", "description": "", "images": ["/works/portrait-03.jpg"], "featured": false, "published": true, "sort": 2}, {"id": "902e00e7-45d3-50ef-b3ef-79de3984bc5c", "category": "portrait", "title": "形象照・證件・04", "description": "", "images": ["/works/portrait-04.jpg"], "featured": false, "published": true, "sort": 3}, {"id": "49409c9d-b875-5965-b585-41c4b59fefe9", "category": "portrait", "title": "形象照・證件・05", "description": "", "images": ["/works/portrait-05.jpg"], "featured": false, "published": true, "sort": 4}, {"id": "127a2241-c103-5135-9973-d78a26fc4cf0", "category": "portrait", "title": "形象照・證件・06", "description": "", "images": ["/works/portrait-06.jpg"], "featured": false, "published": true, "sort": 5}, {"id": "578a8fb4-b239-55ca-978c-a55ea79b55d2", "category": "maternity", "title": "孕婦寫真・01", "description": "", "images": ["/works/maternity-01.jpg"], "featured": false, "published": true, "sort": 0}, {"id": "16201ec7-5324-551c-8af8-a53b1120956e", "category": "maternity", "title": "孕婦寫真・02", "description": "", "images": ["/works/maternity-02.jpg"], "featured": false, "published": true, "sort": 1}, {"id": "551ba01c-2c15-593c-9855-9da044fe7211", "category": "maternity", "title": "孕婦寫真・03", "description": "", "images": ["/works/maternity-03.jpg"], "featured": false, "published": true, "sort": 2}, {"id": "2c720429-d76f-501a-bf12-7d56915c5cef", "category": "maternity", "title": "孕婦寫真・04", "description": "", "images": ["/works/maternity-04.jpg"], "featured": false, "published": true, "sort": 3}, {"id": "7676184b-316e-571a-9098-a629d5c8c8f0", "category": "maternity", "title": "孕婦寫真・05", "description": "", "images": ["/works/maternity-05.jpg"], "featured": false, "published": true, "sort": 4}, {"id": "36ee7993-26c9-51cb-8e0e-d0b5d88f5fac", "category": "maternity", "title": "孕婦寫真・06", "description": "", "images": ["/works/maternity-06.jpg"], "featured": false, "published": true, "sort": 5}, {"id": "c7bc122e-492e-5e2a-b9ae-8b46aca39b92", "category": "family", "title": "全家福・親子・01", "description": "", "images": ["/works/family-01.jpg"], "featured": false, "published": true, "sort": 0}, {"id": "4d99980e-349f-549a-9ee0-1cab3085c15d", "category": "family", "title": "全家福・親子・02", "description": "", "images": ["/works/family-02.jpg"], "featured": false, "published": true, "sort": 1}, {"id": "d56a3485-5920-58eb-9163-aa78a5b6922e", "category": "family", "title": "全家福・親子・03", "description": "", "images": ["/works/family-03.jpg"], "featured": false, "published": true, "sort": 2}, {"id": "0fafe7ec-8bd9-5212-aaf1-fb1ed4de4fc9", "category": "family", "title": "全家福・親子・04", "description": "", "images": ["/works/family-04.jpg"], "featured": false, "published": true, "sort": 3}, {"id": "8cc214e0-1560-59d3-a369-6a5a93533ec9", "category": "family", "title": "全家福・親子・05", "description": "", "images": ["/works/family-05.jpg"], "featured": false, "published": true, "sort": 4}, {"id": "82f9ab58-a7c6-5dc7-8b1e-cbbc9ef76e4a", "category": "family", "title": "全家福・親子・06", "description": "", "images": ["/works/family-06.jpg"], "featured": false, "published": true, "sort": 5}, {"id": "d0ba61a5-c271-5d44-ba43-8341c1ababaf", "category": "bw_studio", "title": "黑白人像・01", "description": "", "images": ["/works/bw-01.jpg"], "featured": false, "published": true, "sort": 0}, {"id": "a6efc444-77e4-507c-a448-7507e0a0fbd6", "category": "bw_studio", "title": "黑白人像・02", "description": "", "images": ["/works/bw-02.jpg"], "featured": false, "published": true, "sort": 1}, {"id": "8675da6d-a99e-5e4c-82e9-56dcf1d34a5f", "category": "bw_studio", "title": "黑白人像・03", "description": "", "images": ["/works/bw-03.jpg"], "featured": false, "published": true, "sort": 2}, {"id": "5a38c880-b8e5-5ee7-b1a5-54b2301beecd", "category": "bw_studio", "title": "黑白人像・04", "description": "", "images": ["/works/bw-04.jpg"], "featured": false, "published": true, "sort": 3}, {"id": "ecb0fe63-dc4c-5a82-858d-f218c03a7bfb", "category": "bw_studio", "title": "黑白人像・05", "description": "", "images": ["/works/bw-05.jpg"], "featured": false, "published": true, "sort": 4}, {"id": "eb3a77dc-5078-557e-b2be-75974446ff94", "category": "bw_studio", "title": "黑白人像・06", "description": "", "images": ["/works/bw-06.jpg"], "featured": false, "published": true, "sort": 5}];

export const WORK_STYLE_SETS = [
 {
  "id": "69f77ce3-94ba-5b29-8241-deff1a93b3ed",
  "title": "商務形象照，延伸出 7 種藝術風格",
  "description": "一張形象照，轉成普普、素描、版畫、網點、馬賽克等不同版本。名片、社群頭像、辦公室掛畫一次備齊。",
  "original": "/works/portrait-06.jpg",
  "styles": [
   {
    "image": "/works/setA-01.jpg",
    "label": "普普紫調"
   },
   {
    "image": "/works/pop-05.jpg",
    "label": "普普色塊"
   },
   {
    "image": "/works/setA-02.jpg",
    "label": "素描線稿"
   },
   {
    "image": "/works/ink-06.jpg",
    "label": "版畫雕刻"
   },
   {
    "image": "/works/setA-03.jpg",
    "label": "網點漩渦"
   },
   {
    "image": "/works/setA-04.jpg",
    "label": "貝殼馬賽克"
   },
   {
    "image": "/works/setA-05.jpg",
    "label": "線條版畫"
   }
  ],
  "published": true,
  "sort": 0
 },
 {
  "id": "b843ab27-1df5-5ac5-b1f3-2d47f847a579",
  "title": "一張黑白側臉，7 種奇幻風格",
  "description": "同一張棚拍原片，做成金色光絲、紙雕、發光蝴蝶與星塵。",
  "original": "/works/bw-01.jpg",
  "styles": [
   {
    "image": "/works/setC-01.jpg",
    "label": "金色光絲"
   },
   {
    "image": "/works/setC-02.jpg",
    "label": "藍調紙雕"
   },
   {
    "image": "/works/setC-03.jpg",
    "label": "花朵紙雕"
   },
   {
    "image": "/works/fantasy-02.jpg",
    "label": "紫色蝴蝶"
   },
   {
    "image": "/works/fantasy-03.jpg",
    "label": "藍蝶夜空"
   },
   {
    "image": "/works/fantasy-04.jpg",
    "label": "彩虹星塵"
   },
   {
    "image": "/works/setC-04.jpg",
    "label": "白花紙雕"
   }
  ],
  "published": true,
  "sort": 1
 },
 {
  "id": "f6d69dfd-7283-5092-8127-2593e3f1c40f",
  "title": "黑白雙人照，變成金箔與油畫",
  "description": "最受歡迎的兩種典藏風格，做成大幅掛畫最有份量。",
  "original": "/works/bw-05.jpg",
  "styles": [
   {
    "image": "/works/gold-04.jpg",
    "label": "金箔華麗"
   },
   {
    "image": "/works/oil-04.jpg",
    "label": "厚塗油畫框"
   }
  ],
  "published": true,
  "sort": 2
 },
 {
  "id": "267bcb55-5461-5fe4-a7b6-4492c532f2a2",
  "title": "孕婦寫真，加做浮雕與奇幻版",
  "description": "孕期只有一次。原片之外，再留一幅浮雕和一幅奇幻水彩。",
  "original": "/works/maternity-05.jpg",
  "styles": [
   {
    "image": "/works/sculpture-03.jpg",
    "label": "石膏浮雕"
   },
   {
    "image": "/works/fantasy-06.jpg",
    "label": "奇幻水彩"
   }
  ],
  "published": true,
  "sort": 3
 },
 {
  "id": "dc2be792-3bbc-5ea1-9ed8-a266b5e9533e",
  "title": "長輩肖像，4 種典藏風格",
  "description": "同一位長輩、同一次拍攝，做成梵谷筆觸與金色蝴蝶系列。",
  "original": "",
  "styles": [
   {
    "image": "/works/setF-01.jpg",
    "label": "梵谷筆觸"
   },
   {
    "image": "/works/setF-02.jpg",
    "label": "金蝶夕光"
   },
   {
    "image": "/works/setF-03.jpg",
    "label": "花園金蝶"
   },
   {
    "image": "/works/setF-04.jpg",
    "label": "金箔蝴蝶"
   }
  ],
  "published": true,
  "sort": 4
 }
];

export const WORK_HERO = [
 {
  "image": "/works/gold-01.jpg",
  "headline": "拍一次，擁有多種藝術風格",
  "sub": "攝影 × 藝術轉繪・一拍多風格",
  "cat": "金箔華麗"
 },
 {
  "image": "/works/oil-01.jpg",
  "headline": "把全家福，畫成傳家的油畫",
  "sub": "典藏藝術肖像・厚塗油畫",
  "cat": "厚塗油畫"
 },
 {
  "image": "/works/setC-02.jpg",
  "headline": "同一張照片，七種奇幻風格",
  "sub": "風格加購・紙雕與光效",
  "cat": "奇幻光效"
 },
 {
  "image": "/works/sculpture-01.jpg",
  "headline": "銅雕、大理石、馬賽克",
  "sub": "市面少見的材質肖像",
  "cat": "雕塑材質"
 }
];
