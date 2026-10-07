import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { errMsg, supabase } from "../lib/supabase";
import { fmtDate, money, normPhone } from "../lib/utils";
import { Field, PageHero, PasswordField, Spinner, StatusBadge, useTitle, useToast } from "../components/ui";

function AuthForms() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const [mode, setMode] = useState("login");
  const [f, setF] = useState({ email: "", password: "", confirm: "", name: "", phone: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState("");
  const set = (k, v) => { setF((x) => ({ ...x, [k]: v })); setErr(""); };
  const next = params.get("next");

  const login = async () => {
    setBusy(true); setErr("");
    const { error } = await supabase.auth.signInWithPassword({ email: f.email.trim(), password: f.password });
    setBusy(false);
    if (error) return setErr(errMsg(error));
    if (next) nav(next);
  };

  const register = async () => {
    if (!f.name.trim()) return setErr("請填寫姓名");
    const p = normPhone(f.phone);
    if (p.length < 8) return setErr("請填寫正確的電話");
    if (f.password.length < 6) return setErr("密碼至少需要 6 個字元");
    if (f.password !== f.confirm) return setErr("兩次輸入的密碼不一致");
    setBusy(true); setErr("");
    const { data, error } = await supabase.auth.signUp({
      email: f.email.trim(), password: f.password,
      options: { data: { name: f.name.trim(), phone: f.phone.trim() }, emailRedirectTo: `${window.location.origin}/member` },
    });
    setBusy(false);
    if (error) return setErr(errMsg(error));
    if (!data.session) setNotice(`驗證信已寄至 ${f.email}，請點擊信中連結完成註冊後再登入。`);
  };

  const forgot = async () => {
    if (!f.email.trim()) return setErr("請先輸入 Email");
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(f.email.trim(), { redirectTo: `${window.location.origin}/member?reset=1` });
    setBusy(false);
    if (error) return setErr(errMsg(error));
    setNotice("重設密碼信已寄出，請至信箱點擊連結。");
  };

  return (
    <div className="card auth-box">
      <div className="tabs">
        <button className={mode === "login" ? "on" : ""} onClick={() => { setMode("login"); setNotice(""); }}>會員登入</button>
        <button className={mode === "register" ? "on" : ""} onClick={() => { setMode("register"); setNotice(""); }}>註冊新會員</button>
      </div>
      {notice ? <div className="alert alert-ok">{notice}</div> : (
        <div className="form-grid" style={{ gridTemplateColumns: "1fr" }}>
          {mode === "register" && (
            <>
              <Field label="姓名"><input className="input" value={f.name} maxLength={40} onChange={(e) => set("name", e.target.value)} autoComplete="name" /></Field>
              <Field label="電話" hint="若曾預約過，請填相同電話以自動帶入紀錄"><input className="input" value={f.phone} inputMode="tel" maxLength={20} onChange={(e) => set("phone", e.target.value)} autoComplete="tel" /></Field>
            </>
          )}
          <Field label="Email"><input className="input" type="email" value={f.email} maxLength={120} onChange={(e) => set("email", e.target.value)} autoComplete="email" /></Field>
          <Field label="密碼"><PasswordField value={f.password} onChange={(v) => set("password", v)} autoComplete={mode === "login" ? "current-password" : "new-password"} onEnter={mode === "login" ? login : undefined} /></Field>
          {mode === "register" && <Field label="確認密碼"><PasswordField value={f.confirm} onChange={(v) => set("confirm", v)} autoComplete="new-password" onEnter={register} /></Field>}
          {err && <div className="alert alert-err">{err}</div>}
          <button className="btn" disabled={busy} onClick={mode === "login" ? login : register}>{busy ? "處理中…" : mode === "login" ? "登入" : "註冊"}</button>
          {mode === "login" && <button className="btn-link small" onClick={forgot}>忘記密碼？</button>}
          <p className="small muted center">不想註冊？也可以直接用 <Link className="btn-link" to="/gallery">訂單編號＋電話</Link> 選片</p>
        </div>
      )}
    </div>
  );
}

function ResetPassword({ onDone }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const toast = useToast();
  const save = async () => {
    if (pw.length < 6) return setErr("密碼至少需要 6 個字元");
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) return setErr(errMsg(error));
    toast("密碼已更新");
    onDone();
  };
  return (
    <div className="card auth-box">
      <h3 className="title-md mb-2">設定新密碼</h3>
      <PasswordField value={pw} onChange={setPw} autoComplete="new-password" onEnter={save} />
      {err && <div className="alert alert-err mt-1">{err}</div>}
      <button className="btn mt-2" onClick={save}>儲存新密碼</button>
    </div>
  );
}

function MemberCenter() {
  const { user, customer, setCustomer, signOut } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState("bookings");
  const [bookings, setBookings] = useState(null);
  const [orders, setOrders] = useState([]);
  const [albums, setAlbums] = useState([]);
  const [linkErr, setLinkErr] = useState("");
  const [edit, setEdit] = useState(null);
  const [saving, setSaving] = useState(false);

  // 首次登入：連結或建立客戶資料
  useEffect(() => {
    if (customer || !user) return;
    const meta = user.user_metadata || {};
    supabase.rpc("member_link", { p_name: meta.name || "", p_phone: meta.phone || "" }).then(({ data, error }) => {
      if (error) setLinkErr(errMsg(error)); else setCustomer(data);
    });
  }, [customer, user, setCustomer]);

  useEffect(() => {
    if (!customer) return;
    Promise.all([
      supabase.from("bookings").select("*").order("date", { ascending: false }),
      supabase.from("orders").select("*").order("created_at", { ascending: false }),
      supabase.from("albums").select("id, order_id, title"),
    ]).then(([b, o, a]) => { setBookings(b.data || []); setOrders(o.data || []); setAlbums(a.data || []); });
  }, [customer]);

  const saveProfile = async () => {
    setSaving(true);
    const { data, error } = await supabase.rpc("member_update_profile", { p_name: edit.name, p_phone: edit.phone, p_line_id: edit.line_id || "" });
    setSaving(false);
    if (error) return toast(errMsg(error), "err");
    setCustomer(data); setEdit(null); toast("資料已更新");
  };

  if (linkErr) return <div className="card auth-box"><div className="alert alert-err">{linkErr}</div><button className="btn btn-ghost mt-2" onClick={signOut}>登出</button></div>;
  if (!customer) return <Spinner />;

  const total = orders.filter((o) => o.status !== "已取消").reduce((s, o) => s + (o.amount || 0), 0);
  return (
    <div>
      <div className="flex between flex-wrap mb-3">
        <div>
          <div className="eyebrow">Welcome back</div>
          <h2 className="title-md">{customer.name}，您好</h2>
          <p className="small muted">累計預約 {bookings?.length ?? 0} 次｜累計消費 {money(total)}</p>
        </div>
        <div className="flex"><Link className="btn btn-sm" to="/booking">新增預約</Link><button className="btn btn-ghost btn-sm" onClick={signOut}>登出</button></div>
      </div>
      <div className="tabs">
        <button className={tab === "bookings" ? "on" : ""} onClick={() => setTab("bookings")}>我的預約</button>
        <button className={tab === "orders" ? "on" : ""} onClick={() => setTab("orders")}>訂單與相簿</button>
        <button className={tab === "profile" ? "on" : ""} onClick={() => setTab("profile")}>個人資料</button>
      </div>

      {tab === "bookings" && (bookings === null ? <Spinner /> : bookings.length === 0 ? <div className="empty">還沒有預約紀錄</div> : (
        <div className="list">
          {bookings.map((b) => (
            <div key={b.id} className="row-card">
              <div><b>{b.service_name}</b><div className="small muted">{fmtDate(b.date)} {b.time}｜{b.id}</div></div>
              <StatusBadge status={b.status} />
            </div>
          ))}
        </div>
      ))}

      {tab === "orders" && (orders.length === 0 ? <div className="empty">還沒有訂單</div> : (
        <div className="list">
          {orders.map((o) => {
            const album = albums.find((a) => a.order_id === o.id);
            return (
              <div key={o.id} className="row-card">
                <div><b>{o.service_name}</b><div className="small muted">{o.id}｜{fmtDate(o.date)}｜{money(o.amount)}</div></div>
                <div className="flex"><StatusBadge status={o.status} />{album && <Link className="btn btn-sm" to={`/gallery?order=${o.id}`}>{o.status === "已完成" ? "下載照片" : "查看相簿"}</Link>}</div>
              </div>
            );
          })}
        </div>
      ))}

      {tab === "profile" && (
        <div className="card" style={{ maxWidth: 560 }}>
          {edit ? (
            <div className="form-grid" style={{ gridTemplateColumns: "1fr" }}>
              <Field label="姓名"><input className="input" value={edit.name} maxLength={40} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
              <Field label="電話"><input className="input" value={edit.phone} maxLength={20} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} /></Field>
              <Field label="LINE ID"><input className="input" value={edit.line_id || ""} maxLength={60} onChange={(e) => setEdit({ ...edit, line_id: e.target.value })} /></Field>
              <div className="flex"><button className="btn btn-sm" disabled={saving} onClick={saveProfile}>{saving ? "儲存中…" : "儲存"}</button><button className="btn btn-ghost btn-sm" onClick={() => setEdit(null)}>取消</button></div>
            </div>
          ) : (
            <>
              <dl style={{ display: "grid", gridTemplateColumns: "90px 1fr", gap: 10 }}>
                <dt className="muted">姓名</dt><dd style={{ margin: 0 }}>{customer.name}</dd>
                <dt className="muted">電話</dt><dd style={{ margin: 0 }}>{customer.phone || "—"}</dd>
                <dt className="muted">Email</dt><dd style={{ margin: 0 }}>{user.email}<div className="small muted">登入帳號，如需更改請聯繫工作室</div></dd>
                <dt className="muted">LINE ID</dt><dd style={{ margin: 0 }}>{customer.line_id || "—"}</dd>
                <dt className="muted">LINE 通知</dt><dd style={{ margin: 0 }}>{customer.line_user_id ? "已綁定 ✅" : "尚未綁定（加入官方帳號後傳送「綁定 預約編號 電話」）"}</dd>
              </dl>
              <button className="btn btn-ghost btn-sm mt-3" onClick={() => setEdit({ name: customer.name, phone: customer.phone, line_id: customer.line_id })}>編輯資料</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function Member() {
  useTitle("會員中心");
  const { user, isAdmin, ready } = useAuth();
  const [params, setParams] = useSearchParams();
  const resetting = params.get("reset") === "1";
  return (
    <>
      <PageHero eyebrow="Member" title={user ? "會員中心" : "會員登入"} />
      <section className="section-tight">
        <div className="wrap">
          {!ready ? <Spinner /> : resetting && user ? <ResetPassword onDone={() => setParams({})} /> : !user ? <AuthForms /> : isAdmin ? (
            <div className="card auth-box center">
              <p>您目前以管理員身分登入。</p>
              <Link className="btn mt-2" to="/admin">前往營運中心</Link>
            </div>
          ) : <MemberCenter />}
        </div>
      </section>
    </>
  );
}
