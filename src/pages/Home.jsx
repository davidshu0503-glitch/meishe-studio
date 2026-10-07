import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSite } from "../lib/site";
import { imgUrl } from "../lib/supabase";
import { money } from "../lib/utils";
import { Reveal, useTitle } from "../components/ui";
import Protect from "../components/Protect";
import PortfolioCard from "../components/PortfolioCard";
import Lightbox from "../components/Lightbox";

const HERO_MS = 6000;

function Hero() {
  const { hero, studio, categories } = useSite();
  const [i, setI] = useState(0);
  const nav = useNavigate();
  useEffect(() => {
    if (hero.length < 2) return;
    const t = setTimeout(() => setI((x) => (x + 1) % hero.length), HERO_MS);
    return () => clearTimeout(t);
  }, [i, hero.length]);
  const s = hero[i] || {};
  const catSlug = (name) => categories.find((c) => c.name === name)?.slug;

  return (
    <section className="hero" aria-label="主視覺">
      {hero.map((h, k) => (
        <div key={k} className={`hero-slide ${k === i ? "on" : ""}`} aria-hidden={k !== i}>
          <img src={imgUrl(h.image, "portfolio")} alt={h.headline || ""} loading={k === 0 ? "eager" : "lazy"} />
        </div>
      ))}
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
          <Link to="/portfolio" className="btn btn-light" style={{ borderColor: "transparent" }}>瀏覽作品 →</Link>
        </div>
      </div>
      {s.cat && (
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

export default function Home() {
  useTitle("");
  const { studio, services, portfolio, categories } = useSite();
  const [lb, setLb] = useState(null);
  const featured = useMemo(() => {
    const f = portfolio.filter((p) => p.featured);
    return (f.length >= 6 ? f : [...f, ...portfolio.filter((p) => !p.featured)]).slice(0, 9);
  }, [portfolio]);
  const topServices = useMemo(() => {
    const f = services.filter((s) => s.featured);
    return (f.length >= 3 ? f : services).slice(0, 3);
  }, [services]);
  const catName = (slug) => categories.find((c) => c.slug === slug)?.name;
  const introImg = featured[1]?.images?.[0] || featured[0]?.images?.[0];

  return (
    <>
      <Hero />

      <section className="section">
        <div className="wrap intro-grid">
          <Reveal className="intro-img">
            {introImg && <img src={imgUrl(introImg, "portfolio")} alt={`${studio.name} 作品`} loading="lazy" />}
            <span className="tag">Photo × AI</span>
          </Reveal>
          <Reveal delay={150}>
            <div className="eyebrow">About GIME Studio</div>
            <h2 className="title-lg" style={{ margin: "10px 0 24px" }}>{studio.slogan}</h2>
            <p className="lead">{studio.intro}</p>
            <div className="pillars">
              <div className="pillar"><b>專業攝影</b><span>燈光、引導、修圖一次到位</span></div>
              <div className="pillar"><b>AI 影像創畫</b><span>把真實照片延展成藝術作品</span></div>
              <div className="pillar"><b>線上全流程</b><span>預約、選片、交件都在線上</span></div>
            </div>
            <div className="mt-3"><Link to="/about" className="btn btn-ghost">認識我們</Link></div>
          </Reveal>
        </div>
      </section>

      <section className="section bg-2">
        <div className="wrap">
          <Reveal className="sec-head">
            <div className="eyebrow">Selected Works</div>
            <h2 className="title-lg">精選作品</h2>
            <div className="rule" />
          </Reveal>
          <Protect>
            <div className="grid-portfolio">
              {featured.map((p, k) => (
                <PortfolioCard key={p.id} item={p} index={k} catName={catName(p.category)} watermark={studio.watermark}
                  onOpen={(img) => setLb({ item: p, index: img })} />
              ))}
            </div>
            {lb && (
              <Lightbox images={lb.item.images.map((x) => imgUrl(x, "portfolio"))} index={lb.index} caption={lb.item.title}
                watermark={studio.watermark} onClose={() => setLb(null)} />
            )}
          </Protect>
          <div className="center mt-4"><Link to="/portfolio" className="btn btn-ghost">查看全部作品</Link></div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <Reveal className="sec-head">
            <div className="eyebrow">Services</div>
            <h2 className="title-lg">熱門服務</h2>
            <div className="rule" />
          </Reveal>
          <div className="svc-grid">
            {topServices.map((s, k) => (
              <Reveal key={s.id} delay={k * 120} className={`svc ${s.featured ? "" : ""}`}>
                <div className="en">{s.subtitle}</div>
                <h3>{s.name}</h3>
                <div className="price">{money(s.price)}<small>{s.price_note}</small></div>
                <p className="muted small">{s.description}</p>
                <div className="spacer" />
                <Link to={s.bookable ? `/booking?service=${s.id}` : "/about#contact"} className="btn btn-ghost btn-sm">
                  {s.bookable ? "預約此服務" : "洽詢方案"}
                </Link>
              </Reveal>
            ))}
          </div>
          <div className="center mt-4"><Link to="/services" className="btn">查看所有服務與價格</Link></div>
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
              ["03", "線上選片", "照片上傳後通知您，手機就能挑選喜歡的照片。"],
              ["04", "精修交件", "精修完成自動通知，線上高解析下載。"],
            ].map(([n, t, d], k) => (
              <Reveal key={n} delay={k * 120} className="process-step">
                <div className="num">{n}</div>
                <h4>{t}</h4>
                <p>{d}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
