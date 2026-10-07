import { createClient } from "@supabase/supabase-js";

// 可在 Vercel → Settings → Environment Variables 設定 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 覆蓋。
// anon / publishable key 本來就是公開金鑰，資料安全由資料庫 RLS 規則把關。
// 示範模式（VITE_DEMO=1）：只用於預覽，所有資料存在瀏覽器記憶體，正式版不會包含
export const DEMO = import.meta.env.VITE_DEMO === "1";
export const SUPABASE_URL = DEMO ? "https://demo.gime.local" : import.meta.env.VITE_SUPABASE_URL || "https://ysfutoqeuicjbjxvksso.supabase.co";
export const SUPABASE_ANON_KEY = DEMO ? "demo" : import.meta.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_uG5c75iwwl_LbDlVwthu_Q_P3KZBG3-";

const memoryStorage = (() => { const m = {}; return { getItem: (k) => m[k] ?? null, setItem: (k, v) => { m[k] = v; }, removeItem: (k) => { delete m[k]; } }; })();

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: !DEMO, ...(DEMO ? { storage: memoryStorage } : {}) },
  global: { fetch: (...args) => window.fetch(...args) },
});

/** 把 storage 路徑轉成可顯示的網址；已是完整網址就原樣回傳 */
export function imgUrl(path, bucket = "portfolio", opts) {
  if (!path) return "";
  if (/^https?:\/\//.test(path) || path.startsWith("data:") || path.startsWith("blob:") || path.startsWith("/")) return path;
  if (DEMO && window.__GIME_DEMO_FILES?.[`${bucket}/${path}`]) return window.__GIME_DEMO_FILES[`${bucket}/${path}`];
  const { data } = supabase.storage.from(bucket).getPublicUrl(path, opts);
  return data.publicUrl;
}

/** 產生強制下載的網址（Supabase 會加上 Content-Disposition） */
export function downloadUrl(path, bucket, filename) {
  if (!path) return "";
  if (/^(https?:|data:|blob:)/.test(path)) return path;
  if (DEMO) return imgUrl(path, bucket);
  const { data } = supabase.storage.from(bucket).getPublicUrl(path, { download: filename || true });
  return data.publicUrl;
}

/** 通知寄送：事件發生後呼叫，立即處理佇列（排程每 5 分鐘也會自動處理，這裡失敗不影響流程） */
export function kickNotifications() {
  supabase.functions.invoke("send-notifications", { body: {} }).catch(() => {});
}

/** 把 Supabase / Postgres 錯誤轉成使用者看得懂的中文 */
export function errMsg(error) {
  if (!error) return "";
  const m = error.message || String(error);
  if (/Invalid login credentials/i.test(m)) return "帳號或密碼錯誤";
  if (/Email not confirmed/i.test(m)) return "Email 尚未驗證，請先到信箱點擊驗證連結";
  if (/User already registered/i.test(m)) return "此 Email 已註冊，請直接登入";
  if (/Password should be at least/i.test(m)) return "密碼至少需要 6 個字元";
  if (/duplicate key.*phone/i.test(m)) return "此電話已被其他客戶使用";
  if (/duplicate key.*email/i.test(m)) return "此 Email 已被其他客戶使用";
  if (/bookings_slot_uq/i.test(m)) return "此時段已有其他預約";
  if (/Failed to fetch|NetworkError/i.test(m)) return "網路連線失敗，請稍後再試";
  if (/row-level security/i.test(m)) return "沒有權限執行此操作";
  return m;
}
