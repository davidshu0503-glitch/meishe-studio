import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { trackPageView } from "../lib/analytics";

/*
 * 每一頁各自的搜尋描述與分享預覽。
 * Google 搜尋結果、LINE / FB 分享卡片會讀這些內容。
 * 想改文字直接改下面這張表即可。
 */
const SITE = "https://www.gime160.com";
const BRAND = "即美創畫攝影 GIME STUDIO";
const DEFAULT_IMAGE = `${SITE}/og-image.jpg`;

const PAGES = {
  "/": {
    title: "即美創畫攝影 GIME STUDIO • PHOTO × AI｜新北預約制攝影工作室",
    description: "新北市預約制攝影工作室，結合專業人像攝影與 AI 影像創畫。證件照、個人寫真、全家福、商業形象照、一拍多風格藝術肖像，線上預約・線上選片・雲端交件。",
  },
  "/portfolio": {
    title: `作品集｜${BRAND}`,
    description: "即美創畫攝影作品集：人像寫真、全家福、孕期、商業形象，以及水彩、油畫、金箔、水墨等一拍多風格 AI 藝術肖像作品。",
  },
  "/services": {
    title: `服務與價格｜新北證件照・形象照・全家福｜${BRAND}`,
    description: "證件照 NT$300 起、商業形象照、個人寫真、全家福、婚紗與商業方案價格一覽，另有一拍多風格加購與典藏藝術掛畫。所有方案皆含線上選片與雲端交件。",
  },
  "/booking": {
    title: `線上預約｜${BRAND}`,
    description: "線上選擇拍攝項目與時段，即時查看空檔，送出後立即取得預約編號。新北市預約制攝影工作室，電話 02-8972-8189。",
  },
  "/offers": {
    title: `優惠活動｜${BRAND}`,
    description: "即美創畫攝影最新檔期與優惠方案，線上預約時自動帶入優惠。",
  },
  "/about": {
    title: `關於我們｜${BRAND}`,
    description: "認識即美創畫攝影 GIME STUDIO：以光影記錄真實，以 AI 延展想像。新北市預約制攝影工作室。",
  },
};

// 不希望被搜尋引擎收錄的頁面（客人個人資料）
const NOINDEX = ["/gallery", "/member"];

function setMeta(attr, key, content) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setCanonical(href) {
  let el = document.head.querySelector('link[rel="canonical"]');
  if (!el) {
    el = document.createElement("link");
    el.rel = "canonical";
    document.head.appendChild(el);
  }
  el.href = href;
}

export default function Seo() {
  const { pathname } = useLocation();

  useEffect(() => {
    const path = pathname.replace(/\/+$/, "") || "/";
    const page = PAGES[path];
    const url = `${SITE}${path === "/" ? "/" : path}`;

    if (page) {
      // 頁面元件裡的 useTitle 會先設定標題，這裡用更適合搜尋的版本覆蓋
      document.title = page.title;
      setMeta("name", "description", page.description);
      setMeta("property", "og:title", page.title);
      setMeta("property", "og:description", page.description);
    }
    setMeta("property", "og:url", url);
    setMeta("property", "og:image", DEFAULT_IMAGE);
    setCanonical(url);
    setMeta("name", "robots", NOINDEX.some((p) => path.startsWith(p)) ? "noindex, nofollow" : "index, follow");

    trackPageView(path);
  }, [pathname]);

  return null;
}
