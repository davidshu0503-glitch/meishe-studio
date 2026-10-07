import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { downloadUrl, errMsg, imgUrl, kickNotifications, supabase } from "../lib/supabase";
import { fmtDate } from "../lib/utils";
import { Confirm, Field, PageHero, Spinner, StatusBadge, useTitle, useToast } from "../components/ui";
import Protect from "../components/Protect";
import Lightbox from "../components/Lightbox";

export default function Gallery() {
  useTitle("線上選片／交件");
  const [params, setParams] = useSearchParams();
  const { user } = useAuth();
  const toast = useToast();
  const [cred, setCred] = useState({ orderId: params.get("order") || "", phone: "" });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [zipping, setZipping] = useState("");

  const fetchAlbum = async (orderId = cred.orderId, phone = cred.phone) => {
    setLoading(true); setError("");
    const { data: d, error: e } = await supabase.rpc("gallery_get", { p_order_id: orderId.trim(), p_phone: phone.trim() || null });
    setLoading(false);
    if (e) { setError(errMsg(e)); return; }
    setData(d);
    setParams({ order: d.order.id }, { replace: true });
  };

  // 會員登入狀態下從會員中心點進來，直接開啟
  useEffect(() => {
    if (user && params.get("order") && !data) fetchAlbum(params.get("order"), "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const photos = data?.photos || [];
  const selectedCount = photos.filter((p) => p.selected).length;
  const max = data?.album?.max_select || 0;
  const status = data?.order?.status;
  const canSelect = status === "待選片";

  const toggle = async (p) => {
    if (!canSelect) return;
    setData((d) => ({ ...d, photos: d.photos.map((x) => (x.id === p.id ? { ...x, selected: !x.selected } : x)) }));
    const { data: d, error: e } = await supabase.rpc("gallery_toggle", {
      p_order_id: data.order.id, p_phone: cred.phone || null, p_photo_id: p.id, p_selected: !p.selected,
    });
    if (e) { toast(errMsg(e), "err"); setData((d0) => ({ ...d0, photos: d0.photos.map((x) => (x.id === p.id ? { ...x, selected: p.selected } : x)) })); return; }
    setData(d);
  };

  const confirmSelection = async () => {
    const { data: d, error: e } = await supabase.rpc("gallery_confirm", { p_order_id: data.order.id, p_phone: cred.phone || null });
    setConfirming(false);
    if (e) { toast(errMsg(e), "err"); return; }
    setData(d);
    kickNotifications();
    toast("已送出選片，工作室將開始修圖！");
  };

  const finals = photos.filter((p) => p.final_path);
  const downloadZip = async () => {
    try {
      setZipping("準備中…");
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();
      let k = 0;
      for (const p of finals) {
        k++;
        setZipping(`下載中 ${k}/${finals.length}`);
        const res = await fetch(imgUrl(p.final_path, "albums"));
        const blob = await res.blob();
        const name = p.final_path.split("/").pop();
        zip.file(name, blob);
      }
      setZipping("壓縮中…");
      const out = await zip.generateAsync({ type: "blob" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(out);
      a.download = `GIME_${data.order.id}.zip`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    } catch (e) {
      toast("打包失敗，請改用單張下載", "err");
    } finally {
      setZipping("");
    }
  };

  if (!data) {
    return (
      <>
        <PageHero eyebrow="Online Gallery" title="線上選片／交件" sub="請輸入訂單編號與預約時填寫的電話" />
        <section className="section-tight">
          <div className="wrap">
            <div className="card auth-box">
              <div className="form-grid" style={{ gridTemplateColumns: "1fr" }}>
                <Field label="訂單編號"><input className="input" value={cred.orderId} placeholder="例如 OD260924-AB12" onChange={(e) => setCred({ ...cred, orderId: e.target.value.toUpperCase() })} /></Field>
                <Field label="預約電話"><input className="input" value={cred.phone} inputMode="tel" onChange={(e) => setCred({ ...cred, phone: e.target.value })} onKeyDown={(e) => e.key === "Enter" && fetchAlbum()} /></Field>
                {error && <div className="alert alert-err">{error}</div>}
                <button className="btn" disabled={loading || !cred.orderId || !cred.phone} onClick={() => fetchAlbum()}>{loading ? "查詢中…" : "進入相簿"}</button>
                <p className="small muted center">訂單編號可在預約成功通知或會員中心找到</p>
              </div>
            </div>
          </div>
        </section>
      </>
    );
  }

  return (
    <>
      <PageHero eyebrow="Online Gallery" title={data.album?.title || "我的相簿"} sub={`${data.order.service}｜${fmtDate(data.order.date)} ${data.order.time || ""}`} />
      <section className="section-tight">
        <div className="wrap">
          <div className="flex between flex-wrap mb-3">
            <div className="flex"><span className="muted small">訂單 {data.order.id}</span><StatusBadge status={status} /></div>
            <button className="btn btn-ghost btn-sm" onClick={() => { setData(null); setParams({}); }}>查詢其他訂單</button>
          </div>

          {!data.album && <div className="empty">攝影師尚未上傳照片，上傳完成後會通知您。</div>}
          {data.album?.message && <div className="alert alert-info mb-3" style={{ whiteSpace: "pre-line" }}>{data.album.message}</div>}

          {data.album && status === "已完成" && (
            <>
              <div className="alert alert-ok mb-3">精修照片已完成交件，共 {finals.length} 張，歡迎下載保存！</div>
              {finals.length > 0 && (
                <div className="flex mb-3">
                  <button className="btn btn-accent" disabled={!!zipping} onClick={downloadZip}>{zipping || "全部下載（ZIP）"}</button>
                </div>
              )}
              <div className="photo-grid">
                {finals.map((p, k) => (
                  <div key={p.id} className="ph">
                    <img src={imgUrl(p.final_path, "albums")} alt="" loading="lazy" onClick={() => setPreview({ list: finals.map((x) => imgUrl(x.final_path, "albums")), index: k })} />
                    <a className="tag" href={downloadUrl(p.final_path, "albums", p.final_path.split("/").pop())} style={{ cursor: "pointer" }}>下載</a>
                  </div>
                ))}
              </div>
              {preview && <Lightbox images={preview.list} index={preview.index} onClose={() => setPreview(null)} />}
            </>
          )}

          {data.album && status !== "已完成" && (
            <Protect>
              {canSelect ? (
                <div className="alert alert-warn mb-3">點選照片右上角圈圈即可選取{max ? `，最多可選 ${max} 張` : ""}。選好後請按下方「確認送出選片」。</div>
              ) : status === "客戶已選片" || status === "修圖中" ? (
                <div className="alert alert-ok mb-3">已收到您的選片（{selectedCount} 張），{status === "修圖中" ? "目前正在精修中" : "即將開始修圖"}，完成後會通知您下載。</div>
              ) : (
                <div className="alert alert-info mb-3">照片預覽中，開放選片時會通知您。</div>
              )}
              <div className="photo-grid">
                {photos.map((p, k) => (
                  <div key={p.id} className={`ph protect-target ${p.selected ? "sel" : ""}`}>
                    <img src={imgUrl(p.path, "albums")} alt="" loading="lazy" onClick={() => setPreview({ list: photos.map((x) => imgUrl(x.path, "albums")), index: k })} />
                    {(canSelect || p.selected) && (
                      <button className="check" onClick={() => toggle(p)} disabled={!canSelect} aria-label={p.selected ? "取消選取" : "選取"}>{p.selected ? "✓" : ""}</button>
                    )}
                    {p.filename && <span className="tag">{p.filename}</span>}
                  </div>
                ))}
              </div>
              {preview && <Lightbox images={preview.list} index={preview.index} onClose={() => setPreview(null)} />}
            </Protect>
          )}
        </div>
        {canSelect && photos.length > 0 && (
          <div className="sticky-bar">
            <div className="wrap">
              <span>已選 <b style={{ fontSize: 20 }}>{selectedCount}</b>{max ? ` / ${max}` : ""} 張</span>
              <button className="btn btn-accent" disabled={!selectedCount} onClick={() => setConfirming(true)}>確認送出選片</button>
            </div>
          </div>
        )}
        {loading && <Spinner />}
      </section>
      {confirming && (
        <Confirm title="確認送出選片？" message={`您共選擇了 ${selectedCount} 張照片。送出後將進入修圖流程，如需修改請聯繫工作室。`}
          confirmText="確認送出" onConfirm={confirmSelection} onCancel={() => setConfirming(false)} />
      )}
    </>
  );
}
