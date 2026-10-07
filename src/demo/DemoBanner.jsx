import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";

/** 示範模式說明卡（只出現在預覽版） */
export default function DemoBanner() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(() => window.innerWidth > 700 && window.innerHeight > 600);
  useEffect(() => { if (pathname.startsWith("/admin")) setOpen(false); }, [pathname]);
  const info = window.__GIME_DEMO_INFO || {};
  const box = {
    position: "fixed", right: 16, bottom: "calc(16px + env(safe-area-inset-bottom, 0px))", zIndex: 150, background: "#161513", color: "#FDFBF6",
    borderRadius: 10, boxShadow: "0 12px 40px rgba(0,0,0,.3)", fontSize: 14.5, lineHeight: 1.7, maxWidth: "min(360px, calc(100vw - 32px))",
  };
  if (!open) {
    return <button onClick={() => setOpen(true)} style={{ ...box, border: 0, padding: "9px 16px", letterSpacing: ".12em" }}>示範模式 ▴</button>;
  }
  const row = { display: "grid", gridTemplateColumns: "72px 1fr", gap: 8 };
  const code = { fontFamily: "ui-monospace, Menlo, monospace", color: "#F2C9A8", userSelect: "all", wordBreak: "break-all" };
  return (
    <div style={{ ...box, padding: "16px 18px" }} role="complementary" aria-label="示範模式說明">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <b style={{ letterSpacing: ".16em" }}>示範模式・可自由測試</b>
        <button onClick={() => setOpen(false)} style={{ background: "none", border: 0, color: "#A8A192", fontSize: 18, lineHeight: 1 }} aria-label="收合">×</button>
      </div>
      <p style={{ color: "#CFC8B8", margin: "0 0 10px" }}>資料只存在這個頁面，重新整理會回到初始狀態。圖片為示範色塊，可在後台上傳自己的照片試試。</p>
      <div style={{ display: "grid", gap: 6 }}>
        <div style={row}><span style={{ color: "#A8A192" }}>後台</span><span><span style={code}>{info.admin}</span><br /><span style={code}>{info.password}</span></span></div>
        <div style={row}><span style={{ color: "#A8A192" }}>會員</span><span><span style={code}>{info.member}</span>（同密碼）</span></div>
        <div style={row}><span style={{ color: "#A8A192" }}>選片</span><span><span style={code}>{info.galleryOrder}</span><br />電話 <span style={code}>{info.galleryPhone}</span></span></div>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
        <Link to="/admin" className="btn btn-sm btn-accent" onClick={() => setOpen(false)}>進入後台</Link>
        <Link to={`/gallery?order=${info.galleryOrder}`} className="btn btn-sm btn-light" onClick={() => setOpen(false)}>試用選片</Link>
        <Link to="/booking" className="btn btn-sm btn-light" onClick={() => setOpen(false)}>試用預約</Link>
      </div>
    </div>
  );
}
