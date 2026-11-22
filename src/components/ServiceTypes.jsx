import { Link } from "react-router-dom";
import { useSite } from "../lib/site";
import { imgUrl } from "../lib/supabase";
import { Reveal } from "./ui";
import Protect, { Watermark } from "./Protect";

/**
 * 首頁「攝影服務類型」區塊：一排 6 張方形圓角照片卡片，下方是服務名稱。
 * 要換照片、名稱或連結，直接改下面這份清單即可。
 *   name  卡片下方的服務名稱
 *   image 照片（放在 public/works/ 的檔案，或完整網址）
 *   to    點卡片後前往的頁面
 */
export const SERVICE_TYPES = [
  { name: "證件照", image: "/works/portrait-03.jpg", to: "/booking?service=id_photo" },
  { name: "形象照", image: "/works/portrait-05.jpg", to: "/booking?service=business" },
  { name: "全家福", image: "/works/family-01.jpg", to: "/booking?service=family" },
  { name: "孕婦寫真", image: "/works/maternity-02.jpg", to: "/portfolio?cat=maternity" },
  { name: "黑白人像", image: "/works/bw-02.jpg", to: "/portfolio?cat=bw_studio" },
  { name: "AI 藝術肖像", image: "/works/gold-01.jpg", to: "/portfolio?tier=oneshot" },
];

export default function ServiceTypes() {
  const { studio } = useSite();
  return (
    <section className="svc-types" id="service-types" aria-labelledby="svc-types-title">
      <div className="wrap">
        <Reveal className="svc-types-head">
          <div className="svc-types-kicker">我們的攝影服務</div>
          <h2 id="svc-types-title" className="svc-types-title"><span>為每個人生階段，</span><span>留下最好的樣子</span></h2>
          <p className="svc-types-sub">從證件照、形象照到全家福與孕期紀念，也能把照片延伸成獨一無二的藝術肖像。</p>
        </Reveal>
        <Protect>
          <ul className="svc-types-grid">
            {SERVICE_TYPES.map((s, k) => (
              <Reveal as="li" key={s.name} delay={k * 80}>
                <Link to={s.to} className="svc-type">
                  <div className="svc-type-img protect-target">
                    <img src={imgUrl(s.image, "portfolio")} alt={s.name} loading="lazy" decoding="async" draggable={false} />
                    {studio.watermark && <Watermark text={studio.watermark} />}
                  </div>
                  <h3 className="svc-type-name">{s.name}</h3>
                </Link>
              </Reveal>
            ))}
          </ul>
        </Protect>
      </div>
    </section>
  );
}
