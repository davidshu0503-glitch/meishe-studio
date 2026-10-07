import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useSite } from "../lib/site";
import { imgUrl } from "../lib/supabase";
import { PageHero, useTitle } from "../components/ui";
import Protect from "../components/Protect";
import PortfolioCard from "../components/PortfolioCard";
import Lightbox from "../components/Lightbox";

const PAGE_SIZE = 12;

export default function Portfolio() {
  useTitle("作品集");
  const { portfolio, categories, studio } = useSite();
  const [params, setParams] = useSearchParams();
  const cat = params.get("cat") || "all";
  const page = Math.max(0, Number(params.get("p") || 1) - 1);
  const [lb, setLb] = useState(null);

  const list = useMemo(() => (cat === "all" ? portfolio : portfolio.filter((p) => p.category === cat)), [portfolio, cat]);
  const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const shown = list.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const catName = (slug) => categories.find((c) => c.slug === slug)?.name;

  const setCat = (c) => setParams(c === "all" ? {} : { cat: c });
  const setPage = (p) => {
    const next = {};
    if (cat !== "all") next.cat = cat;
    if (p > 0) next.p = String(p + 1);
    setParams(next);
    window.scrollTo({ top: 260, behavior: "smooth" });
  };

  return (
    <>
      <PageHero eyebrow="Portfolio" title="作品集" sub="形象・婚紗・商業・影畫創作・AI 影像創畫" />
      <section className="section-tight">
        <div className="wrap">
          <div className="filters" role="tablist">
            <button className={`filter ${cat === "all" ? "on" : ""}`} onClick={() => setCat("all")}>全部</button>
            {categories.map((c) => (
              <button key={c.slug} className={`filter ${cat === c.slug ? "on" : ""}`} onClick={() => setCat(c.slug)}>{c.name}</button>
            ))}
          </div>
          <Protect>
            {shown.length === 0 ? (
              <div className="empty">此分類目前還沒有作品</div>
            ) : (
              <div className="grid-portfolio">
                {shown.map((p, k) => (
                  <PortfolioCard key={p.id} item={p} index={k} catName={catName(p.category)} watermark={studio.watermark}
                    onOpen={(img) => setLb({ item: p, index: img })} />
                ))}
              </div>
            )}
            {lb && (
              <Lightbox images={lb.item.images.map((x) => imgUrl(x, "portfolio"))} index={lb.index}
                caption={[lb.item.title, lb.item.description].filter(Boolean).join("　")} watermark={studio.watermark} onClose={() => setLb(null)} />
            )}
          </Protect>
          {pages > 1 && (
            <div className="pager">
              <button disabled={page === 0} onClick={() => setPage(page - 1)} aria-label="上一頁">‹</button>
              {Array.from({ length: pages }).map((_, k) => (
                <button key={k} className={k === page ? "on" : ""} onClick={() => setPage(k)}>{k + 1}</button>
              ))}
              <button disabled={page >= pages - 1} onClick={() => setPage(page + 1)} aria-label="下一頁">›</button>
            </div>
          )}
          <p className="wm-note">本站所有作品皆受著作權保護，未經授權請勿下載、轉載或作商業使用。</p>
        </div>
      </section>
    </>
  );
}
