import React, { useState, useEffect } from "react";

/* =========================================================================
   資料層說明（架構需保留未來接正式資料庫的彈性）
   ------------------------------------------------------------------------
   customers / bookings / orders / albums / photos 目前都用 React state 管理
   （本環境無法使用瀏覽器 localStorage，重新整理頁面會清空）。
   所有新增/修改/刪除都集中寫成 addCustomer / updateCustomer / deleteCustomer /
   addBooking / addOrder / updateOrderStatus / cancelBookingCascade /
   cancelOrder / createAlbum / addTestPhotos / togglePhotoSelected /
   confirmSelection / markRetouching / markCompleted 這幾個函式。未來要換成
   呼叫正式後端 API 時，只需要改這幾個函式內部的實作，上層畫面元件完全不需要
   更動。

   【P8-3A：後台管理員登入是唯一真正接了後端的部分】
   ------------------------------------------------------------------------
   下面這一段是「後台管理員登入」專用，接的是真正的 Supabase 後端
   （Postgres 資料庫 + Auth + Row Level Security），不是前端假裝的登入。
   除了這一段之外，customers/bookings/orders/... 這些業務資料目前仍然是
   前端記憶體模擬（下一階段才會搬進資料庫），這點請務必記得。

   使用前，請先到 https://supabase.com 建立一個專案，並完成本檔案附帶的
   「supabase-setup.sql」腳本設定，再把下面兩個值換成您自己專案的設定：
   - SUPABASE_URL：專案的 Project URL（在 Project Settings → API 頁面）
   - SUPABASE_ANON_KEY：專案的 anon public key（同一頁面）

   這兩個值「設計上就是要放在前端」的，不是密碼、也不是機密：
   真正的權限控管是靠資料庫的 Row Level Security（RLS）規則，
   不是靠把這兩個值藏起來。
   絕對不要把 service_role key（服務金鑰）放進這裡，那才是真正的機密，
   一旦外洩等於任何人都能繞過 RLS 直接讀寫整個資料庫。
   ========================================================================= */
const SUPABASE_URL = "https://ysfutoqeuicjbjxvksso.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_uG5c75iwwl_LbDlVwthu_Q_P3KZBG3-";

// 呼叫 Supabase 的 Auth API 做帳號密碼登入。
// 密碼雜湊比對、Token 簽發全部由 Supabase 的伺服器完成，這裡只是發送請求。
async function supabaseLogin(email, password) {
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) return { success: false, message: data.error_description || data.msg || "登入失敗，請確認帳號密碼" };
    return { success: true, accessToken: data.access_token, refreshToken: data.refresh_token, userId: data.user && data.user.id, email: data.user && data.user.email };
  } catch (e) {
    return { success: false, message: "無法連線到後端驗證伺服器，請確認網路連線或 Supabase 設定是否正確" };
  }
}

// 用登入拿到的 access token，去查「自己」的角色。
// 這裡查得到什麼資料，完全由資料庫的 Row Level Security 規則決定
// （規則只允許 auth.uid() = id，也就是只能查到自己），
// 前端沒有辦法靠傳不同的參數查到別人的角色。
async function supabaseFetchOwnRole(accessToken) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?select=role`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${accessToken}` },
    });
    const data = await res.json();
    if (!res.ok || !Array.isArray(data) || data.length === 0) return null;
    return data[0].role;
  } catch (e) {
    return null;
  }
}

// 登出時通知 Supabase 撤銷這個 refresh token，讓伺服器端也真的失效，
// 不是只有前端把變數清空而已。
async function supabaseLogout(accessToken) {
  try {
    await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
      method: "POST",
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${accessToken}` },
    });
  } catch (e) { /* 即使這個請求失敗，前端仍會清除本地狀態；但正式的登出仍以伺服器撤銷為準 */ }
}

/* ---------------- P1 資料：作品集 / 服務方案 ---------------- */

const PORTFOLIO_DETAIL_POOL = [
  "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=800&q=80",
  "https://images.unsplash.com/photo-1465146344425-f00d5f5c8f07?w=800&q=80",
  "https://images.unsplash.com/photo-1520854221256-17451cc331bf?w=800&q=80",
  "https://images.unsplash.com/photo-1533105079780-92b9be482077?w=800&q=80",
  "https://images.unsplash.com/photo-1495366691023-cbcabbb87e8b?w=800&q=80",
  "https://images.unsplash.com/photo-1470075801209-17f9ec0cada6?w=800&q=80",
];
function detailSetFor(seed) {
  return [0, 1, 2].map((i) => PORTFOLIO_DETAIL_POOL[(seed + i) % PORTFOLIO_DETAIL_POOL.length]);
}

const PHOTOS_PORTFOLIO_CURATED = [
  { id: 1, cat: "portrait", src: "https://images.unsplash.com/photo-1500048993953-d23a436266cf?w=800&q=80", title: "形象・午後光", detail: detailSetFor(0) },
  { id: 2, cat: "wedding", src: "https://images.unsplash.com/photo-1519741497674-611481863552?w=800&q=80", title: "婚紗・海岸線", detail: detailSetFor(1) },
  { id: 3, cat: "commercial", src: "https://images.unsplash.com/photo-1523293182086-7651a899d37f?w=800&q=80", title: "商業・靜物", detail: detailSetFor(2) },
  { id: 4, cat: "portrait", src: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=800&q=80", title: "形象・窗邊", detail: detailSetFor(3) },
  { id: 5, cat: "wedding", src: "https://images.unsplash.com/photo-1606800052052-a08af7148866?w=800&q=80", title: "婚紗・儀式", detail: detailSetFor(4) },
  { id: 6, cat: "commercial", src: "https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?w=800&q=80", title: "商業・空間", detail: detailSetFor(5) },
  { id: 7, cat: "portrait", src: "https://images.unsplash.com/photo-1522673607200-164d1b6ce486?w=800&q=80", title: "形象・黑白", detail: detailSetFor(0) },
  { id: 8, cat: "wedding", src: "https://images.unsplash.com/photo-1583939003579-730e3918a45a?w=800&q=80", title: "婚紗・晚宴", detail: detailSetFor(1) },
  { id: 9, cat: "cinematic", src: "https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=800&q=80", title: "影畫創作・光影敘事", detail: detailSetFor(2) },
  { id: 10, cat: "cinematic", src: "https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=800&q=80", title: "影畫創作・城市夜色", detail: detailSetFor(3) },
  { id: 11, cat: "cinematic", src: "https://images.unsplash.com/photo-1508614999368-9260051292e5?w=800&q=80", title: "影畫創作・色彩實驗", detail: detailSetFor(4) },
];

// 各分類的名稱與測試用照片池（拿來補足到每分類至少 24 張，僅為展示用測試資料）
const CATEGORY_LABELS = { portrait: "形象", wedding: "婚紗", commercial: "商業", cinematic: "影畫創作", mixed_media: "拍畫品" };
const CATEGORY_STOCK_POOLS = {
  portrait: [
    "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=800&q=80",
    "https://images.unsplash.com/photo-1500048993953-d23a436266cf?w=800&q=80",
    "https://images.unsplash.com/photo-1522673607200-164d1b6ce486?w=800&q=80",
    "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=800&q=80",
    "https://images.unsplash.com/photo-1519699047748-de8e457a634e?w=800&q=80",
    "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800&q=80",
  ],
  wedding: [
    "https://images.unsplash.com/photo-1519741497674-611481863552?w=800&q=80",
    "https://images.unsplash.com/photo-1606800052052-a08af7148866?w=800&q=80",
    "https://images.unsplash.com/photo-1583939003579-730e3918a45a?w=800&q=80",
    "https://images.unsplash.com/photo-1520854221256-17451cc331bf?w=800&q=80",
    "https://images.unsplash.com/photo-1533105079780-92b9be482077?w=800&q=80",
    "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=800&q=80",
  ],
  commercial: [
    "https://images.unsplash.com/photo-1523293182086-7651a899d37f?w=800&q=80",
    "https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?w=800&q=80",
    "https://images.unsplash.com/photo-1495366691023-cbcabbb87e8b?w=800&q=80",
    "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=800&q=80",
    "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=800&q=80",
    "https://images.unsplash.com/photo-1470075801209-17f9ec0cada6?w=800&q=80",
  ],
  cinematic: [
    "https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=800&q=80",
    "https://images.unsplash.com/photo-1508614999368-9260051292e5?w=800&q=80",
    "https://images.unsplash.com/photo-1465146344425-f00d5f5c8f07?w=800&q=80",
    "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=800&q=80",
    "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=800&q=80",
    "https://images.unsplash.com/photo-1495366691023-cbcabbb87e8b?w=800&q=80",
  ],
  mixed_media: [
    "https://images.unsplash.com/photo-1541961017774-22349e4a1262?w=800&q=80",
    "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=800&q=80",
    "https://images.unsplash.com/photo-1547891654-e66ed7ebb968?w=800&q=80",
    "https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?w=800&q=80",
    "https://images.unsplash.com/photo-1536924940846-227afb31e2a5?w=800&q=80",
    "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=800&q=80",
  ],
};

// 幫每個分類補足測試作品到 targetCount 張（每頁 12 張、至少 2 頁＝24 張），
// 純粹是展示用測試資料，之後接正式後端會換成攝影師實際上傳的作品。
function fillCategory(cat, idOffset, targetCount, existingCount) {
  const pool = CATEGORY_STOCK_POOLS[cat];
  const label = CATEGORY_LABELS[cat];
  const need = Math.max(0, targetCount - existingCount);
  return Array.from({ length: need }).map((_, i) => {
    const n = existingCount + i + 1;
    return { id: idOffset + i, cat, src: pool[i % pool.length], title: `${label}・作品 ${String(n).padStart(2, "0")}`, detail: detailSetFor(i) };
  });
}

const PORTFOLIO_TARGET_PER_CATEGORY = 24;
const PHOTOS_PORTFOLIO = [
  ...PHOTOS_PORTFOLIO_CURATED,
  ...fillCategory("portrait", 100, PORTFOLIO_TARGET_PER_CATEGORY, 3),
  ...fillCategory("wedding", 200, PORTFOLIO_TARGET_PER_CATEGORY, 3),
  ...fillCategory("commercial", 300, PORTFOLIO_TARGET_PER_CATEGORY, 2),
  ...fillCategory("cinematic", 400, PORTFOLIO_TARGET_PER_CATEGORY, 3),
  ...fillCategory("mixed_media", 500, PORTFOLIO_TARGET_PER_CATEGORY, 0),
];

const CATS = [
  { key: "all", label: "全部" },
  { key: "portrait", label: "形象攝影" },
  { key: "wedding", label: "婚紗攝影" },
  { key: "commercial", label: "商業攝影" },
  { key: "cinematic", label: "影畫創作" },
  { key: "mixed_media", label: "拍畫品" },
];

const PORTFOLIO_PAGE_SIZE = 12;



// 首頁動態主視覺：每張照片搭配一組文字（主標／副標／分類），輪播時一起淡入淡出
const HERO_SLIDES = [
  { src: "https://images.unsplash.com/photo-1519741497674-611481863552?w=1600&q=80", headline: "用光線，顯影", sub: "生命中的瞬間", cat: "婚紗攝影" },
  { src: "https://images.unsplash.com/photo-1500048993953-d23a436266cf?w=1600&q=80", headline: "看見最好的自己", sub: "形象攝影・寫真", cat: "形象攝影" },
  { src: "https://images.unsplash.com/photo-1523293182086-7651a899d37f?w=1600&q=80", headline: "讓影像成為你的故事", sub: "商業攝影", cat: "商業攝影" },
  { src: "https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=1600&q=80", headline: "留住值得記住的時刻", sub: "影畫創作", cat: "影畫創作" },
  { src: "https://images.unsplash.com/photo-1606800052052-a08af7148866?w=1600&q=80", headline: "美攝影工作室", sub: "新北市・預約制工作室", cat: "婚紗攝影" },
];

const PLANS = [
  { frame: "01", name: "形象方案", price: "NT$ 6,800", unit: "／ 2 小時", features: ["1 位攝影師", "1 個場景", "精修 15 張", "線上選片交件"] },
  { frame: "02", name: "婚紗方案", price: "NT$ 28,000", unit: "／ 全天", features: ["2 位攝影師", "多場景外拍", "精修 60 張", "婚紗相本一本", "線上選片交件"], featured: true },
  { frame: "03", name: "商業方案", price: "NT$ 12,000", unit: "／ 半天", features: ["1 位攝影師", "棚拍或到府", "精修 20 張", "商用授權", "線上選片交件"] },
];

/* ---------------- P2 資料：預約服務 / 時段 ---------------- */

const SERVICES = [
  { id: "id_photo", name: "證件照", duration: "約 30 分鐘", price: "NT$ 300", priceValue: 300 },
  { id: "portrait", name: "個人寫真", duration: "約 2 小時", price: "NT$ 6,800", priceValue: 6800 },
  { id: "family", name: "全家福", duration: "約 1.5 小時", price: "NT$ 4,500", priceValue: 4500 },
  { id: "business", name: "商業形象照", duration: "約 1 小時", price: "NT$ 3,500", priceValue: 3500 },
  { id: "ai_portrait", name: "AI 藝術肖像", duration: "約 15 分鐘", price: "NT$ 1,200", priceValue: 1200 },
];

const TIME_SLOTS = ["10:00", "11:00", "13:00", "14:00", "15:00", "16:00", "17:00"];

/* ---------------- P4 資料：訂單狀態（P5 新增「客戶已選片」） ---------------- */

const ORDER_STATUSES = ["待付款", "已付款", "已預約", "拍攝完成", "待選片", "客戶已選片", "修圖中", "已完成", "已取消"];
const ORDER_STATUS_STYLE = {
  "待付款": "msy-status-pending",
  "已付款": "msy-status-confirmed",
  "已預約": "msy-status-confirmed",
  "拍攝完成": "msy-status-pending",
  "待選片": "msy-status-pending",
  "客戶已選片": "msy-status-pending",
  "修圖中": "msy-status-pending",
  "已完成": "msy-status-confirmed",
  "已取消": "msy-status-cancelled",
};

/* ---------------- P5 資料：測試照片縮圖池 ---------------- */

const PHOTO_POOL = [
  "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=500&q=80",
  "https://images.unsplash.com/photo-1500048993953-d23a436266cf?w=500&q=80",
  "https://images.unsplash.com/photo-1522673607200-164d1b6ce486?w=500&q=80",
  "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=500&q=80",
  "https://images.unsplash.com/photo-1519699047748-de8e457a634e?w=500&q=80",
  "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=500&q=80",
  "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=500&q=80",
  "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=500&q=80",
  "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=500&q=80",
];

function todayStr(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}
function nowStr() {
  const d = new Date();
  return `${todayStr(0)} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function normalizePhone(phone) { return (phone || "").replace(/\D/g, ""); }
function normalizeEmail(email) { return (email || "").trim().toLowerCase(); }
function formatMoney(n) { return `NT$ ${(n || 0).toLocaleString()}`; }

/* ---------------- P6：日期範圍輔助函式 ---------------- */
function dateStr(d) { return d.toISOString().slice(0, 10); }
function weekRange() {
  const d = new Date();
  const day = d.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(d); monday.setDate(d.getDate() + diffToMonday);
  const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
  return [dateStr(monday), dateStr(sunday)];
}
function monthRange() {
  const d = new Date();
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return [dateStr(first), dateStr(last)];
}
const RANGE_OPTIONS = [
  { key: "today", label: "今天" },
  { key: "tomorrow", label: "明天" },
  { key: "week", label: "本週" },
  { key: "month", label: "本月" },
];
function rangeFor(key) {
  if (key === "today") return [todayStr(0), todayStr(0)];
  if (key === "tomorrow") return [todayStr(1), todayStr(1)];
  if (key === "week") return weekRange();
  return monthRange();
}

/* ---------------- P7：自動通知中心 ---------------- */

const NOTIFICATION_TYPE_LABELS = {
  booking_complete: "預約完成",
  booking_cancelled: "預約取消",
  order_created: "訂單建立",
  payment_complete: "付款完成",
  selection_complete: "客戶完成選片",
  retouch_start: "開始修圖",
  retouch_complete: "修圖完成",
  ready_for_delivery: "照片／成品可交件",
};

const NOTIFICATION_TEMPLATES = {
  booking_complete: (c) => `您好，${c.customerName}，您的美攝影預約已完成，預約編號為 ${c.bookingId}，拍攝日期為 ${c.date} ${c.time}。`,
  booking_cancelled: (c) => `您好，${c.customerName}，您的預約（編號 ${c.bookingId || "—"}）已取消，如有需要歡迎重新預約。`,
  order_created: (c) => `您好，${c.customerName}，我們已為您的預約建立訂單 ${c.orderId}，感謝您的預約。`,
  payment_complete: (c) => `您好，${c.customerName}，您的訂單 ${c.orderId} 已確認付款，謝謝您的預約。`,
  selection_complete: (c) => `您好，${c.customerName}，您的照片選片已完成，我們將進入後續製作流程。`,
  retouch_start: (c) => `您好，${c.customerName}，您的訂單 ${c.orderId} 已開始進行修圖，請耐心等候。`,
  retouch_complete: (c) => `您好，${c.customerName}，您的照片已完成修圖，請依通知方式確認交件。`,
  ready_for_delivery: (c) => `您好，${c.customerName}，您的照片／成品已可交件，請與工作室聯繫安排取件或下載方式。`,
};

/* 這兩個函式目前只是「模擬發送」，不會真的寄出任何東西。
   未來接正式後端時，把裡面的實作換成真正呼叫 Email／LINE API 即可，
   呼叫這兩個函式的地方（addNotificationEvent）完全不需要更動。 */
function sendEmail(notification) {
  // TODO(正式上線)：改成呼叫真正的 Email 服務，例如 SendGrid、AWS SES
  return { ...notification, status: "已模擬發送" };
}
function sendLine(notification) {
  // TODO(正式上線)：改成呼叫真正的 LINE Messaging API
  return { ...notification, status: "已模擬發送" };
}

/* ---------------- 測試種子資料（客戶 + 預約 + 訂單 + 相簿 + 照片，互相連動） ---------------- */

// P8：password 為「開發/測試用途」明文密碼，僅供本階段前端展示登入流程使用，
// 正式上線前必須整個換成後端雜湊驗證，絕對不可以這種方式儲存真實密碼。
const SEED_CUSTOMERS = [
  { id: "CUS-1", name: "王小美", phone: "0911-222-333", email: "test1@example.com", note: "", createdAt: todayStr(-10), password: "test1234" },
  { id: "CUS-2", name: "陳大文", phone: "0922-333-444", email: "test2@example.com", note: "希望戶外拍攝", createdAt: todayStr(1), password: "test1234" },
  { id: "CUS-3", name: "林小華", phone: "0933-444-555", email: "test3@example.com", note: "", createdAt: todayStr(2), password: "test1234" },
];

const SEED_BOOKINGS = [
  { id: "MSY-1000", customerId: "CUS-1", serviceId: "family", serviceName: "全家福", amount: 4500, date: todayStr(-10), time: "11:00", name: "王小美", phone: "0911-222-333", email: "test1@example.com", note: "", status: "已確認" },
  { id: "MSY-1001", customerId: "CUS-1", serviceId: "portrait", serviceName: "個人寫真", amount: 6800, date: todayStr(-3), time: "14:00", name: "王小美", phone: "0911-222-333", email: "test1@example.com", note: "", status: "已確認" },
  { id: "MSY-1002", customerId: "CUS-2", serviceId: "family", serviceName: "全家福", amount: 4500, date: todayStr(1), time: "15:00", name: "陳大文", phone: "0922-333-444", email: "test2@example.com", note: "希望戶外拍攝", status: "已確認" },
  { id: "MSY-1003", customerId: "CUS-3", serviceId: "id_photo", serviceName: "證件照", amount: 300, date: todayStr(2), time: "10:00", name: "林小華", phone: "0933-444-555", email: "test3@example.com", note: "", status: "已確認" },
];

// ORD-1001（王小美・個人寫真）刻意設定為「待選片」，方便直接測試 P5 選片流程
const SEED_ORDERS = [
  { id: "ORD-1000", bookingId: "MSY-1000", customerId: "CUS-1", customerName: "王小美", phone: "0911-222-333", serviceId: "family", serviceName: "全家福", amount: 4500, date: todayStr(-10), time: "11:00", status: "已完成", paymentMethod: null, paymentReference: null, createdAt: todayStr(-10) },
  { id: "ORD-1001", bookingId: "MSY-1001", customerId: "CUS-1", customerName: "王小美", phone: "0911-222-333", serviceId: "portrait", serviceName: "個人寫真", amount: 6800, date: todayStr(-3), time: "14:00", status: "待選片", paymentMethod: null, paymentReference: null, createdAt: todayStr(-3) },
  { id: "ORD-1002", bookingId: "MSY-1002", customerId: "CUS-2", customerName: "陳大文", phone: "0922-333-444", serviceId: "family", serviceName: "全家福", amount: 4500, date: todayStr(1), time: "15:00", status: "待付款", paymentMethod: null, paymentReference: null, createdAt: todayStr(0) },
  { id: "ORD-1003", bookingId: "MSY-1003", customerId: "CUS-3", customerName: "林小華", phone: "0933-444-555", serviceId: "id_photo", serviceName: "證件照", amount: 300, date: todayStr(2), time: "10:00", status: "已付款", paymentMethod: null, paymentReference: null, createdAt: todayStr(0) },
];

const SEED_ALBUMS = [
  { id: "ALB-1000", orderId: "ORD-1001", name: "個人寫真 - 王小美", createdAt: todayStr(-2), confirmed: false, confirmedAt: null },
];

const SEED_PHOTOS = Array.from({ length: 8 }).map((_, i) => ({
  id: `PHO-100${i}`,
  albumId: "ALB-1000",
  orderId: "ORD-1001",
  name: `DSC_04${10 + i}`,
  thumbnailUrl: PHOTO_POOL[i % PHOTO_POOL.length],
  selected: false,
  retouchStatus: "未修圖",
}));

let bookingCounter = 1004;
let orderCounter = 1004;
let customerCounter = 4;
let albumCounter = 1001;
let photoCounter = 1008;
let notificationCounter = 1000;
let auditLogCounter = 1000;

export default function StudioSite() {
  const [filter, setFilter] = useState("all");
  const [portfolioPage, setPortfolioPage] = useState(0);
  const [portfolioLightbox, setPortfolioLightbox] = useState(null); // { photo, pageIndex }
  const [page, setPage] = useState("site"); // site | admin | gallery | ops | notifications | login | member

  // 首頁動態主視覺：每 4 秒自動切換一張，用透明度淡入淡出（不是硬切）
  const [heroIndex, setHeroIndex] = useState(0);
  useEffect(() => {
    if (page !== "site") return;
    const timer = setInterval(() => setHeroIndex((i) => (i + 1) % HERO_SLIDES.length), 4000);
    return () => clearInterval(timer);
  }, [page]);
  // P8-3A：後台管理員的登入狀態，來自 Supabase 真正回傳的 access token 與角色。
  // 這裡雖然還是存在 React state（因為整個 app 都是前端記憶體），
  // 但 role 這個值是「向伺服器查證過」的，不是前端自己說了算。
  const [adminSession, setAdminSession] = useState(null); // { accessToken, role, email }
  const [adminAuthError, setAdminAuthError] = useState("");
  const [adminAuthLoading, setAdminAuthLoading] = useState(false);

  async function handleAdminLoginSubmit(email, password) {
    setAdminAuthLoading(true);
    setAdminAuthError("");
    const loginResult = await supabaseLogin(email, password);
    if (!loginResult.success) {
      setAdminAuthLoading(false);
      setAdminAuthError(loginResult.message);
      return;
    }
    const role = await supabaseFetchOwnRole(loginResult.accessToken);
    setAdminAuthLoading(false);
    if (role !== "admin") {
      // 帳號密碼正確，但角色不是 admin（例如一般會員帳號）——一律拒絕進入後台。
      setAdminAuthError("此帳號沒有後台管理權限");
      return;
    }
    setAdminSession({ accessToken: loginResult.accessToken, refreshToken: loginResult.refreshToken, role, email: loginResult.email });
  }
  async function handleAdminLogout() {
    if (adminSession) await supabaseLogout(adminSession.accessToken);
    setAdminSession(null);
    setPage("site");
  }

  // ---- 作品展示頁的防拷貝措施（僅在瀏覽公開官網時啟用，後台/會員中心不受影響）----
  // 誠實地說在這裡：這些都是「增加隨手複製的門檻」，不是真正的 DRM。
  // 懂技術的人（開發者工具、停用 JS、螢幕錄影軟體、手機拍照）都能繞過。
  // PrintScreen 尤其完全無法被網頁 JavaScript 擋下——那是作業系統層級的功能，
  // 這裡刻意不做「假裝擋得住」的實作。
  const [windowBlurred, setWindowBlurred] = useState(false);
  useEffect(() => {
    if (page !== "site") return; // 只在公開官網頁面套用，後台/會員中心維持正常瀏覽器行為

    const blockContextMenu = (e) => e.preventDefault();
    const blockDragStart = (e) => e.preventDefault();
    const blockSelectStart = (e) => e.preventDefault();
    const blockKeys = (e) => {
      const key = e.key;
      // F12：嘗試阻擋開發者工具捷徑（可被其他方式繞過，僅為嚇阻）
      if (key === "F12") { e.preventDefault(); return; }
      // Ctrl+S 存檔 / Ctrl+P 列印
      if ((e.ctrlKey || e.metaKey) && (key === "s" || key === "S" || key === "p" || key === "P")) { e.preventDefault(); return; }
      // Ctrl+Shift+I / Ctrl+Shift+J 常見的開發者工具快捷鍵，一併嘗試阻擋
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (key === "I" || key === "i" || key === "J" || key === "j")) { e.preventDefault(); return; }
    };
    const handleBlur = () => setWindowBlurred(true);
    const handleFocus = () => setWindowBlurred(false);

    document.addEventListener("contextmenu", blockContextMenu);
    document.addEventListener("dragstart", blockDragStart);
    document.addEventListener("selectstart", blockSelectStart);
    document.addEventListener("keydown", blockKeys);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);

    return () => {
      document.removeEventListener("contextmenu", blockContextMenu);
      document.removeEventListener("dragstart", blockDragStart);
      document.removeEventListener("selectstart", blockSelectStart);
      document.removeEventListener("keydown", blockKeys);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
    };
  }, [page]);
  const [adminTab, setAdminTab] = useState("bookings"); // bookings | orders | customers

  // P8：會員登入狀態。currentCustomerId 為 null 代表尚未登入。
  const [currentCustomerId, setCurrentCustomerId] = useState(null);
  const [galleryDirectOrderId, setGalleryDirectOrderId] = useState(null); // 從會員中心直接開啟指定訂單的相簿

  function openGalleryForOrder(orderId) { setGalleryDirectOrderId(orderId); setPage("gallery"); }
  function openGalleryLookup() { setGalleryDirectOrderId(null); setPage("gallery"); }

  // 導覽跳轉改用 JS 直接捲動到目標區塊，不依賴瀏覽器的錨點(#id)跳轉行為，
  // 避免在某些預覽環境下錨點跳轉失效或被固定導覽列擋住的問題。
  // 如果目前不在官網首頁，會先切換回首頁，再等畫面完成渲染後捲動。
  function goToSection(id) {
    setPage("site");
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el = document.getElementById(id);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  }
  function goHome() {
    setPage("site");
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    });
  }

  // P6：從營運中心點擊項目時，用來把使用者導向「訂單管理」裡指定的訂單／篩選狀態
  const [jumpOrderId, setJumpOrderId] = useState(null);
  const [jumpStatusFilter, setJumpStatusFilter] = useState(null);
  const [jumpToken, setJumpToken] = useState(0);

  function jumpToOrder(orderId) {
    setPage("admin"); setAdminTab("orders");
    setJumpOrderId(orderId); setJumpStatusFilter(null);
    setJumpToken((t) => t + 1);
  }
  function jumpToOrdersFiltered(statusFilter) {
    setPage("admin"); setAdminTab("orders");
    setJumpOrderId(null); setJumpStatusFilter(statusFilter);
    setJumpToken((t) => t + 1);
  }

  const [customers, setCustomers] = useState(SEED_CUSTOMERS);
  const [bookings, setBookings] = useState(SEED_BOOKINGS);
  const [orders, setOrders] = useState(SEED_ORDERS);
  const [albums, setAlbums] = useState(SEED_ALBUMS);
  const [photos, setPhotos] = useState(SEED_PHOTOS);
  const [notifications, setNotifications] = useState([]); // P7：通知紀錄，測試階段從空清單開始，事件發生時才建立
  const [auditLogs, setAuditLogs] = useState([]); // P8-3：客戶資料異動的變更紀錄（誰改了什麼、改前改後、成功或失敗）

  function logAudit(entry) {
    setAuditLogs((prev) => [{ id: `LOG-${auditLogCounter++}`, timestamp: nowStr(), ...entry }, ...prev]);
  }

  // 預約流程狀態
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ serviceId: "", date: "", time: "", name: "", phone: "", contactMethod: "email", email: "", lineId: "", note: "" });
  const [errors, setErrors] = useState({});
  const [confirmedBooking, setConfirmedBooking] = useState(null);

  const shownPhotos = filter === "all" ? PHOTOS_PORTFOLIO : PHOTOS_PORTFOLIO.filter((p) => p.cat === filter);
  const isSlotTaken = (date, time) => bookings.some((b) => b.date === date && b.time === time && b.status === "已確認");

  function findExistingCustomer(phone, email) {
    const p = normalizePhone(phone);
    const e = normalizeEmail(email);
    return customers.find((c) => (p && normalizePhone(c.phone) === p) || (e && normalizeEmail(c.email) === e));
  }

  // ---- P8：會員登入／註冊（開發測試用明文密碼比對，見檔案頂端安全性說明）----
  function loginCustomer(phone, password) {
    const p = normalizePhone(phone);
    const customer = customers.find((c) => normalizePhone(c.phone) === p);
    if (!customer) return { success: false, message: "查無此電話對應的會員資料，請確認電話是否正確，或改用下方「註冊」建立帳號" };
    if (!customer.password) return { success: false, message: "此帳號尚未設定登入密碼，請到「註冊」畫面用同一組電話設定密碼" };
    if (customer.password !== password) return { success: false, message: "密碼錯誤，請再試一次" };
    setCurrentCustomerId(customer.id);
    return { success: true };
  }
  function registerCustomer({ name, phone, email, password }) {
    if (!name.trim()) return { success: false, message: "請填寫姓名" };
    if (!/^09\d{2}-?\d{3}-?\d{3}$/.test(phone.trim())) return { success: false, message: "電話格式錯誤，例如 0912-345-678" };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return { success: false, message: "Email 格式錯誤" };
    if (password.length < 4) return { success: false, message: "密碼長度至少 4 碼（測試環境的簡化規則）" };
    const existing = findExistingCustomer(phone, email);
    if (existing) {
      if (existing.password) return { success: false, message: "此電話或 Email 已經註冊過帳號，請直接登入" };
      // 這位客戶先前是透過預約自動建檔、還沒設定過密碼——幫他把登入資訊補上，不重複建立客戶
      updateCustomer(existing.id, { password });
      setCurrentCustomerId(existing.id);
      return { success: true, claimed: true };
    }
    const created = addCustomer({ name: name.trim(), phone: phone.trim(), email: email.trim(), note: "", password });
    setCurrentCustomerId(created.id);
    return { success: true, claimed: false };
  }
  function logoutCustomer() { setCurrentCustomerId(null); setPage("site"); }

  // ---- P8-2：會員自行編輯個人資料（僅限本人，僅限姓名/電話/Email；customerId 永遠不可變）----
  function updateMemberProfile(customerId, patch) {
    const before = customers.find((c) => c.id === customerId);
    const fail = (message) => {
      logAudit({ actorType: "member", actorId: customerId, targetCustomerId: customerId, changes: null, result: "rejected", reason: message });
      return { success: false, message };
    };
    if (!patch.name.trim()) return fail("姓名不可空白");
    if (!/^09\d{2}-?\d{3}-?\d{3}$/.test(patch.phone.trim())) return fail("電話格式錯誤，例如 0912-345-678");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(patch.email.trim())) return fail("Email 格式錯誤");
    const p = normalizePhone(patch.phone);
    const e = normalizeEmail(patch.email);
    // 排除自己，檢查電話或 Email 是否跟「別的」既有客戶重複，避免改完之後跟別人撞號、甚至意外產生第二個客戶
    const conflict = customers.find((c) => c.id !== customerId && (normalizePhone(c.phone) === p || normalizeEmail(c.email) === e));
    if (conflict) return fail("這組電話或 Email 已經被其他會員使用，請確認後再修改");
    const after = { name: patch.name.trim(), phone: patch.phone.trim(), email: patch.email.trim() };
    updateCustomer(customerId, after);
    logAudit({
      actorType: "member", actorId: customerId, targetCustomerId: customerId, result: "success",
      changes: { name: { before: before?.name, after: after.name }, phone: { before: before?.phone, after: after.phone }, email: { before: before?.email, after: after.email } },
    });
    return { success: true };
  }

  // ---- P8-3：後台人員編輯客戶資料——補上原本缺少的「排除自己後檢查電話/Email 是否與其他客戶重複」檢查，
  // 並記錄變更紀錄。這是唯一給後台使用的客戶資料修改入口（取代原本直接傳入 updateCustomer）。
  function updateCustomerByStaff(id, patch) {
    const before = customers.find((c) => c.id === id);
    const fail = (message) => {
      logAudit({ actorType: "staff", actorId: "staff", targetCustomerId: id, changes: null, result: "rejected", reason: message });
      return { success: false, message };
    };
    if (!patch.name.trim()) return fail("姓名不可空白");
    if (!/^09\d{2}-?\d{3}-?\d{3}$/.test(patch.phone.trim())) return fail("電話格式錯誤，例如 0912-345-678");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(patch.email.trim())) return fail("Email 格式錯誤");
    const p = normalizePhone(patch.phone);
    const e = normalizeEmail(patch.email);
    const conflict = customers.find((c) => c.id !== id && (normalizePhone(c.phone) === p || normalizeEmail(c.email) === e));
    if (conflict) return fail("這組電話或 Email 已經被其他客戶使用，請確認後再修改");
    const after = { name: patch.name.trim(), phone: patch.phone.trim(), email: patch.email.trim(), note: (patch.note || "").trim() };
    updateCustomer(id, after);
    logAudit({
      actorType: "staff", actorId: "staff", targetCustomerId: id, result: "success",
      changes: { name: { before: before?.name, after: after.name }, phone: { before: before?.phone, after: after.phone }, email: { before: before?.email, after: after.email }, note: { before: before?.note, after: after.note } },
    });
    return { success: true };
  }

  /* ---- 資料異動函式（未來換成呼叫後端 API 就從這裡改）---- */
  function addCustomer(data) {
    const newCustomer = { id: `CUS-${customerCounter++}`, password: null, ...data, createdAt: todayStr(0) };
    setCustomers((prev) => [...prev, newCustomer]);
    return newCustomer;
  }
  function updateCustomer(id, patch) { setCustomers((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c))); }
  function deleteCustomer(id) {
    setCustomers((prev) => prev.filter((c) => c.id !== id));
    setBookings((prev) => prev.map((b) => (b.customerId === id ? { ...b, customerId: null } : b)));
    setOrders((prev) => prev.map((o) => (o.customerId === id ? { ...o, customerId: null } : o)));
  }
  function addBooking(data) { setBookings((prev) => [...prev, data]); }
  function addOrder(data) { setOrders((prev) => [...prev, data]); }

  // ---- P7：通知中心 ----
  // 同一事件只在「狀態真的改變」時才會建立通知（見 changeOrderStatus 的防重複判斷），
  // 避免重新整理畫面或重複點擊造成通知無限增加。
  function addNotificationEvent(type, ctx) {
    ["Email", "LINE"].forEach((channel) => {
      const base = {
        id: `NTF-${notificationCounter++}`,
        customerId: ctx.customerId || null,
        bookingId: ctx.bookingId || null,
        orderId: ctx.orderId || null,
        customerName: ctx.customerName || "",
        phone: ctx.phone || "",
        type,
        channel,
        message: NOTIFICATION_TEMPLATES[type](ctx),
        createdAt: nowStr(),
        status: "已模擬發送",
        isTest: true,
      };
      const sent = channel === "Email" ? sendEmail(base) : sendLine(base);
      setNotifications((prev) => [sent, ...prev]);
    });
  }
  function markNotificationProcessed(id, processed) {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, status: processed ? "已處理" : "已模擬發送" } : n)));
  }

  // 訂單狀態的唯一異動入口：先檢查狀態是否真的改變（防止重複通知），
  // 再依照新狀態自動建立對應的 P7 通知。
  function changeOrderStatus(orderId, newStatus) {
    const order = orders.find((o) => o.id === orderId);
    if (!order || order.status === newStatus) return; // 狀態沒變就不重複動作、也不重複通知
    setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o)));
    const ctx = { customerId: order.customerId, customerName: order.customerName, phone: order.phone, bookingId: order.bookingId, orderId: order.id, date: order.date, time: order.time };
    if (newStatus === "已付款") addNotificationEvent("payment_complete", ctx);
    else if (newStatus === "客戶已選片") addNotificationEvent("selection_complete", ctx);
    else if (newStatus === "修圖中") addNotificationEvent("retouch_start", ctx);
    else if (newStatus === "已完成") { addNotificationEvent("retouch_complete", ctx); addNotificationEvent("ready_for_delivery", ctx); }
    else if (newStatus === "已取消") addNotificationEvent("booking_cancelled", ctx);
  }

  function cancelBookingCascade(bookingId) {
    const booking = bookings.find((b) => b.id === bookingId);
    if (!booking || booking.status === "已取消") return;
    setBookings((prev) => prev.map((b) => (b.id === bookingId ? { ...b, status: "已取消" } : b)));
    const order = orders.find((o) => o.bookingId === bookingId);
    if (order && order.status !== "已取消") {
      changeOrderStatus(order.id, "已取消");
    } else if (!order) {
      addNotificationEvent("booking_cancelled", { customerId: booking.customerId, customerName: booking.name, phone: booking.phone, bookingId: booking.id, orderId: null });
    }
  }
  function cancelOrder(orderId) {
    const order = orders.find((o) => o.id === orderId);
    if (!order || order.status === "已取消") return;
    changeOrderStatus(orderId, "已取消");
    if (order.bookingId) setBookings((prev) => prev.map((b) => (b.id === order.bookingId ? { ...b, status: "已取消" } : b)));
  }
  function updateOrderStatus(orderId, status) {
    if (status === "已取消") { cancelOrder(orderId); return; }
    changeOrderStatus(orderId, status);
  }

  // ---- P5：相簿與照片 ----
  function createAlbum(orderId, name) {
    const album = { id: `ALB-${albumCounter++}`, orderId, name, createdAt: todayStr(0), confirmed: false, confirmedAt: null };
    setAlbums((prev) => [...prev, album]);
    setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: "待選片" } : o)));
    return album;
  }
  function addTestPhotos(albumId, orderId, count = 6) {
    const batch = Array.from({ length: count }).map(() => {
      const p = { id: `PHO-${photoCounter}`, albumId, orderId, name: `DSC_${photoCounter}`, thumbnailUrl: PHOTO_POOL[photoCounter % PHOTO_POOL.length], selected: false, retouchStatus: "未修圖" };
      photoCounter++;
      return p;
    });
    setPhotos((prev) => [...prev, ...batch]);
  }
  function togglePhotoSelected(photoId) {
    setPhotos((prev) => prev.map((p) => (p.id === photoId ? { ...p, selected: !p.selected } : p)));
  }
  function confirmSelection(albumId) {
    const album = albums.find((a) => a.id === albumId);
    if (!album) return;
    setAlbums((prev) => prev.map((a) => (a.id === albumId ? { ...a, confirmed: true, confirmedAt: nowStr() } : a)));
    changeOrderStatus(album.orderId, "客戶已選片");
  }
  function reopenSelection(albumId) {
    setAlbums((prev) => prev.map((a) => (a.id === albumId ? { ...a, confirmed: false, confirmedAt: null } : a)));
  }
  function markRetouching(orderId) {
    changeOrderStatus(orderId, "修圖中");
    const album = albums.find((a) => a.orderId === orderId);
    if (album) setPhotos((prev) => prev.map((p) => (p.albumId === album.id && p.selected ? { ...p, retouchStatus: "修圖中" } : p)));
  }
  function markCompleted(orderId) {
    changeOrderStatus(orderId, "已完成");
    const album = albums.find((a) => a.orderId === orderId);
    if (album) setPhotos((prev) => prev.map((p) => (p.albumId === album.id && p.selected ? { ...p, retouchStatus: "已完成" } : p)));
  }
  /* ------------------------------------------------------- */

  function resetBookingFlow() {
    setStep(1);
    setForm({ serviceId: "", date: "", time: "", name: "", phone: "", contactMethod: "email", email: "", lineId: "", note: "" });
    setErrors({});
    setConfirmedBooking(null);
  }
  function selectService(id) { setForm((f) => ({ ...f, serviceId: id })); setStep(2); }
  function selectDate(date) { setForm((f) => ({ ...f, date, time: "" })); setStep(3); }
  function selectTime(time) {
    if (isSlotTaken(form.date, time)) return;
    setForm((f) => ({ ...f, time }));
    setStep(4);
  }
  function validateContact() {
    const e = {};
    if (!form.name.trim()) e.name = "請填寫姓名";
    if (!/^09\d{2}-?\d{3}-?\d{3}$/.test(form.phone.trim())) e.phone = "請填寫正確的手機號碼格式，例如 0912-345-678";
    if (form.contactMethod === "email") {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) e.email = "請填寫正確的 Email 格式";
    } else {
      if (!form.lineId.trim()) e.lineId = "請填寫 LINE ID";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }
  function submitBooking() {
    if (!validateContact()) return;
    if (isSlotTaken(form.date, form.time)) { setErrors({ time: "此時段剛被預約，請重新選擇時段" }); setStep(3); return; }
    const service = SERVICES.find((s) => s.id === form.serviceId);
    const contactEmail = form.contactMethod === "email" ? form.email.trim() : "";
    const contactLineId = form.contactMethod === "line" ? form.lineId.trim() : "";
    let customer = findExistingCustomer(form.phone, contactEmail);
    let isNew = false;
    if (!customer) { customer = addCustomer({ name: form.name.trim(), phone: form.phone.trim(), email: contactEmail, lineId: contactLineId, note: form.note.trim() }); isNew = true; }
    const bookingId = `MSY-${bookingCounter++}`;
    const newBooking = { id: bookingId, customerId: customer.id, serviceId: service.id, serviceName: service.name, amount: service.priceValue, date: form.date, time: form.time, name: form.name.trim(), phone: form.phone.trim(), email: contactEmail, lineId: contactLineId, note: form.note.trim(), status: "已確認" };
    addBooking(newBooking);
    const newOrder = { id: `ORD-${orderCounter++}`, bookingId, customerId: customer.id, customerName: newBooking.name, phone: newBooking.phone, serviceId: service.id, serviceName: service.name, amount: service.priceValue, date: form.date, time: form.time, status: "待付款", paymentMethod: null, paymentReference: null, createdAt: todayStr(0) };
    addOrder(newOrder);
    const ctx = { customerId: customer.id, customerName: newBooking.name, phone: newBooking.phone, bookingId, orderId: newOrder.id, date: form.date, time: form.time };
    addNotificationEvent("booking_complete", ctx);
    addNotificationEvent("order_created", ctx);
    setConfirmedBooking({ ...newBooking, customerIsNew: isNew, orderId: newOrder.id });
    setStep(5);
  }

  return (
    <div style={styles.page}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+TC:wght@400;600&family=Noto+Sans+TC:wght@300;400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        #work, #services, #booking { scroll-margin-top: 90px; }
        .msy-body { font-family: 'Noto Sans TC', sans-serif; }
        .msy-serif { font-family: 'Noto Serif TC', serif; }
        .msy-nav-link { color: #EDE7DA; opacity: 0.8; text-decoration: none; font-size: 14px; letter-spacing: 1px; transition: opacity .2s; background: none; border: none; cursor: pointer; }
        .msy-nav-link:hover { opacity: 1; }
        .msy-tab { background: transparent; border: none; cursor: pointer; font-family: 'Noto Sans TC', sans-serif; font-size: 14px; letter-spacing: 1px; padding: 8px 18px; color: #6B6459; border-bottom: 2px solid transparent; transition: all .2s; }
        .msy-tab.active { color: #161513; border-bottom: 2px solid #B4491F; }
        .msy-card { position: relative; overflow: hidden; cursor: pointer; background: #0F0E0D; }
        .msy-card img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform .6s ease; }
        .msy-card:hover img { transform: scale(1.06); }
        .msy-frame-no { position: absolute; top: 12px; left: 12px; color: #EDE7DA; font-family: 'Noto Sans TC', monospace; font-size: 11px; letter-spacing: 2px; opacity: 0.85; background: rgba(15,14,13,0.45); padding: 3px 8px; }
        .msy-protect, .msy-protect * { user-select: none; -webkit-user-select: none; -moz-user-select: none; }
        .msy-protect img { pointer-events: none; }
        .msy-blur-protect { filter: blur(24px); transition: filter .15s ease; }
        .msy-watermark-overlay {
          position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
          color: rgba(255,255,255,0.28); font-family: 'Noto Serif TC', serif; font-size: 15px; letter-spacing: 4px;
          transform: rotate(-28deg); pointer-events: none; text-shadow: 0 1px 2px rgba(0,0,0,0.15);
        }
        @keyframes msyHeroFlow {
          from { opacity: 0; transform: translateY(18px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .msy-hero-flow { animation: msyHeroFlow 0.9s ease both; }
        .msy-card-img-fade { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; transition: opacity 1.1s ease; }
        .msy-card-title { position: absolute; bottom: 0; left: 0; right: 0; padding: 16px; color: #EDE7DA; font-size: 14px; letter-spacing: 1px; background: linear-gradient(transparent, rgba(0,0,0,0.6)); }
        .msy-plan { border: 1px solid #E3DCCB; padding: 40px 28px; position: relative; background: #FDFBF6; }
        .msy-plan.featured { border: 1px solid #B4491F; }
        .msy-btn { display: inline-block; padding: 12px 32px; border: 1px solid #EDE7DA; color: #EDE7DA; text-decoration: none; font-size: 13px; letter-spacing: 2px; transition: all .25s; background: transparent; cursor: pointer; }
        .msy-btn:hover { background: #EDE7DA; color: #161513; }
        .msy-btn-dark { border: 1px solid #161513; color: #161513; }
        .msy-btn-dark:hover { background: #161513; color: #EDE7DA; }
        .msy-btn-sm { padding: 8px 18px; font-size: 12px; }
        .msy-btn[disabled] { opacity: 0.4; cursor: not-allowed; }
        .msy-service-card { border: 1px solid #E3DCCB; background: #FDFBF6; padding: 28px 20px; cursor: pointer; text-align: left; transition: all .2s; }
        .msy-service-card:hover { border-color: #B4491F; transform: translateY(-2px); }
        .msy-service-card.selected { border-color: #B4491F; background: #FBF2E9; }
        .msy-slot { border: 1px solid #E3DCCB; background: #FDFBF6; padding: 12px 0; text-align: center; cursor: pointer; font-family: 'Noto Sans TC', sans-serif; font-size: 14px; transition: all .2s; }
        .msy-slot:hover:not(.taken) { border-color: #B4491F; color: #B4491F; }
        .msy-slot.selected { background: #B4491F; color: #FDFBF6; border-color: #B4491F; }
        .msy-slot.taken { background: #EDE7DA; color: #A8A192; cursor: not-allowed; text-decoration: line-through; }
        .msy-input { width: 100%; padding: 12px 14px; border: 1px solid #E3DCCB; background: #FDFBF6; font-family: 'Noto Sans TC', sans-serif; font-size: 14px; margin-bottom: 4px; }
        .msy-input:focus { outline: none; border-color: #B4491F; }
        .msy-label { font-family: 'Noto Sans TC', sans-serif; font-size: 13px; color: #4A453D; margin-bottom: 6px; display: block; }
        .msy-error { color: #B4491F; font-size: 12px; margin-bottom: 12px; }
        .msy-step-track { display: flex; justify-content: center; gap: 6px; margin-bottom: 48px; }
        .msy-step-dot { width: 8px; height: 8px; border-radius: 50%; background: #E3DCCB; }
        .msy-step-dot.done { background: #B4491F; }
        .msy-admin-table { width: 100%; border-collapse: collapse; font-family: 'Noto Sans TC', sans-serif; font-size: 13px; }
        .msy-admin-table th, .msy-admin-table td { border: 1px solid #E3DCCB; padding: 10px 12px; text-align: left; }
        .msy-admin-table th { background: #F4EEE1; color: #4A453D; font-weight: 500; }
        .msy-admin-table tr:hover td { background: #FBF8F1; }
        .msy-status-badge { padding: 3px 10px; font-size: 12px; display: inline-block; }
        .msy-status-confirmed { background: #E9F0E4; color: #4C6B3C; }
        .msy-status-cancelled { background: #F0E4E4; color: #8A4444; text-decoration: line-through; }
        .msy-status-pending { background: #FBF2E9; color: #B4491F; }
        .msy-admin-tabs { display: flex; gap: 4px; margin-bottom: 28px; border-bottom: 1px solid #E3DCCB; }
        .msy-admin-tab { padding: 10px 22px; background: none; border: none; cursor: pointer; font-family: 'Noto Sans TC', sans-serif; font-size: 14px; color: #6B6459; border-bottom: 2px solid transparent; margin-bottom: -1px; }
        .msy-admin-tab.active { color: #161513; border-bottom: 2px solid #B4491F; }
        .msy-modal-backdrop { position: fixed; inset: 0; background: rgba(22,21,19,0.5); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 20px; }
        .msy-modal { background: #FDFBF6; padding: 32px; max-width: 480px; width: 100%; }
        .msy-link-btn { background: none; border: none; color: #B4491F; cursor: pointer; font-family: 'Noto Sans TC', sans-serif; font-size: 13px; text-decoration: underline; padding: 0; }
        .msy-notice { background: #FBF2E9; border: 1px solid #E9C9A8; padding: 12px 16px; font-size: 13px; color: #7A4A20; margin-bottom: 20px; }
        .msy-filter-bar { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 20px; align-items: center; }
        .msy-select { padding: 12px 14px; border: 1px solid #E3DCCB; background: #FDFBF6; font-family: 'Noto Sans TC', sans-serif; font-size: 14px; }
        .msy-photo-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
        .msy-photo-tile { position: relative; aspect-ratio: 1/1; overflow: hidden; cursor: pointer; border: 2px solid transparent; background: #0F0E0D; }
        .msy-photo-tile.selected { border-color: #B4491F; }
        .msy-photo-tile img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .msy-photo-check { position: absolute; top: 8px; right: 8px; width: 26px; height: 26px; border-radius: 50%; background: rgba(253,251,246,0.9); border: 1px solid #E3DCCB; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 14px; color: #C7BFAF; font-weight: bold; }
        .msy-photo-check.on { background: #B4491F; color: #FDFBF6; border-color: #B4491F; }
        .msy-photo-name { position: absolute; bottom: 0; left: 0; right: 0; padding: 6px 8px; font-size: 11px; color: #EDE7DA; background: linear-gradient(transparent, rgba(0,0,0,0.65)); }
        .msy-lightbox-backdrop { position: fixed; inset: 0; background: rgba(15,14,13,0.9); display: flex; align-items: center; justify-content: center; z-index: 200; padding: 24px; }
        .msy-lightbox img { max-width: 90vw; max-height: 70vh; display: block; margin: 0 auto; }
        .msy-lightbox-panel { background: #FDFBF6; padding: 20px; max-width: 640px; width: 100%; }
        @media (max-width: 700px) {
          .msy-hero-title { font-size: 42px !important; }
          .msy-grid { grid-template-columns: 1fr 1fr !important; }
          .msy-plans { grid-template-columns: 1fr !important; }
          .msy-services-grid { grid-template-columns: 1fr !important; }
          .msy-slots-grid { grid-template-columns: repeat(3, 1fr) !important; }
          .msy-admin-table { font-size: 11px; }
          .msy-photo-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .msy-ops-grid { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>

      {/* NAV */}
      <nav style={{ ...styles.nav, background: "#161513", flexDirection: "column", alignItems: "stretch", padding: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "22px 6vw" }}>
          <button className="msy-nav-link" onClick={goHome} style={{ fontFamily: "'Noto Serif TC', serif", fontSize: 20, letterSpacing: 3, padding: 0 }}>美攝影</button>
          <div style={{ display: "flex", gap: 40, alignItems: "center" }}>
            {/* 第一層：品牌＋主要服務，永久清楚呈現 */}
            <div style={{ display: "flex", gap: 28, alignItems: "center" }}>
              <button className="msy-nav-link" onClick={() => goToSection("work")}>作品集</button>
              <button className="msy-nav-link" onClick={() => goToSection("services")}>服務與價格</button>
              <button className="msy-nav-link" onClick={() => goToSection("booking")}>線上預約</button>
            </div>
            {/* 第二層：會員功能，視覺上稍微收斂，跟主要服務做出區隔 */}
            <div style={{ display: "flex", gap: 20, alignItems: "center", opacity: 0.75, fontSize: 13, borderLeft: "1px solid #3A3733", paddingLeft: 24 }}>
              <button className="msy-nav-link" style={{ fontSize: 13 }} onClick={openGalleryLookup}>選片／交件</button>
              {currentCustomerId ? (
                <>
                  <button className="msy-nav-link" style={{ fontSize: 13 }} onClick={() => setPage("member")}>會員中心</button>
                  <button className="msy-nav-link" style={{ opacity: 0.7, fontSize: 12 }} onClick={logoutCustomer}>登出</button>
                </>
              ) : (
                <button className="msy-nav-link" style={{ fontSize: 13 }} onClick={() => setPage("login")}>會員登入</button>
              )}
            </div>
          </div>
        </div>

        {/* 內部管理功能：完全不出現在一般客戶畫面，只有管理員登入後才展開，並用不同色底跟客戶區隔 */}
        {adminSession && adminSession.role === "admin" && (
          <div style={{ background: "#B4491F", padding: "10px 6vw", display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
            <span className="msy-body" style={{ fontSize: 11, color: "#FDE9DD", letterSpacing: 2 }}>管理員模式</span>
            <button className="msy-nav-link" style={{ color: "#FDFBF6", fontSize: 13 }} onClick={() => setPage("ops")}>營運中心</button>
            <button className="msy-nav-link" style={{ color: "#FDFBF6", fontSize: 13, position: "relative" }} onClick={() => setPage("notifications")}>
              通知中心
              {notifications.filter((n) => n.status === "已模擬發送").length > 0 && (
                <span style={{ position: "absolute", top: -8, right: -14, background: "#D93636", color: "#FFF", fontSize: 10, fontWeight: 700, borderRadius: "999px", minWidth: 16, height: 16, padding: "0 4px", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>
                  {notifications.filter((n) => n.status === "已模擬發送").length}
                </span>
              )}
            </button>
            <button className="msy-nav-link" style={{ color: "#FDFBF6", fontSize: 13 }} onClick={() => { setPage("admin"); setAdminTab("bookings"); }}>後台管理</button>
            <button className="msy-nav-link" style={{ color: "#FDE9DD", fontSize: 12, marginLeft: "auto", opacity: 0.85 }} onClick={handleAdminLogout}>管理員登出</button>
          </div>
        )}
      </nav>

      {page === "admin" && (
        adminSession && adminSession.role === "admin" ? (
          <AdminArea
            adminTab={adminTab} setAdminTab={setAdminTab}
            bookings={bookings} customers={customers} orders={orders} albums={albums} photos={photos} auditLogs={auditLogs}
            onCancelBooking={cancelBookingCascade}
            onUpdateCustomer={updateCustomerByStaff} onDeleteCustomer={deleteCustomer}
            onUpdateOrderStatus={updateOrderStatus}
            onCreateAlbum={createAlbum} onAddTestPhotos={addTestPhotos}
            onMarkRetouching={markRetouching} onMarkCompleted={markCompleted}
            onBack={() => setPage("site")}
            jumpOrderId={jumpOrderId} jumpStatusFilter={jumpStatusFilter} jumpToken={jumpToken}
            adminEmail={adminSession.email} onLogoutAdmin={handleAdminLogout}
          />
        ) : (
          <AdminLoginGate
            onLogin={handleAdminLoginSubmit}
            loading={adminAuthLoading}
            error={adminAuthError}
            onBack={() => setPage("site")}
          />
        )
      )}

      {page === "ops" && (
        <OpsCenter
          bookings={bookings} orders={orders} customers={customers} notifications={notifications}
          onBack={() => setPage("site")}
          onGoBooking={() => setPage("site")}
          onGoBookingsAdmin={() => { setPage("admin"); setAdminTab("bookings"); }}
          onGoCustomersAdmin={() => { setPage("admin"); setAdminTab("customers"); }}
          onGoOrdersAdmin={() => { setPage("admin"); setAdminTab("orders"); setJumpOrderId(null); setJumpStatusFilter(null); setJumpToken((t) => t + 1); }}
          onGoOrder={jumpToOrder}
          onGoOrdersFiltered={jumpToOrdersFiltered}
          onGoNotifications={() => setPage("notifications")}
        />
      )}

      {page === "notifications" && (
        <NotificationCenter
          notifications={notifications}
          onMarkProcessed={markNotificationProcessed}
          onBack={() => setPage("site")}
        />
      )}

      {page === "gallery" && (
        <GalleryPage
          orders={orders} albums={albums} photos={photos}
          onToggleSelect={togglePhotoSelected}
          onConfirmSelection={confirmSelection}
          onReopenSelection={reopenSelection}
          onBack={() => setPage("site")}
          initialOrderId={galleryDirectOrderId}
        />
      )}

      {page === "login" && (
        <LoginRegisterPage
          onLogin={loginCustomer}
          onRegister={registerCustomer}
          onSuccess={() => setPage("member")}
          onBack={() => setPage("site")}
          onUseOldLookup={openGalleryLookup}
        />
      )}

      {page === "member" && currentCustomerId && (
        <MemberCenter
          customer={customers.find((c) => c.id === currentCustomerId)}
          bookings={bookings.filter((b) => b.customerId === currentCustomerId)}
          orders={orders.filter((o) => o.customerId === currentCustomerId)}
          albums={albums}
          onOpenGallery={openGalleryForOrder}
          onUpdateProfile={(patch) => updateMemberProfile(currentCustomerId, patch)}
          onLogout={logoutCustomer}
          onBack={() => setPage("site")}
        />
      )}

      {page === "member" && !currentCustomerId && (
        <div style={{ minHeight: "100vh", background: "#FDFBF6", padding: "160px 6vw", textAlign: "center" }}>
          <p className="msy-body" style={{ marginBottom: 20 }}>請先登入才能查看會員中心。</p>
          <button className="msy-btn msy-btn-dark" onClick={() => setPage("login")}>前往登入</button>
        </div>
      )}

      {page === "site" && (
        <>
          {/* HERO */}
          <header style={styles.hero}>
            {HERO_SLIDES.map((slide, i) => (
              <img
                key={i}
                src={slide.src}
                alt=""
                style={{ ...styles.heroImg, opacity: i === heroIndex ? 1 : 0, transition: "opacity 0.8s ease" }}
              />
            ))}
            <div style={styles.heroOverlay} />
            <div style={styles.heroContent}>
              <p className="msy-body msy-hero-flow" key={`cat-${heroIndex}`} style={{ color: "#D8CFC0", fontSize: 13, letterSpacing: 4, marginBottom: 20 }}>NEW TAIPEI PHOTOGRAPHY STUDIO　｜　{HERO_SLIDES[heroIndex].cat}</p>
              <h1 className="msy-serif msy-hero-title msy-hero-flow" style={{ color: "#EDE7DA", fontSize: 68, fontWeight: 400, lineHeight: 1.3, animationDelay: "0.1s" }} key={`title-${heroIndex}`}>
                {HERO_SLIDES[heroIndex].headline}
              </h1>
              <p className="msy-body msy-hero-flow" key={`sub-${heroIndex}`} style={{ color: "#D8CFC0", fontSize: 15, marginTop: 24, letterSpacing: 1, animationDelay: "0.2s" }}>{HERO_SLIDES[heroIndex].sub}</p>
              <button onClick={() => goToSection("booking")} className="msy-btn" style={{ marginTop: 36 }}>立即預約拍攝</button>
            </div>
            {/* 底部分類快速跳轉列 */}
            <div style={{ position: "absolute", bottom: 28, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 6, flexWrap: "wrap", padding: "0 20px" }}>
              {CATS.filter((c) => c.key !== "all").map((c) => (
                <button
                  key={c.key}
                  onClick={() => { setFilter(c.key); setPortfolioPage(0); goToSection("work"); }}
                  style={{ color: "#EDE7DA", opacity: 0.85, fontSize: 12, letterSpacing: 1, padding: "6px 14px", border: "1px solid rgba(237,231,218,0.4)", background: "rgba(15,14,13,0.25)", cursor: "pointer", fontFamily: "'Noto Sans TC', sans-serif" }}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </header>

          {/* WORK */}
          <section id="work" style={{ padding: "100px 6vw", background: "#FDFBF6", minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <div style={styles.sectionHead}><p className="msy-body" style={styles.eyebrow}>PORTFOLIO</p><h2 className="msy-serif" style={styles.sectionTitle}>作品集</h2></div>
            <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 48, flexWrap: "wrap" }}>
              {CATS.map((c) => (<button key={c.key} className={`msy-tab ${filter === c.key ? "active" : ""}`} onClick={() => { setFilter(c.key); setPortfolioPage(0); }}>{c.label}</button>))}
            </div>
            <div className={`msy-grid msy-protect ${windowBlurred ? "msy-blur-protect" : ""}`} style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 4 }}>
              {shownPhotos.slice(portfolioPage * PORTFOLIO_PAGE_SIZE, portfolioPage * PORTFOLIO_PAGE_SIZE + PORTFOLIO_PAGE_SIZE).map((p, i) => (
                <PortfolioCard key={p.id} photo={p} index={i} onOpen={() => setPortfolioLightbox({ photo: p, pageIndex: 0 })} />
              ))}
            </div>
            {shownPhotos.length > PORTFOLIO_PAGE_SIZE && (
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 16, marginTop: 40 }}>
                <button className="msy-link-btn" style={{ opacity: portfolioPage === 0 ? 0.3 : 1 }} disabled={portfolioPage === 0} onClick={() => setPortfolioPage((p) => Math.max(0, p - 1))}>← 上一頁</button>
                <div style={{ display: "flex", gap: 8 }}>
                  {Array.from({ length: Math.ceil(shownPhotos.length / PORTFOLIO_PAGE_SIZE) }).map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setPortfolioPage(i)}
                      style={{
                        width: 30, height: 30, borderRadius: "50%", border: "1px solid #E3DCCB", cursor: "pointer",
                        fontFamily: "'Noto Sans TC', sans-serif", fontSize: 13,
                        background: i === portfolioPage ? "#B4491F" : "#FDFBF6",
                        color: i === portfolioPage ? "#FDFBF6" : "#6B6459",
                        borderColor: i === portfolioPage ? "#B4491F" : "#E3DCCB",
                      }}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
                <button className="msy-link-btn" style={{ opacity: (portfolioPage + 1) * PORTFOLIO_PAGE_SIZE >= shownPhotos.length ? 0.3 : 1 }} disabled={(portfolioPage + 1) * PORTFOLIO_PAGE_SIZE >= shownPhotos.length} onClick={() => setPortfolioPage((p) => p + 1)}>下一頁 →</button>
              </div>
            )}
            <p className="msy-body" style={{ textAlign: "center", fontSize: 12, color: "#A8A192", marginTop: 32, letterSpacing: 1 }}>
              © 美攝影 版權所有・轉載必究　All photographs on this page are protected by copyright.
            </p>
            {portfolioLightbox && (
              <PortfolioLightbox
                photo={portfolioLightbox.photo}
                pageIndex={portfolioLightbox.pageIndex}
                onSetPage={(idx) => setPortfolioLightbox((s) => ({ ...s, pageIndex: idx }))}
                onClose={() => setPortfolioLightbox(null)}
              />
            )}
          </section>

          {/* SERVICES & PRICING */}
          <section id="services" style={{ padding: "100px 6vw", background: "#F4EEE1", minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <div style={styles.sectionHead}><p className="msy-body" style={styles.eyebrow}>SERVICES</p><h2 className="msy-serif" style={styles.sectionTitle}>服務與價格</h2></div>
            <div className="msy-plans" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24, maxWidth: 1000, margin: "0 auto" }}>
              {PLANS.map((plan) => (
                <div key={plan.frame} className={`msy-plan ${plan.featured ? "featured" : ""}`}>
                  {plan.featured && <span style={{ position: "absolute", top: -12, left: 28, background: "#B4491F", color: "#FDFBF6", fontSize: 11, letterSpacing: 2, padding: "4px 10px" }}>熱門方案</span>}
                  <p className="msy-body" style={{ color: "#B4491F", fontSize: 12, letterSpacing: 2, marginBottom: 12 }}>NO. {plan.frame}</p>
                  <h3 className="msy-serif" style={{ fontSize: 24, color: "#161513", marginBottom: 16 }}>{plan.name}</h3>
                  <p className="msy-body" style={{ fontSize: 28, color: "#161513", marginBottom: 4 }}>{plan.price}<span style={{ fontSize: 13, color: "#6B6459" }}>{plan.unit}</span></p>
                  <div style={{ height: 1, background: "#E3DCCB", margin: "20px 0" }} />
                  <ul style={{ listStyle: "none" }}>{plan.features.map((f) => (<li key={f} className="msy-body" style={{ fontSize: 14, color: "#4A453D", marginBottom: 10, paddingLeft: 16, position: "relative" }}><span style={{ position: "absolute", left: 0, color: "#B4491F" }}>—</span>{f}</li>))}</ul>
                  <button onClick={() => goToSection("booking")} className="msy-btn msy-btn-dark" style={{ marginTop: 24, width: "100%", textAlign: "center", display: "block" }}>預約此方案</button>
                </div>
              ))}
            </div>
          </section>

          {/* P2: BOOKING FLOW */}
          <section id="booking" style={{ padding: "100px 6vw", background: "#FDFBF6", minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <div style={styles.sectionHead}><p className="msy-body" style={styles.eyebrow}>ONLINE BOOKING</p><h2 className="msy-serif" style={styles.sectionTitle}>線上預約</h2></div>
            <div className="msy-step-track">{[1, 2, 3, 4, 5].map((s) => (<span key={s} className={`msy-step-dot ${step >= s ? "done" : ""}`} />))}</div>
            <div style={{ maxWidth: 680, margin: "0 auto" }}>
              {step === 1 && (
                <div>
                  <p className="msy-body" style={{ textAlign: "center", marginBottom: 28, color: "#4A453D" }}>步驟 1：請選擇拍攝服務</p>
                  <div className="msy-services-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                    {SERVICES.map((s) => (
                      <button key={s.id} className={`msy-service-card ${form.serviceId === s.id ? "selected" : ""}`} onClick={() => selectService(s.id)}>
                        <p className="msy-serif" style={{ fontSize: 18, color: "#161513", marginBottom: 6 }}>{s.name}</p>
                        <p className="msy-body" style={{ fontSize: 13, color: "#6B6459" }}>{s.duration}</p>
                        <p className="msy-body" style={{ fontSize: 15, color: "#B4491F", marginTop: 8 }}>{s.price}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {step === 2 && (
                <div>
                  <p className="msy-body" style={{ textAlign: "center", marginBottom: 28, color: "#4A453D" }}>步驟 2：選擇拍攝日期 — 已選服務：<strong>{SERVICES.find((s) => s.id === form.serviceId)?.name}</strong></p>
                  <label className="msy-label">拍攝日期</label>
                  <input type="date" className="msy-input" min={todayStr(0)} value={form.date} onChange={(e) => e.target.value && selectDate(e.target.value)} />
                  <button className="msy-nav-link" style={{ color: "#B4491F", marginTop: 16, opacity: 1 }} onClick={() => setStep(1)}>← 重新選擇服務</button>
                </div>
              )}
              {step === 3 && (
                <div>
                  <p className="msy-body" style={{ textAlign: "center", marginBottom: 8, color: "#4A453D" }}>步驟 3：選擇時段 — {form.date}</p>
                  <p className="msy-body" style={{ textAlign: "center", marginBottom: 28, fontSize: 12, color: "#A8A192" }}>灰色為已被預約，無法選擇</p>
                  {errors.time && <p className="msy-error" style={{ textAlign: "center" }}>{errors.time}</p>}
                  <div className="msy-slots-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
                    {TIME_SLOTS.map((t) => { const taken = isSlotTaken(form.date, t); return (<button key={t} className={`msy-slot ${taken ? "taken" : ""} ${form.time === t ? "selected" : ""}`} onClick={() => selectTime(t)} disabled={taken}>{t}</button>); })}
                  </div>
                  <button className="msy-nav-link" style={{ color: "#B4491F", marginTop: 24, opacity: 1 }} onClick={() => setStep(2)}>← 重新選擇日期</button>
                </div>
              )}
              {step === 4 && (
                <div>
                  <p className="msy-body" style={{ textAlign: "center", marginBottom: 28, color: "#4A453D" }}>步驟 4：填寫聯絡資訊 — {form.date} {form.time}</p>
                  <div className="msy-notice">若您輸入的電話與既有客戶相符，系統會自動歸戶到同一位客戶，不會重複建檔。送出後會自動建立一筆對應訂單。</div>
                  <label className="msy-label">姓名 *</label>
                  <input className="msy-input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="王小美" />
                  {errors.name && <p className="msy-error">{errors.name}</p>}
                  <label className="msy-label">電話 *</label>
                  <input className="msy-input" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="0912-345-678" />
                  {errors.phone && <p className="msy-error">{errors.phone}</p>}

                  <label className="msy-label">聯絡方式 *（Email 或 LINE，二選一即可）</label>
                  <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                    <button type="button" className={`msy-tab ${form.contactMethod === "email" ? "active" : ""}`} onClick={() => setForm((f) => ({ ...f, contactMethod: "email" }))}>Email</button>
                    <button type="button" className={`msy-tab ${form.contactMethod === "line" ? "active" : ""}`} onClick={() => setForm((f) => ({ ...f, contactMethod: "line" }))}>LINE</button>
                  </div>
                  {form.contactMethod === "email" ? (
                    <>
                      <input className="msy-input" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="name@example.com" />
                      {errors.email && <p className="msy-error">{errors.email}</p>}
                    </>
                  ) : (
                    <>
                      <input className="msy-input" value={form.lineId} onChange={(e) => setForm((f) => ({ ...f, lineId: e.target.value }))} placeholder="您的 LINE ID" />
                      {errors.lineId && <p className="msy-error">{errors.lineId}</p>}
                    </>
                  )}

                  <label className="msy-label">備註</label>
                  <textarea className="msy-input" rows={3} value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} placeholder="拍攝需求、特殊時間需求等（選填）" />
                  <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
                    <button className="msy-nav-link" style={{ color: "#B4491F", opacity: 1 }} onClick={() => setStep(3)}>← 重新選擇時段</button>
                    <button className="msy-btn msy-btn-dark" style={{ marginLeft: "auto" }} onClick={submitBooking}>送出預約</button>
                  </div>
                </div>
              )}
              {step === 5 && confirmedBooking && (
                <div style={{ textAlign: "center", border: "1px solid #E3DCCB", padding: "48px 32px", background: "#FBF2E9" }}>
                  <p className="msy-body" style={{ color: "#B4491F", fontSize: 13, letterSpacing: 2, marginBottom: 16 }}>預約成功</p>
                  <h3 className="msy-serif" style={{ fontSize: 28, marginBottom: 8 }}>預約編號　{confirmedBooking.id}</h3>
                  <p className="msy-body" style={{ fontSize: 13, color: "#7A4A20", marginBottom: 20 }}>已自動建立訂單　{confirmedBooking.orderId}（狀態：待付款）</p>
                  <div style={{ textAlign: "left", display: "inline-block" }}>
                    <p className="msy-body" style={{ fontSize: 14, marginBottom: 8 }}>服務項目：{confirmedBooking.serviceName}（{formatMoney(confirmedBooking.amount)}）</p>
                    <p className="msy-body" style={{ fontSize: 14, marginBottom: 8 }}>拍攝日期：{confirmedBooking.date}　{confirmedBooking.time}</p>
                    <p className="msy-body" style={{ fontSize: 14, marginBottom: 8 }}>客戶姓名：{confirmedBooking.name}</p>
                    <p className="msy-body" style={{ fontSize: 14, marginBottom: 8 }}>聯絡電話：{confirmedBooking.phone}</p>
                    {confirmedBooking.email ? (
                      <p className="msy-body" style={{ fontSize: 14, marginBottom: 8 }}>Email：{confirmedBooking.email}</p>
                    ) : (
                      <p className="msy-body" style={{ fontSize: 14, marginBottom: 8 }}>LINE ID：{confirmedBooking.lineId}</p>
                    )}
                    {confirmedBooking.note && <p className="msy-body" style={{ fontSize: 14 }}>備註：{confirmedBooking.note}</p>}
                  </div>
                  <div style={{ marginTop: 32 }}><button className="msy-btn msy-btn-dark" onClick={resetBookingFlow}>再預約一筆（測試用）</button></div>
                </div>
              )}
            </div>
          </section>

          {/* FOOTER */}
          <footer style={{ padding: "90px 6vw 50px", background: "#161513", color: "#EDE7DA", textAlign: "center" }}>
            <p className="msy-body" style={{ ...styles.eyebrow, color: "#8A8377" }}>GET IN TOUCH</p>
            <h2 className="msy-serif" style={{ fontSize: 36, margin: "16px 0 24px" }}>預約您的拍攝時段</h2>
            <button onClick={() => goToSection("booking")} className="msy-btn" style={{ marginBottom: 40 }}>立即預約拍攝</button>
            <div style={{ display: "flex", justifyContent: "center", gap: 40, flexWrap: "wrap", marginBottom: 56 }}>
              <span className="msy-body" style={{ fontSize: 14 }}>02-8972-8189</span>
              <span className="msy-body" style={{ fontSize: 14 }}>hello@meishe-studio.tw</span>
              <span className="msy-body" style={{ fontSize: 14 }}>新北市 · 預約制工作室</span>
            </div>
            <div style={{ borderTop: "1px solid #33302A", paddingTop: 24, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
              <p className="msy-body" style={{ fontSize: 12, color: "#6B6459", letterSpacing: 1 }}>© 2026 美攝影 MeiShe Studio</p>
              {!(adminSession && adminSession.role === "admin") && (
                <button className="msy-link-btn" style={{ color: "#5A554C", fontSize: 11, textDecoration: "none" }} onClick={() => { setPage("admin"); setAdminTab("bookings"); }}>工作室後台</button>
              )}
            </div>
          </footer>
        </>
      )}
    </div>
  );
}

/* ================= P5：客戶選片頁面 ================= */

/* ================= 作品集卡片：單一項目內的多張照片自動漸變輪動 ================= */
/* 有 detail 照片的項目會在自己的幾張照片間淡入淡出循環；只有一張照片的項目就單純顯示，不會硬切。
   每張卡片各自獨立輪播（用 index 錯開起始張，畫面看起來比較有生命感，不會所有卡片同時跳）。 */

function PortfolioCard({ photo, index, onOpen }) {
  const images = photo.detail && photo.detail.length ? [photo.src, ...photo.detail] : [photo.src];
  const [imgIndex, setImgIndex] = useState(index % images.length);

  useEffect(() => {
    if (images.length <= 1) return;
    const timer = setInterval(() => setImgIndex((i) => (i + 1) % images.length), 12000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [images.length]);

  return (
    <div className="msy-card" style={{ aspectRatio: "3/4", position: "relative" }} onClick={onOpen}>
      {images.map((src, i) => (
        <img key={src} src={src} alt={photo.title} loading="lazy" draggable="false" className="msy-card-img-fade" style={{ opacity: i === imgIndex ? 1 : 0, transition: "opacity 4.4s ease, transform .6s ease" }} />
      ))}
      <div className="msy-watermark-overlay">© 美攝影</div>
      <span className="msy-frame-no">No. {String(index + 1).padStart(2, "0")}</span>
      <div className="msy-card-title">{photo.title}</div>
    </div>
  );
}

function PortfolioLightbox({ photo, pageIndex, onSetPage, onClose }) {
  const pages = [photo.src, ...(photo.detail || [])];
  const total = pages.length;

  function goPrev(e) { e.stopPropagation(); onSetPage((pageIndex - 1 + total) % total); }
  function goNext(e) { e.stopPropagation(); onSetPage((pageIndex + 1) % total); }

  return (
    <div className="msy-lightbox-backdrop" onClick={onClose}>
      <div className="msy-lightbox-panel msy-protect" style={{ maxWidth: 720 }} onClick={(e) => e.stopPropagation()}>
        <div className="msy-lightbox" style={{ position: "relative" }}>
          <img src={pages[pageIndex]} alt={photo.title} draggable="false" />
          <div className="msy-watermark-overlay">© 美攝影</div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16 }}>
          <p className="msy-body" style={{ fontSize: 13, color: "#4A453D" }}>{photo.title}　（{pageIndex + 1} / {total}）</p>
          <button className="msy-link-btn" onClick={onClose}>關閉</button>
        </div>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 16, marginTop: 12 }}>
          <button className="msy-link-btn" onClick={goPrev}>← 上一張</button>
          <div style={{ display: "flex", gap: 6 }}>
            {pages.map((_, i) => (<span key={i} className={`msy-step-dot ${i === pageIndex ? "done" : ""}`} style={{ cursor: "pointer" }} onClick={(e) => { e.stopPropagation(); onSetPage(i); }} />))}
          </div>
          <button className="msy-link-btn" onClick={goNext}>下一張 →</button>
        </div>
      </div>
    </div>
  );
}

function GalleryPage({ orders, albums, photos, onToggleSelect, onConfirmSelection, onReopenSelection, onBack, initialOrderId }) {
  const directOrder = initialOrderId ? orders.find((o) => o.id === initialOrderId) : null;
  const directAlbum = directOrder ? albums.find((a) => a.orderId === directOrder.id) : null;

  const [view, setView] = useState(directOrder && directAlbum ? "gallery" : "lookup"); // lookup | gallery
  const [form, setForm] = useState({ orderId: "", phone: "" });
  const [error, setError] = useState(initialOrderId && !directAlbum ? "此訂單目前尚未建立照片相簿，請稍後再試，或聯繫攝影師確認拍攝進度" : "");
  const [foundOrder, setFoundOrder] = useState(directOrder || null);
  const [foundAlbum, setFoundAlbum] = useState(directAlbum || null);
  const [previewPhoto, setPreviewPhoto] = useState(null);
  const [confirmNotice, setConfirmNotice] = useState(false);

  function handleLookup(e) {
    e.preventDefault();
    const order = orders.find((o) => o.id.trim().toUpperCase() === form.orderId.trim().toUpperCase() && normalizePhone(o.phone) === normalizePhone(form.phone));
    if (!order) { setError("查無此訂單，請確認訂單編號與預約電話是否正確"); return; }
    const album = albums.find((a) => a.orderId === order.id);
    if (!album) { setError("此訂單目前尚未建立照片相簿，請稍後再試，或聯繫攝影師確認拍攝進度"); return; }
    setError("");
    setFoundOrder(order);
    setFoundAlbum(album);
    setView("gallery");
  }

  if (view === "lookup") {
    return (
      <div style={{ minHeight: "100vh", background: "#FDFBF6", padding: "140px 6vw 100px" }}>
        <div style={{ maxWidth: 440, margin: "0 auto", textAlign: "center" }}>
          <p className="msy-body" style={{ color: "#B4491F", fontSize: 12, letterSpacing: 3, marginBottom: 12 }}>ONLINE GALLERY</p>
          <h2 className="msy-serif" style={{ fontSize: 32, marginBottom: 12 }}>查看我的照片</h2>
          {initialOrderId && error ? (
            <p className="msy-error" style={{ marginBottom: 20 }}>{error}</p>
          ) : (
            <p className="msy-body" style={{ fontSize: 13, color: "#6B6459", marginBottom: 32 }}>請輸入訂單編號與預約時填寫的電話，以查看專屬於您的拍攝照片（如果您已經是會員，也可以直接從「會員中心」進入）</p>
          )}
          <div style={{ textAlign: "left" }}>
            <label className="msy-label">訂單編號</label>
            <input className="msy-input" placeholder="例如 ORD-1001" value={form.orderId} onChange={(e) => setForm((f) => ({ ...f, orderId: e.target.value }))} />
            <label className="msy-label">電話</label>
            <input className="msy-input" placeholder="0912-345-678" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} onKeyDown={(e) => { if (e.key === "Enter") handleLookup(e); }} />
            {error && !initialOrderId && <p className="msy-error">{error}</p>}
            <button className="msy-btn msy-btn-dark" style={{ width: "100%", marginTop: 12 }} type="button" onClick={handleLookup}>查詢照片</button>
          </div>
          <button className="msy-link-btn" style={{ marginTop: 28 }} onClick={onBack}>← 返回官網首頁</button>
        </div>
      </div>
    );
  }

  const albumPhotos = photos.filter((p) => p.albumId === foundAlbum.id);
  const selectedCount = albumPhotos.filter((p) => p.selected).length;

  function handleConfirm() {
    if (selectedCount === 0) { setConfirmNotice("please-select"); return; }
    onConfirmSelection(foundAlbum.id);
    setConfirmNotice("done");
  }

  // 從 props 重新取最新的 album 狀態（因為 onConfirmSelection 會更新上層 state）
  const liveAlbum = albums.find((a) => a.id === foundAlbum.id) || foundAlbum;

  return (
    <div style={{ minHeight: "100vh", background: "#FDFBF6", padding: "120px 6vw 100px" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <button className="msy-link-btn" style={{ marginBottom: 20 }} onClick={onBack}>← 返回官網首頁</button>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 8, flexWrap: "wrap", gap: 12 }}>
          <div>
            <p className="msy-body" style={{ color: "#B4491F", fontSize: 12, letterSpacing: 3, marginBottom: 8 }}>{foundOrder.id}　{foundOrder.customerName} 您好</p>
            <h2 className="msy-serif" style={{ fontSize: 30 }}>{liveAlbum.name}</h2>
          </div>
          <p className="msy-body" style={{ fontSize: 14, color: "#4A453D" }}>已選　<strong style={{ color: "#B4491F", fontSize: 18 }}>{selectedCount}</strong> / {albumPhotos.length} 張</p>
        </div>

        {liveAlbum.confirmed ? (
          <div style={{ border: "1px solid #E3DCCB", background: "#FBF2E9", padding: "32px", textAlign: "center", margin: "24px 0" }}>
            <p className="msy-body" style={{ fontSize: 15, color: "#4C6B3C", marginBottom: 8 }}>✓ 選片已送出，感謝您的選擇</p>
            <p className="msy-body" style={{ fontSize: 13, color: "#7A4A20" }}>選片時間：{liveAlbum.confirmedAt}　｜　共 {selectedCount} 張，攝影師將盡快安排修圖與交件</p>
            <button className="msy-link-btn" style={{ marginTop: 16 }} onClick={() => onReopenSelection(liveAlbum.id)}>重新選片（測試用）</button>
          </div>
        ) : (
          <p className="msy-body" style={{ fontSize: 12, color: "#A8A192", marginBottom: 20 }}>點擊照片可放大預覽；點右上角圓形按鈕可直接選取／取消選取</p>
        )}

        <div className="msy-photo-grid">
          {albumPhotos.map((p) => (
            <div key={p.id} className={`msy-photo-tile ${p.selected ? "selected" : ""}`} onClick={() => setPreviewPhoto(p)}>
              <img src={p.thumbnailUrl} alt={p.name} />
              <button
                className={`msy-photo-check ${p.selected ? "on" : ""}`}
                onClick={(e) => { e.stopPropagation(); if (!liveAlbum.confirmed) onToggleSelect(p.id); }}
                disabled={liveAlbum.confirmed}
              >{p.selected ? "✓" : ""}</button>
              <div className="msy-photo-name">{p.name}</div>
            </div>
          ))}
        </div>

        {!liveAlbum.confirmed && (
          <div style={{ textAlign: "center", marginTop: 36 }}>
            {confirmNotice === "please-select" && <p className="msy-error" style={{ textAlign: "center" }}>請至少選擇一張照片再確認</p>}
            <button className="msy-btn msy-btn-dark" onClick={handleConfirm}>確認選片</button>
          </div>
        )}
      </div>

      {previewPhoto && (
        <div className="msy-lightbox-backdrop" onClick={() => setPreviewPhoto(null)}>
          <div className="msy-lightbox-panel" onClick={(e) => e.stopPropagation()}>
            <div className="msy-lightbox"><img src={previewPhoto.thumbnailUrl} alt={previewPhoto.name} /></div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16 }}>
              <p className="msy-body" style={{ fontSize: 13, color: "#4A453D" }}>{previewPhoto.name}</p>
              <div style={{ display: "flex", gap: 12 }}>
                {!liveAlbum.confirmed && (
                  <button className="msy-btn msy-btn-dark msy-btn-sm" onClick={() => { onToggleSelect(previewPhoto.id); setPreviewPhoto((prev) => ({ ...prev, selected: !prev.selected })); }}>
                    {previewPhoto.selected ? "取消選取" : "選取此照片"}
                  </button>
                )}
                <button className="msy-link-btn" onClick={() => setPreviewPhoto(null)}>關閉</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ================= P6：營運管理控制中心 ================= */
/* 本頁面所有數字都是即時從 bookings / orders / customers 這幾個現有資料陣列計算出來，
   沒有另外建立一份獨立的統計資料表，確保跟 P2～P5 的資料永遠一致。 */

function OpsCenter({ bookings, orders, customers, notifications, onBack, onGoBooking, onGoBookingsAdmin, onGoCustomersAdmin, onGoOrdersAdmin, onGoOrder, onGoOrdersFiltered, onGoNotifications }) {
  const [rangeKey, setRangeKey] = useState("today");
  const today = todayStr(0);
  const [rangeStart, rangeEnd] = rangeFor(rangeKey);
  const rangeLabel = RANGE_OPTIONS.find((r) => r.key === rangeKey)?.label || "今天";

  // ---- 儀表板數據（今日）----
  const todaysBookings = bookings.filter((b) => b.date === today && b.status === "已確認");
  const todaysOrders = orders.filter((o) => o.date === today && o.status !== "已取消");
  const countByStatus = (status) => orders.filter((o) => o.status === status).length;
  const todayRevenue = todaysOrders.reduce((sum, o) => sum + (o.amount || 0), 0);
  const pendingNotificationCount = notifications.filter((n) => n.status === "已模擬發送").length;

  const dashboardCards = [
    { label: "今日預約數", value: todaysBookings.length, hint: "今天有確認預約的客人數" },
    { label: "今日拍攝數", value: todaysOrders.length, hint: "今天排定拍攝的訂單數" },
    { label: "待付款訂單數", value: countByStatus("待付款"), hint: "全部訂單中，尚未付款" },
    { label: "已付款訂單數", value: countByStatus("已付款"), hint: "全部訂單中，已付款" },
    { label: "待選片訂單數", value: countByStatus("待選片"), hint: "已建立相簿，等客戶選片" },
    { label: "修圖中訂單數", value: countByStatus("修圖中"), hint: "客戶已選片，正在修圖" },
    { label: "待交件訂單數", value: countByStatus("客戶已選片"), hint: "客戶已選片，等待安排交件" },
    { label: "今日營業金額", value: formatMoney(todayRevenue), hint: "今天訂單金額加總（不含已取消）" },
    { label: "待處理通知數", value: pendingNotificationCount, hint: "P7 通知中心裡尚未標記為已處理" },
  ];

  // ---- 今日／指定範圍行程（結合預約 + 對應訂單）----
  const schedule = bookings
    .filter((b) => b.date >= rangeStart && b.date <= rangeEnd)
    .map((b) => {
      const order = orders.find((o) => o.bookingId === b.id);
      const paymentStatus = !order ? "—" : order.status === "已取消" ? "—" : order.status === "待付款" ? "未付款" : "已付款";
      return { ...b, orderId: order?.id || "—", orderStatus: order?.status || "—", paymentStatus };
    })
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

  // ---- 待處理事項 ----
  const pendingGroups = [
    { key: "待付款", label: "待付款", statuses: ["待付款"] },
    { key: "待拍攝", label: "待拍攝", statuses: ["已預約", "已付款"] },
    { key: "待選片", label: "待選片", statuses: ["待選片"] },
    { key: "修圖中", label: "修圖中", statuses: ["修圖中"] },
    { key: "待交件", label: "待交件", statuses: ["客戶已選片"] },
  ].map((g) => ({ ...g, items: orders.filter((o) => g.statuses.includes(o.status)).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)) }));

  // ---- 營業統計 ----
  const [monthStart, monthEnd] = monthRange();
  const monthOrders = orders.filter((o) => o.date >= monthStart && o.date <= monthEnd && o.status !== "已取消");
  const monthBookings = bookings.filter((b) => b.date >= monthStart && b.date <= monthEnd && b.status === "已確認");
  const monthRevenue = monthOrders.reduce((sum, o) => sum + (o.amount || 0), 0);
  const monthCompleted = orders.filter((o) => o.date >= monthStart && o.date <= monthEnd && o.status === "已完成").length;

  const serviceCounts = {};
  orders.forEach((o) => { if (o.status !== "已取消") serviceCounts[o.serviceName] = (serviceCounts[o.serviceName] || 0) + 1; });

  return (
    <div style={{ minHeight: "100vh", background: "#FDFBF6", padding: "120px 6vw 80px" }}>
      <div style={{ maxWidth: 1160, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 12 }}>
          <h2 className="msy-serif" style={{ fontSize: 32, color: "#161513" }}>營運管理控制中心</h2>
          <button className="msy-btn msy-btn-dark" onClick={onBack}>返回官網</button>
        </div>
        <p className="msy-body" style={{ fontSize: 13, color: "#A8A192", marginBottom: 32 }}>以下數據皆即時計算自目前的預約、訂單與客戶資料，今天日期：{today}</p>

        {/* 一、儀表板 */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 48 }} className="msy-ops-grid">
          {dashboardCards.map((c) => (
            <div key={c.label} style={{ border: "1px solid #E3DCCB", background: "#FDFBF6", padding: "20px 18px" }}>
              <p className="msy-body" style={{ fontSize: 12, color: "#6B6459", marginBottom: 8 }}>{c.label}</p>
              <p className="msy-serif" style={{ fontSize: 26, color: "#161513" }}>{c.value}</p>
              <p className="msy-body" style={{ fontSize: 11, color: "#A8A192", marginTop: 6 }}>{c.hint}</p>
            </div>
          ))}
        </div>

        {/* 四、快速操作 */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 48 }}>
          <button className="msy-btn msy-btn-dark msy-btn-sm" onClick={onGoBooking}>＋ 新增預約</button>
          <button className="msy-btn msy-btn-dark msy-btn-sm" onClick={onGoBookingsAdmin}>查看預約</button>
          <button className="msy-btn msy-btn-dark msy-btn-sm" onClick={onGoCustomersAdmin}>查看客戶</button>
          <button className="msy-btn msy-btn-dark msy-btn-sm" onClick={onGoOrdersAdmin}>查看訂單</button>
          <button className="msy-btn msy-btn-dark msy-btn-sm" onClick={() => onGoOrdersFiltered("待選片")}>查看選片／交件</button>
          <button className="msy-btn msy-btn-dark msy-btn-sm" onClick={onGoNotifications}>查看通知中心</button>
        </div>

        {/* 六、日期切換 + 二、行程 */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
          <h3 className="msy-serif" style={{ fontSize: 22 }}>{rangeLabel}行程</h3>
          <div style={{ display: "flex", gap: 4 }}>
            {RANGE_OPTIONS.map((r) => (<button key={r.key} className={`msy-tab ${rangeKey === r.key ? "active" : ""}`} onClick={() => setRangeKey(r.key)}>{r.label}</button>))}
          </div>
        </div>
        <table className="msy-admin-table" style={{ marginBottom: 48 }}>
          <thead><tr><th>日期</th><th>時間</th><th>客戶</th><th>電話</th><th>攝影服務</th><th>訂單編號</th><th>付款狀態</th><th>訂單狀態</th></tr></thead>
          <tbody>
            {schedule.map((b) => (
              <tr key={b.id} style={{ cursor: b.orderId !== "—" ? "pointer" : "default" }} onClick={() => b.orderId !== "—" && onGoOrder(b.orderId)}>
                <td>{b.date}</td><td>{b.time}</td><td>{b.name}</td><td>{b.phone}</td><td>{b.serviceName}</td><td>{b.orderId}</td>
                <td>{b.paymentStatus === "已付款" ? <span className="msy-status-badge msy-status-confirmed">已付款</span> : b.paymentStatus === "未付款" ? <span className="msy-status-badge msy-status-pending">未付款</span> : "—"}</td>
                <td>{b.orderStatus !== "—" ? <span className={`msy-status-badge ${ORDER_STATUS_STYLE[b.orderStatus] || ""}`}>{b.orderStatus}</span> : "—"}</td>
              </tr>
            ))}
            {schedule.length === 0 && <tr><td colSpan={8} style={{ textAlign: "center", color: "#A8A192" }}>{rangeLabel}沒有預約</td></tr>}
          </tbody>
        </table>

        {/* 三、待處理事項 */}
        <h3 className="msy-serif" style={{ fontSize: 22, marginBottom: 16 }}>待處理事項</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 14, marginBottom: 48 }} className="msy-ops-grid">
          {pendingGroups.map((g) => (
            <div key={g.key} style={{ border: "1px solid #E3DCCB", background: "#F4EEE1", padding: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <p className="msy-body" style={{ fontSize: 13, color: "#4A453D" }}>{g.label}</p>
                <span className="msy-status-badge msy-status-pending">{g.items.length}</span>
              </div>
              {g.items.slice(0, 5).map((o) => (
                <button key={o.id} className="msy-link-btn" style={{ display: "block", marginBottom: 6, fontSize: 12 }} onClick={() => onGoOrder(o.id)}>
                  {o.id}　{o.customerName}
                </button>
              ))}
              {g.items.length === 0 && <p className="msy-body" style={{ fontSize: 12, color: "#A8A192" }}>目前沒有</p>}
              {g.items.length > 5 && <button className="msy-link-btn" style={{ fontSize: 12 }} onClick={() => onGoOrdersFiltered(g.key === "待拍攝" ? "待拍攝" : g.statuses[0])}>查看全部 {g.items.length} 筆 →</button>}
            </div>
          ))}
        </div>

        {/* 五、營業統計 */}
        <h3 className="msy-serif" style={{ fontSize: 22, marginBottom: 16 }}>本月營業統計</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 32 }} className="msy-ops-grid">
          <div style={{ border: "1px solid #E3DCCB", padding: 18 }}><p className="msy-body" style={{ fontSize: 12, color: "#6B6459", marginBottom: 8 }}>今日營業額</p><p className="msy-serif" style={{ fontSize: 22 }}>{formatMoney(todayRevenue)}</p></div>
          <div style={{ border: "1px solid #E3DCCB", padding: 18 }}><p className="msy-body" style={{ fontSize: 12, color: "#6B6459", marginBottom: 8 }}>本月營業額</p><p className="msy-serif" style={{ fontSize: 22 }}>{formatMoney(monthRevenue)}</p></div>
          <div style={{ border: "1px solid #E3DCCB", padding: 18 }}><p className="msy-body" style={{ fontSize: 12, color: "#6B6459", marginBottom: 8 }}>本月預約數</p><p className="msy-serif" style={{ fontSize: 22 }}>{monthBookings.length}</p></div>
          <div style={{ border: "1px solid #E3DCCB", padding: 18 }}><p className="msy-body" style={{ fontSize: 12, color: "#6B6459", marginBottom: 8 }}>本月完成訂單數</p><p className="msy-serif" style={{ fontSize: 22 }}>{monthCompleted}</p></div>
        </div>
        <div style={{ border: "1px solid #E3DCCB", padding: 24 }}>
          <p className="msy-body" style={{ fontSize: 13, color: "#4A453D", marginBottom: 14 }}>各攝影服務的訂單數量（不含已取消，全部期間）</p>
          {Object.entries(serviceCounts).map(([name, count]) => (
            <div key={name} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #F0EAD9" }}>
              <span className="msy-body" style={{ fontSize: 14 }}>{name}</span>
              <span className="msy-body" style={{ fontSize: 14, color: "#B4491F" }}>{count} 筆</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ================= P7：自動通知中心 ================= */
/* 這裡顯示的所有通知都是「模擬產生」，不會真的寄出 Email 或 LINE。
   通知資料一樣直接從 notifications 這個 state 陣列讀取，沒有另外一套資料。 */

function NotificationCenter({ notifications, onMarkProcessed, onBack }) {
  const [search, setSearch] = useState("");
  const [orderSearch, setOrderSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("全部");
  const [selectedId, setSelectedId] = useState(null);

  const filtered = notifications.filter((n) => {
    const q = search.trim().toLowerCase();
    const matchesCustomer = !q || n.customerName.toLowerCase().includes(q) || n.phone.includes(q);
    const matchesOrder = !orderSearch.trim() || (n.orderId || "").toLowerCase().includes(orderSearch.trim().toLowerCase());
    const matchesType = typeFilter === "全部" || n.type === typeFilter;
    return matchesCustomer && matchesOrder && matchesType;
  });

  const selected = notifications.find((n) => n.id === selectedId);

  return (
    <div style={{ minHeight: "100vh", background: "#FDFBF6", padding: "120px 6vw 80px" }}>
      <div style={{ maxWidth: 1120, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 12 }}>
          <h2 className="msy-serif" style={{ fontSize: 32, color: "#161513" }}>通知中心</h2>
          <button className="msy-btn msy-btn-dark" onClick={onBack}>返回官網</button>
        </div>
        <div className="msy-notice" style={{ marginBottom: 24 }}>
          ⚠️ 目前為測試環境：以下所有通知都是系統模擬產生，<strong>不會真的寄出 Email 或發送 LINE 訊息</strong>。未來接上正式後端後，會把 sendEmail() / sendLine() 換成真正的 API。
        </div>

        {selected ? (
          <NotificationDetail notification={selected} onBack={() => setSelectedId(null)} onMarkProcessed={onMarkProcessed} />
        ) : (
          <>
            <div className="msy-filter-bar">
              <input className="msy-input" style={{ maxWidth: 240, marginBottom: 0 }} placeholder="搜尋客戶姓名或電話" value={search} onChange={(e) => setSearch(e.target.value)} />
              <input className="msy-input" style={{ maxWidth: 200, marginBottom: 0 }} placeholder="搜尋訂單編號" value={orderSearch} onChange={(e) => setOrderSearch(e.target.value)} />
              <select className="msy-select" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                <option value="全部">全部通知類型</option>
                {Object.entries(NOTIFICATION_TYPE_LABELS).map(([key, label]) => (<option key={key} value={key}>{label}</option>))}
              </select>
              {(search || orderSearch || typeFilter !== "全部") && (<button className="msy-link-btn" onClick={() => { setSearch(""); setOrderSearch(""); setTypeFilter("全部"); }}>清除篩選</button>)}
            </div>

            <table className="msy-admin-table">
              <thead><tr><th>通知時間</th><th>客戶</th><th>電話</th><th>訂單編號</th><th>通知類型</th><th>通知內容</th><th>方式</th><th>發送狀態</th><th></th></tr></thead>
              <tbody>
                {filtered.map((n) => (
                  <tr key={n.id}>
                    <td>{n.createdAt}</td><td>{n.customerName}</td><td>{n.phone}</td><td>{n.orderId || "—"}</td>
                    <td>{NOTIFICATION_TYPE_LABELS[n.type]}</td>
                    <td style={{ maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.message}</td>
                    <td>{n.channel}</td>
                    <td><span className={`msy-status-badge ${n.status === "已處理" ? "msy-status-confirmed" : "msy-status-pending"}`}>{n.status === "已模擬發送" ? "測試通知・已模擬發送" : "已處理"}</span></td>
                    <td><button className="msy-link-btn" onClick={() => setSelectedId(n.id)}>查看詳情</button></td>
                  </tr>
                ))}
                {filtered.length === 0 && <tr><td colSpan={9} style={{ textAlign: "center", color: "#A8A192" }}>目前沒有符合條件的通知</td></tr>}
              </tbody>
            </table>
            <p className="msy-body" style={{ fontSize: 12, color: "#A8A192", marginTop: 16 }}>
              共 {notifications.length} 筆通知紀錄，目前顯示 {filtered.length} 筆。通知會在系統偵測到預約／訂單／選片／修圖等狀態變化時自動建立，重新整理頁面不會產生新的通知。
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function NotificationDetail({ notification, onBack, onMarkProcessed }) {
  const n = notification;
  return (
    <div>
      <button className="msy-link-btn" style={{ marginBottom: 20 }} onClick={onBack}>← 返回通知列表</button>
      <div style={{ border: "1px solid #E3DCCB", padding: 28, background: "#FDFBF6", maxWidth: 640 }}>
        <div className="msy-notice">【測試通知】此訊息僅為前端模擬，尚未串接正式 Email／LINE 發送服務。</div>
        <h3 className="msy-serif" style={{ fontSize: 22, marginBottom: 20 }}>{n.id}　{NOTIFICATION_TYPE_LABELS[n.type]}</h3>
        <p className="msy-body" style={{ fontSize: 14, marginBottom: 10 }}>客戶：{n.customerName}（{n.customerId || "—"}）</p>
        <p className="msy-body" style={{ fontSize: 14, marginBottom: 10 }}>電話：{n.phone}</p>
        <p className="msy-body" style={{ fontSize: 14, marginBottom: 10 }}>對應預約編號：{n.bookingId || "—"}</p>
        <p className="msy-body" style={{ fontSize: 14, marginBottom: 10 }}>對應訂單編號：{n.orderId || "—"}</p>
        <p className="msy-body" style={{ fontSize: 14, marginBottom: 10 }}>發送方式：{n.channel}</p>
        <p className="msy-body" style={{ fontSize: 14, marginBottom: 10 }}>建立時間：{n.createdAt}</p>
        <div style={{ height: 1, background: "#E3DCCB", margin: "16px 0" }} />
        <p className="msy-label" style={{ marginBottom: 8 }}>通知內容</p>
        <p className="msy-body" style={{ fontSize: 14, color: "#161513", background: "#F4EEE1", padding: 16, lineHeight: 1.7 }}>{n.message}</p>
        <div style={{ marginTop: 20 }}>
          {n.status === "已模擬發送" ? (
            <button className="msy-btn msy-btn-dark msy-btn-sm" onClick={() => onMarkProcessed(n.id, true)}>標記為已處理</button>
          ) : (
            <button className="msy-link-btn" onClick={() => onMarkProcessed(n.id, false)}>取消標記（恢復未處理，測試用）</button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ================= P8：會員登入／註冊／會員中心（唯讀） ================= */
/* 安全性說明：這裡的密碼比對是「明文比對」，只存在瀏覽器記憶體中，
   純粹是本階段的前端展示，正式上線前必須整套換成後端密碼雜湊與驗證機制，
   密碼絕對不可以用這種方式儲存或比對。 */

/* 可重複使用的密碼輸入欄位，內建「顯示/隱藏」切換按鈕 */
function PasswordField({ value, onChange, maxLength, placeholder }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <input className="msy-input" type={show ? "text" : "password"} maxLength={maxLength} value={value} onChange={onChange} placeholder={placeholder} style={{ paddingRight: 60 }} />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#B4491F", fontSize: 12, fontFamily: "'Noto Sans TC', sans-serif" }}
      >
        {show ? "隱藏" : "顯示"}
      </button>
    </div>
  );
}

function LoginRegisterPage({ onLogin, onRegister, onSuccess, onBack, onUseOldLookup }) {
  const [mode, setMode] = useState("login"); // login | register
  const [loginForm, setLoginForm] = useState({ phone: "", password: "" });
  const [regForm, setRegForm] = useState({ name: "", phone: "", email: "", password: "", confirm: "" });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  function submitLogin(e) {
    e.preventDefault();
    const result = onLogin(loginForm.phone, loginForm.password);
    if (!result.success) { setError(result.message); return; }
    setError("");
    onSuccess();
  }
  function submitRegister(e) {
    e.preventDefault();
    if (regForm.password !== regForm.confirm) { setError("兩次輸入的密碼不一致"); return; }
    const result = onRegister(regForm);
    if (!result.success) { setError(result.message); return; }
    setError("");
    onSuccess();
  }

  return (
    <div style={{ minHeight: "100vh", background: "#FDFBF6", padding: "140px 6vw 100px" }}>
      <div style={{ maxWidth: 440, margin: "0 auto" }}>
        <p className="msy-body" style={{ color: "#B4491F", fontSize: 12, letterSpacing: 3, marginBottom: 12, textAlign: "center" }}>MEMBER ACCOUNT</p>
        <h2 className="msy-serif" style={{ fontSize: 32, marginBottom: 20, textAlign: "center" }}>{mode === "login" ? "會員登入" : "註冊新帳號"}</h2>

        <div className="msy-notice">
          ⚠️ 開發／測試環境：密碼僅以明文暫存在瀏覽器中，僅供功能測試，<strong>並非正式安全機制</strong>。正式上線前會改成後端加密驗證，密碼不會存在前端。
        </div>

        <div style={{ display: "flex", gap: 4, marginBottom: 24, borderBottom: "1px solid #E3DCCB" }}>
          <button className={`msy-admin-tab ${mode === "login" ? "active" : ""}`} onClick={() => { setMode("login"); setError(""); }}>登入</button>
          <button className={`msy-admin-tab ${mode === "register" ? "active" : ""}`} onClick={() => { setMode("register"); setError(""); }}>註冊</button>
        </div>

        {mode === "login" ? (
          <div>
            <label className="msy-label">電話</label>
            <input className="msy-input" placeholder="0911-222-333" value={loginForm.phone} onChange={(e) => setLoginForm((f) => ({ ...f, phone: e.target.value }))} />
            <label className="msy-label">密碼</label>
            <PasswordField value={loginForm.password} onChange={(e) => setLoginForm((f) => ({ ...f, password: e.target.value }))} />
            {error && <p className="msy-error">{error}</p>}
            <button className="msy-btn msy-btn-dark" style={{ width: "100%", marginTop: 12 }} type="button" onClick={submitLogin}>登入</button>
            <p className="msy-body" style={{ fontSize: 12, color: "#A8A192", marginTop: 16, textAlign: "center" }}>測試帳號：0911-222-333 ／ 密碼 test1234（王小美）</p>
          </div>
        ) : (
          <div>
            <label className="msy-label">姓名</label>
            <input className="msy-input" maxLength={50} value={regForm.name} onChange={(e) => setRegForm((f) => ({ ...f, name: e.target.value }))} />
            <label className="msy-label">電話</label>
            <input className="msy-input" placeholder="0912-345-678" maxLength={20} value={regForm.phone} onChange={(e) => setRegForm((f) => ({ ...f, phone: e.target.value }))} />
            <label className="msy-label">Email</label>
            <input className="msy-input" maxLength={100} value={regForm.email} onChange={(e) => setRegForm((f) => ({ ...f, email: e.target.value }))} />
            <label className="msy-label">密碼（至少 4 碼）</label>
            <PasswordField value={regForm.password} onChange={(e) => setRegForm((f) => ({ ...f, password: e.target.value }))} maxLength={100} />
            <label className="msy-label">確認密碼</label>
            <PasswordField value={regForm.confirm} onChange={(e) => setRegForm((f) => ({ ...f, confirm: e.target.value }))} maxLength={100} />
            {error && <p className="msy-error">{error}</p>}
            <button className="msy-btn msy-btn-dark" style={{ width: "100%", marginTop: 12 }} type="button" onClick={submitRegister}>註冊</button>
            <p className="msy-body" style={{ fontSize: 12, color: "#A8A192", marginTop: 16 }}>如果您先前已經預約過，用同一組電話或 Email 註冊會自動接續您原本的資料，不會產生重複的客戶檔案。</p>
          </div>
        )}

        <div style={{ textAlign: "center", marginTop: 28 }}>
          <button className="msy-link-btn" onClick={onUseOldLookup}>沒有帳號？改用訂單編號＋電話查詢照片</button>
        </div>
        <div style={{ textAlign: "center", marginTop: 12 }}>
          <button className="msy-link-btn" onClick={onBack}>← 返回官網首頁</button>
        </div>
      </div>
    </div>
  );
}

function MemberCenter({ customer, bookings, orders, albums, onOpenGallery, onUpdateProfile, onLogout, onBack }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: customer?.name || "", phone: customer?.phone || "", email: customer?.email || "" });
  const [error, setError] = useState("");
  const [successNotice, setSuccessNotice] = useState(false);

  if (!customer) {
    return (
      <div style={{ minHeight: "100vh", background: "#FDFBF6", padding: "160px 6vw", textAlign: "center" }}>
        <p className="msy-body">找不到這位會員的資料（可能已被後台刪除）。</p>
        <button className="msy-btn msy-btn-dark" style={{ marginTop: 20 }} onClick={onBack}>返回官網首頁</button>
      </div>
    );
  }
  const myAlbums = albums.filter((a) => orders.some((o) => o.id === a.orderId));
  const sortedBookings = [...bookings].sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
  const sortedOrders = [...orders].sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));

  function startEdit() {
    setForm({ name: customer.name, phone: customer.phone, email: customer.email });
    setError("");
    setSuccessNotice(false);
    setEditing(true);
  }
  function saveProfile() {
    const result = onUpdateProfile(form);
    if (!result.success) { setError(result.message); return; }
    setError("");
    setEditing(false);
    setSuccessNotice(true);
  }

  return (
    <div style={{ minHeight: "100vh", background: "#FDFBF6", padding: "120px 6vw 80px" }}>
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 12 }}>
          <h2 className="msy-serif" style={{ fontSize: 32, color: "#161513" }}>會員中心</h2>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="msy-btn msy-btn-dark" onClick={onBack}>返回官網</button>
            <button className="msy-btn msy-btn-sm" style={{ borderColor: "#8A4444", color: "#8A4444" }} onClick={onLogout}>登出</button>
          </div>
        </div>
        <p className="msy-body" style={{ fontSize: 13, color: "#A8A192", marginBottom: 32 }}>{customer.name} 您好，這裡是您的個人資料與訂單總覽</p>

        <div style={{ border: "1px solid #E3DCCB", padding: 24, background: "#F4EEE1", marginBottom: 32 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3 className="msy-serif" style={{ fontSize: 20 }}>個人資料</h3>
            {!editing && <button className="msy-link-btn" onClick={startEdit}>編輯</button>}
          </div>

          {successNotice && !editing && (
            <div className="msy-notice" style={{ background: "#E9F0E4", borderColor: "#BFD8B0", color: "#4C6B3C" }}>✓ 個人資料已更新，以下為最新資料。</div>
          )}

          {editing ? (
            <>
              <div className="msy-notice">⚠️ 開發／測試環境：這裡的儲存只更新瀏覽器記憶體中的資料，正式上線後需要後端驗證登入身分並記錄異動，避免有人繞過前端竄改別人的資料。</div>
              <p className="msy-body" style={{ fontSize: 13, color: "#A8A192", marginBottom: 10 }}>客戶編號：{customer.id}（系統識別碼，不可修改）</p>
              <label className="msy-label">姓名</label>
              <input className="msy-input" maxLength={50} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              <label className="msy-label">電話</label>
              <input className="msy-input" maxLength={20} value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
              <label className="msy-label">Email</label>
              <input className="msy-input" maxLength={100} value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
              {error && <p className="msy-error">{error}</p>}
              <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                <button className="msy-btn msy-btn-dark msy-btn-sm" onClick={saveProfile}>儲存</button>
                <button className="msy-link-btn" onClick={() => { setEditing(false); setError(""); }}>取消</button>
              </div>
            </>
          ) : (
            <>
              <p className="msy-body" style={{ fontSize: 14, marginBottom: 8 }}>客戶編號：{customer.id}</p>
              <p className="msy-body" style={{ fontSize: 14, marginBottom: 8 }}>姓名：{customer.name}</p>
              <p className="msy-body" style={{ fontSize: 14, marginBottom: 8 }}>電話：{customer.phone}</p>
              <p className="msy-body" style={{ fontSize: 14, marginBottom: 8 }}>Email：{customer.email}</p>
              <p className="msy-body" style={{ fontSize: 14 }}>備註：{customer.note || "—"}（備註僅供工作室內部使用，暫不開放會員自行編輯）</p>
            </>
          )}
        </div>

        <h3 className="msy-serif" style={{ fontSize: 20, marginBottom: 12 }}>我的預約</h3>
        <table className="msy-admin-table" style={{ marginBottom: 32 }}>
          <thead><tr><th>日期</th><th>時間</th><th>服務項目</th><th>狀態</th></tr></thead>
          <tbody>
            {sortedBookings.map((b) => (<tr key={b.id}><td>{b.date}</td><td>{b.time}</td><td>{b.serviceName}</td><td><span className={`msy-status-badge ${b.status === "已確認" ? "msy-status-confirmed" : "msy-status-cancelled"}`}>{b.status}</span></td></tr>))}
            {sortedBookings.length === 0 && <tr><td colSpan={4} style={{ textAlign: "center", color: "#A8A192" }}>尚無預約紀錄</td></tr>}
          </tbody>
        </table>

        <h3 className="msy-serif" style={{ fontSize: 20, marginBottom: 12 }}>我的訂單</h3>
        <table className="msy-admin-table" style={{ marginBottom: 32 }}>
          <thead><tr><th>訂單編號</th><th>日期</th><th>服務項目</th><th>金額</th><th>狀態</th></tr></thead>
          <tbody>
            {sortedOrders.map((o) => (<tr key={o.id}><td>{o.id}</td><td>{o.date}</td><td>{o.serviceName}</td><td>{formatMoney(o.amount)}</td><td><span className={`msy-status-badge ${ORDER_STATUS_STYLE[o.status]}`}>{o.status}</span></td></tr>))}
            {sortedOrders.length === 0 && <tr><td colSpan={5} style={{ textAlign: "center", color: "#A8A192" }}>尚無訂單紀錄</td></tr>}
          </tbody>
        </table>

        <h3 className="msy-serif" style={{ fontSize: 20, marginBottom: 12 }}>我的照片相簿</h3>
        {myAlbums.length === 0 ? (
          <p className="msy-body" style={{ fontSize: 13, color: "#A8A192" }}>目前還沒有已建立的照片相簿。</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {myAlbums.map((a) => (
              <div key={a.id} style={{ border: "1px solid #E3DCCB", padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                <div>
                  <p className="msy-body" style={{ fontSize: 14, color: "#161513" }}>{a.name}</p>
                  <p className="msy-body" style={{ fontSize: 12, color: "#A8A192" }}>對應訂單：{a.orderId}{a.confirmed ? `　｜　已選片（${a.confirmedAt}）` : "　｜　尚未確認選片"}</p>
                </div>
                <button className="msy-btn msy-btn-dark msy-btn-sm" onClick={() => onOpenGallery(a.orderId)}>查看照片</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ================= 後台區域：預約管理 + 訂單管理 + 客戶管理 ================= */

/* ================= P8-3A：後台管理員登入閘門（真正接 Supabase 後端）================= */

function AdminLoginGate({ onLogin, loading, error, onBack }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  function submit(e) {
    e.preventDefault();
    if (!email.trim() || !password) return;
    onLogin(email.trim(), password);
  }

  return (
    <div style={{ minHeight: "100vh", background: "#FDFBF6", padding: "160px 6vw 100px" }}>
      <div style={{ maxWidth: 420, margin: "0 auto" }}>
        <p className="msy-body" style={{ color: "#B4491F", fontSize: 12, letterSpacing: 3, marginBottom: 12, textAlign: "center" }}>STAFF ONLY</p>
        <h2 className="msy-serif" style={{ fontSize: 30, marginBottom: 20, textAlign: "center" }}>後台管理員登入</h2>
        <div className="msy-notice">
          此處為 Supabase 後端驗證的管理員登入，一般會員帳號無法登入這裡。
        </div>
        <div>
          <label className="msy-label">管理員 Email</label>
          <input className="msy-input" type="email" maxLength={100} value={email} onChange={(e) => setEmail(e.target.value)} />
          <label className="msy-label">密碼</label>
          <div style={{ position: "relative" }}>
            <input className="msy-input" type={showPassword ? "text" : "password"} maxLength={100} value={password} onChange={(e) => setPassword(e.target.value)} style={{ paddingRight: 60 }} />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#B4491F", fontSize: 12, fontFamily: "'Noto Sans TC', sans-serif" }}
            >
              {showPassword ? "隱藏" : "顯示"}
            </button>
          </div>
          {error && <p className="msy-error">{error}</p>}
          <button className="msy-btn msy-btn-dark" style={{ width: "100%", marginTop: 12 }} type="button" disabled={loading} onClick={submit}>
            {loading ? "驗證中…" : "登入後台"}
          </button>
        </div>
        <div style={{ textAlign: "center", marginTop: 24 }}>
          <button className="msy-link-btn" onClick={onBack}>← 返回官網首頁</button>
        </div>
      </div>
    </div>
  );
}


function AdminArea({ adminTab, setAdminTab, bookings, customers, orders, albums, photos, auditLogs, onCancelBooking, onUpdateCustomer, onDeleteCustomer, onUpdateOrderStatus, onCreateAlbum, onAddTestPhotos, onMarkRetouching, onMarkCompleted, onBack, jumpOrderId, jumpStatusFilter, jumpToken, adminEmail, onLogoutAdmin }) {
  return (
    <div style={{ minHeight: "100vh", background: "#FDFBF6", padding: "120px 6vw 80px" }}>
      <div style={{ maxWidth: 1120, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 12 }}>
          <h2 className="msy-serif" style={{ fontSize: 32, color: "#161513" }}>後台管理</h2>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <span className="msy-body" style={{ fontSize: 12, color: "#A8A192" }}>管理員：{adminEmail}</span>
            <button className="msy-btn msy-btn-dark" onClick={onBack}>返回官網</button>
            <button className="msy-btn msy-btn-sm" style={{ borderColor: "#8A4444", color: "#8A4444" }} onClick={onLogoutAdmin}>登出</button>
          </div>
        </div>
        <div className="msy-notice" style={{ marginBottom: 24 }}>
          此登入已通過 Supabase 後端驗證身分與角色（真正的伺服器驗證，不是前端假旗標）。業務資料（客戶／預約／訂單等）目前仍是前端展示用資料，尚未搬進正式資料庫——這是下一階段的工作。
        </div>
        <div className="msy-admin-tabs">
          <button className={`msy-admin-tab ${adminTab === "bookings" ? "active" : ""}`} onClick={() => setAdminTab("bookings")}>預約管理</button>
          <button className={`msy-admin-tab ${adminTab === "orders" ? "active" : ""}`} onClick={() => setAdminTab("orders")}>訂單管理</button>
          <button className={`msy-admin-tab ${adminTab === "customers" ? "active" : ""}`} onClick={() => setAdminTab("customers")}>客戶管理</button>
          <button className={`msy-admin-tab ${adminTab === "audit" ? "active" : ""}`} onClick={() => setAdminTab("audit")}>變更紀錄</button>
        </div>

        {adminTab === "bookings" && <BookingsAdmin bookings={bookings} onCancel={onCancelBooking} />}
        {adminTab === "orders" && (
          <OrdersAdmin
            key={`orders-jump-${jumpToken}`}
            orders={orders} albums={albums} photos={photos}
            onUpdateStatus={onUpdateOrderStatus}
            onCreateAlbum={onCreateAlbum} onAddTestPhotos={onAddTestPhotos}
            onMarkRetouching={onMarkRetouching} onMarkCompleted={onMarkCompleted}
            initialSelectedId={jumpOrderId} initialStatusFilter={jumpStatusFilter}
          />
        )}
        {adminTab === "customers" && <CustomersAdmin customers={customers} orders={orders} onUpdate={onUpdateCustomer} onDelete={onDeleteCustomer} />}
        {adminTab === "audit" && <AuditLogAdmin logs={auditLogs} customers={customers} />}
      </div>
    </div>
  );
}

function AuditLogAdmin({ logs, customers }) {
  const nameFor = (id) => customers.find((c) => c.id === id)?.name || id || "—";
  return (
    <div>
      <div className="msy-notice">
        這裡記錄客戶「姓名／電話／Email」的每一次修改嘗試（不論成功或被拒絕），包含會員自行編輯與後台人員編輯。密碼欄位不會出現在紀錄內容中。
      </div>
      <table className="msy-admin-table">
        <thead><tr><th>時間</th><th>操作者</th><th>目標客戶</th><th>結果</th><th>變更內容 / 原因</th></tr></thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id}>
              <td>{log.timestamp}</td>
              <td>{log.actorType === "member" ? `會員本人（${nameFor(log.actorId)}）` : "後台人員"}</td>
              <td>{nameFor(log.targetCustomerId)}（{log.targetCustomerId}）</td>
              <td><span className={`msy-status-badge ${log.result === "success" ? "msy-status-confirmed" : "msy-status-cancelled"}`}>{log.result === "success" ? "成功" : "被拒絕"}</span></td>
              <td style={{ fontSize: 12 }}>
                {log.result === "rejected" ? log.reason : Object.entries(log.changes || {}).filter(([, v]) => v.before !== v.after).map(([field, v]) => `${field}：${v.before ?? "—"} → ${v.after ?? "—"}`).join("；") || "（欄位內容相同，無實際變更）"}
              </td>
            </tr>
          ))}
          {logs.length === 0 && <tr><td colSpan={5} style={{ textAlign: "center", color: "#A8A192" }}>目前還沒有任何客戶資料修改紀錄</td></tr>}
        </tbody>
      </table>
      <p className="msy-body" style={{ fontSize: 12, color: "#A8A192", marginTop: 16 }}>
        共 {logs.length} 筆紀錄。這是前端展示用的簡化版變更紀錄，正式上線後應改由後端資料庫記錄，並防止任何人（含系統管理員）竄改或刪除紀錄本身。
      </p>
    </div>
  );
}

function BookingsAdmin({ bookings, onCancel }) {
  const sorted = [...bookings].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  return (
    <div>
      <table className="msy-admin-table">
        <thead><tr><th>預約編號</th><th>日期</th><th>時間</th><th>客戶</th><th>電話</th><th>服務項目</th><th>狀態</th><th>操作</th></tr></thead>
        <tbody>
          {sorted.map((b) => (
            <tr key={b.id}>
              <td>{b.id}</td><td>{b.date}</td><td>{b.time}</td><td>{b.name}</td><td>{b.phone}</td><td>{b.serviceName}</td>
              <td><span className={`msy-status-badge ${b.status === "已確認" ? "msy-status-confirmed" : "msy-status-cancelled"}`}>{b.status}</span></td>
              <td>{b.status === "已確認" && <button className="msy-link-btn" onClick={() => onCancel(b.id)}>取消預約</button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="msy-body" style={{ fontSize: 12, color: "#A8A192", marginTop: 16 }}>共 {bookings.length} 筆預約（含測試資料）。取消後對應訂單也會一併標記為已取消，該時段重新開放。</p>
    </div>
  );
}

function OrdersAdmin({ orders, albums, photos, onUpdateStatus, onCreateAlbum, onAddTestPhotos, onMarkRetouching, onMarkCompleted, initialSelectedId, initialStatusFilter }) {
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState(initialStatusFilter || "全部");
  const [selectedId, setSelectedId] = useState(initialSelectedId || null);

  const filtered = orders.filter((o) => {
    const q = search.trim().toLowerCase();
    const matchesText = !q || o.id.toLowerCase().includes(q) || o.customerName.toLowerCase().includes(q) || o.phone.includes(q);
    const matchesDate = !dateFilter || o.date === dateFilter;
    let matchesStatus;
    if (statusFilter === "全部") matchesStatus = true;
    else if (statusFilter === "待拍攝") matchesStatus = o.status === "已預約" || o.status === "已付款";
    else matchesStatus = o.status === statusFilter;
    return matchesText && matchesDate && matchesStatus;
  });

  const selected = orders.find((o) => o.id === selectedId);
  if (selected) {
    return (
      <OrderDetail
        order={selected} albums={albums} photos={photos}
        onBack={() => setSelectedId(null)}
        onUpdateStatus={(status) => onUpdateStatus(selected.id, status)}
        onCreateAlbum={onCreateAlbum} onAddTestPhotos={onAddTestPhotos}
        onMarkRetouching={onMarkRetouching} onMarkCompleted={onMarkCompleted}
      />
    );
  }

  const sorted = [...filtered].sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));

  return (
    <div>
      <div className="msy-filter-bar">
        <input className="msy-input" style={{ maxWidth: 280, marginBottom: 0 }} placeholder="搜尋訂單編號、姓名或電話" value={search} onChange={(e) => setSearch(e.target.value)} />
        <input type="date" className="msy-input" style={{ maxWidth: 180, marginBottom: 0 }} value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} />
        <select className="msy-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="全部">全部狀態</option>
          <option value="待拍攝">待拍攝（已預約＋已付款）</option>
          {ORDER_STATUSES.map((s) => (<option key={s} value={s}>{s}</option>))}
        </select>
        {(search || dateFilter || statusFilter !== "全部") && (<button className="msy-link-btn" onClick={() => { setSearch(""); setDateFilter(""); setStatusFilter("全部"); }}>清除篩選</button>)}
      </div>
      <table className="msy-admin-table">
        <thead><tr><th>訂單編號</th><th>日期</th><th>時間</th><th>客戶</th><th>電話</th><th>服務項目</th><th>金額</th><th>狀態</th><th></th></tr></thead>
        <tbody>
          {sorted.map((o) => (
            <tr key={o.id}>
              <td>{o.id}</td><td>{o.date}</td><td>{o.time}</td><td>{o.customerName}</td><td>{o.phone}</td><td>{o.serviceName}</td><td>{formatMoney(o.amount)}</td>
              <td><span className={`msy-status-badge ${ORDER_STATUS_STYLE[o.status]}`}>{o.status}</span></td>
              <td><button className="msy-link-btn" onClick={() => setSelectedId(o.id)}>查看訂單</button></td>
            </tr>
          ))}
          {sorted.length === 0 && <tr><td colSpan={9} style={{ textAlign: "center", color: "#A8A192" }}>找不到符合條件的訂單</td></tr>}
        </tbody>
      </table>
      <p className="msy-body" style={{ fontSize: 12, color: "#A8A192", marginTop: 16 }}>共 {orders.length} 筆訂單（含測試資料），目前顯示 {sorted.length} 筆。</p>
    </div>
  );
}

function OrderDetail({ order, albums, photos, onBack, onUpdateStatus, onCreateAlbum, onAddTestPhotos, onMarkRetouching, onMarkCompleted }) {
  const [albumName, setAlbumName] = useState(`${order.serviceName} - ${order.customerName}`);
  const album = albums.find((a) => a.orderId === order.id);
  const albumPhotos = album ? photos.filter((p) => p.albumId === album.id) : [];
  const selectedPhotos = albumPhotos.filter((p) => p.selected);

  return (
    <div>
      <button className="msy-link-btn" style={{ marginBottom: 20 }} onClick={onBack}>← 返回訂單列表</button>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32, marginBottom: 32 }}>
        <div style={{ border: "1px solid #E3DCCB", padding: 28, background: "#FDFBF6" }}>
          <h3 className="msy-serif" style={{ fontSize: 22, marginBottom: 20 }}>訂單資料　{order.id}</h3>
          <p className="msy-body" style={{ fontSize: 14, marginBottom: 10 }}>客戶編號：{order.customerId || "（客戶已刪除）"}</p>
          <p className="msy-body" style={{ fontSize: 14, marginBottom: 10 }}>對應預約編號：{order.bookingId}</p>
          <p className="msy-body" style={{ fontSize: 14, marginBottom: 10 }}>客戶姓名：{order.customerName}</p>
          <p className="msy-body" style={{ fontSize: 14, marginBottom: 10 }}>電話：{order.phone}</p>
          <p className="msy-body" style={{ fontSize: 14, marginBottom: 10 }}>服務項目：{order.serviceName}</p>
          <p className="msy-body" style={{ fontSize: 14, marginBottom: 10 }}>訂單金額：{formatMoney(order.amount)}</p>
          <p className="msy-body" style={{ fontSize: 14, marginBottom: 10 }}>拍攝日期／時間：{order.date}　{order.time}</p>
          <p className="msy-body" style={{ fontSize: 12, color: "#A8A192" }}>建立時間：{order.createdAt}</p>
        </div>
        <div style={{ border: "1px solid #E3DCCB", padding: 28, background: "#F4EEE1" }}>
          <h3 className="msy-serif" style={{ fontSize: 22, marginBottom: 20 }}>訂單狀態</h3>
          <label className="msy-label">目前狀態</label>
          <select className="msy-select" style={{ width: "100%", marginBottom: 20 }} value={order.status} onChange={(e) => onUpdateStatus(e.target.value)}>
            {ORDER_STATUSES.map((s) => (<option key={s} value={s}>{s}</option>))}
          </select>
          <div style={{ height: 1, background: "#E3DCCB", margin: "20px 0" }} />
          <p className="msy-label" style={{ marginBottom: 10 }}>金流資訊（保留欄位，尚未串接正式付款系統）</p>
          <p className="msy-body" style={{ fontSize: 13, color: "#A8A192", marginBottom: 6 }}>付款方式：{order.paymentMethod || "尚未串接"}</p>
          <p className="msy-body" style={{ fontSize: 13, color: "#A8A192" }}>金流交易編號：{order.paymentReference || "尚未串接"}</p>
          {order.status !== "已取消" && (<button className="msy-link-btn" style={{ color: "#8A4444", marginTop: 24 }} onClick={() => onUpdateStatus("已取消")}>取消此訂單（將同步釋放預約時段）</button>)}
        </div>
      </div>

      {/* P5：照片／選片管理 */}
      <div style={{ border: "1px solid #E3DCCB", padding: 28, background: "#FDFBF6" }}>
        <h3 className="msy-serif" style={{ fontSize: 22, marginBottom: 20 }}>照片／選片管理</h3>

        {!album ? (
          <div>
            <p className="msy-body" style={{ fontSize: 13, color: "#6B6459", marginBottom: 16 }}>此訂單尚未建立照片相簿。</p>
            <label className="msy-label">相簿名稱</label>
            <input className="msy-input" style={{ maxWidth: 400 }} value={albumName} onChange={(e) => setAlbumName(e.target.value)} />
            <button className="msy-btn msy-btn-dark msy-btn-sm" style={{ marginTop: 12 }} onClick={() => onCreateAlbum(order.id, albumName.trim() || `相簿-${order.id}`)}>建立相簿</button>
          </div>
        ) : (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
              <div>
                <p className="msy-body" style={{ fontSize: 15, color: "#161513" }}>{album.name}</p>
                <p className="msy-body" style={{ fontSize: 12, color: "#A8A192" }}>共 {albumPhotos.length} 張照片　｜　客戶已選 {selectedPhotos.length} 張{album.confirmed ? `　｜　選片時間：${album.confirmedAt}` : "　｜　客戶尚未確認選片"}</p>
              </div>
              <button className="msy-btn msy-btn-dark msy-btn-sm" onClick={() => onAddTestPhotos(album.id, order.id, 6)}>新增 6 張測試照片</button>
            </div>

            {albumPhotos.length > 0 && (
              <div className="msy-photo-grid" style={{ marginBottom: 24 }}>
                {albumPhotos.map((p) => (
                  <div key={p.id} className={`msy-photo-tile ${p.selected ? "selected" : ""}`} style={{ cursor: "default" }}>
                    <img src={p.thumbnailUrl} alt={p.name} />
                    {p.selected && <span className="msy-photo-check on" style={{ position: "absolute", top: 8, right: 8, cursor: "default" }}>✓</span>}
                    <div className="msy-photo-name">{p.name}　{p.retouchStatus !== "未修圖" && `· ${p.retouchStatus}`}</div>
                  </div>
                ))}
              </div>
            )}

            {selectedPhotos.length > 0 && (
              <div style={{ borderTop: "1px solid #E3DCCB", paddingTop: 20 }}>
                <h4 className="msy-serif" style={{ fontSize: 18, marginBottom: 12 }}>已選照片清單</h4>
                <table className="msy-admin-table" style={{ marginBottom: 16 }}>
                  <thead><tr><th>照片名稱</th><th>修圖狀態</th></tr></thead>
                  <tbody>{selectedPhotos.map((p) => (<tr key={p.id}><td>{p.name}</td><td>{p.retouchStatus}</td></tr>))}</tbody>
                </table>
                {album.confirmed && (
                  <div style={{ display: "flex", gap: 12 }}>
                    <button className="msy-btn msy-btn-dark msy-btn-sm" onClick={() => onMarkRetouching(order.id)}>標記為修圖中</button>
                    <button className="msy-btn msy-btn-dark msy-btn-sm" onClick={() => onMarkCompleted(order.id)}>標記為已完成</button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function CustomersAdmin({ customers, orders, onUpdate, onDelete }) {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const filtered = customers.filter((c) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return c.name.toLowerCase().includes(q) || c.phone.includes(q) || c.email.toLowerCase().includes(q);
  });

  function statsFor(customerId) {
    const history = orders.filter((o) => o.customerId === customerId).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
    const active = history.filter((o) => o.status !== "已取消");
    return { history, orderCount: active.length, totalSpent: active.reduce((sum, o) => sum + (o.amount || 0), 0), lastDate: history[0]?.date || "—" };
  }

  const selected = customers.find((c) => c.id === selectedId);
  if (selected) {
    return (
      <CustomerDetail
        customer={selected} stats={statsFor(selected.id)}
        onBack={() => setSelectedId(null)}
        onUpdate={(patch) => onUpdate(selected.id, patch)}
        onDelete={() => setDeleteTarget(selected)}
      />
    );
  }

  return (
    <div>
      <input className="msy-input" style={{ maxWidth: 360, marginBottom: 20 }} placeholder="搜尋姓名、電話或 Email" value={search} onChange={(e) => setSearch(e.target.value)} />
      <table className="msy-admin-table">
        <thead><tr><th>客戶編號</th><th>姓名</th><th>電話</th><th>Email</th><th>預約次數</th><th>最後預約日期</th><th>備註</th><th></th></tr></thead>
        <tbody>
          {filtered.map((c) => {
            const s = statsFor(c.id);
            return (<tr key={c.id}><td>{c.id}</td><td>{c.name}</td><td>{c.phone}</td><td>{c.email}</td><td>{s.orderCount}</td><td>{s.lastDate}</td><td>{c.note || "—"}</td><td><button className="msy-link-btn" onClick={() => setSelectedId(c.id)}>查看完整紀錄</button></td></tr>);
          })}
          {filtered.length === 0 && <tr><td colSpan={8} style={{ textAlign: "center", color: "#A8A192" }}>找不到符合的客戶</td></tr>}
        </tbody>
      </table>
      {deleteTarget && (<ConfirmDeleteModal customer={deleteTarget} onCancel={() => setDeleteTarget(null)} onConfirm={() => { onDelete(deleteTarget.id); setDeleteTarget(null); }} />)}
    </div>
  );
}

function CustomerDetail({ customer, stats, onBack, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: customer.name, phone: customer.phone, email: customer.email, note: customer.note });
  const [error, setError] = useState("");

  function save() {
    if (!form.name.trim()) return setError("姓名不可空白");
    if (!/^09\d{2}-?\d{3}-?\d{3}$/.test(form.phone.trim())) return setError("電話格式錯誤，例如 0912-345-678");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return setError("Email 格式錯誤");
    const result = onUpdate({ name: form.name.trim(), phone: form.phone.trim(), email: form.email.trim(), note: form.note.trim() });
    if (result && result.success === false) { setError(result.message); return; }
    setError("");
    setEditing(false);
  }

  return (
    <div>
      <button className="msy-link-btn" style={{ marginBottom: 20 }} onClick={onBack}>← 返回客戶列表</button>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32, marginBottom: 40 }}>
        <div style={{ border: "1px solid #E3DCCB", padding: 28, background: "#FDFBF6" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <h3 className="msy-serif" style={{ fontSize: 22 }}>客戶資料　{customer.id}</h3>
            {!editing && <button className="msy-link-btn" onClick={() => setEditing(true)}>編輯</button>}
          </div>
          {editing ? (
            <>
              <label className="msy-label">姓名</label><input className="msy-input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              <label className="msy-label">電話</label><input className="msy-input" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
              <label className="msy-label">Email</label><input className="msy-input" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
              <label className="msy-label">備註</label><textarea className="msy-input" rows={3} value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
              {error && <p className="msy-error">{error}</p>}
              <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                <button className="msy-btn msy-btn-dark msy-btn-sm" onClick={save}>儲存</button>
                <button className="msy-link-btn" onClick={() => { setEditing(false); setError(""); setForm({ name: customer.name, phone: customer.phone, email: customer.email, note: customer.note }); }}>取消</button>
              </div>
            </>
          ) : (
            <>
              <p className="msy-body" style={{ fontSize: 14, marginBottom: 10 }}>姓名：{customer.name}</p>
              <p className="msy-body" style={{ fontSize: 14, marginBottom: 10 }}>電話：{customer.phone}</p>
              <p className="msy-body" style={{ fontSize: 14, marginBottom: 10 }}>Email：{customer.email}</p>
              <p className="msy-body" style={{ fontSize: 14, marginBottom: 10 }}>備註：{customer.note || "—"}</p>
              <p className="msy-body" style={{ fontSize: 12, color: "#A8A192", marginTop: 16 }}>建檔日期：{customer.createdAt}</p>
              <button className="msy-link-btn" style={{ color: "#8A4444", marginTop: 20 }} onClick={onDelete}>刪除此客戶資料</button>
            </>
          )}
        </div>
        <div style={{ border: "1px solid #E3DCCB", padding: 28, background: "#F4EEE1" }}>
          <h3 className="msy-serif" style={{ fontSize: 22, marginBottom: 20 }}>消費統計</h3>
          <p className="msy-body" style={{ fontSize: 14, marginBottom: 10 }}>預約次數：{stats.orderCount} 次</p>
          <p className="msy-body" style={{ fontSize: 14, marginBottom: 10 }}>累積消費金額：{formatMoney(stats.totalSpent)}</p>
          <p className="msy-body" style={{ fontSize: 14 }}>最後一次預約日期：{stats.lastDate}</p>
        </div>
      </div>
      <h3 className="msy-serif" style={{ fontSize: 22, marginBottom: 16 }}>歷史訂單紀錄</h3>
      <table className="msy-admin-table">
        <thead><tr><th>訂單編號</th><th>日期</th><th>時間</th><th>拍攝服務</th><th>金額</th><th>狀態</th></tr></thead>
        <tbody>
          {stats.history.map((o) => (<tr key={o.id}><td>{o.id}</td><td>{o.date}</td><td>{o.time}</td><td>{o.serviceName}</td><td>{formatMoney(o.amount)}</td><td><span className={`msy-status-badge ${ORDER_STATUS_STYLE[o.status]}`}>{o.status}</span></td></tr>))}
          {stats.history.length === 0 && <tr><td colSpan={6} style={{ textAlign: "center", color: "#A8A192" }}>尚無訂單紀錄</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function ConfirmDeleteModal({ customer, onCancel, onConfirm }) {
  return (
    <div className="msy-modal-backdrop">
      <div className="msy-modal">
        <h3 className="msy-serif" style={{ fontSize: 20, marginBottom: 16 }}>確認刪除客戶資料？</h3>
        <p className="msy-body" style={{ fontSize: 14, color: "#4A453D", marginBottom: 8 }}>即將刪除：<strong>{customer.name}</strong>（{customer.id}）</p>
        <p className="msy-body" style={{ fontSize: 13, color: "#8A4444", marginBottom: 24 }}>此操作無法復原。該客戶過去的訂單與預約紀錄會保留，但不再顯示於任何客戶檔案下。</p>
        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
          <button className="msy-link-btn" onClick={onCancel}>取消</button>
          <button className="msy-btn msy-btn-sm" style={{ background: "#8A4444", borderColor: "#8A4444", color: "#FDFBF6" }} onClick={onConfirm}>確定刪除</button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: { background: "#FDFBF6", minHeight: "100vh" },
  nav: { position: "fixed", top: 0, left: 0, right: 0, zIndex: 50, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "22px 6vw" },
  hero: { position: "relative", height: "100vh", minHeight: 560, overflow: "hidden" },
  heroImg: { width: "100%", height: "100%", objectFit: "cover", position: "absolute", inset: 0 },
  heroOverlay: { position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(22,21,19,0.55) 0%, rgba(22,21,19,0.35) 45%, rgba(22,21,19,0.85) 100%)" },
  heroContent: { position: "relative", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "0 20px" },
  sectionHead: { textAlign: "center", marginBottom: 56 },
  eyebrow: { fontSize: 12, letterSpacing: 4, color: "#B4491F", marginBottom: 12 },
  sectionTitle: { fontSize: 40, color: "#161513", fontWeight: 400 },
};
