import { useEffect, useRef, useState } from "react";
import { errMsg, imgUrl, supabase } from "../../lib/supabase";
import { useSite } from "../../lib/site";
import { EVENT_LABELS, priceNote, priceText, resizeImage, TIER_KEYS, TIER_ORDER, TIERS, tierOf, uid, WEEKDAYS } from "../../lib/utils";
import { BulkBar, Confirm, Field, Modal, Spinner, useSelection, useToast } from "../../components/ui";
import { setFrames } from "../../components/StyleShowcase";

const TABS = [["studio", "工作室資訊"], ["hero", "首頁輪播"], ["oneshot", "一拍多風格"], ["categories", "作品分類與分層"], ["portfolio", "作品集"], ["services", "服務與價格"], ["booking", "預約設定"], ["notify", "通知設定"]];

const TierPill = ({ tier }) => <span className={`tier-pill ${tier}`}>{TIERS[tier]?.name}</span>;
const isStoragePath = (p) => p && !/^(https?:|data:|blob:|\/)/.test(p);

/** 分類下拉選單：依 主力→加值→引流→不顯示 分組 */
function CategorySelect({ categories, value, onChange, counts, includeNone }) {
  return (
    <select className="select" value={value} onChange={(e) => onChange(e.target.value)}>
      {includeNone && <option value="">選擇分類…</option>}
      {TIER_KEYS.map((t) => {
        const list = categories.filter((c) => c.tier === t);
        return list.length ? <optgroup key={t} label={`${TIERS[t].name}（${TIERS[t].label || "不在網站顯示"}）`}>{list.map((c) => <option key={c.slug} value={c.slug}>{c.name}{counts ? `（${counts[c.slug] || 0}）` : ""}</option>)}</optgroup> : null;
      })}
    </select>
  );
}

async function saveSetting(key, value, isPublic = true) {
  return supabase.from("settings").upsert({ key, value, is_public: isPublic });
}

export async function uploadPortfolioImage(file) {
  const small = await resizeImage(file, { maxSize: 2000, quality: 0.86 });
  const path = `${uid()}.jpg`;
  const { error } = await supabase.storage.from("portfolio").upload(path, small, { contentType: "image/jpeg", cacheControl: "31536000" });
  if (error) throw error;
  return path;
}

export function ImagePicker({ value, onChange, label = "圖片", hint }) {
  const ref = useRef();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <Field label={label} full hint={hint}>
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
  const load = () => supabase.from("services").select("*").order("sort").then(({ data }) => setRows((data || []).map((r) => ({ ...r, tier: tierOf(r) }))
    .sort((a, b) => TIER_KEYS.indexOf(a.tier) - TIER_KEYS.indexOf(b.tier) || a.sort - b.sort)));
  useEffect(() => { load(); }, []);
  const [del, setDel] = useState(null);
  const doDelete = async () => {
    const { error } = await supabase.from("services").delete().eq("id", del.id);
    setDel(null);
    if (error) return toast(errMsg(error), "err");
    toast("服務已刪除（既有預約與訂單保留）"); load(); reload();
  };
  const save = async () => {
    const row = { ...edit, tier: edit.tier || "entry", price: Number(edit.price) || 0, sort: Number(edit.sort) || 0, features: (edit.featuresText || "").split("\n").map((s) => s.trim()).filter(Boolean) };
    delete row.featuresText; delete row.isNew; delete row.updated_at;
    if (!/^[a-z0-9_-]+$/.test(row.id)) return toast("代碼只能用小寫英文、數字、底線", "err");
    const { error } = edit.isNew ? await supabase.from("services").insert(row) : await supabase.from("services").update(row).eq("id", row.id);
    if (error) return toast(errMsg(error), "err");
    toast("服務已儲存"); setEdit(null); load(); reload();
  };
  if (!rows) return <Spinner />;
  return (
    <>
      <p className="small muted mb-2">網站「服務與價格」頁會依 <b>主力 → 加值 → 引流</b> 分區顯示。價格填 0 會顯示「洽詢報價」。</p>
      <div className="flex mb-2"><button className="btn btn-sm" onClick={() => setEdit({ isNew: true, tier: "entry", id: "", name: "", subtitle: "", description: "", price: 0, price_note: "", duration_label: "", featuresText: "", image: "", featured: false, bookable: true, active: true, sort: rows.length + 1 })}>＋ 新增服務</button></div>
      <div className="table-wrap">
        <table className="tbl">
          <thead><tr><th>分層</th><th>排序</th><th>服務</th><th>價格</th><th>線上預約</th><th>顯示</th><th></th></tr></thead>
          <tbody>{rows.map((s) => (
            <tr key={s.id}>
              <td><TierPill tier={s.tier} /></td>
              <td>{s.sort}</td><td><b>{s.name}</b> <span className="small muted">{s.subtitle}</span>{s.featured && <span className="badge warn" style={{ marginLeft: 6 }}>推薦</span>}</td>
              <td>{priceText(s)}{priceNote(s)}</td><td>{s.bookable ? "✓" : "洽詢"}</td><td>{s.active ? "顯示" : <span className="muted">隱藏</span>}</td>
              <td style={{ whiteSpace: "nowrap" }}><button className="btn btn-ghost btn-sm" onClick={() => setEdit({ ...s, featuresText: (s.features || []).join("\n") })}>編輯</button>{" "}<button className="btn btn-ghost btn-sm btn-del" onClick={() => setDel(s)}>刪除</button></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      {edit && (
        <Modal title={edit.isNew ? "新增服務" : `編輯：${edit.name}`} wide onClose={() => setEdit(null)} actions={<><button className="btn btn-ghost btn-sm" onClick={() => setEdit(null)}>取消</button><button className="btn btn-sm" onClick={save}>儲存</button></>}>
          <div className="form-grid">
            <Field label="分層" full>
              <div className="seg">{TIER_KEYS.map((t) => <button key={t} type="button" className={edit.tier === t ? "on" : ""} onClick={() => setEdit({ ...edit, tier: t })}>{TIERS[t].name}{TIERS[t].label && `・${TIERS[t].label}`}</button>)}</div>
            </Field>
            <Field label="代碼（英文，建立後不可改）"><input className="input" value={edit.id} disabled={!edit.isNew} onChange={(e) => setEdit({ ...edit, id: e.target.value.toLowerCase() })} /></Field>
            <Field label="名稱"><input className="input" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
            <Field label="英文副標"><input className="input" value={edit.subtitle} onChange={(e) => setEdit({ ...edit, subtitle: e.target.value })} /></Field>
            <Field label="拍攝時間"><input className="input" value={edit.duration_label} onChange={(e) => setEdit({ ...edit, duration_label: e.target.value })} /></Field>
            <Field label="價格（數字，0＝洽詢報價）"><input className="input" type="number" value={edit.price} onChange={(e) => setEdit({ ...edit, price: e.target.value })} /></Field>
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
      {del && <Confirm title={`刪除服務「${del.name}」？`} danger confirmText="確定刪除" message="網站上不再顯示此服務。已經成立的預約與訂單會保留原本的服務名稱。只想暫時下架的話，編輯時取消勾選「在網站顯示」即可。" onConfirm={doDelete} onCancel={() => setDel(null)} />}
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
  const [moveTo, setMoveTo] = useState("");
  const addRef = useRef();
  const imgRef = useRef();

  const load = () => supabase.from("portfolio").select("*").order("sort").order("created_at", { ascending: false }).then(({ data }) => setRows(data || []));
  useEffect(() => { load(); }, []);
  const after = () => { load(); reload(); };
  const list = (rows || []).filter((r) => (cat === "__none" ? !categories.some((c) => c.slug === r.category) : r.category === cat));
  const selection = useSelection(list);
  const counts = (rows || []).reduce((m, r) => ({ ...m, [r.category]: (m[r.category] || 0) + 1 }), {});
  const orphans = (rows || []).filter((r) => !categories.some((c) => c.slug === r.category)).length;

  const addWorks = async (files, asOne) => {
    files = files.filter((f) => f.type.startsWith("image/"));
    if (!files.length || cat === "__none") return;
    try {
      const paths = [];
      for (let i = 0; i < files.length; i++) { setBusy(`上傳中 ${i + 1}/${files.length}`); paths.push(await uploadPortfolioImage(files[i])); }
      const base = list.length;
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

  /** 刪除作品（可多件）：連同上傳到雲端的圖片檔 */
  const doDelete = async () => {
    const items = del;
    const paths = items.flatMap((it) => (it.images || []).filter(isStoragePath));
    if (paths.length) await supabase.storage.from("portfolio").remove(paths).catch(() => {});
    const { error } = await supabase.from("portfolio").delete().in("id", items.map((it) => it.id));
    setDel(null); selection.clear();
    if (error) return toast(errMsg(error), "err");
    toast(`已刪除 ${items.length} 件作品`); after();
  };

  const bulkUpdate = async (patch, msg) => {
    const { error } = await supabase.from("portfolio").update(patch).in("id", selection.ids);
    if (error) return toast(errMsg(error), "err");
    toast(msg); selection.clear(); after();
  };

  if (!rows) return <Spinner />;
  const curCat = categories.find((c) => c.slug === cat);
  return (
    <>
      <div className="toolbar">
        <CategorySelect categories={categories} value={cat} onChange={(v) => { setCat(v); selection.clear(); }} counts={counts} />
        {orphans > 0 && <button className={`btn btn-sm ${cat === "__none" ? "" : "btn-ghost"}`} onClick={() => setCat("__none")}>未分類（{orphans}）</button>}
        {curCat && <TierPill tier={curCat.tier} />}
        <button className="btn btn-sm" disabled={!!busy || cat === "__none"} onClick={() => { addRef.current.dataset.one = ""; addRef.current.click(); }}>＋ 上傳作品（一張一件）</button>
        <button className="btn btn-ghost btn-sm" disabled={!!busy || cat === "__none"} onClick={() => { addRef.current.dataset.one = "1"; addRef.current.click(); }}>＋ 多張合成一件作品</button>
        {busy && <span className="small muted">{busy}</span>}
        <input ref={addRef} type="file" accept="image/*" multiple hidden onChange={(e) => { const f = [...e.target.files]; e.target.value = ""; addWorks(f, addRef.current.dataset.one === "1"); }} />
      </div>
      <p className="small muted mb-2">點作品編輯；勾選左上角方框可以一次移動分類、隱藏或刪除。一件作品可放多張照片，網站上會自動輪播。勾選「精選」的作品會優先當分類封面。</p>
      <BulkBar selection={selection} label="件">
        <CategorySelect categories={categories} value={moveTo} onChange={setMoveTo} includeNone />
        <button className="btn btn-ghost btn-sm" disabled={!moveTo} onClick={() => bulkUpdate({ category: moveTo }, "已移動分類")}>移到此分類</button>
        <button className="btn btn-ghost btn-sm" onClick={() => bulkUpdate({ published: false }, "已隱藏")}>隱藏</button>
        <button className="btn btn-ghost btn-sm" onClick={() => bulkUpdate({ published: true }, "已公開")}>公開</button>
        <button className="btn btn-sm btn-danger" onClick={() => setDel(list.filter((r) => selection.has(r.id)))}>刪除所選</button>
      </BulkBar>
      {list.length > 0 && <label className="flex small mb-2"><input type="checkbox" checked={selection.all} onChange={selection.toggleAll} />全選這個分類（{list.length} 件）</label>}
      {list.length === 0 ? <div className="empty">此分類還沒有作品</div> : (
        <div className="thumbs" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}>
          {list.map((p) => (
            <div key={p.id} className={`thumb ${selection.has(p.id) ? "sel" : ""}`} style={{ aspectRatio: "4/5", cursor: "pointer", opacity: p.published ? 1 : 0.55 }} onClick={() => setEdit({ ...p })}>
              <img src={imgUrl(p.images?.[0], "portfolio")} alt={p.title} loading="lazy" />
              <label className="t-check" onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={selection.has(p.id)} onChange={() => selection.toggle(p.id)} aria-label="選取" /></label>
              <span className="t-badge r">{p.images?.length || 0} 張{p.featured ? "・精選" : ""}{p.published ? "" : "・隱藏"}</span>
              <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,.55)", color: "#fff", fontSize: 13.5, padding: "4px 8px" }}>{p.title}</div>
            </div>
          ))}
        </div>
      )}
      {edit && (
        <Modal title="編輯作品" wide onClose={() => setEdit(null)} actions={<>
          <button className="btn btn-ghost btn-sm btn-del" onClick={() => { setDel([edit]); setEdit(null); }}>刪除作品</button>
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
            <Field label="分類"><CategorySelect categories={categories} value={edit.category || ""} onChange={(v) => setEdit({ ...edit, category: v })} includeNone /></Field>
            <Field label="說明（燈箱顯示）" full><input className="input" value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></Field>
            <Field label="排序（數字小的在前）"><input className="input" type="number" value={edit.sort} onChange={(e) => setEdit({ ...edit, sort: e.target.value })} /></Field>
            <Field label="選項"><div className="flex small">
              <label className="flex"><input type="checkbox" checked={edit.featured} onChange={(e) => setEdit({ ...edit, featured: e.target.checked })} />精選（分類封面）</label>
              <label className="flex"><input type="checkbox" checked={edit.published} onChange={(e) => setEdit({ ...edit, published: e.target.checked })} />公開顯示</label>
            </div></Field>
          </div>
        </Modal>
      )}
      {del && <Confirm title={del.length > 1 ? `刪除 ${del.length} 件作品？` : "刪除作品？"} danger confirmText="確定刪除"
        message={del.length > 1 ? `這 ${del.length} 件作品與其中的照片將永久刪除。` : `「${del[0].title}」與其 ${del[0].images?.length || 0} 張照片將永久刪除。`}
        onConfirm={doDelete} onCancel={() => setDel(null)} />}
    </>
  );
}

/* ---------- 作品分類與分層 ---------- */
function CategoriesTab() {
  const { categories, reload } = useSite();
  const toast = useToast();
  const [list, setList] = useState(categories.map((c) => ({ ...c, orig: c.slug })));
  const upd = (i, k, v) => setList((l) => l.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const save = async () => {
    for (const c of list) {
      if (!/^[a-z0-9_-]+$/.test(c.slug) || !c.name.trim()) return toast("代碼只能用小寫英文數字底線，名稱不可空白", "err");
      const row = { slug: c.slug, name: c.name.trim(), sort: Number(c.sort) || 0, tier: c.tier || "addon", name_en: c.name_en || "", description: c.description || "" };
      const { error } = c.orig ? await supabase.from("categories").update(row).eq("slug", c.orig) : await supabase.from("categories").insert(row);
      if (error) return toast(errMsg(error), "err");
    }
    const removed = categories.filter((c) => !list.some((l) => l.orig === c.slug)).map((c) => c.slug);
    if (removed.length) await supabase.from("categories").delete().in("slug", removed);
    toast("分類已更新"); reload();
  };
  return (
    <div className="panel">
      <p className="small muted mb-2">網站的首頁與作品集會依分層排序：<b>一拍多風格 → 主力 → 加值 → 引流</b>。前台顯示給客人的名稱是「典藏藝術肖像／風格加購／入門拍攝」，不會出現「主力、引流」等字眼。選「不顯示」的分類會從網站隱藏。</p>
      {TIER_KEYS.map((t) => {
        const idx = list.map((c, i) => [c, i]).filter(([c]) => (c.tier || "addon") === t);
        return (
          <div key={t} className="mb-3">
            <h3 className="flex" style={{ marginBottom: 10 }}><TierPill tier={t} />{TIERS[t].label || "不在網站顯示"}<span className="small muted">（{idx.length}）</span></h3>
            {idx.length === 0 && <div className="small muted">沒有分類</div>}
            <div className="list">
              {idx.map(([c, i]) => (
                <div key={i} className="flex flex-wrap" style={{ alignItems: "flex-start", paddingBottom: 10, borderBottom: "1px dashed var(--line-2)" }}>
                  <input className="input" style={{ width: 64 }} type="number" value={c.sort} onChange={(e) => upd(i, "sort", e.target.value)} title="排序" />
                  <input className="input" style={{ width: 140 }} value={c.name} placeholder="顯示名稱" onChange={(e) => upd(i, "name", e.target.value)} />
                  <input className="input" style={{ width: 150 }} value={c.name_en || ""} placeholder="英文名稱（選填）" onChange={(e) => upd(i, "name_en", e.target.value)} />
                  <select className="select" style={{ width: "auto" }} value={c.tier || "addon"} onChange={(e) => upd(i, "tier", e.target.value)}>
                    {TIER_KEYS.map((k) => <option key={k} value={k}>{TIERS[k].name}</option>)}
                  </select>
                  <input className="input grow" style={{ minWidth: 220 }} value={c.description || ""} placeholder="一句話說明（首頁分類卡片顯示）" onChange={(e) => upd(i, "description", e.target.value)} />
                  <input className="input" style={{ width: 130 }} value={c.slug} placeholder="代碼 (英文)" title="網址代碼" onChange={(e) => upd(i, "slug", e.target.value.toLowerCase())} />
                  <button className="btn btn-ghost btn-sm btn-del" onClick={() => setList((l) => l.filter((_, j) => j !== i))}>刪除</button>
                </div>
              ))}
            </div>
          </div>
        );
      })}
      <p className="small muted mt-2">刪除分類不會刪除作品，作品會變成「未分類」，可再到「作品集」重新指定或批次刪除。</p>
      <div className="flex mt-2"><button className="btn btn-ghost btn-sm" onClick={() => setList((l) => [...l, { slug: "", name: "", name_en: "", description: "", tier: "addon", sort: l.length + 1 }])}>＋ 新增分類</button><button className="btn btn-sm" onClick={save}>儲存</button></div>
    </div>
  );
}

/* ---------- 一拍多風格 ---------- */
function StyleSetsTab() {
  const { reload } = useSite();
  const toast = useToast();
  const [rows, setRows] = useState(null);
  const [missing, setMissing] = useState(false);
  const [edit, setEdit] = useState(null);
  const [del, setDel] = useState(null);
  const [busy, setBusy] = useState("");
  const addRef = useRef();

  const load = () => supabase.from("style_sets").select("*").order("sort").then(({ data, error }) => { setMissing(!!error); setRows(data || []); });
  useEffect(() => { load(); }, []);

  const addStyles = async (files) => {
    files = files.filter((f) => f.type.startsWith("image/"));
    try {
      const add = [];
      for (let i = 0; i < files.length; i++) { setBusy(`上傳中 ${i + 1}/${files.length}`); add.push({ image: await uploadPortfolioImage(files[i]), label: files[i].name.replace(/\.\w+$/, "") }); }
      setEdit((x) => ({ ...x, styles: [...(x.styles || []), ...add] }));
    } catch (e) { toast(errMsg(e), "err"); }
    setBusy("");
  };
  const updStyle = (i, k, v) => setEdit((x) => ({ ...x, styles: x.styles.map((s, j) => (j === i ? { ...s, [k]: v } : s)) }));
  const moveStyle = (i, d) => setEdit((x) => { const n = [...x.styles]; const [it] = n.splice(i, 1); n.splice(i + d, 0, it); return { ...x, styles: n }; });

  const save = async () => {
    const styles = (edit.styles || []).filter((s) => s.image).map((s) => ({ image: s.image, label: (s.label || "").trim() || "風格" }));
    if (!edit.title.trim()) return toast("請填寫標題", "err");
    if (!styles.length) return toast("至少要有一張風格圖", "err");
    const row = { title: edit.title.trim(), description: edit.description || "", original: edit.original || "", styles, published: !!edit.published, sort: Number(edit.sort) || 0 };
    const { error } = edit.id ? await supabase.from("style_sets").update(row).eq("id", edit.id) : await supabase.from("style_sets").insert(row);
    if (error) return toast(errMsg(error), "err");
    toast("已儲存"); setEdit(null); load(); reload();
  };
  const doDelete = async () => {
    const paths = [del.original, ...(del.styles || []).map((s) => s.image)].filter(isStoragePath);
    if (paths.length) await supabase.storage.from("portfolio").remove(paths).catch(() => {});
    const { error } = await supabase.from("style_sets").delete().eq("id", del.id);
    setDel(null);
    if (error) return toast(errMsg(error), "err");
    toast("已刪除"); load(); reload();
  };

  if (!rows) return <Spinner />;
  if (missing) return <div className="alert alert-warn">資料庫尚未升級：請先在 Supabase → SQL Editor 執行 <b>supabase/03-upgrade.sql</b>，就能在這裡管理一拍多風格作品。目前網站顯示的是內建範例。</div>;
  return (
    <>
      <p className="small muted mb-2">首頁第一區「拍一次，擁有多種藝術風格」。每組放一張<b>原片</b>和多張<b>風格版本</b>，客人可以點縮圖切換比較。這是最能說服客人加購的展示，建議放 3–6 組。</p>
      <div className="flex mb-2"><button className="btn btn-sm" onClick={() => setEdit({ title: "", description: "", original: "", styles: [], published: true, sort: rows.length })}>＋ 新增一組</button></div>
      {rows.length === 0 ? <div className="empty">還沒有一拍多風格作品</div> : (
        <div className="list">
          {rows.map((r) => (
            <div key={r.id} className="row-card" style={{ alignItems: "center", opacity: r.published ? 1 : 0.55 }}>
              <div className="flex" style={{ gap: 4 }}>
                {setFrames(r).slice(0, 6).map((f, k) => <img key={k} src={imgUrl(f.image, "portfolio")} alt="" style={{ width: 48, height: 60, objectFit: "cover", borderRadius: 3, outline: f.original ? "2px solid var(--accent)" : "none" }} />)}
              </div>
              <div className="grow" style={{ minWidth: 200 }}><b>{r.title}</b><div className="small muted">{r.original ? "1 張原片 → " : ""}{(r.styles || []).length} 種風格{r.published ? "" : "・隱藏中"}｜排序 {r.sort}</div></div>
              <div className="flex"><button className="btn btn-ghost btn-sm" onClick={() => setEdit({ ...r, styles: [...(r.styles || [])] })}>編輯</button><button className="btn btn-ghost btn-sm btn-del" onClick={() => setDel(r)}>刪除</button></div>
            </div>
          ))}
        </div>
      )}
      {edit && (
        <Modal title={edit.id ? "編輯一拍多風格" : "新增一拍多風格"} wide onClose={() => setEdit(null)} actions={<><button className="btn btn-ghost btn-sm" onClick={() => setEdit(null)}>取消</button><button className="btn btn-sm" disabled={!!busy} onClick={save}>儲存</button></>}>
          <div className="form-grid">
            <Field label="標題" full><input className="input" value={edit.title} maxLength={60} placeholder="例如：商務形象照，延伸出 7 種藝術風格" onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></Field>
            <Field label="說明（選填）" full><textarea className="textarea" style={{ minHeight: 60 }} value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></Field>
            <ImagePicker label="原片（選填，會標示為「原片」）" value={edit.original} onChange={(v) => setEdit({ ...edit, original: v })} />
          </div>
          <h4 className="mt-3" style={{ fontSize: 15.5 }}>風格版本（{(edit.styles || []).length}）</h4>
          <div className="list mt-1">
            {(edit.styles || []).map((s, i) => (
              <div key={s.image + i} className="flex flex-wrap">
                <img src={imgUrl(s.image, "portfolio")} alt="" style={{ width: 52, height: 64, objectFit: "cover", borderRadius: 3 }} />
                <input className="input grow" style={{ minWidth: 160 }} value={s.label} placeholder="風格名稱，例如：金箔華麗" onChange={(e) => updStyle(i, "label", e.target.value)} />
                <button className="btn btn-ghost btn-sm" disabled={i === 0} onClick={() => moveStyle(i, -1)} aria-label="上移">↑</button>
                <button className="btn btn-ghost btn-sm" disabled={i === edit.styles.length - 1} onClick={() => moveStyle(i, 1)} aria-label="下移">↓</button>
                <button className="btn btn-ghost btn-sm btn-del" onClick={() => setEdit((x) => ({ ...x, styles: x.styles.filter((_, j) => j !== i) }))}>移除</button>
              </div>
            ))}
          </div>
          <button className="drop mt-2" style={{ width: "100%", padding: 18 }} disabled={!!busy} onClick={() => addRef.current.click()}>{busy || "＋ 上傳風格版本（可一次選多張，檔名會變成風格名稱）"}</button>
          <input ref={addRef} type="file" accept="image/*" multiple hidden onChange={(e) => { const f = [...e.target.files]; e.target.value = ""; addStyles(f); }} />
          <div className="form-grid mt-2">
            <Field label="排序（數字小的在前）"><input className="input" type="number" value={edit.sort} onChange={(e) => setEdit({ ...edit, sort: e.target.value })} /></Field>
            <Field label="選項"><label className="flex small"><input type="checkbox" checked={edit.published} onChange={(e) => setEdit({ ...edit, published: e.target.checked })} />在網站顯示</label></Field>
          </div>
        </Modal>
      )}
      {del && <Confirm title="刪除這組一拍多風格？" danger confirmText="確定刪除" message={`「${del.title}」與其中上傳的圖片將永久刪除。`} onConfirm={doDelete} onCancel={() => setDel(null)} />}
    </>
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
  const C = { studio: StudioTab, hero: HeroTab, oneshot: StyleSetsTab, services: ServicesTab, portfolio: PortfolioTab, categories: CategoriesTab, booking: BookingTab, notify: NotifyTab }[tab];
  return (
    <>
      <div className="admin-head"><div><div className="kicker">Website</div><h1>網站內容</h1><p className="small muted">在這裡修改的內容會立即更新到網站，不需要改程式</p></div></div>
      <div className="tabs">{TABS.map(([k, l]) => <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{l}</button>)}</div>
      <C />
    </>
  );
}
