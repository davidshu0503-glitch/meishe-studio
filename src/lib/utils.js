export const ORDER_STATUSES = ["待付款", "已付款", "已預約", "拍攝完成", "待選片", "客戶已選片", "修圖中", "已完成", "已取消"];
export const BOOKING_STATUSES = ["已預約", "已完成", "已取消"];

export const STATUS_TONE = {
  待付款: "warn", 已付款: "ok", 已預約: "ok", 拍攝完成: "info", 待選片: "warn",
  客戶已選片: "info", 修圖中: "info", 已完成: "done", 已取消: "muted",
};

export const EVENT_LABELS = {
  booking_created: "預約完成／訂單建立",
  booking_cancelled: "預約取消",
  payment_received: "付款完成",
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
