import { useEffect, useState } from "react";
import { Link, NavLink, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "../../lib/auth";
import { errMsg, supabase } from "../../lib/supabase";
import { Field, PasswordField, Spinner, useTitle, useToast } from "../../components/ui";
import Dashboard from "./Dashboard";
import Bookings from "./Bookings";
import Orders, { OrderDetail } from "./Orders";
import Customers from "./Customers";
import Notifications from "./Notifications";
import Content from "./Content";
import AuditLogs from "./AuditLogs";

function AdminLogin() {
  const { user, signOut } = useAuth();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const login = async () => {
    setBusy(true); setErr("");
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pw });
    setBusy(false);
    if (error) setErr(errMsg(error));
  };
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--ink)", padding: 16 }}>
      <div className="card" style={{ width: "100%", maxWidth: 400 }}>
        <div className="brand mb-3"><span className="brand-zh">即美創畫攝影</span><span className="brand-en">GIME STUDIO • 工作室後台</span></div>
        {user ? (
          <>
            <div className="alert alert-err">此帳號（{user.email}）沒有管理員權限。</div>
            <button className="btn btn-ghost mt-2" onClick={signOut}>登出並換帳號</button>
          </>
        ) : (
          <div className="form-grid" style={{ gridTemplateColumns: "1fr" }}>
            <Field label="管理員 Email"><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" /></Field>
            <Field label="密碼"><PasswordField value={pw} onChange={setPw} onEnter={login} /></Field>
            {err && <div className="alert alert-err">{err}</div>}
            <button className="btn" disabled={busy} onClick={login}>{busy ? "登入中…" : "登入後台"}</button>
          </div>
        )}
        <Link to="/" className="small muted" style={{ display: "block", marginTop: 18, textAlign: "center" }}>← 回網站首頁</Link>
      </div>
    </div>
  );
}

export default function Admin() {
  useTitle("工作室後台");
  const { ready, user, isAdmin, role, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(0);
  const loc = useLocation();
  const toast = useToast();
  const logout = async () => { await signOut(); toast("已登出"); };

  useEffect(() => { setOpen(false); }, [loc.pathname]);
  useEffect(() => {
    if (!isAdmin) return;
    const load = () => supabase.from("notifications").select("id", { count: "exact", head: true })
      .eq("processed", false).or("audience.eq.studio,status.eq.failed")
      .then(({ count }) => setPending(count || 0));
    load();
    const t = setInterval(load, 60000);
    window.addEventListener("gime:notifications", load);
    return () => { clearInterval(t); window.removeEventListener("gime:notifications", load); };
  }, [isAdmin]);

  if (!ready || (user && role === null)) return <Spinner />;
  if (!isAdmin) return <AdminLogin />;

  const links = [
    ["/admin", "營運中心", true],
    ["/admin/bookings", "預約管理"],
    ["/admin/orders", "訂單／選片交件"],
    ["/admin/customers", "客戶管理"],
    ["/admin/notifications", "通知中心", false, pending],
    ["/admin/content", "網站內容"],
    ["/admin/audit", "變更紀錄"],
  ];

  return (
    <div className="admin">
      <div className="admin-top">
        <button onClick={() => setOpen(true)} style={{ background: "none", border: 0, color: "#fff", fontSize: 22 }} aria-label="選單">☰</button>
        <b style={{ letterSpacing: ".2em" }}>GIME 後台</b>
        <span className="flex" style={{ gap: 14, fontSize: 14.5 }}><Link to="/">網站</Link><button onClick={logout} style={{ background: "none", border: "1px solid rgba(255,255,255,.5)", color: "#fff", borderRadius: 4, padding: "3px 10px", fontSize: 14.5 }}>登出</button></span>
      </div>
      <aside className={`admin-side ${open ? "open" : ""}`}>
        <Link to="/" className="brand"><span className="brand-zh">即美創畫攝影</span><span className="brand-en">GIME STUDIO • ADMIN</span></Link>
        {links.map(([to, label, end, count]) => (
          <NavLink key={to} to={to} end={end}>{label}{count > 0 && <span className="count">{count}</span>}</NavLink>
        ))}
        <div className="foot">
          <span style={{ wordBreak: "break-all" }}>{user.email}</span>
          <Link to="/">← 查看網站</Link>
          <button className="side-logout" onClick={logout}>登出</button>
        </div>
      </aside>
      {open && <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", zIndex: 55 }} />}
      <main className="admin-main">
        <Routes>
          <Route index element={<Dashboard />} />
          <Route path="bookings" element={<Bookings />} />
          <Route path="orders" element={<Orders />} />
          <Route path="orders/:id" element={<OrderDetail />} />
          <Route path="customers" element={<Customers />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="content" element={<Content />} />
          <Route path="audit" element={<AuditLogs />} />
        </Routes>
      </main>
    </div>
  );
}
