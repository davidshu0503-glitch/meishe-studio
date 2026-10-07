import { Link } from "react-router-dom";
import { useSite } from "../lib/site";
import { imgUrl } from "../lib/supabase";
import { PageHero, Reveal, useTitle } from "../components/ui";

export default function About() {
  useTitle("關於我們");
  const { studio, portfolio } = useSite();
  const img = portfolio.find((p) => p.category === "ai_art" || p.category === "cinematic")?.images?.[0] || portfolio[0]?.images?.[0];
  const tel = (studio.phone || "").replace(/[^\d+]/g, "");

  return (
    <>
      <PageHero eyebrow="About" title="關於即美創畫" sub={`${studio.name_en} • ${studio.tagline}`} />
      <section className="section">
        <div className="wrap intro-grid">
          <Reveal className="intro-img">{img && <img src={imgUrl(img, "portfolio")} alt="工作室作品" loading="lazy" />}<span className="tag">GIME Studio</span></Reveal>
          <Reveal delay={120}>
            <div className="eyebrow">Our Story</div>
            <h2 className="title-lg" style={{ margin: "10px 0 24px" }}>{studio.slogan}</h2>
            <p className="lead">{studio.intro}</p>
            {studio.story && <p className="lead mt-2" style={{ whiteSpace: "pre-line" }}>{studio.story}</p>}
          </Reveal>
        </div>
      </section>
      <section className="section bg-2" id="contact">
        <div className="wrap">
          <div className="sec-head"><div className="eyebrow">Contact</div><h2 className="title-lg">聯絡我們</h2><div className="rule" /></div>
          <div className="svc-grid">
            <div className="svc"><div className="en">PHONE</div><h3>電話</h3><a className="lead" href={`tel:${tel}`}>{studio.phone}</a></div>
            <div className="svc"><div className="en">ADDRESS</div><h3>地址</h3><p className="lead">{studio.address}</p><p className="small muted">{studio.hours}</p></div>
            <div className="svc"><div className="en">ONLINE</div><h3>線上</h3>
              <div className="links small" style={{ display: "grid", gap: 6 }}>
                {studio.email && <a href={`mailto:${studio.email}`}>{studio.email}</a>}
                {studio.line_url && <a href={studio.line_url} target="_blank" rel="noreferrer">LINE 官方帳號 →</a>}
                {studio.instagram && <a href={studio.instagram} target="_blank" rel="noreferrer">Instagram →</a>}
                {studio.facebook && <a href={studio.facebook} target="_blank" rel="noreferrer">Facebook →</a>}
                <Link to="/booking" className="btn btn-sm mt-1">線上預約</Link>
              </div>
            </div>
          </div>
          {studio.map_embed && <iframe className="map mt-4" src={studio.map_embed} title="地圖" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />}
        </div>
      </section>
    </>
  );
}
