import { useEffect, useRef, useState } from "react";
import { errMsg, imgUrl, supabase } from "../../lib/supabase";
import { useSite } from "../../lib/site";
import { EVENT_LABELS, resizeImage, uid, WEEKDAYS } from "../../lib/utils";
import { Confirm, Field, Modal, Spinner, useToast } from "../../components/ui";

const TABS = [["studio", "工作室資訊"], ["hero", "首頁輪播"], ["services", "服務與價格"], ["portfolio", "作品集"], ["categories", "作品分類"], ["booking", "預約設定"], ["notify", "通知設定"]];

async function saveSetting(key, value, isPublic = true) {
  return supabase.from("settings").upsert({ key, value, is_public: isPublic });
}

async function uploadPortfolioImage(file) {
  const small = await resizeImage(file, { maxSize: 2000, quality: 0.86 });
  const path = `${uid()}.jpg`;
  const { error } = await supabase.storage.from("portfolio").upload(path, small, { contentType: "image/jpeg", cacheControl: "31536000" });
  if (error) throw error;
  return path;
}

function ImagePicker({ value, onChange, label = "圖片" }) {
  const ref = useRef();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <Field label={label} full>
      <div className="flex flex-wrap">
        {value && <img src={imgUrl(value, "portfolio")} alt="" style={{ width: 96, height: 64, objectFit: "cover", borderRadius: 4 }} />}
        <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => ref.current.click()}>{busy ? "上傳中…" : "上傳圖片"}</button>
        <input className="input grow" value={value || ""} placeholder="或貼上圖片網址" onChange={(e) => onChange(e.target.value)} style={{ minWidth: 200 }} />
        <input ref={ref} type="file" accept="image/*" hidden onChange={async (e) => {
          const f = e.target.files[0]; e.target.value = ""; if (!f) return;
          setBusy(true);
          try { onChange(await uploadPortfolioImage(f)); } catch (err) { toast(errMsg(err), "err"); }
          setBusy(false);
        }} />
      </div>
    </Field>
  );
}

/* ---------- 工作室資訊 ---------- */
function StudioTab() {
  const { studio, reload } = useSite();
  const toast = useToast();
  const [f, setF] = useState(studio);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const save = async () => {
    const { error } = await saveSetting("studio", f, true);
    if (error) return toast(errMsg(error), "err");
    toast("工作室資訊已更新"); reload();
  };
  const fields = [["name", "工作室名稱"], ["name_en", "英文名稱"], ["tagline", "標語（英文）"], ["hero_title", "首頁主標題（留空則使用每張輪播的標題）"], ["slogan", "中文標語"], ["phone", "電話"], ["email", "公開 Email"], ["address", "地址"], ["hours", "營業時間"], ["line_url", "LINE 官方帳號網址"], ["instagram", "Instagram 網址"], ["facebook", "Facebook 網址"], ["site_url", "網站網址（通知信連結用）"], ["watermark", "作品浮水印文字"], ["map_embed", "Google 地圖嵌入網址（選填）"]];
  return (
    <div className="panel">
      <div className="form-grid">
        {fields.map(([k, l]) => <Field key={k} label={l}><input className="input" value={f[k] || ""} onChange={(e) => set(k, e.target.value)} /></Field>)}
        <Field label="工作室介紹（首頁／關於我們）" full><textarea className="textarea" value={f.intro || ""} onChange={(e) => set("intro", e.target.value)} /></Field>
        <Field label="品牌故事（關於我們，選填）" full><textarea className="textarea" value={f.story || ""} onChange={(e) => set("story", e.target.value)} /></Field>
      </div>
      <button className="btn mt-3" onClick={save}>儲存</button>
    </div>
  );
}

/* ---------- 首頁輪播 ---------- */
function HeroTab() {
  const { hero, reload } = useSite();
  const toast = useToast();
  const [list, setList] = useState(hero);
  const upd = (i, k, v) => setList((l) => l.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const move = (i, d) => setList((l) => { const n = [...l]; const [x] = n.splice(i, 1); n.splice(i + d, 0, x); return n; });
  const save = async () => {
    const clean = list.filter((h) => h.image);
    if (!clean.length) return toast("至少需要一張輪播圖", "err");
    const { error } = await saveSetting("hero", clean, true);
    if (error) return toast(errMsg(error), "err");
    toast("首頁輪播已更新"); reload();
  };
  return (
    <div className="list">
      {list.map((h, i) => (
        <div key={i} className="panel">
          <div className="flex between mb-2"><b>第 {i + 1} 張</b>
            <div className="flex">
              <button className="btn btn-ghost btn-sm" disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
              <button className="btn btn-ghost btn-sm" disabled={i === list.length - 1} onClick={() => move(i, 1)}>↓</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setList((l) => l.filter((_, j) => j !== i))}>刪除</button>
            </div>
          </div>
          <div className="form-grid">
            <ImagePicker value={h.image} onChange={(v) => upd(i, "image", v)} />
            <Field label="主標"><input className="input" value={h.headline || ""} onChange={(e) => upd(i, "headline", e.target.value)} /></Field>
            <Field label="副標"><input className="input" value={h.sub || ""} onChange={(e) => upd(i, "sub", e.target.value)} /></Field>
            <Field label="分類標籤（點擊跳到該分類）"><input className="input" value={h.cat || ""} onChange={(e) => upd(i, "cat", e.target.value)} /></Field>
          </div>
        </div>
      ))}
      <div className="flex"><button className="btn btn-ghost" onClick={() => setList((l) => [...l, { image: "", headline: "", sub: "", cat: "" }])}>＋ 新增一張</button><button className="btn" onClick={save}>儲存輪播</button></div>
    </div>
  );
}

/* ---------- 服務與價格 ---------- */
function ServicesTab() {
  const { reload } = useSite();
  const toast = useToast();
  const [rows, setRows] = useState(null);
  const [edit, setEdit] = useState(null);
  const load = () => supabase.from("services").select("*").order("sort").then(({ data }) => setRows(data || []));
  useEffect(() => { load(); }, []);
  const save = async () => {
    const row = { ...edit, price: Number(edit.price) || 0, sort: Number(edit.sort) || 0, features: (edit.featuresText || "").split("\n").map((s) => s.trim()).filter(Boolean) };
    delete row.featuresText; delete row.isNew; delete row.updated_at;
    if (!/^[a-z0-9_-]+$/.test(row.id)) return toast("代碼只能用小寫英文、數字、底線", "err");
    const { error } = edit.isNew ? await supabase.from("services").insert(row) : await supabase.from("services").update(row).eq("id", row.id);
    if (error) return toast(errMsg(error), "err");
    toast("服務已儲存"); setEdit(null); load(); reload();
  };
  if (!rows) return <Spinner />;
  return (
    <>
      <div className="flex mb-2"><button className="btn btn-sm" onClick={() => setEdit({ isNew: true, id: "", name: "", subtitle: "", description: "", price: 0, price_note: "", duration_label: "", featuresText: "", image: "", featured: false, bookable: true, active: true, sort: rows.length + 1 })}>＋ 新增服務</button></div>
      <div className="table-wrap">
        <table className="tbl">
          <thead><tr><th>排序</th><th>服務</th><th>價格</th><th>線上預約</th><th>顯示</th><th></th></tr></thead>
          <tbody>{rows.map((s) => (
            <tr key={s.id}>
              <td>{s.sort}</td><td><b>{s.name}</b> <span className="small muted">{s.subtitle}</span>{s.featured && <span className="badge warn" style={{ marginLeft: 6 }}>推薦</span>}</td>
              <td>NT$ {s.price.toLocaleString()}{s.price_note}</td><td>{s.bookable ? "✓" : "洽詢"}</td><td>{s.active ? "顯示" : <span className="muted">隱藏</span>}</td>
              <td><button className="btn btn-ghost btn-sm" onClick={() => setEdit({ ...s, featuresText: (s.features || []).join("\n") })}>編輯</button></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      {edit && (
        <Modal title={edit.isNew ? "新增服務" : `編輯：${edit.name}`} wide onClose={() => setEdit(null)} actions={<><button className="btn btn-ghost btn-sm" onClick={() => setEdit(null)}>取消</button><button className="btn btn-sm" onClick={save}>儲存</button></>}>
          <div className="form-grid">
            <Field label="代碼（英文，建立後不可改）"><input className="input" value={edit.id} disabled={!edit.isNew} onChange={(e) => setEdit({ ...edit, id: e.target.value.toLowerCase() })} /></Field>
            <Field label="名稱"><input className="input" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
            <Field label="英文副標"><input className="input" value={edit.subtitle} onChange={(e) => setEdit({ ...edit, subtitle: e.target.value })} /></Field>
            <Field label="拍攝時間"><input className="input" value={edit.duration_label} onChange={(e) => setEdit({ ...edit, duration_label: e.target.value })} /></Field>
            <Field label="價格（數字）"><input className="input" type="number" value={edit.price} onChange={(e) => setEdit({ ...edit, price: e.target.value })} /></Field>
            <Field label="價格後綴（如「起」「／2小時」）"><input className="input" value={edit.price_note} onChange={(e) => setEdit({ ...edit, price_note: e.target.value })} /></Field>
            <Field label="說明" full><textarea className="textarea" style={{ minHeight: 60 }} value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></Field>
            <Field label="方案內容（一行一項）" full><textarea className="textarea" value={edit.featuresText} onChange={(e) => setEdit({ ...edit, featuresText: e.target.value })} /></Field>
            <Field label="排序"><input className="input" type="number" value={edit.sort} onChange={(e) => setEdit({ ...edit, sort: e.target.value })} /></Field>
            <Field label="選項">
              <div className="flex flex-wrap small">
                <label className="flex"><input type="checkbox" checked={edit.bookable} onChange={(e) => setEdit({ ...edit, bookable: e.target.checked })} />可線上預約</label>
                <label className="flex"><input type="checkbox" checked={edit.featured} onChange={(e) => setEdit({ ...edit, featured: e.target.checked })} />推薦（首頁顯示）</label>
                <label className="flex"><input type="checkbox" checked={edit.active} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} />在網站顯示</label>
              </div>
            </Field>
          </div>
        </Modal>
      )}
    </>
  );
}

/* ---------- 作品集 ---------- */
function PortfolioTab() {
  const { categories, reload } = useSite();
  const toast = useToast();
  const [rows, setRows] = useState(null);
  const [cat, setCat] = useState(categories[0]?.slug || "");
  const [edit, setEdit] = useState(null);
  const [del, setDel] = useState(null);
  const [busy, setBusy] = useState("");
  const addRef = useRef();
  const imgRef = useRef();

  const load = () => supabase.from("portfolio").select("*").order("sort").order("created_at", { ascending: false }).then(({ data }) => setRows(data || []));
  useEffect(() => { load(); }, []);
  const after = () => { load(); reload(); };

  const addWorks = async (files, asOne) => {
    files = files.filter((f) => f.type.startsWith("image/"));
    if (!files.length) return;
    try {
      const paths = [];
      for (let i = 0; i < files.length; i++) { setBusy(`上傳中 ${i + 1}/${files.length}`); paths.push(await uploadPortfolioImage(files[i])); }
      const base = (rows || []).filter((r) => r.category === cat).length;
      const inserts = asOne
        ? [{ category: cat, title: files[0].name.replace(/\.\w+$/, ""), images: paths, sort: base }]
        : paths.map((p, i) => ({ category: cat, title: files[i].name.replace(/\.\w+$/, ""), images: [p], sort: base + i }));
      const { error } = await supabase.from("portfolio").insert(inserts);
      if (error) throw error;
      toast(`已新增 ${inserts.length} 件作品`);
    } catch (e) { toast(errMsg(e), "err"); }
    setBusy(""); after();
  };

  const saveEdit = async () => {
    const { id, title, description, category, featured, published, sort, images } = edit;
    const { error } = await supabase.from("portfolio").update({ title, description, category, featured, published, sort: Number(sort) || 0, images }).eq("id", id);
    if (error) return toast(errMsg(error), "err");
    toast("作品已更新"); setEdit(null); after();
  };

  const doDelete = async () => {
    const paths = (del.images || []).filter((p) => !/^https?:/.test(p));
    if (paths.length) await supabase.storage.from("portfolio").remove(paths);
    await supabase.from("portfolio").delete().eq("id", del.id);
    setDel(null); toast("作品已刪除"); after();
  };

  if (!rows) return <Spinner />;
  const list = rows.filter((r) => r.category === cat);
  return (
    <>
      <div className="toolbar">
        <select className="select" value={cat} onChange={(e) => setCat(e.target.value)}>{categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}（{rows.filter((r) => r.category === c.slug).length}）</option>)}</select>
        <button className="btn btn-sm" disabled={!!busy} onClick={() => { addRef.current.dataset.one = ""; addRef.current.click(); }}>＋ 上傳作品（一張一件）</button>
        <button className="btn btn-ghost btn-sm" disabled={!!busy} onClick={() => { addRef.current.dataset.one = "1"; addRef.current.click(); }}>＋ 多張合成一件作品</button>
        {busy && <span className="small muted">{busy}</span>}
        <input ref={addRef} type="file" accept="image/*" multiple hidden onChange={(e) => { const f = [...e.target.files]; e.target.value = ""; addWorks(f, addRef.current.dataset.one === "1"); }} />
      </div>
      <p className="small muted mb-2">小技巧：一件作品可放多張照片，網站上會自動輪播；勾選「精選」會顯示在首頁。上傳時會自動壓縮成網頁尺寸。</p>
      {list.length === 0 ? <div className="empty">此分類還沒有作品</div> : (
        <div className="thumbs" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}>
          {list.map((p) => (
            <div key={p.id} className="thumb" style={{ aspectRatio: "4/5", cursor: "pointer" }} onClick={() => setEdit({ ...p })}>
              <img src={imgUrl(p.images?.[0], "portfolio")} alt={p.title} loading="lazy" />
              <span className="t-badge">{p.images?.length || 0} 張{p.featured ? "・精選" : ""}{p.published ? "" : "・隱藏"}</span>
              <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,.55)", color: "#fff", fontSize: 13.5, padding: "4px 8px" }}>{p.title}</div>
            </div>
          ))}
        </div>
      )}
      {edit && (
        <Modal title="編輯作品" wide onClose={() => setEdit(null)} actions={<>
          <button className="btn btn-ghost btn-sm" onClick={() => { setDel(edit); setEdit(null); }}>刪除作品</button>
          <span className="grow" />
          <button className="btn btn-ghost btn-sm" onClick={() => setEdit(null)}>取消</button>
          <button className="btn btn-sm" onClick={saveEdit}>儲存</button>
        </>}>
          <div className="thumbs mb-2">
            {edit.images.map((src, i) => (
              <div key={src + i} className="thumb">
                <img src={imgUrl(src, "portfolio")} alt="" />
                {i === 0 && <span className="t-badge">封面</span>}
                <div className="t-act">
                  {i > 0 && <button onClick={() => setEdit({ ...edit, images: [src, ...edit.images.filter((_, j) => j !== i)] })}>設為封面</button>}
                  {edit.images.length > 1 && <button onClick={() => setEdit({ ...edit, images: edit.images.filter((_, j) => j !== i) })}>移除</button>}
                </div>
              </div>
            ))}
            <button className="drop" style={{ aspectRatio: "1" }} disabled={!!busy} onClick={() => imgRef.current.click()}>{busy || "＋ 加照片"}</button>
            <input ref={imgRef} type="file" accept="image/*" multiple hidden onChange={async (e) => {
              const files = [...e.target.files]; e.target.value = "";
              try { const add = []; for (const f of files) { setBusy("上傳中…"); add.push(await uploadPortfolioImage(f)); } setEdit((x) => ({ ...x, images: [...x.images, ...add] })); }
              catch (err) { toast(errMsg(err), "err"); }
              setBusy("");
            }} />
          </div>
          <div className="form-grid">
            <Field label="作品名稱"><input className="input" value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></Field>
            <Field label="分類"><select className="select" value={edit.category || ""} onChange={(e) => setEdit({ ...edit, category: e.target.value })}>{categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}</select></Field>
            <Field label="說明（燈箱顯示）" full><input className="input" value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></Field>
            <Field label="排序（數字小的在前）"><input className="input" type="number" value={edit.sort} onChange={(e) => setEdit({ ...edit, sort: e.target.value })} /></Field>
            <Field label="選項"><div className="flex small">
              <label className="flex"><input type="checkbox" checked={edit.featured} onChange={(e) => setEdit({ ...edit, featured: e.target.checked })} />首頁精選</label>
              <label className="flex"><input type="checkbox" checked={edit.published} onChange={(e) => setEdit({ ...edit, published: e.target.checked })} />公開顯示</label>
            </div></Field>
          </div>
        </Modal>
      )}
      {del && <Confirm title="刪除作品？" danger message={`「${del.title}」與其 ${del.images?.length || 0} 張照片將永久刪除。`} onConfirm={doDelete} onCancel={() => setDel(null)} />}
    </>
  );
}

/* ---------- 作品分類 ---------- */
function CategoriesTab() {
  const { categories, reload } = useSite();
  const toast = useToast();
  const [list, setList] = useState(categories.map((c) => ({ ...c, orig: c.slug })));
  const save = async () => {
    for (const c of list) {
      if (!/^[a-z0-9_-]+$/.test(c.slug) || !c.name.trim()) return toast("代碼只能用小寫英文數字底線，名稱不可空白", "err");
      const row = { slug: c.slug, name: c.name.trim(), sort: Number(c.sort) || 0 };
      const { error } = c.orig ? await supabase.from("categories").update(row).eq("slug", c.orig) : await supabase.from("categories").insert(row);
      if (error) return toast(errMsg(error), "err");
    }
    const removed = categories.filter((c) => !list.some((l) => l.orig === c.slug)).map((c) => c.slug);
    if (removed.length) await supabase.from("categories").delete().in("slug", removed);
    toast("分類已更新"); reload();
  };
  return (
    <div className="panel">
      <div className="list">
        {list.map((c, i) => (
          <div key={i} className="flex flex-wrap">
            <input className="input" style={{ width: 90 }} type="number" value={c.sort} onChange={(e) => setList((l) => l.map((x, j) => (j === i ? { ...x, sort: e.target.value } : x)))} title="排序" />
            <input className="input" style={{ width: 160 }} value={c.slug} placeholder="代碼 (英文)" onChange={(e) => setList((l) => l.map((x, j) => (j === i ? { ...x, slug: e.target.value.toLowerCase() } : x)))} />
            <input className="input grow" value={c.name} placeholder="顯示名稱" onChange={(e) => setList((l) => l.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
            <button className="btn btn-ghost btn-sm" onClick={() => setList((l) => l.filter((_, j) => j !== i))}>刪除</button>
          </div>
        ))}
      </div>
      <p className="small muted mt-2">刪除分類不會刪除作品，作品會變成「未分類」，可再到作品集重新指定。</p>
      <div className="flex mt-2"><button className="btn btn-ghost btn-sm" onClick={() => setList((l) => [...l, { slug: "", name: "", sort: l.length + 1 }])}>＋ 新增分類</button><button className="btn btn-sm" onClick={save}>儲存</button></div>
    </div>
  );
}

/* ---------- 預約設定 ---------- */
function BookingTab() {
  const { booking, reload } = useSite();
  const toast = useToast();
  const [f, setF] = useState({ ...booking, slotsText: (booking.slots || []).join(", ") });
  const [blocked, setBlocked] = useState([]);
  const [newDate, setNewDate] = useState("");
  const [reason, setReason] = useState("");
  const loadBlocked = () => supabase.from("blocked_dates").select("*").order("date").then(({ data }) => setBlocked(data || []));
  useEffect(() => { loadBlocked(); }, []);
  const save = async () => {
    const slots = f.slotsText.split(/[,，\s]+/).map((s) => s.trim()).filter((s) => /^\d{1,2}:\d{2}$/.test(s)).map((s) => s.padStart(5, "0")).sort();
    if (!slots.length) return toast("請至少設定一個時段", "err");
    const value = { slots, closed_weekdays: f.closed_weekdays || [], max_days_ahead: Number(f.max_days_ahead) || 90, notice: f.notice || "", payment_info: f.payment_info || "" };
    const { error } = await saveSetting("booking", value, true);
    if (error) return toast(errMsg(error), "err");
    toast("預約設定已更新"); reload();
  };
  const toggleWd = (d) => setF((x) => ({ ...x, closed_weekdays: x.closed_weekdays?.includes(d) ? x.closed_weekdays.filter((y) => y !== d) : [...(x.closed_weekdays || []), d] }));
  return (
    <div className="two-col">
      <div className="panel">
        <h3>時段與規則</h3>
        <div className="form-grid" style={{ gridTemplateColumns: "1fr" }}>
          <Field label="每日可預約時段（用逗號分隔）" hint="例如：10:00, 11:00, 13:00, 14:00"><input className="input" value={f.slotsText} onChange={(e) => setF({ ...f, slotsText: e.target.value })} /></Field>
          <Field label="每週公休日"><div className="flex flex-wrap">{WEEKDAYS.map((w, d) => <button key={d} className={`btn btn-sm ${f.closed_weekdays?.includes(d) ? "" : "btn-ghost"}`} onClick={() => toggleWd(d)}>週{w}</button>)}</div></Field>
          <Field label="最多可預約幾天後"><input className="input" type="number" value={f.max_days_ahead} onChange={(e) => setF({ ...f, max_days_ahead: e.target.value })} /></Field>
          <Field label="預約須知（顯示在預約頁）"><textarea className="textarea" value={f.notice} onChange={(e) => setF({ ...f, notice: e.target.value })} /></Field>
          <Field label="付款資訊（預約成功頁顯示，如匯款帳號）" hint="留空則不顯示"><textarea className="textarea" value={f.payment_info || ""} onChange={(e) => setF({ ...f, payment_info: e.target.value })} /></Field>
        </div>
        <button className="btn mt-2" onClick={save}>儲存</button>
      </div>
      <div className="panel">
        <h3>特定休假日</h3>
        <div className="flex flex-wrap mb-2">
          <input className="input" type="date" style={{ width: "auto" }} value={newDate} onChange={(e) => setNewDate(e.target.value)} />
          <input className="input grow" placeholder="原因（選填）" value={reason} onChange={(e) => setReason(e.target.value)} />
          <button className="btn btn-sm" disabled={!newDate} onClick={async () => { const { error } = await supabase.from("blocked_dates").upsert({ date: newDate, reason }); if (error) toast(errMsg(error), "err"); setNewDate(""); setReason(""); loadBlocked(); }}>新增</button>
        </div>
        {blocked.length === 0 ? <div className="small muted">沒有設定休假日</div> : (
          <div className="flex flex-wrap">{blocked.map((b) => <span key={b.date} className="chip">{b.date}{b.reason && `（${b.reason}）`}<button onClick={async () => { await supabase.from("blocked_dates").delete().eq("date", b.date); loadBlocked(); }} aria-label="移除">×</button></span>)}</div>
        )}
      </div>
    </div>
  );
}

/* ---------- 通知設定 ---------- */
function NotifyTab() {
  const toast = useToast();
  const [notify, setNotify] = useState(null);
  const [tpl, setTpl] = useState(null);
  const [key, setKey] = useState("booking_created");
  useEffect(() => {
    supabase.from("settings").select("key,value").in("key", ["notify", "templates"]).then(({ data }) => {
      const m = Object.fromEntries((data || []).map((r) => [r.key, r.value]));
      setNotify(m.notify || { studio_email: "", enabled: {} });
      setTpl(m.templates || {});
    });
  }, []);
  if (!notify || !tpl) return <Spinner />;
  const keys = [...Object.keys(EVENT_LABELS), "studio_booking_created", "studio_booking_cancelled", "studio_selection_done"];
  const label = (k) => (k.startsWith("studio_") ? `［給工作室］${EVENT_LABELS[k.slice(7)]}` : EVENT_LABELS[k]);
  const cur = tpl[key] || { subject: "", body: "" };
  const save = async () => {
    const [a, b] = await Promise.all([saveSetting("notify", notify, false), saveSetting("templates", tpl, false)]);
    if (a.error || b.error) return toast(errMsg(a.error || b.error), "err");
    toast("通知設定已儲存");
  };
  return (
    <div className="two-col">
      <div className="panel">
        <h3>通知內容範本</h3>
        <Field label="選擇通知"><select className="select" value={key} onChange={(e) => setKey(e.target.value)}>{keys.map((k) => <option key={k} value={k}>{label(k)}</option>)}</select></Field>
        <Field label="主旨"><input className="input" value={cur.subject} onChange={(e) => setTpl({ ...tpl, [key]: { ...cur, subject: e.target.value } })} /></Field>
        <Field label="內容"><textarea className="textarea" style={{ minHeight: 240 }} value={cur.body} onChange={(e) => setTpl({ ...tpl, [key]: { ...cur, body: e.target.value } })} /></Field>
        <p className="small muted mt-1">可用變數：{"{{name}} {{phone}} {{booking_id}} {{order_id}} {{service}} {{date}} {{time}} {{amount}} {{note}} {{selected_count}} {{studio_name}} {{studio_phone}} {{site_url}}"}</p>
        <button className="btn mt-2" onClick={save}>儲存</button>
      </div>
      <div className="panel">
        <h3>通知開關與收件人</h3>
        <Field label="工作室收件 Email（新預約、取消、選片完成）"><input className="input" value={notify.studio_email || ""} onChange={(e) => setNotify({ ...notify, studio_email: e.target.value })} /></Field>
        <Field label="工作室 LINE userId（多個用逗號分隔）" hint="對官方帳號傳「我的ID」即可取得；也可在 Supabase Secrets 設定 LINE_ADMIN_USER_IDS"><input className="input" value={notify.line_admin_ids || ""} onChange={(e) => setNotify({ ...notify, line_admin_ids: e.target.value })} /></Field>
        <div className="list mt-2">
          {Object.entries(EVENT_LABELS).map(([k, v]) => (
            <label key={k} className="flex small"><input type="checkbox" checked={notify.enabled?.[k] !== false} onChange={(e) => setNotify({ ...notify, enabled: { ...(notify.enabled || {}), [k]: e.target.checked } })} />{v}</label>
          ))}
        </div>
        <button className="btn mt-3" onClick={save}>儲存</button>
      </div>
    </div>
  );
}

export default function Content() {
  const [tab, setTab] = useState("studio");
  const C = { studio: StudioTab, hero: HeroTab, services: ServicesTab, portfolio: PortfolioTab, categories: CategoriesTab, booking: BookingTab, notify: NotifyTab }[tab];
  return (
    <>
      <div className="admin-head"><div><div className="kicker">Website</div><h1>網站內容</h1><p className="small muted">在這裡修改的內容會立即更新到網站，不需要改程式</p></div></div>
      <div className="tabs">{TABS.map(([k, l]) => <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{l}</button>)}</div>
      <C />
    </>
  );
}
