// =====================================================================
//  示範模式（僅用於預覽，不會進入正式版）
//  在瀏覽器記憶體裡模擬 Supabase：資料表、權限、RPC、觸發器、登入、照片空間、通知寄送。
//  邏輯與 supabase/01-setup.sql 相同，方便在沒有後端的情況下完整試用。
// =====================================================================
import IMGS from "./demo-images.json";
import TEMPLATES from "./templates.json";
import { DEFAULT_BOOKING, DEFAULT_CATEGORIES, DEFAULT_SERVICES, DEFAULT_STUDIO } from "../lib/defaults";
import { addDays, twDate } from "../lib/utils";
import { SUPABASE_URL } from "../lib/supabase";

const FILES = (window.__GIME_DEMO_FILES = window.__GIME_DEMO_FILES || {});
const now = () => new Date().toISOString();
const rid = () => (crypto.randomUUID ? crypto.randomUUID() : "id-" + Math.random().toString(36).slice(2) + Date.now());
const normPhone = (p) => (p || "").replace(/\D/g, "") || null;
const normEmail = (e) => (e || "").trim().toLowerCase() || null;
const AB = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const code = (prefix, date = twDate()) => prefix + date.slice(2).replace(/-/g, "") + "-" + Array.from({ length: 4 }, () => AB[Math.floor(Math.random() * AB.length)]).join("");
class DbError extends Error { constructor(msg, status = 400, c = "P0001") { super(msg); this.status = status; this.code = c; } }

/* ---------------- 資料 ---------------- */
const T = {
  users: [], profiles: [], settings: [], categories: [], portfolio: [], services: [], blocked_dates: [],
  customers: [], bookings: [], orders: [], albums: [], photos: [], notifications: [], audit_logs: [],
};
const PK = { settings: "key", categories: "slug", blocked_dates: "date" };
const pk = (t) => PK[t] || "id";
let seq = 1;

function seed() {
  const today = twDate();
  const admin = { id: rid(), email: "demo@gime.studio", password: "demo1234", meta: {} };
  const member = { id: rid(), email: "mei@example.com", password: "demo1234", meta: { name: "王小美" } };
  T.users.push(admin, member);
  T.profiles.push({ id: admin.id, role: "admin" }, { id: member.id, role: "member" });

  T.settings.push(
    { key: "studio", value: { ...DEFAULT_STUDIO, email: "hello@gime.studio" }, is_public: true },
    { key: "hero", value: [
      { image: IMGS.hero[0], headline: "用光線，顯影", sub: "生命中值得記住的瞬間", cat: "婚紗攝影" },
      { image: IMGS.hero[1], headline: "看見最好的自己", sub: "形象攝影・個人寫真", cat: "形象攝影" },
      { image: IMGS.hero[2], headline: "攝影 × AI 創畫", sub: "把真實影像延展成藝術作品", cat: "AI 影像創畫" },
      { image: IMGS.hero[3], headline: "讓影像說出故事", sub: "影畫創作・光影敘事", cat: "影畫創作" },
    ], is_public: true },
    { key: "booking", value: { ...DEFAULT_BOOKING, payment_info: "（示範）國泰世華 013｜帳號 000-00-000000-0｜戶名 即美創畫攝影" }, is_public: true },
    { key: "notify", value: { studio_email: "studio@gime.studio", enabled: {} }, is_public: false },
    { key: "templates", value: TEMPLATES, is_public: false },
  );
  T.categories = DEFAULT_CATEGORIES.map((c) => ({ ...c }));
  T.services = DEFAULT_SERVICES.map((s) => ({ ...s, image: "", active: true }));
  DEFAULT_CATEGORIES.forEach((c) => {
    const pool = IMGS[c.slug];
    for (let i = 0; i < 8; i++) {
      T.portfolio.push({ id: rid(), category: c.slug, title: `${c.name}・示範 ${String(i + 1).padStart(2, "0")}`, description: "示範圖片，請於後台上傳正式作品",
        images: [pool[i % 4], pool[(i + 1) % 4], pool[(i + 2) % 4]], featured: i < 2, published: true, sort: i, created_at: now() });
    }
  });

  const cust = (name, phone, email, line_id, auth) => {
    const c = { id: rid(), auth_user_id: auth || null, name, phone, email, line_id, line_user_id: null, note: "", created_at: now(), updated_at: now() };
    c.phone_norm = normPhone(phone); c.email_norm = normEmail(email);
    T.customers.push(c); return c;
  };
  const mei = cust("王小美", "0912-345-678", "mei@example.com", null, member.id);
  const chen = cust("陳大文", "0922-333-444", null, "chen_dawen", null);
  const lin = cust("林雅婷", "0933-555-666", "yating@example.com", null, null);
  const chang = cust("張家豪", "0955-777-888", "chang@example.com", null, null);
  chen.line_user_id = "Udemo123";

  const svc = (id) => T.services.find((s) => s.id === id);
  const mk = (c, sid, date, time, status, bstatus, oid, extra = {}) => {
    const s = svc(sid);
    const bid = code("GS", addDays(date, -7));
    T.bookings.push({ id: bid, customer_id: c.id, service_id: sid, service_name: s.name, date, time, status: bstatus, name: c.name, phone: c.phone,
      contact_method: c.email ? "email" : "line", email: c.email, line_id: c.line_id, note: extra.note || "", source: "web", created_at: now(), updated_at: now() });
    const paid = !["待付款", "已取消"].includes(status);
    const o = { id: oid || code("OD", addDays(date, -7)), booking_id: bid, customer_id: c.id, customer_name: c.name, phone: c.phone, service_id: sid, service_name: s.name,
      date, time, amount: s.price, paid_amount: paid ? s.price : 0, payment_method: paid ? "銀行轉帳" : "", payment_ref: "", paid_at: paid ? (extra.paid_at || now()) : null,
      status, note: "", created_at: extra.created_at || now(), updated_at: now() };
    T.orders.push(o); return o;
  };
  mk(lin, "portrait", today, "14:00", "已付款", "已預約", null, { note: "想拍窗光感，會帶兩套衣服" });
  mk(chen, "family", addDays(today, 1), "10:00", "待付款", "已預約", null, { note: "5 位大人 2 位小孩" });
  mk(chang, "business", addDays(today, 3), "11:00", "待付款", "已預約");
  mk(mei, "ai_portrait", addDays(today, 6), "15:00", "已付款", "已預約");
  const galleryOrder = mk(mei, "portrait", addDays(today, -5), "13:00", "待選片", "已完成", "OD" + addDays(today, -12).slice(2).replace(/-/g, "") + "-MEI8");
  const retouch = mk(lin, "id_photo", addDays(today, -8), "10:00", "修圖中", "已完成");
  const done = mk(chang, "ai_creation", addDays(today, -12), "16:00", "已完成", "已完成");

  const album = (o, n, withFinal, selectedIdx = []) => {
    const a = { id: rid(), order_id: o.id, title: `${o.service_name}－${o.customer_name}`, max_select: 5, message: withFinal ? "" : "可選 5 張精修，加選每張 NT$ 200", selection_confirmed_at: withFinal ? now() : null, created_at: now() };
    T.albums.push(a);
    const pool = [...IMGS.portrait, ...IMGS.wedding, ...IMGS.cinematic, ...IMGS.ai_art];
    for (let i = 0; i < n; i++) {
      T.photos.push({ id: rid(), album_id: a.id, path: pool[i % pool.length], final_path: withFinal && selectedIdx.includes(i) ? pool[i % pool.length] : null,
        filename: `IMG_${String(1021 + i).padStart(4, "0")}.jpg`, selected: selectedIdx.includes(i), retouch_status: withFinal && selectedIdx.includes(i) ? "已完成" : "未修圖", sort: i, created_at: now() });
    }
  };
  album(galleryOrder, 12, false);
  album(retouch, 6, false, [1, 3]);
  T.photos.filter((p) => p.selected).forEach((p) => (p.retouch_status = "修圖中"));
  album(done, 8, true, [0, 2, 5]);

  window.__GIME_DEMO_INFO = { admin: admin.email, member: member.email, password: "demo1234", galleryOrder: galleryOrder.id, galleryPhone: "0912345678" };
}

/* ---------------- 權限（對應 RLS） ---------------- */
let currentUid = null;
const isAdmin = () => !!currentUid && T.profiles.some((p) => p.id === currentUid && p.role === "admin");
const ownCustomerIds = () => T.customers.filter((c) => c.auth_user_id && c.auth_user_id === currentUid).map((c) => c.id);
function visible(table, row) {
  if (isAdmin()) return true;
  switch (table) {
    case "settings": return row.is_public;
    case "categories": case "blocked_dates": return true;
    case "portfolio": return row.published;
    case "services": return row.active;
    case "profiles": return row.id === currentUid;
    case "customers": return !!currentUid && row.auth_user_id === currentUid;
    case "bookings": case "orders": return ownCustomerIds().includes(row.customer_id);
    case "albums": { const o = T.orders.find((x) => x.id === row.order_id); return !!o && ownCustomerIds().includes(o.customer_id); }
    default: return false;
  }
}

/* ---------------- 稽核與通知 ---------------- */
const AUDITED = ["customers", "bookings", "orders", "services", "portfolio", "settings", "categories", "blocked_dates"];
function audit(table, action, before, after) {
  if (!AUDITED.includes(table)) return;
  if (action === "update") {
    const a = { ...before, updated_at: 0 }, b = { ...after, updated_at: 0 };
    if (JSON.stringify(a) === JSON.stringify(b)) return;
  }
  const r = after || before;
  T.audit_logs.push({ id: seq++, actor: currentUid, actor_email: T.users.find((u) => u.id === currentUid)?.email || null, action, entity: table,
    entity_id: String(r[pk(table)] ?? ""), before: before || null, after: after || null, created_at: now() });
}

function enqueue(event, ref, customerId, orderId, bookingId, payload, audiences) {
  const enabled = T.settings.find((s) => s.key === "notify")?.value?.enabled || {};
  if (enabled[event] === false) return;
  for (const audience of audiences) for (const channel of ["email", "line"]) {
    if (T.notifications.some((n) => n.event === event && n.ref_id === ref && n.channel === channel && n.audience === audience)) continue;
    T.notifications.push({ id: seq++, event, ref_id: ref, channel, audience, customer_id: customerId, order_id: orderId, booking_id: bookingId, payload,
      recipient: "", subject: "", body: "", status: "queued", error: "", attempts: 0, processed: false, created_at: now(), sent_at: null, claimed_at: null });
  }
}
const bookingPayload = (b) => {
  const o = T.orders.find((x) => x.booking_id === b.id);
  return { name: b.name, phone: b.phone, booking_id: b.id, service: b.service_name, date: b.date, time: b.time, note: b.note, order_id: o?.id, amount: o?.amount };
};

/* ---------------- 觸發器 ---------------- */
function afterInsert(table, row) {
  if (table === "orders") {
    const note = T.bookings.find((b) => b.id === row.booking_id)?.note || "";
    enqueue("booking_created", row.id, row.customer_id, row.id, row.booking_id,
      { name: row.customer_name, phone: row.phone, order_id: row.id, booking_id: row.booking_id, service: row.service_name, date: row.date, time: row.time, amount: row.amount, note }, ["customer", "studio"]);
  }
}
function beforeUpdate(table, oldRow, row) {
  row.updated_at = now();
  if (table === "orders" && row.status !== oldRow.status && row.status === "已付款" && !row.paid_at) row.paid_at = now();
}
function afterUpdate(table, oldRow, row) {
  if (table === "bookings") {
    if (row.date !== oldRow.date || row.time !== oldRow.time) T.orders.filter((o) => o.booking_id === row.id).forEach((o) => { o.date = row.date; o.time = row.time; });
    if (row.status === "已取消" && oldRow.status !== "已取消") {
      T.orders.filter((o) => o.booking_id === row.id && !["已取消", "已完成"].includes(o.status)).forEach((o) => updateRow("orders", o, { status: "已取消" }));
      enqueue("booking_cancelled", row.id, row.customer_id, T.orders.find((o) => o.booking_id === row.id)?.id, row.id, bookingPayload(row), ["customer", "studio"]);
    }
  }
  if (table === "orders" && row.status !== oldRow.status) {
    if (row.status === "已取消" && row.booking_id) {
      const b = T.bookings.find((x) => x.id === row.booking_id && x.status !== "已取消");
      if (b) updateRow("bookings", b, { status: "已取消" });
    }
    if (["拍攝完成", "待選片", "客戶已選片", "修圖中", "已完成"].includes(row.status) && row.booking_id) {
      const b = T.bookings.find((x) => x.id === row.booking_id && x.status === "已預約");
      if (b) updateRow("bookings", b, { status: "已完成" });
    }
    const ev = { 已付款: "payment_received", 待選片: "album_ready", 客戶已選片: "selection_done", 修圖中: "retouch_started", 已完成: "delivered" }[row.status];
    if (ev) {
      const al = T.albums.find((a) => a.order_id === row.id);
      enqueue(ev, row.id, row.customer_id, row.id, row.booking_id,
        { name: row.customer_name, phone: row.phone, order_id: row.id, booking_id: row.booking_id, service: row.service_name, date: row.date, time: row.time, amount: row.amount,
          selected_count: al ? T.photos.filter((p) => p.album_id === al.id && p.selected).length : 0 },
        row.status === "客戶已選片" ? ["customer", "studio"] : ["customer"]);
    }
  }
}

/* ---------------- 約束 ---------------- */
function derive(table, row) {
  if (table === "customers") { row.phone_norm = normPhone(row.phone); row.email_norm = normEmail(row.email); }
}
function checkUnique(table, row) {
  const others = T[table].filter((r) => r !== row);
  const dup = (f, msg) => { if (others.some(f)) throw new DbError(msg, 409, "23505"); };
  if (table === "customers") {
    if (row.phone_norm) dup((r) => r.phone_norm === row.phone_norm, 'duplicate key value violates unique constraint "customers_phone_uq"');
    if (row.email_norm) dup((r) => r.email_norm === row.email_norm, 'duplicate key value violates unique constraint "customers_email_uq"');
  }
  if (table === "bookings" && row.status !== "已取消") dup((r) => r.status !== "已取消" && r.date === row.date && r.time === row.time, 'duplicate key value violates unique constraint "bookings_slot_uq"');
  if (table === "albums") dup((r) => r.order_id === row.order_id, "duplicate key value violates unique constraint albums_order_id_key");
  dup((r) => r[pk(table)] === row[pk(table)], `duplicate key value violates unique constraint "${table}_pkey"`);
}
const DEFAULTS = {
  portfolio: () => ({ id: rid(), title: "", description: "", images: [], featured: false, published: true, sort: 0, created_at: now() }),
  services: () => ({ subtitle: "", description: "", price: 0, price_note: "", duration_label: "", features: [], image: "", featured: false, bookable: true, active: true, sort: 0 }),
  albums: () => ({ id: rid(), title: "", max_select: 0, message: "", selection_confirmed_at: null, created_at: now() }),
  photos: () => ({ id: rid(), final_path: null, filename: "", selected: false, retouch_status: "未修圖", sort: 0, created_at: now() }),
  blocked_dates: () => ({ reason: "" }),
  settings: () => ({ is_public: true }),
};
function insertRow(table, data) {
  const row = { ...(DEFAULTS[table]?.() || {}), ...data, updated_at: now() };
  derive(table, row);
  checkUnique(table, row);
  T[table].push(row);
  afterInsert(table, row);
  return row;
}
function updateRow(table, row, patch) {
  const old = JSON.parse(JSON.stringify(row));
  const next = { ...row, ...patch };
  derive(table, next);
  beforeUpdate(table, old, next);
  const idx = T[table].indexOf(row);
  T[table][idx] = next;
  try { checkUnique(table, next); } catch (e) { T[table][idx] = row; throw e; }
  audit(table, "update", old, next);
  afterUpdate(table, old, next);
  return next;
}
function deleteRow(table, row) {
  T[table] = T[table].filter((r) => r !== row);
  audit(table, "delete", row, null);
  if (table === "albums") T.photos = T.photos.filter((p) => p.album_id !== row.id);
  if (table === "customers") { T.bookings.forEach((b) => b.customer_id === row.id && (b.customer_id = null)); T.orders.forEach((o) => o.customer_id === row.id && (o.customer_id = null)); }
}

/* ---------------- RPC ---------------- */
function galleryAuth(orderId, phone) {
  const o = T.orders.find((x) => x.id === String(orderId || "").trim().toUpperCase());
  if (!o) throw new DbError("查無此訂單，請確認訂單編號與電話");
  const c = T.customers.find((x) => x.id === o.customer_id);
  const p = normPhone(phone);
  if ((p && (p === normPhone(o.phone) || p === c?.phone_norm)) || (currentUid && c?.auth_user_id === currentUid) || isAdmin()) return o;
  throw new DbError("查無此訂單，請確認訂單編號與電話");
}
function galleryGet(orderId, phone) {
  const o = galleryAuth(orderId, phone);
  const al = T.albums.find((a) => a.order_id === o.id);
  return {
    order: { id: o.id, status: o.status, service: o.service_name, date: o.date, time: o.time, name: o.customer_name },
    album: al ? { id: al.id, title: al.title, max_select: al.max_select, message: al.message, confirmed_at: al.selection_confirmed_at } : null,
    photos: al ? T.photos.filter((p) => p.album_id === al.id).sort((a, b) => a.sort - b.sort)
      .map((p) => ({ id: p.id, path: p.path, filename: p.filename, selected: p.selected, retouch_status: p.retouch_status, final_path: o.status === "已完成" ? p.final_path : null })) : [],
  };
}
const RPC = {
  get_booked_slots: ({ p_from, p_to }) => T.bookings.filter((b) => b.status !== "已取消" && b.date >= p_from && b.date <= p_to).map((b) => ({ date: b.date, time: b.time })),
  create_booking: (a) => {
    const name = (a.p_name || "").trim(), phone = normPhone(a.p_phone), email = normEmail(a.p_email);
    if (!name || name.length > 40) throw new DbError("請填寫姓名（40 字以內）");
    if (!phone || phone.length < 8 || phone.length > 15) throw new DbError("請填寫正確的電話號碼");
    if (a.p_contact_method === "email" && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email || "")) throw new DbError("請填寫正確的 Email");
    if (a.p_contact_method === "line" && !(a.p_line_id || "").trim()) throw new DbError("請填寫 LINE ID");
    const s = T.services.find((x) => x.id === a.p_service_id && ((x.active && x.bookable) || isAdmin()));
    if (!s) throw new DbError("此服務目前無法線上預約");
    const cfg = T.settings.find((x) => x.key === "booking").value;
    const today = twDate();
    if (isAdmin()) {
      if (a.p_date < today) throw new DbError("不能預約過去的日期");
    } else {
      if (!cfg.slots.includes(a.p_time)) throw new DbError("此時段不開放預約");
      if (a.p_date <= today) throw new DbError("請選擇明天以後的日期");
      if (a.p_date > addDays(today, cfg.max_days_ahead || 90)) throw new DbError("超過可預約的日期範圍");
      const [y, m, d] = a.p_date.split("-").map(Number);
      if ((cfg.closed_weekdays || []).includes(new Date(Date.UTC(y, m - 1, d)).getUTCDay()) || T.blocked_dates.some((x) => x.date === a.p_date)) throw new DbError("當天為公休日");
      if (T.bookings.filter((b) => normPhone(b.phone) === phone && b.status === "已預約" && b.date >= today).length >= 3) throw new DbError("此電話已有 3 筆以上的有效預約，如需再預約請直接與工作室聯繫");
    }
    if (T.bookings.some((b) => b.status !== "已取消" && b.date === a.p_date && b.time === a.p_time)) throw new DbError("很抱歉，此時段剛剛已被預約，請選擇其他時段");
    let c = (currentUid && T.customers.find((x) => x.auth_user_id === currentUid)) || T.customers.find((x) => x.phone_norm === phone) || (email && T.customers.find((x) => x.email_norm === email));
    const emailFree = email && !T.customers.some((x) => x.email_norm === email);
    if (!c) c = insertRow("customers", { id: rid(), auth_user_id: null, name, phone: a.p_phone.trim(), email: emailFree ? a.p_email.trim() : null, line_id: (a.p_line_id || "").trim() || null, line_user_id: null, note: "", created_at: now() });
    else {
      if (!c.email && emailFree) c.email = a.p_email.trim(), c.email_norm = email;
      if ((a.p_line_id || "").trim()) c.line_id = a.p_line_id.trim();
    }
    const b = insertRow("bookings", { id: code("GS"), customer_id: c.id, service_id: s.id, service_name: s.name, date: a.p_date, time: a.p_time, status: "已預約", name, phone: a.p_phone.trim(),
      contact_method: a.p_contact_method, email: (a.p_email || "").trim() || null, line_id: (a.p_line_id || "").trim() || null, note: a.p_note || "", source: isAdmin() ? "admin" : "web", created_at: now() });
    const o = insertRow("orders", { id: code("OD"), booking_id: b.id, customer_id: c.id, customer_name: name, phone: a.p_phone.trim(), service_id: s.id, service_name: s.name, date: a.p_date, time: a.p_time,
      amount: s.price, paid_amount: 0, payment_method: "", payment_ref: "", paid_at: null, status: "待付款", note: "", created_at: now() });
    return { booking_id: b.id, order_id: o.id, service: s.name, date: a.p_date, time: a.p_time, amount: s.price, name };
  },
  gallery_get: (a) => galleryGet(a.p_order_id, a.p_phone),
  gallery_toggle: (a) => {
    const o = galleryAuth(a.p_order_id, a.p_phone);
    if (o.status !== "待選片") throw new DbError("目前不在選片階段，如需調整請聯繫工作室");
    const al = T.albums.find((x) => x.order_id === o.id);
    if (a.p_selected && al.max_select > 0 && T.photos.filter((p) => p.album_id === al.id && p.selected && p.id !== a.p_photo_id).length >= al.max_select) throw new DbError(`已達可選張數上限（${al.max_select} 張）`);
    const p = T.photos.find((x) => x.id === a.p_photo_id && x.album_id === al.id);
    if (p) p.selected = a.p_selected;
    return galleryGet(a.p_order_id, a.p_phone);
  },
  gallery_confirm: (a) => {
    const o = galleryAuth(a.p_order_id, a.p_phone);
    if (o.status !== "待選片") throw new DbError("目前不在選片階段");
    const al = T.albums.find((x) => x.order_id === o.id);
    if (!T.photos.some((p) => p.album_id === al.id && p.selected)) throw new DbError("請至少選擇一張照片");
    al.selection_confirmed_at = now();
    updateRow("orders", o, { status: "客戶已選片" });
    return galleryGet(a.p_order_id, a.p_phone);
  },
  member_link: (a) => {
    if (!currentUid) throw new DbError("請先登入");
    let c = T.customers.find((x) => x.auth_user_id === currentUid);
    if (c) return c;
    const email = normEmail(T.users.find((u) => u.id === currentUid).email);
    c = T.customers.find((x) => x.email_norm === email && !x.auth_user_id);
    const phone = normPhone(a.p_phone);
    if (!c && phone) {
      c = T.customers.find((x) => x.phone_norm === phone);
      if (c && (c.auth_user_id || (c.email_norm && c.email_norm !== email))) throw new DbError("此電話已綁定其他帳號，請聯繫工作室協助處理");
    }
    if (c) return updateRow("customers", c, { auth_user_id: currentUid, email: c.email || email });
    if (!(a.p_name || "").trim()) throw new DbError("請填寫姓名");
    return insertRow("customers", { id: rid(), auth_user_id: currentUid, name: a.p_name.trim(), phone: (a.p_phone || "").trim(), email, line_id: null, line_user_id: null, note: "", created_at: now() });
  },
  member_update_profile: (a) => {
    const c = T.customers.find((x) => x.auth_user_id === currentUid);
    if (!c) throw new DbError("找不到您的會員資料");
    const phone = normPhone(a.p_phone);
    if (!(a.p_name || "").trim()) throw new DbError("請填寫姓名（40 字以內）");
    if (!phone || phone.length < 8) throw new DbError("請填寫正確的電話號碼");
    if (T.customers.some((x) => x.phone_norm === phone && x.id !== c.id)) throw new DbError("此電話已被其他帳號使用");
    return updateRow("customers", c, { name: a.p_name.trim(), phone: a.p_phone.trim(), line_id: (a.p_line_id || "").trim() || null });
  },
};

/* ---------------- 通知寄送（示範：不實際寄出） ---------------- */
function sendNotifications() {
  const s = Object.fromEntries(T.settings.map((x) => [x.key, x.value]));
  const tpls = s.templates || {};
  const out = { processed: 0, sent: 0, skipped: 0, failed: 0 };
  const render = (t, v) => (t || "").replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => (v[k] ?? ""));
  for (const n of T.notifications.filter((x) => x.status === "queued")) {
    out.processed++;
    const vars = { ...n.payload, studio_name: s.studio?.name, studio_phone: s.studio?.phone, site_url: window.location.origin };
    const tpl = (n.audience === "studio" && tpls[`studio_${n.event}`]) || tpls[n.event] || { subject: n.event, body: "" };
    n.subject = render(tpl.subject, vars); n.body = render(tpl.body, vars);
    const c = T.customers.find((x) => x.id === n.customer_id);
    const b = T.bookings.find((x) => x.id === n.booking_id);
    if (n.channel === "email") n.recipient = n.audience === "studio" ? s.notify?.studio_email || "" : b?.email || c?.email || "";
    else n.recipient = n.audience === "studio" ? s.notify?.line_admin_ids || "" : c?.line_user_id || "";
    if (n.recipient) { n.status = "sent"; n.error = "示範模式：未實際寄出"; n.sent_at = now(); out.sent++; }
    else { n.status = "skipped"; n.error = n.channel === "line" ? (n.audience === "studio" ? "尚未設定工作室 LINE userId" : "客戶尚未綁定 LINE 官方帳號") : "沒有收件 Email"; out.skipped++; }
  }
  return out;
}

/* ---------------- 查詢解析（PostgREST 語法） ---------------- */
function cmp(a, b) {
  if (a === b) return 0;
  if (a === null || a === undefined) return 1;
  if (b === null || b === undefined) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a) < String(b) ? -1 : 1;
}
function matchOp(val, op, arg) {
  const s = val === null || val === undefined ? null : String(val);
  switch (op) {
    case "eq": return s === arg;
    case "neq": return s !== arg;
    case "gt": return s !== null && (typeof val === "number" ? val > Number(arg) : s > arg);
    case "gte": return s !== null && (typeof val === "number" ? val >= Number(arg) : s >= arg);
    case "lt": return s !== null && (typeof val === "number" ? val < Number(arg) : s < arg);
    case "lte": return s !== null && (typeof val === "number" ? val <= Number(arg) : s <= arg);
    case "is": return arg === "null" ? s === null : s === arg;
    case "in": return arg.replace(/^\(|\)$/g, "").split(",").map((x) => x.replace(/^"|"$/g, "")).includes(s);
    case "ilike": return s !== null && new RegExp("^" + arg.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/[*%]/g, ".*") + "$", "i").test(s);
    default: return true;
  }
}
function filterFn(params) {
  const conds = [];
  for (const [k, v] of params) {
    if (["select", "order", "limit", "offset", "on_conflict", "columns"].includes(k)) continue;
    if (k === "or") {
      const parts = v.replace(/^\(|\)$/g, "").split(",").map((p) => { const [col, op, ...rest] = p.split("."); return [col, op, rest.join(".")]; });
      conds.push((r) => parts.some(([c, op, a]) => matchOp(r[c], op, a)));
    } else {
      const neg = v.startsWith("not.");
      const vv = neg ? v.slice(4) : v;
      const i = vv.indexOf(".");
      const op = vv.slice(0, i), arg = vv.slice(i + 1);
      conds.push((r) => matchOp(r[k], op, arg) !== neg);
    }
  }
  return (r) => conds.every((f) => f(r));
}
function applyOrder(rows, order) {
  if (!order) return rows;
  const keys = order.split(",").map((o) => { const [c, dir] = o.split("."); return [c, dir === "desc" ? -1 : 1]; });
  return [...rows].sort((a, b) => { for (const [c, d] of keys) { const x = cmp(a[c], b[c]); if (x) return x * d; } return 0; });
}

/* ---------------- 假 JWT / 登入 ---------------- */
const b64 = (o) => btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
function session(u) {
  const exp = Math.floor(Date.now() / 1000) + 3600 * 12;
  const user = { id: u.id, aud: "authenticated", role: "authenticated", email: u.email, user_metadata: u.meta || {}, app_metadata: { provider: "email" }, created_at: now(), email_confirmed_at: now() };
  return { access_token: `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: u.id, email: u.email, role: "authenticated", exp })}.demo`, token_type: "bearer", expires_in: 43200, expires_at: exp, refresh_token: "rt-" + u.id, user };
}
function uidFromHeaders(h) {
  const a = h.get("authorization") || "";
  const t = a.replace(/^Bearer\s+/i, "");
  if (t.split(".").length !== 3) return null;
  try { return JSON.parse(decodeURIComponent(escape(atob(t.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))))).sub; } catch { return null; }
}

/* ---------------- fetch 攔截 ---------------- */
const json = (data, status = 200, headers = {}) => new Response(data === undefined ? null : JSON.stringify(data), { status, headers: { "content-type": "application/json", ...headers } });
const clone = (x) => JSON.parse(JSON.stringify(x));

async function handle(url, init) {
  const u = new URL(url);
  const method = (init.method || "GET").toUpperCase();
  const headers = new Headers(init.headers || {});
  currentUid = uidFromHeaders(headers);
  const path = u.pathname;
  let body = init.body;
  const readJson = () => (typeof body === "string" && body ? JSON.parse(body) : {});

  // ---- Auth ----
  if (path.startsWith("/auth/v1/")) {
    const r = path.slice(9);
    if (r === "token") {
      const b = readJson();
      const usr = u.searchParams.get("grant_type") === "refresh_token"
        ? T.users.find((x) => "rt-" + x.id === b.refresh_token)
        : T.users.find((x) => x.email.toLowerCase() === (b.email || "").toLowerCase() && x.password === b.password);
      if (!usr) return json({ code: 400, error_code: "invalid_credentials", msg: "Invalid login credentials" }, 400);
      return json(session(usr));
    }
    if (r === "signup") {
      const b = readJson();
      if (T.users.some((x) => x.email.toLowerCase() === (b.email || "").toLowerCase())) return json({ code: 422, error_code: "user_already_exists", msg: "User already registered" }, 422);
      if ((b.password || "").length < 6) return json({ code: 422, error_code: "weak_password", msg: "Password should be at least 6 characters." }, 422);
      const usr = { id: rid(), email: b.email, password: b.password, meta: b.data || {} };
      T.users.push(usr); T.profiles.push({ id: usr.id, role: "member" });
      return json(session(usr));
    }
    if (r === "user") {
      const usr = T.users.find((x) => x.id === currentUid);
      if (!usr) return json({ code: 401, msg: "invalid JWT" }, 401);
      if (method === "PUT") { const b = readJson(); if (b.password) usr.password = b.password; }
      return json(session(usr).user);
    }
    if (r.startsWith("logout")) return new Response(null, { status: 204 });
    if (r === "recover") return json({});
    return json({}, 200);
  }

  // ---- Functions ----
  if (path.startsWith("/functions/v1/send-notifications")) return json(sendNotifications());

  // ---- Storage ----
  if (path.startsWith("/storage/v1/object/")) {
    const rest = decodeURIComponent(path.slice("/storage/v1/object/".length));
    if (method === "DELETE") {
      const b = readJson(); const bucket = rest;
      (b.prefixes || []).forEach((p) => delete FILES[`${bucket}/${p}`]);
      return json([]);
    }
    if (method === "POST" || method === "PUT") {
      if (!isAdmin()) return json({ statusCode: "403", error: "Unauthorized", message: "new row violates row-level security policy" }, 403);
      let blob = body;
      if (body instanceof FormData) { for (const [, v] of body.entries()) if (v instanceof Blob) { blob = v; break; } }
      FILES[rest] = URL.createObjectURL(blob instanceof Blob ? blob : new Blob([blob]));
      return json({ Key: rest, Id: rid() });
    }
    return json({ message: "not found" }, 404);
  }

  // ---- REST ----
  if (path.startsWith("/rest/v1/rpc/")) {
    const fn = path.slice(13);
    if (!RPC[fn]) return json({ message: `function ${fn} not found` }, 404);
    return json(clone(RPC[fn](readJson()) ?? null));
  }
  if (path.startsWith("/rest/v1/")) {
    const table = path.slice(9);
    if (!T[table]) return json({ message: `relation "${table}" does not exist`, code: "42P01" }, 404);
    const params = u.searchParams;
    const where = filterFn(params);
    const prefer = headers.get("prefer") || "";
    const wantRep = prefer.includes("return=representation");

    if (method === "GET" || method === "HEAD") {
      let rows = T[table].filter((r) => visible(table, r) && where(r));
      const total = rows.length;
      rows = applyOrder(rows, params.get("order"));
      const off = Number(params.get("offset") || 0);
      if (params.get("limit")) rows = rows.slice(off, off + Number(params.get("limit")));
      const range = { "content-range": `${rows.length ? `0-${rows.length - 1}` : "*"}/${total}` };
      if (method === "HEAD") return new Response(null, { status: 200, headers: range });
      if ((headers.get("accept") || "").includes("vnd.pgrst.object")) {
        if (rows.length !== 1) return json({ message: "JSON object requested, multiple (or no) rows returned", code: "PGRST116" }, 406);
        return json(clone(rows[0]), 200, range);
      }
      return json(clone(rows), 200, range);
    }
    if (!isAdmin()) return json({ message: `new row violates row-level security policy for table "${table}"`, code: "42501" }, 403);
    if (method === "POST") {
      const data = readJson(); const list = Array.isArray(data) ? data : [data];
      const upsert = prefer.includes("resolution=merge-duplicates");
      const out = list.map((d) => {
        const ex = upsert && T[table].find((r) => r[pk(table)] === d[pk(table)]);
        if (ex) return updateRow(table, ex, d);
        return insertRow(table, d);
      });
      return wantRep ? json(clone(out), 201) : new Response(null, { status: 201 });
    }
    if (method === "PATCH") {
      const patch = readJson();
      const out = T[table].filter((r) => where(r)).map((r) => updateRow(table, r, patch));
      return wantRep ? json(clone(out)) : new Response(null, { status: 204 });
    }
    if (method === "DELETE") {
      const rows = T[table].filter((r) => where(r));
      rows.forEach((r) => deleteRow(table, r));
      return wantRep ? json(clone(rows)) : new Response(null, { status: 204 });
    }
  }
  return json({ message: "not found" }, 404);
}

seed();
const realFetch = window.fetch.bind(window);
window.fetch = async (input, init = {}) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (!url.startsWith(SUPABASE_URL)) return realFetch(input, init);
  if (typeof input !== "string" && !(input instanceof URL)) {
    init = { method: input.method, headers: input.headers, body: init.body ?? (input.method !== "GET" && input.method !== "HEAD" ? await input.text() : undefined), ...init };
  }
  await new Promise((r) => setTimeout(r, 120)); // 模擬網路延遲
  try { return await handle(url, init); }
  catch (e) { return json({ message: e.message, code: e.code || "P0001", details: null, hint: null }, e.status || 400); }
};
