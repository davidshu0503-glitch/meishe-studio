# 即美創畫攝影 GIME STUDIO • PHOTO × AI

新北市預約制攝影工作室的官方網站與自動化管理系統。

**上線步驟請看 [`部署說明.md`](./部署說明.md)。**

## 功能

**前台**：首頁輪播、作品集（分類／分頁／燈箱／防拷貝浮水印）、服務與價格、關於我們、線上預約（即時空檔、同時段不重複）、線上選片與交件（ZIP 下載）、會員註冊登入與會員中心。

**後台 `/admin`**：營運中心儀表板、預約管理（代客預約／改期／取消）、訂單與相簿（上傳預覽照、開放選片、上傳精修檔、交件）、客戶管理、通知中心、網站內容管理（不用改程式）、變更紀錄、CSV 匯出。

**自動化**：預約→建客戶→建訂單→通知；狀態變更自動通知客戶（Email＋LINE）；拍攝前一天自動提醒；失敗自動重試；所有修改自動留紀錄。

## 技術

- React 18 + Vite + React Router（部署於 Vercel）
- Supabase：Postgres（RLS 權限）、Auth、Storage、Edge Functions、pg_cron
- Resend（Email）、LINE Messaging API

## 專案結構

```
src/
  main.jsx              路由
  lib/                  supabase 連線、登入狀態、網站內容、工具
  components/           版面、燈箱、防拷貝、共用元件
  pages/                前台頁面
  pages/admin/          後台頁面
supabase/
  01-setup.sql          資料庫、權限、預設內容（可重複執行）
  02-automation.sql     自動排程
  functions/            Edge Functions（寄送通知、LINE webhook）
```

## 本機開發

```
npm install
npm run dev
```
