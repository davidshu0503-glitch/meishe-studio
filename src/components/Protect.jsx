import { useEffect, useState } from "react";

/**
 * 作品防拷貝保護區：停用右鍵／拖曳／選取，嘗試阻擋 F12、Ctrl+S/P/U，
 * 視窗失焦時模糊作品（降低截圖工具取用），並在圖片上加浮水印（由 <Watermark/> 負責）。
 * 注意：網頁技術無法 100% 防止螢幕截圖或錄影，這些措施是提高門檻。
 */
export default function Protect({ children, className = "" }) {
  const [blurred, setBlurred] = useState(false);

  useEffect(() => {
    const key = (e) => {
      const k = e.key?.toLowerCase();
      if (k === "f12" || ((e.ctrlKey || e.metaKey) && ["s", "p", "u"].includes(k)) ||
          ((e.ctrlKey || e.metaKey) && e.shiftKey && ["i", "j", "c"].includes(k))) {
        e.preventDefault();
      }
      if (k === "printscreen") {
        setBlurred(true);
        navigator.clipboard?.writeText?.("").catch(() => {});
        setTimeout(() => setBlurred(false), 1200);
      }
    };
    const blur = () => setBlurred(true);
    const focus = () => setBlurred(false);
    const vis = () => setBlurred(document.hidden);
    window.addEventListener("keydown", key);
    window.addEventListener("keyup", key);
    window.addEventListener("blur", blur);
    window.addEventListener("focus", focus);
    document.addEventListener("visibilitychange", vis);
    return () => {
      window.removeEventListener("keydown", key);
      window.removeEventListener("keyup", key);
      window.removeEventListener("blur", blur);
      window.removeEventListener("focus", focus);
      document.removeEventListener("visibilitychange", vis);
    };
  }, []);

  return (
    <div
      className={`protect ${blurred ? "blurred" : ""} ${className}`}
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
      onCopy={(e) => e.preventDefault()}
    >
      {children}
    </div>
  );
}

export function Watermark({ text }) {
  return <div className="wm" aria-hidden="true"><span>{text}</span></div>;
}
