// 資料庫尚未連線時的預設內容（與 supabase/01-setup.sql、03-upgrade.sql 的預設資料一致）
import { WORK_CATEGORIES, WORK_PORTFOLIO, WORK_STYLE_SETS } from "./works";
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
  line_consult_id: "",
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

export const DEFAULT_CATEGORIES = WORK_CATEGORIES;

export const DEFAULT_SERVICES = [
  { id: "id_photo", tier: "entry", name: "證件照", subtitle: "ID PHOTO", description: "專業燈光與修圖，符合各式證件規格。", price: 300, price_note: "", duration_label: "約 30 分鐘", features: ["現場挑選", "基礎修圖", "電子檔交付"], featured: false, bookable: true, sort: 1 },
  { id: "portrait", tier: "entry", name: "個人寫真", subtitle: "PORTRAIT", description: "一對一引導拍攝，找到最自在、最好看的自己。", price: 6800, price_note: "／2 小時", duration_label: "約 2 小時", features: ["1 位攝影師", "1 個場景", "精修 15 張", "線上選片交件"], featured: true, bookable: true, sort: 2 },
  { id: "family", tier: "entry", name: "全家福", subtitle: "FAMILY", description: "為家人留下溫暖自然的合影。", price: 4500, price_note: "", duration_label: "約 1.5 小時", features: ["最多 8 人", "精修 10 張", "線上選片交件"], featured: false, bookable: true, sort: 3 },
  { id: "business", tier: "entry", name: "商業形象照", subtitle: "BUSINESS", description: "個人品牌、企業主管、履歷形象照。", price: 3500, price_note: "", duration_label: "約 1 小時", features: ["2 套服裝", "精修 5 張", "商用授權"], featured: false, bookable: true, sort: 4 },
  { id: "ai_portrait", tier: "addon", name: "一拍多風格加購", subtitle: "STYLE ADD-ON", description: "用同一次拍攝的照片，加做 3 種藝術風格版本（例如水彩、奇幻光效、普普）。", price: 1200, price_note: "", duration_label: "約 15 分鐘", features: ["3 種風格", "高解析檔案", "線上交件"], featured: true, bookable: true, sort: 5 },
  { id: "ai_creation", tier: "addon", name: "影像創畫", subtitle: "PHOTO × AI ART", description: "攝影結合 AI 數位藝術創作，打造獨一無二的影像作品。", price: 2800, price_note: "起", duration_label: "約 1 小時", features: ["實拍 + AI 創作", "客製風格", "高解析檔案"], featured: true, bookable: true, sort: 6 },
  { id: "art_print", tier: "main", name: "典藏藝術掛畫", subtitle: "SIGNATURE ART PRINT", description: "把最喜歡的一張做成金箔、厚塗油畫或雕塑材質風格，輸出成可以掛在客廳的大幅作品。", price: 0, price_note: "依尺寸報價", duration_label: "", features: ["尺寸 8×12 至 24×30 吋", "無框畫或實體畫框", "可搭配任一拍攝方案"], featured: true, bookable: false, sort: 0 },
  { id: "art_collection", tier: "main", name: "典藏故事套組", subtitle: "STORY COLLECTION", description: "全家福、孕期、壽宴的完整紀錄：拍攝原片、多種風格轉繪，加上大幅掛畫與小相本。", price: 0, price_note: "", duration_label: "", features: ["拍攝＋精修原片", "多種藝術風格轉繪", "大幅掛畫＋小相本"], featured: true, bookable: false, sort: 0 },
  { id: "wedding_pkg", tier: "entry", name: "婚紗方案", subtitle: "WEDDING", description: "全天婚紗拍攝，多場景外拍。", price: 28000, price_note: "／全天", duration_label: "全天", features: ["2 位攝影師", "多場景外拍", "精修 60 張", "婚紗相本一本", "線上選片交件"], featured: true, bookable: false, sort: 7 },
  { id: "commercial_pkg", tier: "entry", name: "商業方案", subtitle: "COMMERCIAL", description: "商品、空間、品牌形象拍攝。", price: 12000, price_note: "／半天", duration_label: "半天", features: ["1 位攝影師", "棚拍或到府", "精修 20 張", "商用授權"], featured: false, bookable: false, sort: 8 },
];

export const DEFAULT_PORTFOLIO = WORK_PORTFOLIO;

/** 一拍多風格：同一張原片 → 多種藝術風格 */
export const DEFAULT_STYLE_SETS = WORK_STYLE_SETS;
