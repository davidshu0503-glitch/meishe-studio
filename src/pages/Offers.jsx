import { Link } from "react-router-dom";
import { useSite } from "../lib/site";
import { PageHero, useTitle } from "../components/ui";
import { OfferCard } from "../components/Promo";

export default function Offers() {
  useTitle("優惠活動");
  const { promotions, services } = useSite();
  const offers = promotions.filter((p) => p.kind === "offer");
  return (
    <>
      <PageHero eyebrow="Offers" title="優惠活動" sub="限時檔期與優惠方案，預約時會自動帶入優惠代碼" />
      <section className="section-tight">
        <div className="wrap">
          {offers.length === 0 ? (
            <div className="empty">目前沒有進行中的優惠活動。<br /><Link className="btn-link" to="/services">看所有服務與價格</Link></div>
          ) : (
            <div className="offers-list">{offers.map((p) => <OfferCard key={p.id} promo={p} services={services} full />)}</div>
          )}
          <p className="small muted center mt-4">優惠內容以工作室確認為準。</p>
        </div>
      </section>
    </>
  );
}
