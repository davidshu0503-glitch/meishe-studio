import { useEffect, useMemo, useRef, useState } from "react";
import { imgUrl } from "../lib/supabase";
import Protect, { Watermark } from "./Protect";

/** 把一組「一拍多風格」整理成可瀏覽的畫面清單：原片在最前面 */
export function setFrames(set) {
  const frames = [];
  if (set?.original) frames.push({ image: set.original, label: "原片", original: true });
  (set?.styles || []).forEach((s) => s?.image && frames.push({ image: s.image, label: s.label || "風格" }));
  return frames;
}

/**
 * 一拍多風格展示：左邊大圖、右邊原片＋各種風格縮圖。
 * 沒有操作時會自動輪播各種風格；點選縮圖後停止自動輪播。
 */
export default function StyleShowcase({ sets, watermark, compact = false }) {
  const list = useMemo(() => (sets || []).filter((s) => setFrames(s).length > 1), [sets]);
  const [si, setSi] = useState(0);
  const [fi, setFi] = useState(0);
  const [auto, setAuto] = useState(true);
  const timer = useRef();
  const set = list[si];
  const frames = setFrames(set);

  useEffect(() => { setFi(0); }, [si]);
  useEffect(() => {
    if (!auto || frames.length < 2) return;
    timer.current = setTimeout(() => setFi((x) => (x + 1) % frames.length), fi === 0 ? 2600 : 3200);
    return () => clearTimeout(timer.current);
  }, [auto, fi, frames.length]);

  if (!set) return null;
  const pick = (k) => { setAuto(false); setFi(k); };
  const styleCount = frames.filter((f) => !f.original).length;

  return (
    <div className={`oneshot ${compact ? "compact" : ""}`}>
      {list.length > 1 && (
        <div className="oneshot-sets" role="tablist" aria-label="作品組">
          {list.map((s, k) => (
            <button key={s.id || k} role="tab" aria-selected={k === si} className={k === si ? "on" : ""} onClick={() => { setSi(k); setAuto(true); }}>
              {s.title}
            </button>
          ))}
        </div>
      )}
      <Protect className="oneshot-body">
        <div className="oneshot-stage protect-target">
          {frames.map((f, k) => (
            <img key={f.image + k} src={imgUrl(f.image, "portfolio")} alt={`${set.title}｜${f.label}`} className={k === fi ? "on" : ""} loading={k < 2 ? "eager" : "lazy"} />
          ))}
          {watermark && <Watermark text={watermark} />}
          <div className="oneshot-label">
            <span className={frames[fi]?.original ? "is-orig" : ""}>{frames[fi]?.label}</span>
            <small>{fi + 1} / {frames.length}</small>
          </div>
        </div>
        <div className="oneshot-side">
          <div className="oneshot-count">
            <b>1</b><span>張原片</span><i aria-hidden="true">→</i><b>{styleCount}</b><span>種風格</span>
          </div>
          {set.description && <p className="oneshot-desc">{set.description}</p>}
          <div className="oneshot-thumbs">
            {frames.map((f, k) => (
              <button key={f.image + k} className={`${k === fi ? "on" : ""} ${f.original ? "orig" : ""}`} onClick={() => pick(k)} aria-label={f.label}>
                <img src={imgUrl(f.image, "portfolio")} alt="" loading="lazy" />
                <span>{f.label}</span>
              </button>
            ))}
          </div>
        </div>
      </Protect>
    </div>
  );
}
