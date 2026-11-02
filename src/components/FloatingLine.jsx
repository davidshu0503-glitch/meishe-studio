import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useSite } from "../lib/site";
import { lineOaId } from "./LineBind";

const DEMO = import.meta.env.VITE_DEMO === "1";

/** 加入官方帳號好友的連結：手機會直接打開 LINE，電腦會顯示 QR Code 頁 */
export function lineAddUrl(studio) {
  const oa = lineOaId(studio);
  return oa ? `https://line.me/R/ti/p/${encodeURIComponent(oa)}` : studio?.line_url || "";
}

/**
 * 右下角浮動「LINE 諮詢」按鈕：所有前台頁面都有；選片頁不顯示（避免擋住選片按鈕）。
 * 預約頁會多一句提示泡泡，客人有問題可以直接加好友詢問。
 */
export default function FloatingLine() {
  const { studio } = useSite();
  const { pathname } = useLocation();
  const url = lineAddUrl(studio);
  const onBooking = pathname.startsWith("/booking");
  const [tip, setTip] = useState(false);

  useEffect(() => {
    if (!onBooking) { setTip(false); return; }
    let closed = false;
    try { closed = sessionStorage.getItem("gime-line-tip") === "1"; } catch { /* 無法存取時照常顯示 */ }
    if (closed) return;
    const t = setTimeout(() => setTip(true), 1500);
    const t2 = setTimeout(() => setTip(false), 7500); // 6 秒後自動收起，避免擋住表單
    return () => { clearTimeout(t); clearTimeout(t2); };
  }, [onBooking]);

  if (!url || pathname.startsWith("/gallery")) return null;

  const closeTip = () => {
    setTip(false);
    try { sessionStorage.setItem("gime-line-tip", "1"); } catch { /* 忽略 */ }
  };

  return (
    <div className={`float-line ${DEMO ? "demo" : ""}`}>
      {tip && (
        <div className="float-line-tip" role="status">
          <button className="float-line-tip-x" onClick={closeTip} aria-label="關閉提示">×</button>
          有問題嗎？加入 LINE 好友，直接問我們
        </div>
      )}
      <a className="float-line-btn" href={url} target="_blank" rel="noreferrer" aria-label="加入 LINE 好友諮詢" onClick={closeTip}>
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
          <path fill="currentColor" d="M12 3C6.48 3 2 6.6 2 11.05c0 2.6 1.53 4.9 3.9 6.37-.17.9-.62 2.4-1.5 3.38 0 0 2.97-.24 5.08-1.9.82.17 1.66.25 2.52.25 5.52 0 10-3.6 10-8.05S17.52 3 12 3Z" />
          <circle cx="8" cy="11" r="1.2" fill="#06C755" /><circle cx="12" cy="11" r="1.2" fill="#06C755" /><circle cx="16" cy="11" r="1.2" fill="#06C755" />
        </svg>
        <span>LINE 諮詢</span>
      </a>
    </div>
  );
}
