import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { useSite } from "../lib/site";
import { priceNote, priceText, TIER_ORDER, TIERS } from "../lib/utils";
import { PageHero, Reveal, useTitle } from "../components/ui";
import StyleShowcase from "../components/StyleShowcase";
import { PromoLink } from "../components/Promo";
import { calcAmount, discountLabel } from "../lib/promos";
import { money } from "../lib/utils";

export default function Services() {
  useTitle("服務與價格");
  const { services, studio, styleSets, promotions } = useSite();
  const offerFor = (id) => promotions.find((p) => p.kind === "offer" && (p.service_ids || []).includes(id));
  const { hash } = useLocation();
  useEffect(() => {
    if (!hash) return;
    const t = setTimeout(() => document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: "smooth" }), 80);
    return () => clearTimeout(t);
  }, [hash]);

  const Card = ({ s, k }) => (
    <Reveal delay={(k % 3) * 100} className={`svc ${s.featured ? "featured" : ""}`}>
      {s.featured && <span className="badge-top">推薦</span>}
      <div className="en">{s.subtitle}</div>
      <h3>{s.name}</h3>
      <div className="price">{priceText(s)}<small>{priceNote(s)}</small></div>
      {s.duration_label && <div className="small muted">拍攝時間：{s.duration_label}</div>}
      <p className="small" style={{ color: "var(--ink-2)" }}>{s.description}</p>
      {s.features?.length > 0 && <ul>{s.features.map((f) => <li key={f}>{f}</li>)}</ul>}
      {offerFor(s.id) && (
        <PromoLink promo={offerFor(s.id)} className="svc-offer">
          <b>優惠中｜{offerFor(s.id).title}{discountLabel(offerFor(s.id)) && `（${discountLabel(offerFor(s.id))}）`}</b>
          {Number(s.price) > 0 && calcAmount(offerFor(s.id), s.price) < s.price && <span>用代碼 {offerFor(s.id).code} 預約：<b>{money(calcAmount(offerFor(s.id), s.price))}</b>（原價 {money(s.price)}）</span>}
          {offerFor(s.id).subtitle && <span>{offerFor(s.id).subtitle}</span>}
        </PromoLink>
      )}
      <div className="spacer" />
      {s.bookable
        ? <Link to={`/booking?service=${s.id}${offerFor(s.id)?.code ? `&promo=${encodeURIComponent(offerFor(s.id).code)}` : ""}`} className="btn btn-sm">預約此服務</Link>
        : <a href={`tel:${(studio.phone || "").replace(/[^\d+]/g, "")}`} className="btn btn-ghost btn-sm">來電洽詢 {studio.phone}</a>}
    </Reveal>
  );

  const groups = TIER_ORDER.map((t) => [t, services.filter((s) => s.tier === t)]).filter(([, l]) => l.length);

  return (
    <>
      <PageHero eyebrow="Services & Pricing" title="服務與價格" sub="拍一次，擁有多種藝術風格。所有方案皆含線上選片與雲端交件" />
      <section className="section-tight">
        <div className="wrap">
          {styleSets.length > 0 && (
            <div className="svc-oneshot">
              <div>
                <div className="kicker">One Shoot · Many Styles</div>
                <h2 className="title-md" style={{ margin: "8px 0 12px" }}>一拍多風格怎麼算？</h2>
                <p className="small" style={{ color: "var(--ink-2)", lineHeight: 2 }}>
                  先選一個<b>入門拍攝</b>方案，拍完選片時再決定要不要<b>加購風格</b>；最喜歡的那張，可以再做成<b>典藏掛畫</b>。不用一次決定全部，看到成果再加。
                </p>
                <ol className="mini-ladder">
                  <li><a href="#entry">入門拍攝</a></li><li><a href="#addon">風格加購</a></li><li><a href="#main">典藏藝術肖像</a></li>
                </ol>
              </div>
              <StyleShowcase sets={styleSets.slice(0, 1)} watermark={studio.watermark} compact />
            </div>
          )}

          {groups.map(([t, list]) => (
            <div key={t} id={t} className="svc-group">
              <div className="sec-head" style={{ marginBottom: 32 }}>
                <div className="kicker">{TIERS[t].en}</div>
                <h2 className="title-md">{TIERS[t].label}</h2>
                <p className="small muted" style={{ maxWidth: 560 }}>{TIERS[t].desc}</p>
              </div>
              <div className="svc-grid">{list.map((s, k) => <Card key={s.id} s={s} k={k} />)}</div>
            </div>
          ))}

          <div className="card mt-4 small muted" style={{ lineHeight: 2 }}>
            <b style={{ color: "var(--ink)" }}>預約須知</b><br />
            ・以上價格為新台幣含稅價，實際內容以與工作室確認為準。顯示「洽詢報價」的項目會依尺寸與風格報價。<br />
            ・風格加購與典藏掛畫可以在選片後再決定。<br />
            ・預約成功後會收到 Email／LINE 通知，拍攝前一天會再次提醒。<br />
            ・改期或取消請於拍攝前 2 天來電 {studio.phone}。
          </div>
        </div>
      </section>
    </>
  );
}
