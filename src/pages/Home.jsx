import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSite } from "../lib/site";
import { imgUrl } from "../lib/supabase";
import { priceNote, priceText, TIER_ORDER, TIERS } from "../lib/utils";
import { Reveal, useTitle } from "../components/ui";
import Protect, { Watermark } from "../components/Protect";
import StyleShowcase from "../components/StyleShowcase";
import { OfferCard, PromoLink } from "../components/Promo";
import { discountLabel } from "../lib/promos";

const HERO_MS = 6000;
// 首頁區塊順序：入門拍攝（引流）放第一，接著一拍多風格，再依 主力 → 加值
const HOME_ORDER = [TIER_ORDER[0], "oneshot", ...TIER_ORDER.slice(1)];

function Hero() {
  const { hero: baseHero, studio, categories, promotions } = useSite();
  // 行銷管理的「首頁橫幅」排在輪播最前面
  const hero = useMemo(() => [
    ...promotions.filter((p) => p.kind === "hero" && p.image).map((p) => ({ image: p.image, promo: p })),
    ...baseHero,
  ], [promotions, baseHero]);
  const [i, setI] = useState(0);
  const nav = useNavigate();
  useEffect(() => {
    if (hero.length < 2) return;
    const t = setTimeout(() => setI((x) => (x + 1) % hero.length), HERO_MS);
    return () => clearTimeout(t);
  }, [i, hero.length]);
  const s = hero[i] || {};
  const promo = s.promo;
  const catSlug = (name) => categories.find((c) => c.name === name)?.slug;

  return (
    <section className={`hero ${promo ? "promo-on" : ""}`} aria-label="主視覺">
      {hero.map((h, k) => (
        <div key={k} className={`hero-slide ${k === i ? "on" : ""} ${h.promo ? "is-promo" : ""}`} aria-hidden={k !== i}>
          <img src={imgUrl(h.image, "portfolio")} alt={h.headline || h.promo?.title || ""} loading={k === 0 ? "eager" : "lazy"} />
        </div>
      ))}
      {promo && (
        <div className="hero-promo" key={`p${i}`}>
          {promo.badge && <span className="promo-badge hero-anim">{promo.badge}</span>}
          <h2 className="hero-anim" style={{ animationDelay: ".1s" }}>{promo.title}</h2>
          {promo.subtitle && <p className="hero-anim" style={{ animationDelay: ".2s" }}>{promo.subtitle}</p>}
          <div className="hero-cta hero-anim" style={{ animationDelay: ".3s", justifyContent: "flex-start", marginTop: 6 }}>
            <PromoLink promo={promo} className="btn btn-accent">{promo.cta_label || "立即預約"}</PromoLink>
            {discountLabel(promo) && <span className="offer-discount on-dark">{discountLabel(promo)}</span>}
            {promo.code && <span className="promo-code" style={{ background: "rgba(255,255,255,.9)" }}>代碼 <b>{promo.code}</b></span>}
          </div>
        </div>
      )}
      <div className="hero-content">
        <div className="hero-brand hero-anim">{studio.name_en} • {studio.tagline}</div>
        {studio.hero_title ? (
          <>
            <h1 className="hero-title hero-anim" style={{ animationDelay: ".15s" }}>{studio.hero_title}</h1>
            <p className="hero-line hero-anim" key={`t${i}`} style={{ animationDelay: ".3s" }}>{s.headline}</p>
            <p className="hero-sub hero-anim" key={`s${i}`} style={{ animationDelay: ".4s" }}>{s.sub}</p>
          </>
        ) : (
          <>
            <h1 className="hero-title hero-anim" key={`t${i}`} style={{ animationDelay: ".15s" }}>{s.headline}</h1>
            <p className="hero-sub hero-anim" key={`s${i}`} style={{ animationDelay: ".3s" }}>{s.sub}</p>
          </>
        )}
        <div className="hero-cta hero-anim" style={{ animationDelay: ".45s" }}>
          <Link to="/booking" className="btn btn-light">線上預約</Link>
          <a href="#entry" className="btn btn-light" style={{ borderColor: "transparent" }}
            onClick={(e) => { e.preventDefault(); document.getElementById("entry")?.scrollIntoView({ behavior: "smooth" }); }}>看拍攝方案 →</a>
        </div>
      </div>
      {s.cat && !promo && (
        <button className="hero-cat" style={{ background: "none", border: 0, color: "#fff" }}
          onClick={() => nav(`/portfolio${catSlug(s.cat) ? `?cat=${catSlug(s.cat)}` : ""}`)}>— {s.cat}</button>
      )}
      <div className="hero-bottom">
        {hero.map((_, k) => (
          <button key={`${k}-${k === i ? i : "x"}`} className={`hero-dot ${k === i ? "on" : ""}`} style={{ "--dur": `${HERO_MS}ms` }}
            onClick={() => setI(k)} aria-label={`第 ${k + 1} 張`} />
        ))}
      </div>
    </section>
  );
}

/** 分類卡片：封面＋名稱＋說明＋作品數 */
function CategoryCard({ c, cover, count, watermark, big }) {
  return (
    <Link to={`/portfolio?cat=${c.slug}`} className={`cat-card ${big ? "big" : ""}`}>
      <div className="cat-img protect-target">
        {cover ? <img src={imgUrl(cover, "portfolio")} alt={c.name} loading="lazy" /> : <div className="cat-ph" />}
        {watermark && <Watermark text={watermark} />}
      </div>
      <div className="cat-body">
        <div className="cat-en">{c.name_en || ""}</div>
        <h3>{c.name}</h3>
        {c.description && <p>{c.description}</p>}
        <span className="cat-more">{count} 件作品 →</span>
      </div>
    </Link>
  );
}

function TierHead({ tier, index }) {
  const t = TIERS[tier];
  return (
    <Reveal className="tier-head">
      <div className="tier-no">{String(index).padStart(2, "0")}</div>
      <div>
        <div className="eyebrow">{t.en}</div>
        <h2 className="title-lg">{t.label}</h2>
        <p className="lead">{t.desc}</p>
      </div>
    </Reveal>
  );
}

export default function Home() {
  useTitle("");
  const { studio, services, portfolio, categories, styleSets, promotions } = useSite();
  const offers = promotions.filter((p) => p.kind === "offer").slice(0, 3);

  const byTier = useMemo(() => {
    const m = { main: [], addon: [], entry: [] };
    categories.forEach((c) => m[c.tier]?.push(c));
    return m;
  }, [categories]);
  const coverOf = (slug) => {
    const list = portfolio.filter((p) => p.category === slug);
    return (list.find((p) => p.featured) || list[0])?.images?.[0];
  };
  const countOf = (slug) => portfolio.filter((p) => p.category === slug).length;
  const svc = (tier) => services.filter((s) => s.tier === tier);
  const entryServices = svc("entry").filter((s) => s.bookable).slice(0, 4);
  const hasSets = styleSets.some((s) => (s.styles || []).length > 0);
  let n = 0;
  let light = 0;

  return (
    <>
      <Hero />

      {/* 限時優惠（行銷管理 → 優惠活動；沒有進行中的活動就不顯示） */}
      {offers.length > 0 && (
        <section className="section-tight offer-strip" style={{ padding: "36px 0" }}>
          <div className="wrap">
            <div className="offer-strip-head">
              <div><div className="eyebrow">Limited Offers</div><h2 className="title-md">限時優惠</h2></div>
              <Link to="/offers" className="btn-link small">看全部優惠活動 →</Link>
            </div>
            <div className="offer-row">{offers.map((p) => <OfferCard key={p.id} promo={p} services={services} />)}</div>
          </div>
        </section>
      )}

      {/* 依分層順序排列：引流（入門拍攝）→ 一拍多風格 → 主力 → 加值 */}
      {HOME_ORDER.map((key) => {
        if (key === "oneshot") {
          if (!hasSets) return null;
          return (
            <section key={key} className="section oneshot-sec" id="oneshot">
              <div className="wrap">
                <Reveal className="tier-head on-dark">
                  <div className="tier-no">{String(++n).padStart(2, "0")}</div>
                  <div>
                    <div className="eyebrow">One Shoot · Many Styles</div>
                    <h2 className="title-lg">拍一次，擁有多種藝術風格</h2>
                    <p className="lead">同一次拍攝的照片，可以再轉成金箔、油畫、雕塑、水彩、普普等不同風格。點右邊的縮圖，看同一張原片的各種版本。</p>
                  </div>
                </Reveal>
                <StyleShowcase sets={styleSets} watermark={studio.watermark} />
                <div className="center mt-4 flex" style={{ justifyContent: "center", flexWrap: "wrap" }}>
                  <Link to="/booking" className="btn btn-accent">預約拍攝</Link>
                  <Link to="/portfolio?tier=oneshot" className="btn btn-light">看全部一拍多風格作品</Link>
                </div>
              </div>
            </section>
          );
        }
        const cats = byTier[key] || [];
        const list = svc(key);
        if (!cats.length && !list.length) return null;
        const bg = light++ % 2 === 1 ? "bg-2" : "";
        if (key === "entry") {
          return (
            <section key={key} className={`section ${bg}`} id="entry">
              <div className="wrap">
                <TierHead tier="entry" index={++n} />
                {cats.length > 0 && (
                  <Protect>
                    <div className="cat-grid addon">
                      {cats.map((c) => <CategoryCard key={c.slug} c={c} cover={coverOf(c.slug)} count={countOf(c.slug)} watermark={studio.watermark} />)}
                    </div>
                  </Protect>
                )}
                {entryServices.length > 0 && (
                  <div className="svc-grid mt-4">
                    {entryServices.map((s, k) => (
                      <Reveal key={s.id} delay={k * 100} className="svc">
                        <div className="en">{s.subtitle}</div>
                        <h3>{s.name}</h3>
                        <div className="price">{priceText(s)}<small>{priceNote(s)}</small></div>
                        <p className="muted small">{s.description}</p>
                        <div className="spacer" />
                        <Link to={`/booking?service=${s.id}`} className="btn btn-sm">預約此服務</Link>
                      </Reveal>
                    ))}
                  </div>
                )}
                <div className="center mt-3"><Link to="/services#entry" className="btn-link small">看所有入門拍攝方案與價格 →</Link></div>
              </div>
            </section>
          );
        }
        return (
          <section key={key} className={`section ${bg}`}>
            <div className="wrap">
              <TierHead tier={key} index={++n} />
              {cats.length > 0 && (
                <Protect>
                  <div className={`cat-grid ${key === "main" ? "main" : "addon"}`}>
                    {cats.map((c) => <CategoryCard key={c.slug} c={c} cover={coverOf(c.slug)} count={countOf(c.slug)} watermark={studio.watermark} big={key === "main"} />)}
                  </div>
                </Protect>
              )}
              {list.length > 0 && (
                <div className="tier-offers">
                  {list.map((s) => (
                    <div key={s.id} className="offer">
                      <div><b>{s.name}</b><span className="small muted">{s.description}</span></div>
                      <div className="offer-price">{priceText(s)}<small>{priceNote(s)}</small></div>
                      <Link to={s.bookable ? `/booking?service=${s.id}` : `/services#${key}`} className={`btn btn-sm ${key === "main" ? "" : "btn-ghost"}`}>{s.bookable ? (key === "main" ? "預約" : "加購預約") : "了解方案"}</Link>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        );
      })}

      {/* 怎麼買：從入門到典藏 */}
      <section className="section-tight ladder-sec">
        <div className="wrap">
          <Reveal className="sec-head"><div className="eyebrow">From a photo to an heirloom</div><h2 className="title-lg">從一次拍攝，到一幅傳家作品</h2></Reveal>
          <ol className="ladder">
            {[
              ["入門拍攝", "形象照、證件照、孕婦寫真、全家福", "/services#entry"],
              ["風格加購", "同一組照片加做 1–3 種藝術風格", "/services#addon"],
              ["典藏掛畫", "最喜歡的一張輸出成大幅掛畫", "/services#main"],
              ["典藏套組", "原片＋多風格＋掛畫＋相本，一次完成", "/services#main"],
            ].map(([t, d, to]) => (
              <li key={t}><Link to={to}><b>{t}</b><span>{d}</span></Link></li>
            ))}
          </ol>
        </div>
      </section>

      <section className="section bg-2">
        <div className="wrap">
          <Reveal className="sec-head">
            <div className="eyebrow">How it works</div>
            <h2 className="title-lg">拍攝流程</h2>
            <div className="rule" />
          </Reveal>
          <div className="process">
            {[
              ["01", "線上預約", "選擇服務與時段，立即取得預約編號，Email / LINE 同步通知。"],
              ["02", "棚內拍攝", "攝影師一對一引導，輕鬆自在地完成拍攝。"],
              ["03", "選片與選風格", "手機就能挑照片，再決定要加做哪些藝術風格。"],
              ["04", "精修交件", "精修與轉繪完成自動通知，線上高解析下載或輸出掛畫。"],
            ].map(([num, t, d], k) => (
              <Reveal key={num} delay={k * 120} className="process-step">
                <div className="num">{num}</div>
                <h4>{t}</h4>
                <p>{d}</p>
              </Reveal>
            ))}
          </div>
          <div className="center mt-4"><Link to="/about" className="btn btn-ghost">認識 {studio.name}</Link></div>
        </div>
      </section>
    </>
  );
}
