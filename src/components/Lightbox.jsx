import { useEffect, useState } from "react";
import { Watermark } from "./Protect";

/** 燈箱：左右鍵切換、Esc 關閉、手機可滑動 */
export default function Lightbox({ images, index = 0, caption, watermark, onClose, onIndex }) {
  const [i, setI] = useState(index);
  const [touchX, setTouchX] = useState(null);
  const n = images.length;
  const go = (d) => { const next = (i + d + n) % n; setI(next); onIndex?.(next); };

  useEffect(() => {
    const k = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", k);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", k); document.body.style.overflow = ""; };
  });

  return (
    <div className="lightbox" onClick={onClose}
      onTouchStart={(e) => setTouchX(e.touches[0].clientX)}
      onTouchEnd={(e) => { if (touchX === null) return; const dx = e.changedTouches[0].clientX - touchX; if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1); setTouchX(null); }}>
      <button className="lb-close" onClick={onClose} aria-label="關閉">×</button>
      {n > 1 && <button className="lb-nav prev" onClick={(e) => { e.stopPropagation(); go(-1); }} aria-label="上一張">‹</button>}
      <div className="frame protect-target" onClick={(e) => e.stopPropagation()}>
        <img src={images[i]} alt={caption || ""} />
        {watermark && <Watermark text={watermark} />}
      </div>
      {n > 1 && <button className="lb-nav next" onClick={(e) => { e.stopPropagation(); go(1); }} aria-label="下一張">›</button>}
      <div className="lb-caption">{caption}{n > 1 ? `　${i + 1} / ${n}` : ""}</div>
    </div>
  );
}
