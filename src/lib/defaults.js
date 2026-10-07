// 資料庫尚未連線時的預設內容（與 supabase/01-setup.sql 的預設資料一致）
const U = (id, w = 1200) => `https://images.unsplash.com/${id}?w=${w}&q=80`;

export const DEFAULT_STUDIO = {
  name: "即美創畫攝影",
  name_en: "GIME STUDIO",
  tagline: "PHOTO × AI",
  hero_title: "創畫攝影",
  slogan: "以光影記錄真實，以 AI 延展想像",
  intro:
    "即美創畫攝影是一間位於新北市的預約制攝影工作室。我們結合專業人像攝影與 AI 影像創作，從證件照、個人寫真、全家福到商業形象與藝術肖像，為每一位來訪者留下兼具真實溫度與創意想像的影像。",
  phone: "02-8972-8189",
  address: "新北市",
  email: "",
  hours: "預約制｜每日 10:00 – 18:00",
  line_url: "",
  instagram: "",
  facebook: "",
  map_embed: "",
  story: "",
  watermark: "© 即美創畫攝影 GIME STUDIO",
};

export const DEFAULT_HERO = [
  { image: U("photo-1519741497674-611481863552", 1800), headline: "用光線，顯影", sub: "生命中值得記住的瞬間", cat: "婚紗攝影" },
  { image: U("photo-1500048993953-d23a436266cf", 1800), headline: "看見最好的自己", sub: "形象攝影・個人寫真", cat: "形象攝影" },
  { image: U("photo-1478720568477-152d9b164e26", 1800), headline: "攝影 × AI 創畫", sub: "把真實影像延展成藝術作品", cat: "影畫創作" },
  { image: U("photo-1523293182086-7651a899d37f", 1800), headline: "讓影像說出品牌故事", sub: "商業攝影・形象照", cat: "商業攝影" },
];

export const DEFAULT_BOOKING = {
  slots: ["10:00", "11:00", "13:00", "14:00", "15:00", "16:00", "17:00"],
  closed_weekdays: [],
  max_days_ahead: 90,
  payment_info: "",
  notice: "預約送出後，工作室將於 1 個工作天內與您確認。如需改期請於拍攝前 2 天來電。",
};

export const DEFAULT_CATEGORIES = [
  { slug: "portrait", name: "形象攝影", sort: 1 },
  { slug: "wedding", name: "婚紗攝影", sort: 2 },
  { slug: "commercial", name: "商業攝影", sort: 3 },
  { slug: "cinematic", name: "影畫創作", sort: 4 },
  { slug: "mixed_media", name: "拍畫品", sort: 5 },
  { slug: "ai_art", name: "AI 影像創畫", sort: 6 },
];

export const DEFAULT_SERVICES = [
  { id: "id_photo", name: "證件照", subtitle: "ID PHOTO", description: "專業燈光與修圖，符合各式證件規格。", price: 300, price_note: "", duration_label: "約 30 分鐘", features: ["現場挑選", "基礎修圖", "電子檔交付"], featured: false, bookable: true, sort: 1 },
  { id: "portrait", name: "個人寫真", subtitle: "PORTRAIT", description: "一對一引導拍攝，找到最自在、最好看的自己。", price: 6800, price_note: "／2 小時", duration_label: "約 2 小時", features: ["1 位攝影師", "1 個場景", "精修 15 張", "線上選片交件"], featured: true, bookable: true, sort: 2 },
  { id: "family", name: "全家福", subtitle: "FAMILY", description: "為家人留下溫暖自然的合影。", price: 4500, price_note: "", duration_label: "約 1.5 小時", features: ["最多 8 人", "精修 10 張", "線上選片交件"], featured: false, bookable: true, sort: 3 },
  { id: "business", name: "商業形象照", subtitle: "BUSINESS", description: "個人品牌、企業主管、履歷形象照。", price: 3500, price_note: "", duration_label: "約 1 小時", features: ["2 套服裝", "精修 5 張", "商用授權"], featured: false, bookable: true, sort: 4 },
  { id: "ai_portrait", name: "AI 藝術肖像", subtitle: "AI PORTRAIT", description: "以您的照片為基礎，AI 生成多種藝術風格肖像。", price: 1200, price_note: "", duration_label: "約 15 分鐘", features: ["3 種風格", "高解析檔案", "線上交件"], featured: true, bookable: true, sort: 5 },
  { id: "ai_creation", name: "影像創畫", subtitle: "PHOTO × AI ART", description: "攝影結合 AI 數位藝術創作，打造獨一無二的影像作品。", price: 2800, price_note: "起", duration_label: "約 1 小時", features: ["實拍 + AI 創作", "客製風格", "高解析檔案"], featured: true, bookable: true, sort: 6 },
  { id: "wedding_pkg", name: "婚紗方案", subtitle: "WEDDING", description: "全天婚紗拍攝，多場景外拍。", price: 28000, price_note: "／全天", duration_label: "全天", features: ["2 位攝影師", "多場景外拍", "精修 60 張", "婚紗相本一本", "線上選片交件"], featured: true, bookable: false, sort: 7 },
  { id: "commercial_pkg", name: "商業方案", subtitle: "COMMERCIAL", description: "商品、空間、品牌形象拍攝。", price: 12000, price_note: "／半天", duration_label: "半天", features: ["1 位攝影師", "棚拍或到府", "精修 20 張", "商用授權"], featured: false, bookable: false, sort: 8 },
];

const POOLS = {
  portrait: ["photo-1544005313-94ddf0286df2", "photo-1500048993953-d23a436266cf", "photo-1522673607200-164d1b6ce486", "photo-1531123897727-8f129e1688ce", "photo-1519699047748-de8e457a634e", "photo-1517841905240-472988babdf9"],
  wedding: ["photo-1519741497674-611481863552", "photo-1606800052052-a08af7148866", "photo-1583939003579-730e3918a45a", "photo-1520854221256-17451cc331bf", "photo-1533105079780-92b9be482077", "photo-1524504388940-b1c1722653e1"],
  commercial: ["photo-1523293182086-7651a899d37f", "photo-1441984904996-e0b6ba687e04", "photo-1495366691023-cbcabbb87e8b", "photo-1580489944761-15a19d654956", "photo-1487412720507-e7ab37603c6f", "photo-1470075801209-17f9ec0cada6"],
  cinematic: ["photo-1478720568477-152d9b164e26", "photo-1508614999368-9260051292e5", "photo-1465146344425-f00d5f5c8f07", "photo-1516035069371-29a1b244cc32", "photo-1524504388940-b1c1722653e1", "photo-1495366691023-cbcabbb87e8b"],
  mixed_media: ["photo-1541961017774-22349e4a1262", "photo-1579783902614-a3fb3927b6a5", "photo-1547891654-e66ed7ebb968", "photo-1460661419201-fd4cecdf8a8b", "photo-1536924940846-227afb31e2a5", "photo-1513364776144-60967b0f800f"],
  ai_art: ["photo-1547891654-e66ed7ebb968", "photo-1579783902614-a3fb3927b6a5", "photo-1541961017774-22349e4a1262", "photo-1536924940846-227afb31e2a5", "photo-1460661419201-fd4cecdf8a8b", "photo-1513364776144-60967b0f800f"],
};

export const DEFAULT_PORTFOLIO = DEFAULT_CATEGORIES.flatMap((c) => {
  const pool = POOLS[c.slug];
  return Array.from({ length: 12 }).map((_, i) => ({
    id: `${c.slug}-${i}`,
    category: c.slug,
    title: `${c.name}・作品 ${String(i + 1).padStart(2, "0")}`,
    description: "",
    images: [0, 1, 2].map((k) => U(pool[(i + k) % pool.length])),
    featured: i < 2,
    sort: i,
  }));
});
