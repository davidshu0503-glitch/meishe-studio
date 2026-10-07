import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { errMsg, imgUrl, kickNotifications, supabase } from "../../lib/supabase";
import { useSite } from "../../lib/site";
import { csvDownload, fmtDate, fmtDateTime, money, normPhone, ORDER_STATUSES, resizeImage, stem, twDate, uid } from "../../lib/utils";
import { Confirm, Field, Spinner, StatusBadge, useToast } from "../../components/ui";

/* ---------------- 訂單列表 ---------------- */
export default function Orders() {
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const [rows, setRows] = useState(null);
  const [q, setQ] = useState(params.get("booking") || "");
  const status = params.get("status") || "全部";
  const [date, setDate] = useState("");

  useEffect(() => {
    supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(3000).then(({ data }) => setRows(data || []));
  }, []);

  const list = useMemo(() => (rows || []).filter((o) => {
    if (status !== "全部" && o.status !== status) return false;
    if (date && String(o.date) !== date) return false;
    if (!q) return true;
    const k = q.toLowerCase();
    return [o.id, o.booking_id, o.customer_name, o.service_name].some((v) => (v || "").toLowerCase().includes(k)) || (normPhone(q) && normPhone(o.phone).includes(normPhone(q)));
  }), [rows, q, status, date]);

  return (
    <>
      <div className="admin-head">
        <div><div className="kicker">Orders</div><h1>訂單／選片交件</h1></div>
        <button className="btn btn-ghost btn-sm" onClick={() => csvDownload(`orders_${twDate()}.csv`, [["訂單編號", "預約編號", "客戶", "電話", "服務", "拍攝日", "時間", "金額", "已收", "付款方式", "狀態", "建立時間"], ...list.map((o) => [o.id, o.booking_id, o.customer_name, o.phone, o.service_name, o.date, o.time, o.amount, o.paid_amount, o.payment_method, o.status, fmtDateTime(o.created_at)])])}>匯出 CSV</button>
      </div>
      <div className="toolbar">
        <input className="input" placeholder="搜尋訂單編號／姓名／電話" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="select" value={status} onChange={(e) => setParams(e.target.value === "全部" ? {} : { status: e.target.value })}>
          <option>全部</option>{ORDER_STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} title="拍攝日期" />
        {(q || date || status !== "全部") && <button className="btn-link small" onClick={() => { setQ(""); setDate(""); setParams({}); }}>清除篩選</button>}
        <span className="small muted">共 {list.length} 筆</span>
      </div>
      {!rows ? <Spinner /> : list.length === 0 ? <div className="empty">沒有符合的訂單</div> : (
        <div className="table-wrap">
          <table className="tbl">
            <thead><tr><th>訂單編號</th><th>客戶</th><th>服務</th><th>拍攝日</th><th>金額</th><th>狀態</th></tr></thead>
            <tbody>
              {list.map((o) => (
                <tr key={o.id} className="click" onClick={() => nav(`/admin/orders/${o.id}`)}>
                  <td className="small">{o.id}</td>
                  <td><b>{o.customer_name}</b><div className="small muted">{o.phone}</div></td>
                  <td>{o.service_name}</td>
                  <td>{o.date ? `${fmtDate(o.date)} ${o.time || ""}` : "—"}</td>
                  <td>{money(o.amount)}{o.paid_amount > 0 && <div className="small muted">已收 {money(o.paid_amount)}</div>}</td>
                  <td><StatusBadge status={o.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

/* ---------------- 上傳工具 ---------------- */
const safeName = (name, i) => (name || `photo_${i}`).replace(/[^\w.-]+/g, "_").slice(-80) || `photo_${i}.jpg`;

function DropZone({ label, onFiles, accept = "image/*", disabled }) {
  const ref = useRef();
  const [over, setOver] = useState(false);
  return (
    <div className={`drop ${over ? "over" : ""}`} onClick={() => !disabled && ref.current.click()}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); if (!disabled) onFiles([...e.dataTransfer.files]); }}>
      {label}
      <input ref={ref} type="file" accept={accept} multiple hidden onChange={(e) => { onFiles([...e.target.files]); e.target.value = ""; }} />
    </div>
  );
}

async function runPool(items, worker, size = 3) {
  let i = 0;
  const next = async () => { while (i < items.length) { const k = i++; await worker(items[k], k); } };
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, next));
}

/* ---------------- 訂單詳細 ---------------- */
const NEXT_STEP = {
  待付款: ["已付款", "確認已收款"],
  已付款: ["拍攝完成", "標記拍攝完成"],
  已預約: ["拍攝完成", "標記拍攝完成"],
  拍攝完成: ["待選片", "開放客戶選片"],
  客戶已選片: ["修圖中", "開始修圖"],
  修圖中: ["已完成", "完成交件"],
};

export function OrderDetail() {
  const { id } = useParams();
  const toast = useToast();
  const { studio } = useSite();
  const [order, setOrder] = useState(null);
  const [booking, setBooking] = useState(null);
  const [album, setAlbum] = useState(undefined);
  const [photos, setPhotos] = useState([]);
  const [edit, setEdit] = useState(null);
  const [albumForm, setAlbumForm] = useState({ title: "", max_select: 0, message: "" });
  const [progress, setProgress] = useState("");
  const [onlySel, setOnlySel] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const finalFor = useRef(null);
  const finalInput = useRef();

  const load = async () => {
    const { data: o } = await supabase.from("orders").select("*").eq("id", id).maybeSingle();
    setOrder(o || false);
    if (!o) return;
    setEdit({ amount: o.amount, paid_amount: o.paid_amount, payment_method: o.payment_method, note: o.note });
    const [{ data: b }, { data: a }] = await Promise.all([
      o.booking_id ? supabase.from("bookings").select("*").eq("id", o.booking_id).maybeSingle() : Promise.resolve({ data: null }),
      supabase.from("albums").select("*").eq("order_id", id).maybeSingle(),
    ]);
    setBooking(b); setAlbum(a || null);
    setAlbumForm(a ? { title: a.title, max_select: a.max_select, message: a.message } : { title: `${o.service_name}－${o.customer_name}`, max_select: 0, message: "" });
    if (a) {
      const { data: ph } = await supabase.from("photos").select("*").eq("album_id", a.id).order("sort").order("created_at");
      setPhotos(ph || []);
    } else setPhotos([]);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  if (order === null) return <Spinner />;
  if (order === false) return <div className="empty">找不到此訂單 <Link className="btn-link" to="/admin/orders">回列表</Link></div>;

  const setStatus = async (status) => {
    const patch = { status };
    if (status === "已付款" && !order.paid_amount) patch.paid_amount = order.amount;
    const { error } = await supabase.from("orders").update(patch).eq("id", order.id);
    if (error) return toast(errMsg(error), "err");
    if (status === "修圖中") await supabase.from("photos").update({ retouch_status: "修圖中" }).eq("album_id", album?.id || "00000000-0000-0000-0000-000000000000").eq("selected", true).eq("retouch_status", "未修圖");
    kickNotifications();
    toast(`狀態已更新為「${status}」`);
    load();
  };

  const saveOrder = async () => {
    const { error } = await supabase.from("orders").update({
      amount: Number(edit.amount) || 0, paid_amount: Number(edit.paid_amount) || 0, payment_method: edit.payment_method, note: edit.note,
    }).eq("id", order.id);
    if (error) return toast(errMsg(error), "err");
    toast("已儲存"); load();
  };

  const saveAlbum = async () => {
    const payload = { title: albumForm.title, max_select: Number(albumForm.max_select) || 0, message: albumForm.message };
    const { error } = album
      ? await supabase.from("albums").update(payload).eq("id", album.id)
      : await supabase.from("albums").insert({ ...payload, order_id: order.id });
    if (error) return toast(errMsg(error), "err");
    toast(album ? "相簿設定已儲存" : "相簿已建立，可以開始上傳照片"); load();
  };

  const uploadPreviews = async (files) => {
    files = files.filter((f) => f.type.startsWith("image/"));
    if (!files.length) return;
    let done = 0;
    const base = photos.length;
    const rows = [];
    await runPool(files, async (file, k) => {
      const small = await resizeImage(file, { maxSize: 1600, quality: 0.82, watermark: studio.watermark || "© GIME STUDIO" });
      const path = `${album.id}/${uid()}.jpg`;
      const { error } = await supabase.storage.from("albums").upload(path, small, { contentType: "image/jpeg", cacheControl: "31536000" });
      if (error) { toast(`${file.name} 上傳失敗：${errMsg(error)}`, "err"); return; }
      rows.push({ album_id: album.id, path, filename: file.name, sort: base + k });
      setProgress(`上傳中 ${++done}/${files.length}`);
    });
    if (rows.length) await supabase.from("photos").insert(rows);
    setProgress("");
    toast(`已上傳 ${rows.length} 張預覽照片`);
    load();
  };

  const uploadFinals = async (files, target) => {
    files = files.filter((f) => f.type.startsWith("image/") || /\.(jpe?g|png|tiff?|heic|webp)$/i.test(f.name));
    if (!files.length) return;
    let done = 0, matched = 0, added = 0;
    const byStem = new Map(photos.map((p) => [stem(p.filename), p]));
    await runPool(files, async (file, k) => {
      const path = `${album.id}/final/${uid().slice(0, 8)}-${safeName(file.name, k)}`;
      const { error } = await supabase.storage.from("albums").upload(path, file, { contentType: file.type || "image/jpeg", cacheControl: "31536000" });
      if (error) { toast(`${file.name} 上傳失敗：${errMsg(error)}`, "err"); return; }
      const hit = target || byStem.get(stem(file.name));
      if (hit) {
        await supabase.from("photos").update({ final_path: path, retouch_status: "已完成" }).eq("id", hit.id);
        matched++;
      } else {
        const preview = await resizeImage(file, { maxSize: 1600, quality: 0.82 });
        const pPath = `${album.id}/${uid()}.jpg`;
        await supabase.storage.from("albums").upload(pPath, preview, { contentType: "image/jpeg" });
        await supabase.from("photos").insert({ album_id: album.id, path: pPath, final_path: path, filename: file.name, selected: true, retouch_status: "已完成", sort: 1000 + k });
        added++;
      }
      setProgress(`上傳精修檔 ${++done}/${files.length}`);
    });
    setProgress("");
    toast(`精修檔上傳完成：對應 ${matched} 張${added ? `，新增 ${added} 張` : ""}`);
    load();
  };

  const deletePhoto = async (p) => {
    const paths = [p.path, p.final_path].filter((x) => x && !/^https?:/.test(x));
    if (paths.length) await supabase.storage.from("albums").remove(paths);
    await supabase.from("photos").delete().eq("id", p.id);
    setConfirm(null); load();
  };

  const clientLink = `${window.location.origin}/gallery?order=${order.id}`;
  const shown = onlySel ? photos.filter((p) => p.selected) : photos;
  const selCount = photos.filter((p) => p.selected).length;
  const finalCount = photos.filter((p) => p.final_path).length;
  const next = NEXT_STEP[order.status];

  return (
    <>
      <div className="admin-head">
        <div>
          <Link to="/admin/orders" className="small muted">← 訂單列表</Link>
          <h1 style={{ marginTop: 6 }}>{order.customer_name}｜{order.service_name}</h1>
          <p className="small muted">{order.id}{order.booking_id && `｜預約 ${order.booking_id}`}｜建立於 {fmtDateTime(order.created_at)}</p>
        </div>
        <div className="flex flex-wrap">
          <StatusBadge status={order.status} />
          {next && <button className="btn btn-accent btn-sm" disabled={(next[0] === "待選片" && !photos.length) || (next[0] === "已完成" && !finalCount)} onClick={() => setStatus(next[0])}>{next[1]} →</button>}
          <select className="select" style={{ width: "auto", padding: "7px 10px" }} value={order.status} onChange={(e) => setConfirm({ type: "status", value: e.target.value })}>
            {ORDER_STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
      </div>
      {next?.[0] === "待選片" && !photos.length && <div className="alert alert-info mb-2 small">請先建立相簿並上傳預覽照片，才能開放選片。</div>}
      {next?.[0] === "已完成" && !finalCount && <div className="alert alert-info mb-2 small">請先上傳精修檔，才能完成交件。</div>}

      <div className="two-col mb-3">
        <div className="panel">
          <h3>客戶與拍攝資訊</h3>
          <dl className="kv">
            <dt>客戶</dt><dd>{order.customer_name}{order.customer_id && <Link className="btn-link small" style={{ marginLeft: 8 }} to={`/admin/customers?id=${order.customer_id}`}>客戶資料</Link>}</dd>
            <dt>電話</dt><dd><a href={`tel:${order.phone}`}>{order.phone}</a></dd>
            {booking?.email && <><dt>Email</dt><dd><a href={`mailto:${booking.email}`}>{booking.email}</a></dd></>}
            {booking?.line_id && <><dt>LINE ID</dt><dd>{booking.line_id}</dd></>}
            <dt>拍攝時間</dt><dd>{order.date ? `${fmtDate(order.date)} ${order.time}` : "—"}</dd>
            {booking?.note && <><dt>客戶備註</dt><dd style={{ whiteSpace: "pre-line" }}>{booking.note}</dd></>}
            <dt>選片連結</dt><dd><button className="btn-link small" onClick={() => { navigator.clipboard?.writeText(clientLink); toast("已複製選片連結"); }}>複製連結</button> <span className="small muted">（客戶需輸入電話）</span></dd>
          </dl>
        </div>
        {edit && (
          <div className="panel">
            <h3>金額與付款</h3>
            <div className="form-grid">
              <Field label="訂單金額"><input className="input" type="number" value={edit.amount} onChange={(e) => setEdit({ ...edit, amount: e.target.value })} /></Field>
              <Field label="已收金額"><input className="input" type="number" value={edit.paid_amount} onChange={(e) => setEdit({ ...edit, paid_amount: e.target.value })} /></Field>
              <Field label="付款方式" full>
                <select className="select" value={edit.payment_method} onChange={(e) => setEdit({ ...edit, payment_method: e.target.value })}>
                  {["", "現金", "銀行轉帳", "信用卡", "LINE Pay", "街口支付", "其他"].map((m) => <option key={m} value={m}>{m || "（未選擇）"}</option>)}
                </select>
              </Field>
              <Field label="內部備註" full><textarea className="textarea" style={{ minHeight: 60 }} value={edit.note} onChange={(e) => setEdit({ ...edit, note: e.target.value })} /></Field>
            </div>
            <div className="flex between mt-2"><span className="small muted">{order.paid_at ? `付款時間 ${fmtDateTime(order.paid_at)}` : "尚未付款"}</span><button className="btn btn-sm" onClick={saveOrder}>儲存</button></div>
          </div>
        )}
      </div>

      <div className="panel">
        <div className="flex between flex-wrap mb-2">
          <h3 style={{ margin: 0 }}>相簿／選片／交件</h3>
          {album && <span className="small muted">共 {photos.length} 張｜客戶已選 {selCount}{album.max_select ? ` / ${album.max_select}` : ""}｜精修檔 {finalCount}</span>}
        </div>
        <div className="form-grid mb-3">
          <Field label="相簿名稱"><input className="input" value={albumForm.title} onChange={(e) => setAlbumForm({ ...albumForm, title: e.target.value })} /></Field>
          <Field label="可選張數（0 = 不限）"><input className="input" type="number" min="0" value={albumForm.max_select} onChange={(e) => setAlbumForm({ ...albumForm, max_select: e.target.value })} /></Field>
          <Field label="給客戶的話" full><input className="input" value={albumForm.message} placeholder="例如：可選 15 張精修，加選每張 NT$ 200" onChange={(e) => setAlbumForm({ ...albumForm, message: e.target.value })} /></Field>
          <div><button className="btn btn-sm" onClick={saveAlbum}>{album ? "儲存相簿設定" : "建立相簿"}</button></div>
        </div>

        {album && (
          <>
            <div className="form-grid mb-3">
              <DropZone disabled={!!progress} label={<><b>① 上傳預覽照片（給客戶選片）</b><br /><span className="small">拖曳或點擊選擇，會自動壓縮並加上浮水印</span></>} onFiles={uploadPreviews} />
              <DropZone disabled={!!progress} label={<><b>② 上傳精修檔（交件）</b><br /><span className="small">原檔上傳；檔名與預覽相同會自動對應</span></>} onFiles={(f) => uploadFinals(f)} />
            </div>
            {progress && <div className="alert alert-info mb-2">{progress}…請勿關閉頁面</div>}
            <div className="flex mb-2">
              <label className="small flex"><input type="checkbox" checked={onlySel} onChange={(e) => setOnlySel(e.target.checked)} /> 只看客戶選取的照片</label>
              {selCount > 0 && <button className="btn-link small" onClick={() => { navigator.clipboard?.writeText(photos.filter((p) => p.selected).map((p) => p.filename).join("\n")); toast("已複製選片檔名清單"); }}>複製選片檔名清單</button>}
            </div>
            {shown.length === 0 ? <div className="empty">{onlySel ? "客戶尚未選片" : "尚未上傳照片"}</div> : (
              <div className="thumbs">
                {shown.map((p) => (
                  <div key={p.id} className={`thumb ${p.selected ? "sel" : ""}`} title={p.filename}>
                    <img src={imgUrl(p.final_path || p.path, "albums")} alt={p.filename} loading="lazy" />
                    {p.selected && <span className="t-badge r">已選</span>}
                    <span className="t-badge">{p.final_path ? "精修✓" : p.retouch_status}</span>
                    <div className="t-act">
                      <button onClick={() => { finalFor.current = p; finalInput.current.click(); }}>精修</button>
                      <button onClick={() => setConfirm({ type: "photo", photo: p })}>刪</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <input ref={finalInput} type="file" accept="image/*" hidden onChange={(e) => { const f = [...e.target.files]; e.target.value = ""; uploadFinals(f, finalFor.current); }} />
          </>
        )}
      </div>

      {confirm?.type === "status" && (
        <Confirm title="變更訂單狀態？" message={`「${order.status}」→「${confirm.value}」。${confirm.value === "已取消" ? "取消會同步取消預約並釋放時段。" : ""}系統會依狀態自動通知客戶。`}
          danger={confirm.value === "已取消"} onConfirm={async () => { await setStatus(confirm.value); setConfirm(null); }} onCancel={() => setConfirm(null)} />
      )}
      {confirm?.type === "photo" && (
        <Confirm title="刪除照片？" danger message={`${confirm.photo.filename || "此照片"} 的預覽與精修檔都會刪除，無法復原。`} onConfirm={() => deletePhoto(confirm.photo)} onCancel={() => setConfirm(null)} />
      )}
    </>
  );
}
