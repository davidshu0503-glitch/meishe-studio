import { supabase } from "./supabase";

/** 行銷活動的四種版位 */
export const PROMO_KINDS = {
  hero: { name: "首頁橫幅", desc: "插在首頁輪播最前面，大圖＋標題＋按鈕" },
  bar: { name: "公告列", desc: "網站最上方一條細長公告，客人可關閉" },
  offer: { name: "優惠活動", desc: "顯示在首頁「限時優惠」與「優惠活動」頁" },
  popup: { name: "彈出視窗", desc: "客人第一次進站時跳出一次" },
};

/** 活動狀態：草稿／排程中／進行中／已結束 */
export function promoStatus(p, now = Date.now()) {
  if (!p.published) return "draft";
  if (p.start_at && new Date(p.start_at).getTime() > now) return "scheduled";
  if (p.end_at && new Date(p.end_at).getTime() <= now) return "ended";
  return "live";
}
export const STATUS_LABEL = { draft: "草稿（未上架）", scheduled: "排程中", live: "進行中", ended: "已結束" };
export const STATUS_TONE = { draft: "muted", scheduled: "info", live: "ok", ended: "warn" };

export const isLive = (p, now) => promoStatus(p, now) === "live";

/** 記錄點擊（失敗不影響畫面） */
export function trackClick(p) {
  if (!p?.id) return;
  supabase.rpc("promo_click", { p_id: p.id }).then(() => {}, () => {});
}

/** 站內連結用 <Link>，外部網址開新分頁 */
export const isExternal = (url) => /^https?:\/\//.test(url || "");

/** 剩餘天數文字 */
export function endsText(p, now = Date.now()) {
  if (!p.end_at) return "";
  const ms = new Date(p.end_at).getTime() - now;
  if (ms <= 0) return "已結束";
  const d = Math.ceil(ms / 86400000);
  return d <= 1 ? "今天截止" : `剩 ${d} 天`;
}

/** 本機記錄：已關閉的公告列、已看過的彈出視窗 */
export const seen = {
  has: (key) => { try { return localStorage.getItem(`gime:${key}`) === "1"; } catch { return false; } },
  set: (key) => { try { localStorage.setItem(`gime:${key}`, "1"); } catch { /* 無痕模式時忽略 */ } },
};
