import { useEffect, useMemo, useState } from "react";
import { errMsg, imgUrl, supabase } from "../../lib/supabase";
import { useSite } from "../../lib/site";
import { fmtDateTime } from "../../lib/utils";
import { endsText, PROMO_KINDS, promoStatus, STATUS_LABEL, STATUS_TONE } from "../../lib/promos";
import { BulkBar, Confirm, Field, Modal, Spinner, useSelection, useToast } from "../../components/ui";
import { ImagePicker } from "./Content";

const BLANK = { kind: "offer", title: "", subtitle: "", body: "", image: "", badge: "", code: "", cta_label: "", cta_link: "", service_ids: [], start_at: null, end_at: null, published: false, sort: 0 };

// 常用的檔期範本（只是預填文字，日期與內容請自行調整）
const TEMPLATES = [
  { label: "全家福油畫檔期", kind: "offer", title: "全家福 × 厚塗油畫檔期", subtitle: "拍全家福，最喜歡的一張做成油畫掛畫", badge: "檔期限定", cta_label: "預約全家福", cta_link: "/booking?service=family", body: "活動期間預約全家福拍攝，可加購厚塗油畫風格轉繪與掛畫輸出。\n名額有限，以預約順序為準。" },
  { label: "孕婦寫真加購浮雕", kind: "offer", title: "孕期紀念：寫真＋浮雕版", subtitle: "孕婦寫真加做石膏浮雕或奇幻風格", badge: "加購優惠", cta_label: "看孕婦寫真作品", cta_link: "/portfolio?cat=maternity" },
  { label: "形象照＋一拍多風格", kind: "hero", title: "一張形象照，七種風格", subtitle: "商務形象照加購普普、版畫、素描版本", badge: "新方案", cta_label: "預約形象照", cta_link: "/booking?service=business" },
  { label: "公告列：檔期倒數", kind: "bar", title: "檔期預約開放中，名額有限", subtitle: "", badge: "公告", cta_label: "立即預約", cta_link: "/booking" },
];

const LINK_PRESETS = [
  ["", "自動（有代碼→預約頁並帶入代碼，否則→優惠活動頁）"],
  ["/booking", "線上預約"],
  ["/offers", "優惠活動頁"],
  ["/services", "服務與價格"],
  ["/portfolio?tier=oneshot", "作品集・一拍多風格"],
  ["/portfolio?tier=main", "作品集・典藏藝術肖像"],
];

/** datetime-local 與資料庫時間互轉（以瀏覽器所在時區，也就是台灣時間） */
const toLocal = (ts) => { if (!ts) return ""; const d = new Date(ts); const p = (n) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
const fromLocal = (v) => (v ? new Date(v).toISOString() : null);
const genCode = () => Array.from({ length: 6 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join("");

function period(p) {
  const a = p.start_at ? fmtDateTime(p.start_at) : "立即";
  const b = p.end_at ? fmtDateTime(p.end_at) : "不限";
  return `${a} ～ ${b}`;
}

/** 編輯畫面右側的即時預覽 */
function Preview({ p }) {
  const img = p.image ? imgUrl(p.image, "portfolio") : "";
  if (p.kind === "bar") return (
    <div className="promo-bar" style={{ position: "relative", top: 0, height: 40, borderRadius: 4 }}>
      <div className="promo-bar-link" style={{ padding: "0 12px" }}>{p.badge && <span className="promo-badge">{p.badge}</span>}<span className="promo-bar-text">{p.title || "公告文字"}</span><span className="promo-bar-cta">{p.cta_label || "了解更多"} →</span></div>
    </div>
  );
  if (p.kind === "hero") return (
    <div style={{ position: "relative", aspectRatio: "16/9", background: "#111", borderRadius: 4, overflow: "hidden", color: "#fff" }}>
      {img && <img src={img} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.75 }} />}
      <div style={{ position: "absolute", left: 16, bottom: 16, right: 16, display: "grid", gap: 6 }}>
        {p.badge && <span className="promo-badge" style={{ justifySelf: "start" }}>{p.badge}</span>}
        <b style={{ fontSize: 20, letterSpacing: ".1em" }}>{p.title || "橫幅標題"}</b>
        {p.subtitle && <span style={{ fontSize: 13 }}>{p.subtitle}</span>}
        <span className="btn btn-accent btn-sm" style={{ justifySelf: "start" }}>{p.cta_label || "立即預約"}</span>
      </div>
      {!img && <div className="small" style={{ position: "absolute", top: 12, left: 12, opacity: 0.7 }}>首頁橫幅需要一張橫式大圖</div>}
    </div>
  );
  return (
    <div className="promo-pop" style={{ width: "100%", animation: "none", boxShadow: "none", border: "1px solid var(--line)" }}>
      {img && <img src={img} alt="" />}
      <div className="promo-pop-body">
        {p.badge && <span className="promo-badge">{p.badge}</span>}
        <h3 style={{ fontSize: 18 }}>{p.title || "活動標題"}</h3>
        {p.subtitle && <p className="small">{p.subtitle}</p>}
        {p.code && <div className="promo-code">代碼 <b>{p.code}</b></div>}
        <span className="btn btn-sm btn-accent">{p.cta_label || "立即預約"}</span>
      </div>
    </div>
  );
}

function Editor({ value, services, onClose, onSaved }) {
  const toast = useToast();
  const [p, setP] = useState(value);
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setP((x) => ({ ...x, [k]: v }));
  const save = async () => {
    if (!p.title.trim()) return toast("請填寫標題", "err");
    if (p.kind === "hero" && !p.image) return toast("首頁橫幅需要上傳一張圖片", "err");
    if (p.start_at && p.end_at && new Date(p.end_at) <= new Date(p.start_at)) return toast("結束時間要晚於開始時間", "err");
    const code = (p.code || "").trim().toUpperCase();
    if (code && !/^[A-Z0-9_-]{3,20}$/.test(code)) return toast("優惠代碼請用 3–20 個英文字母或數字", "err");
    const row = {
      kind: p.kind, title: p.title.trim(), subtitle: p.subtitle || "", body: p.body || "", image: p.image || "", badge: p.badge || "", code,
      cta_label: p.cta_label || "", cta_link: (p.cta_link || "").trim(), service_ids: p.service_ids || [], start_at: p.start_at, end_at: p.end_at,
      published: !!p.published, sort: Number(p.sort) || 0,
    };
    setBusy(true);
    const { error } = p.id ? await supabase.from("promotions").update(row).eq("id", p.id) : await supabase.from("promotions").insert(row);
    setBusy(false);
    if (error) return toast(/promotions_code_uq|duplicate/.test(error.message) ? "這個優惠代碼已被其他活動使用" : errMsg(error), "err");
    toast(p.id ? "活動已更新" : "活動已建立"); onSaved();
  };
  const status = promoStatus(p);

  return (
    <Modal title={p.id ? `編輯：${value.title}` : "新增活動"} wide onClose={onClose} actions={<>
      <label className="flex small"><button type="button" className={`switch ${p.published ? "on" : ""}`} onClick={() => set("published", !p.published)} aria-label="上架" />{p.published ? "上架" : "草稿（未上架）"}</label>
      <span className="grow" />
      <button className="btn btn-ghost btn-sm" onClick={onClose}>取消</button>
      <button className="btn btn-sm" disabled={busy} onClick={save}>{busy ? "儲存中…" : "儲存"}</button>
    </>}>
      {!p.id && (
        <div className="flex flex-wrap mb-2 small"><span className="muted">快速範本：</span>{TEMPLATES.map((t) => (
          <button key={t.label} className="chip" onClick={() => setP((x) => ({ ...x, ...t, label: undefined }))}>{t.label}</button>
        ))}</div>
      )}
      <Field label="版位" full>
        <div className="seg" style={{ flexWrap: "wrap" }}>{Object.entries(PROMO_KINDS).map(([k, v]) => <button key={k} type="button" className={p.kind === k ? "on" : ""} onClick={() => set("kind", k)}>{v.name}</button>)}</div>
        <span className="hint">{PROMO_KINDS[p.kind].desc}</span>
      </Field>
      <div className="two-col mt-2" style={{ alignItems: "start" }}>
        <div className="form-grid">
          <Field label="標題" full><input className="input" value={p.title} maxLength={60} onChange={(e) => set("title", e.target.value)} /></Field>
          <Field label="副標（選填）" full><input className="input" value={p.subtitle} maxLength={100} onChange={(e) => set("subtitle", e.target.value)} /></Field>
          <Field label="角標（選填）" hint="例如：限時、檔期限定"><input className="input" value={p.badge} maxLength={12} onChange={(e) => set("badge", e.target.value)} /></Field>
          <Field label="優惠代碼（選填）" hint="客人預約時會自動帶入備註">
            <div className="flex"><input className="input" value={p.code} maxLength={20} placeholder="例如 XMAS26" onChange={(e) => set("code", e.target.value.toUpperCase())} /><button type="button" className="btn btn-ghost btn-sm" onClick={() => set("code", genCode())}>產生</button></div>
          </Field>
          {p.kind !== "bar" && <ImagePicker value={p.image} onChange={(v) => set("image", v)} label={p.kind === "hero" ? "橫幅大圖（必填，建議橫式 1800px 以上）" : "圖片（選填）"} />}
          {p.kind === "offer" && <Field label="活動詳情（優惠活動頁顯示）" full><textarea className="textarea" value={p.body} maxLength={1000} onChange={(e) => set("body", e.target.value)} /></Field>}
          <Field label="按鈕文字"><input className="input" value={p.cta_label} maxLength={16} placeholder="立即預約" onChange={(e) => set("cta_label", e.target.value)} /></Field>
          <Field label="按鈕連到">
            <select className="select" value={LINK_PRESETS.some(([v]) => v === p.cta_link) ? p.cta_link : "__custom"} onChange={(e) => set("cta_link", e.target.value === "__custom" ? "/booking?service=" : e.target.value)}>
              {LINK_PRESETS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              {services.filter((s) => s.bookable).map((s) => <option key={s.id} value={`/booking?service=${s.id}`}>預約：{s.name}</option>)}
              <option value="__custom">自訂網址…</option>
            </select>
          </Field>
          {!LINK_PRESETS.some(([v]) => v === p.cta_link) && !services.some((s) => `/booking?service=${s.id}` === p.cta_link) && (
            <Field label="自訂網址" full hint="站內路徑（/booking?service=portrait）或完整網址（https://…）"><input className="input" value={p.cta_link} onChange={(e) => set("cta_link", e.target.value)} /></Field>
          )}
          <Field label="開始時間" hint="空白＝上架後立即開始"><input className="input" type="datetime-local" value={toLocal(p.start_at)} onChange={(e) => set("start_at", fromLocal(e.target.value))} /></Field>
          <Field label="結束時間" hint="時間到自動下架；空白＝不會自動結束"><input className="input" type="datetime-local" value={toLocal(p.end_at)} onChange={(e) => set("end_at", fromLocal(e.target.value))} /></Field>
          {p.kind === "offer" && (
            <Field label="適用服務（服務頁會標示「優惠中」）" full>
              <div className="flex flex-wrap small">{services.filter((s) => s.tier !== "hidden").map((s) => (
                <label key={s.id} className="flex"><input type="checkbox" checked={(p.service_ids || []).includes(s.id)} onChange={(e) => set("service_ids", e.target.checked ? [...(p.service_ids || []), s.id] : p.service_ids.filter((x) => x !== s.id))} />{s.name}</label>
              ))}</div>
            </Field>
          )}
          <Field label="排序（數字小的在前）"><input className="input" type="number" value={p.sort} onChange={(e) => set("sort", e.target.value)} /></Field>
        </div>
        <div className="promo-preview">
          <div className="small muted mb-1">預覽｜<span className={`badge ${STATUS_TONE[status]}`}>{STATUS_LABEL[status]}</span></div>
          <Preview p={p} />
        </div>
      </div>
    </Modal>
  );
}

export default function Marketing() {
  const toast = useToast();
  const { services, reload } = useSite();
  const [rows, setRows] = useState(null);
  const [missing, setMissing] = useState(false);
  const [view, setView] = useState("all");
  const [kind, setKind] = useState("all");
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState(null);
  const [del, setDel] = useState(null);
  const [usage, setUsage] = useState({});

  const load = async () => {
    const { data, error } = await supabase.from("promotions").select("*").order("sort").order("created_at", { ascending: false });
    setMissing(!!error); setRows(data || []);
    // 統計每個優惠代碼被用在幾筆預約（從預約備註的【優惠 代碼｜…】辨識）
    const { data: bk } = await supabase.from("bookings").select("note,status").ilike("note", "%【優惠 %").limit(5000);
    const m = {};
    (bk || []).forEach((b) => { const c = /【優惠 ([A-Z0-9_-]+)/.exec(b.note || "")?.[1]; if (c && b.status !== "已取消") m[c] = (m[c] || 0) + 1; });
    setUsage(m);
  };
  useEffect(() => { load(); }, []);
  const after = () => { load(); reload(); window.dispatchEvent(new Event("gime:promos")); };

  const counts = useMemo(() => (rows || []).reduce((m, p) => ({ ...m, [promoStatus(p)]: (m[promoStatus(p)] || 0) + 1 }), {}), [rows]);
  const list = useMemo(() => (rows || []).filter((p) => {
    if (view !== "all" && promoStatus(p) !== view) return false;
    if (kind !== "all" && p.kind !== kind) return false;
    if (!q) return true;
    return [p.title, p.subtitle, p.code].some((v) => (v || "").toLowerCase().includes(q.toLowerCase()));
  }), [rows, view, kind, q]);
  const selection = useSelection(list);

  const toggle = async (p) => {
    const { error } = await supabase.from("promotions").update({ published: !p.published }).eq("id", p.id);
    if (error) return toast(errMsg(error), "err");
    toast(p.published ? "已下架" : promoStatus({ ...p, published: true }) === "scheduled" ? "已上架，會在開始時間自動顯示" : "已上架"); after();
  };
  const bulk = async (patch, msg) => {
    const { error } = await supabase.from("promotions").update(patch).in("id", selection.ids);
    if (error) return toast(errMsg(error), "err");
    toast(msg); selection.clear(); after();
  };
  const doDelete = async () => {
    const { error } = await supabase.from("promotions").delete().in("id", del.map((p) => p.id));
    setDel(null); selection.clear();
    if (error) return toast(errMsg(error), "err");
    toast(`已刪除 ${del.length} 個活動`); after();
  };
  const duplicate = (p) => setEdit({ ...p, id: undefined, title: `${p.title}（複製）`, code: "", published: false, clicks: 0 });

  if (missing) return (
    <>
      <div className="admin-head"><div><div className="kicker">Marketing</div><h1>行銷管理</h1></div></div>
      <div className="alert alert-warn">資料庫尚未升級：請先在 Supabase → SQL Editor 執行 <b>supabase/04-marketing.sql</b>，就能開始建立首頁橫幅與優惠活動。</div>
    </>
  );

  return (
    <>
      <div className="admin-head">
        <div><div className="kicker">Marketing</div><h1>行銷管理</h1><p className="small muted">首頁橫幅、公告列、優惠活動、彈出視窗。設定開始與結束時間，系統會自動上下架。</p></div>
        <button className="btn btn-sm" onClick={() => setEdit({ ...BLANK })}>＋ 新增活動</button>
      </div>
      <div className="toolbar">
        <div className="seg">
          {[["all", "全部"], ["live", "進行中"], ["scheduled", "排程中"], ["draft", "草稿"], ["ended", "已結束"]].map(([k, l]) => (
            <button key={k} className={view === k ? "on" : ""} onClick={() => setView(k)}>{l}{k !== "all" && counts[k] ? `（${counts[k]}）` : ""}</button>
          ))}
        </div>
        <select className="select" value={kind} onChange={(e) => setKind(e.target.value)}><option value="all">所有版位</option>{Object.entries(PROMO_KINDS).map(([k, v]) => <option key={k} value={k}>{v.name}</option>)}</select>
        <input className="input" placeholder="搜尋標題／代碼" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <BulkBar selection={selection} label="個">
        <button className="btn btn-ghost btn-sm" onClick={() => bulk({ published: true }, "已上架")}>上架</button>
        <button className="btn btn-ghost btn-sm" onClick={() => bulk({ published: false }, "已下架")}>下架</button>
        <button className="btn btn-sm btn-danger" onClick={() => setDel(list.filter((p) => selection.has(p.id)))}>刪除所選</button>
      </BulkBar>
      {!rows ? <Spinner /> : list.length === 0 ? (
        <div className="empty">{rows.length ? "沒有符合的活動" : "還沒有任何活動。按「＋ 新增活動」，可以從範本開始。"}</div>
      ) : (
        <div className="list">
          {list.length > 1 && <label className="flex small"><input type="checkbox" checked={selection.all} onChange={selection.toggleAll} />全選（{list.length}）</label>}
          {list.map((p) => {
            const st = promoStatus(p);
            return (
              <div key={p.id} className={`promo-row ${selection.has(p.id) ? "sel" : ""}`}>
                <input type="checkbox" checked={selection.has(p.id)} onChange={() => selection.toggle(p.id)} aria-label="選取" />
                {p.image ? <img src={imgUrl(p.image, "portfolio")} alt="" /> : <div className="ph">{PROMO_KINDS[p.kind]?.name}</div>}
                <div style={{ minWidth: 0 }}>
                  <div className="flex flex-wrap" style={{ gap: 8 }}>
                    <b>{p.title}</b>
                    <span className={`badge ${STATUS_TONE[st]}`}>{STATUS_LABEL[st]}</span>
                    <span className="badge">{PROMO_KINDS[p.kind]?.name}</span>
                    {p.badge && <span className="promo-badge">{p.badge}</span>}
                  </div>
                  <div className="meta">
                    <span>{period(p)}{st === "live" && endsText(p) ? `（${endsText(p)}）` : ""}</span>
                    {p.code && <span>代碼 <b style={{ color: "var(--accent)" }}>{p.code}</b>｜預約 {usage[p.code] || 0} 筆</span>}
                    <span>點擊 {p.clicks || 0}</span>
                  </div>
                </div>
                <div className="acts">
                  <button className={`switch ${p.published ? "on" : ""}`} onClick={() => toggle(p)} aria-label={p.published ? "下架" : "上架"} title={p.published ? "點擊下架" : "點擊上架"} />
                  <button className="btn btn-ghost btn-sm" onClick={() => setEdit({ ...p })}>編輯</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => duplicate(p)}>複製</button>
                  <button className="btn btn-ghost btn-sm btn-del" onClick={() => setDel([p])}>刪除</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <div className="alert alert-info small mt-3" style={{ lineHeight: 1.9 }}>
        ・<b>上架開關</b>打開後，活動會在「開始時間」自動出現、「結束時間」自動消失；關掉就是草稿。<br />
        ・客人點活動按鈕會記錄<b>點擊數</b>；用優惠代碼預約時，預約備註會出現「【優惠 代碼｜活動名稱】」，這裡會統計<b>預約筆數</b>（不含已取消）。<br />
        ・優惠代碼只是標記，<b>不會自動改價</b>。請在訂單頁依活動內容調整金額。
      </div>
      {edit && <Editor key={edit.id || "new"} value={edit} services={services} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); after(); }} />}
      {del && <Confirm title={del.length > 1 ? `刪除 ${del.length} 個活動？` : `刪除「${del[0].title}」？`} danger confirmText="確定刪除"
        message="活動會從網站與後台移除，點擊數也會一起刪除。只想暫停的話，把上架開關關掉即可。已經用這個代碼成立的預約不受影響。"
        onConfirm={doDelete} onCancel={() => setDel(null)} />}
    </>
  );
}
