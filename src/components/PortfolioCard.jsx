import { useEffect, useState } from "react";
import { imgUrl } from "../lib/supabase";
import { Watermark } from "./Protect";

/** 作品卡片：在作品的多張照片間自動淡入淡出（每 12 秒，各卡片錯開） */
export default function PortfolioCard({ item, index = 0, catName, watermark, onOpen }) {
  const images = (item.images || []).map((p) => imgUrl(p, "portfolio"));
  const [cur, setCur] = useState(0);

  useEffect(() => {
    if (images.length < 2) return;
    let iv;
    const start = setTimeout(() => {
      setCur((c) => (c + 1) % images.length);
      iv = setInterval(() => setCur((c) => (c + 1) % images.length), 12000);
    }, 4000 + (index % 6) * 1700);
    return () => { clearTimeout(start); clearInterval(iv); };
  }, [images.length, index]);

  return (
    <div className="pcard protect-target" onClick={() => onOpen?.(cur)} role="button" tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onOpen?.(cur)} aria-label={item.title}>
      {images.map((src, i) => (
        <img key={i} src={src} alt={i === 0 ? item.title : ""} loading={index < 6 ? "eager" : "lazy"} className={i === cur ? "on" : ""} />
      ))}
      {watermark && <Watermark text={watermark} />}
      <div className="cap">
        {catName && <small>{catName}</small>}
        {item.title}
      </div>
    </div>
  );
}
