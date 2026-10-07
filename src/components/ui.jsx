import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { STATUS_TONE } from "../lib/utils";

/* ---------- Toast ---------- */
const ToastCtx = createContext(() => {});
export function ToastProvider({ children }) {
  const [t, setT] = useState(null);
  const timer = useRef();
  const show = useCallback((msg, type = "ok") => {
    clearTimeout(timer.current);
    setT({ msg, type });
    timer.current = setTimeout(() => setT(null), 3200);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {t && <div className={`toast ${t.type === "err" ? "err" : ""}`} role="status">{t.msg}</div>}
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

/* ---------- Modal ---------- */
export function Modal({ title, children, onClose, actions, wide }) {
  useEffect(() => {
    const k = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="modal-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="modal" style={wide ? { maxWidth: 820 } : undefined} role="dialog" aria-modal="true">
        {title && <h3>{title}</h3>}
        {children}
        {actions && <div className="modal-actions">{actions}</div>}
      </div>
    </div>
  );
}

export function Confirm({ title, message, confirmText = "確定", danger, onConfirm, onCancel }) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal title={title} onClose={onCancel} actions={<>
      <button className="btn btn-ghost btn-sm" onClick={onCancel}>取消</button>
      <button className={`btn btn-sm ${danger ? "btn-danger" : ""}`} disabled={busy}
        onClick={async () => { setBusy(true); try { await onConfirm(); } finally { setBusy(false); } }}>
        {busy ? "處理中…" : confirmText}
      </button>
    </>}>
      <p className="lead" style={{ fontSize: 16.5 }}>{message}</p>
    </Modal>
  );
}

/* ---------- Inputs ---------- */
export function PasswordField({ value, onChange, placeholder, autoComplete = "current-password", onEnter }) {
  const [show, setShow] = useState(false);
  return (
    <div className="pw-wrap">
      <input className="input" type={show ? "text" : "password"} value={value} maxLength={72}
        onChange={(e) => onChange(e.target.value)} placeholder={placeholder} autoComplete={autoComplete}
        onKeyDown={(e) => e.key === "Enter" && onEnter?.()} />
      <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "隱藏密碼" : "顯示密碼"}>{show ? "隱藏" : "顯示"}</button>
    </div>
  );
}

export function Field({ label, error, hint, children, full }) {
  return (
    <div className={`field ${full ? "full" : ""}`}>
      {label && <label>{label}</label>}
      {children}
      {hint && !error && <span className="hint">{hint}</span>}
      {error && <span className="err-text">{error}</span>}
    </div>
  );
}

export const Spinner = () => <div className="spinner" aria-label="載入中" />;

export function StatusBadge({ status }) {
  return <span className={`badge ${STATUS_TONE[status] || ""}`}>{status}</span>;
}

/* ---------- SEO title ---------- */
export function useTitle(title) {
  useEffect(() => {
    document.title = title ? `${title}｜即美創畫攝影 GIME STUDIO` : "即美創畫攝影 GIME STUDIO • PHOTO × AI｜新北預約制攝影工作室";
  }, [title]);
}

/* ---------- Scroll reveal ---------- */
export function Reveal({ children, className = "", as: Tag = "div", delay = 0, ...rest }) {
  const ref = useRef();
  const [inView, setIn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || !("IntersectionObserver" in window)) { setIn(true); return; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setIn(true); io.disconnect(); } }, { threshold: 0.12 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <Tag ref={ref} className={`reveal ${inView ? "in" : ""} ${className}`} style={{ transitionDelay: `${delay}ms` }} {...rest}>{children}</Tag>;
}

export function PageHero({ eyebrow, title, sub }) {
  return (
    <header className="page-hero">
      <div className="wrap">
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
    </header>
  );
}
