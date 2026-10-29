import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
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

export function Confirm({ title, message, confirmText = "確定", danger, onConfirm, onCancel, children }) {
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
      {children}
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

/* ---------- 後台：多選與批次操作 ---------- */
/** 表格多選：rows 變動時自動移除已不存在的選取 */
export function useSelection(rows, key = "id") {
  const [sel, setSel] = useState(() => new Set());
  const ids = useMemo(() => new Set((rows || []).map((r) => r[key])), [rows, key]);
  useEffect(() => { setSel((s) => { const n = new Set([...s].filter((x) => ids.has(x))); return n.size === s.size ? s : n; }); }, [ids]);
  const all = (rows || []).length > 0 && (rows || []).every((r) => sel.has(r[key]));
  return {
    sel, size: sel.size, ids: [...sel], all,
    has: (id) => sel.has(id),
    toggle: (id) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; }),
    toggleAll: () => setSel(all ? new Set() : new Set((rows || []).map((r) => r[key]))),
    clear: () => setSel(new Set()),
  };
}

/** 勾選後出現的批次操作列 */
export function BulkBar({ selection, children, label = "筆" }) {
  if (!selection.size) return null;
  return (
    <div className="bulkbar" role="region" aria-label="批次操作">
      <b>已選 {selection.size} {label}</b>
      {children}
      <span className="grow" />
      <button className="btn btn-ghost btn-sm" onClick={selection.clear}>取消選取</button>
    </div>
  );
}

/** 表頭勾選框與每列勾選框 */
export function CheckAll({ selection }) {
  return <th className="ck" onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={selection.all} onChange={selection.toggleAll} aria-label="全選" /></th>;
}
export function CheckCell({ selection, id }) {
  return <td className="ck" onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={selection.has(id)} onChange={() => selection.toggle(id)} aria-label="選取" /></td>;
}

/** 可排序表頭 */
export function useSort(initial, initialDir = "asc") {
  const [sort, setSort] = useState({ key: initial, dir: initialDir });
  const toggle = (key) => setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  const apply = (list, getters = {}) => {
    const get = getters[sort.key] || ((r) => r[sort.key]);
    const d = sort.dir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      const x = get(a), y = get(b);
      if (x === y) return 0;
      if (x === null || x === undefined || x === "") return 1;
      if (y === null || y === undefined || y === "") return -1;
      return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "zh-Hant")) * d;
    });
  };
  // 用法：{th("date", "日期")}
  const th = (k, label, className) => (
    <th key={k} className={className}><button className={`sort-btn ${sort.key === k ? sort.dir : ""}`} onClick={() => toggle(k)}>{label}</button></th>
  );
  return { sort, apply, th };
}
