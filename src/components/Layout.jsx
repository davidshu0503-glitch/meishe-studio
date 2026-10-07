import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useToast } from "./ui";
import { useSite } from "../lib/site";
import { useAuth } from "../lib/auth";

function Header() {
  const { pathname } = useLocation();
  const { studio } = useSite();
  const { user, isAdmin, signOut } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const logout = async () => { await signOut(); toast("已登出管理員"); navigate("/"); };
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const transparentTop = pathname === "/";

  useEffect(() => {
    const f = () => setScrolled(window.scrollY > 40);
    f();
    window.addEventListener("scroll", f, { passive: true });
    return () => window.removeEventListener("scroll", f);
  }, []);
  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => { document.body.style.overflow = open ? "hidden" : ""; }, [open]);

  const solid = !transparentTop || scrolled || open;
  return (
    <>
      <header className={`header ${solid ? "solid" : ""}`} style={isAdmin ? { top: 34 } : undefined}>
        <div className="wrap">
          <Link to="/" className="brand" aria-label="回首頁">
            <span className="brand-zh">{studio.name}</span>
            <span className="brand-en">{studio.name_en} • {studio.tagline}</span>
          </Link>
          <button className="nav-toggle" onClick={() => setOpen((o) => !o)} aria-label="選單" aria-expanded={open}>
            <span /><span /><span />
          </button>
          <nav className={`nav ${open ? "open" : ""}`}>
            <NavLink to="/portfolio">作品集</NavLink>
            <NavLink to="/services">服務與價格</NavLink>
            <NavLink to="/about">關於我們</NavLink>
            <NavLink to="/gallery" className="nav-sub">選片／交件</NavLink>
            <NavLink to="/member" className="nav-sub">{user && !isAdmin ? "會員中心" : "會員登入"}</NavLink>
            <Link to="/booking" className="btn">線上預約</Link>
          </nav>
        </div>
      </header>
      {isAdmin && (
        <div className="admin-strip" style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 51 }}>
          <div className="wrap">
            <b>管理員模式</b>
            <Link to="/admin">營運中心</Link>
            <Link to="/admin/bookings">預約</Link>
            <Link to="/admin/orders">訂單</Link>
            <Link to="/admin/content">網站內容</Link>
            <button className="strip-logout" onClick={logout}>登出</button>
          </div>
        </div>
      )}
    </>
  );
}

function Footer() {
  const { studio } = useSite();
  return (
    <footer className="footer">
      <div className="wrap">
        <div className="footer-cta">
          <div className="eyebrow">Book your session</div>
          <h2>預約您的拍攝時段</h2>
          <p>線上即時查看空檔，送出後立即取得預約編號</p>
          <Link to="/booking" className="btn btn-light">立即預約拍攝</Link>
        </div>
        <div className="footer-grid">
          <div>
            <div className="brand" style={{ color: "#fff", marginBottom: 16 }}>
              <span className="brand-zh">{studio.name}</span>
              <span className="brand-en">{studio.name_en} • {studio.tagline}</span>
            </div>
            <p className="small" style={{ lineHeight: 2, maxWidth: 380 }}>{studio.slogan}</p>
          </div>
          <div>
            <h4>聯絡資訊</h4>
            <div className="links">
              {studio.phone && <a href={`tel:${studio.phone.replace(/[^\d+]/g, "")}`}>電話　{studio.phone}</a>}
              {studio.email && <a href={`mailto:${studio.email}`}>Email　{studio.email}</a>}
              {studio.address && <span>地址　{studio.address}</span>}
              {studio.hours && <span>時間　{studio.hours}</span>}
            </div>
          </div>
          <div>
            <h4>快速連結</h4>
            <div className="links">
              <Link to="/booking">線上預約</Link>
              <Link to="/gallery">線上選片／交件</Link>
              <Link to="/member">會員中心</Link>
              {studio.line_url && <a href={studio.line_url} target="_blank" rel="noreferrer">LINE 官方帳號</a>}
              {studio.instagram && <a href={studio.instagram} target="_blank" rel="noreferrer">Instagram</a>}
              {studio.facebook && <a href={studio.facebook} target="_blank" rel="noreferrer">Facebook</a>}
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} {studio.name} {studio.name_en}. All rights reserved.</span>
          <Link to="/admin" style={{ opacity: 0.6 }}>工作室後台</Link>
        </div>
      </div>
    </footer>
  );
}

export default function Layout() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return (
    <>
      <Header />
      <main><Outlet /></main>
      <Footer />
    </>
  );
}
