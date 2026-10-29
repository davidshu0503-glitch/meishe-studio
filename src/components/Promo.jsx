import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useSite } from "../lib/site";
import { imgUrl } from "../lib/supabase";
import { endsText, isExternal, seen, trackClick } from "../lib/promos";

/** 活動按鈕／連結：站內路徑用 Link，外部網址開新分頁；點擊時記錄點擊數 */
export function PromoLink({ promo, className, children, onClick }) {
  const to = promo.cta_link || (promo.code ? `/booking?promo=${encodeURIComponent(promo.code)}` : "/offers");
  const click = () => { trackClick(promo); onClick?.(); };
  if (isExternal(to)) return <a href={to} target="_blank" rel="noreferrer" className={className} onClick={click}>{children}</a>;
  return <Link to={to} className={className} onClick={click}>{children}</Link>;
}

/** 網站最上方的公告列（可關閉，關閉後同一則不再出現） */
export function PromoBar() {
  const { promotions } = useSite();
  const bars = promotions.filter((p) => p.kind === "bar" && !seen.has(`bar:${p.id}`));
  const [closed, setClosed] = useState([]);
  const bar = bars.find((b) => !closed.includes(b.id));
  useEffect(() => {
    document.documentElement.classList.toggle("has-promo-bar", !!bar);
    return () => document.documentElement.classList.remove("has-promo-bar");
  }, [bar]);
  if (!bar) return null;
  const close = () => { seen.set(`bar:${bar.id}`); setClosed((c) => [...c, bar.id]); };
  return (
    <div className="promo-bar" role="region" aria-label="公告">
      <PromoLink promo={bar} className="promo-bar-link">
        {bar.badge && <span className="promo-badge">{bar.badge}</span>}
        <span className="promo-bar-text">{bar.title}{bar.subtitle && <small>{bar.subtitle}</small>}</span>
        <span className="promo-bar-cta">{bar.cta_label || "了解更多"} →</span>
      </PromoLink>
      <button className="promo-bar-x" onClick={close} aria-label="關閉公告">×</button>
    </div>
  );
}

/** 彈出視窗：每則活動每位訪客只出現一次；後台與預約、選片頁不打擾 */
export function PromoPopup() {
  const { promotions } = useSite();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(null);
  useEffect(() => {
    if (/^\/(admin|booking|gallery|member)/.test(pathname)) return;
    const p = promotions.find((x) => x.kind === "popup" && !seen.has(`popup:${x.id}`));
    if (!p) return;
    const t = setTimeout(() => setOpen(p), 2500);
    return () => clearTimeout(t);
  }, [promotions, pathname]);
  if (!open) return null;
  const close = () => { seen.set(`popup:${open.id}`); setOpen(null); };
  return (
    <div className="modal-bg promo-pop-bg" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="promo-pop" role="dialog" aria-modal="true" aria-label={open.title}>
        <button className="promo-pop-x" onClick={close} aria-label="關閉">×</button>
        {open.image && <img src={imgUrl(open.image, "portfolio")} alt="" />}
        <div className="promo-pop-body">
          {open.badge && <span className="promo-badge">{open.badge}</span>}
          <h3>{open.title}</h3>
          {open.subtitle && <p>{open.subtitle}</p>}
          {open.code && <div className="promo-code">優惠代碼 <b>{open.code}</b></div>}
          <div className="flex" style={{ justifyContent: "center", flexWrap: "wrap", marginTop: 6 }}>
            <PromoLink promo={open} className="btn btn-accent" onClick={close}>{open.cta_label || "立即預約"}</PromoLink>
            <button className="btn btn-ghost" onClick={close}>下次再說</button>
          </div>
          {endsText(open) && <div className="small muted">{endsText(open)}</div>}
        </div>
      </div>
    </div>
  );
}

/** 優惠活動卡片 */
export function OfferCard({ promo, services = [], full }) {
  const names = services.filter((s) => (promo.service_ids || []).includes(s.id)).map((s) => s.name);
  return (
    <article className={`offer-card ${full ? "full" : ""}`}>
      {promo.image && (
        <div className="offer-card-img">
          <img src={imgUrl(promo.image, "portfolio")} alt="" loading="lazy" />
          {promo.badge && <span className="promo-badge">{promo.badge}</span>}
        </div>
      )}
      <div className="offer-card-body">
        {!promo.image && promo.badge && <span className="promo-badge" style={{ justifySelf: "start" }}>{promo.badge}</span>}
        <h3>{promo.title}</h3>
        {promo.subtitle && <p className="offer-sub">{promo.subtitle}</p>}
        {full && promo.body && <p className="offer-body">{promo.body}</p>}
        {names.length > 0 && <div className="small muted">適用：{names.join("、")}</div>}
        <div className="offer-meta">
          {promo.code && <span className="promo-code">代碼 <b>{promo.code}</b></span>}
          {endsText(promo) && <span className="small muted">{endsText(promo)}</span>}
        </div>
        <PromoLink promo={promo} className="btn btn-sm">{promo.cta_label || "立即預約"}</PromoLink>
      </div>
    </article>
  );
}
