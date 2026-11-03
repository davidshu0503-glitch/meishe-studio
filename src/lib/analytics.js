/*
 * Google Analytics 4（GA4）
 * 到 Vercel → 專案 → Settings → Environment Variables 新增：
 *   VITE_GA_ID = G-XXXXXXXXXX（你的評估 ID）
 * 重新部署後就會開始記錄。沒有設定時，這個檔案什麼都不做。
 */
const GA_ID = import.meta.env.VITE_GA_ID;
let loaded = false;

function load() {
  if (loaded || !GA_ID || typeof window === "undefined") return;
  loaded = true;
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() { window.dataLayer.push(arguments); };
  window.gtag("js", new Date());
  // 換頁由 trackPageView 手動送出，避免重複計算
  window.gtag("config", GA_ID, { send_page_view: false });
}

export function trackPageView(path) {
  if (!GA_ID) return;
  load();
  window.gtag("event", "page_view", {
    page_path: path,
    page_location: window.location.href,
    page_title: document.title,
  });
}

// 重要動作（例如預約成功）可呼叫：trackEvent("booking_complete", { service: "證件照" })
export function trackEvent(name, params = {}) {
  if (!GA_ID) return;
  load();
  window.gtag("event", name, params);
}
