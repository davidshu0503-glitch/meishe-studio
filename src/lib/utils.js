export const ORDER_STATUSES = ["待付款", "已付款", "已預約", "拍攝完成", "待選片", "客戶已選片", "修圖中", "已完成", "已取消"];
export const BOOKING_STATUSES = ["已預約", "已完成", "已取消"];

export const STATUS_TONE = {
  待付款: "warn", 已付款: "ok", 已預約: "ok", 拍攝完成: "info", 待選片: "warn",
  客戶已選片: "info", 修圖中: "info", 已完成: "done", 已取消: "muted",
};

export const EVENT_LABELS = {
  booking_created: "預約完成／訂單建立",
  booking_cancelled: "預約取消",
  payment_received: "付款完成（結清）",
  deposit_received: "已收到訂金",
  album_ready: "照片可選片",
  selection_done: "客戶完成選片",
  retouch_started: "開始修圖",
  delivered: "照片可交件",
  shoot_reminder: "拍攝前一天提醒",
};

export const NOTIFY_STATUS = { queued: "排隊中", sending: "寄送中", sent: "已送出", failed: "失敗", skipped: "略過" };

export const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

export const money = (n) => `NT$ ${Number(n || 0).toLocaleString("zh-TW")}`;

/** 台灣時區的 YYYY-MM-DD */
export function twDate(offsetDays = 0, base = new Date()) {
  const d = new Date(base.getTime() + offsetDays * 86400000);
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Taipei" }).format(d);
}

export function addDays(ymd, n) {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

export function weekday(ymd) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function fmtDate(ymd) {
  if (!ymd) return "";
  const s = String(ymd).slice(0, 10);
  const [, m, d] = s.split("-");
  return `${Number(m)}/${Number(d)}（${WEEKDAYS[weekday(s)]}）`;
}

export function fmtDateTime(ts) {
  if (!ts) return "";
  return new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(new Date(ts));
}

export const normPhone = (p) => (p || "").replace(/\D/g, "");

export function uid() {
  return (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36));
}

/** 上傳前在瀏覽器壓縮圖片（可選擇加上浮水印） */
export async function resizeImage(file, { maxSize = 2000, quality = 0.86, watermark = "" } = {}) {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale), h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, 0, 0, w, h);
  if (watermark) {
    const size = Math.max(16, Math.round(Math.min(w, h) / 22));
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.rotate(-Math.PI / 7);
    ctx.font = `500 ${size}px "Noto Sans TC", sans-serif`;
    ctx.fillStyle = "rgba(255,255,255,0.28)";
    ctx.textAlign = "center";
    const step = size * 5;
    for (let y = -h; y < h; y += step) for (let x = -w; x < w; x += size * 14) ctx.fillText(watermark, x + ((y / step) % 2) * size * 7, y);
    ctx.restore();
  }
  const blob = await new Promise((r) => canvas.toBlob(r, "image/jpeg", quality));
  return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
}

export function stem(filename) {
  return (filename || "").replace(/\.[^.]+$/, "").toLowerCase();
}

export function csvDownload(filename, rows) {
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const text = "﻿" + rows.map((r) => r.map(esc).join(",")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/* ---------- 作品／服務分層：引流 → 主力 → 加值（一拍多風格是跨分層的展示） ---------- */
// name：後台用的內部名稱；label：前台顯示給客人看的名稱（不會出現「引流」等行銷用語）
export const TIERS = {
  main: { name: "主力", label: "典藏藝術肖像", en: "Signature Art", desc: "金箔、厚塗油畫、雕塑材質。適合做成大幅掛畫，掛在客廳傳家的作品。" },
  addon: { name: "加值", label: "風格加購", en: "Style Add-ons", desc: "同一組照片再轉成奇幻、水彩、水墨、普普等風格，拍一次就能擁有多種版本。" },
  entry: { name: "引流", label: "入門拍攝", en: "Start Here", desc: "形象照、證件照、孕婦寫真、全家福。每件藝術作品，都從一次好好的拍攝開始。" },
  hidden: { name: "不顯示", label: "", en: "", desc: "" },
};
export const TIER_ORDER = ["entry", "main", "addon"];
export const TIER_KEYS = [...TIER_ORDER, "hidden"];

// 資料庫還沒升級（沒有 tier 欄位）時，依代碼推測分層
const TIER_GUESS = {
  gold_leaf: "main", impasto_oil: "main", sculpture: "main",
  fantasy_light: "addon", watercolor: "addon", ink_sketch: "addon", pop_art: "addon", cinematic: "addon", mixed_media: "addon", ai_art: "addon",
  portrait: "entry", maternity: "entry", family: "entry", bw_studio: "entry", wedding: "entry", commercial: "entry",
  id_photo: "entry", business: "entry", wedding_pkg: "entry", commercial_pkg: "entry", ai_portrait: "addon", ai_creation: "addon", art_print: "main", art_collection: "main",
};
export const tierOf = (row) => (TIER_KEYS.includes(row?.tier) ? row.tier : TIER_GUESS[row?.slug || row?.id] || "addon");

/** 價格顯示：0 元代表需洽詢報價 */
export const priceText = (s) => (Number(s?.price) > 0 ? money(s.price) : s?.price_note || "洽詢報價");
/** 價格後綴（「起」「／2 小時」）；洽詢報價時後綴已經顯示在主價格，不重複 */
export const priceNote = (s) => (Number(s?.price) > 0 ? s?.price_note || "" : "");

/* ---------- 預付訂金制（規則與資料庫 deposit_for 相同；最終金額以資料庫為準） ---------- */
/** booking 設定裡的 deposit：{ type: "percent" | "amount" | "none", value, days, policy } */
export function depositOf(amount, cfg) {
  const d = cfg?.deposit;
  const a = Number(amount) || 0;
  const v = Number(d?.value) || 0;
  if (!d || a <= 0 || v <= 0) return 0;
  if (d.type === "percent") return Math.min(a, Math.max(1, Math.round((a * v) / 100)));
  if (d.type === "amount") return Math.min(a, v);
  return 0;
}
/** 付款期限：今天 + N 天，但最晚到拍攝前一天 */
export function depositDue(shootDate, cfg) {
  const days = Math.max(0, Number(cfg?.deposit?.days ?? 3));
  const today = twDate();
  const byDays = addDays(today, days);
  if (!shootDate) return byDays;
  const beforeShoot = addDays(shootDate, -1);
  const latest = beforeShoot < today ? today : beforeShoot;
  return byDays < latest ? byDays : latest;
}
export const depositLabel = (cfg) => {
  const d = cfg?.deposit;
  if (!d || !(Number(d.value) > 0)) return "";
  return d.type === "percent" ? `訂金 ${d.value}%` : d.type === "amount" ? `訂金 NT$ ${Number(d.value).toLocaleString("zh-TW")}` : "";
};
