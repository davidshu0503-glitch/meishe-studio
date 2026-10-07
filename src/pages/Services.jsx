import { Link } from "react-router-dom";
import { useSite } from "../lib/site";
import { money } from "../lib/utils";
import { PageHero, Reveal, useTitle } from "../components/ui";

export default function Services() {
  useTitle("服務與價格");
  const { services, studio } = useSite();
  const bookable = services.filter((s) => s.bookable);
  const packages = services.filter((s) => !s.bookable);

  const Card = ({ s, k }) => (
    <Reveal delay={(k % 3) * 100} className={`svc ${s.featured ? "featured" : ""}`}>
      {s.featured && <span className="badge-top">推薦</span>}
      <div className="en">{s.subtitle}</div>
      <h3>{s.name}</h3>
      <div className="price">{money(s.price)}<small>{s.price_note}</small></div>
      {s.duration_label && <div className="small muted">拍攝時間：{s.duration_label}</div>}
      <p className="small" style={{ color: "var(--ink-2)" }}>{s.description}</p>
      {s.features?.length > 0 && <ul>{s.features.map((f) => <li key={f}>{f}</li>)}</ul>}
      <div className="spacer" />
      {s.bookable
        ? <Link to={`/booking?service=${s.id}`} className="btn btn-sm">預約此服務</Link>
        : <a href={`tel:${(studio.phone || "").replace(/[^\d+]/g, "")}`} className="btn btn-ghost btn-sm">來電洽詢 {studio.phone}</a>}
    </Reveal>
  );

  return (
    <>
      <PageHero eyebrow="Services & Pricing" title="服務與價格" sub="所有方案皆含線上選片與雲端交件" />
      <section className="section-tight">
        <div className="wrap">
          <div className="sec-head"><div className="kicker">線上即時預約</div><h2 className="title-md">單項服務</h2></div>
          <div className="svc-grid">{bookable.map((s, k) => <Card key={s.id} s={s} k={k} />)}</div>
          {packages.length > 0 && (
            <>
              <div className="sec-head mt-4"><div className="kicker">需先與工作室討論</div><h2 className="title-md">專案方案</h2></div>
              <div className="svc-grid">{packages.map((s, k) => <Card key={s.id} s={s} k={k} />)}</div>
            </>
          )}
          <div className="card mt-4 small muted" style={{ lineHeight: 2 }}>
            <b style={{ color: "var(--ink)" }}>預約須知</b><br />
            ・以上價格為新台幣含稅價，實際內容以與工作室確認為準。<br />
            ・預約成功後會收到 Email／LINE 通知，拍攝前一天會再次提醒。<br />
            ・改期或取消請於拍攝前 2 天來電 {studio.phone}。
          </div>
        </div>
      </section>
    </>
  );
}
