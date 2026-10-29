import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useSite } from "../lib/site";
import { imgUrl } from "../lib/supabase";
import { TIER_ORDER, TIERS } from "../lib/utils";
import { PageHero, useTitle } from "../components/ui";
import Protect, { Watermark } from "../components/Protect";
import PortfolioCard from "../components/PortfolioCard";
import Lightbox from "../components/Lightbox";
import StyleShowcase, { setFrames } from "../components/StyleShowcase";

const PAGE_SIZE = 12;

/** 一拍多風格作品卡：封面是原片，角落標示風格數 */
function SetCard({ set, watermark, onOpen }) {
  const frames = setFrames(set);
  return (
    <div className="pcard protect-target set-card" role="button" tabIndex={0} onClick={onOpen} onKeyDown={(e) => e.key === "Enter" && onOpen()} aria-label={set.title}>
      <div className="set-mosaic">
        {frames.slice(0, 4).map((f, k) => <img key={k} className="on" src={imgUrl(f.image, "portfolio")} alt={k === 0 ? set.title : ""} loading="lazy" />)}
      </div>
      {watermark && <Watermark text={watermark} />}
      <span className="set-count">1 → {frames.filter((f) => !f.original).length} 種風格</span>
      <div className="cap" style={{ opacity: 1 }}><small>一拍多風格</small>{set.title}</div>
    </div>
  );
}

export default function Portfolio() {
  useTitle("作品集");
  const { portfolio, categories, studio, styleSets } = useSite();
  const [params, setParams] = useSearchParams();
  const catParam = params.get("cat");
  const catRow = categories.find((c) => c.slug === catParam);
  // 從分類推回分層；沒有指定時預設顯示「一拍多風格」
  const tier = catRow?.tier || params.get("tier") || (styleSets.length ? "oneshot" : "all");
  const cat = catRow ? catRow.slug : "all";
  const page = Math.max(0, Number(params.get("p") || 1) - 1);
  const [lb, setLb] = useState(null);
  const [openSet, setOpenSet] = useState(null);

  const visibleCats = categories.filter((c) => c.tier !== "hidden");
  const tierRank = (c) => ["main", "addon", "entry"].indexOf(c.tier);
  const tierCats = tier === "all" || tier === "oneshot" ? [...visibleCats].sort((a, b) => tierRank(a) - tierRank(b) || a.sort - b.sort) : visibleCats.filter((c) => c.tier === tier);
  const list = useMemo(() => {
    const order = new Map(tierCats.map((c, i) => [c.slug, i]));
    if (cat !== "all") return portfolio.filter((p) => p.category === cat);
    // 依分類順序排列（主力分類的作品在前），同分類內維持原本排序
    return portfolio.filter((p) => order.has(p.category)).map((p, i) => [p, i])
      .sort((a, b) => order.get(a[0].category) - order.get(b[0].category) || a[1] - b[1]).map(([p]) => p);
  }, [portfolio, tierCats, cat]);
  const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const shown = list.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const catName = (slug) => categories.find((c) => c.slug === slug)?.name;
  const sets = styleSets.filter((s) => setFrames(s).length > 1);

  const go = (next) => setParams(Object.fromEntries(Object.entries(next).filter(([, v]) => v)));
  const setTier = (t) => go({ tier: t === "all" ? "" : t });
  const setCat = (c) => go(c === "all" ? { tier: tier === "all" ? "" : tier } : { cat: c });
  const setPage = (p) => {
    go({ tier: cat === "all" && tier !== "all" ? tier : "", cat: cat !== "all" ? cat : "", p: p > 0 ? String(p + 1) : "" });
    window.scrollTo({ top: 260, behavior: "smooth" });
  };
  const tabs = [
    ...(sets.length ? [["oneshot", "一拍多風格"]] : []),
    ...TIER_ORDER.filter((t) => visibleCats.some((c) => c.tier === t)).map((t) => [t, TIERS[t].label]),
    ["all", "全部作品"],
  ];

  return (
    <>
      <PageHero eyebrow="Portfolio" title="作品集" sub="一拍多風格・典藏藝術肖像・風格加購・入門拍攝" />
      <section className="section-tight">
        <div className="wrap">
          <div className="tier-tabs" role="tablist">
            {tabs.map(([k, l]) => (
              <button key={k} role="tab" aria-selected={tier === k} className={tier === k ? "on" : ""} onClick={() => setTier(k)}>{l}</button>
            ))}
          </div>

          {tier === "oneshot" ? (
            <>
              <p className="tier-intro">同一次拍攝的照片，轉成多種藝術風格。點作品看原片與每一種風格。</p>
              <Protect>
                <div className="grid-portfolio">
                  {sets.map((s) => <SetCard key={s.id} set={s} watermark={studio.watermark} onOpen={() => setOpenSet(s)} />)}
                </div>
              </Protect>
              {openSet && (
                <div className="lightbox set-lightbox" onClick={() => setOpenSet(null)}>
                  <button className="lb-close" onClick={() => setOpenSet(null)} aria-label="關閉">×</button>
                  <div className="set-lightbox-inner" onClick={(e) => e.stopPropagation()}>
                    <StyleShowcase sets={[openSet]} watermark={studio.watermark} compact />
                    <h3 className="set-lightbox-title">{openSet.title}</h3>
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              {tier !== "all" && TIERS[tier] && <p className="tier-intro">{TIERS[tier].desc}</p>}
              <div className="filters" role="tablist">
                <button className={`filter ${cat === "all" ? "on" : ""}`} onClick={() => setCat("all")}>全部</button>
                {tierCats.map((c) => (
                  <button key={c.slug} className={`filter ${cat === c.slug ? "on" : ""}`} onClick={() => setCat(c.slug)}>{c.name}</button>
                ))}
              </div>
              {catRow?.description && <p className="tier-intro" style={{ marginTop: -24 }}>{catRow.description}</p>}
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
            </>
          )}
          <p className="wm-note">本站所有作品皆受著作權保護，未經授權請勿下載、轉載或作商業使用。</p>
        </div>
      </section>
    </>
  );
}
